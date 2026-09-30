/* Account pages: notifications, shortlists, settings, Seller Hub dashboard,
   catalogue, subscription. */
const Notif = (function () {
  function list() { const w = Chrome.who(); return w ? Store.notificationsFor(w) : []; }
  function open(n) { App.closeOverlay(); if (n.conv && Store.conv(n.conv)) App.go('/myenq/' + n.conv + (n.enq ? '?enq=' + n.enq : '')); else App.go('/notifications'); }
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
      $.set(c, 'Ashwin Spice Works', s.name); Photo.paint(c.querySelector('[data-name="logo"]'), Store.photo('seller:' + s.id), s.initial);
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

/* ---------- Profile & Settings ----------
   Everything here comes from the account created at Register Free. Edits are held
   in a draft until Save changes. The profile picture saves as soon as it is chosen. */
Pages.settings = (el, p) => {
  const role = Store.db.session.role; const acc = Store.db.accounts[role];
  const draft = {};
  const content = el.querySelector('[data-name="Content"]') || el;
  const fieldIn = label => { const f = el.querySelector(`[data-name="Field / ${label}"]`); return f && (f.querySelector('[data-name="Input"]') || f.querySelector('[data-name="Select"]')); };
  const bind = (label, key) => { const i = fieldIn(label); if (i) Modals.field(i, acc[key] || '', v => { draft[key] = v.trim(); }); };
  bind('Your name', 'name'); bind('Company name', 'company');
  const since = d => { const x = new Date(d || Date.now()); return x.getDate() + ' ' + x.toLocaleString('en', { month: 'short' }) + ' ' + x.getFullYear(); };

  if (role === 'buyer') {
    $.set(el, /·\s+Buyer account/, `${acc.company}  ·  Buyer account  ·  free during the launch offer`);
    /* sourcing preferences from the registration step */
    const chips = el.querySelector('[data-name="What you source"] [data-name="Chips"]');
    if (chips && acc.interests && acc.interests.length) {
      const tpl = chips.querySelector('[data-name^="Chip / "]:not([data-name="Chip / Add"])'); const add = chips.querySelector('[data-name="Chip / Add"]');
      [...chips.querySelectorAll('[data-name^="Chip / "]')].filter(c => c !== add).forEach(c => c.remove());
      acc.interests.forEach(name => { const c = $.clone(tpl); c.dataset.name = 'Chip / ' + name; $.texts(c)[0].textContent = name; $.on($.text(c, '×'), () => { Store.updateAccount('buyer', { interests: acc.interests.filter(x => x !== name) }); App.refresh(); }); chips.insertBefore(c, add); });
    }
    const loc = el.querySelector('[data-name^="Row / Kochi"]');
    if (loc && acc.locations && acc.locations.length) { const t = $.texts(loc.querySelector('[data-name="Title"]') || loc)[0]; if (t) t.textContent = acc.locations[0]; }
  } else {
    $.set(el, /·\s+Verified\s+·\s+live since/, `${acc.company}  ·  Verified` + (acc.createdAt ? `  ·  live since ${since(acc.createdAt)}` : ''));
    /* business type: pick from the three registration options */
    const typeBox = fieldIn('Business type');
    if (typeBox) {
      const TYPES = ['Manufacturer', 'Trader / Distributor', 'Importer'];
      const t = $.texts(typeBox).find(x => x.textContent.trim().length > 2); let cur = acc.type || 'Manufacturer';
      if (t) t.textContent = cur;
      $.on(typeBox, () => { cur = TYPES[(TYPES.indexOf(cur) + 1) % TYPES.length]; draft.type = cur; if (t) t.textContent = cur; });
    }
  }
  /* the sign-in rows are read-only here: changing them re-verifies (demo) */
  const wa = el.querySelector('[data-name="Row / WhatsApp number"]'); if (wa) $.set(wa, /^\+\d/, `${acc.phone ? '+91 ' + acc.phone.replace(/^\+91\s*/, '') : 'No number yet'}  ·  used to sign in and for notifications`);
  const em = el.querySelector('[data-name="Row / Work email"]'); if (em) $.set(em, /@|backup sign-in/, `${acc.email || 'No email yet'}  ·  backup sign-in and account recovery`);
  /* nothing to show as verified when the account has no number / email */
  [[wa, acc.phone], [em, acc.email]].forEach(([row, v]) => { if (row && !v) row.querySelectorAll('[data-name*="Verified"]').forEach(x => x.classList.add('is-hidden')); });

  if (!p.preview) content.insertBefore(photoCard(role, acc), content.querySelector('[data-name^="Tabs /"]') ? content.querySelector('[data-name^="Tabs /"]').nextSibling : (content.querySelector('[data-name="Page head"]') || content.firstChild).nextSibling);

  // Edit / Preview tabs (seller)
  el.querySelectorAll('[data-name^="Tab / Edit"]').forEach(t => $.on(t, () => App.go('/settings')));
  el.querySelectorAll('[data-name^="Tab / Preview"]').forEach(t => $.on(t, () => App.go('/settings/preview')));
  $.on(el.querySelector('[data-name="Button / Save changes"], [data-name="Btn / Save changes"]'), () => {
    if (!Object.keys(draft).length) return App.toast('Nothing to save yet');
    if (draft.company === '' || draft.name === '') return App.toast('Name and company can’t be empty');
    Store.updateAccount(role, draft); App.toast('Changes saved'); App.refresh();
  });
  $.on(el.querySelector('[data-name="Button / Discard"], [data-name="Btn / Discard"]'), () => App.refresh());
  el.querySelectorAll('[data-name="Toggle"], [data-name^="Toggle /"]').forEach(tg => $.on(tg, () => { tg.dataset.off = tg.dataset.off === '1' ? '0' : '1'; tg.style.opacity = tg.dataset.off === '1' ? 0.35 : 1; }));
  if (role === 'seller' && p.preview) {
    const s = Store.seller(acc.id); const canvas = el.querySelector('[data-name="Preview canvas (public profile)"]');
    if (canvas && s) { SellerFace.apply(canvas, s); $.texts(canvas).forEach(t => { if (t.textContent.includes('AgroPure Ingredients')) t.textContent = t.textContent.replace(/AgroPure Ingredients/g, s.name); }); }
  }
  el.querySelectorAll('[data-name^="Button / Change"], [data-name^="Btn / Change"]').forEach(b => $.on(b, () => App.toast('We’d send a code to verify the change')));
};

/* The profile picture card. One square image is the account's face everywhere
   (chats, search results, header). Sellers also get a wide storefront cover that
   only appears at the top of their public profile — the pattern LinkedIn company
   pages and B2B marketplaces use, so a logo never has to be cropped into a banner. */
function photoCard(role, acc) {
  const seller = role === 'seller';
  const card = document.createElement('section'); card.className = 'photo-card';
  card.innerHTML = `
    <div class="pc-head"><h3>${seller ? 'Logo & storefront images' : 'Profile picture'}</h3>
      <p>${seller ? 'Your logo is how buyers recognise you in chats and search. The cover only appears on your public profile.' : 'Sellers see this next to your messages and enquiries.'}</p></div>
    <div class="pc-row" data-kind="avatar">
      <div class="pc-avatar" role="img"></div>
      <div class="pc-copy"><strong>${seller ? 'Logo (profile picture)' : 'Profile photo or company logo'}</strong>
        <span>Square JPG or PNG, at least 200 × 200 px. Shown in chats, search results${seller ? ', your storefront' : ''} and the header. We crop it to a square from the centre.</span>
        <div class="pc-actions"><button type="button" class="ep-btn primary" data-act="up"></button><button type="button" class="ep-btn" data-act="rm">Remove</button></div></div>
    </div>
    ${seller ? `<div class="pc-row pc-cover-row" data-kind="cover">
      <div class="pc-cover" role="img"><span>No cover yet</span></div>
      <div class="pc-copy"><strong>Storefront cover</strong>
        <span>Wide image, 1600 × 400 px works best (4:1). Shown across the top of your public profile only — never in chats.</span>
        <div class="pc-actions"><button type="button" class="ep-btn primary" data-act="up"></button><button type="button" class="ep-btn" data-act="rm">Remove</button></div></div>
    </div>` : ''}`;
  const slots = { avatar: { key: Photo.key(role, acc.id), w: 400, h: 400, label: 'photo' }, cover: { key: 'cover:' + acc.id, w: 1600, h: 400, label: 'cover' } };
  card.querySelectorAll('.pc-row').forEach(row => {
    const slot = slots[row.dataset.kind]; const face = row.querySelector('.pc-avatar, .pc-cover');
    const up = row.querySelector('[data-act="up"]'), rm = row.querySelector('[data-act="rm"]');
    const paint = () => {
      const url = Store.photo(slot.key);
      Photo.paint(face, url, row.dataset.kind === 'avatar' ? Store.initials(acc.company) : null);
      up.textContent = url ? 'Replace' : (row.dataset.kind === 'avatar' ? 'Upload photo' : 'Upload cover');
      rm.hidden = !url;
    };
    /* the header avatar is on this page too — repaint it rather than re-render the
       page, which would throw away unsaved edits in the form */
    const header = () => { if (row.dataset.kind === 'avatar') Photo.paint(document.querySelector('#stage [data-name="Navigation bar"] [data-name="avatar"]'), Store.photo(slot.key), Store.initials(acc.company)); };
    const take = async file => {
      try { const data = await Photo.read(file, slot.w, slot.h); Store.setPhoto(slot.key, data); paint(); header(); App.toast(row.dataset.kind === 'avatar' ? 'Profile picture updated' : 'Storefront cover updated'); }
      catch (e) { App.toast(e.message); }
    };
    up.onclick = async () => { const f = await Photo.pick(); if (f) take(f); };
    rm.onclick = () => { Store.setPhoto(slot.key, null); paint(); header(); App.toast(row.dataset.kind === 'avatar' ? 'Profile picture removed' : 'Cover removed'); };
    /* drop an image straight onto the preview */
    face.addEventListener('dragover', e => { e.preventDefault(); face.classList.add('drop'); });
    face.addEventListener('dragleave', () => face.classList.remove('drop'));
    face.addEventListener('drop', e => { e.preventDefault(); face.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) take(f); });
    face.addEventListener('click', () => up.click());
    paint();
  });
  return card;
}

/* A seller's logo and cover on any public-profile frame (buyer view or the
   seller's own Preview tab). */
const SellerFace = {
  apply(root, s) {
    const logo = root.querySelector('[data-name="Profile card"] [data-name="logo"]');
    Photo.paint(logo, Store.photo('seller:' + s.id), s.initial);
    const head = root.querySelector('[data-name="Section / Profile header"]') || (root.querySelector('[data-name="Profile card"]') || {}).parentElement;
    const cover = Store.photo('cover:' + s.id);
    if (head && !head.querySelector('.pv-cover')) {
      const c = document.createElement('div'); c.className = 'pv-cover' + (cover ? '' : ' empty');
      if (cover) c.style.backgroundImage = `url("${cover}")`;
      else c.textContent = Store.db.session.role === 'seller' ? 'Add a storefront cover in Profile & Settings' : '';
      if (cover || Store.db.session.role === 'seller') head.insertBefore(c, head.firstChild);
    }
  }
};

/* ---------- Seller Hub dashboard: every number from what happened in the app ---------- */
Pages.dashboard = el => {
  const acc = Store.db.accounts.seller; const sid = acc.id; const s = Store.seller(sid);
  const items = Store.enquiriesFor('seller'); const pending = items.filter(x => x.e.status === 'pending');
  const month = Date.now() - 30 * 864e5;
  const views = (Store.db.stats.views[sid] || []).filter(v => new Date(v.at) > month).length;
  const searches = Store.db.stats.search[sid] || 0;
  const answered = items.filter(x => x.e.acceptedAt || (x.e.status === 'declined' && x.e.closedAt));
  const avgMin = answered.length ? answered.reduce((n, x) => n + (new Date(x.e.acceptedAt || x.e.closedAt) - new Date(x.e.createdAt)), 0) / answered.length / 60000 : null;
  const fmt = m => m == null ? '—' : m < 1 ? '< 1 min' : m < 60 ? Math.round(m) + ' min' : '~' + Math.round(m / 60) + ' hrs';

  $.set(el, /^Ashwin Spice Works\s+·|·\s+verified\s+·/, `${acc.company}  ·  verified  ·  ${s.categories.length} categories  ·  ${(Store.catalogueFor(sid) || []).filter(x => x.status === 'Live').length} products live`);
  const tile = (name, value, note) => {
    const t = el.querySelector(`[data-name="${name}"]`); if (!t) return;
    $.texts(t)[0].textContent = value;
    const d = t.querySelector('[data-name="delta"]'); if (d) { const b = d.querySelector('[data-name="badge"]'); if (b) b.classList.toggle('is-hidden', !note.badge); if (b && note.badge) $.texts(b)[0].textContent = note.badge; const tx = $.texts(d).filter(x => !(b && b.contains(x))).pop(); if (tx) tx.textContent = note.text; }
  };
  tile('Tile / Profile views (30d)', String(views), { text: 'buyers who opened your profile' });
  tile('Tile / Search appearances', String(searches), { text: 'times you appeared in Find a Seller' });
  tile('Tile / Enquiries received', String(items.length), { badge: pending.length ? pending.length + ' new' : '', text: pending.length ? 'waiting for you to accept' : items.length ? 'all answered' : 'none yet' });
  tile('Tile / Avg response time', fmt(avgMin), { badge: avgMin == null ? '' : avgMin <= 180 ? 'on target' : 'above target', text: avgMin == null ? 'no enquiries answered yet' : 'target under 3 hrs' });

  /* enquiries per week, last four weeks */
  const plot = el.querySelector('[data-name="Plot"]');
  if (plot) {
    const weeks = [3, 2, 1, 0].map(i => items.filter(x => { const age = (Date.now() - new Date(x.e.createdAt)) / 864e5; return age >= i * 7 && age < (i + 1) * 7; }).length);
    const max = Math.max(1, ...weeks);
    plot.querySelectorAll('[data-name^="Week / "]').forEach((w, i) => { const bar = w.querySelector('[data-name="bar"]'); if (bar) bar.style.height = Math.max(4, Math.round(150 * weeks[i] / max)) + 'px'; const num = $.texts(w).find(x => /^\d+$/.test(x.textContent.trim())); if (num) num.textContent = String(weeks[i]); });
    $.set(el, /^Peak week/, items.length ? `Peak week ${max} enquir${max === 1 ? 'y' : 'ies'} · ${items.length} in the last four weeks.` : 'No enquiries yet — they will chart here week by week.');
  }
  const rt = el.querySelector('[data-name="Card / Response time"]');
  if (rt) {
    const r = rt.querySelector('[data-name="r"]'); if (r) $.texts(r)[0].textContent = fmt(avgMin);
    const fill = rt.querySelector('[data-name="fill"]'); if (fill) fill.style.width = avgMin == null ? '0%' : Math.min(100, Math.round(100 * avgMin / 240)) + '%';
    $.set(rt, /^You are|^Sellers replying|^No enquiries/, avgMin == null ? 'No enquiries answered yet. Sellers replying inside 3 hours win roughly twice as many deals.' : avgMin <= 180 ? 'You’re inside the 3-hour target. Keep it up — fast replies win more deals.' : `You’re ${fmt(avgMin - 180).replace('~', '')} above target. Sellers replying inside 3 hours win roughly twice as many deals.`);
  }

  const card = el.querySelector('[data-name="Card / Needs attention"]');
  if (card) {
    const rows = [...card.querySelectorAll(':scope > [data-name="row"]')]; const tpl = rows[0]; rows.forEach(r => r.remove());
    const h = card.querySelector('[data-name="h"]'); const chip = h.querySelector('[data-name^="Chip"]'); if (chip) $.texts(chip)[0].textContent = String(pending.length);
    const btn = card.querySelector('[data-name="Btn / Go to Leads"]');
    const unreadChats = Store.convsFor('seller').filter(c => Store.unread(c, 'seller') && c.status === 'active' && !c.enquiries.some(e => e.status === 'pending'));
    const show = pending.map(x => ({ c: x.c, e: x.e })).concat(unreadChats.map(c => ({ c }))).slice(0, 4);
    show.forEach(({ c, e }) => { const r = $.clone(tpl); const t = $.texts(r.querySelector('[data-name="t"]')); t[0].textContent = Store.buyer(c.buyerId).name; t[1].textContent = e ? `${e.id} · ${Enq.eLine(e)} · ${Enq.eQty(e)}` : 'New message'; const tm = $.texts(r).filter(x => !r.querySelector('[data-name="t"]').contains(x)).pop(); if (tm) tm.textContent = $.ago(e ? e.createdAt : Store.lastActivity(c)); $.on(r, () => App.go('/myenq/' + c.id + (e ? '?enq=' + e.id : ''))); card.insertBefore(r, btn); });
    if (!show.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = 'All caught up — no new requests.'; card.insertBefore(e, btn); }
    $.on(btn, () => App.go('/myenq'));
  }
  el.querySelectorAll('[data-name="Link / See who viewed (add-on)"], [data-name="Btn / Add Profile Views"]').forEach(b => $.on(b, () => App.go('/subscription')));
  el.querySelectorAll('[data-name^="Option / "]').forEach(o => $.on(o, () => { [...o.parentElement.children].forEach(x => { const on = x === o; x.style.background = on ? '#ffffff' : 'transparent'; x.style.boxShadow = on ? '0 1px 2px rgba(0,0,0,.08)' : 'none'; $.texts(x)[0].style.fontWeight = on ? 600 : 500; }); }));
};

/* ---------- Buyer Overview (My Account dashboard) ----------
   Built on the My Account shell (header + account sidebar). Answers "what needs my
   attention?" from the buyer's real enquiries — nothing here is sample data. */
Pages.overview = el => {
  const acc = Store.db.accounts.buyer; const b = Store.buyer(acc.id);
  const content = el.querySelector('[data-name="Content"]'); if (!content) return;
  $.clear(content);
  const bc = el.querySelector('[data-name="Breadcrumb"]'); if (bc) { const t = $.texts(bc); t[t.length - 1].textContent = 'Overview'; }
  const items = Store.enquiriesFor('buyer');
  const convs = Store.convsFor('buyer');
  const pending = items.filter(x => x.e.status === 'pending'), active = items.filter(x => x.e.status === 'active');
  const accepted = items.filter(x => x.e.acceptedAt).length;
  const shortlist = (Store.db.shortlists[acc.id] || []).length;
  const h = new Date().getHours(); const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = !items.length;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* things waiting on the buyer, newest first */
  const att = [];
  convs.forEach(c => {
    const s = Store.seller(c.sellerId); const u = Store.unread(c, 'buyer');
    if (u) att.push({ at: Store.lastActivity(c), icon: String(u), title: `${u} new message${u > 1 ? 's' : ''} from ${s.name}`, meta: Enq.prodLine(c), btn: 'Reply', go: '/myenq/' + c.id, primary: true });
    c.enquiries.forEach(e => {
      const repliedSince = c.messages.some(m => m.k === 'text' && m.from === 'buyer' && e.acceptedAt && m.at > e.acceptedAt);
      if (e.status === 'active' && !repliedSince && !u) att.push({ at: e.acceptedAt, icon: '✓', title: `${s.name} accepted ${e.id}`, meta: `${Enq.eLine(e)} · ${Enq.eQty(e)} · ${$.ago(e.acceptedAt)}`, btn: 'Open chat', go: `/myenq/${c.id}?enq=${e.id}`, primary: true });
      if (e.status === 'declined' && (Date.now() - new Date(e.closedAt)) < 7 * 864e5) att.push({ at: e.closedAt, icon: '!', title: `${s.name} declined ${e.id}`, meta: `${e.reason || ''} · ${Enq.eLine(e)}`, btn: 'Find other sellers', go: '/find?q=' + encodeURIComponent(e.products[0].name.split(/[,—(]/)[0].trim()) });
      if (e.status === 'pending') att.push({ at: e.createdAt, icon: '○', title: `Waiting for ${s.name} to accept ${e.id}`, meta: `${Enq.eLine(e)} · sent ${$.ago(e.createdAt)} · usually accepts in ${s.respond}`, btn: 'View', go: `/myenq/${c.id}?enq=${e.id}` });
    });
  });
  att.sort((a, b2) => (b2.at || '').localeCompare(a.at || ''));

  const done = [!!(acc.name && acc.company), !!(acc.interests && acc.interests.length), !!(acc.locations && acc.locations.length), !!Store.photo(Photo.key('buyer', acc.id))];
  const interests = acc.interests || [];
  const contacted = new Set(convs.map(c => c.sellerId));
  const fresh = Store.db.sellers.filter(s => !contacted.has(s.id) && (!interests.length || s.categories.some(c => interests.includes(c.name)))).sort((a, b2) => b2.rating - a.rating).slice(0, 3);

  const wrap = document.createElement('div'); wrap.className = 'ov';
  wrap.innerHTML = `
    <div class="ov-head"><div><h1>${first ? 'Welcome to IngredienPro' : greet}, ${esc(b ? b.short : acc.company)}</h1>
      <p>${first ? 'Send your first enquiry to start hearing from verified sellers. It’s free during the launch offer.' : 'Here’s what needs your attention across your enquiries.'}</p></div>
      <div class="ov-actions"><button class="ep-btn" data-go="/find">Find a seller</button><button class="ep-btn primary" data-go="/find">Send an enquiry</button></div></div>
    <div class="ov-tiles">
      <button class="ov-tile" data-go="/myenq"><span>Active enquiries</span><strong>${active.length + pending.length}</strong><em>${pending.length} awaiting acceptance</em></button>
      <button class="ov-tile" data-go="/myenq"><span>Seller responses</span><strong>${accepted}</strong><em>accepted out of ${items.length} sent</em></button>
      <button class="ov-tile" data-go="/myenq"><span>Open chats</span><strong>${convs.filter(c => c.status === 'active').length}</strong><em>${convs.filter(c => Store.unread(c, 'buyer')).length} with unread messages</em></button>
      <button class="ov-tile" data-go="/shortlists"><span>Shortlisted sellers</span><strong>${shortlist}</strong><em>${shortlist ? 'ready to enquire' : 'save sellers to compare later'}</em></button>
    </div>
    <div class="ov-cols">
      <div class="ov-main">
        <section class="ov-card"><div class="ov-card-h"><h2>${first ? 'Get started in three steps' : 'Needs your attention'}</h2>${first ? '' : `<span class="ep-count">${att.length}</span>`}</div><div class="ov-att"></div></section>
        <section class="ov-card"><div class="ov-card-h"><h2>Recent enquiries</h2>${first ? '' : '<button class="ep-link" data-go="/myenq">View all in My enQ →</button>'}</div><div class="ov-table"></div></section>
      </div>
      <div class="ov-side">
        <section class="ov-card"><div class="ov-card-h"><h2>${interests.length ? 'New in your categories' : 'Top-rated sellers'}</h2></div><p class="ov-sub">${esc(interests.length ? interests.slice(0, 2).join(' · ') + (interests.length > 2 ? ' +' + (interests.length - 2) : '') : 'Add what you source in Profile & Settings to tailor this')}</p><div class="ov-sellers"></div></section>
        <section class="ov-card"><div class="ov-offer"><span>LAUNCH OFFER</span><strong>Free for buyers</strong><p>Search, enquiries, chat and shortlists cost nothing during the offer.</p></div>
          <h3 class="ov-h3">Complete your sourcing profile</h3><div class="ov-bar"><i style="width:${Math.round(100 * done.filter(Boolean).length / done.length)}%"></i></div>
          <p class="ov-sub">${done.filter(Boolean).length} of ${done.length} done — sellers use this to judge fit and delivery.</p><div class="ov-checks"></div></section>
      </div>
    </div>`;
  const attBox = wrap.querySelector('.ov-att');
  const row = (icon, title, meta, btn, go, primary) => { const r = document.createElement('div'); r.className = 'ov-row'; r.innerHTML = `<span class="ov-ic"></span><div><strong></strong><small></small></div>`; r.querySelector('.ov-ic').textContent = icon; r.querySelector('strong').textContent = title; r.querySelector('small').textContent = meta; if (btn) { const b2 = document.createElement('button'); b2.className = 'ep-btn' + (primary ? ' primary' : ''); b2.textContent = btn; b2.dataset.go = go; r.appendChild(b2); } return r; };
  if (first) {
    attBox.append(row('1', 'Find a seller in your categories', 'Filter by certification, location and response time.', 'Find a seller', '/find'),
      row('2', 'Send one enquiry', 'Share product, quantity and notes. Add similar sellers too if you like.', 'Send an enquiry', '/find', true),
      row('3', 'Chat once a seller accepts', 'Every enquiry to that seller stays in one chat in My enQ.'));
  } else if (!att.length) { const e = document.createElement('div'); e.className = 'ov-empty'; e.innerHTML = '<strong>You’re all caught up</strong><span>New replies and reminders will appear here.</span>'; attBox.appendChild(e); }
  else att.slice(0, 6).forEach(a => attBox.appendChild(row(a.icon, a.title, a.meta, a.btn, a.go, a.primary)));

  const table = wrap.querySelector('.ov-table');
  if (first) { const e = document.createElement('div'); e.className = 'ov-empty'; e.innerHTML = '<strong>No enquiries yet</strong><span>Enquiries you send will be listed here with their status.</span>'; const b2 = document.createElement('button'); b2.className = 'ep-btn primary'; b2.textContent = 'Send your first enquiry'; b2.dataset.go = '/find'; e.appendChild(b2); table.appendChild(e); }
  else {
    const hd = document.createElement('div'); hd.className = 'ov-tr ov-th'; hd.innerHTML = '<span>Enquiry</span><span>Product</span><span>Seller</span><span>Status</span><span>Sent</span>'; table.appendChild(hd);
    items.slice(0, 5).forEach(({ c, e }) => {
      const r = document.createElement('button'); r.className = 'ov-tr'; r.dataset.go = `/myenq/${c.id}?enq=${e.id}`;
      r.innerHTML = '<span class="ov-ref"></span><span><strong></strong><small></small></span><span class="ov-seller"></span><span><i class="ep-pill"></i></span><span class="ov-when"></span>';
      r.querySelector('.ov-ref').textContent = e.id; r.querySelector('strong').textContent = Enq.eLine(e); r.querySelector('small').textContent = Enq.eQty(e) + (e.type === 'similar' ? ' · similar seller' : '');
      r.querySelector('.ov-seller').textContent = Store.seller(c.sellerId).name;
      const pl = r.querySelector('.ep-pill'); pl.textContent = Enq.STATUS(e, 'buyer'); pl.classList.add(e.status === 'active' ? (e.deal ? 'deal' : 'on') : e.status === 'pending' ? 'wait' : 'off');
      r.querySelector('.ov-when').textContent = $.ago(e.createdAt);
      table.appendChild(r);
    });
  }
  const sl = wrap.querySelector('.ov-sellers');
  fresh.forEach(s => { const r = document.createElement('div'); r.className = 'ov-seller-row'; const av = document.createElement('div'); av.className = 'ep-avatar sm'; Photo.paint(av, Store.photo('seller:' + s.id), s.initial); const t = document.createElement('div'); t.innerHTML = '<strong></strong><small></small>'; t.querySelector('strong').textContent = s.name; t.querySelector('small').textContent = `✓ Verified · ${s.city}, ${s.state} · ★ ${s.rating}`; const v = document.createElement('button'); v.className = 'ep-link'; v.textContent = 'View'; v.dataset.go = '/seller/' + s.id; r.append(av, t, v); sl.appendChild(r); });
  if (!fresh.length) { const e = document.createElement('p'); e.className = 'ov-sub'; e.textContent = 'You’ve contacted every seller in your categories.'; sl.appendChild(e); }
  const checks = wrap.querySelector('.ov-checks');
  [['Company details', done[0]], ['What you source', done[1]], ['Delivery location', done[2]], ['Profile picture', done[3]]].forEach(([l, ok]) => { const r = document.createElement('div'); r.className = 'ov-check' + (ok ? ' ok' : ''); r.innerHTML = `<span>${ok ? '✓' : '○'}</span><span></span>${ok ? '' : '<button class="ep-link" data-go="/settings">Add →</button>'}`; r.children[1].textContent = l; checks.appendChild(r); });
  wrap.querySelectorAll('[data-go]').forEach(x => x.addEventListener('click', ev => { ev.stopPropagation(); App.go(x.dataset.go); }));
  content.appendChild(wrap);
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
