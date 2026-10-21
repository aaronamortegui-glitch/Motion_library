"""Tests of the repo step of `python tools/setup.py --update` (setup.update()): what it does with local changes before the pull.
What it checks: a clean clone updates; test outputs that the tests rewrote (research/tests reports and sample images) never stop an
update and come back from git; a person's own change (any other tracked file, or a test fixture) stops it and nothing at all is
touched, not even the test outputs; local commits are never lost.
It builds throw-away git repos in a temp folder (an "origin" and a clone): no network, no After Effects, your clone is not touched.
Usage: python tools/test_setup_update.py
"""
import contextlib
import importlib.util
import io
import os
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("motion_setup", HERE / "setup.py")
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)

ENV = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
bad = 0


def g(cwd, *a):
    r = subprocess.run(["git", "-c", "core.autocrlf=false", *a], cwd=str(cwd), env=ENV, capture_output=True, text=True)
    assert r.returncode == 0, (a, r.stderr)
    return r.stdout.strip()


def check(name, got, want):
    global bad
    ok = got == want
    bad += 0 if ok else 1
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f" -> got {got!r}, wanted {want!r}"))


def write(root, rel, text):
    p = pathlib.Path(root) / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8", newline="\n")


def read(root, rel):
    return (pathlib.Path(root) / rel).read_text(encoding="utf-8")


FILES = {
    "research/tests/mcp_report.json": "mcp v1\n", "research/tests/layout_report.json": "layout v1\n", "research/tests/library_report.json": "library v1\n",
    "research/tests/library-mosaic.png": "mosaic v1\n", "research/tests/TEST_MIX.png": "mix v1\n", "research/tests/TEST_MIX_t.png": "mix_t v1\n",
    "research/tests/fixtures/product_car_side.jpg": "fixture v1\n", "panel/js/agent.js": "agent v1\n", "media/teaser/spec.json": "spec v1\n",
}


def scenario(tmp):
    """An origin with two commits and a clone sitting on the first: the pull brings new versions of agent.js AND of mcp_report.json."""
    origin, clone = pathlib.Path(tmp) / "origin", pathlib.Path(tmp) / "clone"
    origin.mkdir()
    g(origin, "init", "-q", "-b", "main")
    for rel, text in FILES.items():
        write(origin, rel, text)
    g(origin, "add", "-A"); g(origin, "commit", "-q", "-m", "one")
    g(tmp, "clone", "-q", "-c", "core.autocrlf=false", str(origin), str(clone))
    write(origin, "panel/js/agent.js", "agent v2\n"); write(origin, "research/tests/mcp_report.json", "mcp v2\n")
    g(origin, "add", "-A"); g(origin, "commit", "-q", "-m", "two")
    return origin, clone


def update(clone):
    S.ROOT = pathlib.Path(clone)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        try:
            ok = S.update()
        except SystemExit as e:
            ok = ("exit", e.code)
    return ok, buf.getvalue()


# the rule on its own
for p, want in [("research/tests/mcp_report.json", True), ("research/tests/layout_report.json", True), ("research/tests/library_report.json", True),
                ("research/tests/library-mosaic.png", True), ("research/tests/TEST_MIX.png", True), ("research/tests/TEST_STYLES_t.png", True),
                ("research\\tests\\mcp_report.json", True), ("research/tests/fixtures/product_car_side.jpg", False), ("research/tests/TEST_.txt", False),
                ("research/tests/TEST_sub/x.png", False), ("docs/mcp_report.json", False), ("panel/js/agent.js", False)]:
    check(f"generated_output({p!r})", S.generated_output(p), want)

with tempfile.TemporaryDirectory() as tmp:   # 1. clean clone
    origin, clone = scenario(tmp)
    ok, out = update(clone)
    check("clean clone: updates to the new commit", [ok, g(clone, "rev-parse", "HEAD") == g(origin, "rev-parse", "HEAD"), read(clone, "panel/js/agent.js")], [True, True, "agent v2\n"])

