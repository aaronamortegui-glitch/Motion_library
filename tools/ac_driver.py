"""Controlador de la interfaz de Animation Composer (sin tocar el plugin).

Hace doble clic en cada miniatura del panel de Animation Composer, como lo haría una persona, y espera a que
la estación de cosecha (tools/ss_harvest_station.jsx, corriendo en AE) registre el preset en
research/harvest/station/_log.csv antes de pasar al siguiente. Recorre la carpeta completa haciendo scroll.

Requisitos: Windows, Python 3, Pillow, opencv-python, numpy (sin dependencias de automatización).

Uso:
  python tools/ac_driver.py calibrate          # una vez por equipo / tamaño de panel
  python tools/ac_driver.py preview            # recorre las celdas con el mouse SIN hacer clic (verificar calibración)
  python tools/ac_driver.py run [--max N]      # con la carpeta abierta en el panel y la estación iniciada
  ESC en cualquier momento detiene el recorrido.

Uso interno como referencia de comportamiento: no descifra ni modifica Animation Composer.
"""
import argparse
import ctypes
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import ImageGrab

ROOT = Path(__file__).resolve().parent.parent
CAL = ROOT / "tools" / "ac_driver.local.json"          # calibración por equipo (ignorada por git)
LOG = ROOT / "research" / "harvest" / "station" / "_log.csv"
LABELS = ROOT / "research" / "harvest" / "station" / "labels"

user32 = ctypes.windll.user32
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)     # coordenadas reales de pantalla con escalado de Windows
except Exception:
    user32.SetProcessDPIAware()

VK_F8, VK_ESC = 0x77, 0x1B
MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_WHEEL = 0x0002, 0x0004, 0x0800


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


def cursor():
    p = POINT()
    user32.GetCursorPos(ctypes.byref(p))
    return p.x, p.y


def pressed(vk):
    return bool(user32.GetAsyncKeyState(vk) & 0x8000)


def move(x, y):
    user32.SetCursorPos(int(x), int(y))


def double_click(x, y):
    move(x, y)
    time.sleep(0.08)
    for _ in range(2):
        user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        time.sleep(0.06)


def wheel(x, y, notches):
    move(x, y)
    user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, ctypes.c_uint32(-120 * notches).value, 0)


def grab(box):
    return cv2.cvtColor(np.array(ImageGrab.grab(bbox=box, all_screens=True)), cv2.COLOR_RGB2GRAY)


def check_abort():
    if pressed(VK_ESC):
        print("\nESC: detenido por el usuario.")
        sys.exit(0)


def wait_f8(msg):
    print(msg, end="", flush=True)
    while not pressed(VK_F8):
        check_abort()
        time.sleep(0.03)
    pos = cursor()
    while pressed(VK_F8):
        time.sleep(0.03)
    print(f"  → {pos}")
    return pos


def calibrate():
    print("Calibración. Abre una carpeta con varias filas de miniaturas en Animation Composer.")
    a = wait_f8("1/4 Mouse en el CENTRO de la 1.ª miniatura (arriba-izquierda) y F8 ")
    b = wait_f8("2/4 CENTRO de la miniatura a su DERECHA y F8 ")
    c = wait_f8("3/4 CENTRO de la miniatura DEBAJO de la 1.ª y F8 ")
    d = wait_f8("4/4 CENTRO de la última miniatura VISIBLE abajo-derecha del panel y F8 ")
    dx, dy = b[0] - a[0], c[1] - a[1]
    if dx <= 0 or dy <= 0:
        sys.exit("Calibración inválida: la 2.ª debe estar a la derecha y la 3.ª debajo de la 1.ª.")
    cols = round((d[0] - a[0]) / dx) + 1
    rows = round((d[1] - a[1]) / dy) + 1
    cal = {"x0": a[0], "y0": a[1], "dx": dx, "dy": dy, "cols": cols, "rows": rows}
    CAL.write_text(json.dumps(cal, indent=1), encoding="utf-8")
    print(f"OK: {cols} columnas × {rows} filas visibles. Guardado en {CAL.name}")


def preview():
    if not CAL.exists():
        sys.exit("Falta calibración: python tools/ac_driver.py calibrate")
    cal = json.loads(CAL.read_text(encoding="utf-8"))
    print(f"Recorriendo {cal['cols']}×{cal['rows']} celdas sin hacer clic (ESC para parar)…")
    time.sleep(1.5)
    for r in range(cal["rows"]):
        for c in range(cal["cols"]):
            check_abort()
            move(cal["x0"] + c * cal["dx"], cal["y0"] + r * cal["dy"])
            time.sleep(0.35)
    print("OK: si el mouse pasó por el centro de cada miniatura, la calibración es correcta.")


