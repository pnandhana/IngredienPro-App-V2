/* Page controllers: bind each Figma-rendered page to live data. */
const Pages = {};

/* ---------- small shared bits ---------- */
const U = {
  role: () => Store.db.session.role,
  guestGate() { Modals.gate(); },
  sellerByName(text) { return Store.db.sellers.find(s => text && text.includes(s.name)); },
  /* Any seller card on any page: Send enquiry, shortlist and open-profile work. */
  bindSellerCards(root) {
    root.querySelectorAll('[data-name^="Supplier / "], [data-name^="Seller card"], [data-name^="Shortlisted seller / "], [data-name^="Seller row / "]').forEach(card => {
      if (card.dataset.bound) return;
      const s = Store.db.sellers.find(x => card.dataset.sellerId === x.id) || U.sellerByName(card.dataset.name) || U.sellerByName(card.textContent);
      if (s) card.dataset.sellerId = s.id;
      U.bindCardActions(card, s);
    });
  },
  /* A guest sees that a seller exists, not who it is. The identity is blurred rather
     than blanked, so the listing still reads as real and the gate has something to
     promise. Nothing is unblurred client-side: the blur sits on the placeholder the
     masking already leaves behind, so no real name, logo or contact ever reaches the
     DOM for a guest — per the anti-scraping rule in the SRS. */
  maskSellerIdentity(root) {
    if (U.role() !== 'guest') return;
    root.querySelectorAll([
      '[data-name="name"]', '[data-name="logo"]', '[data-name="identity"]',
      '[data-name="Seller name"]', '[data-name="avatar"]', '[data-name="contact"]',
      '[data-name="Verified seller name"]', '[data-name="trust"]'
    ].join(',')).forEach(p => p.classList.add('guest-blur'));
    /* seller names drawn into the Figma snapshot (home, how it works) are static
       text, so blur them where they sit */
    root.querySelectorAll('[data-name^="Supplier / "], [data-name^="Seller card"], [data-name^="Seller row / "]')
      .forEach(c => { const t = c.querySelector('[data-name="name"], [data-name="Seller name"]'); if (t) t.classList.add('guest-blur'); });
  },
  bindCardActions(card, s) {
    card.dataset.bound = '1';
    const guest = U.role() === 'guest';
    U.maskSellerIdentity(card);
    $.on(card, () => guest ? U.guestGate() : App.go('/seller/' + (s ? s.id : 'srilakshmi')));
    card.querySelectorAll('[data-name="Btn / Send enquiry"], [data-name="Button / Send enquiry"]').forEach(b => $.on(b, () => guest ? U.guestGate() : Modals.enquiry(Object.assign({ sellerId: s ? s.id : null }, U.carry()))));
    const sl = card.querySelector('[data-name="Btn / Shortlist"], [data-name^="Btn / Remove from shortlist"], [data-name="Btn / Shortlist seller"]');
    if (sl && s) { U.shortlistButton(sl, s.id); }
  },
  shortlistButton(btn, sid) {
    const paint = () => {
      if (U.role() !== 'buyer') return;
      const on = (Store.db.shortlists[Store.db.accounts.buyer.id] || []).includes(sid);
      const t = $.texts(btn).find(x => /Shortlist|♡|♥/.test(x.textContent)); if (!t) return;
      if (/Shortlist seller/.test(t.textContent) || /Shortlisted seller/.test(t.textContent)) t.textContent = on ? '♥  Shortlisted' : '♡  Shortlist seller';
      else if (t.textContent.trim().length <= 2) t.textContent = on ? '♥' : '♡';
      else t.textContent = on ? '♥  Shortlisted' : '♡  Shortlist';
    };
    paint();
    $.on(btn, () => {
      if (U.role() === 'guest') return U.guestGate();
      const added = Store.toggleShortlist(sid); paint();
      App.toast(added ? 'Added to Shortlists' : 'Removed from Shortlists', { label: 'View', fn: () => App.go('/shortlists') });
    });
  },
  carry() { try { return JSON.parse(sessionStorage.getItem('ip.carry')) || {}; } catch (e) { return {}; } },
  searchBox(root, onSubmit, initial) {
    const block = root.querySelector('[data-name="Search bar"]'); if (!block) return;
    const input = block.querySelector('[data-name="Input"]');
    const txt = input && $.texts(input).filter(t => t.textContent.trim().length > 2).pop();
    if (txt) {
      txt.setAttribute('contenteditable', 'plaintext-only'); txt.classList.add('editable'); txt.dataset.placeholder = txt.textContent; txt.dataset.bound = '1';
      txt.textContent = initial || ''; txt.classList.add('with-placeholder'); txt.style.minWidth = '300px'; txt.style.color = '#111111';
      txt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(txt.textContent.trim()); } });
      $.on(input, () => txt.focus());
    }
    const btn = block.querySelector('[data-name="Btn / Search"]');
    $.on(btn, () => onSubmit(txt ? txt.textContent.trim() : ''));
    root.querySelectorAll('[data-name="Popular searches"] [data-name="Chip"]').forEach(ch => $.on(ch, () => onSubmit(ch.textContent.trim())));
    return txt;
  }
};