with tempfile.TemporaryDirectory() as tmp:   # 2. the tests rewrote a report that the pull also changes
    origin, clone = scenario(tmp)
    write(clone, "research/tests/mcp_report.json", "mcp LOCAL RUN\n")
    ok, out = update(clone)
    check("rewritten report that the pull also changes: restored, then updated", [ok, read(clone, "research/tests/mcp_report.json"), read(clone, "panel/js/agent.js"), "restored 1" in out], [True, "mcp v2\n", "agent v2\n", True])

with tempfile.TemporaryDirectory() as tmp:   # 3. modified, deleted and staged test outputs together
    origin, clone = scenario(tmp)
    write(clone, "research/tests/layout_report.json", "layout LOCAL\n")
    os.remove(pathlib.Path(clone) / "research/tests/library-mosaic.png")
    write(clone, "research/tests/TEST_MIX.png", "mix LOCAL STAGED\n"); g(clone, "add", "research/tests/TEST_MIX.png")
    ok, out = update(clone)
    check("modified + deleted + staged test outputs: all restored, updated", [ok, read(clone, "research/tests/layout_report.json"), read(clone, "research/tests/library-mosaic.png"), read(clone, "research/tests/TEST_MIX.png"), read(clone, "panel/js/agent.js")],
          [True, "layout v1\n", "mosaic v1\n", "mix v1\n", "agent v2\n"])
    check("  ...and nothing is left staged or modified", g(clone, "status", "--porcelain", "--untracked-files=no"), "")

with tempfile.TemporaryDirectory() as tmp:   # 4. a test fixture is an input: the person's change
    origin, clone = scenario(tmp)
    write(clone, "research/tests/fixtures/product_car_side.jpg", "fixture MINE\n")
    before = g(clone, "rev-parse", "HEAD")
    ok, out = update(clone)
    check("modified fixture: update stops, file and commit untouched", [ok, read(clone, "research/tests/fixtures/product_car_side.jpg"), g(clone, "rev-parse", "HEAD") == before, "not pulling" in out], [False, "fixture MINE\n", True, True])

with tempfile.TemporaryDirectory() as tmp:   # 5. own work next to rewritten outputs: nothing at all is touched
    origin, clone = scenario(tmp)
    write(clone, "panel/js/agent.js", "agent MY WORK\n"); write(clone, "research/tests/mcp_report.json", "mcp LOCAL RUN\n")
    before = g(clone, "rev-parse", "HEAD")
    ok, out = update(clone)
    check("own change + rewritten report: stops, and the report is NOT restored either", [ok, read(clone, "panel/js/agent.js"), read(clone, "research/tests/mcp_report.json"), g(clone, "rev-parse", "HEAD") == before], [False, "agent MY WORK\n", "mcp LOCAL RUN\n", True])
    check("  ...and it lists only the person's file", ("agent.js" in out) and ("mcp_report" not in out), True)

with tempfile.TemporaryDirectory() as tmp:   # 6. another kind of own file
    origin, clone = scenario(tmp)
    write(clone, "media/teaser/spec.json", "spec MINE\n")
    ok, out = update(clone)
    check("modified media file: update stops", [ok, read(clone, "media/teaser/spec.json")], [False, "spec MINE\n"])

with tempfile.TemporaryDirectory() as tmp:   # 7. a local commit that is not on origin
    origin, clone = scenario(tmp)
    write(clone, "docs.txt", "mine\n"); g(clone, "add", "-A"); g(clone, "commit", "-q", "-m", "local commit")
    before = g(clone, "rev-parse", "HEAD")
    ok, out = update(clone)
    check("local commit that origin lacks: the pull does not fast-forward and nothing is lost", [ok, g(clone, "rev-parse", "HEAD") == before, "git pull failed" in out], [False, True, True])

with tempfile.TemporaryDirectory() as tmp:   # 8. not a git clone
    ok, out = update(tmp)
    check("folder that is not a clone: says so and stops", [ok, "not a git clone" in out], [False, True])

print(f"\n{bad} FAILED" if bad else "\nall passed")
sys.exit(1 if bad else 0)
