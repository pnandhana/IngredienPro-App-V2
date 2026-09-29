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

const Chrome = (function () {
  function who() { const r = Store.db.session.role; return r === 'guest' ? null : r + ':' + Store.db.accounts[r].id; }
  function unreadNotifs() { const w = who(); return w ? Store.notificationsFor(w).filter(n => !n.read).length : 0; }
  function unreadChats(role) { return Store.convsFor(role).filter(c => !(role === 'buyer' && c.hiddenFromBuyer) && (Store.unread(c, role) > 0 || (role === 'seller' && c.status === 'pending'))).length; }

  function apply(el, route) {
    const role = Store.db.session.role, acc = Store.db.accounts[role];
    const nav = el.querySelector('[data-name="Navigation bar"]');
    if (nav) {
      if (acc) {
        $.set(nav, /^Signed in as/, 'Signed in as ' + acc.company);
        const t = nav.querySelector('[data-name="My Account menu"] [data-name="t"], [data-name="Account"] [data-name="t"]');
        if (t) { const ts = $.texts(t); if (role === 'buyer' && ts[1]) ts[1].textContent = acc.company.replace(/ Pvt Ltd$/, ''); if (role === 'seller' && ts[1]) ts[1].textContent = acc.company.replace(/ Works$/, ''); }
        const av = nav.querySelector('[data-name="avatar"]'); if (av && $.texts(av)[0]) $.texts(av)[0].textContent = acc.company.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
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
      $.on($.one(nav, 'Btn / Register Free'), () => App.go('/register/buyer'));
      /* "Sell on IngredienPro" and "Switch to buying" were taken out of the utility bar
         in the wireframes. Seller sign-up now comes off the homepage sell pathway card,
         the How it Works seller section and the footer; role switching is in the flow nav. */
      $.on($.text(nav, 'Help'), () => App.go('/help'));
      const acct = nav.querySelector('[data-name="My Account menu"], [data-name="Account"]');
      $.on(acct, () => App.go(role === 'seller' ? '/settings' : '/myenq'));
      $.on(nav.querySelector('[data-name="Nav item / All Categories"]'), () => App.go('/categories'));
      $.on(nav.querySelector('[data-name="Nav item / How it Works"]'), () => App.go('/how'));
      $.on(nav.querySelector('[data-name="Nav item / Find a Seller"]'), () => App.go('/find'));
    }
    const sb = el.querySelector('[data-name="Account sidebar"]');
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
      if (role === 'seller') { const cat = Store.catalogueFor(acc.id); if (cat) count('Catalogue', cat.length); }
      const map = { 'My enQ': '/myenq', Dashboard: '/hub', Notifications: '/notifications', Shortlists: '/shortlists', Catalogue: '/catalogue', Subscription: '/subscription', 'Profile & Settings': '/settings' };
      Object.entries(map).forEach(([k, p]) => sb.querySelectorAll(`[data-name^="Item / ${k}"]`).forEach(it => $.on(it, () => App.go(p))));
      $.on($.one(sb, 'Toggle / Collapse'), () => { Store.setSidebar('collapsed'); App.go('/myenq'); });
      $.on($.one(sb, 'Toggle / Expand'), () => { Store.setSidebar('expanded'); App.go('/myenq'); });
    }
    // breadcrumbs: "Home" and section crumbs are links
    el.querySelectorAll('[data-name="Breadcrumb"]').forEach(bc => {
      const t = $.texts(bc);
      t.forEach(x => {
        const v = x.textContent.trim();
        const to = { Home: '/', 'Find a Seller': '/find', 'All Categories': '/categories', 'My Account': '/myenq', 'My enQ': '/myenq', 'Seller Hub': '/hub', 'Help Centre': '/help' }[v];
        if (to && x !== t[t.length - 1]) $.on(x, () => App.go(to));
      });
    });
  }
  return { apply, unreadChats, unreadNotifs, who };
})();
