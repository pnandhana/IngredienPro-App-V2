/* Account pages: notifications, shortlists, settings, Seller Hub dashboard,
   catalogue, subscription. */
const Notif = (function () {
  function list() { const w = Chrome.who(); return w ? Store.notificationsFor(w) : []; }
  function open(n) { App.closeOverlay(); if (n.conv && Store.conv(n.conv)) App.go('/myenq/' + n.conv); else App.go('/notifications'); }
  /* Fill the dropdown (compact) or a Notifications page with live items. */
  function fill(root, compact, filter) {
    const items = list().filter(n => filter !== 'unread' || !n.read);
    const tplEl = root.querySelector(compact ? '[data-name="Notification item"]' : '[data-name="Notification row"]'); if (!tplEl) return;
    const unreadTpl = [...root.querySelectorAll(compact ? '[data-name="Notification item"]' : '[data-name="Notification row"]')].find(x => x.querySelector('[data-name="unread dot"]') && getComputedStyle(x.querySelector('[data-name="unread dot"]')).visibility !== 'hidden') || tplEl;
    const readTpl = [...root.querySelectorAll(compact ? '[data-name="Notification item"]' : '[data-name="Notification row"]')].pop();
    const host = tplEl.parentElement;
    root.querySelectorAll(compact ? '[data-name="Notification item"]' : '[data-name="Notification row"]').forEach(x => x.remove());
    if (!compact) { root.querySelectorAll('[data-name^="Group / "]').forEach((g, i) => { if (i) g.remove(); }); [...root.querySelectorAll('div')].filter(d => /^(YESTERDAY|EARLIER THIS WEEK)$/.test(d.textContent.trim())).forEach(d => d.remove()); }
    const shown = compact ? items.slice(0, 6) : items;
    shown.forEach(n => {
      const r = $.clone(n.read ? readTpl : unreadTpl); const t = r.querySelector('[data-name="t"]'); const ts = $.texts(t);
      ts[0].textContent = n.title; if (ts[1]) ts[1].textContent = n.text; const time = compact ? ts[2] : $.texts(r).filter(x => !t.contains(x)).pop(); if (time) time.textContent = $.ago(n.at);
      const dot = r.querySelector('[data-name="unread dot"]'); if (dot) dot.style.visibility = n.read ? 'hidden' : 'visible';
      r.style.background = n.read ? '' : (compact ? '#F7F7F7' : r.style.background);
      $.on(r, () => { n.read = true; Store.readAllNotifications('__none__'); open(n); });
      host.appendChild(r);
    });
    if (!shown.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = filter === 'unread' ? 'You’re all caught up.' : 'No notifications yet.'; host.appendChild(e); }
    const unread = list().filter(n => !n.read).length;
    $.set(root, /unread of \d+/, `${unread} unread of ${list().length}`);
    const tab = root.querySelector('[data-name^="Tab / Unread"]'); if (tab) { const tt = $.texts(tab); if (compact) tt[0].textContent = 'Unread  ·  ' + unread; else if (tt[1]) tt[1].textContent = String(unread); }
    const allC = root.querySelector('[data-name="Tab / All"] [data-name^="Chip"]'); if (allC) $.texts(allC)[0].textContent = String(list().length);
    const mark = $.text(root, 'Mark all as read'); $.on(mark.closest('[data-name^="Btn"]') || mark, () => { Store.readAllNotifications(Chrome.who()); if (compact) { App.closeOverlay(); } App.refresh(); });
    const view = $.text(root, /^View all notifications/); if (view) $.on(view.parentElement, () => { App.closeOverlay(); App.go('/notifications'); });
    root.querySelectorAll('[data-name="Tab / All"], [data-name^="Tab / Unread"], [data-name="Pill / All"], [data-name="Pill / Unread"]').forEach(tb => $.on(tb, () => { const f = /Unread/.test(tb.dataset.name) ? 'unread' : null; fill(root, compact, f); paintTabs(root, f); }));
    paintTabs(root, filter);
  }
  function paintTabs(root, f) {
    root.querySelectorAll('[data-name="Tab / All"], [data-name^="Tab / Unread"]').forEach(tb => { const on = /Unread/.test(tb.dataset.name) === (f === 'unread'); tb.style.borderBottom = on ? '2px solid #111111' : '0 solid transparent'; $.texts(tb)[0].style.fontWeight = on ? 600 : 400; });
    root.querySelectorAll('[data-name="Pill / All"], [data-name="Pill / Unread"]').forEach(tb => { const on = /Unread/.test(tb.dataset.name) === (f === 'unread'); tb.style.background = on ? '#111111' : '#ffffff'; $.texts(tb)[0].style.color = on ? '#ffffff' : '#111111'; });
  }
  return { fill };
})();