/* ---------- public pages ---------- */
Pages.home = el => {
  U.searchBox(el, q => App.go('/find?q=' + encodeURIComponent(q)));
  el.querySelectorAll('[data-name^="Tile /"], [data-name^="Category tile"], [data-name^="Card / Category"]').forEach(t => $.on(t, () => App.go('/categories')));
  U.bindSellerCards(el);
};
Pages.categories = el => {
  /* The subcategory card is the product page now — the form chooser it replaced
     used to send you to one page per form. Form is a filter on the destination. */
  el.querySelectorAll('[data-name^="Card / "]').forEach(c => $.on(c, () => App.go('/product')));

  /* Range dropdown ("Ingredients & packaging" / "Finished foods"), closed until asked for. */
  const trig = el.querySelector('[data-name="Dropdown / Range"]');
  const menu = el.querySelector('[data-name="Menu / Range"]');
  if (trig && menu) {
    const host = menu.parentElement;
    host.style.position = 'relative';
    Object.assign(menu.style, { position: 'absolute', top: '56px', left: '0', zIndex: '40', display: 'none' });
    const close = () => { menu.style.display = 'none'; };
    $.on(trig, () => {
      const opening = menu.style.display === 'none';
      menu.style.display = opening ? '' : 'none';
      if (opening) setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    });
    menu.addEventListener('click', e => e.stopPropagation());
    /* Finished foods has no category list yet, so choosing it just closes the menu */
    menu.querySelectorAll('[data-name^="Item / "]').forEach(it => $.on(it, close));
  }
  U.bindSellerCards(el);
};
Pages.product = el => { U.bindSellerCards(el); };
Pages.how = el => { U.bindSellerCards(el); };
Pages.help = (el, p) => {
  const topics = { 'Getting started': 'getting-started', 'Enquiries & My enQ': 'enquiries', 'Verification & documents': 'verification', 'Subscriptions & billing': 'billing', 'Account & login': 'account', 'Safety & privacy': 'safety' };
  el.querySelectorAll('[data-name^="Nav / "]').forEach(n => { const k = n.dataset.name.replace('Nav / ', '').replace(' (active)', ''); if (topics[k]) $.on(n, () => App.go('/help/' + topics[k])); });
  el.querySelectorAll('[data-name^="Previous / "], [data-name^="Next / "]').forEach(n => { const k = n.dataset.name.replace(/^(Previous|Next) \/ /, ''); if (topics[k]) $.on(n, () => App.go('/help/' + topics[k])); });
  el.querySelectorAll('[data-name^="Section link / "]').forEach(n => $.on(n, () => { const h = $.text(el.querySelector('[data-name="Article"]') || el, n.textContent.trim()); if (h) window.scrollTo({ top: h.getBoundingClientRect().top + scrollY - 140, behavior: 'smooth' }); }));
  el.querySelectorAll('[data-name^="Btn / Yes"], [data-name^="Btn / No"]').forEach(b => $.on(b, () => App.toast('Thanks for the feedback')));
};

