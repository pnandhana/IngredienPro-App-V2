/* Responsive behaviour — the parts CSS cannot do on its own.

   Nothing here rewrites the wireframe. It adds three controls that only exist below
   760px (a nav drawer, a chats/chat switch, a back affordance), and it tags elements
   so the motion layer has something to animate. Above 760px every one of these is
   inert and the screen renders exactly as drawn. */
const Responsive = (function () {

  const isPhone = () => App.mode() === 'phone';

  /* ---------------------------------------------------------------- nav drawer */
  const NAV = {
    guest: [
      ['About Us', '/about'], ['How it Works', '/how'], ['Category', '/categories'], ['Pricing', '/pricing'], ['Find a Seller', '/find'],
      null,
      ['Log in', '/login'], ['Register for free', '/register/buyer']
    ],
    buyer: [
      /* no Pricing once registered — see js/sync.js */
      ['About Us', '/about'], ['How it Works', '/how'], ['Category', '/categories'], ['Find a Seller', '/find'],
      null,
      ['Overview', '/overview'], ['My enQ', '/myenq'], ['Notifications', '/notifications'], ['Shortlists', '/shortlists'], ['Profile & Settings', '/settings']
    ],
    seller: [
      ['Seller Hub', '/hub'], ['My enQ', '/myenq'], ['Catalogue', '/catalogue'],
      ['Notifications', '/notifications'], ['Subscription', '/subscription'], ['Profile & Settings', '/settings'],
      null,
      ['Help', '/help']
    ]
  };

  let drawer = null;
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    document.body.classList.remove('has-overlay');
  }
  function openDrawer() {
    const role = Store.db.session.role;
    const here = App.path();
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.className = 'navdrawer';
      drawer.innerHTML = '<div class="navdrawer-scrim"></div><nav class="navdrawer-panel" aria-label="Menu"></nav>';
      drawer.querySelector('.navdrawer-scrim').addEventListener('click', closeDrawer);
      document.body.appendChild(drawer);
    }
    const panel = drawer.querySelector('.navdrawer-panel');
    panel.innerHTML = '';
    const close = document.createElement('button');
    close.className = 'nd-close'; close.textContent = '✕';
    close.setAttribute('aria-label', 'Close menu');
    close.onclick = closeDrawer;
    panel.appendChild(close);
    const h = document.createElement('h2');
    h.textContent = role === 'guest' ? 'Menu' : (role === 'seller' ? 'Seller Hub' : 'My Account');
    panel.appendChild(h);
    for (const item of (NAV[role] || NAV.guest)) {
      if (!item) { panel.appendChild(document.createElement('hr')); continue; }
      const [label, to] = item;
      const b = document.createElement('button');
      b.textContent = label;
      if (here === to || (to !== '/' && here.indexOf(to) === 0)) b.classList.add('on');
      b.onclick = () => { closeDrawer(); App.go(to); };
      panel.appendChild(b);
    }
    drawer.classList.add('open');
    document.body.classList.add('has-overlay');
    const first = panel.querySelector('button:not(.nd-close)');
    if (first) first.focus();
  }

  function addHamburger(el) {
    const header = el.querySelector('[data-name="Header"]');
    if (!header || header.querySelector('.hamburger')) return;
    const b = document.createElement('button');
    b.className = 'hamburger';
    b.setAttribute('aria-label', 'Open menu');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<span></span>';
    b.addEventListener('click', e => { e.stopPropagation(); openDrawer(); });
    header.appendChild(b);
  }

  /* --------------------------------------------- My enQ: chats ⇄ open chat */
  function addPaneSwitch(el, route) {
    const panes = el.querySelector('[data-name="Panes"]');
    if (!panes || panes.parentElement.querySelector('.pane-switch')) return;
    const screen = el;
    const hasThread = !!panes.querySelector('[data-name^="Pane / Thread"]');
    const hasList = !!panes.querySelector('[data-name="Pane / My enQ"]');
    if (!hasThread || !hasList) return;

    const sw = document.createElement('div');
    sw.className = 'pane-switch';
    sw.setAttribute('role', 'tablist');
    const mk = (label, key) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.dataset.pane = key;
      b.setAttribute('role', 'tab');
      b.onclick = () => setPane(key);
      sw.appendChild(b);
      return b;
    };
    mk('All chats', 'list');
    mk('This chat', 'thread');
    panes.parentElement.insertBefore(sw, panes);

    function setPane(key) {
      screen.dataset.pane = key;
      sw.querySelectorAll('button').forEach(b => {
        const on = b.dataset.pane === key;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on);
      });
      if (App.mode() !== 'desktop') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    /* arriving on a specific chat opens the chat; arriving on My enQ shows the list */
    setPane(route && route.params && route.params.id ? 'thread' : 'list');
  }

  /* ------------------------------------------------------- motion bookkeeping */
  const LISTS = ['Seller list', 'Chat list', 'Lead list', 'Messages', 'Category row',
    'Sections', 'Boxes', 'Notification list', 'Rows', 'Results', 'Product list',
    'Matching products', 'Card grid', 'Category grid'];

  function tagLists(el) {
    for (const name of LISTS) {
      el.querySelectorAll(`[data-name="${CSS.escape(name)}"]`).forEach(list => {
        if (list.children.length > 1) list.classList.add('stagger');
      });
    }
  }

  /* A safety net for everything Figma pinned to an absolute x that no named rule
     catches — a gate modal, a suggestions dropdown, an upsell in a card corner.
     Each one is measured against whatever actually bounds it (its offset parent,
     or the screen) and pulled back inside. The original numbers are remembered so
     widening the window restores the drawn position exactly. */
  function clampAbsolutes(root) {
    const scr = root || document.querySelector('#stage .screen');
    if (!scr) return;
    /* Runs at every width. Anything that already fits is untouched, so at the drawn
       width this is a no-op except for the handful of pinned elements that hang out
       of their own card or modal in the wireframe too. */
    const sr = scr.getBoundingClientRect();
    const PAD = 12;
    scr.querySelectorAll('[data-name]').forEach(el => {
      const was = el.dataset.clamped;
      if (was) { el.style.left = el.dataset.clampLeft || ''; el.style.width = el.dataset.clampWidth || ''; }
      if (getComputedStyle(el).position !== 'absolute') return;

      const host = el.offsetParent && scr.contains(el.offsetParent) ? el.offsetParent : scr;
      const hr = host.getBoundingClientRect();
      const limit = Math.min(hr.right, sr.right) - PAD;
      const r = el.getBoundingClientRect();
      if (r.right <= limit + 1) return;

      if (!was) { el.dataset.clampLeft = el.style.left || ''; el.dataset.clampWidth = el.style.width || ''; }
      const room = Math.min(hr.width, sr.width) - PAD * 2;
      if (r.width > room) el.style.setProperty('width', Math.round(room) + 'px', 'important');
      const left = parseFloat(getComputedStyle(el).left) || 0;
      const after = el.getBoundingClientRect();
      const over = after.right - limit;
      if (over > 0) el.style.setProperty('left', Math.round(Math.max(PAD - (hr.left - Math.min(hr.left, sr.left)), left - over)) + 'px', 'important');
      el.dataset.clamped = '1';
    });
  }

  /* the sticky header only casts a shadow once it is actually stuck */
  function stickShadows() {
    document.querySelectorAll('#stage .is-fixed').forEach(f => {
      f.classList.toggle('is-stuck', window.scrollY > 4);
    });
  }

  /* ------------------------------------------------------------------- apply */
  function apply(el, route) {
    addHamburger(el);
    addPaneSwitch(el, route);
    tagLists(el);
    stickShadows();
    /* run once now and again after the web font lands, since Inter arriving
       reflows text and can push a pinned element back off the edge */
    requestAnimationFrame(() => clampAbsolutes(el));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => clampAbsolutes(el));
    setTimeout(() => clampAbsolutes(el), 120);
  }

  let resizeTimer = null;
  window.addEventListener('scroll', stickShadows, { passive: true });
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => clampAbsolutes(), 120);
  });
  document.addEventListener('modechange', () => { closeDrawer(); clampAbsolutes(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  return { apply, openDrawer, closeDrawer, clampAbsolutes, isPhone };
})();
