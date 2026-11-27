"""Call motion-dna-premiere tools in-process (same code path as MCP tools/call). Usage: python spike/mcp_call.py tool '{json args}'"""
import json, sys, pathlib, base64
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import mcp_premiere as m
res = m.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": sys.argv[1], "arguments": json.loads(sys.argv[2] if len(sys.argv) > 2 else "{}")}})
for c in res["content"]:
    if c["type"] == "text": print(c["text"])
    else:
        out = pathlib.Path(__file__).parent / "_projects" / "frames" / "mcp_last.png"; out.write_bytes(base64.b64decode(c["data"])); print("image ->", out)
if res.get("isError"): sys.exit(1)