Pages.notifications = el => {
  const c = el.querySelector('[data-name="Content"]') || el; Notif.fill(c, false);
  $.on(el.querySelector('[data-name="Btn / Notification settings"]'), () => App.go('/settings'));
};

Pages.shortlists = el => {
  const b = Store.db.accounts.buyer.id; const ids = Store.db.shortlists[b] || [];
  const grid = el.querySelector('[data-name="Seller grid"]'); if (!grid) return;
  const rowT = grid.children[0], cardT = rowT.children[0]; const unavailT = [...grid.querySelectorAll('[data-name^="Shortlisted seller /"]')].pop();
  $.clear(grid);
  const sellers = ids.map(Store.seller).filter(Boolean);
  for (let i = 0; i < sellers.length; i += 3) {
    const r = rowT.cloneNode(false); r.style.cssText = rowT.style.cssText;
    sellers.slice(i, i + 3).forEach(s => {
      const c = $.clone(cardT); c.dataset.sellerId = s.id;
      $.set(c, 'Ashwin Spice Works', s.name); const logo = c.querySelector('[data-name="logo"]'); if (logo) $.texts(logo)[0].textContent = s.initial;
      $.set(c, /years active$/, `${s.city}, ${s.state}  ·  ${s.years} years active`);
      const certs = c.querySelector('[data-name="certs"]'); if (certs) { const p = certs.children[0]; $.clear(certs); s.certs.slice(0, 3).forEach(x => { const q = p.cloneNode(true); $.texts(q)[0].textContent = x; certs.appendChild(q); }); }
      const facts = c.querySelector('[data-name="facts"]'); if (facts) { const f = $.texts(facts); if (f[1]) f[1].textContent = s.respond; }
      U.bindCardActions(c, s);
      const heart = c.querySelector('[data-name^="Btn / Remove from shortlist"]'); if (heart) $.on(heart, () => { Store.toggleShortlist(s.id); App.toast('Removed from Shortlists', { label: 'Undo', fn: () => { Store.toggleShortlist(s.id); App.refresh(); } }); App.refresh(); });
      r.appendChild(c);
    });
    while (r.children.length < 3) { const f = cardT.cloneNode(true); f.style.visibility = 'hidden'; r.appendChild(f); }
    grid.appendChild(r);
  }
  if (!sellers.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = 'No shortlisted sellers yet. Tap ♡ Shortlist on any seller to keep them here.'; grid.appendChild(e); }
  $.set(el, /sellers\s+·\s+Shortlist a seller/, `${sellers.length} seller${sellers.length === 1 ? '' : 's'}  ·  Shortlist a seller from their profile or search results to compare and enquire later.`);
};