/* ---------- Find a Seller: live list, search, filters ---------- */
Pages.find = (el, p) => {
  const guest = U.role() === 'guest';
  const list = el.querySelector('[data-name="Seller list"]'); if (!list) return;
  const tpl = list.children[0]; const state = { q: p.q || '', filters: new Set(p.cat ? [p.cat] : []) };
  const txt = U.searchBox(el, q => { state.q = q; draw(); }, state.q);

  // filters: every "opt" row toggles
  const opts = [...el.querySelectorAll('[data-name="Filter rail"] [data-name="opt"]')];
  opts.forEach(o => {
    const label = $.texts(o)[0] ? $.texts(o)[0].textContent.trim() : '';
    const cb = o.querySelector('[data-name="cb"]');
    const paint = () => { const on = state.filters.has(label); if (cb) { cb.style.background = on ? '#111111' : '#ffffff'; cb.style.borderColor = on ? '#111111' : '#c4c4c4'; } };
    o.dataset.filter = label; paint(); o._paint = paint;
    $.on(o, () => { state.filters.has(label) ? state.filters.delete(label) : state.filters.add(label); draw(); });
  });

  const applied = el.querySelector('[data-name="Applied filters"]');
  const chipTpl = applied && applied.querySelector('[data-name^="Chip / "]');
  const clearAll = applied && $.text(applied, 'Clear all');
  $.on(clearAll, () => { state.filters.clear(); state.q = ''; if (txt) txt.textContent = ''; draw(); });

  function match(s) {
    const q = state.q.toLowerCase();
    const hay = (s.name + ' ' + s.products.join(' ') + ' ' + s.categories.map(c => c.name).join(' ') + ' ' + s.city + ' ' + s.state).toLowerCase();
    if (q && !q.split(/\s*[\/,]\s*|\s+/).filter(Boolean).some(w => w.length > 2 && hay.includes(w.toLowerCase()))) return false;
    for (const f of state.filters) {
      const inCat = s.categories.some(c => c.name === f), inCert = s.certs.some(c => f.toLowerCase().startsWith(c.toLowerCase().split(' ')[0]) || c.toLowerCase().includes(f.toLowerCase().split(' ')[0])), isType = s.type === f || (f === 'Trader / distributor' && /Trader|Exporter/.test(s.type)), yrs = /years/.test(f) ? ((f.startsWith('20') && s.years >= 20) || (f.startsWith('10') && s.years >= 10 && s.years < 20) || (f.startsWith('5') && s.years >= 5 && s.years < 10) || (f.startsWith('Under') && s.years < 5)) : false, resp = /hour/.test(f) ? parseInt(s.respond.replace(/\D/g, '') || 9) <= parseInt(f) : false;
      if (!(inCat || inCert || isType || yrs || resp)) return false;
    }
    return true;
  }
  function fill(row, s) {
    row.dataset.sellerId = s.id; delete row.dataset.bound;
    const nameT = row.querySelector('[data-name="name"]') && $.texts(row.querySelector('[data-name="name"]'))[0];
    if (nameT && !guest) nameT.textContent = s.name;
    if (!guest) Photo.paint(row.querySelector('[data-name="logo"]'), Store.photo('seller:' + s.id), s.initial);   // guests see masked sellers, logo included
    const badges = row.querySelector('[data-name="badges"]'); if (badges) { const t = $.texts(badges); if (t[1]) t[1].textContent = s.type; }
    const idn = row.querySelector('[data-name="identity"]');
    const loc = idn && $.texts(idn).find(x => /yrs$/.test(x.textContent.trim())); if (loc) loc.textContent = (guest ? s.state : s.city + ', ' + s.state) + '  ·  ' + s.years + ' yrs';
    const trust = row.querySelector('[data-name="trust"]'); if (trust) { const t = $.texts(trust); if (t[0]) t[0].textContent = `★ ${s.rating}  (${s.deals} deals)`; if (t[1]) t[1].textContent = 'Responds ' + s.respond; }
    const certs = row.querySelector('[data-name="certs"]'); if (certs) { const pill = certs.children[0]; $.clear(certs); s.certs.forEach(c => { const p = pill.cloneNode(true); $.texts(p)[0].textContent = c; certs.appendChild(p); }); }
    const tiles = row.querySelector('[data-name="tiles"]'); if (tiles) { const tile = tiles.children[0]; $.clear(tiles); s.categories.slice(0, 3).forEach(c => { const t = tile.cloneNode(true); const ts = $.texts(t); ts[ts.length - 2].textContent = c.name; ts[ts.length - 1].textContent = c.count + ' products'; tiles.appendChild(t); }); }
    const head = row.querySelector('[data-name="Categories sold"] [data-name="head"]'); if (head) $.texts(head)[0].textContent = `Sells in ${s.categories.length} ${s.categories.length > 1 ? 'categories' : 'category'}`;
    U.bindCardActions(row, s);
  }
  function draw() {
    const res = Store.db.sellers.filter(s => !s.isNew || true).filter(match);
    $.clear(list);
    res.forEach(s => { const r = $.clone(tpl); fill(r, s); list.appendChild(r); });
    Store.trackSearch(res.map(s => s.id));   // feeds "Search appearances" on each seller's dashboard
    if (!res.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = 'No sellers match. Try another product name or clear the filters.'; list.appendChild(e); }
    $.set(el, /verified sellers$|sellers sell /, `${res.length} verified seller${res.length === 1 ? '' : 's'}`);
    $.set(el, /^Showing /, `Showing ${res.length ? 1 : 0}–${res.length} of ${res.length} sellers`);
    opts.forEach(o => o._paint && o._paint());
    if (applied) {
      [...applied.querySelectorAll('[data-name^="Chip / "]')].forEach(c => c.remove());
      const labels = [...state.filters].concat(state.q ? ['“' + state.q + '”'] : []);
      applied.classList.toggle('is-hidden', !(labels.length));
      labels.forEach(l => { const c = chipTpl.cloneNode(true); $.texts(c)[0].textContent = l; $.on(c, () => { if (l.startsWith('“')) { state.q = ''; if (txt) txt.textContent = ''; } else state.filters.delete(l); draw(); }); applied.insertBefore(c, clearAll); });
    }
    if (p.gate && guest) { p.gate = null; setTimeout(U.guestGate, 50); }
  }
  draw();
  // arrived here after "Send & start new enquiry": confirm the first one, carry the product over
  if (p.carry) {
    const c = U.carry();
    Tpl.get(F.B.findNew, 'Banner / Enquiry sent').then(b => {
      if (!b || !c.name) return; const ts = $.texts(b);
      if (ts[1]) ts[1].textContent = `Enquiry sent to ${c.sentTo} — your other products are on their way`;
      if (ts[2]) ts[2].textContent = `Now pick sellers for ${c.name.split(/[,—(]/)[0].trim()}. Your quantity${c.qty ? ' (' + c.qty + ' ' + c.unit + ')' : ''} and notes are saved for the next enquiry.`;
      $.on($.text(b, /View in My enQ/), () => App.go('/myenq'));
      el.insertBefore(b, el.children[1]);
    });
  } else sessionStorage.removeItem('ip.carry');
};

