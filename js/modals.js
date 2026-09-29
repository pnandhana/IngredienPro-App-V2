/* Pop-ups, each built from its Figma modal frame and driven by live state. */
const Modals = (function () {
  const UNITS = ['MT', 'kg', 'tonnes', 'L'];

  /* Make the text inside a Figma "Input"/"Textarea" frame typeable. */
  function field(frame, value, onInput, opts = {}) {
    if (!frame) return null;
    const ts = $.texts(frame).filter(t => !/^[⌕🔍▾×+|]$/.test(t.textContent.trim()));
    const t = ts.sort((a, b) => b.textContent.length - a.textContent.length)[0] || ts[0]; if (!t) return null;
    t.dataset.placeholder = opts.placeholder || ''; t.textContent = value || ''; t.dataset.bound = '1';
    t.setAttribute('contenteditable', 'plaintext-only'); t.classList.add('editable', 'with-placeholder');
    t.style.color = '#111111'; t.style.flex = '1 1 auto'; t.style.minWidth = '40px'; t.style.outline = 'none';
    t.addEventListener('input', () => onInput && onInput(t.textContent));
    if (opts.onEnter) t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); opts.onEnter(t.textContent.trim()); } });
    $.on(frame, () => t.focus());
    return t;
  }
  function unitPicker(frame, value, onChange) {
    if (!frame) return; const t = $.texts(frame).find(x => /^(MT|kg|tonnes|L)$/.test(x.textContent.trim())) || $.texts(frame)[0];
    if (t) t.textContent = value;
    $.on(frame, () => { const n = UNITS[(UNITS.indexOf(value) + 1) % UNITS.length]; onChange(n); });
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
    $.texts(dd.querySelector('[data-name="Dropdown head"]'))[0].textContent = hits.length ? `${hits.length} product${hits.length > 1 ? 's' : ''} match “${query.trim()}”` : `No products match “${query.trim()}” — try another name`;
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
  function enquiry(opts) {
    if (Store.db.session.role === 'guest') return gate();
    const s = Store.seller(opts.sellerId) || Store.seller('annapurna');
    const st = { products: [{ name: opts.product || '', qty: opts.qty || '', unit: opts.unit || 'MT', notes: opts.notes || '', open: true, checked: !!opts.product }], similarOn: true, picked: null, q: '' };
    draw();

    async function draw() {
      const multi = st.products.length > 1;
      const m = await App.subtree(multi ? F.B.multi : F.B.enquiry, 'Modal / Send enquiry');
      // head
      const head = m.querySelector('[data-name="Head"]');
      $.texts(head.querySelector('[data-name="Avatar"]'))[0].textContent = s.initial;
      const to = head.querySelector('[data-name="To"]'); const tt = $.texts(to); if (tt[1]) tt[1].textContent = s.name; const rep = tt.find(x => /replies in/.test(x.textContent)); if (rep) rep.textContent = '· replies in ' + s.respond;
      $.on($.text(head, '×'), () => App.closeOverlay());
      const body = m.querySelector('[data-name="Body"]');
      st.pending = [];
      if (!multi) singleProduct(body); else multiProducts(body);
      await Promise.all(st.pending);
      await similar(body);
      footer(m);
      const box = App.openOverlay(m);
      const first = box.querySelector('.editable'); if (first && !first.textContent) first.focus();
    }

    function productFields(root, p, i) {
      const pf = root.querySelector('[data-name="Field / Product or commodity *"]');
      const inp = pf.querySelector('[data-name="Input"]');
      const helper = $.texts(pf).find(t => /Filled in from|lists this product|Annapurna/.test(t.textContent));
      const setHelper = () => { if (!helper) return; if (!p.name) helper.textContent = 'Start typing to pick a product'; else if (Store.sellsProduct(s, p.name)) helper.textContent = `✓ ${s.name} lists this product`; else helper.textContent = ''; };
      field(inp, p.name, v => { p.name = v; p.checked = false; suggest(inp, v, h => { p.name = h.name; p.category = h.category; p.checked = true; draw(); }); }, { placeholder: 'e.g. Turmeric Powder, Curcumin ≥5%', onEnter: v => { p.name = v; p.category = categoryOf(v); p.checked = true; draw(); } });
      setHelper();
      // product this seller doesn't list → prompt
      if (p.name && p.checked !== false && !Store.sellsProduct(s, p.name) && st.products.length > 0) { p.blocked = true; st.pending.push(notSold(pf, p, i)); }
      const q = root.querySelector('[data-name="Field / Quantity *"]'); field(q && (q.querySelector('[data-name="Input"]') || q.children[1]), p.qty, v => p.qty = v.trim(), { placeholder: 'e.g. 2' });
      const u = root.querySelector('[data-name="Field / Unit *"]'); unitPicker(u && (u.querySelector('[data-name="Select"]') || u.children[1]), p.unit, v => { p.unit = v; draw(); });
      const n = root.querySelector('[data-name="Field / Notes to the seller"]'); field(n && n.querySelector('[data-name="Textarea"]'), p.notes, v => p.notes = v, { placeholder: 'Specs, packaging, documents you need…' });
    }
    async function notSold(pf, p, i) {
      const pr = await App.subtree(F.B.notSold, 'Prompt / Not sold by this seller'); if (!pr) return;
      const short = p.name.split(/[,—(]/)[0].trim();
      $.set(pr, /doesn’t sell/, `${s.name} doesn’t sell ${short}`);
      $.set(pr.querySelector('[data-name="Button / Start a new enquiry"]'), /^Start a new enquiry/, `Start a new enquiry for ${short}`);
      $.on(pr.querySelector('[data-name="Button / Start a new enquiry"]'), () => confirmSplit(p));
      $.on(pr.querySelector('[data-name="Link / Remove this product"]'), () => { if (st.products.length > 1) st.products.splice(i, 1); else { p.name = ''; } st.products[st.products.length - 1].open = true; draw(); });
      pf.appendChild(pr); p.blocked = true;
    }
    function singleProduct(body) {
      const p = st.products[0]; p.blocked = false; productFields(body, p, 0);
      $.on(body.querySelector('[data-name="Button / + Add another product"]'), () => { if (!validate(p)) return; p.open = false; st.products.push({ name: '', qty: '', unit: p.unit, notes: '', open: true }); draw(); });
    }
    function multiProducts(body) {
      const list = body.querySelector('[data-name="Products"]'); const head = list.querySelector('[data-name="head"]');
      const colT = list.querySelector('[data-name="Product 1 (collapsed)"]'), openT = list.querySelector('[data-name="Product 2 (open)"]'), addRow = list.querySelector('[data-name="Add product row"]');
      $.texts(head)[0].textContent = `Products (${st.products.length})`; $.texts(head)[1].textContent = `Each seller gets one chat with ${st.products.length === 2 ? 'both' : 'all'} products`;
      colT.remove(); openT.remove();
      st.products.forEach((p, i) => {
        p.blocked = false;
        if (!p.open) {
          const r = $.clone(colT); const ts = $.texts(r); ts[0].textContent = String(i + 1); ts[1].textContent = p.name; ts[2].textContent = `${p.qty} ${p.unit}${p.notes ? '  ·  ' + p.notes : ''}`;
          $.on($.text(r, 'Edit'), () => { st.products.forEach(x => x.open = false); p.open = true; draw(); });
          $.on($.text(r, 'Remove'), () => { st.products.splice(i, 1); if (!st.products.some(x => x.open)) st.products[st.products.length - 1].open = true; draw(); });
          list.insertBefore(r, addRow);
        } else {
          const r = $.clone(openT); const ts = $.texts(r.querySelector('[data-name="head"]')); ts[0].textContent = String(i + 1); ts[1].textContent = i === 0 ? 'First product' : ['Second', 'Third', 'Fourth', 'Fifth'][i - 1] + ' product';
          $.on($.text(r.querySelector('[data-name="head"]'), 'Remove'), () => { st.products.splice(i, 1); st.products[st.products.length - 1].open = true; draw(); });
          list.insertBefore(r, addRow); productFields(r, p, i);
        }
      });
      const cnt = $.texts(addRow).find(x => /of 5 products/.test(x.textContent)); if (cnt) cnt.textContent = `${st.products.length} of 5 products`;
      const add = addRow.querySelector('[data-name="Button / + Add another product"]');
      if (st.products.length >= 5) add.style.opacity = 0.4;
      $.on(add, () => { const cur = st.products.find(x => x.open); if (cur && !validate(cur)) return; if (st.products.length >= 5) return; st.products.forEach(x => x.open = false); st.products.push({ name: '', qty: '', unit: cur ? cur.unit : 'MT', notes: '', open: true }); draw(); });
    }
    async function similar(body) {
      const sim = body.querySelector('[data-name="Similar sellers"]'); if (!sim) return;
      const ready = st.products.filter(p => p.name);
      const cands = Store.db.sellers.filter(x => x.id !== s.id && ready.length && ready.every(p => Store.sellsProduct(x, p.name)));
      const hidden = Store.db.sellers.filter(x => x.id !== s.id && ready.length && ready.some(p => Store.sellsProduct(x, p.name)) && !cands.includes(x));
      if (!st.picked) st.picked = new Set(cands.slice(0, 3).map(x => x.id)); else [...st.picked].forEach(id => { if (!cands.find(c => c.id === id)) st.picked.delete(id); });
      const cb = sim.querySelector('[data-name="Toggle row"] [data-name="Checkbox"]');
      const paintCb = (el, on) => { if (!el) return; el.style.background = on ? '#111111' : '#ffffff'; el.style.border = on ? '' : '1.5px solid #aaaaaa'; const tk = $.text(el, '✓'); if (tk) tk.style.visibility = on ? 'visible' : 'hidden'; };
      paintCb(cb, st.similarOn); $.on(sim.querySelector('[data-name="Toggle row"]'), () => { st.similarOn = !st.similarOn; draw(); });
      const rowsBox = sim.querySelector('[data-name="Seller rows"]'); const tpl = rowsBox && rowsBox.children[0];
      const lh = sim.querySelector('[data-name="List head"]'); const search = sim.querySelector('[data-name="Search wrap"]');
      const hn = sim.querySelector('[data-name="Hidden note"]'); const chips = sim.querySelector('[data-name="Matching products"]');
      if (chips) { const ct = chips.children[0]; $.clear(chips); ready.forEach(p => { const c = ct.cloneNode(true); $.texts(c)[0].textContent = p.name.split(',')[0].slice(0, 32); chips.appendChild(c); }); }
      const copy = sim.querySelector('[data-name="Toggle row"] [data-name="Copy"]'); if (copy && ready.length > 1) $.texts(copy)[1].textContent = `Showing only sellers who sell ${ready.length === 2 ? 'both' : 'all'} products. Each seller gets it separately and can’t see the others.`;
      [lh, search, rowsBox && rowsBox.parentElement, chips].forEach(x => { if (x) x.classList.toggle('is-hidden', !(st.similarOn && cands.length)); });
      if (!rowsBox) return;
      $.clear(rowsBox);
      const draw1 = q => { $.clear(rowsBox); cands.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase())).forEach(c => {
        const r = $.clone(tpl); const ts = $.texts(r); const av = r.querySelector('[data-name="avatar"], [data-name="Avatar"]');
        const nm = ts.find(t => t.textContent.trim().length > 3 && !/years active|Sells/.test(t.textContent)); if (nm) nm.textContent = c.name;
        const sub = ts.find(t => /years active/.test(t.textContent)); if (sub) sub.textContent = `${c.city}, ${c.state} · ${c.years} years active`;
        const ini = ts.find(t => t.textContent.trim().length === 1 && t !== nm); if (ini) ini.textContent = c.initial;
        const pill = r.querySelector('[data-name="Pill / Sells both"]'); if (pill && ready.length < 2) pill.remove(); else if (pill && ready.length > 2) $.texts(pill)[0].textContent = 'Sells all';
        const box = r.querySelector('[data-name="Checkbox"]') || r.children[0]; paintCb(box, st.picked.has(c.id));
        $.on(r, () => { st.picked.has(c.id) ? st.picked.delete(c.id) : st.picked.add(c.id); paintCb(box, st.picked.has(c.id)); counts(); });
        rowsBox.appendChild(r); }); };
      draw1('');
      if (search) field(search.querySelector('[data-name="Search"]') || search, '', v => draw1(v.trim()), { placeholder: 'Search these sellers' });
      const selAll = lh && $.text(lh, 'Select all'); $.on(selAll, () => { cands.forEach(c => st.picked.add(c.id)); draw1(''); counts(); });
      if (hn) { if (hidden.length && ready.length > 1) hn.textContent = `${hidden.length} similar seller${hidden.length > 1 ? 's' : ''} hidden — ${hidden.map(h => h.name).slice(0, 2).join(', ')} ${hidden.length > 1 ? 'don’t' : 'doesn’t'} sell every product.`; else hn.remove(); }
      if (!cands.length && ready.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = 'No other verified sellers list ' + (ready.length > 1 ? 'all of these products' : 'this product') + ' yet.'; sim.appendChild(e); }
      function counts() { if (lh) $.texts(lh)[0].textContent = `${st.picked.size} of ${cands.length} ${ready.length > 1 ? 'sellers ' : ''}selected`; footer(sim.closest('[data-name="Modal / Send enquiry"]')); }
      counts();
    }
    function footer(m) {
      const f = m.querySelector('[data-name="Footer"]'); if (!f) return;
      const extra = st.similarOn ? st.picked ? st.picked.size : 0 : 0; const n = 1 + extra; const blocked = st.products.some(p => p.blocked);
      const t = $.texts(f)[0];
      if (blocked) t.textContent = 'Remove the product this seller doesn’t sell, or send it as a new enquiry';
      else t.textContent = st.products.length > 1 ? `${st.products.length} products · ${n} seller${n > 1 ? 's' : ''} · one chat per seller in My enQ` : `${n} enquir${n > 1 ? 'ies' : 'y'} · each appears as its own chat in My enQ`;
      const send = f.querySelector('[data-name="Button / Send enquiry"]'); send.style.opacity = blocked ? 0.4 : 1;
      $.on(send, () => { const c = submit(); if (c) { App.toast(`Enquiry sent to ${s.name}${st.similarOn && st.picked && st.picked.size ? ' + ' + st.picked.size + ' similar seller' + (st.picked.size > 1 ? 's' : '') : ''}`); App.go('/myenq/' + c.id); } });
      $.on(f.querySelector('[data-name="Button / Cancel"]'), () => App.closeOverlay());
    }
    function validate(p) { if (!p.name.trim()) { App.toast('Add a product first'); return false; } if (!String(p.qty).trim()) { App.toast('Add a quantity for ' + p.name.split(',')[0]); return false; } return true; }
    function payload(list) { return list.map(p => ({ name: p.name.trim(), qty: String(p.qty).trim(), unit: p.unit, notes: p.notes.trim(), category: p.category || categoryOf(p.name) })); }
    function submit(list) {
      const items = list || st.products;
      if (!list && st.products.some(p => p.blocked)) return App.toast('Resolve the product this seller doesn’t sell first');
      for (const p of items) if (!validate(p)) return;
      const products = payload(items);
      const main = Store.sendEnquiry({ sellerIds: [s.id], products, type: 'direct' })[0];
      if (st.similarOn && st.picked && st.picked.size) Store.sendEnquiry({ sellerIds: [...st.picked], products, type: 'similar' });
      App.closeOverlay(); sessionStorage.removeItem('ip.carry');
      return main;
    }
    async function confirmSplit(p) {
      const keep = st.products.filter(x => x !== p && x.name);
      if (!keep.length) { const q = p.name; App.closeOverlay(); App.go('/find?q=' + encodeURIComponent(q.split(/[,—(]/)[0].trim())); return; }
      const d = await App.subtree(F.B.confirm, 'Dialog / Send and start new');
      const sum = d.querySelector('[data-name="Summary"]'); const blocks = [...sum.children];
      const t0 = $.texts(blocks[0]); t0[1].textContent = keep.map(x => `${x.name.split(',')[0]} · ${x.qty} ${x.unit}`).join(' + '); t0[2].textContent = `to ${s.name}${st.similarOn && st.picked.size ? ' + ' + st.picked.size + ' similar seller' + (st.picked.size > 1 ? 's' : '') : ''}`;
      const t1 = $.texts(blocks[1]); t1[1].textContent = `${p.name} · ${p.qty || '—'} ${p.unit}`;
      $.on(d.querySelector('[data-name="Button / Keep editing"]'), () => draw());
      $.on(d.querySelector('[data-name="Button / Send & start new enquiry"]'), () => {
        for (const x of keep) if (!validate(x)) return;
        submit(keep);
        sessionStorage.setItem('ip.carry', JSON.stringify({ name: p.name, qty: p.qty, unit: p.unit, notes: p.notes, sentTo: s.name }));
        App.go('/find?q=' + encodeURIComponent(p.name.split(/[,—(]/)[0].trim()) + '&carry=1');
      });
      App.openOverlay(d);
    }
  }

  /* ================= Post a requirement ================= */
  function requirement() {
    if (Store.db.session.role === 'guest') return gate();
    const st = { product: '', category: '', qty: '', unit: 'MT', notes: '' };
    draw();
    async function draw() {
      const picked = !!st.category;
      const m = await App.subtree(picked ? F.B.reqPicked : F.B.req, 'Modal / Post a requirement');
      m.querySelectorAll('[data-name="Suggestions dropdown"]').forEach(x => x.remove());
      $.on($.text(m.querySelector('[data-name="Head"]'), '×'), () => App.closeOverlay());
      const pf = m.querySelector('[data-name="Field / Product or commodity *"]'); const inp = pf.querySelector('[data-name="Input"]');
      field(inp, st.product, v => { st.product = v; st.category = ''; suggest(inp, v, h => { st.product = h.name; st.category = h.category; draw(); }); }, { placeholder: 'Start typing a product — e.g. turmeric' });
      const cat = pf.querySelector('[data-name="Detected category"]');
      if (cat && picked) { const pill = cat.querySelector('[data-name^="Pill /"]'); $.texts(pill)[0].textContent = st.category; $.on($.text(cat, 'Change'), () => { st.category = ''; draw(); }); }
      const q = m.querySelector('[data-name="Field / Quantity *"]'); field(q && (q.querySelector('[data-name="Input"]') || q.children[1]), st.qty, v => st.qty = v.trim(), { placeholder: 'e.g. 2' });
      const u = m.querySelector('[data-name="Field / Unit *"]'); unitPicker(u && (u.querySelector('[data-name="Select"]') || u.children[1]), st.unit, v => { st.unit = v; draw(); });
      const n = m.querySelector('[data-name="Field / Requirement details"]'); field(n && n.querySelector('[data-name="Textarea"]'), st.notes, v => st.notes = v, { placeholder: 'Specs, packaging, delivery location and date…' });
      const count = picked ? Store.db.sellers.filter(s => s.categories.some(c => c.name === st.category)).length : 0;
      const who = m.querySelector('[data-name="Who receives this"]');
      if (who) { const c = who.querySelector('[data-name="count"]'); $.texts(c)[0].textContent = picked ? `${count} sellers` : '— sellers'; const line = $.texts(who).find(t => /receive this|see how many/.test(t.textContent)); if (line) line.textContent = picked ? `verified sellers in ${st.category} will receive this` : 'Pick a product to see how many sellers will receive this'; }
      const f = m.querySelector('[data-name="Footer"]'); $.texts(f)[0].textContent = picked ? `Sent to ${count} sellers · replies arrive in My enQ` : 'Pick a product to continue';
      const post = f.querySelector('[data-name="Button / Post requirement"]'); post.style.opacity = picked ? 1 : 0.4;
      $.on(post, () => { if (!picked) return App.toast('Pick a product from the list first'); if (!st.qty) return App.toast('Add a quantity'); const r = Store.postRequirement({ product: st.product, qty: st.qty, unit: st.unit, notes: st.notes.trim(), category: st.category }); posted(r); });
      $.on(f.querySelector('[data-name="Button / Cancel"]'), () => App.closeOverlay());
      const box = App.openOverlay(m); const e = box.querySelector('.editable'); if (e && !st.product) e.focus();
    }
    async function posted(r) {
      const m = await App.subtree(F.B.reqPosted, 'Modal / Requirement posted');
      $.set(m, /^Sent to \d+ verified sellers/, `Sent to ${r.sellerIds.length} verified sellers in ${r.category}. When a seller accepts, a chat opens in My enQ — usually within a few hours.`);
      const sum = m.querySelector('[data-name="Summary"]');
      [...sum.children].forEach(row => { const [k, v] = $.texts(row); const key = k.textContent.trim(); if (key === 'Product') v.textContent = r.product; if (key === 'Quantity') v.textContent = `${r.qty} ${r.unit}`; if (key === 'Category') v.textContent = r.category; if (key === 'Open until') { const d = new Date(Date.now() + 14 * 864e5); v.textContent = d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' }) + ' ' + d.getFullYear(); } });
      $.on(m.querySelector('[data-name="Button / Go to My enQ"]'), () => App.go('/myenq'));
      $.on(m.querySelector('[data-name="Button / Done"]'), () => App.closeOverlay());
      App.openOverlay(m);
    }
  }

  /* ================= Decline / close with a reason ================= */
  async function reasons({ mode, conv }) {
    const r = Store.db.session.role;
    const screen = mode === 'decline' ? F.S.decline : r === 'seller' ? F.S.close : F.B.close;
    const m = await App.subtree(screen, mode === 'decline' ? 'Modal / Decline this enquiry?' : 'Modal / Close this enquiry?');
    const other = r === 'buyer' ? Store.seller(conv.sellerId) : Store.buyer(conv.buyerId);
    const head = m.querySelector('[data-name="Head"]'); $.texts(head)[1].textContent = `${other.name} · ${Enq.prodLine(conv)} · ${conv.products.map(p => p.qty + ' ' + p.unit).join(' + ')}`;
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
      if (mode === 'decline') Store.decline(conv.id, chosen, chosen === 'Other' ? detail.trim() : ''); else Store.close(conv.id, r, chosen, chosen === 'Other' ? detail.trim() : '');
      App.closeOverlay(); App.toast(mode === 'decline' ? 'Enquiry declined' : 'Enquiry closed'); App.refresh();
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

  return { enquiry, requirement, reasons, gate, notificationsDropdown, field, suggest, closeSuggest };
})();
document.addEventListener('click', e => { if (!e.target.closest('.suggest-pop') && !e.target.closest('.editable')) Modals.closeSuggest(); });
