/* IngredienPro — interactive app.
   Screens are rendered from the Figma FINAL frames (render.js). Each route picks
   the right frame for the current role, then a page controller (pages-*.js)
   replaces the sample content with live data from the Store and turns buttons
   into real actions. Any Figma link a controller doesn't take over is mapped
   to the matching app route, so nothing is a dead end. */
const Screens = {};
function SCREEN(n) { Screens[n.i] = n; }

/* ---------- DOM helpers used by every controller ---------- */
const $ = {
  one: (root, name) => root.querySelector(`[data-name="${CSS.escape(name)}"]`),
  all: (root, name) => [...root.querySelectorAll(`[data-name="${CSS.escape(name)}"]`)],
  starts: (root, prefix) => [...root.querySelectorAll(`[data-name^="${CSS.escape(prefix)}"]`)],
  texts: root => [...root.querySelectorAll('div')].filter(d => (!d.children.length || [...d.children].every(c => c.tagName === 'SPAN')) && d.textContent.trim()),
  text(root, match) {
    return $.texts(root).find(d => { const t = d.textContent.trim(); return match instanceof RegExp ? match.test(t) : t === match || t.startsWith(match); });
  },
  set(root, match, value) { const t = typeof match === 'string' || match instanceof RegExp ? $.text(root, match) : match; if (t) t.textContent = value; return t; },
  clone(el) { const c = el.cloneNode(true); c.classList.remove('is-link'); c.querySelectorAll('.is-link').forEach(x => x.classList.remove('is-link')); c.querySelectorAll('[data-override]').forEach(x => delete x.dataset.override); return c; },
  on(el, fn) { if (!el) return; el.dataset.override = '1'; el.style.cursor = 'pointer'; el.classList.add('is-action'); el.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); fn(e); }); },
  hide(el) { if (el) el.style.display = 'none'; },
  show(el, d) { if (el) el.style.display = d || ''; },
  clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); },
  ago(iso) {
    const d = new Date(iso), n = new Date(); const s = (n - d) / 1000;
    if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400 && d.getDate() === n.getDate()) return Math.floor(s / 3600) + 'h ago';
    if (s < 172800) return 'Yesterday'; return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' });
  },
  time: iso => new Date(iso).toTimeString().slice(0, 5),
  day: iso => { const d = new Date(iso), n = new Date(); if (d.toDateString() === n.toDateString()) return 'Today'; return d.getDate() + ' ' + d.toLocaleString('en', { month: 'long' }) + ' ' + d.getFullYear(); }
};

