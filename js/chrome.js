/* Shared chrome on every page: nav bar, account sidebar, live counts. */
const Tpl = (function () {
  /* Render another Figma frame off-screen once and clone parts of it, so a page
     can borrow a template (e.g. a "closed" chat bar) that lives on a different frame. */
  const cache = {};
  async function screen(id) {
    if (!cache[id]) { const { el } = await App.renderScreen(id); cache[id] = el; }
    return cache[id];
  }
  async function get(screenId, name, pick) {
    const el = await screen(screenId);
    const list = $.all(el, name); const found = pick ? list.find(pick) : list[0];
    return found ? $.clone(found) : null;
  }
  return { get, screen };
})();

/* Profile pictures. One square image per account (buyer photo / seller logo) is the
   avatar everywhere — chats, cards, header. Sellers also have a wide storefront cover
   for their public profile. Images are cropped and shrunk before they are stored. */
const Photo = (function () {
  const key = (role, id) => role + ':' + id;
  function paint(el, url, text) {
    if (!el) return;
    el.classList.toggle('has-photo', !!url);
    if (url) { el.style.backgroundImage = `url("${url}")`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; return; }
    el.style.backgroundImage = '';
    if (!text) return;
    const t = $.texts(el)[0];
    if (t) t.textContent = text; else if (!el.children.length) el.textContent = text;
  }
  /* crop to w×h (centre, like object-fit: cover) and re-encode as JPEG */
  function read(file, w, h) {
    return new Promise((ok, fail) => {
      if (!file || !/^image\//.test(file.type)) return fail(new Error('Choose a JPG or PNG image'));
      if (file.size > 8 * 1024 * 1024) return fail(new Error('That image is over 8 MB — choose a smaller one'));
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.max(w / img.width, h / img.height);
        const cw = w / s, ch = h / s, sx = (img.width - cw) / 2, sy = (img.height - ch) / 2;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
        cx.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('Couldn’t read that image')); };
      img.src = url;
    });
  }
  function pick(accept) {
    return new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept || 'image/png,image/jpeg,image/webp'; i.onchange = () => ok(i.files[0] || null); i.click(); });
  }
  return { key, paint, read, pick };
})();

