"""Testes do bridge sem kernel real: cliente falso + stdin por pipe.

Rodados pelo vitest em studioKernelBridge.test.ts com o Python do venv do
Studio (que tem jupyter_client)."""
import importlib.util
import json
import os
import sys
import threading
import time
import unittest
from pathlib import Path

BRIDGE = Path(__file__).with_name("studio-kernel-bridge.py")
spec = importlib.util.spec_from_file_location("studio_kernel_bridge", BRIDGE)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class FakeChannel:
    def __init__(self):
        self.ready = False

    def msg_ready(self):
        return self.ready


class FakeClient:
    def __init__(self):
        self.shell_channel = FakeChannel()
        self.inputs = []
        self.alive = True

    def input(self, value):
        self.inputs.append(value)

    def is_alive(self):
        return self.alive


class BridgeStdin:
    """Troca o fd 0 do processo por um pipe controlado pelo teste."""

    def __enter__(self):
        self.read_fd, self.write_fd = os.pipe()
        self.saved = os.dup(0)
        os.dup2(self.read_fd, 0)
        bridge.reset_stdin_buffer()
        return self

    def write(self, payload: dict):
        os.write(self.write_fd, (json.dumps(payload) + "\n").encode())

    def __exit__(self, *exc):
        os.dup2(self.saved, 0)
        os.close(self.saved)
        os.close(self.read_fd)
        os.close(self.write_fd)


class WaitForInputReplyTest(unittest.TestCase):
    def test_returns_when_cell_ends_without_reply(self):
        client = FakeClient()
        with BridgeStdin():
            timer = threading.Timer(0.15, lambda: setattr(client.shell_channel, "ready", True))
            timer.start()
            started = time.monotonic()
            replied = bridge.wait_for_input_reply(client)
            elapsed = time.monotonic() - started
        self.assertFalse(replied)
        self.assertLess(elapsed, 2.0)
        self.assertEqual(client.inputs, [])

    def test_forwards_reply_and_queues_executes_even_when_coalesced(self):
        client = FakeClient()
        bridge.pending_ops.clear()
        with BridgeStdin() as stdin:
            os.write(
                stdin.write_fd,
                (
                    json.dumps({"op": "execute", "id": "c2", "code": "1"}) + "\n"
                    + json.dumps({"op": "input_reply", "value": "oi"}) + "\n"
                    + json.dumps({"op": "execute", "id": "c3", "code": "2"}) + "\n"
                ).encode(),
            )
            replied = bridge.wait_for_input_reply(client)
            self.assertTrue(replied)
            self.assertEqual(client.inputs, ["oi"])
            self.assertEqual([op["id"] for op in bridge.pending_ops], ["c2"])
            # A linha que ficou no buffer sai sem esperar nova escrita no pipe.
            command = bridge.read_command(timeout=0.05)
        self.assertEqual(command, {"op": "execute", "id": "c3", "code": "2"})


if __name__ == "__main__":
    unittest.main()
