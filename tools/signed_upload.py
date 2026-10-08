"""Sube un archivo a un descriptor de subida firmada (p. ej. flora_create_asset source="signed-url").

Uso: python tools/signed_upload.py <archivo> '<json del campo "upload">'
Envía un POST multipart con todos los form_fields tal cual y el archivo al final (campo file_field).
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