Pages.settings = (el, p) => {
  const role = Store.db.session.role; const acc = Store.db.accounts[role];
  if (role === 'buyer') {
    $.set(el, /·\s+Buyer account/, `${acc.company}  ·  Buyer account  ·  free during the launch offer`);
    const card = el.querySelector('[data-name="Card / Account"]');
    if (card) { const fs = card.querySelectorAll('[data-name="Input"]'); if (fs[0]) Modals.field(fs[0], acc.name, v => acc.name = v); if (fs[1]) Modals.field(fs[1], acc.company, v => acc.company = v); }
  }
  // Edit / Preview tabs (seller)
  el.querySelectorAll('[data-name^="Tab / Edit"]').forEach(t => $.on(t, () => App.go('/settings')));
  el.querySelectorAll('[data-name^="Tab / Preview"]').forEach(t => $.on(t, () => App.go('/settings/preview')));
  $.on(el.querySelector('[data-name="Button / Save changes"], [data-name="Btn / Save changes"]'), () => App.toast('Changes saved'));
  $.on(el.querySelector('[data-name="Button / Discard"], [data-name="Btn / Discard"]'), () => App.refresh());
  el.querySelectorAll('[data-name="Toggle"], [data-name^="Toggle /"]').forEach(tg => $.on(tg, () => { tg.dataset.off = tg.dataset.off === '1' ? '0' : '1'; tg.style.opacity = tg.dataset.off === '1' ? 0.35 : 1; }));
  if (role === 'seller' && p.preview) {
    const s = Store.seller(acc.id); const canvas = el.querySelector('[data-name="Preview canvas (public profile)"]');
    if (canvas && s) { $.texts(canvas).forEach(t => { if (t.textContent.includes('AgroPure Ingredients')) t.textContent = t.textContent.replace(/AgroPure Ingredients/g, s.name); }); }
  }
  el.querySelectorAll('[data-name^="Button / Change"], [data-name^="Btn / Change"]').forEach(b => $.on(b, () => App.toast('We’d send a code to verify the change')));
};

Pages.dashboard = el => {
  const sid = Store.db.accounts.seller.id; const convs = Store.convsFor('seller');
  const pending = convs.filter(c => c.status === 'pending');
  $.set(el, /^Ashwin Spice Works\s+·|·\s+verified\s+·/, `${Store.db.accounts.seller.company}  ·  verified  ·  ${Store.seller(sid).categories.length} categories  ·  ${(Store.catalogueFor(sid) || []).filter(x => x.status === 'Live').length} products live`);
  const tile = el.querySelector('[data-name="Tile / Enquiries received"]'); if (tile) { $.texts(tile)[0].textContent = String(convs.length); const b = tile.querySelector('[data-name="badge"]'); if (b) $.texts(b)[0].textContent = pending.length + ' new'; }
  const card = el.querySelector('[data-name="Card / Needs attention"]');
  if (card) {
    const rows = [...card.querySelectorAll(':scope > [data-name="row"]')]; const tpl = rows[0]; rows.forEach(r => r.remove());
    const h = card.querySelector('[data-name="h"]'); const chip = h.querySelector('[data-name^="Chip"]'); if (chip) $.texts(chip)[0].textContent = String(pending.length);
    const btn = card.querySelector('[data-name="Btn / Go to Leads"]');
    const show = pending.concat(convs.filter(c => c.status === 'active' && Store.unread(c, 'seller'))).slice(0, 4);
    show.forEach(c => { const r = $.clone(tpl); const t = $.texts(r.querySelector('[data-name="t"]')); t[0].textContent = Store.buyer(c.buyerId).name; t[1].textContent = c.status === 'pending' ? `${Enq.prodLine(c)} · ${c.products[0].qty} ${c.products[0].unit}` : 'New message'; const tm = $.texts(r).filter(x => !r.querySelector('[data-name="t"]').contains(x)).pop(); if (tm) tm.textContent = $.ago(Store.lastActivity(c)); $.on(r, () => App.go('/myenq/' + c.id)); card.insertBefore(r, btn); });
    if (!show.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = 'All caught up — no new requests.'; card.insertBefore(e, btn); }
    $.on(btn, () => App.go('/myenq'));
  }
  el.querySelectorAll('[data-name="Link / See who viewed (add-on)"], [data-name="Btn / Add Profile Views"]').forEach(b => $.on(b, () => App.go('/subscription')));
  el.querySelectorAll('[data-name^="Option / "]').forEach(o => $.on(o, () => { [...o.parentElement.children].forEach(x => { const on = x === o; x.style.background = on ? '#ffffff' : 'transparent'; x.style.boxShadow = on ? '0 1px 2px rgba(0,0,0,.08)' : 'none'; $.texts(x)[0].style.fontWeight = on ? 600 : 500; }); }));
};

