/* My enQ (list + chat) for buyer and seller, bound to Store conversations. */
const Enq = (function () {
  const role = () => Store.db.session.role;
  const other = (c, r) => r === 'buyer' ? Store.seller(c.sellerId) : Store.buyer(c.buyerId);
  const prodLine = c => c.products.map(p => p.name).join(' + ');
  const qtyLine = c => c.products.length > 1 ? c.products.length + ' products' : `${c.products[0].qty} ${c.products[0].unit}`;
  function visible(r) { return Store.convsFor(r).filter(c => !(r === 'buyer' && c.hiddenFromBuyer)); }

  function preview(c, r) {
    if (c.status === 'declined') return r === 'seller' ? 'You declined — ' + (c.reason || '') : 'Declined — ' + (c.reason || '');
    if (c.status === 'closed') return (c.closedBy === r ? 'You closed — ' : 'Closed — ') + (c.reason || '');
    if (c.status === 'pending') return r === 'seller' ? (c.type === 'requirement' ? 'Requirement · ' : 'Enquiry: ') + prodLine(c) + ' · ' + qtyLine(c) : prodLine(c) + ' · Enquiry sent — awaiting reply';
    const m = [...c.messages].reverse().find(x => x.k === 'text' || x.k === 'file');
    const body = m ? (m.from === r ? 'You: ' : '') + (m.k === 'file' ? '📎 ' + m.name : m.text) : (r === 'seller' ? prodLine(c) + ' · you accepted' : prodLine(c) + ' · Accepted');
    return r === 'buyer' ? prodLine(c) + ' · ' + body : body;
  }

  /* Fill one list row (a clone of a Figma row) with a conversation. */
  function fillRow(row, c, r) {
    const o = other(c, r);
    const t = row.querySelector('[data-name="t"]');
    const nameEl = r === 'seller' ? $.texts(row.querySelector('[data-name="n"]') || t)[0] : $.texts(t)[0];
    if (nameEl) nameEl.textContent = o.name;
    const tx = $.texts(t); const prev = tx[tx.length - 1]; if (prev && prev !== nameEl) prev.textContent = preview(c, r);
    const meta = row.querySelector('[data-name="meta"]'); if (meta) { const mt = $.texts(meta); if (mt[0]) mt[0].textContent = $.ago(Store.lastActivity(c)); }
    const u = Store.unread(c, r); const badge = row.querySelector('[data-name="unread badge"]');
    if (badge) { if (u && c.status === 'active') { badge.classList.remove('is-hidden'); $.texts(badge)[0].textContent = String(u); } else badge.classList.add('is-hidden'); }
    const pin = $.text(row, '📌'); if (pin) pin.classList.toggle('is-hidden', !(c.pinned));
    const chip = row.querySelector('[data-name^="Chip / New"]');
    if (chip) { if (c.status === 'pending' && r === 'seller') { $.texts(chip)[0].textContent = c.type === 'requirement' ? 'Requirement' : 'New request'; } else chip.remove(); }
    const tag = row.querySelector('[data-name^="Tag / "]'); if (tag) tag.remove();
    const av = row.querySelector('[data-name="avatar"]'); if (av && $.texts(av)[0]) $.texts(av)[0].textContent = 'IMG';
    row.dataset.conv = c.id;
    $.on(row, () => App.go('/myenq/' + c.id));
  }
  function templates(list, r) {
    const kids = [...list.children];
    const by = n => kids.find(k => k.dataset.name === n || k.dataset.name.startsWith(n));
    if (r === 'buyer') {
      const rows = kids.filter(k => k.dataset.name.startsWith('Chat / '));
      return { sel: rows[0], unread: rows.find(k => /AgroPure/.test(k.dataset.name)) || rows[1] || rows[0], read: rows.find(k => /Nutriva/.test(k.dataset.name)) || rows[rows.length - 1], muted: rows.find(k => /Nutriva/.test(k.dataset.name)) || rows[rows.length - 1] };
    }
    return { sel: by('Lead / sel') || by('Lead / new'), new: by('Lead / new'), unread: by('Lead / unread') || by('Lead / new'), read: by('Lead / read') || by('Lead / awaiting'), muted: by('Lead / muted') || by('Lead / read') };
  }
  function pickTpl(T, c, r, selected) {
    if (selected && T.sel) return T.sel;
    if (c.status === 'declined' || c.status === 'closed') return T.muted || T.read;
    if (r === 'seller' && c.status === 'pending') return T.new || T.unread;
    return Store.unread(c, r) ? T.unread : T.read;
  }
  function drawList(list, r, opts = {}) {
    const T = templates(list, r); const keep = [...list.children].filter(k => !/^(Chat|Lead) \//.test(k.dataset.name));
    const archived = keep.find(k => k.dataset.name === 'Row / Archived');
    const all = visible(r); const closed = all.filter(c => c.status === 'declined' || c.status === 'closed');
    let rows = all.filter(c => opts.showArchived ? (c.status === 'declined' || c.status === 'closed') : !(c.status === 'declined' || c.status === 'closed'));
    if (opts.filter === 'unread') rows = rows.filter(c => Store.unread(c, r) > 0);
    if (opts.filter === 'requests') rows = rows.filter(c => c.status === 'pending');
    if (opts.q) { const q = opts.q.toLowerCase(); rows = rows.filter(c => (other(c, r).name + ' ' + prodLine(c) + ' ' + c.messages.map(m => m.text || '').join(' ')).toLowerCase().includes(q)); }
    [...list.children].filter(k => /^(Chat|Lead) \//.test(k.dataset.name) || k.classList.contains('empty-note')).forEach(k => k.remove());
    if (archived) {
      const t = $.texts(archived); const label = t.find(x => /^(Archived|← Back to chats)$/.test(x.textContent.trim())); const num = t[t.length - 1];
      if (label) label.textContent = opts.showArchived ? '← Back to chats' : 'Archived'; if (num && num !== label) num.textContent = opts.showArchived ? '' : String(closed.length);
      $.on(archived, () => { opts.showArchived = !opts.showArchived; opts.redraw(); });
    }
    rows.forEach(c => { const tpl = pickTpl(T, c, r, c.id === opts.selected); if (!tpl) return; const row = $.clone(tpl); fillRow(row, c, r); list.appendChild(row); });
    if (!rows.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = opts.q || opts.filter ? 'No chats match.' : opts.showArchived ? 'Nothing archived yet.' : (r === 'buyer' ? 'No chats yet. Find a seller and send an enquiry — the chat appears here.' : 'No enquiries yet. Requests from buyers appear here.'); list.appendChild(e); }
    return { all, rows };
  }

  /* ---------- My enQ list page ---------- */
  function listPage(el, p) {
    const r = role();
    const list = el.querySelector('[data-name="Chat list"], [data-name="Lead list"]'); if (!list) return;
    const opts = { filter: p.filter || null, q: '', showArchived: false, redraw: () => draw() };
    function draw() {
      const { all } = drawList(list, r, opts);
      const unread = all.filter(c => Store.unread(c, r) > 0).length, reqs = all.filter(c => c.status === 'pending').length;
      const sub = $.text(el.querySelector('[data-name="Page head"]') || el, /chats ·|chats$/);
      if (sub) sub.textContent = r === 'seller' ? `${all.length} chats · ${reqs} new request${reqs === 1 ? '' : 's'} · ${unread} unread` : `${all.length} chats · ${unread} unread`;
      el.querySelectorAll('[data-name="Chip / All"], [data-name="Pill / All"], [data-name="Chip / Unread"], [data-name="Filter / Requests"], [data-name="Filter / Unread"]').forEach(ch => {
        const k = /Unread/.test(ch.dataset.name) ? 'unread' : /Requests/.test(ch.dataset.name) ? 'requests' : null; const on = opts.filter === k;
        ch.style.background = on ? '#111111' : '#ffffff'; ch.style.borderColor = on ? '#111111' : '#d0d0d0'; $.texts(ch).forEach(t => t.style.color = on ? '#ffffff' : '#111111');
      });
      const foot = $.text(el, /^Showing \d+ of/); if (foot) foot.textContent = `Showing ${list.querySelectorAll('[data-conv]').length} of ${all.length} chats · latest activity first`;
      const more = el.querySelector('[data-name="Btn / Load more"]'); if (more) more.style.display = 'none';
    }
    el.querySelectorAll('[data-name="Chip / All"], [data-name="Pill / All"], [data-name="Chip / Unread"], [data-name="Filter / Requests"], [data-name="Filter / Unread"]').forEach(ch => $.on(ch, () => { opts.filter = /Unread/.test(ch.dataset.name) ? 'unread' : /Requests/.test(ch.dataset.name) ? 'requests' : null; draw(); }));
    const search = el.querySelector('[data-name="Search & filters"] [data-name="Search"]');
    if (search) searchInput(search, q => { opts.q = q; draw(); });
    draw();
    const note = $.text(el, /^Every enquiry/); if (note && r === 'buyer') note.textContent = 'Every enquiry opens its own chat with that seller — including each seller who accepts a requirement you posted. “Awaiting reply” chats open fully once the seller accepts.';
  }
  function searchInput(box, onInput) {
    const t = $.texts(box).filter(x => x.textContent.trim().length > 2).pop(); if (!t) return;
    t.dataset.placeholder = t.textContent; t.textContent = ''; t.setAttribute('contenteditable', 'plaintext-only'); t.classList.add('editable', 'with-placeholder'); t.dataset.bound = '1'; t.style.minWidth = '160px'; t.style.flex = '1 1 auto';
    t.addEventListener('input', () => onInput(t.textContent.trim()));
    $.on(box, () => t.focus());
  }

  /* ---------- chat page ---------- */
  async function chatPage(el, p) {
    const r = role(); const c = Store.conv(p.id); if (!c) return App.go('/myenq');
    const o = other(c, r);
    Store.markRead(c.id, r);
    // left list
    const list = el.querySelector('[data-name="Pane / My enQ"]');
    if (list) {
      const opts = { selected: c.id, q: '', redraw: () => drawList(list, r, opts) }; drawList(list, r, opts);
      const cnt = list.querySelector('[data-name="head"]'); if (cnt) { const t = $.texts(cnt); if (t[1]) t[1].textContent = String(visible(r).length); }
      const s = list.querySelector('[data-name="Search"] [data-name="Search"]') || list.querySelector('[data-name="Search"]'); if (s) searchInput(s, q => { opts.q = q; drawList(list, r, opts); });
    }
    // header
    const head = el.querySelector('[data-name="Thread head"]');
    if (head) {
      const rr = head.querySelector('[data-name="r"]'); const nm = rr ? $.texts(rr)[0] : null; if (nm) nm.textContent = o.name;
      const rating = rr && $.texts(rr).find(x => /^★/.test(x.textContent.trim())); if (rating) rating.textContent = '★ ' + o.rating;
      const line = $.texts(head).find(x => /local time|accepts within/.test(x.textContent)); if (line) line.textContent = `${o.city}, ${o.state}   ·   ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} local time  ⓘ   ·   ${r === 'buyer' ? (c.status === 'pending' ? 'usually accepts within ' + (o.respond || '~4 hrs') : 'replies in ' + (o.respond || '~2 hrs')) : 'replies in ~3 hrs'}`;
      $.on(head.querySelector('[data-name="t"]'), () => r === 'buyer' && App.go('/seller/' + c.sellerId));
    }
    await drawMessages(el, c, r);
    bindBottom(el, c, r, o);
    twoColumn(el, c, r, o);
    // breadcrumb last crumb
    const bc = el.querySelector('[data-name="Breadcrumb"]'); if (bc) { const t = $.texts(bc); t[t.length - 1].textContent = o.name; }
  }

  const T = {}; // cached message templates
  async function msgTemplates() {
    if (T.ready) return T;
    const g = (s, n, f) => Tpl.get(s, n, f);
    const isFile = m => /\.pdf/.test(m.textContent);
    Object.assign(T, {
      dateB: await g(F.B.chat, 'Date divider'), dateS: await g(F.S.chat, 'Date divider'),
      enqB: await g(F.B.chat, 'Msg / enquiry (automated)'), enqS: await g(F.S.chat, 'Msg / enquiry (automated)'),
      eventB: await g(F.B.chat, 'Event / ✓  Ashwin Spice Works accepted') || (await Tpl.screen(F.B.chat)).querySelector('[data-name^="Event /"]').cloneNode(true),
      eventS: (await Tpl.screen(F.S.chat)).querySelector('[data-name^="Event /"]').cloneNode(true),
      waitB: (await Tpl.screen(F.B.chatWait)).querySelector('[data-name^="Event / Waiting"]').cloneNode(true),
      noticeB: await g(F.B.chat, 'System notice'), noticeS: await g(F.S.chat, 'System notice'),
      inB: await g(F.B.chat, 'Msg / incoming', m => !isFile(m)), inFileB: await g(F.B.chat, 'Msg / incoming', isFile),
      outB: await g(F.B.chat, 'Msg / outgoing', m => !/▶/.test(m.textContent) && !isFile(m)),
      outS: await g(F.S.chat, 'Msg / outgoing', m => !isFile(m)), outFileS: await g(F.S.chat, 'Msg / outgoing', isFile),
      reasonMine: await g(F.B.closed, 'Msg / close reason'),
      ready: true
    });
    T.inS = T.inB; T.inFileS = T.inFileB; T.outFileB = T.outFileS;
    return T;
  }
  function stamp(el, iso, ticks) { const t = $.texts(el).filter(x => /^\d{1,2}:\d{2}/.test(x.textContent.trim())).pop(); if (t) t.textContent = $.time(iso) + (ticks ? '  ✓✓' : ''); }
  function bubbleText(node, text) { const ts = $.texts(node).filter(x => !/^\d{1,2}:\d{2}/.test(x.textContent.trim())); const b = ts.sort((a, b) => b.textContent.length - a.textContent.length)[0]; if (b) b.textContent = text; }

  async function drawMessages(el, c, r) {
    const box = el.querySelector('[data-name="Messages"]'); if (!box) return;
    const t = await msgTemplates(); const mineOut = r === 'buyer' ? t.outB : t.outS;
    $.clear(box); let lastDay = '';
    const add = n => { if (n) { box.appendChild(n); } return n; };
    for (const m of c.messages) {
      const day = $.day(m.at); if (day !== lastDay) { const d = $.clone(r === 'buyer' ? t.dateB : t.dateS); $.texts(d)[0].textContent = day === 'Today' ? 'Today, ' + $.time(m.at) : day; add(d); lastDay = day; }
      const mine = m.from === r;
      if (m.k === 'enquiry') add(enquiryCard(c, r, m, r === 'buyer' ? t.enqB : t.enqS));
      else if (m.k === 'event') {
        const e = $.clone(r === 'buyer' ? t.eventB : t.eventS);
        const txt = m.text === 'deal' ? `✓  Deal marked as agreed · ${$.time(m.at)}` : r === 'buyer' ? `✓  ${Store.seller(c.sellerId).name} accepted your enquiry · ${$.time(m.at)} — you can now message each other` : `✓  You accepted this request · ${$.time(m.at)}`;
        $.texts(e)[0].textContent = txt; add(e);
      }
      else if (m.k === 'notice') add($.clone(r === 'buyer' ? t.noticeB : t.noticeS));
      else if (m.k === 'text') { const b = $.clone(mine ? mineOut : t.inB); bubbleText(b, m.text); stamp(b, m.at, mine); b.querySelectorAll('[data-name*="Translated"], [data-name*="See original"]').forEach(x => x.remove()); add(b); }
      else if (m.k === 'file') { const b = $.clone(mine ? t.outFileS : t.inFileB); const ts = $.texts(b); const nm = ts.find(x => /\.pdf/.test(x.textContent)); if (nm) nm.textContent = m.name; const sz = ts.find(x => /PDF ·/.test(x.textContent)); if (sz) sz.textContent = m.size; stamp(b, m.at, mine); add(b); }
      else if (m.k === 'closed') {
        const e = $.clone(r === 'buyer' ? t.eventB : t.eventS); const who = mine ? 'You' : other(c, r).name;
        $.texts(e)[0].textContent = `${who} ${m.verb} this enquiry · ${$.day(m.at) === 'Today' ? $.time(m.at) : $.day(m.at)}`; e.querySelectorAll('div').forEach(d => { if (d.style.background && d.style.background !== 'rgb(242, 242, 242)') d.style.background = '#F2F2F2'; d.style.borderColor = 'transparent'; }); add(e);
        if (mine) { const b = $.clone(t.reasonMine); const ts = $.texts(b); ts[0].textContent = m.verb === 'declined' ? 'REASON FOR DECLINING' : 'REASON FOR CLOSING'; ts[1].textContent = m.reason; if (ts[2] && !/^\d{1,2}:/.test(ts[2].textContent)) { if (m.detail) ts[2].textContent = m.detail; else ts[2].remove(); } stamp(b, m.at, true); add(b); }
        else { const b = $.clone(t.inB); bubbleText(b, 'Reason: ' + m.reason + (m.detail ? ' — ' + m.detail : '')); stamp(b, m.at); add(b); }
      }
    }
    if (c.status === 'pending' && r === 'buyer') { const w = $.clone(t.waitB); $.texts(w)[0].textContent = `Waiting for ${Store.seller(c.sellerId).name} to accept — you can send more messages after that`; add(w); }
    box.dataset.bound = '1';
    requestAnimationFrame(() => { const last = box.lastElementChild; if (last && c.messages.length > 4) last.scrollIntoView({ block: 'nearest' }); });
  }
  function enquiryCard(c, r, m, tpl) {
    const e = $.clone(tpl); const bubble = e.querySelector('[data-name="bubble"]') || e;
    const ts = $.texts(bubble);
    const tag = ts[0]; const product = ts[1];
    tag.textContent = c.type === 'requirement' ? (r === 'seller' ? `REQUIREMENT  ·  POSTED TO ALL SELLERS IN ${c.products[0].category.toUpperCase()}` : 'YOUR REQUIREMENT  ·  SENT TO SELLERS IN THIS CATEGORY') : c.products.length > 1 ? `ENQUIRY  ·  ${c.products.length} PRODUCTS  ·  SENT FROM THE ENQUIRY FORM` : 'ENQUIRY  ·  SENT FROM THE ENQUIRY FORM';
    const details = bubble.querySelector('[data-name="Details"]');
    const fillOne = (pEl, dEl, pr) => {
      pEl.textContent = pr.name;
      if (dEl) { const d = $.texts(dEl); const qi = d.findIndex(x => x.textContent.trim() === 'Quantity'); if (qi >= 0 && d[qi + 1]) d[qi + 1].textContent = `${pr.qty} ${pr.unit}`; const ni = d.findIndex(x => x.textContent.trim() === 'Notes'); if (ni >= 0 && d[ni + 1]) { if (pr.notes) d[ni + 1].textContent = pr.notes; else (d[ni].closest('[data-name="Notes"]') || d[ni + 1].parentElement).style.display = 'none'; } }
    };
    fillOne(product, details, c.products[0]);
    let after = details || product;
    c.products.slice(1).forEach(pr => { const pn = product.cloneNode(true); const dn = details ? details.cloneNode(true) : null; after.after(pn); if (dn) pn.after(dn); fillOne(pn, dn, pr); pn.style.marginTop = '8px'; after = dn || pn; });
    stamp(bubble, m.at, r === 'buyer');
    return e;
  }

  function bindBottom(el, c, r, o) {
    const composer = el.querySelector('[data-name="Composer"]');
    if (composer && c.status === 'active') {
      composer.dataset.bound = '1';
      const inputBox = composer.querySelector('[data-name="input"]');
      const ph = inputBox ? $.texts(inputBox)[0] : null;
      if (ph) {
        ph.dataset.placeholder = 'Write a message'; ph.textContent = ''; ph.setAttribute('contenteditable', 'plaintext-only'); ph.classList.add('composer-input'); ph.style.flex = '1 1 auto'; ph.style.minWidth = '200px'; ph.style.outline = 'none';
        const send = () => { const v = ph.textContent.trim(); if (!v) return; Store.message(c.id, r, v); App.refresh(); };
        ph.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
        $.on(inputBox, () => ph.focus());
        $.on(composer.querySelector('[data-name="Btn / Send"]'), send);
        composer.querySelectorAll('[data-name="Chat starters"] > [data-name^="Chip /"]').forEach(ch => $.on(ch, () => { ph.textContent = ch.textContent.trim(); ph.focus(); }));
        const clip = composer.querySelector('[data-name="Icon / 📎"]'); $.on(clip, () => { const f = document.createElement('input'); f.type = 'file'; f.onchange = () => { if (f.files[0]) { const fl = f.files[0]; c.messages.push({ k: 'file', from: r, name: fl.name, size: (fl.type.split('/')[1] || 'file').toUpperCase() + ' · ' + Math.max(1, Math.round(fl.size / 1024)) + ' KB', at: new Date().toISOString() }); Store.message(c.id, r, '📎 ' + fl.name); c.messages.pop(); App.refresh(); } }; f.click(); });
        setTimeout(() => ph.focus({ preventScroll: true }), 50);
      }
    }
    if (composer && c.status === 'pending' && r === 'buyer') {
      composer.dataset.bound = '1';
      $.set(composer, /^This chat started/, `This chat started with your enquiry. ${o.name} will reply here once they accept it.`);
    }
    const bar = el.querySelector('[data-name="Chat request bar"]');
    if (bar) {
      const title = bar.querySelector('[data-name="Title"]'); if (title) $.texts(title)[0].textContent = o.name;
      const av = bar.querySelector('[data-name="Avatar"]'); if (av) $.texts(av)[0].textContent = o.initials || o.name.slice(0, 2).toUpperCase();
      $.on(bar.querySelector('[data-name="Button / Accept"]'), () => { Store.accept(c.id); App.toast(`Accepted — you can now chat with ${o.name}`); App.refresh(); });
      $.on(bar.querySelector('[data-name="Button / Decline"]'), () => Modals.reasons({ mode: 'decline', conv: c }));
    }
    const closedBar = el.querySelector('[data-name="Closed bar (read-only)"]');
    if (closedBar) {
      const ts = $.texts(closedBar);
      if (ts[0]) ts[0].textContent = c.closedBy === r ? '🔒  Enquiry closed — this chat is read-only' : `🔒  ${o.name} ${c.status === 'declined' ? 'declined' : 'closed'} this enquiry — this chat is read-only`;
      if (ts[1]) ts[1].textContent = c.closedBy === r ? `${o.name} can see your reason.${r === 'buyer' ? ' Need it again? Send a new enquiry to this seller.' : ' They can send you a new enquiry any time.'}` : `Reason: ${c.reason}${c.reasonDetail ? ' — ' + c.reasonDetail : ''}`;
      $.on(closedBar.querySelector('[data-name="Button / Send new enquiry"]'), () => Modals.enquiry({ sellerId: c.sellerId, product: c.products[0].name }));
    }
    const declined = el.querySelector('[data-name="Declined bar"]');
    if (declined) {
      const ts = $.texts(declined); if (ts[1]) ts[1].textContent = `${o.name} can see your reason. This chat is closed — they can send a new enquiry later.`;
      const undo = declined.querySelector('[data-name="Button / Undo"]'); const age = (Date.now() - new Date(c.closedAt || 0)) / 1000;
      if (undo) { if (age < 300) { const left = Math.ceil((300 - age) / 60); $.texts(undo)[0].textContent = `Undo · ${left} min`; $.on(undo, () => { Store.undoDecline(c.id); App.refresh(); }); } else undo.style.display = 'none'; }
    }
  }

  /* My enQ is two columns: chats + the open chat. What used to sit in the third
     column now lives in the header (identity), a meta strip (enquiry facts) and
     a ··· menu (actions). */
  function twoColumn(el, c, r, o) {
    const panes = el.querySelector('[data-name="Panes"]'); if (!panes) return;
    const ctx = panes.querySelector('[data-name="Pane / Context"]');
    const facts = ctx ? readFacts(ctx) : null;
    if (ctx) ctx.remove();
    const list = panes.querySelector('[data-name="Pane / My enQ"], [data-name="Lead list"]');
    if (list) { list.style.flex = '0 0 340px'; list.style.width = '340px'; }
    const thread = [...panes.children].find(x => /Thread/.test(x.dataset.name || ''));
    if (thread) { thread.style.flex = '1 1 0'; thread.style.minWidth = '0'; }
    const head = el.querySelector('[data-name="Thread head"]'); if (!head) return;
    head.style.alignItems = 'center';
    const t = head.querySelector('[data-name="t"]'); if (t) { t.style.flex = '1 1 0'; t.style.minWidth = '0'; }
    if (!head.querySelector('.more-btn')) head.appendChild(moreButton(c, r, o));
    const holder = head.parentElement;
    if (!holder.querySelector('.enq-meta')) holder.insertBefore(metaStrip(c, r, facts), head.nextSibling);
  }
  function readFacts(ctx) {
    const card = ctx.querySelector('[data-name="Card / This enquiry"]'); if (!card) return null;
    const f = {}; card.querySelectorAll('[data-name^="row / "]').forEach(rw => { const [k, v] = $.texts(rw); if (k && v) f[k.textContent.trim()] = v.textContent.trim(); });
    return f;
  }
  function metaStrip(c, r, facts) {
    const st = { pending: r === 'seller' ? 'New request' : 'Awaiting acceptance', active: c.deal ? 'Deal agreed' : 'Active', declined: 'Declined', closed: 'Closed' }[c.status];
    const bits = [prodLine(c), c.products.map(p => p.qty + ' ' + p.unit).join(' + '),
      c.type === 'requirement' ? 'Posted requirement · ' + c.products[0].category : c.type === 'similar' ? 'Also sent to similar sellers' : 'Direct enquiry',
      (c.status === 'closed' || c.status === 'declined') ? 'Closed ' + $.day(c.closedAt) : (r === 'buyer' ? 'Sent ' : 'Received ') + $.day(c.createdAt).replace(/ \d{4}$/, '')];
    const wrap = document.createElement('div'); wrap.className = 'enq-meta';
    const line = document.createElement('div'); line.className = 'enq-meta-line';
    const strong = document.createElement('strong'); strong.textContent = bits[0]; line.appendChild(strong);
    line.appendChild(document.createTextNode('   ·   ' + bits.slice(1).join('   ·   ')));
    const pill = document.createElement('span'); pill.className = 'enq-meta-pill' + (c.status === 'active' || (c.status === 'pending' && r === 'seller') ? ' on' : '');
    pill.textContent = st;
    wrap.append(line, pill);
    return wrap;
  }
  function moreButton(c, r, o) {
    const b = document.createElement('div'); b.className = 'more-btn'; b.textContent = '···'; b.title = 'More';
    b.addEventListener('click', e => {
      e.stopPropagation();
      const open = document.querySelector('.more-menu'); if (open) { open.remove(); return; }
      const menu = document.createElement('div'); menu.className = 'more-menu';
      const items = [];
      if (r === 'buyer') items.push(['View seller profile', () => App.go('/seller/' + c.sellerId)]);
      if (c.status === 'active') {
        items.push([c.deal ? '✓ Deal marked as agreed' : 'Mark deal agreed', c.deal ? null : () => { Store.dealAgreed(c.id, r); App.toast('Deal marked as agreed'); App.refresh(); }]);
        items.push(['Close enquiry', () => Modals.reasons({ mode: 'close', conv: c })]);
      }
      if (c.status === 'pending' && r === 'seller') {
        items.push(['Accept request', () => { Store.accept(c.id); App.refresh(); }]);
        items.push(['Decline request', () => Modals.reasons({ mode: 'decline', conv: c })]);
      }
      if (c.status === 'closed' || c.status === 'declined') items.push([r === 'buyer' ? 'Send a new enquiry' : 'Waiting on the buyer', r === 'buyer' ? () => Modals.enquiry({ sellerId: c.sellerId, product: c.products[0].name }) : null]);
      items.push([r === 'buyer' ? 'About ' + o.name : 'About ' + o.name, () => App.toast(`${o.name} · ${o.type} · ${o.city}, ${o.state} · ★ ${o.rating}`)]);
      items.forEach(([label, fn]) => { const it = document.createElement('button'); it.textContent = label; it.disabled = !fn; it.onclick = ev => { ev.stopPropagation(); menu.remove(); fn && fn(); }; menu.appendChild(it); });
      b.appendChild(menu);
      setTimeout(() => document.addEventListener('click', function off() { menu.remove(); document.removeEventListener('click', off); }, { once: true }), 0);
    });
    return b;
  }

  function context(el, c, r, o) {
    const ctx = el.querySelector('[data-name="Pane / Context"]'); if (!ctx) return;
    const card = ctx.querySelector('[data-name="Card / Seller"], [data-name="Card / Buyer"]');
    if (card) {
      const idn = card.querySelector('[data-name="identity"]'); const it = $.texts(idn);
      it[0].textContent = (o.initials || o.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2)).toUpperCase(); it[1].textContent = o.name; it[2].textContent = `${o.type} · ${o.city}, ${o.state}`;
      const rows = card.querySelectorAll('[data-name^="row / "]');
      rows.forEach(rw => { const [k, v] = $.texts(rw); const key = k.textContent.trim();
        if (key === 'Rating') v.textContent = '★ ' + o.rating; if (key === 'Avg. response') v.textContent = o.respond || '~2 hrs'; if (key === 'Enquiries sent') v.textContent = String(o.enquiries); if (key === 'Deals concluded') v.textContent = String(o.deals); if (key === 'Response rate') v.textContent = Math.round(80 + (o.rating - 4) * 20) + '%'; });
      const badges = card.querySelector('[data-name="badges"]'); if (badges && r === 'buyer') { const pills = [...badges.children]; pills.slice(1).forEach((pl, i) => { if (o.certs && o.certs[i]) $.texts(pl)[0].textContent = o.certs[i].split(':')[0].replace(' Central', ''); else pl.remove(); }); }
      if (badges && r === 'seller') { const t = $.texts(badges); if (t[1]) t[1].textContent = 'Member since ' + o.since; }
      $.on(card.querySelector('[data-name="Button / View seller profile"]'), () => App.go('/seller/' + c.sellerId));
      $.on(card.querySelector('[data-name="Button / View buyer profile"]'), () => App.toast('Buyer profiles are coming soon'));
    }
    const en = ctx.querySelector('[data-name="Card / This enquiry"]');
    if (en) {
      const st = { pending: r === 'seller' ? 'New request' : 'Awaiting acceptance', active: c.deal ? 'Deal agreed' : 'Active', declined: 'Declined', closed: 'Closed' }[c.status];
      const pill = en.querySelector('[data-name^="Pill / "]'); if (pill) { $.texts(pill)[0].textContent = st; const dark = c.status === 'active' || (c.status === 'pending' && r === 'seller'); pill.style.background = dark ? '#111111' : '#F2F2F2'; $.texts(pill)[0].style.color = dark ? '#ffffff' : '#333333'; }
      en.querySelectorAll('[data-name^="row / "]').forEach(rw => { const [k, v] = $.texts(rw); const key = k.textContent.trim();
        if (key === 'Product') v.textContent = prodLine(c); if (key === 'Quantity') v.textContent = c.products.map(p => `${p.qty} ${p.unit}`).join(' + ');
        if (key === 'Type') v.textContent = c.type === 'requirement' ? `Posted requirement · all sellers in ${c.products[0].category}` : c.type === 'similar' ? 'Also sent to similar sellers' : 'Direct enquiry';
        if (key === 'Date' || key === 'Closed') { k.textContent = c.status === 'closed' || c.status === 'declined' ? 'Closed' : 'Date'; v.textContent = c.status === 'closed' || c.status === 'declined' ? `${$.day(c.closedAt)} — reason in chat` : (r === 'buyer' ? 'Sent ' : 'Received ') + $.day(c.createdAt).replace(/ \d{4}$/, ''); } });
    }
    const next = ctx.querySelector('[data-name="Card / Next steps"]');
    if (next) {
      if (c.status !== 'active') next.style.display = 'none';
      const deal = next.querySelector('[data-name="Button / Mark deal agreed"]');
      if (c.deal) { $.texts(deal)[0].textContent = '✓ Deal marked as agreed'; deal.style.opacity = 0.6; }
      else $.on(deal, () => { Store.dealAgreed(c.id, r); App.toast('Deal marked as agreed'); App.refresh(); });
      $.on(next.querySelector('[data-name="Button / Close enquiry"]'), () => Modals.reasons({ mode: 'close', conv: c }));
    }
  }

  return { listPage, chatPage, drawList, prodLine };
})();
Pages.myenq = Enq.listPage;
Pages.chat = Enq.chatPage;