/* ---------- Seller profile (buyer view) ---------- */
Pages.profile = (el, p) => {
  const s = Store.seller(p.id) || Store.seller('srilakshmi');
  Store.trackView(s.id);   // feeds "Profile views" on the seller's dashboard
  SellerFace.apply(el, s);  // logo + storefront cover
  const card = el.querySelector('[data-name="Profile card"]');
  if (card) {
    $.set(card, 'Sri Lakshmi Spice Mills', s.name);
    $.set(card, /^Manufacturer\s+·/, `${s.type}  ·  ${s.city}, ${s.state}  ·  Trading since ${2026 - s.years}  ·  Member since 2024`);
    $.set(card, /^★/, '★ ' + s.rating); $.set(card, /rated deals$/, s.deals + ' rated deals'); $.set(card, /^~\d/, s.respond.replace('~', '~'));
    $.on(card.querySelector('[data-name="Btn / Send enquiry"]'), () => Modals.enquiry({ sellerId: s.id }));
    const sl = card.querySelector('[data-name="Btn / Shortlist seller"]'); if (sl) U.shortlistButton(sl, s.id);
  }
  // every other mention of the sample seller on the page
  $.texts(el).forEach(t => { if (t.textContent.includes('Sri Lakshmi Spice Mills')) t.textContent = t.textContent.replace(/Sri Lakshmi Spice Mills/g, s.name); });
  // categories chips + products from data
  const chips = el.querySelector('[data-name="Category filter"]');
  if (chips) { const tpl = chips.children[1] || chips.children[0]; const all = chips.children[0]; [...chips.children].slice(1).forEach(c => c.remove()); $.texts(all)[0].textContent = 'All  ' + s.products.length; s.categories.forEach(c => { const x = tpl.cloneNode(true); $.texts(x)[0].textContent = c.name + '  ' + c.count; chips.appendChild(x); }); }
  const grid = el.querySelector('[data-name="Product grid"]');
  if (grid) {
    const row = grid.children[0], card0 = row.children[0]; $.clear(grid);
    const prods = s.products.map(n => SEED.PRODUCTS.find(x => x.name === n) || { name: n, category: s.categories[0].name });
    for (let i = 0; i < prods.length; i += 3) {
      const r = row.cloneNode(false); r.style.cssText = row.style.cssText;
      prods.slice(i, i + 3).forEach(pr => { const c = card0.cloneNode(true); const ts = $.texts(c); ts[0].textContent = pr.category.toUpperCase(); ts[1].textContent = pr.name; const moq = ts.find(x => /MT$|kg$/.test(x.textContent.trim())); if (moq) moq.textContent = /Powder|Flakes/.test(pr.name) ? '500 kg' : '1 MT'; $.on(c.querySelector('[data-name="Btn / Send enquiry"]'), () => Modals.enquiry({ sellerId: s.id, product: pr.name })); r.appendChild(c); });
      while (r.children.length < 3) { const f = card0.cloneNode(true); f.style.visibility = 'hidden'; r.appendChild(f); }
      grid.appendChild(r);
    }
  }
  $.set(el, /products across|products in \d/, `${s.products.length} products across ${s.categories.length} categories. Enquire to get price, availability and lead time.`);
  $.set(el, /^View all \d+ products/, `View all ${s.products.length} products  →`);
  const back = el.querySelector('[data-name="Link / Back to results"]'); $.on(back, () => App.go('/find'));
};