/* ---------- app ---------- */
const App = (function () {
  const stage = () => document.getElementById('stage');
  let fixedEls = [], page = null, overlay = null;

  function load(id) {
    return new Promise((ok, fail) => {
      if (Screens[id]) return ok(Screens[id]);
      const s = document.createElement('script');
      s.src = 'screens/' + id.replace(':', '-') + '.js';
      s.onload = () => Screens[id] ? ok(Screens[id]) : fail(new Error('empty ' + id));
      s.onerror = () => fail(new Error('missing ' + id));
      document.head.appendChild(s);
    });
  }
  /* Breakpoints. The screens are drawn at 1440; below that they reflow rather than
     shrink, so type stays readable. `zoom` is kept at 1 and only survives as a helper
     because scroll maths and overlays used to divide by it. */
  const BP = { phone: 760, nav: 900, tablet: 1100 };
  const zoom = () => 1;
  function mode() {
    /* the width the app actually has, which is the window minus the flow sidebar —
     the same measurement the container queries in responsive.css use */
    const st = stage();
    const w = (st && st.clientWidth) || window.innerWidth;
    return w < BP.phone ? 'phone' : w < BP.tablet ? 'tablet' : 'desktop';
  }
  function setMode() {
    const m = mode();
    if (document.documentElement.dataset.mode !== m) {
      document.documentElement.dataset.mode = m;
      document.dispatchEvent(new CustomEvent('modechange', { detail: m }));
    }
    return m;
  }

  async function renderScreen(id) { const n = await load(id); return Render.screen(n); }
  /* Render one named subtree of a Figma frame (e.g. a modal) as live DOM. */
  async function subtree(screenId, name) {
    const n = await load(screenId);
    const find = x => x.n === name ? x : (x.c || []).reduce((r, c) => r || find(c), null);
    const node = find(n); if (!node) return null;
    const ctx = { root: null, links: [], fixed: [] };
    const el = Render.node(node, null, ctx);
    el.style.position = 'relative'; el.style.left = ''; el.style.top = '';
    wireLinks(ctx);
    return el;
  }

  /* ---------- Figma link → app ---------- */
  function wireLinks(ctx) {
    for (const { el, n } of ctx.links) {
      el.addEventListener('click', e => {
        if (el.dataset.override) return;
        if (e.target.closest('[contenteditable="plaintext-only"]')) return;
        e.stopPropagation();
        for (const g of n.go) {
          if (g.nav === 'NAVIGATE') { followFrame(g.to, el); return; }
          if (g.nav === 'SCROLL_TO') { const t = document.querySelector(`#stage [data-id="${g.to}"]`); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 140 * zoom(), behavior: 'smooth' }); }
          if (g.nav === 'CHANGE_TO') activateTab(el);
        }
      });
    }
  }
  function followFrame(frameId, el) {
    const r = Routes.fromFrame(frameId, el);
    if (typeof r === 'function') return r();
    if (r) return go(r);
    go('/s/' + frameId.replace(':', '-'));
  }
  function activateTab(tab) {
    [...tab.parentElement.children].forEach(t => {
      const on = t === tab;
      t.style.borderBottom = on ? '2px solid #111111' : '0 solid transparent';
      t.querySelectorAll('div').forEach(x => { if (!x.children.length) { x.style.fontWeight = on ? 600 : 400; x.style.color = on ? '#111111' : '#767676'; } });
    });
  }

  /* ---------- fixed header / sidebar ---------- */
  function layoutFixed() {
    const z = zoom(); const st = stage().querySelector('.screen'); if (!st) return;
    const top = st.getBoundingClientRect().top + window.scrollY;
    const scrolled = Math.max(0, (window.scrollY - top) / z);
    for (const f of fixedEls) { f.el.style.top = Math.min(f.n.y + scrolled, st.offsetHeight - f.n.h) + 'px'; f.el.style.zIndex = 50; }
  }

  /* ---------- routing ---------- */
  const history = [];
  let goingBack = false;
  function path() { return (location.hash.replace(/^#/, '') || '/'); }
  function go(p) { closeOverlay(); if (path() === p) show(); else location.hash = '#' + p; }
  function back() { if (history.length > 1) { history.pop(); goingBack = true; go(history.pop()); } else go('/'); }

  async function show() {
    closeOverlay();
    const p = path();
    const r = Routes.resolve(p);
    if (r.redirect) { location.replace('#' + r.redirect); return; }
    if (r.custom) {
      const el = r.custom(r.params || {});
      stage().innerHTML = ''; stage().appendChild(el);
      el.classList.add('enter');
      el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
      setMode(); fixedEls = []; page = { el, route: r, params: r.params || {} };
      window.scrollTo(0, 0);
      document.title = (r.title ? r.title + ' — ' : '') + 'IngredienPro';
      RoleBar.update();
      return;
    }
    let out;
    /* only show the loading bar if the fetch is actually slow enough to notice */
    const slow = setTimeout(() => stage().classList.add('loading'), 180);
    try { out = await renderScreen(r.screen); }
    catch (e) { clearTimeout(slow); stage().classList.remove('loading'); stage().innerHTML = `<div class="app-msg">Couldn't load this screen (${r.screen}).</div>`; return; }
    clearTimeout(slow); stage().classList.remove('loading');
    const { el, ctx } = out;
    el.querySelectorAll('[data-name="Profile section tabs"] > [data-name^="Tab /"]').forEach(tb => tb.addEventListener('click', () => activateTab(tb)));
    stage().innerHTML = ''; stage().appendChild(el);
    el.classList.add('enter'); if (goingBack) el.classList.add('enter-back');
    el.addEventListener('animationend', () => el.classList.remove('enter', 'enter-back'), { once: true });
    goingBack = false;
    if (history[history.length - 1] !== p) history.push(p);
    if (history.length > 30) history.shift();
    setMode();
    fixedEls = ctx.fixed;
    wireLinks(ctx);
    page = { el, route: r, params: r.params || {}, screen: r.screen };
    try { Chrome.apply(el, r); } catch (e) { console.error(e); }
    if (r.controller) { try { await r.controller(el, r.params || {}, r); } catch (e) { console.error(e); } }
    Behaviour.apply(el, r.screen);
    try { Responsive.apply(el, r); } catch (e) { console.error(e); }
    if (!r.keepScroll) { window.scrollTo(0, 0); requestAnimationFrame(() => window.scrollTo(0, 0)); }
    layoutFixed();
    document.title = (r.title ? r.title + ' — ' : '') + 'IngredienPro';
    RoleBar.update();
  }

  /* ---------- overlays (pop-ups rendered from Figma modal frames) ---------- */
  function openOverlay(el, opts = {}) {
    closeOverlay({ instant: true });   // never animate one overlay out under another
    const wrap = document.createElement('div'); wrap.className = 'overlay' + (opts.anchor ? ' is-anchored' : '');
    const scrim = document.createElement('div'); scrim.className = 'overlay-scrim';
    const box = document.createElement('div'); box.className = 'overlay-box';
    box.appendChild(el); wrap.appendChild(scrim); wrap.appendChild(box);
    if (opts.anchor) { box.style.top = opts.anchor.top + 'px'; box.style.right = opts.anchor.right + 'px'; }
    scrim.addEventListener('click', () => { if (opts.onClose) opts.onClose(); closeOverlay(); });
    document.body.appendChild(wrap); document.body.classList.add('has-overlay');
    overlay = { wrap, opts };
    document.onkeydown = e => { if (e.key === 'Escape' && overlay) { if (opts.onClose) opts.onClose(); closeOverlay(); } };
    return box;
  }
  function closeOverlay(opts) {
    document.querySelectorAll('.overlay.is-closing').forEach(o => o.remove());
    if (!overlay) return;
    const wrap = overlay.wrap;
    overlay = null;
    document.body.classList.remove('has-overlay');
    if ((opts && opts.instant) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { wrap.remove(); return; }
    wrap.classList.add('is-closing');
    setTimeout(() => wrap.remove(), 150);
  }
  function refresh() { if (page) show(); }

  function toast(text, action) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'toast'; const s = document.createElement('span'); s.textContent = text; t.appendChild(s);
    if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { action.fn(); t.remove(); }; t.appendChild(b); }
    document.body.appendChild(t); setTimeout(() => t.classList.add('in'), 10); setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 4500);
  }

  window.addEventListener('hashchange', show);
  window.addEventListener('scroll', layoutFixed, { passive: true });
  window.addEventListener('resize', () => { setMode(); layoutFixed(); });
  Store.subscribe(kind => { if (kind === 'sync' || kind === 'reset') refresh(); else RoleBar.update(); });

  return { start: show, go, refresh, subtree, renderScreen, openOverlay, closeOverlay, toast, page: () => page, zoom, mode, BP, load, activateTab, path, back, layoutFixed };
})();

/* The Guest / Buyer / Seller tabs and the flow list live in js/flownav.js, which
   defines RoleBar. */

document.addEventListener('DOMContentLoaded', () => {
  const as = new URLSearchParams(location.search).get('as');   // deep link: ?as=buyer|seller|guest
  if (as && ['guest', 'buyer', 'seller'].includes(as) && Store.db.session.role !== as) Store.setRole(as);
  RoleBar.update(); App.start();
});
