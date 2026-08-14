"""Ponte entre o Node e o ipykernel que roda dentro da jail do Studio.

Roda FORA da jail (mesmo padrão do runner: processo filho do Next) e fala
o protocolo Jupyter via ZMQ pelo loopback compartilhado. O contrato com o
Node é JSON por linha:

  stdin  → {"op": "execute", "id": "<cellId>", "code": "..."}
           {"op": "shutdown"}
  stdout ← {"event": "ready"}
           {"event": "stream", "id", "name": "stdout"|"stderr", "text"}
           {"event": "execute_result", "id", "data": {mime: str}, "executionCount"}
           {"event": "display_data", "id", "data": {mime: str}}
           {"event": "error", "id", "ename", "evalue", "traceback": [str]}
           {"event": "done", "id", "status": "ok"|"error", "executionCount"}
           {"event": "shutdown_ok"}
           {"event": "fatal", "message"}

Interrupt não passa por aqui: o Node manda SIGINT direto na unit do kernel
(systemctl kill), e o efeito chega como error/done pelo iopub.
"""

import json
import queue
import sys
import time
from pathlib import Path

from jupyter_client import BlockingKernelClient

CONNECTION_FILE_DEADLINE_S = 30
HEARTBEAT_CHECK_INTERVAL_S = 5
# Mimes que persistimos/exibimos na v1 (texto + PNG; sem HTML arbitrário).
ALLOWED_MIMES = ("text/plain", "image/png")


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def fatal(message: str) -> None:
    emit({"event": "fatal", "message": message})
    sys.exit(1)


def wait_for_connection_file(path: Path) -> None:
    deadline = time.monotonic() + CONNECTION_FILE_DEADLINE_S
    while time.monotonic() < deadline:
        if path.exists() and path.stat().st_size > 0:
            try:
                json.loads(path.read_text())
                return
            except json.JSONDecodeError:
                pass
        time.sleep(0.2)
    fatal("connection file do kernel não apareceu a tempo")


def pick_data(bundle: dict) -> dict:
    return {mime: bundle[mime] for mime in ALLOWED_MIMES if mime in bundle}


def run_execute(client: BlockingKernelClient, cell_id: str, code: str) -> None:
    msg_id = client.execute(code, allow_stdin=False, stop_on_error=False)
    status = "ok"
    execution_count = None
    last_heartbeat = time.monotonic()

    while True:
        try:
            msg = client.get_iopub_msg(timeout=1)
        except queue.Empty:
            now = time.monotonic()
            if now - last_heartbeat >= HEARTBEAT_CHECK_INTERVAL_S:
                last_heartbeat = now
                if not client.is_alive():
                    fatal("kernel morreu durante a execução")
            continue

        if msg["parent_header"].get("msg_id") != msg_id:
            continue

        msg_type = msg["msg_type"]
        content = msg["content"]

        if msg_type == "status" and content["execution_state"] == "idle":
            break
        if msg_type == "stream":
            emit(
                {
                    "event": "stream",
                    "id": cell_id,
                    "name": content["name"],
                    "text": content["text"],
                }
            )
        elif msg_type == "execute_result":
            execution_count = content.get("execution_count")
            emit(
                {
                    "event": "execute_result",
                    "id": cell_id,
                    "data": pick_data(content.get("data", {})),
                    "executionCount": execution_count,
                }
            )
        elif msg_type == "display_data":
            emit(
                {
                    "event": "display_data",
                    "id": cell_id,
                    "data": pick_data(content.get("data", {})),
                }
            )
        elif msg_type == "error":
            status = "error"
            emit(
                {
                    "event": "error",
                    "id": cell_id,
                    "ename": content.get("ename", ""),
                    "evalue": content.get("evalue", ""),
                    "traceback": content.get("traceback", []),
                }
            )

    # O execute_reply do shell traz o execution_count mesmo quando a célula
    # não produz execute_result (ex.: só print).
    try:
        reply = client.get_shell_msg(timeout=5)
        if reply["parent_header"].get("msg_id") == msg_id:
            reply_content = reply["content"]
            execution_count = reply_content.get("execution_count", execution_count)
            if reply_content.get("status") == "error":
                status = "error"
    except queue.Empty:
        pass

    emit(
        {
            "event": "done",
            "id": cell_id,
            "status": status,
            "executionCount": execution_count,
        }
    )


def main() -> None:
    if len(sys.argv) != 2:
        fatal("uso: studio-kernel-bridge.py <connection-file>")

    connection_file = Path(sys.argv[1])
    wait_for_connection_file(connection_file)

    client = BlockingKernelClient()
    client.load_connection_file(str(connection_file))
    client.start_channels()
    try:
        client.wait_for_ready(timeout=30)
    except RuntimeError:
        fatal("kernel não respondeu ao handshake inicial")

    emit({"event": "ready"})

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            command = json.loads(raw_line)
        except json.JSONDecodeError:
            emit({"event": "fatal", "message": "comando inválido recebido do Node"})
            continue

        op = command.get("op")
        if op == "execute":
            run_execute(client, str(command.get("id", "")), str(command.get("code", "")))
        elif op == "shutdown":
            client.shutdown()
            emit({"event": "shutdown_ok"})
            break
        else:
            emit({"event": "fatal", "message": f"operação desconhecida: {op!r}"})

    client.stop_channels()


if __name__ == "__main__":
    main()
