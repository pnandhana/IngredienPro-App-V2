/* Figma → HTML renderer.
   Turns the compact node tree written by tools/fetch_figma.py into DOM.
   Auto-layout frames become flexbox, so content can grow (typed text, new chat
   messages) without breaking the layout. Frames without auto-layout keep their
   children at the exact x/y Figma gives them. */
const Render = (function () {
  const JUSTIFY = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
  const ALIGN = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' };

  function px(v) { return (Math.round(v * 10) / 10) + 'px'; }

  function applyBox(el, n) {
    const s = el.style;
    if (n.fill && n.fill.length) s.background = n.fill[n.fill.length - 1];
    if (n.stroke && n.stroke.length) {
      const c = n.stroke[n.stroke.length - 1];
      const w = n.individualStrokeWeights;
      const style = n.strokeDashes && n.strokeDashes.length ? 'dashed' : 'solid';
      if (w) {
        s.borderStyle = style; s.borderColor = c;
        s.borderWidth = `${w.top}px ${w.right}px ${w.bottom}px ${w.left}px`;
      } else if (n.strokeAlign === 'OUTSIDE') {
        s.outline = `${n.strokeWeight}px ${style} ${c}`;
      } else {
        s.border = `${n.strokeWeight || 1}px ${style} ${c}`;
      }
    }
    if (n.rectangleCornerRadii) s.borderRadius = n.rectangleCornerRadii.map(px).join(' ');
    else if (n.cornerRadius) s.borderRadius = px(n.cornerRadius);
    if (n.t === 'ELLIPSE') s.borderRadius = '50%';
    if (n.opacity !== undefined && n.opacity !== 1) s.opacity = n.opacity;
    if (n.fx) {
      const sh = n.fx.filter(e => e.k === 'shadow').map(e => `${e.x}px ${e.y}px ${e.r}px ${e.s}px ${e.c}`);
      if (sh.length) s.boxShadow = sh.join(',');
      const bl = n.fx.find(e => e.k === 'blur');
      if (bl) s.filter = `blur(${bl.r / 2}px)`;
    }
    if (n.clipsContent && (!n.layoutMode || n.layoutMode === 'NONE' || n.cornerRadius || (n.layoutSizingHorizontal === 'FIXED' && n.layoutSizingVertical === 'FIXED'))) s.overflow = 'hidden';
  }

  /* Size of a child, given the parent's auto-layout direction. */
  function applySize(el, n, parent) {
    const s = el.style;
    const H = n.layoutSizingHorizontal, V = n.layoutSizingVertical;
    const inFlow = parent && parent.layoutMode && parent.layoutMode !== 'NONE' && n.layoutPositioning !== 'ABSOLUTE';
    if (!inFlow) {
      // absolutely placed, or child of a plain frame: exact geometry
      if (!(n.t === 'TEXT' && n.st && n.st.textAutoResize === 'WIDTH_AND_HEIGHT')) s.width = px(n.w);
      if (!(n.t === 'TEXT' && n.st && n.st.textAutoResize !== 'NONE') && !(n.layoutMode && n.layoutMode !== 'NONE' && (n.primaryAxisSizingMode || 'AUTO') === 'AUTO' && n.layoutMode === 'VERTICAL')) s.height = px(n.h);
      else if (n.layoutMode) s.minHeight = px(n.h);
      return;
    }
    const row = parent.layoutMode === 'HORIZONTAL';
    const main = row ? H : V, cross = row ? V : H;
    const mainProp = row ? 'width' : 'height', crossProp = row ? 'height' : 'width';
    const mainVal = row ? n.w : n.h, crossVal = row ? n.h : n.w;
    // main axis
    if (main === 'FILL' || n.layoutGrow === 1) { s.flex = '1 1 0'; s[row ? 'minWidth' : 'minHeight'] = '0'; }
    else if (main === 'FIXED' || (!main && n.t !== 'TEXT' && !n.layoutMode)) { s[mainProp] = px(mainVal); s.flexShrink = '0'; }
    else { s.flex = '0 0 auto'; }
    // cross axis
    if (cross === 'FILL' || n.layoutAlign === 'STRETCH') s.alignSelf = 'stretch';
    else if (cross === 'FIXED' || (!cross && n.t !== 'TEXT' && !n.layoutMode)) s[crossProp] = px(crossVal);
    // text that wraps inside a fixed/fill width
    if (n.t === 'TEXT' && n.st) {
      const ar = n.st.textAutoResize;
      if (ar === 'HEIGHT' && H !== 'FILL' && !(row && main === 'FILL')) s.width = s.width || px(n.w);
      if (ar === 'NONE' || ar === 'TRUNCATE') { s.width = s.width || px(n.w); if (V !== 'FILL') s.height = px(n.h); }
    }
    if (n.minWidth) s.minWidth = px(n.minWidth);
    if (n.maxWidth) s.maxWidth = px(n.maxWidth);
    if (n.minHeight) s.minHeight = px(n.minHeight);
    if (n.maxHeight) s.maxHeight = px(n.maxHeight);
  }

  function applyLayout(el, n) {
    const s = el.style;
    if (!n.layoutMode || n.layoutMode === 'NONE') { s.position = s.position || 'relative'; return; }
    s.display = 'flex';
    s.flexDirection = n.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    s.justifyContent = JUSTIFY[n.primaryAxisAlignItems || 'MIN'];
    s.alignItems = ALIGN[n.counterAxisAlignItems || 'MIN'];
    if (n.primaryAxisAlignItems !== 'SPACE_BETWEEN' && n.itemSpacing) s.gap = px(n.itemSpacing);
    if (n.layoutMode === 'HORIZONTAL') el.classList.add('is-row');
    if (n.layoutWrap === 'WRAP') { s.flexWrap = 'wrap'; if (n.counterAxisSpacing) s.rowGap = px(n.counterAxisSpacing); if (n.itemSpacing) s.columnGap = px(n.itemSpacing); }
    s.padding = `${n.paddingTop || 0}px ${n.paddingRight || 0}px ${n.paddingBottom || 0}px ${n.paddingLeft || 0}px`;
    /* A page gutter drawn for 1440 (often 120px a side) eats a phone screen alive.
       Hand the numbers to the responsive layer, which caps them per breakpoint. */
    const gl = n.paddingLeft || 0, gr = n.paddingRight || 0;
    if (gl > 40 || gr > 40) {
      el.classList.add('has-gutter');
      s.setProperty('--gut-l', gl + 'px');
      s.setProperty('--gut-r', gr + 'px');
    }
    if (s.position !== 'absolute' && s.position !== 'fixed') s.position = 'relative';
  }

  const WEIGHT = w => w || 400;

  function textEl(n) {
    const el = document.createElement('div');
    const st = n.st || {};
    const s = el.style;
    s.fontFamily = `'${st.fontFamily || 'Inter'}', Inter, system-ui, sans-serif`;
    s.fontWeight = WEIGHT(st.fontWeight);
    s.fontSize = px(st.fontSize || 14);
    if (st.lineHeightPx) s.lineHeight = px(st.lineHeightPx);
    if (st.letterSpacing) s.letterSpacing = px(st.letterSpacing);
    if (st.italic) s.fontStyle = 'italic';
    if (st.textDecoration === 'UNDERLINE') s.textDecoration = 'underline';
    if (st.textCase === 'UPPER') s.textTransform = 'uppercase';
    s.textAlign = ({ LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' })[st.textAlignHorizontal || 'LEFT'];
    s.color = (n.fill && n.fill[n.fill.length - 1]) || '#111';
    /* Figma sizes this text to its content, so it never wraps at 1440. Tagged so the
       responsive layer can let it wrap (as pre-wrap, keeping the drawn spacing). */
    if (st.textAutoResize === 'WIDTH_AND_HEIGHT') { s.whiteSpace = 'pre'; el.classList.add('t-pre'); }
    else s.whiteSpace = 'pre-wrap';
    s.overflowWrap = 'anywhere';
    if (st.textTruncation === 'ENDING') {
      s.overflow = 'hidden'; s.textOverflow = 'ellipsis';
      if (!st.maxLines || st.maxLines === 1) s.whiteSpace = 'nowrap';
      else { s.display = '-webkit-box'; s.webkitBoxOrient = 'vertical'; s.webkitLineClamp = String(st.maxLines); }
    }
    if (n.opacity !== undefined && n.opacity !== 1) s.opacity = n.opacity;
    if (n.fx) { const bl = n.fx.find(e => e.k === 'blur'); if (bl) s.filter = `blur(${bl.r / 2}px)`; }
    if (n.ov && n.ot) {
      // mixed styles (e.g. bold match in a suggestion): one span per run
      let i = 0; const chars = [...n.tx];
      while (i < chars.length) {
        const key = n.ov[i] || 0; let j = i;
        while (j < chars.length && (n.ov[j] || 0) === key) j++;
        const span = document.createElement('span'); span.textContent = chars.slice(i, j).join('');
        const o = n.ot[key];
        if (key && o) {
          if (o.fontWeight) span.style.fontWeight = o.fontWeight;
          if (o.fontSize) span.style.fontSize = px(o.fontSize);
          if (o.fills && o.fills.length) span.style.color = o.fills[o.fills.length - 1];
          if (o.textDecoration === 'UNDERLINE') span.style.textDecoration = 'underline';
        }
        el.appendChild(span); i = j;
      }
    } else {
      el.textContent = n.tx;
    }
    return el;
  }

  /* A frame with no auto-layout holds its children at absolute x/y. That is exact at
     1440 and useless below it. Work out how those children would read as a flow —
     row or column, with the insets and gaps the designer actually drew — and hand the
     numbers to the responsive layer as custom properties. Frames whose children
     overlap (a scrim over an image, a badge on an avatar) are left alone. */
  function freeFlow(el, n) {
    const kids = (n.c || []).filter(c => c.w > 0 && c.h > 0);
    if (kids.length < 2 || n.w < 400) return;
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i], b = kids[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return;  // overlapping
      }
    }
    const left = Math.min(...kids.map(c => c.x));
    const top = Math.min(...kids.map(c => c.y));
    const right = n.w - Math.max(...kids.map(c => c.x + c.w));
    const bottom = n.h - Math.max(...kids.map(c => c.y + c.h));
    /* a row only if every pair shares some vertical band; one child sitting entirely
       below another means the frame reads as a column */
    let row = true;
    for (let i = 0; i < kids.length && row; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i], b = kids[j];
        if (a.y + a.h <= b.y || b.y + b.h <= a.y) { row = false; break; }
      }
    }
    let gap = 16;
    if (!row) {
      const sorted = [...kids].sort((a, b) => a.y - b.y);
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        const g = sorted[i].y - (sorted[i - 1].y + sorted[i - 1].h);
        if (g > 0) gaps.push(g);
      }
      if (gaps.length) gaps.sort((a, b) => a - b), gap = gaps[Math.floor(gaps.length / 2)];
    } else gap = 10;
    el.classList.add('is-free', row ? 'is-free-row' : 'is-free-col');
    const s = el.style;
    s.setProperty('--free-pt', Math.max(0, top) + 'px');
    s.setProperty('--free-pr', Math.max(0, right) + 'px');
    s.setProperty('--free-pb', Math.max(0, bottom) + 'px');
    s.setProperty('--free-pl', Math.max(0, left) + 'px');
    s.setProperty('--free-gap', gap + 'px');
  }

  function node(n, parent, ctx) {
    let el;
    if (n.t === 'TEXT') el = textEl(n);
    else { el = document.createElement('div'); applyLayout(el, n); applyBox(el, n); }
    el.dataset.id = n.i;
    el.dataset.name = n.n;
    el.style.boxSizing = 'border-box';
    const parentFlow = parent && parent.layoutMode && parent.layoutMode !== 'NONE';
    if (parent && (!parentFlow || n.layoutPositioning === 'ABSOLUTE')) {
      el.style.position = 'absolute'; el.style.left = px(n.x || 0); el.style.top = px(n.y || 0);
    }
    if ((n.isFixed || n.scrollBehavior === 'FIXED') && ctx && ctx.root === parent) { el.classList.add('is-fixed'); ctx.fixed.push({ el, n }); }
    applySize(el, n, parent);
    if (n.go) { el.classList.add('is-link'); ctx.links.push({ el, n }); }
    if (n.c) {
      const kids = n.c;
      // Figma draws later children on top; DOM does the same for absolutes.
      for (const c of kids) el.appendChild(node(c, n, ctx));
      if (!n.layoutMode || n.layoutMode === 'NONE') freeFlow(el, n);
    }
    return el;
  }

  /* Render a full screen. Returns { el, ctx } so the app can wire links. */
  function screen(n) {
    const ctx = { root: n, links: [], fixed: [] };
    const el = node(n, null, ctx);
    el.classList.add('screen');
    /* A root with no auto-layout is a free canvas: its children carry absolute x/y.
       Flagged so the responsive layer can let them flow instead. */
    if (!n.layoutMode || n.layoutMode === 'NONE') el.classList.add('is-canvas');
    el.style.width = px(n.w);
    if (n.layoutMode === 'VERTICAL' && (n.primaryAxisSizingMode || 'AUTO') === 'AUTO') { el.style.height = ''; el.style.minHeight = px(n.minHeight || n.h); }
    else el.style.height = px(n.h);
    return { el, ctx };
  }

  return { screen, node };
})();
