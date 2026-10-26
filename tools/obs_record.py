"""Drive OBS Studio (GPL-2.0, used as an app, never linked) to record the screen for UI demos and tutorials, through
the obs-websocket server built into OBS 28+ (protocol v5). Standard library only.

In OBS: Tools > WebSocket Server Settings > Enable (port 4455). If it has a password, put it in the environment
variable OBS_WS_PASSWORD (it is never printed or stored).

Usage: python tools/obs_record.py status | start | stop | scene <name> | scenes
`stop` prints the path of the new recording: bring it into AE with MCP import_media (MCP record_screen does both).
"""
import base64, hashlib, json, os, socket, struct, sys

HOST, PORT = os.environ.get("OBS_WS_HOST", "127.0.0.1"), int(os.environ.get("OBS_WS_PORT", "4455"))


class OBS:
    def __init__(self, timeout=5):
        self.s = socket.create_connection((HOST, PORT), timeout=timeout); key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET / HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
                        "Sec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: obswebsocket.json\r\n\r\n").encode())
        head = b""
        while b"\r\n\r\n" not in head: head += self.s.recv(1)
        if b" 101 " not in head.split(b"\r\n")[0]: raise RuntimeError("OBS did not accept the websocket: " + head.split(b"\r\n")[0].decode())
        hello = self.recv()["d"]; ident = {"rpcVersion": 1}
        if "authentication" in hello:
            pw = os.environ.get("OBS_WS_PASSWORD")
            if not pw: raise RuntimeError("OBS asks for a password: set OBS_WS_PASSWORD")
            a = hello["authentication"]; secret = base64.b64encode(hashlib.sha256((pw + a["salt"]).encode()).digest()).decode()
            ident["authentication"] = base64.b64encode(hashlib.sha256((secret + a["challenge"]).encode()).digest()).decode()
        self.send({"op": 1, "d": ident}); self.recv(); self.n = 0

    def send(self, obj):
        data = json.dumps(obj).encode(); mask = os.urandom(4); n = len(data)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
        self.s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        def take(k):
            b = b""
            while len(b) < k: b += self.s.recv(k - len(b))
            return b
        b1, b2 = take(2); n = b2 & 0x7F
        if n == 126: n = struct.unpack(">H", take(2))[0]
        elif n == 127: n = struct.unpack(">Q", take(8))[0]
        return json.loads(take(n))

    def call(self, kind, data=None):
        self.n += 1; rid = str(self.n); self.send({"op": 6, "d": {"requestType": kind, "requestId": rid, "requestData": data or {}}})
        while True:
            m = self.recv()
            if m.get("op") == 7 and m["d"].get("requestId") == rid:
                st = m["d"]["requestStatus"]
                if not st.get("result"): raise RuntimeError(f"{kind}: {st.get('comment') or st.get('code')}")
                return m["d"].get("responseData") or {}


def run(action, arg=None):
    o = OBS()
    if action == "status": r = o.call("GetRecordStatus"); return "recording " + r.get("outputTimecode", "") if r.get("outputActive") else "not recording"
    if action == "start": o.call("StartRecord"); return "recording started"
    if action == "stop": return o.call("StopRecord").get("outputPath", "")
    if action == "scenes": return "\n".join(s["sceneName"] for s in o.call("GetSceneList")["scenes"])
    if action == "scene": o.call("SetCurrentProgramScene", {"sceneName": arg}); return "scene " + arg
    raise ValueError(action)


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    try: print(run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
    except (ConnectionRefusedError, socket.timeout, OSError) as e: sys.exit(f"OBS is not reachable on {HOST}:{PORT} ({e}): open OBS and enable Tools > WebSocket Server Settings")
