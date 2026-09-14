"""Ponte entre o Node e o ipykernel que roda dentro da jail do Studio.

Roda FORA da jail (mesmo padrão do runner: processo filho do Next) e fala
o protocolo Jupyter via ZMQ pelo loopback compartilhado. O contrato com o
Node é JSON por linha:

  stdin  → {"op": "execute", "id": "<cellId>", "code": "..."}
           {"op": "input_reply", "value": "..."}
           {"op": "shutdown"}
  stdout ← {"event": "ready"}
           {"event": "started", "id"}
           {"event": "input_request", "id", "prompt", "password"}
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

import collections
import json
import os
import queue
import select
import sys
import time
from pathlib import Path

from jupyter_client import BlockingKernelClient

CONNECTION_FILE_DEADLINE_S = 30
HEARTBEAT_CHECK_INTERVAL_S = 5
# Enquanto uma célula espera input(), o stdin do Node é lido com este passo
# para que o fim da célula (Interromper → KeyboardInterrupt) seja percebido.
INPUT_POLL_INTERVAL_S = 0.2
# Mimes que persistimos/exibimos, em ordem de preferência de render no client.
# HTML/SVG passam por sanitização (DOMPurify) antes do render na UI.
ALLOWED_MIMES = (
    "image/png",
    "image/jpeg",
    "image/svg+xml",
    "text/html",
    "text/latex",
    "text/markdown",
    "text/plain",
)
# Cap por mime pra não estourar o SSE nem inchar o .ipynb persistido.
MAX_MIME_BYTES = 2_000_000
TRUNCATION_NOTICE = "\n… [saída truncada pelo Studio]"


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
    data = {}
    for mime in ALLOWED_MIMES:
        if mime not in bundle:
            continue
        value = bundle[mime]
        if isinstance(value, list):
            value = "".join(part for part in value if isinstance(part, str))
        if not isinstance(value, str):
            continue
        if len(value) > MAX_MIME_BYTES:
            if mime.startswith("image/"):
                # Imagem truncada é irrecuperável; deixa o fallback textual.
                continue
            value = value[:MAX_MIME_BYTES] + TRUNCATION_NOTICE
        data[mime] = value
    return data


# Ops de execução que chegam do Node enquanto uma célula espera input();
# o loop principal drena esta fila antes de voltar a ler o stdin.
pending_ops: collections.deque = collections.deque()

# Leitor de linhas próprio sobre o fd 0: o TextIOWrapper de sys.stdin guarda
# linhas coalescidas num buffer invisível ao select(), então duas ops escritas
# juntas pelo Node ficariam presas até a próxima escrita.
_stdin_buffer = bytearray()
_stdin_closed = False


def reset_stdin_buffer() -> None:
    global _stdin_buffer, _stdin_closed
    _stdin_buffer = bytearray()
    _stdin_closed = False


def _pop_buffered_line():
    global _stdin_buffer
    newline = _stdin_buffer.find(b"\n")
    if newline == -1:
        return None
    line = bytes(_stdin_buffer[:newline])
    del _stdin_buffer[: newline + 1]
    return line.decode("utf-8", errors="replace")


def read_command(timeout=None):
    """Próximo comando JSON do Node, ou None se `timeout` (segundos) estourar.

    Devolve `False` quando o stdin fechou de vez. Linhas vazias ou inválidas
    são puladas sem consumir o timeout inteiro.
    """
    global _stdin_closed
    deadline = None if timeout is None else time.monotonic() + timeout
    while True:
        line = _pop_buffered_line()
        if line is not None:
            line = line.strip()
            if not line:
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                emit({"event": "fatal", "message": "comando inválido recebido do Node"})
                continue
        if _stdin_closed:
            return False
        remaining = None if deadline is None else max(0.0, deadline - time.monotonic())
        ready, _, _ = select.select([0], [], [], remaining)
        if not ready:
            return None
        chunk = os.read(0, 65536)
        if not chunk:
            _stdin_closed = True
            if _stdin_buffer:
                _stdin_buffer.extend(b"\n")
            continue
        _stdin_buffer.extend(chunk)


def wait_for_input_reply(client) -> bool:
    """Espera o input_reply da UI sem ficar cego para o fim da célula.

    Devolve True quando o reply foi entregue ao kernel e False quando a célula
    terminou sozinha (Interromper dispara KeyboardInterrupt dentro do input(),
    e o execute_reply aparece no shell). Executes enfileirados nesse meio-tempo
    vão para pending_ops; shutdown é honrado na hora.
    """
    while True:
        if client.shell_channel.msg_ready():
            return False
        command = read_command(timeout=INPUT_POLL_INTERVAL_S)
        if command is None:
            if not client.is_alive():
                fatal("kernel morreu aguardando input_reply")
            continue
        if command is False:
            fatal("stdin do Node fechou aguardando input_reply")
        op = command.get("op")
        if op == "input_reply":
            client.input(str(command.get("value", "")))
            return True
        if op == "shutdown":
            client.shutdown()
            emit({"event": "shutdown_ok"})
            sys.exit(0)
        if op == "execute":
            pending_ops.append(command)


def drain_input_requests(client: BlockingKernelClient, cell_id: str) -> None:
    while client.stdin_channel.msg_ready():
        try:
            msg = client.stdin_channel.get_msg(timeout=0)
        except queue.Empty:
            return
        if msg["msg_type"] != "input_request":
            continue
        content = msg["content"]
        emit(
            {
                "event": "input_request",
                "id": cell_id,
                "prompt": content.get("prompt", ""),
                "password": bool(content.get("password", False)),
            }
        )
        wait_for_input_reply(client)


def run_execute(client: BlockingKernelClient, cell_id: str, code: str) -> None:
    emit({"event": "started", "id": cell_id})
    msg_id = client.execute(code, allow_stdin=True, stop_on_error=False)
    status = "ok"
    execution_count = None
    last_heartbeat = time.monotonic()

    while True:
        drain_input_requests(client, cell_id)
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

    while True:
        if pending_ops:
            command = pending_ops.popleft()
        else:
            command = read_command()
            if command is False:
                break

        op = command.get("op")
        if op == "execute":
            run_execute(client, str(command.get("id", "")), str(command.get("code", "")))
        elif op == "input_reply":
            # Reply tardio (a célula já saiu do input); descarta sem drama.
            continue
        elif op == "shutdown":
            client.shutdown()
            emit({"event": "shutdown_ok"})
            break
        else:
            emit({"event": "fatal", "message": f"operação desconhecida: {op!r}"})

    client.stop_channels()


if __name__ == "__main__":
    main()