/* Every frame in the file, grouped by its Figma section — the browsable index of
   the whole wireframe. Screens the app does not route to are still rendered here,
   read-only, at /s/<id>. */
Pages.screenIndex = function () {
  const wrap = document.createElement('div');
  wrap.className = 'index-page';
  const sections = {};
  for (const [id, meta] of Object.entries(MANIFEST.screens)) {
    (sections[meta.section] || (sections[meta.section] = [])).push({ id, ...meta });
  }
  const total = Object.keys(MANIFEST.screens).length;
  const head = document.createElement('header');
  head.innerHTML = `<h1>Every screen</h1><p>All ${total} finalised frames, rendered as HTML. `
    + `Open one to see it on its own, or use the Guest / Buyer / Seller tabs to walk the app properly.</p>`;
  wrap.appendChild(head);

  const order = Object.keys(sections).sort();
  for (const name of order) {
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = name;
    const count = document.createElement('span');
    count.className = 'ix-count';
    count.textContent = sections[name].length;
    h.appendChild(count);
    sec.appendChild(h);
    const list = document.createElement('div');
    list.className = 'ix-grid stagger';
    sections[name]
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
      .forEach(s => {
        const a = document.createElement('a');
        a.className = 'ix-card';
        a.href = '#/s/' + s.id.replace(':', '-');
        const code = s.name.split(' · ')[0];
        const rest = s.name.slice(code.length + 3) || s.name;
        a.innerHTML = `<span class="ix-code">${code}</span><span class="ix-name"></span>`
          + `<span class="ix-size">${Math.round(s.w)} × ${Math.round(s.h)}</span>`;
        a.querySelector('.ix-name').textContent = rest;
        list.appendChild(a);
      });
    sec.appendChild(list);
    wrap.appendChild(sec);
  }
  return wrap;
};
