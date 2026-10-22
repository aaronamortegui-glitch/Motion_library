// Pixel rig: draws a Motion DNA character (library/characters/<slug>/character.json, style "pixel") as crisp pixel art.
// Every part is a primitive in sprite pixels; it is rasterized without anti-aliasing, lit from the top-left, then the
// whole sprite is squashed / leaned / lifted with nearest-neighbour sampling and outlined, so a pose is always clean
// pixel art. The face is a bitmap on the screen (emotions in the JSON). Pure function of its state: no timers.
//   const rig = PixelRig(characterJson);
//   const sprite = rig.render({ emotion, pose, armT, light, sy, lean, hop, look, t });   // an offscreen canvas
//   rig.shadow(g, x, groundY, hop)   // contact shadow on a low-res scene canvas
(function () {
  const MARKS = {   // small symbols an emotion can show on the screen next to the eyes
    "?": [".##.", "#..#", "..#.", ".#..", "....", ".#.."],
    "!": ["#", "#", "#", "#", ".", "#"],
  };
  function PixelRig(C) {
    const S = C.styles.pixel, W = S.sprite.w, H = S.sprite.h, G = S.sprite.ground_y, CX = S.sprite.center_x;
    const PAL = {}; for (const k in C.palette) PAL[k] = C.palette[k].hex;
    const keys = Object.keys(PAL), IDX = {}; keys.forEach((k, i) => IDX[k] = i + 1);   // 0 = empty
    const RGB = [null, ...keys.map(k => { const h = PAL[k]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; })];

    // ---- shape tests (pixel centres) ----
    const inEllipse = (p, x, y) => ((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 <= 1;
    function inRR(x0, y0, w, h, rt, rb, x, y) {
      if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return false;
      const r = y < y0 + h / 2 ? rt : rb, cy = y < y0 + h / 2 ? y0 + r : y0 + h - r;
      if ((y < y0 + h / 2 && y >= cy) || (y >= y0 + h / 2 && y <= cy)) return true;
      const cx = x < x0 + r ? x0 + r : x > x0 + w - r ? x0 + w - r : x;
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }
    function distSeg(x, y, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l)); return Math.hypot(x - x0 - u * dx, y - y0 - u * dy); }
    function test(p, x, y, grow = 0) {
      switch (p.shape) {
        case "ellipse": return inEllipse({ cx: p.cx, cy: p.cy, rx: p.rx + grow, ry: p.ry + grow }, x, y);
        case "rrect": return inRR(p.x - grow, p.y - grow, p.w + 2 * grow, p.h + 2 * grow, p.r + grow, p.r + grow, x, y);
        case "capsule": return inRR(p.x, p.y, p.w, p.h, p.r_top, p.r_bottom, x, y);
        case "line": return distSeg(x, y, p.x0, p.y0, p.x1, p.y1) <= p.width / 2;
        default: return false;
      }
    }
    const part = id => S.parts.find(p => p.id === id);
    const body = part("body");

    // shading of a cylinder lit from the top-left: highlight band left, shade right, dome cap lit
    function shadeCyl(p, x, y, base) {
      const cx = p.x + p.w / 2, nx = (x - cx) / (p.w / 2);
      if (base !== "cream") return base;
      if (nx > 0.84) return "cream_deep";
      if (nx > 0.5) return "cream_lo";
      if (nx < -0.52) return "cream_hi";
      if (p.r_top && y < p.y + p.r_top * 0.55 && nx < 0.25) return "cream_hi";
      return "cream";
    }

    // ---- the unposed sprite (palette keys) ----
    function base(st) {
      const buf = new Uint8Array(W * H), set = (x, y, k) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = IDX[k]; };
      const parts = S.parts.filter(p => p.id !== "shadow").map((p, i) => [p, i]).sort((a, b) => (a[0].layer - b[0].layer) || (a[1] - b[1])).map(a => a[0]);
      const glassMask = new Uint8Array(W * H);
      for (const p of parts) {
        if (p.id === "bezel") for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(p, x + 0.5, y + 0.5, 1)) set(x, y, "cream_deep");   // a dark rim around the bezel
        if (p.shape === "hline") { for (let x = p.x0; x <= p.x1; x++) if (test(body, x + 0.5, p.y + 0.5)) set(x, p.y, p.color); continue; }
        if (p.shape === "slots") { for (let i = 0; i < p.n; i++) for (let x = p.x; x < p.x + p.w; x++) if (test(body, x + 0.5, p.y + i * p.gap + 0.5)) set(x, p.y + i * p.gap, p.color); continue; }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const px = x + 0.5, py = y + 0.5; if (!test(p, px, py)) continue;
          let k = p.color;
          if (p.shade === "cyl") k = shadeCyl(p, px, py, k);
          if (p.light) k = st.light <= 0.05 ? "cream_deep" : (px < p.cx && py < p.cy - 0.5 ? "red_hi" : "red");
          if (p.screen) { glassMask[y * W + x] = 1; k = (y % 2) ? "glass_lo" : "glass"; }
          set(x, y, k);
        }
      }
      // glass edge darker
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (glassMask[y * W + x] && (!glassMask[y * W + x - 1] || !glassMask[y * W + x + 1] || !glassMask[(y - 1) * W + x] || !glassMask[(y + 1) * W + x])) set(x, y, "glass_lo");
      arms(st, set);
      face(st, set, glassMask);
      return buf;
    }

    // ---- arms: two segments + a claw, from the pose angles ----
    function arms(st, set) {
      const A = S.arms, pz = C.poses[st.pose] || C.poses.idle, from = C.poses[st.poseFrom || st.pose] || pz, u = st.armT === undefined ? 1 : st.armT;
      for (const side of ["L", "R"]) {
        const sgn = side === "R" ? 1 : -1, [sx, sy] = A.shoulders[side];
        let a1 = from[side][0] + (pz[side][0] - from[side][0]) * u, a2 = from[side][1] + (pz[side][1] - from[side][1]) * u;
        if (pz.wave && pz.wave.arm === side && u >= 1) a2 += pz.wave.amp * Math.sin((st.t || 0) * pz.wave.hz * Math.PI * 2);
        const r1 = a1 * Math.PI / 180, r2 = (a1 + a2) * Math.PI / 180;
        const ex = sx + sgn * Math.sin(r1) * A.upper, ey = sy + Math.cos(r1) * A.upper;
        const hx = ex + sgn * Math.sin(r2) * A.fore, hy = ey + Math.cos(r2) * A.fore;
        const seg = (x0, y0, x1, y1, w, k) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (distSeg(x + 0.5, y + 0.5, x0, y0, x1, y1) <= w / 2) set(x, y, k); };
        seg(sx, sy, ex, ey, A.width, A.colors.arm);
        seg(ex, ey, hx, hy, A.width - 0.4, A.colors.arm);
        // claw: two short fingers splayed from the hand
        const fr = r2, f1 = fr + 0.6, f2 = fr - 0.6;
        seg(hx, hy, hx + sgn * Math.sin(f1) * 2.6, hy + Math.cos(f1) * 2.6, 1.4, A.colors.hand);
        seg(hx, hy, hx + sgn * Math.sin(f2) * 2.6, hy + Math.cos(f2) * 2.6, 1.4, A.colors.hand);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy); if (d <= A.joint_r) set(x, y, d < 1.3 ? "cream_deep" : d < A.joint_r - 1 ? A.colors.joint : "cream_deep"); }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - ex, y + 0.5 - ey) <= 1.2) set(x, y, "cream_deep");   // elbow
      }
    }

    // ---- the face: emotion bitmaps on the glass, with a glow halo ----
    function face(st, set, mask) {
      const E = C.emotions[st.emotion] || C.emotions.neutral, sc = S.screen, look = st.look || [0, 0], el = E.look || [0, 0];
      const lit = new Uint8Array(W * H), hi = new Uint8Array(W * H);
      const stamp = (rows, cx, cy, mirror) => {
        const h = rows.length, w = rows[0].length, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
        let firstRow = -1;
        rows.forEach((r, j) => { for (let i = 0; i < w; i++) { const c = mirror ? r[w - 1 - i] : r[i]; if (c === "#") { const x = x0 + i, y = y0 + j; if (mask[y * W + x]) { lit[y * W + x] = 1; if (firstRow < 0) firstRow = j; if (j === firstRow) hi[y * W + x] = 1; } } } });
      };
      const dx = Math.round(look[0] + el[0]), dy = Math.round(look[1] + el[1]);
      stamp(E.eyes, sc.eyes.L[0] + dx, sc.eyes.L[1] + dy, false);
      stamp(E.eyes_R || E.eyes, sc.eyes.R[0] + dx, sc.eyes.R[1] + dy, !!E.mirror_R);
      if (E.mouth === "dots") { const ph = Math.floor((st.t || 0) * 4) % 4; for (let i = 0; i < 3; i++) if (i < ph) { const x = sc.mouth[0] - 2 + i * 2, y = sc.mouth[1] + 1; if (mask[y * W + x]) lit[y * W + x] = 1; } }
      else if (E.mouth) stamp(E.mouth, sc.mouth[0] + dx, sc.mouth[1] + 1 + dy, false);
      if (E.mark && MARKS[E.mark]) stamp(MARKS[E.mark], sc.mark ? sc.mark[0] : sc.eyes.R[0] + 5, sc.mark ? sc.mark[1] : sc.eyes.R[1] - 3, false);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!mask[i] || lit[i]) continue;
        if (lit[i - 1] || lit[i + 1] || lit[i - W] || lit[i + W]) set(x, y, "glow");
      }
      for (let i = 0; i < W * H; i++) if (lit[i]) set(i % W, Math.floor(i / W), hi[i] ? "eye_hi" : "eye");
    }

    // ---- pose the sprite: squash/stretch around the ground, lean (shear), hop; then outline ----
    function render(st) {
      const src = base(st), out = new Uint8Array(W * H);
      const sy = st.sy || 1, sx = 1 / Math.sqrt(sy), lean = st.lean || 0, hop = Math.round(st.hop || 0), top = body.y;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const yy = y + hop, ys = G - (G - (yy + 0.5)) / sy, h01 = Math.max(0, Math.min(1, (G - ys) / (G - top)));
        const xs = CX + (x + 0.5 - CX - lean * h01) / sx;
        const ix = Math.floor(xs), iy = Math.floor(ys);
        if (ix >= 0 && iy >= 0 && ix < W && iy < H) out[y * W + x] = src[iy * W + ix];
      }
      const ol = IDX.outline;
      const fin = out.slice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (out[i]) continue;
        if ((x > 0 && out[i - 1]) || (x < W - 1 && out[i + 1]) || (y > 0 && out[i - W]) || (y < H - 1 && out[i + W])) fin[i] = ol;
      }
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const g = cv.getContext("2d"), im = g.createImageData(W, H);
      for (let i = 0; i < W * H; i++) { const c = RGB[fin[i]]; if (!c) continue; im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
      return cv;
    }

    // contact shadow: shrinks as the character hops
    function shadow(g, x, groundY, hop = 0) {
      const p = part("shadow"), k = Math.max(0.45, 1 - Math.abs(hop) / 14), rx = p.rx * k, ry = p.ry * k;
      g.fillStyle = PAL[p.color];
      for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) for (let xx = Math.floor(-rx); xx <= Math.ceil(rx); xx++)
        if (((xx + 0.5) / rx) ** 2 + ((y + 0.5) / ry) ** 2 <= 1) g.fillRect(Math.round(x) + xx, groundY + y, 1, 1);
    }

    return { W, H, G, CX, PAL, render, shadow, data: C };
  }
  window.PixelRig = PixelRig;
})();
