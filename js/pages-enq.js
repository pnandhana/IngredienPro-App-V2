/* My enQ (list + chat) for buyer and seller, bound to Store conversations.

   One chat per buyer–seller pair. Every enquiry the buyer sends that seller lands
   in the same chat as its own card, and is registered in the panel on the right
   with its reference and status. Clicking an enquiry in the panel scrolls the chat
   back to the point where it was sent, so an older enquiry never gets buried. */
const Enq = (function () {
  const role = () => Store.db.session.role;
  const other = (c, r) => r === 'buyer' ? Store.seller(c.sellerId) : Store.buyer(c.buyerId);
  const otherKey = (c, r) => r === 'buyer' ? 'seller:' + c.sellerId : 'buyer:' + c.buyerId;
  const prodLine = c => c.products.map(p => p.name).join(' + ');
  const eLine = e => e.products.map(p => p.name).join(' + ');
  const eQty = e => e.products.map(p => `${p.qty} ${p.unit}`).join(' + ');
  function visible(r) { return Store.convsFor(r); }
  const STATUS = (e, r) => ({ pending: r === 'seller' ? 'New request' : 'Awaiting acceptance', active: e.deal ? 'Deal agreed' : 'Active', declined: 'Declined', closed: 'Closed' }[e.status]);

  function preview(c, r) {
    const pend = c.enquiries.filter(e => e.status === 'pending');
    if (c.status === 'declined') return r === 'seller' ? 'You declined — ' + (c.reason || '') : 'Declined — ' + (c.reason || '');
    if (c.status === 'closed') return (c.closedBy === r ? 'You closed — ' : 'Closed — ') + (c.reason || '');
    if (c.status === 'pending') return r === 'seller' ? (pend.length > 1 ? `${pend.length} new enquiries · ` : 'New enquiry · ') + eLine(pend[pend.length - 1]) : prodLine(c) + ' · Awaiting acceptance';
    if (r === 'seller' && pend.length) return `New enquiry · ${eLine(pend[pend.length - 1])}`;
    const m = [...c.messages].reverse().find(x => x.k === 'text' || x.k === 'file');
    const body = m ? (m.from === r ? 'You: ' : '') + (m.k === 'file' ? '📎 ' + m.name : m.text) : (r === 'seller' ? prodLine(c) + ' · you accepted' : prodLine(c) + ' · Accepted');
    return body;
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
    if (badge) { if (u && c.status !== 'closed' && c.status !== 'declined') { badge.classList.remove('is-hidden'); $.texts(badge)[0].textContent = String(u); } else badge.classList.add('is-hidden'); }
    const pin = $.text(row, '📌'); if (pin) pin.classList.add('is-hidden');
    const pending = c.enquiries.filter(e => e.status === 'pending').length;
    const chip = row.querySelector('[data-name^="Chip / New"]');
    if (chip) { if (pending && r === 'seller') $.texts(chip)[0].textContent = pending > 1 ? pending + ' new requests' : 'New request'; else chip.remove(); }
    const tag = row.querySelector('[data-name^="Tag / "]'); if (tag) tag.remove();
    const av = row.querySelector('[data-name="avatar"]') || row.querySelector('[data-name="Avatar slot"] [data-name]');
    Photo.paint(av, Store.photo(otherKey(c, r)), o.initials || o.initial || Store.initials(o.name));
    if (c.enquiries.length > 1) { const cnt = document.createElement('span'); cnt.className = 'row-enq-count'; cnt.textContent = c.enquiries.length + ' enquiries'; (meta || t).appendChild(cnt); }
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
    if (r === 'seller' && c.enquiries.some(e => e.status === 'pending')) return T.new || T.unread;
    return Store.unread(c, r) ? T.unread : T.read;
  }
  function drawList(list, r, opts = {}) {
    const T = templates(list, r); const keep = [...list.children].filter(k => !/^(Chat|Lead) \//.test(k.dataset.name));
    const archived = keep.find(k => k.dataset.name === 'Row / Archived');
    const all = visible(r); const closed = all.filter(c => c.status === 'declined' || c.status === 'closed');
    let rows = all.filter(c => opts.showArchived ? (c.status === 'declined' || c.status === 'closed') : !(c.status === 'declined' || c.status === 'closed'));
    if (opts.filter === 'unread') rows = rows.filter(c => Store.unread(c, r) > 0);
    if (opts.filter === 'requests') rows = rows.filter(c => c.enquiries.some(e => e.status === 'pending'));
    if (opts.q) { const q = opts.q.toLowerCase(); rows = rows.filter(c => (other(c, r).name + ' ' + c.enquiries.map(e => e.id + ' ' + eLine(e)).join(' ') + ' ' + c.messages.map(m => m.text || '').join(' ')).toLowerCase().includes(q)); }
    [...list.children].filter(k => /^(Chat|Lead) \//.test(k.dataset.name) || k.classList.contains('empty-note')).forEach(k => k.remove());
    if (archived) {
      const t = $.texts(archived); const label = t.find(x => /^(Archived|← Back to chats)$/.test(x.textContent.trim())); const num = t[t.length - 1];
      if (label) label.textContent = opts.showArchived ? '← Back to chats' : 'Archived'; if (num && num !== label) num.textContent = opts.showArchived ? '' : String(closed.length);
      archived.classList.toggle('is-hidden', !closed.length && !opts.showArchived);
      $.on(archived, () => { opts.showArchived = !opts.showArchived; opts.redraw(); });
    }
    rows.forEach(c => { const tpl = pickTpl(T, c, r, c.id === opts.selected); if (!tpl) return; const row = $.clone(tpl); fillRow(row, c, r); list.appendChild(row); });
    if (!rows.length) { const e = document.createElement('div'); e.className = 'empty-note'; e.textContent = opts.q || opts.filter ? 'No chats match.' : opts.showArchived ? 'Nothing archived yet.' : (r === 'buyer' ? 'No enquiries yet. Find a seller and send an enquiry — it appears here, and the chat opens once the seller accepts.' : 'No enquiries yet. When a buyer sends you one, it appears here to accept or decline.'); list.appendChild(e); }
    return { all, rows };
  }

  /* ---------- My enQ list page ---------- */
  function listPage(el, p) {
    const r = role();
    const list = el.querySelector('[data-name="Chat list"], [data-name="Lead list"], [data-name="Pane / My enQ"]'); if (!list) return;
    const opts = { filter: p.filter || null, q: '', showArchived: false, redraw: () => draw() };
    function draw() {
      const { all } = drawList(list, r, opts);
      const unread = all.filter(c => Store.unread(c, r) > 0).length, reqs = all.reduce((n, c) => n + c.enquiries.filter(e => e.status === 'pending').length, 0);
      const sub = $.text(el.querySelector('[data-name="Page head"]') || el, /chats ·|chats$/);
      if (sub) sub.textContent = r === 'seller' ? `${all.length} chats · ${reqs} new request${reqs === 1 ? '' : 's'} · ${unread} unread` : `${all.length} chats · ${unread} unread`;
      el.querySelectorAll('[data-name="Chip / All"], [data-name="Pill / All"], [data-name="Chip / Unread"], [data-name="Filter / Requests"], [data-name="Filter / Unread"]').forEach(ch => {
        const k = /Unread/.test(ch.dataset.name) ? 'unread' : /Requests/.test(ch.dataset.name) ? 'requests' : null; const on = opts.filter === k;
        ch.style.background = on ? '#111111' : '#ffffff'; ch.style.borderColor = on ? '#111111' : '#d0d0d0'; $.texts(ch).forEach(t => t.style.color = on ? '#ffffff' : '#111111');
      });
      const foot = $.text(el, /^Showing \d+ of/); if (foot) foot.textContent = `Showing ${list.querySelectorAll('[data-conv]').length} of ${all.length} chats · latest activity first`;
      const more = el.querySelector('[data-name="Btn / Load more"]'); if (more) more.style.display = 'none';
      const cnt = list.querySelector('[data-name="head"]'); if (cnt) { const t = $.texts(cnt); if (t[1]) t[1].textContent = String(all.length); }
    }
    el.querySelectorAll('[data-name="Chip / All"], [data-name="Pill / All"], [data-name="Chip / Unread"], [data-name="Filter / Requests"], [data-name="Filter / Unread"]').forEach(ch => $.on(ch, () => { opts.filter = /Unread/.test(ch.dataset.name) ? 'unread' : /Requests/.test(ch.dataset.name) ? 'requests' : null; draw(); }));
    const search = el.querySelector('[data-name="Search & filters"] [data-name="Search"]') || list.querySelector('[data-name="Search"] [data-name="Search"]');
    if (search) searchInput(search, q => { opts.q = q; draw(); });
    draw();
    const note = $.text(el, /^Every enquiry/); if (note) note.textContent = 'One chat per seller. Every enquiry you send them joins that chat and is listed on the right with its status. A chat opens fully once the seller accepts.';
    /* nothing selected yet: the thread and context panes stay as an empty state */
    const thread = el.querySelector('[data-name^="Pane / Thread"]');
    if (thread) { const e = document.createElement('div'); e.className = 'thread-empty'; e.innerHTML = r === 'buyer' ? '<strong>No chat open</strong><span>Send an enquiry from Find a Seller. It appears here and opens once the seller accepts.</span>' : '<strong>No chat open</strong><span>Enquiries from buyers appear on the left. Open one to accept or decline it.</span>'; $.clear(thread); thread.appendChild(e); if (r === 'buyer') { const b = document.createElement('button'); b.className = 'ep-btn primary'; b.textContent = 'Find a seller'; b.onclick = () => App.go('/find'); e.appendChild(b); } }
    const ctx = el.querySelector('[data-name="Pane / Context"]'); if (ctx) ctx.remove();
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
      const rr = head.querySelector('[data-name="r"]'); const nm = rr ? $.texts(rr)[0] : $.texts(head.querySelector('[data-name="t"]'))[0]; if (nm) nm.textContent = o.name;
      const rating = rr && $.texts(rr).find(x => /^★/.test(x.textContent.trim())); if (rating) rating.textContent = o.rating ? '★ ' + o.rating : 'New';
      const line = $.texts(head).find(x => /local time|accepts within|replies in/.test(x.textContent)); if (line) line.textContent = `${o.city ? [o.city, o.state].filter(Boolean).join(', ') + '   ·   ' : ''}${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} local time   ·   ${r === 'buyer' ? (c.status === 'pending' ? 'usually accepts within ' + (o.respond || '~4 hrs') : 'replies in ' + (o.respond || '~2 hrs')) : c.enquiries.length + ' enquir' + (c.enquiries.length === 1 ? 'y' : 'ies') + ' in this chat'}`;
      Photo.paint(head.querySelector('[data-name="avatar"]'), Store.photo(otherKey(c, r)), o.initials || o.initial || Store.initials(o.name));
      $.on(head.querySelector('[data-name="t"]'), () => r === 'buyer' && App.go('/seller/' + c.sellerId));
    }
    await drawMessages(el, c, r);
    bindBottom(el, c, r, o);
    threeColumn(el, c, r, o);
    const bc = el.querySelector('[data-name="Breadcrumb"]'); if (bc) { const t = $.texts(bc); t[t.length - 1].textContent = o.name; }
    /* arrived from "send enquiry" or a notification about one enquiry: go to it */
    if (p.enq && Store.enq(c, p.enq)) setTimeout(() => focusEnquiry(el, p.enq, true), 120);
    else scrollToEnd(el);
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
  function grey(e) { e.querySelectorAll('div').forEach(d => { if (d.style.background && d.style.background !== 'rgb(242, 242, 242)') d.style.background = '#F2F2F2'; d.style.borderColor = 'transparent'; }); }

  async function drawMessages(el, c, r) {
    const box = el.querySelector('[data-name="Messages"]'); if (!box) return;
    const t = await msgTemplates(); const mineOut = r === 'buyer' ? t.outB : t.outS;
    $.clear(box); let lastDay = '';
    const add = n => { if (n) box.appendChild(n); return n; };
    const sellerName = Store.seller(c.sellerId).name;
    for (const m of c.messages) {
      const day = $.day(m.at); if (day !== lastDay) { const d = $.clone(r === 'buyer' ? t.dateB : t.dateS); $.texts(d)[0].textContent = day === 'Today' ? 'Today, ' + $.time(m.at) : day; add(d); lastDay = day; }
      const mine = m.from === r;
      const e = m.enq ? Store.enq(c, m.enq) : null;
      if (m.k === 'enquiry' && e) add(enquiryCard(c, r, e, m, r === 'buyer' ? t.enqB : t.enqS));
      else if (m.k === 'event' && e) {
        const ev = $.clone(r === 'buyer' ? t.eventB : t.eventS);
        const txt = m.text === 'deal' ? `✓  ${e.id} · deal marked as agreed · ${$.time(m.at)}`
          : r === 'buyer' ? `✓  ${sellerName} accepted ${e.id} · ${$.time(m.at)}${c.messages.find(x => x.k === 'event' && x.text === 'accepted') === m ? ' — you can now message each other' : ''}`
          : `✓  You accepted ${e.id} · ${$.time(m.at)}`;
        $.texts(ev)[0].textContent = txt; ev.dataset.enqEvent = e.id; add(ev);
      }
      else if (m.k === 'notice') add($.clone(r === 'buyer' ? t.noticeB : t.noticeS));
      else if (m.k === 'text') { const b = $.clone(mine ? mineOut : t.inB); bubbleText(b, m.text); stamp(b, m.at, mine); b.querySelectorAll('[data-name*="Translated"], [data-name*="See original"]').forEach(x => x.remove()); add(b); }
      else if (m.k === 'file') { const b = $.clone(mine ? t.outFileS : t.inFileB); const ts = $.texts(b); const nm = ts.find(x => /\.pdf/.test(x.textContent)); if (nm) nm.textContent = m.name; const sz = ts.find(x => /PDF ·/.test(x.textContent)); if (sz) sz.textContent = m.size; stamp(b, m.at, mine); add(b); }
      else if (m.k === 'closed' && e) {
        const ev = $.clone(r === 'buyer' ? t.eventB : t.eventS); const who = mine ? 'You' : other(c, r).name;
        $.texts(ev)[0].textContent = `${who} ${m.verb} ${e.id} · ${$.day(m.at) === 'Today' ? $.time(m.at) : $.day(m.at)}`; grey(ev); ev.dataset.enqEvent = e.id; add(ev);
        if (mine) { const b = $.clone(t.reasonMine); const ts = $.texts(b); ts[0].textContent = m.verb === 'declined' ? 'REASON FOR DECLINING ' + e.id : 'REASON FOR CLOSING ' + e.id; ts[1].textContent = m.reason; if (ts[2] && !/^\d{1,2}:/.test(ts[2].textContent)) { if (m.detail) ts[2].textContent = m.detail; else ts[2].remove(); } stamp(b, m.at, true); add(b); }
        else { const b = $.clone(t.inB); bubbleText(b, `Reason (${e.id}): ` + m.reason + (m.detail ? ' — ' + m.detail : '')); stamp(b, m.at); add(b); }
      }
    }
    if (c.status === 'pending' && r === 'buyer') { const w = $.clone(t.waitB); $.texts(w)[0].textContent = `Waiting for ${sellerName} to accept — you can message each other after that`; add(w); }
    box.dataset.bound = '1';
  }
  function scrollToEnd(el) {
    requestAnimationFrame(() => { const box = el.querySelector('[data-name="Messages"]'); const last = box && box.lastElementChild; if (last && box.children.length > 4) last.scrollIntoView({ block: 'nearest' }); });
  }

  /* The enquiry as it appears in the chat: the Figma "automated enquiry" card, with
     its reference, live status and — for a seller — the accept / decline actions. */
  function enquiryCard(c, r, e, m, tpl) {
    const card = $.clone(tpl); const bubble = card.querySelector('[data-name="bubble"]') || card;
    const ts = $.texts(bubble);
    const tag = ts[0]; const product = ts[1];
    tag.textContent = `${e.id}  ·  ${e.products.length > 1 ? e.products.length + ' PRODUCTS  ·  ' : ''}${e.type === 'similar' ? 'ALSO SENT TO SIMILAR SELLERS' : 'SENT FROM THE ENQUIRY FORM'}`;
    const details = bubble.querySelector('[data-name="Details"]');
    const fillOne = (pEl, dEl, pr) => {
      pEl.textContent = pr.name;
      if (!dEl) return;
      const d = $.texts(dEl); const qi = d.findIndex(x => x.textContent.trim() === 'Quantity'); if (qi >= 0 && d[qi + 1]) d[qi + 1].textContent = `${pr.qty} ${pr.unit}`;
      /* the Notes row frame and its label are both named "Notes" — hide the row, or
         the Figma sample sentence shows up on an enquiry that had no notes */
      const notesRow = [...dEl.children].find(x => x.dataset.name === 'Notes');
      if (notesRow) { const nt = $.texts(notesRow); if (pr.notes && nt[1]) { nt[1].textContent = pr.notes; notesRow.style.display = ''; } else notesRow.style.display = 'none'; }
    };
    fillOne(product, details, e.products[0]);
    let after = details || product;
    e.products.slice(1).forEach(pr => { const pn = product.cloneNode(true); const dn = details ? details.cloneNode(true) : null; after.after(pn); if (dn) pn.after(dn); fillOne(pn, dn, pr); pn.style.marginTop = '8px'; after = dn || pn; });
    stamp(bubble, m.at, r === 'buyer');
    card.dataset.enq = e.id; card.classList.add('enq-card');
    /* the buyer's own card is a dark (outgoing) bubble — pills need the inverse look */
    if (/rgb\(17, 17, 17\)|#111/i.test(bubble.style.background || '')) card.classList.add('enq-dark');

    const foot = document.createElement('div'); foot.className = 'enq-card-foot';
    const pill = document.createElement('span'); pill.className = 'ep-pill ' + pillClass(e, r); pill.textContent = STATUS(e, r); foot.appendChild(pill);
    const act = actions(c, e, r, true);
    if (act.childNodes.length) foot.appendChild(act);
    else if (e.status === 'pending' && r === 'buyer') { const s = document.createElement('span'); s.className = 'enq-card-note'; s.textContent = `Waiting for ${Store.seller(c.sellerId).name} to accept`; foot.appendChild(s); }
    bubble.appendChild(foot);
    return card;
  }
  const pillClass = (e, r) => e.status === 'active' ? (e.deal ? 'deal' : 'on') : e.status === 'pending' ? (r === 'seller' ? 'new' : 'wait') : 'off';

  /* Per-enquiry actions, shared by the card in the chat and the item in the panel. */
  function actions(c, e, r, compact) {
    const wrap = document.createElement('div'); wrap.className = 'ep-actions';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ep-btn ' + (cls || ''); b.textContent = label; b.onclick = ev => { ev.stopPropagation(); fn(); }; wrap.appendChild(b); };
    if (e.status === 'pending' && r === 'seller') {
      btn('Accept', 'primary', () => { Store.accept(c.id, e.id); App.toast(`${e.id} accepted — ${Store.buyer(c.buyerId).name} can now message you`); App.go('/myenq/' + c.id + '?enq=' + e.id); });
      btn('Decline', '', () => Modals.reasons({ mode: 'decline', conv: c, enq: e }));
    }
    if (e.status === 'active' && !compact) {
      if (!e.deal) btn('Mark deal agreed', '', () => { Store.dealAgreed(c.id, e.id, r); App.toast(`${e.id} marked as agreed`); App.refresh(); });
      btn('Close', '', () => Modals.reasons({ mode: 'close', conv: c, enq: e }));
    }
    if (e.status === 'declined' && r === 'seller' && e.closedAt && (Date.now() - new Date(e.closedAt)) / 1000 < 300) {
      btn('Undo decline', '', () => { Store.undoDecline(c.id, e.id); App.refresh(); });
    }
    return wrap;
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
        const clip = composer.querySelector('[data-name="Icon / 📎"]'); $.on(clip, () => { const f = document.createElement('input'); f.type = 'file'; f.onchange = () => { const fl = f.files[0]; if (fl) { Store.message(c.id, r, '', { name: fl.name, size: (fl.name.split('.').pop() || 'file').toUpperCase() + ' · ' + Math.max(1, Math.round(fl.size / 1024)) + ' KB' }); App.refresh(); } }; f.click(); });
        setTimeout(() => ph.focus({ preventScroll: true }), 50);
      }
    }
    if (composer && c.status === 'pending' && r === 'buyer') {
      composer.dataset.bound = '1';
      $.set(composer, /^This chat started/, `This chat started with your enquiry. ${o.name} will reply here once they accept it.`);
    }
    /* seller, nothing accepted yet: the request bar acts on the oldest waiting enquiry */
    const bar = el.querySelector('[data-name="Chat request bar"]');
    if (bar) {
      const pend = c.enquiries.filter(e => e.status === 'pending'); const e = pend[0];
      const title = bar.querySelector('[data-name="Title"]'); if (title) $.texts(title)[0].textContent = o.name;
      const copy = bar.querySelector('[data-name="Copy"]'); if (copy && e) { const ts = $.texts(copy); const line = ts[ts.length - 1]; if (line && line !== $.texts(title || copy)[0]) line.textContent = pend.length > 1 ? `${pend.length} enquiries waiting · accept each one in the panel, or accept ${e.id} here` : `${e.id} · ${eLine(e)} · ${eQty(e)}`; }
      Photo.paint(bar.querySelector('[data-name="Avatar"]'), Store.photo(otherKey(c, r)), o.initials || Store.initials(o.name));
      if (e) {
        $.on(bar.querySelector('[data-name="Button / Accept"]'), () => { Store.accept(c.id, e.id); App.toast(`${e.id} accepted — you can now chat with ${o.name}`); App.refresh(); });
        $.on(bar.querySelector('[data-name="Button / Decline"]'), () => Modals.reasons({ mode: 'decline', conv: c, enq: e }));
      }
    }
    const closedBar = el.querySelector('[data-name="Closed bar (read-only)"]');
    if (closedBar) {
      const ts = $.texts(closedBar);
      const n = c.enquiries.length;
      if (ts[0]) ts[0].textContent = n > 1 ? `🔒  All ${n} enquiries in this chat are closed — it’s read-only` : c.closedBy === r ? '🔒  Enquiry closed — this chat is read-only' : `🔒  ${o.name} ${c.status === 'declined' ? 'declined' : 'closed'} this enquiry — this chat is read-only`;
      if (ts[1]) ts[1].textContent = r === 'buyer' ? 'Need something else from this seller? A new enquiry reopens this chat.' : 'The buyer can send you a new enquiry any time — it reopens this chat.';
      $.on(closedBar.querySelector('[data-name="Button / Send new enquiry"]'), () => Modals.enquiry({ sellerId: c.sellerId }));
    }
    const declined = el.querySelector('[data-name="Declined bar"]');
    if (declined) {
      const ts = $.texts(declined); if (ts[1]) ts[1].textContent = `${o.name} can see your reason. This chat is closed — they can send a new enquiry later.`;
      const last = c.enquiries.filter(e => e.status === 'declined').sort((a, b) => a.closedAt.localeCompare(b.closedAt)).pop();
      const undo = declined.querySelector('[data-name="Button / Undo"]'); const age = last ? (Date.now() - new Date(last.closedAt)) / 1000 : 999;
      if (undo) { if (age < 300) { const left = Math.ceil((300 - age) / 60); $.texts(undo)[0].textContent = `Undo · ${left} min`; $.on(undo, () => { Store.undoDecline(c.id, last.id); App.refresh(); }); } else undo.style.display = 'none'; }
    }
  }

  /* My enQ is three columns: chats · the open chat · this chat's enquiries. The
     Figma context pane is replaced by a live enquiry register. */
  function threeColumn(el, c, r, o) {
    const panes = el.querySelector('[data-name="Panes"]'); if (!panes) return;
    const ctx = panes.querySelector('[data-name="Pane / Context"]'); if (ctx) ctx.remove();
    const list = panes.querySelector('[data-name="Pane / My enQ"], [data-name="Lead list"]');
    if (list) { list.style.flex = '0 0 300px'; list.style.width = '300px'; }
    const thread = [...panes.children].find(x => /Thread/.test(x.dataset.name || ''));
    if (thread) { thread.style.flex = '1 1 0'; thread.style.minWidth = '0'; }
    const head = el.querySelector('[data-name="Thread head"]');
    if (head) {
      head.style.alignItems = 'center';
      const t = head.querySelector('[data-name="t"]'); if (t) { t.style.flex = '1 1 0'; t.style.minWidth = '0'; }
      if (!head.querySelector('.more-btn')) head.appendChild(moreButton(c, r, o));
    }
    const panel = buildPanel(el, c, r, o);
    panes.appendChild(panel);
    spy(el, panel);
  }

  function buildPanel(el, c, r, o) {
    const panel = document.createElement('aside'); panel.className = 'enq-panel'; panel.setAttribute('aria-label', 'Enquiries in this chat');
    // who you are talking to
    const who = document.createElement('div'); who.className = 'ep-who';
    const av = document.createElement('div'); av.className = 'ep-avatar'; Photo.paint(av, Store.photo(otherKey(c, r)), o.initials || o.initial || Store.initials(o.name));
    const wt = document.createElement('div'); wt.className = 'ep-who-t';
    wt.innerHTML = '<strong></strong><span></span>';
    wt.querySelector('strong').textContent = o.name;
    wt.querySelector('span').textContent = [o.type, o.city ? o.city + (o.state ? ', ' + o.state : '') : '', o.rating ? '★ ' + o.rating : ''].filter(Boolean).join(' · ');
    who.append(av, wt);
    if (r === 'buyer') { const v = document.createElement('button'); v.type = 'button'; v.className = 'ep-link'; v.textContent = 'View profile'; v.onclick = () => App.go('/seller/' + c.sellerId); who.appendChild(v); }
    panel.appendChild(who);

    const head = document.createElement('div'); head.className = 'ep-head';
    head.innerHTML = '<h4>Enquiries in this chat</h4><span class="ep-count"></span>';
    head.querySelector('.ep-count').textContent = String(c.enquiries.length);
    panel.appendChild(head);
    const sub = document.createElement('p'); sub.className = 'ep-sub';
    const pend = c.enquiries.filter(e => e.status === 'pending').length, act = c.enquiries.filter(e => e.status === 'active').length;
    sub.textContent = [act ? act + ' active' : '', pend ? pend + (r === 'seller' ? ' waiting for you' : ' awaiting acceptance') : ''].filter(Boolean).join(' · ') || 'All closed';
    panel.appendChild(sub);

    const listEl = document.createElement('div'); listEl.className = 'ep-list';
    [...c.enquiries].reverse().forEach(e => {
      const it = document.createElement('div'); it.className = 'ep-item'; it.dataset.enq = e.id; it.tabIndex = 0; it.setAttribute('role', 'button');
      it.setAttribute('aria-label', `${e.id}. ${e.products.map(p => `${p.name} (${p.qty} ${p.unit})`).join('. ')}. ${STATUS(e, r)} — show in chat`);
      it.innerHTML = '<div class="ep-row"><span class="ep-ref"></span><span class="ep-pill"></span></div><ul class="ep-prods"></ul><div class="ep-meta"></div>';
      it.querySelector('.ep-ref').textContent = e.id;
      const pl = it.querySelector('.ep-pill'); pl.textContent = STATUS(e, r); pl.classList.add(pillClass(e, r));
      /* one line per product, "Product name (quantity)" — the same layout
         whether the enquiry has one product or five */
      const ul = it.querySelector('.ep-prods');
      e.products.forEach(p => { const li = document.createElement('li'); li.innerHTML = '<span class="ep-pname"></span> <span class="ep-pqty"></span>'; li.firstChild.textContent = p.name; li.lastChild.textContent = `(${p.qty} ${p.unit})`; ul.appendChild(li); });
      it.querySelector('.ep-meta').textContent = `${r === 'buyer' ? 'Sent' : 'Received'} ${$.ago(e.createdAt)}${e.status === 'closed' || e.status === 'declined' ? ' · ' + (e.reason || '') : ''}`;
      const acts = actions(c, e, r, false); if (acts.childNodes.length) it.appendChild(acts);
      const go = () => focusEnquiry(el, e.id, true);
      it.addEventListener('click', go);
      it.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
      listEl.appendChild(it);
    });
    panel.appendChild(listEl);

    if (r === 'buyer') {
      const n = document.createElement('button'); n.type = 'button'; n.className = 'ep-btn block'; n.textContent = '+ Send another enquiry';
      n.onclick = () => Modals.enquiry({ sellerId: c.sellerId });
      panel.appendChild(n);
    }
    const note = document.createElement('p'); note.className = 'ep-note';
    note.textContent = 'Contact details stay private — either of you can share them in this chat.';
    panel.appendChild(note);
    return panel;
  }

  /* Scroll the chat to where an enquiry was sent and flash it. */
  function focusEnquiry(el, eid, flash) {
    const card = el.querySelector(`.enq-card[data-enq="${CSS.escape(eid)}"]`); if (!card) return;
    el._spyHold = Date.now();   // the enquiry you picked stays marked while the chat scrolls to it
    card.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    markCurrent(el, eid);
    if (flash) { const b = card.querySelector('[data-name="bubble"]') || card; b.classList.remove('enq-flash'); void b.offsetWidth; b.classList.add('enq-flash'); }
  }
  function markCurrent(el, eid) { el.querySelectorAll('.ep-item').forEach(i => i.classList.toggle('current', i.dataset.enq === eid)); }

  /* As you scroll the chat, the panel marks the enquiry you are reading under.
     Only real scrolling moves the mark, and never straight after you picked one. */
  function spy(el, panel) {
    const cards = [...el.querySelectorAll('.enq-card')]; if (cards.length < 2) return;
    let ticking = false;
    const update = () => {
      ticking = false; if (!document.body.contains(panel)) { window.removeEventListener('scroll', onScroll); return; }
      if (el._spyHold && Date.now() - el._spyHold < 1200) return;
      const mid = window.innerHeight * 0.45; let cur = cards[0];
      for (const c of cards) { if (c.getBoundingClientRect().top <= mid) cur = c; }
      markCurrent(el, cur.dataset.enq);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    const box = el.querySelector('[data-name="Messages"]'); if (box) box.addEventListener('scroll', onScroll, { passive: true });
  }

  function moreButton(c, r, o) {
    const b = document.createElement('div'); b.className = 'more-btn'; b.textContent = '···'; b.title = 'More';
    b.addEventListener('click', e => {
      e.stopPropagation();
      const open = document.querySelector('.more-menu'); if (open) { open.remove(); return; }
      const menu = document.createElement('div'); menu.className = 'more-menu';
      const items = [];
      if (r === 'buyer') { items.push(['View seller profile', () => App.go('/seller/' + c.sellerId)]); items.push(['Send another enquiry', () => Modals.enquiry({ sellerId: c.sellerId })]); }
      items.push(['About ' + o.name, () => App.toast([o.name, o.type, o.city ? o.city + ', ' + o.state : '', o.rating ? '★ ' + o.rating : ''].filter(Boolean).join(' · '))]);
      items.forEach(([label, fn]) => { const it = document.createElement('button'); it.textContent = label; it.disabled = !fn; it.onclick = ev => { ev.stopPropagation(); menu.remove(); fn && fn(); }; menu.appendChild(it); });
      b.appendChild(menu);
      setTimeout(() => document.addEventListener('click', function off() { menu.remove(); document.removeEventListener('click', off); }, { once: true }), 0);
    });
    return b;
  }

  return { listPage, chatPage, drawList, prodLine, eLine, eQty, STATUS };
})();
Pages.myenq = Enq.listPage;
Pages.chat = Enq.chatPage;
