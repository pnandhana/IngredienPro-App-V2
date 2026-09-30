/* One shared record for the whole app. Buyer and seller read and write the
   same conversations, so an enquiry the buyer sends IS the request the seller
   sees. Saved to localStorage and synced live across tabs (open the buyer in
   one tab and the seller in another).

   Model (v4)
   - One conversation per buyer–seller pair. It holds every enquiry that buyer
     has sent that seller, in the order they were sent.
   - Each enquiry has its own reference (ENQ-1001…), products, status
     (pending → active | declined, active → closed) and deal flag. The seller
     accepts or declines each one separately.
   - The conversation's status is derived: active if any enquiry is active,
     pending if none is active but one is waiting, otherwise closed/declined.
   - The app starts empty. Everything in My enQ, the notifications and the
     dashboards comes from what the user does in this browser. */
const Store = (function () {
  const KEY = 'ingredienpro.app.v4';
  const subs = [];
  let db = load();

  function fresh() {
    const accounts = JSON.parse(JSON.stringify(SEED.ACCOUNTS));
    return {
      v: 4,
      session: { role: 'guest' },            // guest | buyer | seller
      accounts,                              // the buyer and seller currently signed in
      sellerAccounts: { [accounts.seller.id]: accounts.seller },  // seller identities used so far
      registered: { buyer: null, seller: null },                  // ids created through Register Free
      sellers: JSON.parse(JSON.stringify(SEED.SELLERS)),
      buyers: JSON.parse(JSON.stringify(SEED.BUYERS)),
      conversations: [],
      notifications: [],
      shortlists: {},
      photos: {},                            // 'buyer:<id>' | 'seller:<id>' → logo/photo, 'cover:<sellerId>' → storefront cover
      stats: { views: {}, search: {} },      // sellerId → [{ by, at }] / count
      catalogue: { ashwin: [
        { name: 'Turmeric Powder, Curcumin ≥5%', category: 'Spices — Whole & Ground', moq: '500 kg', status: 'Live' },
        { name: 'Cardamom 8mm — Green, bold', category: 'Spices — Whole & Ground', moq: '50 kg', status: 'Live' },
        { name: 'Chilli Powder Teja S17', category: 'Spices — Whole & Ground', moq: '1 MT', status: 'Live' },
        { name: 'Turmeric Oleoresin 95%', category: 'Oleoresins & Extracts', moq: '25 kg', status: 'Pending review' },
        { name: 'Black Pepper Powder', category: 'Spices — Whole & Ground', moq: '200 kg', status: 'Pending review' },
        { name: 'Coriander Powder', category: 'Spices — Whole & Ground', moq: '100 kg', status: 'Pending review' } ] },
      seq: 1100,
      enqSeq: 1000,
      ui: { sidebar: 'expanded' }
    };
  }
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); if (!d || d.v !== 4) d = null; } catch (e) {}
    d = d || fresh();
    // the role is per browser tab, so a buyer tab and a seller tab can run side by side
    try { const r = sessionStorage.getItem('ingredienpro.role'); if (r) d.session = { role: r }; } catch (e) {}
    try { const s = sessionStorage.getItem('ingredienpro.sellerAs'); if (s && d.sellerAccounts[s]) d.accounts.seller = d.sellerAccounts[s]; } catch (e) {}
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.warn('Could not save — browser storage is full', e); }
  }
  function emit(kind) { subs.forEach(fn => { try { fn(kind); } catch (e) { console.error(e); } }); }
  function commit(kind) {
    try { sessionStorage.setItem('ingredienpro.role', db.session.role); sessionStorage.setItem('ingredienpro.sellerAs', db.accounts.seller.id); } catch (e) {}
    save(); emit(kind || 'data');
  }
  window.addEventListener('storage', e => { if (e.key === KEY) { db = load(); emit('sync'); } });

  const now = () => new Date().toISOString();
  const id = p => p + '-' + (++db.seq);

  /* ---- lookups ---- */
  const seller = sid => db.sellers.find(s => s.id === sid);
  const buyer = bid => db.buyers.find(b => b.id === bid);
  const conv = cid => db.conversations.find(c => c.id === cid);
  const pairConv = (bid, sid) => db.conversations.find(c => c.buyerId === bid && c.sellerId === sid);
  const enq = (c, eid) => c && c.enquiries.find(e => e.id === eid);
  const me = () => {
    const s = db.session;
    if (s.role === 'buyer') return Object.assign({}, db.accounts.buyer, { org: buyer(db.accounts.buyer.id) });
    if (s.role === 'seller') return Object.assign({}, db.accounts.seller, { org: seller(db.accounts.seller.id) });
    return { role: 'guest' };
  };
  function sellsAll(s, products) { return products.every(p => sellsProduct(s, p.name)); }
  function sellsProduct(s, name) { const base = name.split(/[,—(]/)[0].trim().toLowerCase(); return s.products.some(x => x.toLowerCase() === name.toLowerCase() || x.split(/[,—(]/)[0].trim().toLowerCase() === base); }

  function lastActivity(c) { const m = c.messages[c.messages.length - 1]; return m ? m.at : c.createdAt; }
  function unread(c, role) {
    const seen = (c.reads && c.reads[role]) || '';
    return c.messages.filter(m => m.at > seen && (m.from && m.from !== role) && (m.k === 'text' || m.k === 'file' || (m.k === 'enquiry' && role === 'seller'))).length;
  }
  function convsFor(role) {
    const acc = db.accounts[role]; if (!acc) return [];
    const key = role === 'buyer' ? 'buyerId' : 'sellerId';
    return db.conversations.filter(c => c[key] === acc.id).sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
  }
  /* every enquiry the signed-in buyer sent / seller received, newest first, with its conversation */
  function enquiriesFor(role) {
    return convsFor(role).flatMap(c => c.enquiries.map(e => ({ c, e }))).sort((a, b) => b.e.createdAt.localeCompare(a.e.createdAt));
  }

  /* The conversation's status and headline fields follow its enquiries, so the
     list, previews and routes keep working off `c.status` / `c.products`. */
  function recalc(c) {
    const E = c.enquiries;
    const active = E.some(e => e.status === 'active'), pending = E.some(e => e.status === 'pending');
    c.status = active ? 'active' : pending ? 'pending' : E.every(e => e.status === 'declined') ? 'declined' : 'closed';
    const latest = E[E.length - 1];
    c.products = latest.products; c.type = latest.type;
    c.deal = E.some(e => e.deal);
    if (c.status === 'closed' || c.status === 'declined') {
      const last = E.filter(e => e.closedAt).sort((a, b) => a.closedAt.localeCompare(b.closedAt)).pop() || latest;
      c.closedBy = last.closedBy; c.closedAt = last.closedAt; c.reason = last.reason; c.reasonDetail = last.reasonDetail;
    } else { delete c.closedBy; delete c.closedAt; delete c.reason; delete c.reasonDetail; }
  }

  function notify(to, n) { db.notifications.unshift(Object.assign({ id: id('n'), to, at: now(), read: false }, n)); }
  const prodLine = products => products.map(p => p.name).join(' + ');

  /* ---- actions ---- */
  const A = {
    setRole(role) { db.session = { role }; commit('session'); },
    setSidebar(v) { db.ui.sidebar = v; commit('ui'); },
    /* In Seller view you can act as any seller in the directory, so you can
       answer an enquiry the buyer sent to whoever they picked. */
    setSellerIdentity(sid) {
      const s = seller(sid); if (!s) return;
      if (!db.sellerAccounts[sid]) db.sellerAccounts[sid] = { role: 'seller', id: sid, name: 'Sales team', company: s.name, phone: '', email: '', type: s.type };
      db.accounts.seller = db.sellerAccounts[sid];
      commit('session');
    },

    /* Each seller gets the enquiry in their one chat with this buyer. A second
       enquiry to the same seller joins that chat, as its own enquiry. */
    sendEnquiry({ sellerIds, products, type }) {
      const b = db.accounts.buyer.id; const made = [];
      for (const sid of sellerIds) {
        let c = pairConv(b, sid);
        if (!c) { c = { id: id('c'), buyerId: b, sellerId: sid, createdAt: now(), enquiries: [], messages: [], reads: {} }; db.conversations.unshift(c); }
        const e = { id: 'ENQ-' + (++db.enqSeq), products: JSON.parse(JSON.stringify(products)), type: type || 'direct', status: 'pending', createdAt: now() };
        c.enquiries.push(e);
        c.messages.push({ k: 'enquiry', enq: e.id, from: 'buyer', at: e.createdAt });
        c.reads.buyer = now();
        recalc(c);
        notify('seller:' + sid, { kind: 'request', conv: c.id, enq: e.id, title: `New enquiry ${e.id}`, text: `${buyer(b).name} — ${prodLine(products)}, ${products[0].qty} ${products[0].unit}.` });
        c.lastEnq = e.id; made.push(c);
      }
      commit('enquiry'); return made;
    },
    /* seller accepts one enquiry; without an id, the oldest waiting one */
    accept(cid, eid) {
      const c = conv(cid); const e = eid ? enq(c, eid) : c.enquiries.find(x => x.status === 'pending'); if (!e) return;
      const first = !c.enquiries.some(x => x.acceptedAt);
      e.status = 'active'; e.acceptedAt = now();
      c.messages.push({ k: 'event', text: 'accepted', enq: e.id, from: 'seller', at: now() });
      if (first) c.messages.push({ k: 'notice', at: now() });
      c.reads.seller = now(); recalc(c);
      notify('buyer:' + c.buyerId, { kind: 'accepted', conv: c.id, enq: e.id, title: `${seller(c.sellerId).name} accepted ${e.id}`, text: `${prodLine(e.products)}. ${first ? 'Chat is now open.' : 'It’s now active in your chat.'}` });
      commit('accept');
    },
    decline(cid, eid, reason, detail) {
      const c = conv(cid); const e = enq(c, eid); if (!e) return;
      e.status = 'declined'; e.closedBy = 'seller'; e.closedAt = now(); e.reason = reason; e.reasonDetail = detail || '';
      c.messages.push({ k: 'closed', enq: e.id, from: 'seller', verb: 'declined', reason, detail, at: now() });
      recalc(c);
      notify('buyer:' + c.buyerId, { kind: 'declined', conv: c.id, enq: e.id, title: `${seller(c.sellerId).name} declined ${e.id}`, text: reason + (detail ? ' — ' + detail : '') });
      commit('decline');
    },
    close(cid, eid, role, reason, detail) {
      const c = conv(cid); const e = enq(c, eid); if (!e) return;
      e.status = 'closed'; e.closedBy = role; e.closedAt = now(); e.reason = reason; e.reasonDetail = detail || '';
      c.messages.push({ k: 'closed', enq: e.id, from: role, verb: 'closed', reason, detail, at: now() });
      recalc(c);
      const other = role === 'buyer' ? 'seller:' + c.sellerId : 'buyer:' + c.buyerId;
      const who = role === 'buyer' ? buyer(c.buyerId).name : seller(c.sellerId).name;
      notify(other, { kind: 'closed', conv: c.id, enq: e.id, title: `${who} closed ${e.id}`, text: reason + (detail ? ' — ' + detail : '') });
      commit('close');
    },
    undoDecline(cid, eid) {
      const c = conv(cid); const e = enq(c, eid); if (!e) return;
      e.status = 'pending'; ['closedBy', 'closedAt', 'reason', 'reasonDetail'].forEach(k => delete e[k]);
      c.messages = c.messages.filter(m => !(m.k === 'closed' && m.enq === eid));
      recalc(c); commit('undo');
    },
    dealAgreed(cid, eid, role) {
      const c = conv(cid); const e = enq(c, eid); if (!e || e.deal) return;
      e.deal = { by: role, at: now() };
      c.messages.push({ k: 'event', text: 'deal', enq: e.id, from: role, at: now() });
      recalc(c); commit('deal');
    },
    message(cid, role, text, file) {
      const c = conv(cid);
      c.messages.push(file ? { k: 'file', from: role, name: file.name, size: file.size, at: now() } : { k: 'text', from: role, text, at: now() });
      c.reads[role] = now();
      const other = role === 'buyer' ? 'seller:' + c.sellerId : 'buyer:' + c.buyerId;
      const who = role === 'buyer' ? buyer(c.buyerId).name : seller(c.sellerId).name;
      notify(other, { kind: 'message', conv: c.id, title: 'New message', text: `${who}: ${(file ? '📎 ' + file.name : text).slice(0, 80)}` });
      commit('message');
    },
    markRead(cid, role) { const c = conv(cid); if (!c) return; c.reads = c.reads || {}; c.reads[role] = now(); save(); },
    toggleShortlist(sid) {
      const b = db.accounts.buyer.id; const l = db.shortlists[b] = db.shortlists[b] || [];
      const i = l.indexOf(sid); if (i >= 0) l.splice(i, 1); else l.unshift(sid);
      commit('shortlist'); return i < 0;
    },
    readAllNotifications(who) { db.notifications.forEach(n => { if (n.to === who) n.read = true; }); commit('notif'); },

    /* ---- profile pictures ---- */
    setPhoto(key, dataUrl) { if (dataUrl) db.photos[key] = dataUrl; else delete db.photos[key]; commit('photo'); },

    /* ---- activity the seller dashboard reports on ---- */
    trackView(sid) {
      if (db.session.role !== 'buyer') return;           // guests are masked; sellers and admins don't count
      const list = db.stats.views[sid] = db.stats.views[sid] || [];
      const by = db.accounts.buyer.id; const day = now().slice(0, 10);
      if (!list.some(v => v.by === by && v.at.slice(0, 10) === day)) { list.push({ by, at: now() }); save(); }   // one view per buyer per day
    },
    trackSearch(ids) { if (db.session.role === 'seller') return; ids.forEach(sid => { db.stats.search[sid] = (db.stats.search[sid] || 0) + 1; }); save(); },

    /* ---- Register Free (verification is skipped in this prototype) ---- */
    registerBuyer(form) {
      const bid = 'u-' + (++db.seq);
      const company = form.company || 'New buyer';
      db.buyers.push({ id: bid, name: company, short: company.replace(/ (Pvt )?Ltd\.?$/, ''), initials: initials(company), contact: form.name, type: 'Food business', city: form.city || '', state: '', rating: 0, enquiries: 0, deals: 0, since: new Date().getFullYear() });
      db.accounts.buyer = { role: 'buyer', id: bid, name: form.name, company, phone: form.phone, email: form.email, interests: form.interests || [], locations: form.locations || [], createdAt: now() };
      db.registered.buyer = bid;
      db.shortlists[bid] = [];
      db.session = { role: 'buyer' }; commit('session');
    },
    registerSeller(form, products) {
      const sid = 's-' + (++db.seq);
      const company = form.company || 'New seller';
      const cats = {}; (products || []).forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
      db.sellers.push({ id: sid, name: company, initial: company[0], type: form.type || 'Manufacturer', city: form.city || 'Bengaluru', state: form.state || 'Karnataka', years: 1, certs: ['FSSAI Central'], rating: 0, deals: 0, respond: '—', categories: Object.entries(cats).map(([name, count]) => ({ name, count })), products: (products || []).map(p => p.name), verified: true, isNew: true });
      const acc = { role: 'seller', id: sid, name: form.name, company, phone: form.phone, email: form.email, type: form.type || 'Manufacturer', createdAt: now() };
      db.sellerAccounts[sid] = acc; db.accounts.seller = acc; db.registered.seller = sid;
      db.catalogue[sid] = (products || []).map(p => ({ name: p.name, category: p.category, moq: '—', status: 'Pending review' }));
      db.session = { role: 'seller' }; commit('session');
    },
    updateAccount(role, patch) {
      const acc = db.accounts[role]; Object.assign(acc, patch);
      if (role === 'buyer') { const b = buyer(acc.id); if (b && patch.company) { b.name = patch.company; b.short = patch.company.replace(/ (Pvt )?Ltd\.?$/, ''); b.initials = initials(patch.company); } if (b && patch.name) b.contact = patch.name; }
      if (role === 'seller') { const s = seller(acc.id); if (s && patch.company) { s.name = patch.company; s.initial = patch.company[0]; } if (s && patch.type) s.type = patch.type; }
      commit('account');
    },
    login(role) { db.session = { role }; commit('session'); },
    logout() { db.session = { role: 'guest' }; commit('session'); },
    reset() { const r = db.session.role; db = fresh(); db.session = { role: r }; commit('reset'); }
  };
  function initials(name) { return (name || 'NB').split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

  return {
    get db() { return db; }, subscribe: fn => subs.push(fn),
    seller, buyer, conv, enq, pairConv, me, convsFor, enquiriesFor, unread, lastActivity, sellsAll, sellsProduct, initials, ...A,
    photo: key => db.photos[key] || null,
    /* a directory seller's catalogue is their listed products, all live */
    catalogueFor(sid) {
      if (!db.catalogue[sid]) { const s = seller(sid); if (!s) return []; db.catalogue[sid] = s.products.map(n => ({ name: n, category: ((SEED.PRODUCTS.find(p => p.name === n) || {}).category) || (s.categories[0] || {}).name || '', moq: '—', status: 'Live' })); }
      return db.catalogue[sid];
    },
    notificationsFor(who) { return db.notifications.filter(n => n.to === who); }
  };
})();
