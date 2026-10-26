// Motion DNA — After Effects panel: the library by category with live vector previews, per-apply controls
// (duration, intensity, direction, easing; collapsible), In / Out / Both + Apply / Remove, marker-driven timing, one-click styles,
// a Mix by tags (energy + tone → move and curve per layer, saved as a new style), technique guides, local assets,
// favorites, and the Claude connection (file bridge used by the MCP server).
// Install once (adds "Motion DNA" to AE's Window menu, dockable): tools/install_panel.ps1 (Windows) or
// tools/install_panel.sh (macOS). Or run it directly: File > Scripts > Run Script File… > tools/ss_panel.jsx.
// The installed loader sets SS_ROOT (repo path) and SS_PANEL_HOST (the dockable panel) before evaluating this file.
// Previews: ScriptUI cannot play GIFs, so the panel redraws the preset's real motion, sampled into
// library/preview_curves.json by tools/sample_previews.jsx, on the neutral sample (the robot head).
#include "ss_presets.jsx"
#include "ss_assets.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function (thisObj) {
    var NAME = "Motion DNA";
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", (typeof SS_PANEL_TITLE !== "undefined" && SS_PANEL_TITLE) || NAME, undefined, { resizeable: true });
    // responsive frame: everything lives in `ui`, inside a viewport with scrollbars, so a narrow or short dock never
    // hides controls. The viewport has a no-op layout manager: `ui` keeps its natural size and scrolls by location.
    win.orientation = "column"; win.alignChildren = ["fill", "fill"]; win.spacing = 0; win.margins = 0;
    var mid = win.add("group"); mid.orientation = "row"; mid.alignment = ["fill", "fill"]; mid.alignChildren = ["fill", "fill"]; mid.spacing = 0; mid.margins = 0;
    var vp = mid.add("group"); vp.alignment = ["fill", "fill"]; vp.preferredSize = [60, 60];
    var ui = vp.add("group"); ui.orientation = "column"; ui.alignChildren = ["fill", "top"]; ui.spacing = 6; ui.margins = 8;
    vp.layout = { layout: function () {}, resize: function () {} };
    var vbar = mid.add("scrollbar", [0, 0, 14, 100], 0, 0, 0); vbar.alignment = ["right", "fill"]; vbar.stepdelta = 30;
    var hrow = win.add("group"); hrow.alignment = ["fill", "bottom"]; hrow.spacing = 0; hrow.margins = 0;
    var hbar = hrow.add("scrollbar", [0, 0, 100, 14], 0, 0, 0); hbar.alignment = ["fill", "bottom"]; hbar.stepdelta = 30;
    var corner = hrow.add("group"); corner.preferredSize = [14, 14];
    var nav = win.add("group"); nav.alignment = ["fill", "bottom"]; nav.alignChildren = ["fill", "fill"]; nav.spacing = 0; nav.margins = 0;   // sections (filled below)
    var MIN_W = 240;   // narrower than this, the panel scrolls sideways instead of squeezing further
    function vpW() { return Math.max(MIN_W, (vp.size && vp.size.width > 60) ? vp.size.width : 380); }
    function scrollTo() { ui.location = [-Math.round(hbar.value), -Math.round(vbar.value)]; }
    vbar.onChanging = vbar.onChange = hbar.onChanging = hbar.onChange = scrollTo;
    function scrollBy(dv, dh) {
        vbar.value = Math.max(0, Math.min(vbar.value + dv, vbar.maxvalue)); hbar.value = Math.max(0, Math.min(hbar.value + dh, hbar.maxvalue));
        scrollTo();
    }
    // ScriptUI panels never receive mouse-wheel events, so: drag any empty area or label to scroll (like a touch
    // screen; buttons, sliders and fields keep their own clicks), and PageUp/PageDown/Home/End/arrows scroll too.
    // Mouse events reach the window once per ancestor, so the handlers work from absolute positions (idempotent).
    var DRAG = null, DRAGGABLE = { group: 1, panel: 1, statictext: 1 };
    var NO_SCROLL = false;   // set by a control that handles its own drag (the curve editor) until the mouse is released
    win.addEventListener("mousedown", function (e) {
        if (NO_SCROLL || e.button || !e.target || !DRAGGABLE[e.target.type] || e.target.noDrag) return;
        DRAG = { x: e.screenX, y: e.screenY, v: vbar.value, h: hbar.value, on: false, t: new Date().getTime() };
    });
    win.addEventListener("mousemove", function (e) {
        if (!DRAG) return;
        if (NO_SCROLL) { DRAG = null; return; }
        var now = new Date().getTime();
        if (now - DRAG.t > 400) { DRAG = null; return; }   // no moves for a while: released outside the panel
        DRAG.t = now;
        var dx = DRAG.x - e.screenX, dy = DRAG.y - e.screenY;
        if (!DRAG.on && Math.abs(dx) + Math.abs(dy) < 4) return;   // a click on a label stays a click
        DRAG.on = true;
        vbar.value = Math.max(0, Math.min(DRAG.v + dy, vbar.maxvalue)); hbar.value = Math.max(0, Math.min(DRAG.h + dx, hbar.maxvalue));
        scrollTo();
    });
    win.addEventListener("mouseup", function () { DRAG = null; NO_SCROLL = false; });
    win.addEventListener("mouseover", function () { if (typeof ensureClock === "function") ensureClock(); });
    win.addEventListener("keydown", function (e) {
        var k = e.keyName, typing = e.target && /edittext|listbox|dropdownlist|slider/.test(e.target.type);
        var page = Math.max(30, vp.size.height - 40);
        if (k === "PageDown") scrollBy(page, 0); else if (k === "PageUp") scrollBy(-page, 0);
        else if (typing) return;
        else if (k === "Down") scrollBy(40, 0); else if (k === "Up") scrollBy(-40, 0);
        else if (k === "Home") scrollBy(-vbar.maxvalue, 0); else if (k === "End") scrollBy(vbar.maxvalue, 0);
        else return;
        e.preventDefault();
    });
    // ScriptUI writes each container's computed size back into preferredSize, so it would never shrink again:
    // clear it before measuring (elements we size ourselves carry keepSize)
    function unpin(c) {
        if (!c.keepSize) c.preferredSize = [-1, -1];
        for (var i = 0; i < c.children.length; i++) { var k = c.children[i]; if (k.type === "group" || k.type === "panel") unpin(k); }
    }
    function place() {   // measure `ui` at its natural size, stretch it to the viewport, size the scrollbars
        if (!vp.size) return;
        var W = vp.size.width, H = vp.size.height, cw = Math.max(W, MIN_W);
        unpin(ui); ui.size = [cw, Math.max(H, 6000)]; ui.layout.layout(true);   // lay out at the panel width, then measure the height
        var last = ui.children[ui.children.length - 1], ch = Math.max(H, last.location.y + last.size.height + 8);
        ui.size = [cw, ch]; ui.layout.resize();
        vbar.maxvalue = Math.max(0, ch - H); hbar.maxvalue = Math.max(0, cw - W);
        vbar.value = Math.min(vbar.value, vbar.maxvalue); hbar.value = Math.min(hbar.value, hbar.maxvalue);
        vbar.jumpdelta = Math.max(30, H - 40); hbar.jumpdelta = Math.max(30, W - 40);
        vbar.enabled = vbar.maxvalue > 0; hbar.enabled = hbar.maxvalue > 0;
        scrollTo();
    }
    // the window's full layout runs once; afterwards only resize(): layout(true) on a floating panel snaps the window
    // back to its natural size, which made it impossible to drag the panel taller
    var LAID_OUT = false;
    function relayout() {
        sizePreview(); if (typeof fitActions === "function") fitActions();
        if (!LAID_OUT || !win.size) { win.layout.layout(true); LAID_OUT = !!win.size; } else win.layout.resize();
        place();
    }
    // grid geometry for the current width: as many columns of at least minW as fit, cells stretched to share the row
    function gridGeom(minW, maxW, aspect) {
        var avail = vpW() - 16, sp = 6, n = Math.max(1, Math.floor((avail + sp) / (minW + sp)));
        var w = Math.min(maxW, Math.floor((avail - (n - 1) * sp) / n));
        return { n: n, w: w, h: Math.round(w * aspect), sp: sp };
    }
    // a thumbnail button drawn at any size (iconbuttons cannot scale their image)
    function thumbButton(parent, file, w, h, label) {
        var img = null; try { if (file) img = ScriptUI.newImage(file); } catch (e) {}
        var b = parent.add("button", undefined, img ? "" : label); b.preferredSize = [w, h];
        if (img) b.onDraw = function () {
            var g = this.graphics, W = this.size.width, H = this.size.height;
            g.rectPath(0, 0, W, H); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, C.pine));
            try { var iw = img.size[0], ih = img.size[1], k = Math.min(W / iw, H / ih); g.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k); } catch (e) {}
            g.rectPath(0, 0, W, H); g.strokePath(g.newPen(g.PenType.SOLID_COLOR, C.sea, 1));
        };
        return b;
    }
    function fit(s, w) { var n = Math.max(4, Math.floor(w / 6.5)); return s.length > n ? s.substr(0, n - 1) + "…" : s; }
    var C = { pine: [0.04, 0.13, 0.12, 1], sea: [0.09, 0.29, 0.27, 1], spark: [0.85, 1, 0.52, 1], cloud: [0.97, 0.98, 0.95, 1],
              coral: [1, 0.58, 0.58, 1], muted: [0.55, 0.62, 0.59, 1] };

    // ---------- data ----------
    var META = {}, CURVES = { fps: 12, items: {} };
    try { var lib = SSM.readJSON(SS_ROOT + "/library/library.json").presets; for (var i = 0; i < lib.length; i++) META[lib[i].name] = lib[i]; } catch (e) {}
    try { CURVES = SSM.readJSON(SS_ROOT + "/library/preview_curves.json"); } catch (e) {}
    var TECH = []; try { TECH = SSM.readJSON(SS_ROOT + "/library/techniques.json").techniques; } catch (e) {}
    // brand profiles: custom styles that learn from every review (library/brands/<slug>/brand.json, tools/brand.py)
    var BRANDS = [];
    try { var bdirs = Folder(SS_ROOT + "/library/brands").getFiles(function (f) { return f instanceof Folder; });
          for (var bi = 0; bi < bdirs.length; bi++) { var bf = new File(bdirs[bi].fsName + "/brand.json"); if (bf.exists) BRANDS.push(SSM.readJSON(bf.fsName)); } } catch (e) {}
    function brandOf(slug) { for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i].slug === slug) return BRANDS[i]; return null; }
    function brandRules(b, max) {
        var out = [];
        for (var i = 0; i < b.rules.length && (!max || i < max); i++) out.push("· [" + b.rules[i].category + "] " + b.rules[i].rule);
        return out.join("\n");
    }
    // tags (library/tags.json, tools/tag_library.py): roles, targets, energy range, tones — used for the Tone filter,
    // the Transitions category and the style grid
    var TAGS = { presets: [], tones: [] }, TAGOF = {};
    try { TAGS = SSM.readJSON(SS_ROOT + "/library/tags.json"); for (var ti = 0; ti < TAGS.presets.length; ti++) TAGOF[TAGS.presets[ti].name] = TAGS.presets[ti]; } catch (e) {}
    function techSlug(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    function packSlug(n) { var ps = SSP.packs(); for (var i = 0; i < ps.length; i++) if (ps[i].name === n) return ps[i].slug; return techSlug(n); }
    function slugOf(name) { var m = META[name]; return m ? m.slug : name.toLowerCase().replace(/__/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    function thumb(kind, name, big) {
        var base = "/library/thumbs" + (big ? "" : "_sm") + "/" + kind + "/" + slugOf(name);
        if (kind === "sfx" || kind === "overlay") base = "/library/assets_cache/" + kind + "/" + techSlug(name);
        if (kind === "pack") base = "/library/packs/" + packSlug(name) + "_sm";
        if (kind === "technique") base = "/library/techniques/" + techSlug(name) + "_sm";
        var f = new File(SS_ROOT + base + ".png"); return f.exists ? f : null;
    }

    // favorites persist in AE's settings (per machine)
    var FAV = {};
    try { if (app.settings.haveSetting("MotionDNA", "favorites")) { var fl = app.settings.getSetting("MotionDNA", "favorites").split("|"); for (var q = 0; q < fl.length; q++) if (fl[q]) FAV[fl[q]] = 1; } } catch (e) {}
    function saveFav() { var a = []; for (var k in FAV) if (FAV.hasOwnProperty(k)) a.push(k); try { app.settings.saveSetting("MotionDNA", "favorites", a.join("|")); } catch (e) {} }

    // ---------- custom-drawn controls (ScriptUI buttons cannot take a background colour) ----------
    function rrect(g, x, y, w, h, r) {   // rounded rectangle path (ScriptUI has no arcs: 6 points per corner)
        r = Math.min(r, w / 2, h / 2); var K = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
        g.newPath();
        for (var c = 0; c < 4; c++) for (var i = 0; i <= 5; i++) {
            var a = (K[c][2] + 18 * i) * Math.PI / 180, px = K[c][0] + r * Math.cos(a), py = K[c][1] + r * Math.sin(a);
            if (c === 0 && i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
    }
    function rgba(c, a) { return [c[0], c[1], c[2], a === undefined ? 1 : a]; }
    function mix(c, k) { return [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k, 1]; }   // lighten toward white
    // a button painted by paint(g, W, H, hover, pressed); onDraw gets the hover/press state from ScriptUI
    function drawn(parent, w, h, tip, paint) {
        var b = parent.add("button", undefined, ""); b.preferredSize = [w, h]; b.helpTip = tip || "";
        b.onDraw = function (st) { paint(this.graphics, this.size.width, this.size.height, !!(st && st.mouseOver), !!(st && st.leftButtonPressed)); };
        return b;
    }
    function label(g, s, col, W, H, size, bold, x) {   // text centered (or at x), vertically centered
        var f = ScriptUI.newFont("dialog", bold ? "BOLD" : "REGULAR", size || 12), m = g.measureString(s, f);
        g.drawString(s, g.newPen(g.PenType.SOLID_COLOR, col, 1), x === undefined ? (W - m[0]) / 2 : x, (H - m[1]) / 2, f);
    }
    // Repaints never happen inside a mouse or keyboard event: AE crashed (dvaui UI_DispatchDrawToChild) when a
    // control was hidden and shown again while it was handling a drag. repaint() queues; the clock flushes the queue.
    var PAINT_Q = [];
    function repaint(el) {
        if (!el) return;
        for (var i = 0; i < PAINT_Q.length; i++) if (PAINT_Q[i] === el) return;
        PAINT_Q.push(el); if (typeof ensureClock === "function") ensureClock();
    }
    function flushPaint() {
        var q = PAINT_Q; PAINT_Q = [];
        for (var i = 0; i < q.length; i++) { var el = q[i]; try { if (el.visible) { el.hide(); el.show(); } } catch (e) {} }
    }
    // a solid action button in a brand colour (Apply: Spark, Remove: Coral)
    function solidButton(parent, text, bg, fg, tip) {
        var b = drawn(parent, 60, 26, tip, function (g, W, H, hov, prs) {
            rrect(g, 0.5, 0.5, W - 1, H - 1, 5); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, prs ? rgba(bg, 0.8) : (hov ? mix(bg, 0.25) : rgba(bg))));
            label(g, text, rgba(fg), W, H, 12, true);
        });
        b.alignment = ["fill", "center"];
        return b;
    }

    // ---------- header: name · MCP status pill · how to use / visualizer icons ----------
    var head = ui.add("group"); head.alignChildren = ["left", "center"]; head.alignment = ["fill", "top"]; head.spacing = 8;
    var title = head.add("statictext", undefined, NAME);
    try { title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 15); } catch (e) {}
    var MCP_ON = false;
    var pill = drawn(head, 58, 22, "", function (g, W, H, hov) {   // ● MCP: Spark dot when Claude's bridge is running
        rrect(g, 0.5, 0.5, W - 1, H - 1, H / 2); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, hov ? [0.16, 0.18, 0.16, 1] : [0.1, 0.11, 0.1, 1]));
        rrect(g, 0.5, 0.5, W - 1, H - 1, H / 2); g.strokePath(g.newPen(g.PenType.SOLID_COLOR, MCP_ON ? rgba(C.spark, 0.55) : rgba(C.muted, 0.5), 1));
        if (MCP_ON) { g.newPath(); g.ellipsePath(8, H / 2 - 5, 10, 10); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, rgba(C.spark, 0.25))); }
        g.newPath(); g.ellipsePath(10, H / 2 - 3, 6, 6); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, MCP_ON ? rgba(C.spark) : rgba(C.muted)));
        label(g, "MCP", MCP_ON ? rgba(C.spark) : rgba(C.muted), W, H, 11, true, 22);
    });
    var icons = head.add("group"); icons.alignment = ["right", "center"]; icons.spacing = 2; icons.margins = 0;
    function iconButton(tip, paint) {
        return drawn(icons, 24, 22, tip, function (g, W, H, hov, prs) {
            if (hov || prs) { rrect(g, 0.5, 0.5, W - 1, H - 1, 4); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, prs ? [0.2, 0.22, 0.2, 1] : [0.15, 0.16, 0.15, 1])); }
            paint(g, W, H, hov ? rgba(C.spark) : [0.78, 0.8, 0.77, 1]);
        });
    }
    var bHelp = iconButton("How to use: connect Claude and what you can ask it", function (g, W, H, col) {   // ? in a ring
        g.newPath(); g.ellipsePath(W / 2 - 8, H / 2 - 8, 16, 16); g.strokePath(g.newPen(g.PenType.SOLID_COLOR, col, 1.5));
        label(g, "?", col, W, H, 11, true);
    });
    var vis = iconButton("Visualizer: open the library gallery in your browser (every preset, style and curve)", function (g, W, H, col) {   // 2x2 gallery grid
        var s = 6, gap = 2, x0 = W / 2 - s - gap / 2, y0 = H / 2 - s - gap / 2;
        for (var i = 0; i < 4; i++) { rrect(g, x0 + (i % 2) * (s + gap), y0 + Math.floor(i / 2) * (s + gap), s, s, 1.5); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, col)); }
    });
    vis.onClick = function () { var f = new File(SS_ROOT + "/library/index.html"); if (f.exists) f.execute(); };
    function bridgeOn() { return !!$.global.SS_BRIDGE_TASK; }
    function lastClaude() {
        var fs = Folder(SS_ROOT + "/bridge/outbox").getFiles("*.txt"), best = 0;
        for (var i = 0; i < fs.length; i++) if (fs[i].name.charAt(0) !== "_" && fs[i].modified && fs[i].modified.getTime() > best) best = fs[i].modified.getTime();
        if (!best) return "";
        var m = Math.round((new Date().getTime() - best) / 60000);
        if (m <= 1) return " · active now";   // ifs: ExtendScript breaks chained ternaries
        if (m < 60) return " · last " + m + " min ago";
        return "";
    }
    function status() {
        var on = bridgeOn(), tip = on ? "Claude connected through MCP" + lastClaude() : "Claude offline: click to connect";
        if (on !== MCP_ON || pill.helpTip !== tip) { MCP_ON = on; pill.helpTip = tip; repaint(pill); }
    }
    pill.onClick = function () { if (!bridgeOn()) bHelp.onClick(); };
    bHelp.onClick = function () {
        if (!bridgeOn()) {
            try { $.evalFile(new File(SS_ROOT + "/tools/ss_bridge.jsx")); } catch (e) { alert(NAME + ": could not start the bridge: " + e.toString()); }
            status();
            if (!bridgeOn()) return;
        }
        alert(NAME + " is connected.\n\nIn Claude Code, open the repo folder (" + SS_ROOT + ").\nThe MCP server 'motion-dna' is registered in .mcp.json, so Claude can list presets, apply them\n" +
              "and styles to your selected layers, add assets and render frames to check its work.\n\nTry: \"Apply the Elegant style to this comp and show me a frame.\"");
    };

    // ---------- category + filters ----------
    // sections (bottom bar): Behaviors (presets, by category) · Curves (easing library and editor) · Styles · Brands · Techniques
    var SECTIONS = ["Behaviors", "Curves", "Styles", "Brands", "Techniques"], SECTION = "Behaviors";
    try { if (app.settings.haveSetting("MotionDNA", "section")) { var ss0 = app.settings.getSetting("MotionDNA", "section"); for (var si = 0; si < SECTIONS.length; si++) if (SECTIONS[si] === ss0) SECTION = ss0; } } catch (e) {}
    var CATS = ["Moves", "Classics", "Text", "Loops", "Transitions", "Recipes", "Mix", "Assets", "★ Favorites"];
    function curCat() { return SECTION === "Behaviors" ? cat.selection.text : SECTION; }
    var fRow = ui.add("group"); fRow.orientation = "column"; fRow.alignChildren = ["fill", "top"]; fRow.alignment = ["fill", "top"]; fRow.spacing = 4;
    var fA = fRow.add("group"); fA.alignChildren = ["fill", "center"];
    var fB = fRow.add("group"); fB.alignChildren = ["fill", "center"];
    var catBox = fA.add("group"); catBox.margins = 0; catBox.alignment = ["left", "center"];   // hidden outside Behaviors
    var cat = catBox.add("dropdownlist", undefined, CATS); cat.preferredSize.width = 110; cat.selection = 0;
    var search = fA.add("edittext", undefined, ""); search.preferredSize.width = 60; search.helpTip = "Search by name, channel or use";
    var energy = fB.add("dropdownlist", undefined, ["all energies", "1 calm", "2 soft", "3 medium", "4 dynamic", "5 explosive"]); energy.selection = 0; energy.preferredSize.width = 60;
    energy.helpTip = "Energy level (library/tags.json): shows what covers it, and sets the feel for Mix";
    function inRange(r) { var l = energy.selection.index; return !l || !r || (r[0] <= l && l <= r[1]); }
    var tone = fB.add("dropdownlist", undefined, ["all tones"].concat(TAGS.tones || [])); tone.selection = 0; tone.preferredSize.width = 60; tone.helpTip = "Filter by tone (library/tags.json)";

    // ---------- live preview ----------
    var PW = 320, PH = 150;
    var prevBox = ui.add("panel", undefined, ""); prevBox.alignChildren = ["center", "top"]; prevBox.margins = 6; prevBox.spacing = 2;
    var view = prevBox.add("group"); view.preferredSize = [PW, PH]; view.alignment = ["center", "top"]; view.keepSize = true;
    function sizePreview() {   // the preview keeps its aspect, centered, as wide as the panel allows (up to 1.5x)
        var w = Math.max(120, Math.min(PW * 1.5, vpW() - 16 - 14)); view.preferredSize = [Math.round(w), Math.round(w * PH / PW)];
    }
    var selRow = prevBox.add("group"); selRow.alignChildren = ["left", "center"]; selRow.alignment = ["fill", "top"];
    var selName = selRow.add("statictext", undefined, "Pick a preset"); selName.alignment = ["fill", "center"]; selName.preferredSize = [60, 18];
    var bFav = selRow.add("button", undefined, "☆"); bFav.preferredSize = [30, 22]; bFav.alignment = ["right", "center"]; bFav.helpTip = "Add to / remove from favorites";
    var selInfo = prevBox.add("statictext", undefined, " ", { multiline: true }); selInfo.alignment = ["fill", "top"]; selInfo.preferredSize = [60, 32];
    var CUR = null, FRAME = 0;   // CUR = { key, kind, name } of the selected preset
    var PREV_IMG = null;          // still shown in the preview for styles, techniques and assets
    function setPreview(path) { PREV_IMG = null; try { var f = new File(SS_ROOT + path); if (f.exists) PREV_IMG = ScriptUI.newImage(f); } catch (e) {} }
    // the neutral sample: the robot head (assets/motion_dna/sample_robot.json), the same subject as the GIFs; line
    // presets draw its one-line version. Each part becomes a polygon (curves sampled), sized to the robot's height.
    var ROBOT = (function () {
        var D = null; try { D = SSM.readJSON(SS_ROOT + "/assets/motion_dna/sample_robot.json"); } catch (e) {}
        if (!D) return null;
        var pal = { pine: C.pine, spark: C.spark, cloud: C.cloud, coral: C.coral, grey: C.muted, sea: C.sea };
        function rrect(cx, cy, w, h, r) {   // a rounded rectangle, 4 points per corner
            var pts = [], q = [[w / 2 - r, -h / 2 + r, -90], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180]];
            for (var k = 0; k < 4; k++) for (var j = 0; j <= 3; j++) { var t = (q[k][2] + j * 30) * Math.PI / 180; pts.push([cx + q[k][0] + r * Math.cos(t), cy + q[k][1] + r * Math.sin(t)]); }
            return pts;
        }
        function part(P) {
            var pts = [], closed = true;
            if (P.rect) pts = rrect(P.rect.center[0], P.rect.center[1], P.rect.size[0], P.rect.size[1], Math.min(P.rect.round, P.rect.size[0] / 2, P.rect.size[1] / 2));
            else if (P.ellipse) { for (var j = 0; j < 12; j++) { var t = j * Math.PI / 6; pts.push([P.ellipse.center[0] + P.ellipse.size[0] / 2 * Math.cos(t), P.ellipse.center[1] + P.ellipse.size[1] / 2 * Math.sin(t)]); } }
            else {
                var v = P.path.v, o = P.path.o, n = P.path.i; closed = P.path.closed;
                for (var s2 = 0; s2 < v.length - 1; s2++) for (var u = 0; u < 6; u++) {   // cubic segment, 6 samples
                    var tt = u / 6, a0 = v[s2], a1 = [v[s2][0] + o[s2][0], v[s2][1] + o[s2][1]], a2 = [v[s2 + 1][0] + n[s2 + 1][0], v[s2 + 1][1] + n[s2 + 1][1]], a3 = v[s2 + 1], m = 1 - tt;
                    pts.push([m * m * m * a0[0] + 3 * m * m * tt * a1[0] + 3 * m * tt * tt * a2[0] + tt * tt * tt * a3[0], m * m * m * a0[1] + 3 * m * m * tt * a1[1] + 3 * m * tt * tt * a2[1] + tt * tt * tt * a3[1]]);
                }
                pts.push(v[v.length - 1]);
            }
            for (var i = 0; i < pts.length; i++) pts[i] = [pts[i][0] / D.height, pts[i][1] / D.height];
            return { pts: pts, closed: closed, fill: P.fill ? pal[P.fill] : null, stroke: P.stroke ? pal[P.stroke] : null, width: (P.width || 0) / D.height };
        }
        var R = { vector: [], line: [] };
        for (var i = 0; i < D.vector.length; i++) R.vector.push(part(D.vector[i]));
        for (var j2 = 0; j2 < D.line.length; j2++) R.line.push(part(D.line[j2]));
        return R;
    })();
    function arrow(g, W, H, it, f) {   // draws the sample (the robot) at this frame of the preset's sampled motion
        if (!ROBOT) return;
        var dx = f[0] * W, dy = f[1] * H, sx = f[2], sy = f[3] * Math.cos((f[6] || 0) * Math.PI / 180), rot = f[4] * Math.PI / 180;
        var op = Math.max(0, Math.min(1, f[5])), sk = Math.tan((f[7] || 0) * Math.PI / 180), trim = f[8];
        var size = 80 * Math.min(W / PW, H / PH), c = Math.cos(rot), s = Math.sin(rot);
        var stroke = it.shape === "stroke", parts = stroke ? ROBOT.line : ROBOT.vector, total = 0, k;
        for (k = 0; k < parts.length; k++) total += parts[k].pts.length;
        var budget = stroke ? Math.round(total * Math.max(0, Math.min(1, trim))) : total;   // the draw-on: points in order
        for (k = 0; k < parts.length && budget > 1; k++) {
            var P = parts[k], pts = P.closed && stroke ? P.pts.concat([P.pts[0]]) : P.pts, last = Math.min(pts.length, budget);
            budget -= pts.length;
            g.newPath();
            for (var q = 0; q < last; q++) {
                var x = pts[q][0] * size * sx, y = pts[q][1] * size * sy; x += sk * y;
                var xr = x * c - y * s + W / 2 + dx, yr = x * s + y * c + H / 2 + dy;
                if (q === 0) g.moveTo(xr, yr); else g.lineTo(xr, yr);
            }
            if (P.fill && !stroke) { g.closePath(); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [P.fill[0], P.fill[1], P.fill[2], op])); }
            else if (P.stroke) g.strokePath(g.newPen(g.PenType.SOLID_COLOR, [P.stroke[0], P.stroke[1], P.stroke[2], op], Math.max(1, Math.round(P.width * size))));
        }
    }
    view.onDraw = function () {
        var g = this.graphics, W = this.size.width, H = this.size.height;
        g.rectPath(0, 0, W, H); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, C.pine));
        if (PREV_IMG) {   // styles (2x2 grid), techniques, assets: their still, fitted
            try { var iw = PREV_IMG.size[0], ih = PREV_IMG.size[1], k = Math.min(W / iw, H / ih); g.drawImage(PREV_IMG, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k); } catch (e) {}
            return;
        }
        if (!CUR) { g.drawString("Pick a preset to preview it", g.newPen(g.PenType.SOLID_COLOR, C.muted, 1), 12, H / 2 - 8); return; }
        var it = CURVES.items[CUR.key];
        if (!it) { g.drawString(CUR.kind === "pack" ? "Style: applies a preset per layer role" : "(no preview)", g.newPen(g.PenType.SOLID_COLOR, C.muted, 1), 12, H / 2 - 8); return; }
        var f = it.f[FRAME % it.f.length], op = Math.max(0, Math.min(1, f[5]));
        if (it.shape === "text") {
            var txt = it.text, k;
            if (it.txt) for (k = FRAME % it.txt.length; k >= 0; k--) if (it.txt[k] !== 0) { txt = it.txt[k]; break; }
            var shown = txt.substr(0, Math.round(txt.length * f[9]));
            var fnt = ScriptUI.newFont("Arial", "BOLD", Math.max(8, Math.round(26 * f[2] * Math.min(W / PW, H / PH))));
            g.font = fnt; var sz = g.measureString(txt, fnt);
            g.drawString(shown, g.newPen(g.PenType.SOLID_COLOR, [C.cloud[0], C.cloud[1], C.cloud[2], op], 1), W / 2 - sz[0] / 2 + f[0] * W, H / 2 - sz[1] / 2 + f[1] * H);
            return;
        }
        if (it.shape === "bar") {
            var ks = Math.min(W / PW, H / PH), bw = 120 * ks * f[2] * Math.max(0.02, f[8]), bh = 22 * ks * f[3];
            g.rectPath(W / 2 - 60 * ks * f[2] + f[0] * W, H / 2 - bh / 2 + f[1] * H, bw, bh);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [C.coral[0], C.coral[1], C.coral[2], op]));
            return;
        }
        arrow(g, W, H, it, f);
    };
    function redraw() { if (SECTION !== "Curves" && prevBox.visible) repaint(view); }   // the preview, when it is on screen
    // animation clock: AE idle task (ScriptUI has no timer); stops itself when the panel is gone
    var tick = 0;
    var SHOW_PENDING = false, CLOSED = false;
    function myTick() {   // this panel's clock: pending rebuild, Claude status, preview frame. false = drop me
        if (CLOSED) return false;
        tick++;
        if (SHOW_PENDING) { SHOW_PENDING = false; showNow(); }
        if (tick % 24 === 0) status();
        if (CUR) { FRAME++; redraw(); }
        flushPaint();
        return true;
    }
    // one scheduled task drives every open instance (the docked panel and any palette), so a second panel never
    // steals the first one's clock; an instance that throws or reports itself closed is dropped
    if (!($.global.SS_PANEL_TICKERS instanceof Array)) $.global.SS_PANEL_TICKERS = [];
    $.global.SS_PANEL_TICKERS.push(myTick);
    // The clock is a chain of one-shot tasks, each tick scheduling the next. AE cannot run scripts while a modal
    // dialog is open ("Cannot run a script while a modal dialog is waiting for response"): a repeating task would
    // raise that on every beat, a chain breaks once and stays quiet. Any use of the panel restarts it (ensureClock).
    var CLOCK_MS = Math.round(1000 / (CURVES.fps || 12)), CLOCK_JS = "if (typeof SS_PANEL_TICK === \"function\") SS_PANEL_TICK();";
    function now() { return new Date().getTime(); }
    $.global.SS_PANEL_TICK = function () {
        $.global.SS_PANEL_LAST = now();
        var a = $.global.SS_PANEL_TICKERS;
        for (var i = a.length - 1; i >= 0; i--) { var keep = false; try { keep = a[i](); } catch (e) {} if (!keep) a.splice(i, 1); }
        if (a.length) $.global.SS_PANEL_TASK = app.scheduleTask(CLOCK_JS, CLOCK_MS, false);
    };
    function ensureClock() {   // (re)start the chain when it has not ticked for a while
        if (now() - ($.global.SS_PANEL_LAST || 0) < CLOCK_MS * 4 + 400) return;
        try { if ($.global.SS_PANEL_TASK) app.cancelTask($.global.SS_PANEL_TASK); } catch (e) {}
        $.global.SS_PANEL_LAST = now();
        $.global.SS_PANEL_TASK = app.scheduleTask(CLOCK_JS, CLOCK_MS, false);
    }
    $.global.SS_PANEL_LAST = 0; ensureClock();
    function favKey() { return CUR ? CUR.kind + "/" + CUR.name : ""; }
    function select(kind, name, meta) {
        CUR = { key: kind + "/" + name, kind: kind, name: name }; FRAME = 0; PREV_IMG = null;
        if (kind === "pack") setPreview("/library/packs/" + packSlug(name) + "_md.png");
        if (kind === "technique") setPreview("/library/techniques/" + techSlug(name) + "_md.png");
        if (kind === "brand") setPreview("/library/brands/" + name + "/thumb.png");
        selName.text = name + (meta.energy ? "  ·  " + meta.energy : "");
        selInfo.text = (meta.channels || "") + "\n" + (meta.use || "");
        bFav.text = FAV[favKey()] ? "★" : "☆";
        redraw();
    }
    bFav.onClick = function () {
        if (!CUR) return;
        if (FAV[favKey()]) delete FAV[favKey()]; else FAV[favKey()] = 1;
        saveFav(); bFav.text = FAV[favKey()] ? "★" : "☆";
        if (curCat() === "★ Favorites") showNow();
    };

    // ---------- controls ----------
    // collapsible: a header row (▸ Controls · summary of the current tuning) opens and closes the panel below
    var CTL_OPEN = false;
    try { CTL_OPEN = app.settings.haveSetting("MotionDNA", "controlsOpen") && app.settings.getSetting("MotionDNA", "controlsOpen") === "1"; } catch (e) {}
    var ctlWrap = ui.add("group"); ctlWrap.alignment = ["fill", "top"]; ctlWrap.alignChildren = ["fill", "top"]; ctlWrap.margins = 0;   // sections hide the group (a hidden drawn button would not repaint)
    var ctlHead = drawn(ctlWrap, 60, 24, "Show or hide the controls (duration, intensity, direction, easing, stagger)", function (g, W, H, hov) {
        rrect(g, 0.5, 0.5, W - 1, H - 1, 4); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, hov ? [0.16, 0.17, 0.16, 1] : [0.12, 0.13, 0.12, 1]));
        label(g, (CTL_OPEN ? "\u25be" : "\u25b8") + "  Controls", hov ? rgba(C.spark) : [0.85, 0.87, 0.84, 1], W, H, 12, true, 8);
        if (!CTL_OPEN && typeof ctlSummary === "function") {
            var s = ctlSummary(), f = ScriptUI.newFont("dialog", "REGULAR", 11), m = g.measureString(s, f);
            if (m[0] < W - 110) g.drawString(s, g.newPen(g.PenType.SOLID_COLOR, rgba(C.muted), 1), W - m[0] - 8, (H - m[1]) / 2, f);
        }
    });
    ctlHead.alignment = ["fill", "top"];
    var ctlBox = ui.add("panel", undefined, ""); ctlBox.alignChildren = ["fill", "top"]; ctlBox.margins = [8, 8, 8, 6]; ctlBox.spacing = 4;
    function showControls(open) {
        CTL_OPEN = open; shown(ctlBox, open && tunable());
        try { app.settings.saveSetting("MotionDNA", "controlsOpen", open ? "1" : "0"); } catch (e) {}
        repaint(ctlHead); relayout();
    }
    ctlHead.onClick = function () { showControls(!CTL_OPEN); };
    function slider(label, min, max, val, fmt) {
        var g = ctlBox.add("group"); g.alignChildren = ["left", "center"]; g.alignment = ["fill", "top"];
        var l = g.add("statictext", [0, 0, 64, 18], label);
        var s = g.add("slider", undefined, val, min, max); s.preferredSize.width = 60; s.alignment = ["fill", "center"];
        var v = g.add("statictext", [0, 0, 44, 18], fmt(val));
        s.onChanging = function () { v.text = fmt(s.value); repaint(ctlHead); };
        return s;
    }
    var pct = function (x) { return Math.round(x * 100) + "%"; };
    var sDur = slider("Duration", 0.5, 2, 1, function (x) { return x.toFixed(2) + "×"; });
    var sInt = slider("Intensity", 0.25, 2, 1, pct);
    var dRow = ctlBox.add("group"); dRow.alignChildren = ["left", "center"];
    dRow.add("statictext", [0, 0, 64, 18], "Direction");
    var dir = dRow.add("dropdownlist", undefined, ["As designed", "Mirror horizontal", "Mirror vertical", "Mirror both"]); dir.selection = 0;
    dRow.alignment = ["fill", "top"]; dir.alignment = ["fill", "center"]; dir.preferredSize.width = 60;
    var eRow = ctlBox.add("group"); eRow.alignChildren = ["left", "center"];
    eRow.add("statictext", [0, 0, 64, 18], "Easing");
    var EASES = ["Preset curve", "Land", "Coast", "Settle", "Launch", "Cruise", "Surge", "Ramp", "Whip", "Flat"];
    var ease = eRow.add("dropdownlist", undefined, EASES); ease.selection = 0;
    eRow.alignment = ["fill", "top"]; ease.alignment = ["fill", "center"]; ease.preferredSize.width = 60;
    var sRow = ctlBox.add("group"); sRow.alignChildren = ["left", "center"];
    sRow.add("statictext", [0, 0, 64, 18], "Stagger");
    var stag = sRow.add("edittext", undefined, String(SSM.frames("Tick"))); stag.characters = 3; stag.helpTip = "Frames between layers";
    sRow.add("statictext", undefined, "frames");
    var bReset = sRow.add("button", undefined, "Reset"); bReset.preferredSize.width = 50;
    var mk = ctlBox.add("checkbox", undefined, "Marker timing"); mk.value = true; mk.helpTip = "Drag the SS in / SS out markers to retime";
    bReset.onClick = function () { sDur.value = 1; sInt.value = 1; dir.selection = 0; ease.selection = 0; sDur.onChanging(); sInt.onChanging(); };
    function ctlSummary() {   // what the closed header shows: only what differs from the defaults
        var a = [];
        if (Math.abs(sDur.value - 1) > 0.01) a.push(sDur.value.toFixed(2) + "\u00d7");
        if (Math.abs(sInt.value - 1) > 0.01) a.push(Math.round(sInt.value * 100) + "%");
        if (dir.selection.index) a.push(dir.selection.text);
        if (ease.selection.index) a.push(ease.selection.text);
        return a.length ? a.join(" \u00b7 ") : "defaults";
    }
    dir.onChange = ease.onChange = function () { repaint(ctlHead); };

    // choose the phase (In / Out / Both), then Apply; Remove clears it. The row wraps in two on narrow docks.
    var act = ui.add("group"); act.alignChildren = ["fill", "center"]; act.alignment = ["fill", "top"]; act.spacing = 8;
    var phaseRow = act.add("group"); phaseRow.alignChildren = ["left", "center"]; phaseRow.spacing = 10;
    var rIn = phaseRow.add("radiobutton", undefined, "In"), rOut = phaseRow.add("radiobutton", undefined, "Out"), rBoth = phaseRow.add("radiobutton", undefined, "Both");
    rIn.helpTip = "Animate the entrance"; rOut.helpTip = "Animate the exit (ends at the layer's out point)"; rBoth.helpTip = "Entrance and exit";
    rIn.value = true;
    var btnRow = act.add("group"); btnRow.alignChildren = ["fill", "center"]; btnRow.alignment = ["fill", "center"]; btnRow.spacing = 6;
    var bApply = solidButton(btnRow, "Apply", C.spark, C.pine, "Apply the selected preset or style to the selected layers");
    var bRem = solidButton(btnRow, "Remove", C.coral, C.pine, "Remove Motion DNA animation from the selected layers");
    function phase() { if (rOut.value) return "out"; if (rBoth.value) return "both"; return "in"; }
    function fitActions() { act.orientation = vpW() < 330 ? "column" : "row"; }

    function tuning() {
        var d = dir.selection.index;
        return { speed: sDur.value, intensity: sInt.value, flipX: d === 1 || d === 3, flipY: d === 2 || d === 3, ease: ease.selection.index ? ease.selection.text : null };
    }
    function selectedLayers() {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem) || !c.selectedLayers.length) { alert("Select one or more layers in a composition."); return null; }
        return c.selectedLayers;
    }
    function applyCurrent(phase) {
        if (!CUR) { alert("Pick a preset in the gallery first."); return; }
        if (CUR.kind === "technique") { alert(CUR.name + "\n\n" + techText(CUR.name)); return; }
        if (CUR.kind === "pack") { applyPack(phase); return; }
        if (CUR.kind === "brand") { applyBrand(phase); return; }
        var ls = selectedLayers(); if (!ls) return;
        var st = (parseFloat(stag.text) || 0) * ls[0].containingComp.frameDuration;
        SSP.markerTiming(mk.value); SSP.tune(tuning());
        app.beginUndoGroup(NAME + ": " + CUR.name + " (" + phase + ")");
        try {
            for (var i = 0; i < ls.length; i++) {
                var L = ls[i], t0 = (phase === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st;
                if (CUR.kind === "text") SSP.applyText(L, CUR.name, phase, t0);
                else if (CUR.kind === "fx") SSP.applyFx(L, CUR.name);
                else if (CUR.kind === "recipe") SSP.applyRecipe(L, CUR.name, phase);
                else SSP.apply(L, CUR.name, phase, t0);
            }
        } catch (e) { alert(NAME + ": " + e.toString() + (e.line ? " (line " + e.line + ")" : "")); }
        SSP.markerTiming(false); SSP.tune();
        app.endUndoGroup();
    }
    bApply.onClick = function () { applyCurrent(phase()); };
    bRem.onClick = function () {
        var ls = selectedLayers(); if (!ls) return;
        if (!confirm("Remove the keyframes, expressions and markers Motion DNA added to " + ls.length + " layer(s)?\nAnimated properties keep their resting value.")) return;
        app.beginUndoGroup(NAME + ": remove");
        var n = 0; try { for (var i = 0; i < ls.length; i++) n += SSP.remove(ls[i]); } catch (e) { alert(NAME + ": " + e.toString()); }
        app.endUndoGroup();
        selInfo.text = n + " animated properties cleared.";
    };

    // ---------- gallery ----------
    var body = ui.add("group"); body.orientation = "column"; body.alignChildren = ["fill", "top"]; body.alignment = ["fill", "top"];
    var ENERGY = { s: "soft", m: "medium", d: "dynamic" };
    var own = [], classic = [], all = SSP.names();
    for (var a = 0; a < all.length; a++) (SSP.presets[all[a]].family === "classic" ? classic : own).push(all[a]);
    function recipeMeta(id) {
        var r = SSP.recipes[id];
        return { channels: r.channels.join(" & ") + (r.kind === "fx" ? " (loop)" : ""), energy: ENERGY[r.energy] || r.energy, use: "measured reference · " + (r.section || "?") };
    }
    var SOURCES = {
        "Moves": { kind: "motion", names: own, meta: function (n) { return SSP.presets[n]; } },
        "Classics": { kind: "motion", names: classic, meta: function (n) { return SSP.presets[n]; } },
        "Text": { kind: "text", names: SSP.textNames(), meta: function (n) { return SSP.text[n]; } },
        "Loops": { kind: "fx", names: SSP.effectNames(), meta: function (n) { return SSP.effects[n]; } },
        "Recipes": { kind: "recipe", names: SSP.recipeIds(), meta: recipeMeta },
        "Transitions": { kind: "motion", names: (function () {   // presets tagged role "transition" (the Techniques tab has the shape wipes)
            var a = []; for (var i = 0; i < TAGS.presets.length; i++) { var t = TAGS.presets[i]; if (("," + t.roles.join(",") + ",").indexOf(",transition,") >= 0 && t.kind === "motion") a.push(t.name); }
            return a; })(), meta: function (n) { return SSP.presets[n]; } }
    };
    function metaOf(kind, name) {
        if (kind === "text") return SSP.text[name]; if (kind === "fx") return SSP.effects[name];
        if (kind === "recipe") return recipeMeta(name); return SSP.presets[name];
    }
    var page = 0;
    function clear() {   // forget every reference into the old gallery before removing it (a repaint of a removed control crashes AE)
        ED = null; ED_TXT = null; ED_NAME = null; ED_DEL = null; ED_DRAG = -1; CV_THUMBS = []; PAINT_Q = [];
        while (body.children.length) body.remove(body.children[0]);
    }
    function grid(items, onPick) {   // items: [{kind, name, meta}]; onPick(item) replaces the preset selection
        var G = gridGeom(96, 240, 63 / 112), COLS = G.n, ROWS = 3, PER = COLS * ROWS, pages = Math.max(1, Math.ceil(items.length / PER));
        page = Math.max(0, Math.min(page, pages - 1));
        var g = body.add("group"); g.orientation = "column"; g.alignChildren = ["center", "top"]; g.alignment = ["fill", "top"]; g.spacing = 2;
        for (var r = 0; r < ROWS; r++) {
            var row = g.add("group"); row.spacing = G.sp;
            for (var c = 0; c < COLS; c++) {
                var idx = page * PER + r * COLS + c;
                if (idx >= items.length) break;
                (function (it) {
                    var cell = row.add("group"); cell.orientation = "column"; cell.spacing = 0; cell.alignChildren = ["center", "top"];
                    var f = (G.w > 118 && thumb(it.kind, it.name, true)) || thumb(it.kind, it.name), btn = thumbButton(cell, f, G.w, G.h, "▶");
                    btn.helpTip = it.name + " · " + (it.meta.energy || "") + "\n" + (it.meta.use || "");
                    var nm = (FAV[it.kind + "/" + it.name] ? "★ " : "") + it.name;
                    var lbl = cell.add("statictext", [0, 0, G.w, 16], fit(nm, G.w)); lbl.justify = "center";
                    btn.onClick = function () { if (onPick) onPick(it); else select(it.kind, it.name, it.meta); };
                })(items[idx]);
            }
        }
        var nav = body.add("group"); nav.alignChildren = ["center", "center"]; nav.alignment = ["center", "top"];
        var prev = nav.add("button", undefined, "<"), lbl2 = nav.add("statictext", [0, 0, 110, 18], items.length ? (page + 1) + " / " + pages + "  (" + items.length + ")" : "no match"), next = nav.add("button", undefined, ">");
        prev.preferredSize.width = next.preferredSize.width = 34; lbl2.justify = "center";
        prev.onClick = function () { page--; show(); }; next.onClick = function () { page++; show(); };
    }
    function matches(name, m) {
        var want = energy.selection.index === 0 ? "" : energy.selection.text, q = search.text.toLowerCase();
        var tgE = TAGOF[name], rng = tgE ? tgE.energy : ({ soft: [1, 2], medium: [3, 3], dynamic: [4, 5] })[m.energy];
        if (!inRange(rng)) return false;
        if (tone.selection.index > 0) { var tg = TAGOF[name]; if (!tg || ("," + tg.tones.join(",") + ",").indexOf("," + tone.selection.text + ",") < 0) return false; }
        return !q || (name + " " + (m.channels || "") + " " + (m.use || "")).toLowerCase().indexOf(q) >= 0;
    }
    // rebuild request: runs on the next panel tick, outside whatever click or keystroke asked for it
    function show() { SHOW_PENDING = true; ensureClock(); }
    function showNow() {
        SHOW_PENDING = false;
        clear();
        var c = curCat(), items = [], i;
        if (SOURCES[c]) {
            var src = SOURCES[c];
            for (i = 0; i < src.names.length; i++) { var m = src.meta(src.names[i]); if (matches(src.names[i], m)) items.push({ kind: src.kind, name: src.names[i], meta: m }); }
            grid(items);
        } else if (c === "★ Favorites") {
            for (var k in FAV) if (FAV.hasOwnProperty(k)) {
                var kind = k.split("/")[0], name = k.substr(kind.length + 1);
                if (kind === "pack" || kind === "technique") { items.push({ kind: kind, name: name, meta: { use: kind === "pack" ? "style" : "technique" } }); continue; }
                var mm = metaOf(kind, name); if (mm && matches(name, mm)) items.push({ kind: kind, name: name, meta: mm });
            }
            if (!items.length) body.add("statictext", undefined, "No favorites yet: pick a preset and press ☆.");
            else grid(items);
        } else if (c === "Styles") styles();
        else if (c === "Brands") brands();
        else if (c === "Mix") mix();
        else if (c === "Techniques") techniques();
        else if (c === "Assets") assets();
        else if (c === "Curves") curves();
        relayout();
    }
    cat.onChange = function () { page = 0; PREV_IMG = null; A_SEL = null; showNow(); redraw(); };
    energy.onChange = function () { page = 0; showNow(); };
    tone.onChange = function () { page = 0; showNow(); };
    search.onChanging = function () { page = 0; showNow(); };

    // ---------- styles (packs) ----------
    var scopeAll = null;
    function styles() {
        body.add("statictext", undefined, "Each style animates a whole comp (or the selected layers): every layer gets the preset of its role, with the style's own curve. Pick one, choose In / Out / Both and Apply.", { multiline: true }).preferredSize = [60, 50];
        scopeAll = body.add("checkbox", undefined, "Whole comp (otherwise only the selected layers)"); scopeAll.value = true;
        var packs = SSP.packs(), shown = [], q = search.text.toLowerCase(), tn = tone.selection.index > 0 ? tone.selection.text : "";
        for (var p = 0; p < packs.length; p++) {
            var pk = packs[p], tones = pk.tones || [];
            if (q && (pk.name + " " + pk.desc + " " + tones.join(" ")).toLowerCase().indexOf(q) < 0) continue;
            if (tn && ("," + tones.join(",") + ",").indexOf("," + tn + ",") < 0) continue;
            if (!inRange(pk.energy_range)) continue;
            shown.push(pk);
        }
        if (!shown.length) { body.add("statictext", undefined, "No style matches the filters."); return; }
        var G = gridGeom(180, 360, 126 / 224), COLS = G.n, row = null;
        for (var k = 0; k < shown.length; k++) (function (pk, k) {
            if (k % COLS === 0) { row = body.add("group"); row.spacing = G.sp; row.alignChildren = ["left", "top"]; row.alignment = ["center", "top"]; }
            var cell = row.add("group"); cell.orientation = "column"; cell.spacing = 1; cell.alignChildren = ["left", "top"];
            var f = new File(SS_ROOT + "/library/packs/" + pk.slug + "_md.png"), btn;   // 2x2 grid preview (title · text · shapes · media)
            btn = thumbButton(cell, f.exists ? f : null, G.w, G.h, pk.name);
            var er = pk.energy_range ? " " + pk.energy_range[0] + "–" + pk.energy_range[1] : "";
            cell.add("statictext", [0, 0, G.w, 16], fit((FAV["pack/" + pk.name] ? "★ " : "") + pk.name + " · " + pk.energy + er, G.w));
            cell.add("statictext", [0, 0, G.w, 16], fit((pk.tones || []).join(" · ") + (pk.curve ? "  ·  " + pk.curve : ""), G.w));
            btn.helpTip = pk.desc + (pk.source && pk.source.indexOf("reference:") === 0 ? "\nFrom " + pk.source : "");
            btn.onClick = function () { select("pack", pk.name, { use: pk.desc }); selName.text = "Style: " + pk.name; };
        })(shown[k], k);
    }
    function applyPack(phase) {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem)) { alert("Open a composition first."); return; }
        var whole = !scopeAll || scopeAll.value, ls = whole ? null : c.selectedLayers;
        if (!whole && (!ls || !ls.length)) { alert("Select layers, or tick 'Whole comp' in Styles."); return; }
        SSP.markerTiming(mk.value); SSP.tune(tuning());
        app.beginUndoGroup(NAME + " style: " + CUR.name);
        var res = [];
        try { res = SSP.applyPack(c, CUR.name, ls, phase); } catch (e) { alert(NAME + ": " + e.toString()); }
        SSP.markerTiming(false); SSP.tune();
        app.endUndoGroup();
        selInfo.text = res.length ? res.length + " layers animated with " + CUR.name : "No layers matched (backgrounds, nulls and locked layers are skipped).";
    }

    // ---------- brands: custom styles that learn from every review (library/brands) ----------
    function brands() {
        body.add("statictext", undefined, "Each brand keeps its own style and the rules learned in its reviews. Pick one to read its rules, then Apply animates the comp in its style. Claude reads them too.", { multiline: true }).preferredSize = [60, 50];
        if (!BRANDS.length) { body.add("statictext", undefined, "No brands yet. In a terminal: python tools/brand.py new <slug> --name \"Acme\"", { multiline: true }); return; }
        scopeAll = body.add("checkbox", undefined, "Whole comp (otherwise only the selected layers)"); scopeAll.value = true;
        var q = search.text.toLowerCase(), tn = tone.selection.index > 0 ? tone.selection.text : "", shown = [];
        for (var i = 0; i < BRANDS.length; i++) {
            var b = BRANDS[i], f = b.feel || {};
            if (q && (b.name + " " + (f.tones || []).join(" ") + " " + brandRules(b)).toLowerCase().indexOf(q) < 0) continue;
            if (tn && ("," + (f.tones || []).join(",") + ",").indexOf("," + tn + ",") < 0) continue;
            if (!inRange(f.energy)) continue;
            shown.push(b);
        }
        if (!shown.length) { body.add("statictext", undefined, "No brand matches the filters."); return; }
        var G = gridGeom(180, 360, 126 / 224), COLS = G.n, row = null;
        for (var k = 0; k < shown.length; k++) (function (b, k) {
            if (k % COLS === 0) { row = body.add("group"); row.spacing = G.sp; row.alignChildren = ["left", "top"]; row.alignment = ["center", "top"]; }
            var cell = row.add("group"); cell.orientation = "column"; cell.spacing = 1; cell.alignChildren = ["left", "top"];
            var f = new File(SS_ROOT + "/library/brands/" + b.slug + "/thumb.png"), btn;
            btn = thumbButton(cell, f.exists ? f : null, G.w, G.h, b.name);
            cell.add("statictext", [0, 0, G.w, 16], fit(b.name + " · " + b.feel.style + (b.feel.curve ? " on " + b.feel.curve : ""), G.w));
            cell.add("statictext", [0, 0, G.w, 30], (b.feel.tones || []).join(" · ") + "\n" + b.rules.length + " rules learned · " + (b.projects || []).length + " projects", { multiline: true });
            var bRules = cell.add("button", undefined, "Rules…"); bRules.preferredSize = [80, 20];
            bRules.onClick = function () { alert(b.name + " · " + b.rules.length + " rules\n\n" + brandRules(b)); };
            btn.onClick = function () {
                select("brand", b.slug, {}); selName.text = "Brand: " + b.name;
                selInfo.text = b.feel.style + (b.feel.curve ? " on " + b.feel.curve : "") + " · " + b.rules.length + " rules\n" + brandRules(b, 3);
            };
        })(shown[k], k);
    }
    function applyBrand(phase) {
        var b = brandOf(CUR.name), c = app.project.activeItem;
        if (!b) return;
        if (!(c instanceof CompItem)) { alert("Open a composition first."); return; }
        var whole = !scopeAll || scopeAll.value, ls = whole ? null : c.selectedLayers;
        if (!whole && (!ls || !ls.length)) { alert("Select layers, or tick 'Whole comp'."); return; }
        var tu = tuning(); if (!tu.ease && b.feel.curve) tu.ease = b.feel.curve;   // the brand's curve unless Easing says otherwise
        SSP.markerTiming(mk.value); SSP.tune(tu);
        app.beginUndoGroup(NAME + " brand: " + b.name);
        var res = [];
        try { res = SSP.applyPack(c, b.feel.style, ls, phase); } catch (e) { alert(NAME + ": " + e.toString()); }
        SSP.markerTiming(false); SSP.tune();
        app.endUndoGroup();
        selInfo.text = res.length ? res.length + " layers animated in the " + b.name + " style. Follow its rules for the rest (Rules…)." : "No layers matched.";
    }

    // ---------- mix: pick moves and curves by tags for the layers in the comp, apply them, save them as a style ----------
    var MIX = null, MIX_ACT = {};   // MIX = { comp, rows: [{ L, role, isText, preset, curve }] }; MIX_ACT = button actions (hooks)
    var ROLE_TARGET = { title: "title", subtitle: "text", body: "text", shape: "shape", media: "media", logo: "logo" };
    function feel() {   // the energy level and tone chosen in the filters (defaults: 3 medium, any tone)
        return { level: energy.selection.index || 3, tone: tone.selection.index > 0 ? tone.selection.text : "" };
    }
    function scoreTags(t, fl) {
        var s = (t.energy[0] <= fl.level && fl.level <= t.energy[1]) ? 2 : -Math.abs(fl.level - (t.energy[0] + t.energy[1]) / 2);
        if (fl.tone && ("," + t.tones.join(",") + ",").indexOf("," + fl.tone + ",") >= 0) s += 2;
        return s;
    }
    function bestMove(target, isText, fl, role) {
        var best = null, bs = -99;
        for (var i = 0; i < TAGS.presets.length; i++) {
            var t = TAGS.presets[i];
            if (("," + t.roles.join(",") + ",").indexOf("," + (role || "enter") + ",") < 0) continue;
            if (("," + t.targets.join(",") + ",").indexOf("," + target + ",") < 0) continue;
            if (t.kind === "text" && !isText) continue;
            if (t.kind === "fx") continue;
            var s = scoreTags(t, fl) + (isText && t.kind === "text" ? 0.5 : 0);
            if (s > bs) { bs = s; best = t; }
        }
        return best;
    }
    function bestCurve(fl) {
        var best = null, bs = -99, playful = fl.tone === "playful" || fl.tone === "bold";
        for (var i = 0; i < (TAGS.curves || []).length; i++) {
            var c = TAGS.curves[i];
            if ((c.family === "overshoot" || c.family === "anticipation") && !playful) continue;
            if (c.family === "linear" && fl.tone !== "technical") continue;   // linear only reads as intentional in technical pieces
            var s = scoreTags(c, fl);
            if (s > bs) { bs = s; best = c; }
        }
        return best ? best.name : null;
    }
    function mix() {
        var fl = feel();
        body.add("statictext", undefined, "Choose an energy and a tone in the filters above, then Analyze: every layer gets the move and the curve whose tags fit (title, text, shapes, media, logo). Apply them, or save them as a style.", { multiline: true }).preferredSize = [60, 50];
        body.add("statictext", undefined, "Feel: energy " + fl.level + (energy.selection.index ? "" : " (default)") + " · tone " + (fl.tone || "any") + " · curve " + (bestCurve(fl) || "-"));
        var g = body.add("group");
        var bAn = g.add("button", undefined, "Analyze selection (or whole comp)");
        var lb = body.add("listbox", undefined, []); lb.preferredSize = [60, 150]; lb.alignment = ["fill", "top"];
        if (MIX) for (var i = 0; i < MIX.rows.length; i++) { var r = MIX.rows[i]; lb.add("item", r.L.name + "  →  " + r.role + ": " + (r.preset ? r.preset.name : "(no match: a gap to create)") + "  ·  " + r.curve); }
        var g2 = body.add("group");
        var bAp = g2.add("button", undefined, "Apply mix"), bSave = g2.add("button", undefined, "Save as style…");
        bAn.onClick = function () {
            var c = app.project.activeItem;
            if (!(c instanceof CompItem)) { alert("Open a composition first."); return; }
            var ls = c.selectedLayers.length ? c.selectedLayers : (function () { var a = []; for (var k = 1; k <= c.numLayers; k++) a.push(c.layer(k)); return a; })();
            var f2 = feel(), cv = bestCurve(f2), rows = [];
            for (var j = 0; j < ls.length; j++) {
                var role = SSP.roleOf(ls[j]); if (!role) continue;
                var isText = ls[j] instanceof TextLayer;
                rows.push({ L: ls[j], role: role, isText: isText, preset: bestMove(ROLE_TARGET[role], isText, f2), curve: cv });
            }
            MIX = { comp: c, rows: rows, feel: f2 };
            show();
        };
        bAp.onClick = function () {
            if (!MIX || !MIX.rows.length) { alert("Analyze a comp first."); return; }
            var st = (parseFloat(stag.text) || 0) * MIX.comp.frameDuration, n = 0;
            app.beginUndoGroup(NAME + ": mix");
            try {
                for (var k = 0; k < MIX.rows.length; k++) {
                    var r = MIX.rows[k]; if (!r.preset) continue;
                    var o = tuning(); o.ease = r.curve; SSP.markerTiming(mk.value); SSP.tune(o);
                    var t0 = r.L.inPoint + (n++) * st;
                    if (r.preset.kind === "text") SSP.applyText(r.L, r.preset.name, "in", t0); else SSP.apply(r.L, r.preset.name, "in", t0);
                }
            } catch (e) { alert(NAME + ": " + e.toString()); }
            SSP.markerTiming(false); SSP.tune();
            app.endUndoGroup();
            selInfo.text = n + " layers animated by the mix.";
        };
        MIX_ACT = { analyze: bAn.onClick, apply: bAp.onClick };
        bSave.onClick = function () {
            if (!MIX) { alert("Analyze a comp first."); return; }
            var name = prompt("Name of the new style (neutral, no brand names):", "My Style");
            if (!name) return;
            try { saveStyle(name); alert("Saved the style \"" + name + "\" in library/packs.json.\nRender its 2x2 preview with: bash tools/rebuild_previews.sh"); }
            catch (e) { alert(NAME + ": could not save the style: " + e.toString()); }
        };
    }
    function staggerFor(level) { if (level <= 2) return 6; if (level === 3) return 4; return 3; }   // ifs: ExtendScript breaks chained ternaries
    // the current mix as a style in library/packs.json (roles missing from the comp are filled by tags too)
    function saveStyle(name, path) {
        var f3 = MIX.feel, roles = {}, all = ["title", "subtitle", "body", "shape", "media", "logo"];
        for (var k = 0; k < all.length; k++) {
            var pr = null;
            for (var r = 0; r < MIX.rows.length; r++) if (MIX.rows[r].role === all[k] && MIX.rows[r].preset) pr = MIX.rows[r].preset;
            if (!pr) pr = bestMove(ROLE_TARGET[all[k]], k < 3, f3);
            if (pr) { roles[all[k]] = {}; roles[all[k]][pr.kind === "text" ? "text" : "motion"] = pr.name; }
        }
        var tr = bestMove("media", false, f3, "transition"), words = ["", "soft", "soft", "medium", "dynamic", "dynamic"];
        var style = { name: name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), energy: words[f3.level],
                      energy_range: [Math.max(1, f3.level - 1), Math.min(5, f3.level + 1)], tones: f3.tone ? [f3.tone] : [],
                      desc: "Mixed in the panel from tags (energy " + f3.level + (f3.tone ? ", " + f3.tone : "") + ").",
                      stagger: staggerFor(f3.level), curve: MIX.rows.length ? MIX.rows[0].curve : bestCurve(f3),
                      transition: tr ? tr.name : "Ramp Slide", source: "mix", roles: roles };
        var pf = new File(SS_ROOT + "/library/packs.json"), data = SSM.readJSON(pf.fsName.split("\\").join("/"));
        for (var d = data.packs.length - 1; d >= 0; d--) if (data.packs[d].name === name) data.packs.splice(d, 1);
        data.packs.push(style);
        var out = path ? new File(path) : pf;
        out.encoding = "UTF-8"; out.open("w"); out.write(toJSON(data, "")); out.close();
        if (!path) SSP.reloadPacks();
        return style;
    }
    // ExtendScript has no JSON.stringify: a small writer for packs.json (strings, numbers, booleans, arrays, objects)
    function toJSON(v, ind) {
        if (v === null || v === undefined) return "null";
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        if (typeof v === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
        var n = ind + " ", i, out = [];
        if (v instanceof Array) { for (i = 0; i < v.length; i++) out.push(toJSON(v[i], n)); return "[" + out.join(", ") + "]"; }
        for (var k in v) if (v.hasOwnProperty(k)) out.push(n + '"' + k + '": ' + toJSON(v[k], n));
        return "{\n" + out.join(",\n") + "\n" + ind + "}";
    }

    // ---------- techniques (script workflows: a frame of the result, tags, how to run it alone or with Claude) ----------
    function techText(name) {
        for (var i = 0; i < TECH.length; i++) if (TECH[i].name === name) return TECH[i].what + "\n\nHow: " + TECH[i].how + "\n\nWith Claude: \"" + TECH[i].ask + "\"";
        return "";
    }
    function techniques() {
        if (!TECH.length) { body.add("statictext", undefined, "library/techniques.json is missing."); return; }
        var shown = [], q = search.text.toLowerCase(), tn = tone.selection.index > 0 ? tone.selection.text : "";
        var TT = {}; for (var i = 0; i < (TAGS.techniques || []).length; i++) TT[TAGS.techniques[i].name] = TAGS.techniques[i];
        for (i = 0; i < TECH.length; i++) {
            var t = TECH[i], tg = TT[t.name] || { energy: [1, 5], tones: [], needs: [] };
            if (q && (t.name + " " + t.what + " " + tg.tones.join(" ")).toLowerCase().indexOf(q) < 0) continue;
            if (tn && tg.tones.length && ("," + tg.tones.join(",") + ",").indexOf("," + tn + ",") < 0) continue;
            if (!inRange(tg.energy)) continue;
            shown.push({ t: t, tg: tg });
        }
        if (!shown.length) { body.add("statictext", undefined, "No technique matches the filters."); return; }
        var G = gridGeom(180, 360, 126 / 224), COLS = G.n, row = null;
        for (var k = 0; k < shown.length; k++) (function (it, k) {
            if (k % COLS === 0) { row = body.add("group"); row.spacing = G.sp; row.alignChildren = ["left", "top"]; row.alignment = ["center", "top"]; }
            var cell = row.add("group"); cell.orientation = "column"; cell.spacing = 1; cell.alignChildren = ["left", "top"];
            var slug = it.t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            var f = new File(SS_ROOT + "/library/techniques/" + slug + "_md.png"), btn;
            btn = thumbButton(cell, f.exists ? f : null, G.w, G.h, it.t.name);
            cell.add("statictext", [0, 0, G.w, 16], fit((FAV["technique/" + it.t.name] ? "★ " : "") + it.t.name + " · energy " + it.tg.energy[0] + "–" + it.tg.energy[1], G.w));
            cell.add("statictext", [0, 0, G.w, 30], (it.tg.tones.join(" · ") || "any tone") + (it.tg.needs.length ? "\nneeds " + it.tg.needs.join(", ") : ""), { multiline: true });
            btn.helpTip = it.t.what;
            btn.onClick = function () {
                select("technique", it.t.name, {}); selName.text = "Technique: " + it.t.name;
                selInfo.text = it.t.what + "\nHow: " + it.t.how + "\nWith Claude: \"" + it.t.ask + "\"";
            };
        })(shown[k], k);
    }

    // ---------- assets (local asset packs, licensed, never in the repo) ----------
    // a grid like the presets: SFX show their waveform, overlays a frame (library/assets_cache, python tools/asset_previews.py)
    var ROWS_A = null, A_TYPE = "sfx", A_CAT = "all categories", A_SEL = null;
    function assets() {
        if (!ROWS_A) {
            ROWS_A = [];
            var idx = new File(SS_ROOT + "/library/ASSETS.local.txt");
            if (idx.exists) {
                idx.encoding = "UTF-8"; idx.open("r");
                var lines = idx.read().split("\n"); idx.close();
                for (var i = 0; i < lines.length; i++) {
                    if (!lines[i] || lines[i].charAt(0) === "#") continue;
                    var c = lines[i].split("|");
                    if (c[0] === "sfx" || c[0] === "overlay") ROWS_A.push({ type: c[0], cat: c[1], name: c[2], sec: c[3], mean: c[4], flags: c[6] || "" });
                }
            }
        }
        if (!ROWS_A.length) {
            body.add("statictext", undefined, "No local asset index yet. In a terminal, from the repo:\n  python tools/index_assets.py\n  python tools/asset_previews.py\nthen reopen this panel.", { multiline: true }).preferredSize.height = 84;
            return;
        }
        var g = body.add("group");
        var type = g.add("dropdownlist", undefined, ["sfx", "overlay"]); type.selection = A_TYPE === "sfx" ? 0 : 1;
        var cats = ["all categories"], seen = {};
        for (var r = 0; r < ROWS_A.length; r++) if (ROWS_A[r].type === A_TYPE && !seen[ROWS_A[r].cat]) { seen[ROWS_A[r].cat] = 1; cats.push(ROWS_A[r].cat); }
        var cg = g.add("dropdownlist", undefined, cats); cg.preferredSize.width = 130;
        for (var ci = 0; ci < cats.length; ci++) if (cats[ci] === A_CAT) cg.selection = ci;
        if (!cg.selection) cg.selection = 0;
        type.onChange = function () { A_TYPE = type.selection.text; A_CAT = "all categories"; page = 0; show(); };
        cg.onChange = function () { A_CAT = cg.selection.text; page = 0; show(); };
        var q = search.text.toLowerCase(), items = [];
        for (var a = 0; a < ROWS_A.length; a++) {
            var row = ROWS_A[a];
            if (row.type !== A_TYPE || (A_CAT !== "all categories" && row.cat !== A_CAT)) continue;
            if (q && (row.name + " " + row.cat).toLowerCase().indexOf(q) < 0) continue;
            items.push({ kind: row.type, name: row.name, row: row, meta: { energy: "", use: row.cat + " · " + row.sec + " s" + (row.mean ? " · mean " + row.mean + " dB" : "") } });
        }
        grid(items, function (it) {   // selecting an asset: show its info, Add places it
            A_SEL = it.row; CUR = null; selName.text = it.row.name; bFav.text = "☆"; setPreview("/library/assets_cache/" + it.row.type + "/" + techSlug(it.row.name) + ".png");
            selInfo.text = it.row.cat + " · " + it.row.sec + " s" + (it.row.mean ? " · mean " + it.row.mean + " dB" : "") + (it.row.flags.indexOf("loud") >= 0 ? " · loud: lower the gain" : "");
            redraw();
        });
        var g2 = body.add("group");
        g2.add("statictext", undefined, "Gain dB:"); var gain = g2.add("edittext", undefined, "-9"); gain.characters = 4;
        g2.add("statictext", undefined, " Opacity %:"); var opac = g2.add("edittext", undefined, "70"); opac.characters = 4;
        var add = g2.add("button", undefined, "Add at the playhead");
        add.onClick = function () {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem) || !A_SEL) { alert("Open a composition and pick an asset."); return; }
            app.beginUndoGroup(NAME + " asset: " + A_SEL.name);
            try {
                if (A_SEL.type === "sfx") SSA.sfx(comp, A_SEL.name, comp.time, parseFloat(gain.text) || -9);
                else SSA.overlay(comp, A_SEL.name, comp.time, null, parseFloat(opac.text) || 70);
            } catch (e) { alert(NAME + ": " + e.toString()); }
            app.endUndoGroup();
        };
    }

    // ---------- sections ----------
    function shown(el, on) { el.visible = on; el.maximumSize = on ? [10000, 10000] : [0, 0]; }
    function tunable() { return SECTION === "Behaviors" || SECTION === "Styles" || SECTION === "Brands"; }
    function applySection() {   // what each section shows above its own content
        shown(catBox, SECTION === "Behaviors"); fA.spacing = SECTION === "Behaviors" ? 10 : 0;
        shown(fB, SECTION !== "Curves"); shown(prevBox, SECTION !== "Curves");
        shown(ctlWrap, tunable()); shown(ctlBox, tunable() && CTL_OPEN); shown(act, tunable());
        search.helpTip = SECTION === "Curves" ? "Search curves by name or use" : "Search by name, channel or use";
    }
    function setSection(s) {
        SECTION = s; page = 0; PREV_IMG = null; A_SEL = null;
        try { app.settings.saveSetting("MotionDNA", "section", s); } catch (e) {}
        applySection(); for (var i = 0; i < TABS.length; i++) repaint(TABS[i]);
        vbar.value = 0; showNow(); redraw();
        repaint(ctlHead); repaint(bApply); repaint(bRem);   // drawn controls that were hidden need a fresh paint
    }
    // section icons: original line drawings on a 20 px grid, in the brand colours (Spark when active)
    function sectionIcon(g, name, cx, cy, col) {
        var pen = g.newPen(g.PenType.SOLID_COLOR, col, 1.6), brush = g.newBrush(g.BrushType.SOLID_COLOR, col), i;
        function line(x0, y0, x1, y1) { g.newPath(); g.moveTo(cx + x0, cy + y0); g.lineTo(cx + x1, cy + y1); g.strokePath(pen); }
        function poly(pts, fill) { g.newPath(); g.moveTo(cx + pts[0][0], cy + pts[0][1]); for (var k = 1; k < pts.length; k++) g.lineTo(cx + pts[k][0], cy + pts[k][1]); g.closePath(); if (fill) g.fillPath(brush); else g.strokePath(pen); }
        if (name === "Behaviors") {          // an arrow leaving speed lines behind
            line(-10, -5, -5, -5); line(-12, 0, -4, 0); line(-10, 5, -5, 5);
            poly([[-2, -7], [9, 0], [-2, 7]], true);
        } else if (name === "Curves") {      // an ease curve with its two handles
            line(-9, 8, -9, -9); line(-9, 8, 9, 8);
            g.newPath(); for (i = 0; i <= 16; i++) { var u = i / 16, bx = 3 * (1 - u) * (1 - u) * u * 0.6 + 3 * (1 - u) * u * u * 0.1 + u * u * u, by = 3 * (1 - u) * (1 - u) * u * 0 + 3 * (1 - u) * u * u * 1 + u * u * u;
                var px = cx - 9 + bx * 18, py = cy + 8 - by * 16; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.strokePath(pen);
            g.newPath(); g.ellipsePath(cx + 0.6 * 18 - 9 - 2.5, cy + 8 - 2.5, 5, 5); g.fillPath(brush);
            g.newPath(); g.ellipsePath(cx + 0.1 * 18 - 9 - 2.5, cy - 8 - 2.5, 5, 5); g.fillPath(brush);
        } else if (name === "Styles") {      // a stack of three looks
            rrect(g, cx - 9, cy - 9, 11, 11, 2.5); g.strokePath(pen);
            rrect(g, cx - 5.5, cy - 5.5, 11, 11, 2.5); g.strokePath(pen);
            rrect(g, cx - 2, cy - 2, 11, 11, 2.5); g.fillPath(brush);
        } else if (name === "Brands") {      // a guideline book with its bookmark
            rrect(g, cx - 8, cy - 9, 16, 18, 2.5); g.strokePath(pen);
            poly([[1, -9], [6, -9], [6, -1], [3.5, -3], [1, -1]], true);
            line(-5, 3, 4, 3); line(-5, 6, 1, 6);
        } else if (name === "Techniques") {  // a wand and its spark
            line(-9, 9, 3, -3);
            poly([[6, -10], [7.3, -6.3], [11, -5], [7.3, -3.7], [6, 0], [4.7, -3.7], [1, -5], [4.7, -6.3]], true);
            poly([[-3, -9], [-2.3, -7.3], [-0.6, -6.6], [-2.3, -5.9], [-3, -4.2], [-3.7, -5.9], [-5.4, -6.6], [-3.7, -7.3]], true);
        }
    }
    var TABS = [];
    for (var ti = 0; ti < SECTIONS.length; ti++) (function (name) {
        var b = drawn(nav, 40, 50, name, function (g, W, H, hov) {
            var on = SECTION === name, col = on ? rgba(C.spark) : (hov ? [0.9, 0.92, 0.88, 1] : [0.58, 0.62, 0.6, 1]);
            g.newPath(); g.rectPath(0, 0, W, H); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, on ? [0.09, 0.11, 0.1, 1] : [0.07, 0.08, 0.075, 1]));
            if (on) { g.newPath(); g.rectPath(W * 0.2, 0, W * 0.6, 2); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, rgba(C.spark))); }
            var showLabel = W >= 58;
            sectionIcon(g, name, W / 2, showLabel ? 19 : H / 2, col);
            if (showLabel) { var f = ScriptUI.newFont("dialog", on ? "BOLD" : "REGULAR", 10), m = g.measureString(name, f); g.drawString(name, g.newPen(g.PenType.SOLID_COLOR, col, 1), (W - m[0]) / 2, H - m[1] - 5, f); }
        });
        b.alignment = ["fill", "fill"]; b.noDrag = true;
        b.helpTip = { Behaviors: "Behaviors: the animation presets (moves, text, loops, transitions, recipes)", Curves: "Curves: the easing library and a curve editor for selected keyframes",
                      Styles: "Styles: whole-comp animation styles", Brands: "Brands: brand motion guidelines and their rules", Techniques: "Techniques: scripted workflows and how to run them" }[name];
        b.onClick = function () { setSection(name); };
        TABS.push(b);
    })(SECTIONS[ti]);

    // ---------- curves: the easing library and an editor (drag the handles, type the values, apply to keyframes) ----------
    var CV = { bz: [0.18, 0.28, 0, 0.9], name: "Coast" }, CV_R = [-0.2, 1.2];   // both axes show -0.2..1.2: the 0..1 square stays square
    function easings() { try { return SSM.tokens().easings; } catch (e) { return []; } }
    function bez(bz, u) {   // point on the cubic bezier (0,0) P1 P2 (1,1) at parameter u
        var a = 3 * (1 - u) * (1 - u) * u, b = 3 * (1 - u) * u * u, c = u * u * u;
        return [a * bz[0] + b * bz[2] + c, a * bz[1] + b * bz[3] + c];
    }
    function bzText(bz) { var a = []; for (var i = 0; i < 4; i++) a.push((Math.round(bz[i] * 100) / 100).toFixed(2)); return a.join(", "); }
    function curveName(bz) {
        var es = easings();
        for (var i = 0; i < es.length; i++) { var b = es[i].bezier, d = 0; for (var k = 0; k < 4; k++) d += Math.abs(b[k] - bz[k]); if (d < 0.02) return es[i].name; }
        return "";
    }
    // curve in a square plot: S = the square's side, (ox, oy) its corner; values outside the range are clamped to the edge
    function plot(W, H) { var S = Math.min(W, H); return { S: S, ox: (W - S) / 2, oy: (H - S) / 2 }; }
    function drawCurve(g, W, H, bz, pad, y0, y1, col, width, handles) {
        var q0 = plot(W, H), S = q0.S - 2 * pad, ox = q0.ox + pad, oy = q0.oy + pad, k = 1 / (y1 - y0);
        function X(u) { return ox + (Math.max(y0, Math.min(y1, u)) - y0) * k * S; }
        function Y(v) { return oy + S - (Math.max(y0, Math.min(y1, v)) - y0) * k * S; }
        g.newPath(); g.moveTo(X(0), Y(0));
        for (var i = 1; i <= 48; i++) { var q = bez(bz, i / 48); g.lineTo(X(q[0]), Y(q[1])); }
        g.strokePath(g.newPen(g.PenType.SOLID_COLOR, col, width));
        if (!handles) return;
        var hp = g.newPen(g.PenType.SOLID_COLOR, [0.97, 0.98, 0.95, 0.6], 1);
        g.newPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(bz[0]), Y(bz[1])); g.strokePath(hp);
        g.newPath(); g.moveTo(X(1), Y(1)); g.lineTo(X(bz[2]), Y(bz[3])); g.strokePath(hp);
        var ends = [[0, 0], [1, 1]];
        for (i = 0; i < 2; i++) { g.newPath(); g.ellipsePath(X(ends[i][0]) - 3, Y(ends[i][1]) - 3, 6, 6); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [0.97, 0.98, 0.95, 1])); }
        for (i = 0; i < 2; i++) {
            g.newPath(); g.ellipsePath(X(bz[i * 2]) - 7, Y(bz[i * 2 + 1]) - 7, 14, 14); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, rgba(C.spark, 0.2)));
            g.newPath(); g.ellipsePath(X(bz[i * 2]) - 4.5, Y(bz[i * 2 + 1]) - 4.5, 9, 9); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, rgba(C.spark)));
        }
    }
    var ED = null, ED_TXT = null, ED_NAME = null, ED_DEL = null, ED_DRAG = -1, CV_THUMBS = [];
    function curveChanged() {
        var was = CV.name; CV.name = curveName(CV.bz);
        if (ED) repaint(ED);
        if (ED_TXT) ED_TXT.text = bzText(CV.bz);
        if (ED_NAME) ED_NAME.text = CV.name ? CV.name : "Custom curve";
        if (ED_DEL) ED_DEL.enabled = isUserCurve(CV.name);
        if (was !== CV.name) for (var i = 0; i < CV_THUMBS.length; i++) repaint(CV_THUMBS[i]);   // only when the highlight moves
    }
    function curves() {
        var avail = vpW() - 16, ew = Math.round(Math.min(avail, 340)), eh = ew;   // square, like a curve should be
        // the editor: drag the two Spark handles; the grid marks 0 and 1 (overshoot and anticipation live outside)
        ED = body.add("group"); ED.preferredSize = [ew, eh]; ED.alignment = ["center", "top"]; ED.noDrag = true; ED.keepSize = true;
        var EPAD = 8;
        ED.onDraw = function () {
            var g = this.graphics, W = this.size.width, H = this.size.height, q0 = plot(W, H), S = q0.S - 2 * EPAD, ox = q0.ox + EPAD, oy = q0.oy + EPAD, k = 1 / (CV_R[1] - CV_R[0]);
            function X(u) { return ox + (u - CV_R[0]) * k * S; }
            function Y(v) { return oy + S - (v - CV_R[0]) * k * S; }
            g.newPath(); g.rectPath(0, 0, W, H); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, C.pine));
            var grid = g.newPen(g.PenType.SOLID_COLOR, [0.97, 0.98, 0.95, 0.07], 1), i;
            for (i = 0; i <= 4; i++) {   // a 4x4 grid on the unit square
                g.newPath(); g.moveTo(X(i / 4), Y(0)); g.lineTo(X(i / 4), Y(1)); g.strokePath(grid);
                g.newPath(); g.moveTo(X(0), Y(i / 4)); g.lineTo(X(1), Y(i / 4)); g.strokePath(grid);
            }
            var base = g.newPen(g.PenType.SOLID_COLOR, [0.97, 0.98, 0.95, 0.25], 1);
            g.newPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(0)); g.strokePath(base);
            g.newPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(0), Y(1)); g.strokePath(base);
            g.newPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(1)); g.strokePath(grid);
            drawCurve(g, W, H, CV.bz, EPAD, CV_R[0], CV_R[1], rgba(C.spark), 2.5, true);
        };
        function toCurve(px, py) {
            var q0 = plot(ED.size.width, ED.size.height), S = q0.S - 2 * EPAD, ox = q0.ox + EPAD, oy = q0.oy + EPAD, span = CV_R[1] - CV_R[0];
            return [CV_R[0] + (px - ox) / S * span, CV_R[0] + (oy + S - py) / S * span];
        }
        ED.addEventListener("mousedown", function (e) {
            NO_SCROLL = true; DRAG = null;
            var q = toCurve(e.clientX, e.clientY), best = -1, bd = 1e9;
            var S = plot(ED.size.width, ED.size.height).S / (CV_R[1] - CV_R[0]);
            for (var i = 0; i < 2; i++) { var dx = (q[0] - CV.bz[i * 2]) * S, dy = (q[1] - CV.bz[i * 2 + 1]) * S, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
            ED_DRAG = bd < 900 ? best : -1;   // within ~30 px of a handle
        });
        ED.addEventListener("mousemove", function (e) {
            if (ED_DRAG < 0) return;
            var q = toCurve(e.clientX, e.clientY);
            CV.bz[ED_DRAG * 2] = Math.max(0, Math.min(1, Math.round(q[0] * 100) / 100));
            CV.bz[ED_DRAG * 2 + 1] = Math.max(CV_R[0], Math.min(CV_R[1], Math.round(q[1] * 100) / 100));
            curveChanged();
        });
        ED.addEventListener("mouseup", function () { ED_DRAG = -1; NO_SCROLL = false; });
        // name, values (editable), actions
        var r1 = body.add("group"); r1.alignChildren = ["left", "center"]; r1.alignment = ["fill", "top"];
        ED_NAME = r1.add("statictext", undefined, ""); ED_NAME.preferredSize = [60, 18]; ED_NAME.alignment = ["fill", "center"];
        try { ED_NAME.graphics.font = ScriptUI.newFont("dialog", "BOLD", 12); } catch (e) {}
        ED_TXT = r1.add("edittext", undefined, ""); ED_TXT.characters = 18; ED_TXT.helpTip = "cubic-bezier(x1, y1, x2, y2): type values and press Enter";
        ED_TXT.onChange = function () {
            var n = ED_TXT.text.match(/-?\d*\.?\d+/g);
            if (n && n.length >= 4) { CV.bz = [Math.max(0, Math.min(1, +n[0])), +n[1], Math.max(0, Math.min(1, +n[2])), +n[3]]; }
            curveChanged();
        };
        var r2 = body.add("group"); r2.alignChildren = ["fill", "center"]; r2.alignment = ["fill", "top"]; r2.spacing = 6;
        var bAp = solidButton(r2, "Apply to keyframes", C.spark, C.pine, "Ease every pair of selected keyframes with this curve");
        var bGet = r2.add("button", undefined, "Read keys"); bGet.preferredSize.width = 40; bGet.helpTip = "Load the curve between the first two selected keyframes";
        var bRev = r2.add("button", undefined, "Reverse"); bRev.preferredSize.width = 40; bRev.helpTip = "Mirror the curve (an ease in becomes an ease out)";
        var r3 = body.add("group"); r3.alignChildren = ["fill", "center"]; r3.alignment = ["fill", "top"]; r3.spacing = 6;
        var bSave = r3.add("button", undefined, "Save curve\u2026"); bSave.preferredSize.width = 40; bSave.helpTip = "Add this curve to the library (tokens/superside_motion_tokens.json)";
        ED_DEL = r3.add("button", undefined, "Delete"); ED_DEL.preferredSize.width = 40; ED_DEL.helpTip = "Delete the selected curve (only curves saved from the panel)";
        bSave.onClick = function () { saveCurveDialog(); };
        ED_DEL.onClick = function () {
            var nm = CV.name; if (!isUserCurve(nm)) return;
            if (!confirm("Delete the curve \"" + nm + "\" from the library?")) return;
            try { deleteCurve(nm); show(); } catch (e) { alert(NAME + ": could not delete the curve: " + e.toString()); }
        };
        bAp.onClick = function () { applyCurve(CV.bz); };
        bGet.onClick = function () { var b = readCurve(); if (b) { CV.bz = b; curveChanged(); } };
        bRev.onClick = function () { CV.bz = [1 - CV.bz[2], 1 - CV.bz[3], 1 - CV.bz[0], 1 - CV.bz[1]]; curveChanged(); };
        // the library: every token curve; click one to load it
        var es = easings(), q = search.text.toLowerCase(), shownE = [];
        for (var i = 0; i < es.length; i++) if (!q || (es[i].name + " " + (es[i].use || "")).toLowerCase().indexOf(q) >= 0) shownE.push(es[i]);
        body.add("statictext", undefined, "Library · " + shownE.length + " curves").alignment = ["left", "top"];
        var G = gridGeom(58, 96, 1), row = null; CV_THUMBS = [];   // square cells
        for (var k = 0; k < shownE.length; k++) (function (ez, k) {
            if (k % G.n === 0) { row = body.add("group"); row.spacing = G.sp; row.alignChildren = ["left", "top"]; row.alignment = ["center", "top"]; }
            var cell = row.add("group"); cell.orientation = "column"; cell.spacing = 1; cell.alignChildren = ["center", "top"];
            var b = drawn(cell, G.w, G.h, ez.name + (ez.use ? "\n" + ez.use : ""), function (g, W, H, hov) {
                var on = CV.name === ez.name;
                rrect(g, 0.5, 0.5, W - 1, H - 1, 4); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, hov ? [0.07, 0.17, 0.15, 1] : rgba(C.pine)));
                rrect(g, 0.5, 0.5, W - 1, H - 1, 4); g.strokePath(g.newPen(g.PenType.SOLID_COLOR, on ? rgba(C.spark) : rgba(C.sea), on ? 2 : 1));
                drawCurve(g, W, H, ez.bezier, 6, CV_R[0], CV_R[1], on || hov ? rgba(C.spark) : [0.97, 0.98, 0.95, 0.85], 1.6, false);
            });
            b.noDrag = true; CV_THUMBS.push(b);
            b.onClick = function () { CV.bz = ez.bezier.slice(0); curveChanged(); selInfo.text = ez.name + ": " + (ez.use || ""); };
            var lb = cell.add("statictext", [0, 0, G.w, 16], fit((isUserCurve(ez.name) ? "\u2022 " : "") + ez.name, G.w)); lb.justify = "center";
        })(shownE[k], k);
        curveChanged();
    }
    // curves saved from the panel carry source "panel": only those can be overwritten or deleted here
    var TOKENS_PATH = SS_ROOT + "/tokens/superside_motion_tokens.json";
    function isUserCurve(nm) {
        if (!nm) return false;
        var es = easings(); for (var i = 0; i < es.length; i++) if (es[i].name === nm) return String(es[i].source || "").indexOf("panel") === 0;
        return false;
    }
    function readText(path) { var f = new File(path); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return s; }
    function writeText(path, s) { var f = new File(path); f.encoding = "UTF-8"; f.lineFeed = "Unix"; f.open("w"); f.write(s); f.close(); }
    function jstr(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ") + '"'; }
    function r3(x) { return Math.round(x * 1000) / 1000; }
    // the "easings" array in the tokens text: [open bracket index, close bracket index] (strings skipped)
    function easingsRange(s) {
        var i = s.indexOf('"easings"'); if (i < 0) throw new Error("no easings in the tokens file");
        i = s.indexOf("[", i); var d = 0, inStr = false;
        for (var j = i; j < s.length; j++) {
            var ch = s.charAt(j);
            if (inStr) { if (ch === "\\") j++; else if (ch === '"') inStr = false; continue; }
            if (ch === '"') inStr = true; else if (ch === "[" || ch === "{") d++; else if (ch === "]" || ch === "}") { d--; if (d === 0) return [i, j]; }
        }
        throw new Error("unbalanced tokens file");
    }
    // [start, end) of the easings entry named nm, including the comma that separates it from its neighbour
    function entryRange(s, nm) {
        var R = easingsRange(s), key = '"name": ' + jstr(nm), at = s.indexOf(key, R[0]);
        if (at < 0 || at > R[1]) return null;
        var a = s.lastIndexOf("{", at), d = 0, b = -1, inStr = false;
        for (var j = a; j < R[1]; j++) {
            var ch = s.charAt(j);
            if (inStr) { if (ch === "\\") j++; else if (ch === '"') inStr = false; continue; }
            if (ch === '"') inStr = true; else if (ch === "{" || ch === "[") d++; else if (ch === "}" || ch === "]") { d--; if (d === 0) { b = j + 1; break; } }
        }
        var before = s.lastIndexOf(",", a), prevBrace = s.lastIndexOf("}", a);
        if (before > prevBrace && before > R[0]) return [before, b];               // ",\n  {...}"
        var after = s.indexOf(",", b); return [a, after >= 0 && after < R[1] ? after + 1 : b];   // first entry: "{...},"
    }
    function curveEntry(nm, use, bz) {   // same shape and indentation as the file (json.dump indent=1)
        var x1 = bz[0], y1 = bz[1], x2 = bz[2], y2 = bz[3];
        var oS = x1 > 0 ? y1 / x1 : 0, iS = x2 < 1 ? (1 - y2) / (1 - x2) : 0;
        return '  {\n   "name": ' + jstr(nm) + ',\n   "bezier": [\n    ' + r3(x1) + ',\n    ' + r3(y1) + ',\n    ' + r3(x2) + ',\n    ' + r3(y2) + '\n   ],\n' +
               '   "use": ' + jstr(use || "Saved from the panel") + ',\n   "ae": {\n    "out": {\n     "influence": ' + r3(Math.max(0.1, x1 * 100)) + ',\n     "speed_x_avg": ' + r3(oS) + '\n    },\n' +
               '    "in": {\n     "influence": ' + r3(Math.max(0.1, (1 - x2) * 100)) + ',\n     "speed_x_avg": ' + r3(iS) + '\n    }\n   },\n   "source": "panel (saved in the Curves section)"\n  }';
    }
    function saveCurve(nm, use, bz) {
        var s = readText(TOKENS_PATH), es = easings();
        for (var i = 0; i < es.length; i++) if (es[i].name === nm) {
            if (!isUserCurve(nm)) throw new Error("\"" + nm + "\" is a built-in curve: pick another name");
            var er = entryRange(s, nm); if (er) s = s.substr(0, er[0]) + s.substr(er[1]);
        }
        var R = easingsRange(s), last = s.lastIndexOf("}", R[1]);
        s = s.substr(0, last + 1) + ",\n" + curveEntry(nm, use, bz) + s.substr(last + 1);
        writeText(TOKENS_PATH, s); SSM.load(TOKENS_PATH);
    }
    function deleteCurve(nm) {
        var s = readText(TOKENS_PATH), er = entryRange(s, nm); if (!er) return;
        writeText(TOKENS_PATH, s.substr(0, er[0]) + s.substr(er[1])); SSM.load(TOKENS_PATH);
    }
    function saveCurveDialog() {
        var nm = prompt("Name of the new curve (one or two words, no brand names):", CV.name && isUserCurve(CV.name) ? CV.name : "My Curve");
        if (!nm) return; nm = nm.replace(/^\s+|\s+$/g, ""); if (!nm) return;
        var use = prompt("What is it for? (shown in the library tooltip)", "") || "";
        try { saveCurve(nm, use, CV.bz); CV.name = nm; show(); selInfo.text = "Saved \"" + nm + "\" in the library. Tag it for the Mix with: python tools/tag_library.py"; }
        catch (e) { alert(NAME + ": could not save the curve: " + e.toString()); }
    }

    // AE eases from a cubic-bezier, per pair of selected keyframes (same conversion as SSM.animateBezier)
    function segAvg(p, k) {
        var v0 = p.keyValue(k), v1 = p.keyValue(k + 1), dur = Math.max(p.keyTime(k + 1) - p.keyTime(k), 0.001), n = p.keyOutTemporalEase(k).length, out = [], d = 0, i;
        if (!(v0 instanceof Array)) return [Math.abs(v1 - v0) / dur];
        if (n === 1) { for (i = 0; i < v0.length; i++) d += Math.pow(v1[i] - v0[i], 2); return [Math.sqrt(d) / dur]; }
        for (i = 0; i < n; i++) out.push(Math.abs(v1[i] - v0[i]) / dur);
        return out;
    }
    function easeWithBezier(p, k, bz) {
        var x1 = Math.max(bz[0], 0.001), x2 = Math.min(bz[2], 0.999), avg = segAvg(p, k), o = [], n = [], i;
        var oI = Math.max(0.1, Math.min(100, x1 * 100)), iI = Math.max(0.1, Math.min(100, (1 - x2) * 100));
        for (i = 0; i < avg.length; i++) { o.push(new KeyframeEase(Math.max(0, bz[1] / x1 * avg[i]), oI)); n.push(new KeyframeEase(Math.max(0, (1 - bz[3]) / (1 - x2) * avg[i]), iI)); }
        p.setInterpolationTypeAtKey(k, p.keyInInterpolationType(k), KeyframeInterpolationType.BEZIER);
        p.setInterpolationTypeAtKey(k + 1, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(k + 1));
        p.setTemporalEaseAtKey(k, p.keyInTemporalEase(k), o);
        p.setTemporalEaseAtKey(k + 1, n, p.keyOutTemporalEase(k + 1));
    }
    function selectedPairs() {   // [[prop, k]] for every selected keyframe whose next keyframe is selected too
        var c = app.project.activeItem, out = [];
        if (!(c instanceof CompItem)) return out;
        var ps = c.selectedProperties;
        for (var i = 0; i < ps.length; i++) {
            var p = ps[i]; if (p.propertyType !== PropertyType.PROPERTY || !p.numKeys) continue;
            var ks = p.selectedKeys, has = {}; for (var j = 0; j < ks.length; j++) has[ks[j]] = 1;
            for (j = 0; j < ks.length; j++) if (has[ks[j] + 1]) out.push([p, ks[j]]);
        }
        return out;
    }
    function applyCurve(bz) {
        var pairs = selectedPairs();
        if (!pairs.length) { alert("Select two or more keyframes next to each other (on one or more properties)."); return; }
        app.beginUndoGroup(NAME + ": curve " + (CV.name || bzText(bz)));
        try { for (var i = 0; i < pairs.length; i++) easeWithBezier(pairs[i][0], pairs[i][1], bz); } catch (e) { alert(NAME + ": " + e.toString()); }
        app.endUndoGroup();
        selInfo.text = (CV.name || "Custom curve") + " applied to " + pairs.length + " keyframe pair" + (pairs.length > 1 ? "s" : "") + ".";
    }
    function readCurve() {
        var pairs = selectedPairs();
        if (!pairs.length) { alert("Select two keyframes next to each other to read their curve."); return null; }
        var p = pairs[0][0], k = pairs[0][1];
        if (p.keyOutInterpolationType(k) === KeyframeInterpolationType.LINEAR) return [0, 0, 1, 1];
        var a = segAvg(p, k)[0] || 1, o = p.keyOutTemporalEase(k)[0], n = p.keyInTemporalEase(k + 1)[0];
        var x1 = o.influence / 100, x2 = 1 - n.influence / 100;
        return [Math.round(x1 * 100) / 100, Math.round(o.speed / a * x1 * 100) / 100, Math.round(x2 * 100) / 100, Math.round((1 - n.speed / a * (1 - x2)) * 100) / 100];
    }

    // hook for scripts and the MCP server: SS_PANEL.select("motion", "Scale Pop"); SS_PANEL.frame(); SS_PANEL.tab("Styles")
    $.global.SS_PANEL = {
        // closes the floating window the tests open (a docked panel is left alone)
        close: function () { if (!(win instanceof Panel)) { try { win.close(); } catch (e) {} } return "closed"; },
        select: function (kind, name) {
            ensureClock();
            if (kind === "pack" || kind === "technique") { select(kind, name, {}); selName.text = (kind === "pack" ? "Style: " : "Technique: ") + name; return "selected " + kind + "/" + name; }
            if (kind === "brand") { var bb = brandOf(name); if (!bb) return "unknown brand"; select("brand", name, {}); selName.text = "Brand: " + bb.name; selInfo.text = bb.feel.style + " · " + bb.rules.length + " rules\n" + brandRules(bb, 3); return "selected brand/" + name; }
            var meta = metaOf(kind, name);
            if (!meta) return "unknown preset";
            select(kind, name, meta); return "selected " + kind + "/" + name;
        },
        host: win,   // the panel or palette (tests close their palette with SS_PANEL.host.close())
        showControls: function (open) { showControls(!!open); return "controls " + (CTL_OPEN ? "open" : "closed"); },
        frame: function () { return CUR ? CUR.key + " @" + FRAME : "none"; },
        scroll: function (v, h) {   // scroll the panel from a script (recordings, tests); returns the geometry
            if (v !== undefined) vbar.value = Math.max(0, Math.min(v, vbar.maxvalue)); if (h !== undefined) hbar.value = Math.max(0, Math.min(h, hbar.maxvalue));
            scrollTo();
            return "view " + vp.size.width + "x" + vp.size.height + " content " + ui.size.width + "x" + ui.size.height + " v " + vbar.value + "/" + vbar.maxvalue + " h " + hbar.value + "/" + hbar.maxvalue;
        },
        tab: function (t) {   // a section (Behaviors, Curves, Styles, Brands, Techniques) or a Behaviors category (Moves, Text...)
            if (t === "Motion") t = "Moves"; if (t === "Effects") t = "Loops"; if (t === "Packs") t = "Styles";
            for (var s = 0; s < SECTIONS.length; s++) if (SECTIONS[s] === t) { setSection(t); return "section " + t; }
            for (var i = 0; i < CATS.length; i++) if (CATS[i] === t) { cat.selection = i; setSection("Behaviors"); return "category " + t; }
            return "no category " + t;
        },
        curve: function (bz) { if (bz) { CV.bz = bz.slice(0); curveChanged(); } return (CV.name || "custom") + " " + bzText(CV.bz); },
        applyCurve: function () { applyCurve(CV.bz); return selInfo.text; },
        saveCurve: function (nm, use) { saveCurve(nm, use, CV.bz); showNow(); return "saved " + nm; },
        deleteCurve: function (nm) { if (!isUserCurve(nm)) return "not a panel curve"; deleteCurve(nm); showNow(); return "deleted " + nm; },
        refresh: function () { showNow(); return "ok"; },
        filters: function (o) {   // energy level 0-5 and tone, from a script (recordings, tests)
            o = o || {}; if (o.energy !== undefined) energy.selection = o.energy;
            if (o.tone !== undefined) for (var i = 0; i < tone.items.length; i++) if (tone.items[i].text === (o.tone || "all tones")) tone.selection = i;
            page = 0; showNow(); return "filters set";
        },
        mix: function (action) { if (MIX_ACT[action]) { MIX_ACT[action](); return MIX ? MIX.rows.length + " rows" : "no mix"; } return "open the Mix category first"; },
        saveStyle: function (name, path) { return MIX ? saveStyle(name, path).slug : "no mix"; },   // path: write a copy elsewhere (tests)
        mixRows: function () { if (!MIX) return "none"; var a = []; for (var i = 0; i < MIX.rows.length; i++) a.push(MIX.rows[i].L.name + ">" + MIX.rows[i].role + ":" + (MIX.rows[i].preset ? MIX.rows[i].preset.name : "-") + "·" + MIX.rows[i].curve); return a.join(" | "); },
        controls: function (o) {   // set the controls from a script (recordings, tests)
            o = o || {};
            if (o.speed) sDur.value = o.speed; if (o.intensity) sInt.value = o.intensity;
            if (o.direction !== undefined) dir.selection = o.direction; if (o.ease) for (var i = 0; i < EASES.length; i++) if (EASES[i] === o.ease) ease.selection = i;
            sDur.onChanging(); sInt.onChanging(); return "ok";
        }
    };

    applySection(); status(); showNow();
    var lastW = 0;
    win.onResizing = win.onResize = function () {
        this.layout.resize(); place();
        ensureClock();
        var w = vpW(); if (Math.abs(w - lastW) > 10) { lastW = w; showNow(); } else relayout();
    };
    if (win instanceof Window) {
        win.onClose = function () { CLOSED = true; };
        relayout(); win.show(); win.size = [440, 720]; win.layout.resize(); place(); win.center();
    } else { relayout(); lastW = vpW(); showNow(); }
})((typeof SS_PANEL_HOST !== "undefined" && SS_PANEL_HOST) || this);
