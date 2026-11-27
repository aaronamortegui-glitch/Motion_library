#!/usr/bin/env python3
"""Motion DNA for Premiere (spike): the local helper between Claude and the UXP plugin running inside Premiere.

UXP plugins cannot run a server or spawn processes, but they can open a WebSocket. So this helper listens on
localhost only:
  ws://127.0.0.1:8737/mdna   the plugin connects here (it reconnects by itself every 2 s)
  http://127.0.0.1:8738/call POST {"js": "<async function body>", "timeout": 60, "target": "27"} -> runs it in the plugin
    of that Premiere version (several versions can be connected at once; no target = the newest connection)
  http://127.0.0.1:8738/status GET -> {"plugin": true/false, "hello": {...}}
The JS body receives (ppro, uxp, require) and may `return` any JSON-able value.

No dependencies (Python 3 standard library). Usage: python research/platforms/premiere/helper.py
Then call it with: python research/platforms/premiere/ppro.py "return ppro.Project.getActiveProject().then(p => p.name)"
"""
import base64
import hashlib
import json
import socket
import struct
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, WS_PORT, HTTP_PORT = "127.0.0.1", 8737, 8738
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

state = {"conns": {}, "order": [], "next": 1, "lock": threading.Lock()}   # conns: socket -> {"hello", "send_lock"}
pending = {}   # id -> {"event": Event, "reply": dict}


# ---------------------------------------------------------------- WebSocket (RFC 6455, server side, text frames)
def ws_send(conn, text):
    data = text.encode("utf-8")
    head = bytearray([0x81])
    n = len(data)
    if n < 126:
        head.append(n)
    elif n < 65536:
        head.append(126); head += struct.pack(">H", n)
    else:
        head.append(127); head += struct.pack(">Q", n)
    with state["conns"].get(conn, {}).get("send_lock", threading.Lock()):
        conn.sendall(bytes(head) + data)


def recv_exact(conn, n):
    buf = b""
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("closed")
        buf += chunk
    return buf


def ws_recv(conn):
    """Returns the next text message (joins fragments), or None when the socket closes."""
    parts, opcode0 = [], None
    while True:
        b1, b2 = recv_exact(conn, 2)
        fin, opcode = b1 & 0x80, b1 & 0x0F
        n = b2 & 0x7F
        if n == 126:
            n = struct.unpack(">H", recv_exact(conn, 2))[0]
        elif n == 127:
            n = struct.unpack(">Q", recv_exact(conn, 8))[0]
        mask = recv_exact(conn, 4) if b2 & 0x80 else b"\0\0\0\0"
        data = bytearray(recv_exact(conn, n))
        for i in range(n):
            data[i] ^= mask[i % 4]
        if opcode == 0x8:      # close
            return None
        if opcode == 0x9:      # ping -> pong
            with state["conns"].get(conn, {}).get("send_lock", threading.Lock()):
                conn.sendall(bytes([0x8A, len(data)]) + bytes(data))
            continue
        if opcode == 0xA:      # pong
            continue
        if opcode in (0x1, 0x2):
            opcode0 = opcode
        parts.append(bytes(data))
        if fin:
            return b"".join(parts).decode("utf-8", "replace")


def handle_plugin(conn):
    req = b""
    while b"\r\n\r\n" not in req:
        chunk = conn.recv(4096)
        if not chunk:
            return
        req += chunk
    headers = {}
    for line in req.decode("latin-1").split("\r\n")[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    key = headers.get("sec-websocket-key")
    if not key:
        conn.sendall(b"HTTP/1.1 400 Bad Request\r\n\r\n"); return
    accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
    conn.sendall(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                  f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())
    state["conns"][conn] = {"hello": None, "send_lock": threading.Lock()}
    state["order"].append(conn)
    print("plugin connected", flush=True)
    try:
        while True:
            msg = ws_recv(conn)
            if msg is None:
                break
            try:
                obj = json.loads(msg)
            except ValueError:
                continue
            if obj.get("hello"):
                state["conns"][conn]["hello"] = obj
                print("hello:", obj, flush=True)
                continue
            p = pending.get(obj.get("id"))
            if p:
                p["reply"] = obj
                p["event"].set()
    except (ConnectionError, OSError):
        pass
    finally:
        state["conns"].pop(conn, None)
        if conn in state["order"]:
            state["order"].remove(conn)
        print("plugin disconnected", flush=True)


def ws_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, WS_PORT))
    srv.listen(4)
    while True:
        conn, _ = srv.accept()
        threading.Thread(target=handle_plugin, args=(conn,), daemon=True).start()


def pick(target=None):
    """The connection to use: the newest one, or the one whose Premiere version starts with `target` ("26", "27.0")."""
    for conn in reversed(state["order"]):
        h = (state["conns"].get(conn) or {}).get("hello") or {}
        if not target or str(h.get("version", "")).startswith(str(target)):
            return conn
    return None


def call(js, timeout=60, target=None):
    conn = pick(target)
    if not conn:
        live = [(c.get("hello") or {}).get("version") for c in state["conns"].values()]
        return {"ok": False, "error": f"no Premiere plugin connected for target {target!r} (connected: {live}); open Window > UXP Plugins > Motion DNA"}
    with state["lock"]:
        cid = state["next"]; state["next"] += 1
    ev = threading.Event()
    pending[cid] = {"event": ev, "reply": None}
    try:
        ws_send(conn, json.dumps({"id": cid, "js": js}))
        if not ev.wait(timeout):
            return {"ok": False, "error": f"timeout after {timeout} s"}
        r = pending[cid]["reply"]
        r["premiere"] = (state["conns"].get(conn, {}).get("hello") or {}).get("version")
        return r
    finally:
        pending.pop(cid, None)


# ---------------------------------------------------------------- HTTP side (for Claude, scripts, the MCP server later)
class Handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/status":
            hellos = [state["conns"][c]["hello"] for c in state["order"] if c in state["conns"]]
            return self._json(200, {"plugin": bool(hellos), "connected": hellos})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/call":
            return self._json(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length", 0))
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._json(400, {"error": "bad json"})
        self._json(200, call(req.get("js", ""), float(req.get("timeout", 60)), req.get("target")))

    def log_message(self, *a):
        pass


def main():
    threading.Thread(target=ws_server, daemon=True).start()
    print(f"Motion DNA Premiere helper: ws://{HOST}:{WS_PORT}/mdna  http://{HOST}:{HTTP_PORT}", flush=True)
    ThreadingHTTPServer((HOST, HTTP_PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