const Chrome = (function () {
  function who() { const r = Store.db.session.role; return r === 'guest' ? null : r + ':' + Store.db.accounts[r].id; }
  function unreadNotifs() { const w = who(); return w ? Store.notificationsFor(w).filter(n => !n.read).length : 0; }
  function unreadChats(role) { return Store.convsFor(role).filter(c => Store.unread(c, role) > 0 || (role === 'seller' && c.enquiries.some(e => e.status === 'pending'))).length; }

  /* "Post a requirement" was removed from the product. The screens here are an
     earlier Figma snapshot, so its buttons, banners and footer links are hidden. */
  function hideRemoved(el) {
    el.querySelectorAll('[data-name*="Post a requirement"], [data-name*="Post requirement"], [data-name="Button / Post a requirement"]').forEach(n => n.classList.add('is-hidden'));
    $.texts(el).forEach(t => { if (/^Post (a|your) requirement/.test(t.textContent.trim()) && !t.closest('.is-hidden')) t.classList.add('is-hidden'); });
  }

  /* The buyer's account area opens on Overview (the dashboard). The sidebar frames
     predate it, so the item is added here, styled like its neighbours. */
  function overviewItem(sb, active) {
    if (sb.querySelector('[data-name^="Item / Overview"]')) return;
    const items = [...sb.querySelectorAll(':scope > [data-name^="Item / "]')]; if (!items.length) return;
    const on = items.find(i => /\(active\)$/.test(i.dataset.name)), off = items.find(i => !/\(active\)$/.test(i.dataset.name));
    const copyLook = (to, from) => {
      if (!to || !from) return;
      to.style.background = from.style.background;
      const a = $.texts(to), b = $.texts(from);
      a.forEach((t, i) => { const s = b[Math.min(i, b.length - 1)]; if (s) { t.style.color = s.style.color; t.style.fontWeight = s.style.fontWeight; } });
    };
    const it = $.clone((active ? on : off) || items[0]);
    it.dataset.name = 'Item / Overview' + (active ? ' (active)' : '');
    it.querySelectorAll('[data-name="Count"], [data-name="Unread dot"]').forEach(x => x.remove());
    const icon = it.querySelector('[data-name="Icon"]'); if (icon) icon.textContent = '▦';
    const label = it.querySelector('[data-name="Label"]'); if (label) label.textContent = 'Overview';
    items[0].before(it);
    /* the frame's own active item (e.g. Shortlists) steps down */
    if (active && on && off) {
      copyLook(on, off);
      const cOn = on.querySelector('[data-name="Count"]'), cOff = off.querySelector('[data-name="Count"]');
      if (cOn && cOff) cOn.style.background = cOff.style.background;
      on.dataset.name = on.dataset.name.replace(' (active)', '');
    }
  }

  function apply(el, route) {
    const role = Store.db.session.role, acc = Store.db.accounts[role];
    hideRemoved(el);
    Sync.apply(el, route);   // bring the snapshot in line with the current Figma design (js/sync.js)
    const nav = el.querySelector('[data-name="Navigation bar"]');
    if (nav) {
      if (acc) {
        $.set(nav, /^Signed in as/, 'Signed in as ' + acc.company);
        const t = nav.querySelector('[data-name="My Account menu"] [data-name="t"], [data-name="Account"] [data-name="t"]');
        if (t) { const ts = $.texts(t); if (role === 'buyer' && ts[1]) ts[1].textContent = acc.company.replace(/ Pvt Ltd$/, ''); if (role === 'seller' && ts[1]) ts[1].textContent = acc.company.replace(/ Works$/, ''); }
        Photo.paint(nav.querySelector('[data-name="avatar"]'), Store.photo(Photo.key(role, acc.id)), Store.initials(acc.company));
      }
      const bell = nav.querySelector('[data-name="Notifications bell"], [data-name="bell"]');
      if (bell) {
        const chip = bell.querySelector('[data-name^="Chip"]'); const n = unreadNotifs();
        if (chip) { if (n) { chip.classList.remove('is-hidden'); $.texts(chip)[0].textContent = String(n); } else chip.classList.add('is-hidden'); }
        if (role === 'buyer') $.on(bell, () => Modals.notificationsDropdown(bell));
        else $.on(bell, () => App.go('/notifications'));
      }
      $.on($.one(nav, 'Logo'), () => App.go(role === 'seller' ? '/hub' : '/'));
      $.on($.text(nav, 'Log in'), () => App.go('/login'));
      $.on($.one(nav, 'Btn / Register Free') || $.one(nav, 'Btn / Register for free'), () => App.go('/register/buyer'));
      /* "Sell on IngredienPro" and "Switch to buying" were taken out of the utility bar
         in the wireframes. Seller sign-up now comes off the homepage sell pathway card,
         the How it Works seller section and the footer; role switching is in the flow nav. */
      $.on($.text(nav, 'Help'), () => App.go('/help'));
      const acct = nav.querySelector('[data-name="My Account menu"], [data-name="Account"]');
      $.on(acct, () => App.go(role === 'seller' ? '/hub' : '/overview'));
      const items = { 'All Categories': '/categories', Category: '/categories', 'About Us': '/about', 'How it Works': '/how', Pricing: '/pricing', 'Find a Seller': '/find' };
      Object.entries(items).forEach(([k, p]) => $.on(nav.querySelector(`[data-name="Nav item / ${k}"]`), () => App.go(p)));
    }
    /* footer links, per audience */
    el.querySelectorAll('[data-name="Section / Footer"], [data-name="Footer"]').forEach(f => {
      const map = role === 'seller'
        ? { Dashboard: '/hub', 'My enQ': '/myenq', Catalogue: '/catalogue', Subscription: '/subscription', 'Help centre': '/help', 'How it works': '/help' }
        : { 'All categories': '/categories', 'Find a seller': '/find', 'List your business': '/register/seller', 'About us': '/about', 'How it works': '/how', Pricing: '/pricing', 'Help centre': '/help', FAQ: '/help' };
      $.texts(f).forEach(t => { const to = map[t.textContent.trim()]; if (to) $.on(t, () => App.go(to)); });
    });
    /* List your business, wherever it appears */
    el.querySelectorAll('[data-name="Btn / List your business"]').forEach(b => $.on(b, () => App.go('/register/seller')));
    const sb = el.querySelector('[data-name="Account sidebar"]');
    /* lets the stylesheet floor the page at the viewport, so every account tab is the
       same height and the rail never stops mid-window on the short ones */
    if (sb) el.classList.add('has-account-rail');
    if (sb && acc && role === 'buyer') overviewItem(sb, route && route.controller === Pages.overview);
    if (sb && acc) {
      const count = (label, n) => {
        const it = sb.querySelector(`[data-name^="Item / ${label}"]`); if (!it) return;
        const c = it.querySelector('[data-name="Count"], [data-name="Unread dot"]'); if (!c) return;
        if (!n) { c.style.visibility = 'hidden'; return; }
        c.style.visibility = '';
        const t = $.texts(c)[0]; if (!t) return;
        const before = t.textContent.trim();
        t.textContent = String(n);
        /* a count that moved gets a nudge, so the change is not silent */
        if (before && before !== String(n)) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      };
      count('My enQ', unreadChats(role));
      count('Notifications', unreadNotifs());
      if (role === 'buyer') count('Shortlists', (Store.db.shortlists[acc.id] || []).length);
      if (role === 'seller') {
        const cat = Store.catalogueFor(acc.id); if (cat) count('Catalogue', cat.length);
        const s = Store.seller(acc.id);
        if (s) { const n = s.categories.length; $.set(sb, /categories · renews/, `${n} categor${n === 1 ? 'y' : 'ies'} · per-category subscription`); }
      }
      const map = { Overview: '/overview', 'My enQ': '/myenq', Dashboard: '/hub', Notifications: '/notifications', Shortlists: '/shortlists', Catalogue: '/catalogue', Subscription: '/subscription', 'Profile & Settings': '/settings' };
      Object.entries(map).forEach(([k, p]) => sb.querySelectorAll(`[data-name^="Item / ${k}"]`).forEach(it => $.on(it, () => App.go(p))));
      $.on($.one(sb, 'Toggle / Collapse'), () => { Store.setSidebar('collapsed'); App.go('/myenq'); });
      $.on($.one(sb, 'Toggle / Expand'), () => { Store.setSidebar('expanded'); App.go('/myenq'); });
    }
    // breadcrumbs: "Home" and section crumbs are links
    el.querySelectorAll('[data-name="Breadcrumb"]').forEach(bc => {
      const t = $.texts(bc);
      t.forEach(x => {
        const v = x.textContent.trim();
        const to = { Home: '/', 'Find a Seller': '/find', 'All Categories': '/categories', 'My Account': role === 'buyer' ? '/overview' : '/hub', 'My enQ': '/myenq', 'Seller Hub': '/hub', 'Help Centre': '/help' }[v];
        if (to && x !== t[t.length - 1]) $.on(x, () => App.go(to));
      });
    });
  }
  return { apply, unreadChats, unreadNotifs, who };
})();
