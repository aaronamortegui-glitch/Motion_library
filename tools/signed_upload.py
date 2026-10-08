"""Uploads a file to a signed-upload descriptor (e.g. flora_create_asset source="signed-url").

Usage: python tools/signed_upload.py <file> '<json of the "upload" field>'
Sends a multipart POST with all form_fields as-is and the file at the end (file_field field).
"""
import json
import subprocess
import sys

path, desc = sys.argv[1], json.loads(sys.argv[2])
args = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", desc.get("method", "POST"), desc["url"]]
for k, v in desc["form_fields"].items():
    args += ["-F", f"{k}={v}"]
args += ["-F", f'{desc["file_field"]}=@{path}']
code = subprocess.run(args, capture_output=True, text=True).stdout
print("HTTP", code)
sys.exit(0 if code.startswith("2") else 1)
