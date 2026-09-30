/* Figma Plugin API version of tools/fetch_figma.py — for when there is no REST
   token but there is a plugin / MCP connection to the file. Run it inside Figma
   (e.g. through the Figma MCP `use_figma` tool) with IDS set to the frames you
   want; it returns { "<frame id>": <compact node>, … } in exactly the shape
   fetch_figma.py writes to screens/*.js, so the renderer cannot tell them apart.
   tools/figma_import.js turns that output into screens/*.js + js/manifest.js.

   Mirrors fetch_figma.py's compact(): same keys, same defaults dropped, colours
   as #rrggbb / rgba(), text style flattened into `st`, mixed styles in `ov`/`ot`,
   prototype links in `go`, x/y relative to the parent's bounding box. */
const IDS = typeof __IDS__ !== 'undefined' ? __IDS__ : [];

const W = { Thin: 100, 'Extra Light': 200, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, 'Semi Bold': 600, SemiBold: 600, Bold: 700, 'Extra Bold': 800, ExtraBold: 800, Black: 900 };
const weightOf = fn => { const s = (fn && fn.style || 'Regular').replace(/\s*Italic$/, '').trim(); return W[s] || 400; };
const hex = v => Math.round(v * 255).toString(16).padStart(2, '0');
const col = (c, a) => { a = Math.round(((c.a === undefined ? 1 : c.a) * (a === undefined ? 1 : a)) * 1000) / 1000; return a >= 1 ? '#' + hex(c.r) + hex(c.g) + hex(c.b) : `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };
const paints = ps => (Array.isArray(ps) ? ps : []).filter(p => p.visible !== false && p.type === 'SOLID').map(p => col(p.color, p.opacity));
const r1 = v => Math.round(v * 10) / 10;
const MIX = figma.mixed;
/* the plugin API throws on a property a node type does not have — read everything through this */
const g = (n, k) => { try { return n[k]; } catch (e) { return undefined; } };

function compact(n, pbox, fixed) {
  if (n.visible === false) return null;
  const box = g(n, 'absoluteBoundingBox') || { x: 0, y: 0, width: n.width || 0, height: n.height || 0 };
  const o = { i: n.id, t: n.type, n: n.name, w: r1(box.width), h: r1(box.height) };
  if (pbox) { o.x = r1(box.x - pbox.x); o.y = r1(box.y - pbox.y); }
  const auto = g(n, 'layoutMode') && g(n, 'layoutMode') !== 'NONE';
  if (auto) {
    o.layoutMode = g(n, 'layoutMode');
    for (const k of ['primaryAxisSizingMode', 'counterAxisSizingMode', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'layoutWrap']) if (g(n, k)) o[k] = g(n, k);
    for (const k of ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing']) if (g(n, k)) o[k] = g(n, k);
    if (g(n, 'counterAxisSpacing')) o.counterAxisSpacing = g(n, 'counterAxisSpacing');
  }
  for (const k of ['layoutSizingHorizontal', 'layoutSizingVertical']) { try { if (g(n, k)) o[k] = g(n, k); } catch (e) {} }
  if (g(n, 'layoutGrow')) o.layoutGrow = g(n, 'layoutGrow');
  if (g(n, 'layoutAlign') && g(n, 'layoutAlign') !== 'INHERIT') o.layoutAlign = g(n, 'layoutAlign');
  if (g(n, 'layoutPositioning') === 'ABSOLUTE') o.layoutPositioning = 'ABSOLUTE';
  if (g(n, 'clipsContent')) o.clipsContent = true;
  for (const k of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']) if (g(n, k)) o[k] = g(n, k);
  if (fixed) o.isFixed = true;
  if (g(n, 'strokeAlign')) o.strokeAlign = g(n, 'strokeAlign');
  if (g(n, 'strokeWeight') !== undefined) {
    const sides = g(n, 'strokeTopWeight') !== undefined ? [g(n, 'strokeTopWeight'), g(n, 'strokeRightWeight'), g(n, 'strokeBottomWeight'), g(n, 'strokeLeftWeight')] : null;
    if (g(n, 'strokeWeight') !== MIX && g(n, 'strokeWeight')) o.strokeWeight = g(n, 'strokeWeight');
    if (sides && !sides.every(v => v === sides[0])) { o.individualStrokeWeights = { top: sides[0], right: sides[1], bottom: sides[2], left: sides[3] }; if (!o.strokeWeight) o.strokeWeight = Math.max(...sides); }
    else if (sides && !o.strokeWeight && sides[0]) o.strokeWeight = sides[0];
  }
  if (g(n, 'cornerRadius') !== undefined) {
    if (g(n, 'cornerRadius') === MIX) o.rectangleCornerRadii = [g(n, 'topLeftRadius'), g(n, 'topRightRadius'), g(n, 'bottomRightRadius'), g(n, 'bottomLeftRadius')];
    else if (g(n, 'cornerRadius')) o.cornerRadius = g(n, 'cornerRadius');
  }
  if (g(n, 'opacity') !== undefined && g(n, 'opacity') !== 1) o.opacity = Math.round(g(n, 'opacity') * 1000) / 1000;
  const sb = g(n, 'scrollBehavior'); if (sb && sb !== 'SCROLLS') o.scrollBehavior = sb;
  if (g(n, 'dashPattern') && g(n, 'dashPattern').length) o.strokeDashes = g(n, 'dashPattern');

  let f = [];
  if (g(n, 'fills') === MIX && n.type === 'TEXT') { const seg = n.getStyledTextSegments(['fills'])[0]; f = paints(seg && seg.fills); }
  else f = paints(g(n, 'fills'));
  if (f.length) o.fill = f;
  const s = paints(g(n, 'strokes'));
  if (s.length && (o.strokeWeight || 0) > 0) o.stroke = s;
  const fx = [];
  for (const e of g(n, 'effects') || []) {
    if (e.visible === false) continue;
    if (e.type === 'DROP_SHADOW') fx.push({ k: 'shadow', c: col(e.color), x: e.offset.x, y: e.offset.y, r: e.radius, s: e.spread || 0 });
    else if (e.type === 'LAYER_BLUR') fx.push({ k: 'blur', r: e.radius });
  }
  if (fx.length) o.fx = fx;
  const go = [];
  for (const r of g(n, 'reactions') || []) {
    const trig = r.trigger && r.trigger.type;
    for (const a of (r.actions || (r.action ? [r.action] : []))) {
      if (!a || a.type !== 'NODE' || !a.destinationId) continue;
      go.push({ on: trig, to: a.destinationId, nav: a.navigation });
    }
  }
  if (go.length) o.go = go;

  if (n.type === 'TEXT') {
    o.tx = n.characters;
    const segs = n.getStyledTextSegments(['fontName', 'fontSize', 'fills', 'textDecoration', 'letterSpacing', 'lineHeight']);
    const base = segs.slice().sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || {};
    const fn = g(n, 'fontName') !== MIX ? g(n, 'fontName') : base.fontName;
    const fs = g(n, 'fontSize') !== MIX ? g(n, 'fontSize') : base.fontSize;
    const lh = g(n, 'lineHeight') !== MIX ? g(n, 'lineHeight') : base.lineHeight;
    const ls = g(n, 'letterSpacing') !== MIX ? g(n, 'letterSpacing') : base.letterSpacing;
    const td = g(n, 'textDecoration') !== MIX ? g(n, 'textDecoration') : base.textDecoration;
    const st = { fontFamily: fn.family, fontWeight: weightOf(fn), fontSize: fs, textAlignHorizontal: g(n, 'textAlignHorizontal') };
    const lsPx = ls ? (ls.unit === 'PERCENT' ? ls.value * fs / 100 : ls.value) : 0;
    st.letterSpacing = Math.round(lsPx * 1000) / 1000;
    st.lineHeightPx = !lh || lh.unit === 'AUTO' ? Math.round(fs * 1.21 * 100) / 100 : lh.unit === 'PERCENT' ? Math.round(lh.value * fs) / 100 : lh.value;
    if (/Italic/.test(fn.style)) st.italic = true;
    if (g(n, 'textAutoResize') && g(n, 'textAutoResize') !== 'NONE') st.textAutoResize = g(n, 'textAutoResize');
    if (g(n, 'textCase') && g(n, 'textCase') !== 'ORIGINAL' && g(n, 'textCase') !== MIX) st.textCase = g(n, 'textCase');
    if (td && td !== 'NONE') st.textDecoration = td;
    if (g(n, 'textTruncation') === 'ENDING') st.textTruncation = 'ENDING';
    if (g(n, 'maxLines')) st.maxLines = g(n, 'maxLines');
    o.st = st;
    if (segs.length > 1) {
      const key = g => JSON.stringify([g.fontName && g.fontName.style, g.fontSize, paints(g.fills), g.textDecoration]);
      const baseKey = key(base); const table = {}; const ids = {}; let next = 1;
      const ov = new Array([...n.characters].length).fill(0);
      /* characterStyleOverrides index by UTF-16 unit in REST; the renderer walks
         code points — map segment offsets (UTF-16) onto code points */
      const cpIndex = []; let u = 0; for (const ch of n.characters) { cpIndex.push(u); u += ch.length; }
      for (const g of segs) {
        const k = key(g); if (k === baseKey) continue;
        if (!ids[k]) { ids[k] = next++; const e = {}; if (g.fontName) e.fontWeight = weightOf(g.fontName); if (g.fontSize !== fs) e.fontSize = g.fontSize; const gf = paints(g.fills); if (gf.length) e.fills = gf; if (g.textDecoration && g.textDecoration !== 'NONE') e.textDecoration = g.textDecoration; table[ids[k]] = e; }
        cpIndex.forEach((off, i) => { if (off >= g.start && off < g.end) ov[i] = ids[k]; });
      }
      if (next > 1) { o.ov = ov; o.ot = table; }
    }
  }
  if ('children' in n && n.children.length) {
    const nf = g(n, 'numberOfFixedChildren') || 0; const len = n.children.length;
    const kids = [];
    n.children.forEach((c, i) => { const cc = compact(c, box, nf && i >= len - nf); if (cc) kids.push(cc); });
    if (kids.length) o.c = kids;
  }
  return o;
}

const out = {};
for (const id of IDS) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node) { out[id] = null; continue; }
  let pg = node; while (pg.type !== 'PAGE') pg = pg.parent;
  if (figma.currentPage !== pg) await figma.setCurrentPageAsync(pg);
  const c = compact(node, null, false);
  out[id] = c;
}
return JSON.stringify(out);
