/* Pop-ups, each built from its Figma modal frame and driven by live state. */
const Modals = (function () {
  const UNITS = ['kg', 'MT', 'tonnes', 'L'];
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* gaps have to be read off the inline style: the modal body is built detached,
     so getComputedStyle has nothing to report yet */
  const gapOf = el => (el && (el.style.gap || el.style.rowGap)) || '16px';
  /* An animation that never finishes — a backgrounded tab, an interrupted frame —
     would otherwise sit on its first keyframe and hold a panel shut or a body
     invisible. These are decoration: they are cancelled the moment they are due,
     and the stylesheet owns the state at both ends. */
  function anim(el, frames, ms, easing) {
    if (!el || reduced()) return null;
    const a = el.animate(frames, { duration: ms, easing: easing || 'cubic-bezier(.22,1,.36,1)' });
    const settle = () => { try { a.cancel(); } catch (e) {} };
    a.addEventListener('finish', settle);
    setTimeout(settle, ms + 140);
    return a;
  }

  /* ------------------------------------------------------------ field errors */
  function errHost(el) { return el.closest('[data-name^="Field /"]') || el; }
  function clearErr(el) { const f = errHost(el); f.querySelectorAll('.field-err').forEach(x => x.remove()); f.classList.remove('has-err'); }
  function showErr(fld, msg) {
    if (!fld) { App.toast(msg); return; }
    fld.querySelectorAll('.field-err').forEach(x => x.remove());
    fld.classList.add('has-err');
    const e = document.createElement('div'); e.className = 'field-err'; e.setAttribute('role', 'alert'); e.textContent = msg;
    fld.appendChild(e);
    const inp = fld.querySelector('.editable') || fld.querySelector('.ip-select');
    if (inp) { inp.focus(); inp.scrollIntoView({ block: 'nearest' }); }
  }

  /* Make the text inside a Figma "Input"/"Textarea" frame typeable. */
  function field(frame, value, onInput, opts = {}) {
    if (!frame) return null;
    const ts = $.texts(frame).filter(t => !/^[⌕🔍▾×+|]$/.test(t.textContent.trim()));
    const t = ts.sort((a, b) => b.textContent.length - a.textContent.length)[0] || ts[0]; if (!t) return null;
    t.dataset.placeholder = opts.placeholder || ''; t.textContent = value || ''; t.dataset.bound = '1';
    t.setAttribute('contenteditable', 'plaintext-only'); t.classList.add('editable', 'with-placeholder');
    t.style.color = '#111111'; t.style.flex = '1 1 auto'; t.style.minWidth = '40px'; t.style.outline = 'none';
    if (opts.label) t.setAttribute('aria-label', opts.label);
    if (opts.inputmode) t.setAttribute('inputmode', opts.inputmode);
    /* the focus ring sits on the whole input frame, so a one-line text node
       inside a 48px box still reads and behaves as a single control */
    frame.classList.add('ip-input');
    t.addEventListener('focus', () => frame.classList.add('is-focus'));
    t.addEventListener('blur', () => { frame.classList.remove('is-focus'); if (opts.onBlur) opts.onBlur(t.textContent); });
    t.addEventListener('input', () => { clearErr(t); if (onInput) onInput(t.textContent); });
    if (opts.onEnter) t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); opts.onEnter(t.textContent.trim()); } });
    $.on(frame, () => t.focus());
    return t;
  }

  /* A real listbox on the Figma Unit field. Clicking it used to cycle to the next
     unit, which hides the choices and makes going back a three-click job. The
     popup is fixed-positioned, so a scrolling modal body can never clip it. */
  function select(frame, value, options, onChange, opts = {}) {
    if (!frame) return null;
    const t = $.texts(frame)[0]; if (!t) return null;
    const paint = v => { t.textContent = v + '  ▾'; };
    paint(value);
    frame.classList.add('ip-input', 'ip-select');
    frame.tabIndex = 0;
    frame.setAttribute('role', 'combobox');
    frame.setAttribute('aria-haspopup', 'listbox');
    frame.setAttribute('aria-expanded', 'false');
    frame.setAttribute('aria-label', opts.label || 'Unit');
    let pop = null, at = Math.max(0, options.indexOf(value));

    function close() {
      if (!pop) return;
      pop.remove(); pop = null;
      frame.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', away, true);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    }
    function away(e) { if (!frame.contains(e.target) && !(pop && pop.contains(e.target))) close(); }
    function pick(v) { close(); frame.focus(); if (v === value) return; value = v; paint(v); onChange(v); }
    function mark(i) {
      at = (i + options.length) % options.length;
      if (!pop) return;
      [...pop.children].forEach((o, n) => o.classList.toggle('at', n === at));
      const el = pop.children[at]; if (el) el.scrollIntoView({ block: 'nearest' });
    }
    function open() {
      if (pop) return close();
      pop = document.createElement('div');
      pop.className = 'ip-select-pop'; pop.setAttribute('role', 'listbox');
      options.forEach((v, i) => {
        const o = document.createElement('div');
        o.className = 'ip-select-opt' + (v === value ? ' on' : '');
        o.setAttribute('role', 'option'); o.setAttribute('aria-selected', String(v === value));
        const lab = document.createElement('span'); lab.textContent = v;
        const tick = document.createElement('span'); tick.className = 'ip-tick'; tick.textContent = '✓';
        o.append(lab, tick);
        o.addEventListener('mouseenter', () => mark(i));
        o.addEventListener('mousedown', e => { e.preventDefault(); pick(v); });
        pop.appendChild(o);
      });
      document.body.appendChild(pop);
      const r = frame.getBoundingClientRect(), h = pop.offsetHeight;
      pop.style.left = Math.round(Math.min(r.left, window.innerWidth - Math.max(r.width, 132) - 12)) + 'px';
      pop.style.minWidth = Math.max(r.width, 132) + 'px';
      /* flip above when there is no room below */
      pop.style.top = (h > window.innerHeight - r.bottom - 12 && r.top > h + 12 ? r.top - h - 6 : r.bottom + 6) + 'px';
      frame.setAttribute('aria-expanded', 'true');
      mark(Math.max(0, options.indexOf(value)));
      document.addEventListener('mousedown', away, true);
      document.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
    }
    $.on(frame, open);
    frame.addEventListener('keydown', e => {
      if (e.key === 'Escape' && pop) { e.stopPropagation(); close(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (pop) pick(options[at]); else open(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (pop) mark(at + (e.key === 'ArrowDown' ? 1 : -1)); else open(); return; }
      if (e.key === 'Home' && pop) { e.preventDefault(); mark(0); return; }
      if (e.key === 'End' && pop) { e.preventDefault(); mark(options.length - 1); return; }
      if (e.key === 'Tab') { close(); return; }
      if (/^[a-z]$/i.test(e.key)) { const i = options.findIndex(o => o.toLowerCase().startsWith(e.key.toLowerCase())); if (i >= 0) { if (pop) mark(i); else pick(options[i]); } }
    });
    return { close };
  }

  /* Progressive disclosure. The panel rests at height 0 and settles at height
     auto, so it always ends at its real size; the animation in between runs off
     a measured height, which a 0fr → 1fr grid cannot give us inside a flex
     column (the track collapses to zero there). */
  function reveal(nodes, gap) {
    const w = document.createElement('div'); w.className = 'ip-reveal';
    const inner = document.createElement('div'); inner.className = 'ip-reveal-in';
    if (gap) inner.style.gap = gap;
    nodes.forEach(n => inner.appendChild(n));
    w.appendChild(inner);
    return w;
  }
  function setReveal(w, on, animate) {
    if (!w) return;
    const was = w.classList.contains('open');
    w.classList.toggle('open', !!on);
    if (!animate || was === !!on || reduced() || !w.isConnected) return;
    const h = w.firstElementChild.getBoundingClientRect().height;
    if (!h) return;
    w.getAnimations().forEach(a => a.cancel());
    anim(w, on ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }]
               : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
      on ? 220 : 150, on ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.55,0,1,.45)');
  }

  const findProduct = name => SEED.PRODUCTS.find(p => p.name.toLowerCase() === (name || '').trim().toLowerCase());
  const categoryOf = name => (findProduct(name) || {}).category || Store.db.sellers.reduce((c, s) => c || (Store.sellsProduct(s, name) ? s.categories[0].name : null), null) || SEED.CAT.SPICE;

  /* Suggestions dropdown (template from Post-a-requirement typing state). */
  async function suggest(anchor, query, onPick, filter) {
    closeSuggest();
    const q = (query || '').trim().toLowerCase(); if (q.length < 2) return;
    const hits = SEED.PRODUCTS.filter(p => (p.name + ' ' + p.alias).toLowerCase().includes(q) && (!filter || filter(p))).slice(0, 6);
    const dd = await App.subtree(F.B.req, 'Suggestions dropdown'); if (!dd) return;
    const rows = [...dd.children].filter(c => c.dataset.name.startsWith('Suggestion /')); const tpl = rows[1] || rows[0];
    rows.forEach(r => r.remove());
    $.texts(dd.querySelector('[data-name="Dropdown head"]'))[0].textContent = hits.length ? `${hits.length} product${hits.length > 1 ? 's' : ''} match “${query.trim()}”` : `No products match “${query.trim()}” — press Enter to send it as typed`;
    hits.forEach((h, i) => {
      const r = $.clone(tpl); const [nm, cat] = $.texts(r);
      const idx = h.name.toLowerCase().indexOf(q);
      nm.innerHTML = ''; if (idx >= 0) { nm.append(h.name.slice(0, idx)); const b = document.createElement('b'); b.textContent = h.name.slice(idx, idx + q.length); nm.append(b, h.name.slice(idx + q.length)); } else nm.textContent = h.name;
      cat.textContent = 'in ' + h.category + (h.alias ? ' · ' + h.alias : '');
      r.style.background = i === 0 ? '#F4F4F4' : '';
      $.on(r, () => { closeSuggest(); onPick(h); });
      dd.appendChild(r);
    });
    dd.classList.add('suggest-pop'); dd.style.position = 'absolute'; dd.style.left = '0'; dd.style.right = '0'; dd.style.top = (anchor.offsetTop + anchor.offsetHeight + 6) + 'px'; dd.style.zIndex = 30; dd.style.width = 'auto';
    anchor.parentElement.style.position = 'relative'; anchor.parentElement.appendChild(dd);
  }
  function closeSuggest() { document.querySelectorAll('.suggest-pop').forEach(d => d.remove()); }

  /* ================= Send enquiry ================= */
  /* The modal is mounted once and then only its body is redrawn. It used to be
     torn down and rebuilt on every keystroke-sized change, which lost focus,
     lost scroll position and made the whole thing flicker. */
  function enquiry(opts) {
    if (Store.db.session.role === 'guest') return gate();
    const s = Store.seller(opts.sellerId) || Store.seller('annapurna');
    const st = {
      products: [{ name: opts.product || '', qty: opts.qty || '', unit: opts.unit || 'MT', notes: opts.notes || '', open: true, checked: !!opts.product, showNotes: !!opts.notes }],
      /* Opt-in, and nothing pre-ticked. Sending to four sellers instead of one
         is a commitment, so it is something you choose, not something you have
         to notice and undo. */
      similarOn: false, picked: new Set(), sending: false, pending: []
    };
    let shell = null, slot = null;
    mount();

    const short = n => String(n || '').split(/[,—(]/)[0].trim();
    const blank = p => !p.name.trim() && !String(p.qty).trim();
    /* Postel: "2,000", "2.5 MT" and " 2 " are all a quantity of 2000 / 2.5 / 2. */
    const qtyOf = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '').replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? n : null; };
    const btnTpl = () => shell && shell.querySelector('[data-name="Footer"] [data-name="Button / Cancel"]');

    /* ------------------------------------------------------------- mounting */
    async function mount() {
      shell = await App.subtree(F.B.enquiry, 'Modal / Send enquiry');
      if (!shell) return;
      /* the frame is drawn at a fixed height, which left a white tail under the
         footer on a short form — a dialog should be as tall as what is in it */
      shell.classList.add('enq-modal');
      shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-modal', 'true'); shell.setAttribute('aria-label', 'Send an enquiry to ' + s.name);
      head();
      const body = shell.querySelector('[data-name="Body"]');
      slot = document.createElement('div'); slot.className = 'enq-slot';
      slot.style.alignSelf = body.style.alignSelf || 'stretch';
      slot.style.width = body.style.width || '100%';
      body.replaceWith(slot);
      await fillBody(body);
      slot.appendChild(body);
      wireFooter(); footer();
      App.openOverlay(shell, { confirmClose: askDiscard });
      focusFirst();
    }
    /* Redraw the body only. The frame underneath changes at the 1 → 2 product
       boundary; the head and the footer stay exactly where they are. */
    async function redraw(takeFocus) {
      if (!slot) return;
      const src = await App.subtree(st.products.length > 1 ? F.B.multi : F.B.enquiry, 'Modal / Send enquiry');
      const body = src.querySelector('[data-name="Body"]');
      await fillBody(body);
      swap(body); footer();
      if (takeFocus !== false) focusFirst();
    }
    function swap(next) {
      const h0 = slot.getBoundingClientRect().height;
      $.clear(slot); slot.appendChild(next);
      if (reduced()) return;
      anim(next, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 190);
      const h1 = slot.getBoundingClientRect().height;
      if (Math.abs(h1 - h0) < 2) return;
      /* a half-applied swap used to leave the body clipped with no way to
         scroll to the rest of it */
      slot.classList.add('is-swapping');
      const done = () => slot.classList.remove('is-swapping');
      const a = anim(slot, [{ height: h0 + 'px' }, { height: h1 + 'px' }], 220);
      if (!a) return done();
      a.addEventListener('finish', done); a.addEventListener('cancel', done); setTimeout(done, 420);
    }
    async function fillBody(body) {
      st.pending = [];
      if (st.products.length > 1) multiProducts(body); else singleProduct(body);
      await Promise.all(st.pending);
      await similar(body);
    }
    /* land on the first thing still to fill in, never on a field already answered */
    function focusFirst() {
      if (!slot) return;
      const card = slot.querySelector('.is-open-product') || slot;
      const name = card.querySelector('[data-name="Field / Product or commodity *"] .editable');
      const qty = card.querySelector('[data-name="Field / Quantity *"] .editable');
      const t = name && !name.textContent.trim() ? name : (qty && !qty.textContent.trim() ? qty : null);
      if (t) t.focus();
    }
    function head() {
      const h = shell.querySelector('[data-name="Head"]');
      $.texts(h.querySelector('[data-name="Avatar"]'))[0].textContent = s.initial;
      const tt = $.texts(h.querySelector('[data-name="To"]'));
      if (tt[1]) tt[1].textContent = s.name;
      const rep = tt.find(x => /replies in/.test(x.textContent)); if (rep) rep.textContent = '· replies in ' + s.respond;
      const x = $.text(h, '×');
      if (x) { x.setAttribute('role', 'button'); x.setAttribute('aria-label', 'Close'); x.tabIndex = 0; x.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryClose(); } }); }
      $.on(x, tryClose);
    }

    /* ------------------------------------------------------------- closing */
    function tryClose() { if (askDiscard()) App.closeOverlay(); }
    /* Walking away from a half-typed enquiry used to bin it without a word. */
    function askDiscard() {
      if (st.sending) return true;
      if (!st.products.some(p => p.name.trim() || String(p.qty).trim() || p.notes.trim())) return true;
      if (st.asked) return true;
      st.asked = true;
      App.toast('Discard this enquiry? What you typed will be lost.', { label: 'Discard', fn: () => { st.products = []; App.closeOverlay(); } });
      setTimeout(() => { st.asked = false; }, 5000);
      return false;
    }

    /* --------------------------------------------------------------- fields */
    function productFields(root, p, i) {
      const pf = root.querySelector('[data-name="Field / Product or commodity *"]');
      const inp = pf.querySelector('[data-name="Input"]');
      const helper = $.texts(pf).find(t => /Filled in from|lists this product|Annapurna/.test(t.textContent));
      if (helper) {
        helper.textContent = !p.name.trim() ? 'Type a product name — matches appear as you go'
          : Store.sellsProduct(s, p.name) ? `✓ ${s.name} lists this product` : '';
        helper.classList.toggle('is-hidden', !helper.textContent);
      }
      field(inp, p.name, v => { p.name = v; p.checked = false; suggest(inp, v, h => { p.name = h.name; p.category = h.category; p.checked = true; redraw(); }); },
        { label: 'Product or commodity', placeholder: 'e.g. Turmeric Powder, Curcumin ≥5%', onEnter: v => { closeSuggest(); p.name = v; p.category = categoryOf(v); p.checked = true; redraw(); } });
      if (p.name && p.checked !== false && !Store.sellsProduct(s, p.name)) { p.blocked = true; st.pending.push(notSold(pf, p, i)); }

      const qf = root.querySelector('[data-name="Field / Quantity *"]');
      field(qf && (qf.querySelector('[data-name="Input"]') || qf.children[1]), p.qty, v => { p.qty = v.trim(); }, {
        label: 'Quantity', inputmode: 'decimal', placeholder: 'e.g. 2',
        /* checked when you leave the field, not while you are still typing */
        onBlur: v => { const n = qtyOf(v); if (String(v).trim() && n === null) showErr(qf, 'Enter a number, like 2 or 2.5'); },
        onEnter: () => { if (st.products.length > 1) saveCard(p, root); else focusSend(); }
      });

      const uf = root.querySelector('[data-name="Field / Unit *"]');
      /* changing the unit no longer redraws anything — it repaints the field and
         refreshes the one line in the footer that depends on it */
      select(uf && (uf.querySelector('[data-name="Input"]') || uf.querySelector('[data-name="Select"]') || uf.children[1]), p.unit, UNITS, v => { p.unit = v; footer(); }, { label: 'Unit' });

      notesField(root, p);
    }
    /* Notes are optional and the tallest thing on the form, so they stay folded
       away until asked for. Anything already written keeps them open. */
    function notesField(root, p) {
      const nf = root.querySelector('[data-name="Field / Notes to the seller"]'); if (!nf) return;
      const gap = gapOf(nf.parentElement);
      const link = document.createElement('button');
      link.type = 'button'; link.className = 'ip-disclose'; link.textContent = '＋  Add specs or packaging notes (optional)';
      const wrap = reveal([], gap);
      nf.replaceWith(link); link.after(wrap);
      wrap.querySelector('.ip-reveal-in').appendChild(nf);
      const ta = field(nf.querySelector('[data-name="Textarea"]'), p.notes, v => { p.notes = v; }, { label: 'Notes to the seller', placeholder: 'Specs, packaging, certificates you need…' });
      const set = (on, anim) => { p.showNotes = on; setReveal(wrap, on, anim); link.setAttribute('aria-expanded', String(on)); link.classList.toggle('is-hidden', on); };
      set(!!p.showNotes || !!p.notes.trim(), false);
      link.addEventListener('click', e => { e.preventDefault(); set(true, true); if (ta) ta.focus(); });
    }
    async function notSold(pf, p, i) {
      const pr = await App.subtree(F.B.notSold, 'Prompt / Not sold by this seller'); if (!pr) return;
      $.set(pr, /doesn’t sell/, `${s.name} doesn’t sell ${short(p.name)}`);
      $.set(pr.querySelector('[data-name="Button / Start a new enquiry"]'), /^Start a new enquiry/, `Start a new enquiry for ${short(p.name)}`);
      $.on(pr.querySelector('[data-name="Button / Start a new enquiry"]'), () => confirmSplit(p));
      $.on(pr.querySelector('[data-name="Link / Remove this product"]'), () => { if (st.products.length > 1) st.products.splice(i, 1); else p.name = ''; const last = st.products[st.products.length - 1]; if (last) last.open = true; redraw(); });
      pf.appendChild(pr); p.blocked = true;
    }

    /* ------------------------------------------------------- product plumbing */
    /* A product is finished when it has a name and a usable quantity and is not
       already on the list. Anything missing is said next to the field it is
       missing from, and the field takes focus. */
    function commit(p, card) {
      const nameF = card && card.querySelector('[data-name="Field / Product or commodity *"]');
      const qtyF = card && card.querySelector('[data-name="Field / Quantity *"]');
      if (!p.name.trim()) { showErr(nameF, 'Pick or type a product'); return false; }
      const dup = st.products.find(x => x !== p && x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (dup) { showErr(nameF, `${short(p.name)} is already product ${st.products.indexOf(dup) + 1} — edit that one instead`); return false; }
      const n = qtyOf(p.qty);
      if (n === null) { showErr(qtyF, String(p.qty).trim() ? 'Enter a number, like 2 or 2.5' : `Add a quantity for ${short(p.name)}`); return false; }
      p.qty = String(n);
      if (p.blocked) { App.toast(`${s.name} doesn’t sell ${short(p.name)} — remove it, or send it as a new enquiry`); return false; }
      return true;
    }
    function saveCard(p, card) {
      if (blank(p) && st.products.length > 1) { st.products.splice(st.products.indexOf(p), 1); redraw(false); return true; }
      if (!commit(p, card)) return false;
      p.open = false; redraw(false); return true;
    }
    /* Saving the product you are on and opening a fresh one are one gesture, so
       you can never end up with two half-filled boxes and no idea which is live. */
    function addProduct(root) {
      const cur = st.products.find(x => x.open);
      if (cur && !commit(cur, root.querySelector('.is-open-product') || root)) return;
      if (st.products.length >= 5) { App.toast('Five products is the most one enquiry can carry'); return; }
      st.products.forEach(x => { x.open = false; });
      st.products.push({ name: '', qty: '', unit: cur ? cur.unit : 'MT', notes: '', open: true, showNotes: false });
      redraw();
    }
    /* Only one product is open at a time: opening this one closes whatever was
       open, and drops it if it was never filled in. */
    function openFor(p) {
      const cur = st.products.find(x => x.open && x !== p);
      if (cur) {
        if (blank(cur)) st.products.splice(st.products.indexOf(cur), 1);
        else if (!commit(cur, slot.querySelector('.is-open-product'))) return;
        else cur.open = false;
      }
      p.open = true; redraw();
    }
    function removeProduct(i) {
      if (st.products.length < 2) return;
      const gone = st.products.splice(i, 1)[0];
      if (!st.products.some(x => x.open)) st.products[st.products.length - 1].open = true;
      redraw(false);
      App.toast(`Removed ${short(gone.name) || 'that product'}`, { label: 'Undo', fn: () => { gone.open = false; st.products.splice(i, 0, gone); redraw(false); } });
    }

    /* ---------------------------------------------------------- body layouts */
    function singleProduct(body) {
      const p = st.products[0]; p.blocked = false;
      productFields(body, p, 0);
      $.on(body.querySelector('[data-name="Button / + Add another product"]'), () => addProduct(body));
    }
    function multiProducts(body) {
      const list = body.querySelector('[data-name="Products"]');
      const hd = list.querySelector('[data-name="head"]');
      const colT = list.querySelector('[data-name="Product 1 (collapsed)"]');
      const openT = list.querySelector('[data-name="Product 2 (open)"]');
      const addRow = list.querySelector('[data-name="Add product row"]');
      const n = st.products.length;
      $.texts(hd)[0].textContent = `Products (${n})`;
      $.texts(hd)[1].textContent = `${s.name} gets one chat with ${n === 2 ? 'both' : 'all ' + n}`;
      colT.remove(); openT.remove();
      st.products.forEach((p, i) => { p.blocked = false; list.insertBefore(p.open ? openCard(openT, p, i) : summaryCard(colT, p, i), addRow); });
      const cnt = $.texts(addRow).find(x => /of 5 products/.test(x.textContent));
      if (cnt) cnt.textContent = n >= 5 ? 'Five of five — the most one enquiry can carry' : `${n} of 5 products`;
      const add = addRow.querySelector('[data-name="Button / + Add another product"]');
      if (n >= 5) { add.classList.add('is-disabled'); add.setAttribute('aria-disabled', 'true'); }
      else $.on(add, () => addProduct(list));
    }
    function summaryCard(tpl, p, i) {
      const r = $.clone(tpl); const ts = $.texts(r);
      ts[0].textContent = String(i + 1);
      ts[1].textContent = p.name;
      ts[2].textContent = `${p.qty} ${p.unit}${p.notes.trim() ? '  ·  ' + p.notes.trim() : ''}`;
      r.classList.add('product-summary'); r.tabIndex = 0; r.setAttribute('role', 'button');
      r.setAttribute('aria-label', `Edit product ${i + 1}: ${p.name}`);
      const edit = () => openFor(p);
      $.on(r, edit); $.on($.text(r, 'Edit'), edit);
      r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); } });
      $.on($.text(r, 'Remove'), () => removeProduct(i));
      return r;
    }
    function openCard(tpl, p, i) {
      const r = $.clone(tpl); r.classList.add('is-open-product');
      const hd = r.querySelector('[data-name="head"]'); const ts = $.texts(hd);
      ts[0].textContent = String(i + 1);
      ts[1].textContent = (i === 0 ? 'First' : ['Second', 'Third', 'Fourth', 'Fifth'][i - 1] || 'Next') + ' product';
      $.on($.text(hd, 'Remove'), () => removeProduct(i));
      productFields(r, p, i);
      /* The only way to finish a product used to be a 10px "Done" link tucked
         beside Remove, so people filled a box in and had nowhere to go. This is
         a real button, inside the card, under the fields it closes. */
      const t = btnTpl();
      if (t) {
        const act = document.createElement('div'); act.className = 'ip-card-actions';
        const save = $.clone(t); save.dataset.name = 'Button / Save product'; save.classList.add('ip-btn-save');
        $.texts(save)[0].textContent = 'Save product';
        save.setAttribute('role', 'button'); save.tabIndex = 0;
        save.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); saveCard(p, r); } });
        $.on(save, () => saveCard(p, r));
        act.appendChild(save); r.appendChild(act);
      }
      return r;
    }

    /* ------------------------------------------------------- similar sellers */
    /* Unticked, and folded shut. The list, the search and the counts only exist
       once you ask for them, which takes the biggest block on the form out of
       the way of the two fields that actually matter. */
    async function similar(body) {
      const sim = body.querySelector('[data-name="Similar sellers"]'); if (!sim) return;
      const ready = st.products.filter(p => p.name.trim());
      const cands = Store.db.sellers.filter(x => x.id !== s.id && ready.length && ready.every(p => Store.sellsProduct(x, p.name)));
      const hidden = Store.db.sellers.filter(x => x.id !== s.id && ready.length && ready.some(p => Store.sellsProduct(x, p.name)) && !cands.includes(x));
      [...st.picked].forEach(id => { if (!cands.find(c => c.id === id)) st.picked.delete(id); });
      const can = cands.length > 0;
      if (!can) st.similarOn = false;

      const toggle = sim.querySelector('[data-name="Toggle row"]');
      const cb = toggle.querySelector('[data-name="Checkbox"]');
      const paintCb = (el, on, dim) => {
        if (!el) return;
        el.style.background = on ? '#111111' : '#ffffff';
        el.style.border = on ? '' : '1.5px solid ' + (dim ? '#d0d0d0' : '#aaaaaa');
        const tk = $.text(el, '✓'); if (tk) tk.style.visibility = on ? 'visible' : 'hidden';
      };
      const ct = $.texts(toggle.querySelector('[data-name="Copy"]'));
      if (ct[1]) ct[1].textContent = !ready.length ? 'Add a product first and we’ll show who else sells it.'
        : !can ? `No other verified seller lists ${ready.length > 1 ? 'all of these products' : 'this product'} yet.`
          : ready.length > 1 ? `Only sellers who sell ${ready.length === 2 ? 'both' : 'all ' + ready.length} products. Each gets it separately and can’t see the others.`
            : 'Each seller gets it separately and can’t see the others.';

      const wrap = reveal([...sim.children].filter(c => c !== toggle), gapOf(sim));
      sim.appendChild(wrap);
      paintCb(cb, st.similarOn, !can);
      toggle.setAttribute('role', 'checkbox');
      toggle.setAttribute('aria-checked', String(st.similarOn));
      toggle.classList.toggle('is-disabled', !can);
      toggle.tabIndex = can ? 0 : -1;
      setReveal(wrap, st.similarOn, false);
      if (can) {
        const flip = () => {
          st.similarOn = !st.similarOn;
          /* opting in means "yes, these sellers too" — so they come pre-selected,
             each one named, counted and individually removable. The rows are
             repainted here or the ticks disagree with the count above them. */
          if (st.similarOn && !st.picked.size) { cands.forEach(c => st.picked.add(c.id)); paintRows(''); }
          paintCb(cb, st.similarOn, false);
          toggle.setAttribute('aria-checked', String(st.similarOn));
          setReveal(wrap, st.similarOn, true);
          counts();
        };
        $.on(toggle, flip);
        toggle.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
      }

      const rowsBox = sim.querySelector('[data-name="Seller rows"]');
      const lh = sim.querySelector('[data-name="List head"]');
      const search = sim.querySelector('[data-name="Search wrap"]');
      const hn = sim.querySelector('[data-name="Hidden note"]');
      const chips = sim.querySelector('[data-name="Matching products"]');
      /* one chip per product, so it is obvious what the list was filtered by */
      if (chips) { const tpl = chips.children[0]; $.clear(chips); ready.forEach(p => { const c = tpl.cloneNode(true); $.texts(c)[0].textContent = short(p.name).slice(0, 32); chips.appendChild(c); }); chips.classList.toggle('is-hidden', ready.length < 2); }
      /* a search box over four rows is clutter; it earns its place past six */
      if (search) search.classList.toggle('is-hidden', cands.length <= 6);
      if (hn) { if (hidden.length && ready.length > 1) hn.textContent = `${hidden.length} similar seller${hidden.length > 1 ? 's' : ''} hidden — ${hidden.map(h => h.name).slice(0, 2).join(', ')} ${hidden.length > 1 ? 'don’t' : 'doesn’t'} sell every product.`; else hn.remove(); }
      if (!rowsBox) return;
      const tpl = rowsBox.children[0];
      const paintRows = q => {
        $.clear(rowsBox);
        const show = cands.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
        if (!show.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = `No seller here matches “${q}”`; rowsBox.appendChild(e); return; }
        show.forEach(c => {
          const r = $.clone(tpl); const ts = $.texts(r);
          const nm = ts.find(t => t.textContent.trim().length > 3 && !/years active|Sells/.test(t.textContent)); if (nm) nm.textContent = c.name;
          const sub = ts.find(t => /years active/.test(t.textContent)); if (sub) sub.textContent = `${c.city}, ${c.state} · ${c.years} years active`;
          /* the initial (or logo) goes in the avatar — not the first one-letter
             text node, which is the checkbox's ✓ */
          const box = r.querySelector('[data-name="Checkbox"]') || r.children[0];
          const av = r.querySelector('[data-name="avatar"], [data-name="Avatar"]')
            || ts.map(t => t.parentElement).find(pa => pa !== r && !(box && box.contains(pa)) && $.texts(pa).length === 1 && $.texts(pa)[0].textContent.trim().length === 1);
          if (av) Photo.paint(av, Store.photo('seller:' + c.id), c.initial);
          const pill = r.querySelector('[data-name="Pill / Sells both"]');
          if (pill && ready.length < 2) pill.remove(); else if (pill && ready.length > 2) $.texts(pill)[0].textContent = 'Sells all';
          paintCb(box, st.picked.has(c.id));
          r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', String(st.picked.has(c.id))); r.tabIndex = 0;
          const hit = () => { if (st.picked.has(c.id)) st.picked.delete(c.id); else st.picked.add(c.id); paintCb(box, st.picked.has(c.id)); r.setAttribute('aria-checked', String(st.picked.has(c.id))); counts(); };
          $.on(r, hit);
          r.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hit(); } });
          rowsBox.appendChild(r);
        });
      };
      paintRows('');
      if (search && cands.length > 6) field(search.querySelector('[data-name="Search"]') || search, '', v => paintRows(v.trim()), { label: 'Search these sellers', placeholder: 'Search these sellers' });
      const selAll = lh && $.text(lh, 'Select all');
      if (selAll) $.on(selAll, () => { if (st.picked.size === cands.length) st.picked.clear(); else cands.forEach(c => st.picked.add(c.id)); paintRows(''); counts(); });
      function counts() {
        if (lh) $.texts(lh)[0].textContent = `${st.picked.size} of ${cands.length} selected`;
        if (selAll) selAll.textContent = st.picked.size && st.picked.size === cands.length ? 'Clear all' : 'Select all';
        footer();
      }
      counts();
    }

    /* --------------------------------------------------------------- footer */
    function wireFooter() {
      const f = shell.querySelector('[data-name="Footer"]');
      $.on(f.querySelector('[data-name="Button / Send enquiry"]'), () => {
        const extra = st.similarOn ? st.picked.size : 0;
        const c = submit(); if (!c) return;
        App.toast(`Enquiry sent to ${s.name}${extra ? ` + ${extra} similar seller${extra > 1 ? 's' : ''}` : ''}`);
        App.go('/myenq/' + c.id + '?enq=' + c.lastEnq);
      });
      $.on(f.querySelector('[data-name="Button / Cancel"]'), tryClose);
    }
    function focusSend() { const b = shell && shell.querySelector('[data-name="Button / Send enquiry"]'); if (b) { b.tabIndex = 0; b.focus(); } }
    function footer() {
      const f = shell && shell.querySelector('[data-name="Footer"]'); if (!f) return;
      const extra = st.similarOn ? st.picked.size : 0, n = 1 + extra;
      const blocked = st.products.some(p => p.blocked);
      const t = $.texts(f)[0];
      if (blocked) t.textContent = `Remove the product ${s.name} doesn’t sell, or send it as a new enquiry`;
      else {
        /* a second enquiry to the same seller joins the chat you already have */
        const existing = Store.pairConv(Store.db.accounts.buyer.id, s.id);
        const np = st.products.filter(p => p.name.trim()).length;
        t.textContent = (np > 1 ? `${np} products · ` : '')
          + (existing ? `Adds a new enquiry to your chat with ${s.name}` + (extra ? ` · +${extra} similar seller${extra > 1 ? 's' : ''}` : '')
            : `${n} seller${n > 1 ? 's' : ''} · one chat per seller in My enQ`);
      }
      const send = f.querySelector('[data-name="Button / Send enquiry"]');
      const off = blocked || st.sending;
      send.classList.toggle('is-disabled', off);
      send.setAttribute('aria-disabled', String(off));
      $.texts(send)[0].textContent = st.sending ? 'Sending…' : 'Send enquiry';
    }

    /* -------------------------------------------------------------- sending */
    function payload(list) { return list.map(p => ({ name: p.name.trim(), qty: String(qtyOf(p.qty) || p.qty).trim(), unit: p.unit, notes: p.notes.trim(), category: p.category || categoryOf(p.name) })); }
    function submit(list) {
      if (st.sending) return null;
      closeSuggest();
      /* a product box left completely blank is ignored rather than blocking Send */
      if (!list && st.products.length > 1) st.products = st.products.filter(p => !blank(p));
      const items = list || st.products;
      if (!items.length) { App.toast('Add a product before sending'); return null; }
      const card = slot && slot.querySelector('.is-open-product');
      for (const p of items) if (!commit(p, p.open ? (card || slot) : null)) return null;
      st.sending = true; footer();
      const products = payload(items);
      const main = Store.sendEnquiry({ sellerIds: [s.id], products, type: 'direct' })[0];
      if (st.similarOn && st.picked.size) Store.sendEnquiry({ sellerIds: [...st.picked], products, type: 'similar' });
      st.products = [];
      App.closeOverlay(); sessionStorage.removeItem('ip.carry');
      return main;
    }
    async function confirmSplit(p) {
      const keep = st.products.filter(x => x !== p && x.name.trim());
      if (!keep.length) { const q = short(p.name); st.products = []; App.closeOverlay(); App.go('/find?q=' + encodeURIComponent(q)); return; }
      const d = await App.subtree(F.B.confirm, 'Dialog / Send and start new');
      const blocks = [...d.querySelector('[data-name="Summary"]').children];
      const t0 = $.texts(blocks[0]);
      t0[1].textContent = keep.map(x => `${short(x.name)} · ${x.qty} ${x.unit}`).join(' + ');
      t0[2].textContent = `to ${s.name}${st.similarOn && st.picked.size ? ' + ' + st.picked.size + ' similar seller' + (st.picked.size > 1 ? 's' : '') : ''}`;
      $.texts(blocks[1])[1].textContent = `${p.name} · ${p.qty || '—'} ${p.unit}`;
      $.on(d.querySelector('[data-name="Button / Keep editing"]'), () => mount());
      $.on(d.querySelector('[data-name="Button / Send & start new enquiry"]'), () => {
        const carry = { name: p.name, qty: p.qty, unit: p.unit, notes: p.notes, sentTo: s.name };
        if (!submit(keep)) return;
        sessionStorage.setItem('ip.carry', JSON.stringify(carry));
        App.go('/find?q=' + encodeURIComponent(short(p.name)) + '&carry=1');
      });
      App.openOverlay(d);
    }
  }

  /* ================= Decline / close with a reason ================= */
  /* Decline or close one enquiry. Without `enq`, the oldest waiting one (decline)
     or the first active one (close). */
  async function reasons({ mode, conv, enq }) {
    const r = Store.db.session.role;
    const e = enq || (mode === 'decline' ? conv.enquiries.find(x => x.status === 'pending') : conv.enquiries.find(x => x.status === 'active'));
    if (!e) return;
    const screen = mode === 'decline' ? F.S.decline : r === 'seller' ? F.S.close : F.B.close;
    const m = await App.subtree(screen, mode === 'decline' ? 'Modal / Decline this enquiry?' : 'Modal / Close this enquiry?');
    const other = r === 'buyer' ? Store.seller(conv.sellerId) : Store.buyer(conv.buyerId);
    const head = m.querySelector('[data-name="Head"]'); $.texts(head)[1].textContent = `${other.name} · ${e.id} · ${Enq.eLine(e)} · ${Enq.eQty(e)}`;
    $.on($.text(head, '×'), () => App.closeOverlay());
    const list = m.querySelector('[data-name="Reasons (single choice)"]'); const rows = [...list.children];
    const otherRow = rows.find(x => /Other/.test(x.dataset.name)); const otherField = otherRow.querySelector('[data-name="Field / Other reason"]');
    let chosen = null, detail = '';
    const plain = rows.find(x => !/Other/.test(x.dataset.name));
    const paint = () => rows.forEach(row => { const on = row._reason === chosen; row.style.background = on ? '#F7F7F7' : ''; const dot = row.querySelector('[data-name="radio"]'); if (dot) { dot.style.border = on ? '5px solid #111111' : '1.5px solid #aaaaaa'; } const lbl = $.texts(row.querySelector('[data-name="line"]'))[0]; if (lbl) lbl.style.fontWeight = on ? 600 : 400; if (row === otherRow) otherField.classList.toggle('is-hidden', !(on)); });
    rows.forEach(row => { row._reason = $.texts(row.querySelector('[data-name="line"]'))[0].textContent.trim(); $.on(row.querySelector('[data-name="line"]'), () => { chosen = row._reason; paint(); if (chosen === 'Other') setTimeout(() => ta && ta.focus(), 30); }); });
    const ta = field(otherField.querySelector('[data-name="Textarea"]'), '', v => { detail = v; cnt(); }, { placeholder: 'Tell them why' });
    const counter = $.texts(otherField).find(t => /\/ 300/.test(t.textContent)); function cnt() { if (counter) counter.textContent = `${detail.length} / 300 · required when “Other” is selected`; }
    cnt(); paint();
    const f = m.querySelector('[data-name="Footer"]');
    $.on(f.querySelector('[data-name="Button / Cancel"]'), () => App.closeOverlay());
    const cta = f.querySelector('[data-name="Button / Decline enquiry"], [data-name="Button / Close enquiry"]');
    $.on(cta, () => {
      if (!chosen) return App.toast('Pick a reason');
      if (chosen === 'Other' && !detail.trim()) return App.toast('Add a short reason for “Other”');
      if (mode === 'decline') Store.decline(conv.id, e.id, chosen, chosen === 'Other' ? detail.trim() : ''); else Store.close(conv.id, e.id, r, chosen, chosen === 'Other' ? detail.trim() : '');
      App.closeOverlay(); App.toast(mode === 'decline' ? e.id + ' declined' : e.id + ' closed'); App.refresh();
    });
    App.openOverlay(m);
  }

  /* ================= Guest sign-up gate ================= */
  async function gate() {
    const m = await App.subtree(F.G.gate, 'Gate modal');
    $.on(m.querySelector('[data-name*="Create a buyer account"], [data-name="Btn / Create a buyer account"]') || $.text(m, 'Create a buyer account'), () => App.go('/register/buyer'));
    $.on($.text(m, /I already have an account/), () => App.go('/login'));
    $.on($.text(m, 'Register as a seller'), () => App.go('/register/seller'));
    $.on($.text(m, '×'), () => App.closeOverlay());
    App.openOverlay(m);
  }

  /* ================= Buyer notifications dropdown ================= */
  async function notificationsDropdown(bell) {
    const dd = await App.subtree(F.B.notifDrop, 'Dropdown / Notifications'); if (!dd) return App.go('/notifications');
    Notif.fill(dd, true);
    const rect = bell.getBoundingClientRect();
    App.openOverlay(dd, { anchor: { top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) } });
  }

  return { enquiry, reasons, gate, notificationsDropdown, field, suggest, closeSuggest };
})();
document.addEventListener('click', e => { if (!e.target.closest('.suggest-pop') && !e.target.closest('.editable')) Modals.closeSuggest(); });
