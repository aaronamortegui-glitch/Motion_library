"""Runs every Motion DNA check, with After Effects open and the bridge active, and builds the visual mosaics:
  1. engine   tools/test_library.jsx  every preset animates, the controls change it, Remove cleans it
  2. panel    tools/test_panel.jsx    every category, filter, selection hook and control
  3. MCP      tools/test_mcp.py       every MCP tool, as Claude calls it
  4. visuals  tools/test_mosaics.jsx  styles · mix · controls mosaics (rendered with aerender)
              tools/make_library_mosaic.py   all presets with their tags
Outputs: research/tests/*.json and docs/examples/test-*.mp4/.gif + library-mosaic.mp4/.gif (samples for the README).
  python tools/test_all.py            (add --no-render to skip the mosaics)
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASH = "bash"


def step(title, cmd, timeout=1800):
    print(f"\n== {title}")
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    out = (r.stdout + r.stderr).strip()
    print(out[-3000:])
    return r.returncode == 0 and "FAIL" not in out and "ERROR" not in out


def main():
    res = {
        "engine": step("Engine: every preset", [BASH, "tools/bridge.sh", "tools/test_library.jsx", "900"]),
        "panel": step("Panel: categories, filters, hooks", [BASH, "tools/bridge.sh", "tools/test_panel.jsx", "120"]),
        "mcp": step("MCP: every tool", [sys.executable, "tools/test_mcp.py"]),
    }
    if "--no-render" not in sys.argv:
        ok = step("Visuals: styles, mix and controls mosaics", [BASH, "tools/bridge.sh", "tools/test_mosaics.jsx", "600"])
        ok &= step("Render the mosaics (aerender)", [BASH, "tools/render_queue_aerender.sh"])
        for name in ["TEST_STYLES", "TEST_MIX", "TEST_CONTROLS"]:
            slug = name.lower().replace("_", "-")
            src = ROOT / "renders" / f"{name}.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "libx264", "-crf", "26", "-pix_fmt", "yuv420p",
                            str(ROOT / "docs/examples" / f"{slug}.mp4")])
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-t", "2.6", "-i", str(src), "-vf",
                            "fps=10,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
                            str(ROOT / "docs/examples" / f"{slug}.gif")])
        ok &= step("All presets mosaic with tags", [sys.executable, "tools/make_library_mosaic.py"])
        res["visuals"] = ok
    print("\n" + " · ".join(f"{k}: {'PASS' if v else 'FAIL'}" for k, v in res.items()))
    sys.exit(0 if all(res.values()) else 1)


if __name__ == "__main__":
    main()
