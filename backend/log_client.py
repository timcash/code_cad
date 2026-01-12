import json
import socket
import datetime
import inspect
from typing import Any, Dict, Optional
import websockets.sync.client

import threading

class LogClient:
    def __init__(self, hostname: str = "127.0.0.1", port: int = 9776, service_name: str = "python_backend"):
        self.hostname = hostname
        self.port = port
        self.service_name = service_name
        self.uri = f"ws://{hostname}:{port}"
        self.conn = None
        self.lock = threading.Lock()

    def connect(self):
        try:
            # Disable keepalive pings to prevent errors during shutdown/hard-kills
            self.conn = websockets.sync.client.connect(self.uri, ping_interval=None)
            print(f"Connected to log service at {self.uri}")
        except Exception as e:
            print(f"Failed to connect to log service: {e}")
            self.conn = None

    def _get_caller(self) -> str:
        # Get caller frame
        stack = inspect.stack()
        # stack[0] is _get_caller, stack[1] is _log, stack[2] is info/warn/etc, stack[3] is the caller
        if len(stack) > 3:
            frame = stack[3]
            return f"{frame.filename}:{frame.lineno}"
        return "unknown"

    def _log(self, level: str, message: str):
        with self.lock:
            if not self.conn:
                 # Try to reconnect once
                self.connect()
                if not self.conn:
                    print(f"[{level}] {message} (Log service unavailable)")
                    return

            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            caller = self._get_caller()

            payload = {
                "type": "log_entry",
                "service": self.service_name,
                "entry": {
                    "level": level,
                    "message": message,
                    "timestamp": timestamp,
                    "caller": caller
                }
            }

            try:
                self.conn.send(json.dumps(payload))
                # Wait for ack or just fire and forget? 
                # The server sends back {"status": "ok"}, but strictly speaking we might not need to wait for perf reasons
                # checking response to ensure it was received
                response = self.conn.recv()
                # parse response if needed
            except Exception as e:
                print(f"Error sending log: {e}")
                self.conn = None

    def info(self, message: str):
        self._log("INFO", message)

    def warn(self, message: str):
        self._log("WARN", message)

    def error(self, message: str):
        self._log("ERROR", message)

    def debug(self, message: str):
        self._log("DEBUG", message)

    def close(self):
        if self.conn:
            self.conn.close()

# Global logger instance
logger = LogClient()
