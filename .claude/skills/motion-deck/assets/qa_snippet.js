// Motion Deck QA: paste into the browser console (or run with a browser tool) on index.html.
// Forces every slide in, then reports words cut by their mask, text running off the stage or the slide,
// and top-level blocks that overlap. Returns a JSON list; an empty list means clean.
(async () => {
  const st = document.createElement('style'); st.textContent = '*{transition:none!important;animation:none!important}'; document.head.appendChild(st);
  document.querySelectorAll('.slide').forEach(s => s.classList.add('in'));
  await new Promise(r => setTimeout(r, 300));
  const out = [], c = document.createElement('canvas').getContext('2d');
  document.querySelectorAll('.slide').forEach(s => {
    const stage = s.querySelector('.stage'); if (!stage) return;
    const sb = stage.getBoundingClientRect(), k = 1080 / sb.height;
    s.querySelectorAll('.w').forEach(w => {
      const wi = w.firstChild, cs = getComputedStyle(wi);
      c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = c.measureText(wi.textContent), fs = parseFloat(cs.fontSize), wb = w.getBoundingClientRect(), ib = wi.getBoundingClientRect();
      const base = ib.top + (ib.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const cut = {t: wb.top - (base - m.actualBoundingBoxAscent), b: base + m.actualBoundingBoxDescent - wb.bottom,
                   l: wb.left - (ib.left - m.actualBoundingBoxLeft), r: ib.left + m.actualBoundingBoxRight - wb.right};
      if (Object.values(cut).some(v => v > .5)) out.push([s.id, 'MASK CUT', wi.textContent]);
    });
    s.querySelectorAll('.stage p, .stage h1, .stage h2, .stage h3, .stage li, .card, .media, .stat').forEach(e => {
      const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect();
      if (b.width && (b.right > sb.right + 2 || b.bottom > sb.bottom - 60 * sb.height / 1080 || b.left < sb.left - 2))
        out.push([s.id, 'OFF STAGE', e.textContent.trim().slice(0, 40), Math.round((b.bottom - sb.top) * k)]);
    });
    const tops = [...stage.children].filter(e => e.getBoundingClientRect().width && !e.classList.contains('tl'));
    for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
      const ra = document.createRange(); ra.selectNodeContents(tops[i]); const a = ra.getBoundingClientRect();
      const rb = document.createRange(); rb.selectNodeContents(tops[j]); const b = rb.getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 4 && oy > 4) out.push([s.id, 'OVERLAP', tops[i].textContent.trim().slice(0, 25), tops[j].textContent.trim().slice(0, 25)]);
    }
  });
  st.remove();
  return JSON.stringify(out);
})();
