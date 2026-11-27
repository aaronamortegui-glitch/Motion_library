#!/usr/bin/env python3
"""Run JavaScript inside Premiere through the Motion DNA helper (spike).

Usage:
  python ppro.py "return (await ppro.Project.getActiveProject()).name"
  python ppro.py -f some_job.js [--timeout 120] [--target 26|27]
  python ppro.py --status
The body runs as an async function with (ppro, uxp, require); `return` a JSON-able value.
"""
import json
import sys
import urllib.request

BASE = "http://127.0.0.1:8738"


def status():
    with urllib.request.urlopen(BASE + "/status", timeout=5) as r:
        return json.load(r)


def run(js, timeout=60, target=None):
    data = json.dumps({"js": js, "timeout": timeout, "target": target}).encode()
    req = urllib.request.Request(BASE + "/call", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout + 10) as r:
        return json.load(r)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "--status":
        print(json.dumps(status(), indent=1)); sys.exit(0)
    t, target = 60, None
    if "--target" in a:
        i = a.index("--target"); target = a[i + 1]; del a[i:i + 2]
    if "--timeout" in a:
        i = a.index("--timeout"); t = float(a[i + 1]); del a[i:i + 2]
    js = open(a[1], encoding="utf-8").read() if a[0] == "-f" else a[0]
    print(json.dumps(run(js, t, target), indent=1, ensure_ascii=False))
