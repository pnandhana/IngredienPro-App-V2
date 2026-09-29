/* One shared record for the whole app. Buyer and seller read and write the
   same conversations, so an enquiry the buyer sends IS the request the seller
   sees. Saved to localStorage and synced live across tabs (open the buyer in
   one tab and the seller in another). */
const Store = (function () {
  const KEY = 'ingredienpro.app.v3';
  const subs = [];
  let db = load();

  function fresh() {
    return {
      v: 3,
      session: { role: 'guest' },            // guest | buyer | seller
      accounts: JSON.parse(JSON.stringify(SEED.ACCOUNTS)),
      sellers: JSON.parse(JSON.stringify(SEED.SELLERS)),
      buyers: JSON.parse(JSON.stringify(SEED.BUYERS)),
      conversations: JSON.parse(JSON.stringify(SEED.conversations)),
      requirements: [],
      shortlists: { vega: ['ashwin', 'srilakshmi', 'meridian', 'sunfield', 'nilgiri'] },
      notifications: seedNotifications(),
      catalogue: { ashwin: [
        { name: 'Turmeric Powder, Curcumin ≥5%', category: 'Spices — Whole & Ground', moq: '500 kg', status: 'Live' },
        { name: 'Cardamom 8mm — Green, bold', category: 'Spices — Whole & Ground', moq: '50 kg', status: 'Live' },
        { name: 'Chilli Powder Teja S17', category: 'Spices — Whole & Ground', moq: '1 MT', status: 'Live' },
        { name: 'Turmeric Oleoresin 95%', category: 'Oleoresins & Extracts', moq: '25 kg', status: 'Pending review' },
        { name: 'Black Pepper Powder', category: 'Spices — Whole & Ground', moq: '200 kg', status: 'Pending review' },
        { name: 'Coriander Powder', category: 'Spices — Whole & Ground', moq: '100 kg', status: 'Pending review' } ] },                         // sellerId -> [{name, category, moq, status}]
      seq: 1100,
      ui: { sidebar: 'expanded' }
    };
  }
  function seedNotifications() {
    const t = (d, h, m) => new Date(2026, 7, d, h, m).toISOString();
    const N = (to, kind, title, text, at, read, conv) => ({ id: 'n-' + Math.random().toString(36).slice(2, 8), to, kind, title, text, at, read, conv });
    return [
      N('buyer:vega', 'accepted', 'A seller accepted your enquiry', 'Ashwin Spice Works accepted your enquiry · Turmeric Powder. Chat is now open.', t(12, 10, 24), false, 'c-ashwin-turmeric'),
      N('buyer:vega', 'message', 'New message', 'Sunfield Agro Exports: ₹145/kg, valid 5 days.', t(10, 9, 0), false, 'c-sunfield'),
      N('buyer:vega', 'message', 'New message', 'AgroPure Ingredients: Can share COA for the current lot.', t(12, 11, 5), false, 'c-agropure'),
      N('buyer:vega', 'waiting', 'No response on your enquiry yet', 'Meridian Foods Pvt Ltd hasn’t accepted your Turmeric Powder enquiry.', t(11, 9, 40), false, 'c-meridian'),
      N('buyer:vega', 'info', 'A seller you shortlisted is unavailable', 'Deccan Spice Traders — FSSAI licence expired, listings removed.', t(9, 16, 0), true),
      N('seller:ashwin', 'request', 'New enquiry', 'Northline Foods — Chilli Powder Teja S17, 5 MT.', t(13, 8, 30), false, 'c-northline'),
      N('seller:ashwin', 'message', 'Buyer replied', 'Kerala Agro Mills sent 2 messages about Turmeric Powder.', t(13, 7, 31), false, 'c-kerala'),
      N('seller:ashwin', 'info', 'Listing approved', 'Cardamom 8mm — Green, bold is live and appearing in search.', t(12, 11, 5), false),
      N('seller:ashwin', 'info', 'Subscription renews in 30 days', '3 categories · renews 12 Sep. Card on file will be charged.', t(10, 9, 0), true)
    ];
  }
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); if (!d || d.v !== 3) d = null; } catch (e) {}
    d = d || fresh();
    // the role is per browser tab, so a buyer tab and a seller tab can run side by side
    try { const r = sessionStorage.getItem('ingredienpro.role'); if (r) d.session = { role: r }; } catch (e) {}
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function emit(kind) { subs.forEach(fn => { try { fn(kind); } catch (e) { console.error(e); } }); }
  function commit(kind) { try { sessionStorage.setItem('ingredienpro.role', db.session.role); } catch (e) {} save(); emit(kind || 'data'); }
  window.addEventListener('storage', e => { if (e.key === KEY) { db = load(); emit('sync'); } });

  const now = () => new Date().toISOString();
  const id = p => p + '-' + (++db.seq);

  /* ---- lookups ---- */
  const seller = sid => db.sellers.find(s => s.id === sid);
  const buyer = bid => db.buyers.find(b => b.id === bid);
  const conv = cid => db.conversations.find(c => c.id === cid);
  const me = () => {
    const s = db.session;
    if (s.role === 'buyer') return Object.assign({}, db.accounts.buyer, { org: buyer(db.accounts.buyer.id) });
    if (s.role === 'seller') return Object.assign({}, db.accounts.seller, { org: seller(db.accounts.seller.id) });
    return { role: 'guest' };
  };
  function sellsAll(s, products) { return products.every(p => s.products.includes(p.name) || s.categories.some(c => c.name === p.category) && s.products.some(x => x.split(/[,—(]/)[0].trim() === p.name.split(/[,—(]/)[0].trim())); }
  function sellsProduct(s, name) { const base = name.split(/[,—(]/)[0].trim().toLowerCase(); return s.products.some(x => x.toLowerCase() === name.toLowerCase() || x.split(/[,—(]/)[0].trim().toLowerCase() === base); }

  function lastActivity(c) { const m = c.messages[c.messages.length - 1]; return m ? m.at : c.createdAt; }
  function unread(c, role) {
    const seen = (c.reads && c.reads[role]) || '';
    return c.messages.filter(m => m.at > seen && (m.from && m.from !== role) && (m.k === 'text' || m.k === 'file' || (m.k === 'enquiry' && role === 'seller'))).length;
  }
  function convsFor(role) {
    const acc = db.accounts[role]; if (!acc) return [];
    const key = role === 'buyer' ? 'buyerId' : 'sellerId';
    return db.conversations.filter(c => c[key] === acc.id).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || lastActivity(b).localeCompare(lastActivity(a)));
  }

  function notify(to, n) { db.notifications.unshift(Object.assign({ id: id('n'), to, at: now(), read: false }, n)); }

  /* ---- actions ---- */
  const A = {
    setRole(role) { db.session = { role }; commit('session'); },
    setSidebar(v) { db.ui.sidebar = v; commit('ui'); },

    /* One form, one or more products, one chat per seller. */
    sendEnquiry({ sellerIds, products, type }) {
      const b = db.accounts.buyer.id; const made = [];
      for (const sid of sellerIds) {
        const c = { id: id('c'), buyerId: b, sellerId: sid, products: JSON.parse(JSON.stringify(products)), status: 'pending', type: type || 'direct', createdAt: now(), messages: [{ k: 'enquiry', from: 'buyer', at: now() }], reads: { buyer: now() } };
        db.conversations.unshift(c); made.push(c);
        notify('seller:' + sid, { kind: 'request', conv: c.id, title: 'New enquiry', text: `${buyer(b).name} — ${products.map(p => p.name).join(' + ')}, ${products[0].qty} ${products[0].unit}.` });
      }
      commit('enquiry'); return made;
    },
    postRequirement({ product, qty, unit, notes, category }) {
      const b = db.accounts.buyer.id;
      const targets = db.sellers.filter(s => s.categories.some(c => c.name === category));
      const r = { id: id('r'), buyerId: b, product, qty, unit, notes, category, sellerIds: targets.map(s => s.id), status: 'open', createdAt: now() };
      db.requirements.unshift(r);
      for (const s of targets) {
        const c = { id: id('c'), buyerId: b, sellerId: s.id, products: [{ name: product, qty, unit, notes, category }], status: 'pending', type: 'requirement', requirementId: r.id, hiddenFromBuyer: true, createdAt: now(), messages: [{ k: 'enquiry', from: 'buyer', at: now() }], reads: { buyer: now() } };
        db.conversations.unshift(c);
        notify('seller:' + s.id, { kind: 'request', conv: c.id, title: 'New requirement in your category', text: `${buyer(b).name} — ${product}, ${qty} ${unit}.` });
      }
      commit('requirement'); return r;
    },
    accept(cid) {
      const c = conv(cid); c.status = 'active'; c.acceptedAt = now(); c.hiddenFromBuyer = false;
      c.messages.push({ k: 'event', text: 'accepted', from: 'seller', at: now() }, { k: 'notice', at: now() });
      c.reads.seller = now();
      notify('buyer:' + c.buyerId, { kind: 'accepted', conv: c.id, title: `${seller(c.sellerId).name} accepted your enquiry`, text: `${c.products.map(p => p.name).join(' + ')}. Chat is now open.` });
      commit('accept');
    },
    decline(cid, reason, detail) {
      const c = conv(cid); c.status = 'declined'; c.closedBy = 'seller'; c.closedAt = now(); c.reason = reason; c.reasonDetail = detail || '';
      c.messages.push({ k: 'closed', from: 'seller', verb: 'declined', reason, detail, at: now() });
      if (c.type !== 'requirement') notify('buyer:' + c.buyerId, { kind: 'declined', conv: c.id, title: `${seller(c.sellerId).name} declined your enquiry`, text: reason + (detail ? ' — ' + detail : '') });
      commit('decline');
    },
    close(cid, role, reason, detail) {
      const c = conv(cid); c.status = 'closed'; c.closedBy = role; c.closedAt = now(); c.reason = reason; c.reasonDetail = detail || '';
      c.messages.push({ k: 'closed', from: role, verb: 'closed', reason, detail, at: now() });
      const other = role === 'buyer' ? 'seller:' + c.sellerId : 'buyer:' + c.buyerId;
      const who = role === 'buyer' ? buyer(c.buyerId).name : seller(c.sellerId).name;
      notify(other, { kind: 'closed', conv: c.id, title: `${who} closed the enquiry`, text: reason + (detail ? ' — ' + detail : '') });
      commit('close');
    },
    undoDecline(cid) { const c = conv(cid); c.status = 'pending'; delete c.reason; c.messages = c.messages.filter(m => m.k !== 'closed'); commit('undo'); },
    dealAgreed(cid, role) { const c = conv(cid); c.deal = { by: role, at: now() }; c.messages.push({ k: 'event', text: 'deal', from: role, at: now() }); commit('deal'); },
    message(cid, role, text) {
      const c = conv(cid); c.messages.push({ k: 'text', from: role, text, at: now() }); c.reads[role] = now();
      const other = role === 'buyer' ? 'seller:' + c.sellerId : 'buyer:' + c.buyerId;
      const who = role === 'buyer' ? buyer(c.buyerId).name : seller(c.sellerId).name;
      notify(other, { kind: 'message', conv: c.id, title: 'New message', text: `${who}: ${text.slice(0, 80)}` });
      commit('message');
    },
    markRead(cid, role) { const c = conv(cid); if (!c) return; c.reads = c.reads || {}; c.reads[role] = now(); save(); },
    toggleShortlist(sid) {
      const b = db.accounts.buyer.id; const l = db.shortlists[b] = db.shortlists[b] || [];
      const i = l.indexOf(sid); if (i >= 0) l.splice(i, 1); else l.unshift(sid);
      commit('shortlist'); return i < 0;
    },
    readAllNotifications(who) { db.notifications.forEach(n => { if (n.to === who) n.read = true; }); commit('notif'); },
    registerBuyer(form) {
      const bid = 'u-' + (++db.seq);
      db.buyers.push({ id: bid, name: form.company || 'New buyer', short: form.company || 'New buyer', initials: (form.company || 'NB').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(), contact: form.name, type: 'Food manufacturer', city: '', state: '', rating: 0, enquiries: 0, deals: 0, since: 2026 });
      db.accounts.buyer = { role: 'buyer', id: bid, name: form.name, company: form.company, phone: form.phone, email: form.email };
      db.shortlists[bid] = [];
      db.session = { role: 'buyer' }; commit('session');
    },
    registerSeller(form, products) {
      const sid = 's-' + (++db.seq);
      const cats = {}; (products || []).forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
      db.sellers.push({ id: sid, name: form.company || 'New seller', initial: (form.company || 'N')[0], type: form.type || 'Manufacturer', city: form.city || 'Bengaluru', state: form.state || 'Karnataka', years: 1, certs: ['FSSAI Central'], rating: 0, deals: 0, respond: '—', categories: Object.entries(cats).map(([name, count]) => ({ name, count })), products: (products || []).map(p => p.name), verified: true, isNew: true });
      db.accounts.seller = { role: 'seller', id: sid, name: form.name, company: form.company, phone: form.phone, email: form.email };
      db.catalogue[sid] = (products || []).map(p => ({ name: p.name, category: p.category, moq: '—', status: 'Pending review' }));
      db.session = { role: 'seller' }; commit('session');
    },
    login(role) { db.session = { role }; commit('session'); },
    logout() { db.session = { role: 'guest' }; commit('session'); },
    reset() { const r = db.session.role; db = fresh(); db.session = { role: r }; commit('reset'); }
  };

  return {
    get db() { return db; }, subscribe: fn => subs.push(fn),
    seller, buyer, conv, me, convsFor, unread, lastActivity, sellsAll, sellsProduct, ...A,
    catalogueFor(sid) { return db.catalogue[sid]; },
    notificationsFor(who) { return db.notifications.filter(n => n.to === who); }
  };
})();