def log_lines():
    return LOG.read_text(encoding="utf-8").splitlines() if LOG.exists() else []


def wait_harvest(before, timeout):
    t0 = time.time()
    while time.time() - t0 < timeout:
        check_abort()
        lines = log_lines()
        if len(lines) > before:
            return lines[-1]
        time.sleep(0.15)
    return None


def run(max_items, timeout):
    if not CAL.exists():
        sys.exit("Falta calibración: python tools/ac_driver.py calibrate")
    cal = json.loads(CAL.read_text(encoding="utf-8"))
    x0, y0, dx, dy, cols, rows = (cal[k] for k in ("x0", "y0", "dx", "dy", "cols", "rows"))
    LABELS.mkdir(parents=True, exist_ok=True)
    # zona de la cuadrícula y un punto neutro (margen derecho) para sacar el mouse de las miniaturas
    grid_box = (int(x0 - dx / 2), int(y0 - dy / 2), int(x0 + dx * (cols - 0.5)), int(y0 + dy * (rows - 0.5)))
    rest = (grid_box[2] - 4, grid_box[1] + 4)

    print("Empieza en 3 s. Deja la estación «Iniciada» en AE y no muevas el mouse. ESC para detener.")
    time.sleep(3)
    done, misses, first_row = 0, 0, 0
    while True:
        for r in range(first_row, rows):
            for c in range(cols):
                check_abort()
                x, y = x0 + c * dx, y0 + r * dy
                before = len(log_lines())
                # recorte de la etiqueta (nombre del preset) antes del clic
                label = ImageGrab.grab(bbox=(int(x - dx / 2), int(y + dy * 0.25), int(x + dx / 2), int(y + dy / 2)), all_screens=True)
                double_click(x, y)
                line = wait_harvest(before, timeout)
                move(*rest)
                if line:
                    misses = 0
                    done += 1
                    parts = line.split(",")
                    code = parts[2] if len(parts) > 2 else "unknown"
                    label.save(LABELS / f"{parts[1].replace(' ', '').replace('·', '_')}__{code}.png")
                    print(f"  ✓ {done:4d}  fila {r + 1} col {c + 1}  {code}{'  (dup)' if line.endswith(',1') else ''}")
                else:
                    misses += 1
                    print(f"  · fila {r + 1} col {c + 1} sin preset (vacía o no aplicó)")
                    if misses >= cols:
                        print(f"Fin: una fila completa sin presets. Total {done}.")
                        return
                if max_items and done >= max_items:
                    print(f"Límite --max alcanzado: {done}.")
                    return
        # scroll: seguir la última fila procesada hasta que suba a la 1.ª fila
        strip_y = int(y0 + (rows - 1) * dy - grid_box[1])
        before_img = grab(grid_box)
        tpl = before_img[max(0, strip_y - int(dy / 2)): strip_y + int(dy / 2), :]
        new_y, moved = strip_y, False
        for _ in range(40):
            check_abort()
            wheel(rest[0], rest[1], 1)
            time.sleep(0.35)
            img = grab(grid_box)
            res = cv2.matchTemplate(img, tpl, cv2.TM_CCOEFF_NORMED)
            _, score, _, loc = cv2.minMaxLoc(res)
            cy = loc[1] + tpl.shape[0] // 2
            if score > 0.8 and cy < new_y - 2:
                moved = True
            if score < 0.8 or cy <= int(dy / 2) + 2:
                new_y = cy if score >= 0.8 else -dy
                break
            if score >= 0.8 and abs(cy - new_y) <= 1 and moved:   # ya no se mueve: final de la lista
                new_y = cy
                break
            new_y = cy
        if not moved:
            print(f"Fin de la carpeta (no hay más scroll). Total {done}.")
            return
        # filas nuevas = las que quedan por debajo de la última procesada
        y0 = grid_box[1] + new_y + dy
        first_row = 0
        rows = max(1, int((grid_box[3] - y0) // dy) + 1)
        print(f"  ↓ scroll: {rows} fila(s) nuevas")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["calibrate", "preview", "run"])
    ap.add_argument("--max", type=int, default=0, help="máximo de presets a cosechar")
    ap.add_argument("--timeout", type=float, default=8.0, help="segundos de espera por preset")
    a = ap.parse_args()
    {"calibrate": calibrate, "preview": preview}.get(a.cmd, lambda: run(a.max, a.timeout))()


if __name__ == "__main__":
    main()