Pages.catalogue = el => {
  const sid = Store.db.accounts.seller.id; const items = Store.catalogueFor(sid) || [];
  const list = el.querySelector('[data-name="Product list"]'); if (!list) return;
  const rows = [...list.querySelectorAll('[data-name="Product row"]')]; const liveT = rows[0], pendT = rows.find(r => /Pending/.test(r.textContent)) || rows[0];
  rows.forEach(r => r.remove());
  const state = { filter: null, q: '' };
  function draw() {
    [...list.querySelectorAll('[data-name="Product row"], .empty-note')].forEach(r => r.remove());
    items.filter(i => (!state.filter || i.status === state.filter) && (!state.q || i.name.toLowerCase().includes(state.q))).forEach(i => {
      const r = $.clone(i.status === 'Live' ? liveT : pendT); const ts = $.texts(r); ts[0].textContent = i.name; ts[1].textContent = i.category.replace(' — Whole & Ground', ' & Seasonings'); ts[2].textContent = i.moq;
      $.on($.text(r, 'Edit'), () => App.toast('Edits go to review before they appear to buyers'));
      list.appendChild(r);
    });
    const live = items.filter(i => i.status === 'Live').length, pend = items.length - live;
    $.set(el, /\d+ live\s+·/, `${live} live  ·  ${pend} pending review`);
  }
  el.querySelectorAll('[data-name="Pill / All"], [data-name="Pill / Live"], [data-name^="Pill / Pending"]').forEach(pl => $.on(pl, () => { state.filter = /Live/.test(pl.dataset.name) ? 'Live' : /Pending/.test(pl.dataset.name) ? 'Pending review' : null; el.querySelectorAll('[data-name="Pill / All"], [data-name="Pill / Live"], [data-name^="Pill / Pending"]').forEach(x => { const on = x === pl; x.style.background = on ? '#111' : '#fff'; $.texts(x)[0].style.color = on ? '#fff' : '#111'; }); draw(); }));
  const search = el.querySelector('[data-name="Search & filters"] [data-name="Search"]'); if (search) Modals.field(search, '', v => { state.q = v.trim().toLowerCase(); draw(); }, { placeholder: 'Search products' });
  $.on(el.querySelector('[data-name="Btn / Add product"]'), () => addProduct());
  draw();
  function addProduct() {
    const wrap = document.createElement('div'); wrap.className = 'mini-modal';
    wrap.innerHTML = `<h3>Add a product</h3><p>Pick from the IngredienPro product list. New listings go to review before buyers see them.</p><div class="mm-field"><div class="mm-input" contenteditable="plaintext-only" data-placeholder="Start typing — e.g. turmeric"></div></div><div class="mm-foot"><button class="mm-btn">Cancel</button></div>`;
    const input = wrap.querySelector('.mm-input'); input.classList.add('editable', 'with-placeholder');
    input.addEventListener('input', () => Modals.suggest(input, input.textContent, h => { items.unshift({ name: h.name, category: h.category, moq: '—', status: 'Pending review' }); Store.db.catalogue[sid] = items; Store.readAllNotifications('__none__'); App.closeOverlay(); App.toast(h.name + ' added — pending review'); App.refresh(); }));
    wrap.querySelector('.mm-btn').onclick = () => App.closeOverlay();
    App.openOverlay(wrap); setTimeout(() => input.focus(), 30);
  }
};

Pages.subscription = el => {
  el.querySelectorAll('[data-name^="Btn / "], [data-name^="Button / "]').forEach(b => { if (!b.dataset.override && !b.classList.contains('is-link')) $.on(b, () => App.toast('Payments open a Razorpay checkout in the live product')); });
};
