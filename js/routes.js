/* Routes: which Figma frame each app page is built on (per role), and how every
   Figma prototype link maps onto an app route or action. */
const F = {
  G: { home: '597:18217', cats: '597:18671', product: '622:2', find: '635:19637', gate: '526:267', how: '739:1331', help: ['759:1743', '759:1879', '759:2019', '759:2153', '759:2279', '759:2407'] },
  B: { home: '635:20633', cats: '635:21535', product: '635:21088', find: '567:2632', enquiry: '651:2', multi: '793:4403', notSold: '795:3784', confirm: '795:4418', findNew: '795:5576', profile: '597:19327', notifDrop: '635:22097', myenq: '635:22487', myenqC: '686:796', chat: '635:22657', chatWait: '635:22895', close: '762:2623', closed: '763:2643', replies: '752:2792', notifications: '635:23451', shortlists: '635:23311', settings: '635:23601', how: '742:1383', req: '756:1673', reqPicked: '752:1497', reqPosted: '752:2160', help: ['759:2571', '759:2735', '759:2903', '759:3065', '759:3219', '759:3375'] },
  S: { hub: '283:5025', myenq: '283:4837', myenqC: '686:1463', request: '283:4658', reqRequest: '752:2981', decline: '760:2224', declined: '760:2450', chat: '283:4467', close: '762:2365', closed: '763:2417', catalogue: '283:5361', notifications: '283:5208', subscription: '283:5552', settings: '283:5699', preview: '734:1294', help: ['759:3527', '759:3689', '759:3855', '759:4015', '759:4167', '759:4321'] },
  L: { phone: '526:2', code: '526:71', email: '526:38', recover: '526:142', edge: '526:197' },
  RB: { form: '544:3', errors: '544:26', verify: '544:49', prefs: '544:72' },
  RS: { form: '544:95', codes: '544:130', correct: '544:165', wrong: '544:200', expired: '544:235', docs: '544:270', docsError: '544:305', running: '544:340', pass: '544:375', fail: '544:410', products: '596:2', searching: '585:2', added: '561:2', plan: '544:445', review: '544:480', approved: '544:515', rejected: '544:550', live: '544:585' }
};
const HELP = ['getting-started', 'enquiries', 'verification', 'billing', 'account', 'safety'];

const Routes = (function () {
  const role = () => Store.db.session.role;
  const R = (screen, controller, extra) => Object.assign({ screen, controller }, extra || {});

  function resolve(p) {
    const [pathPart, query] = p.split('?');
    const q = Object.fromEntries(new URLSearchParams(query || ''));
    const seg = pathPart.split('/').filter(Boolean);
    const who = role();
    const G = F.G, B = F.B, S = F.S;
    const pub = (g, b) => who === 'guest' ? g : b;
    const needs = (r) => who === r ? null : { redirect: who === 'guest' ? '/login' : (who === 'seller' ? '/hub' : '/') };

    if (!seg.length) return who === 'seller' ? { redirect: '/hub' } : R(pub(G.home, B.home), Pages.home, { title: 'Home', params: q });
    switch (seg[0]) {
      case 'categories': return R(pub(G.cats, B.cats), Pages.categories, { title: 'All Categories' });
      case 'product': return R(pub(G.product, B.product), Pages.product, { title: 'Product' });
      case 'how': return R(pub(G.how, B.how), Pages.how, { title: 'How it Works' });
      /* About Us and Pricing are built inside the How it Works frame for the role (js/sync.js).
         Sellers work in the Seller Hub; these public pages are for guests and buyers. */
      case 'about': return who === 'seller' ? { redirect: '/hub' } : R(pub(G.how, B.how), Pages.about, { title: 'About Us' });
      case 'pricing': return who === 'seller' ? { redirect: '/subscription' } : R(pub(G.how, B.how), Pages.pricing, { title: 'Pricing' });
      case 'find': return R(pub(G.find, B.find), Pages.find, { title: 'Find a Seller', params: q });
      case 'seller': return who === 'guest' ? R(G.find, Pages.find, { params: Object.assign({}, q, { gate: seg[1] }), title: 'Find a Seller' }) : R(B.profile, Pages.profile, { params: { id: seg[1] || 'srilakshmi' }, title: 'Seller profile' });
      case 'help': { const i = Math.max(0, HELP.indexOf(seg[1] || HELP[0])); const set = who === 'seller' ? S.help : who === 'buyer' ? B.help : G.help; return R(set[i], Pages.help, { params: { topic: HELP[i] }, title: 'Help' }); }
      case 'myenq': {
        if (who === 'guest') return { redirect: '/login' };
        const collapsed = Store.db.ui.sidebar === 'collapsed';
        if (!seg[1]) {
          // My enQ opens as a split view: chat list on the left, the newest chat open on the right
          const first = Store.convsFor(who)[0];
          if (!first) return R(who === 'buyer' ? (collapsed ? B.myenqC : B.myenq) : (collapsed ? S.myenqC : S.myenq), Pages.myenq, { title: 'My enQ', params: q });
          return { redirect: '/myenq/' + first.id };
        }
        const c = Store.conv(seg[1]); if (!c) return { redirect: '/myenq' };
        let screen;
        if (who === 'buyer') screen = c.status === 'active' ? B.chat : c.status === 'pending' ? B.chatWait : B.closed;
        else screen = c.status === 'active' ? S.chat : c.status === 'pending' ? S.request : c.status === 'declined' ? S.declined : S.closed;
        return R(screen, Pages.chat, { params: { id: c.id, enq: q.enq }, title: 'My enQ', keepScroll: !!q.enq });
      }
      case 'overview': return needs('buyer') || R(B.shortlists, Pages.overview, { title: 'Overview' });
      case 'notifications': if (who === 'guest') return { redirect: '/login' }; return R(who === 'buyer' ? B.notifications : S.notifications, Pages.notifications, { title: 'Notifications' });
      case 'shortlists': return needs('buyer') || R(B.shortlists, Pages.shortlists, { title: 'Shortlists' });
      case 'settings': if (who === 'guest') return { redirect: '/login' }; return who === 'buyer' ? R(B.settings, Pages.settings, { title: 'Profile & Settings' }) : R(seg[1] === 'preview' ? S.preview : S.settings, Pages.settings, { title: 'Profile & Settings', params: { preview: seg[1] === 'preview' } });
      case 'hub': return needs('seller') || R(S.hub, Pages.dashboard, { title: 'Seller Hub' });
      case 'catalogue': return needs('seller') || R(S.catalogue, Pages.catalogue, { title: 'Catalogue' });
      case 'subscription': return needs('seller') || R(S.subscription, Pages.subscription, { title: 'Subscription' });
      case 'login': return R(F.L[seg[1] || 'phone'] || F.L.phone, Auth.login, { params: { step: seg[1] || 'phone' }, title: 'Log in' });
      case 'register': {
        const kind = seg[1] === 'seller' ? 'seller' : 'buyer'; const step = seg[2] || 'form';
        const map = kind === 'seller' ? F.RS : F.RB;
        return R(map[step] || map.form, Auth.register, { params: { kind, step }, title: 'Register Free' });
      }
      case 's': return R(seg[1].replace('-', ':'), null, { title: 'Screen' });
      case 'screens': return { custom: Pages.screenIndex, title: 'All screens' };
    }
    return { redirect: '/' };
  }

  /* Figma prototype link → app. `el` is the clicked element (for context). */
  const byFrame = {};
  function add(ids, v) { (Array.isArray(ids) ? ids : [ids]).forEach(i => byFrame[i] = v); }
  add([F.G.home, F.B.home], '/'); add([F.G.cats, F.B.cats], '/categories'); add([F.G.product, F.B.product], '/product');
  add([F.G.find, F.B.find, F.B.findNew], '/find'); add([F.G.how, F.B.how], '/how');
  F.G.help.forEach((id, i) => add(id, '/help/' + HELP[i])); F.B.help.forEach((id, i) => add(id, '/help/' + HELP[i])); F.S.help.forEach((id, i) => add(id, '/help/' + HELP[i]));
  add(F.G.gate, () => Modals.gate()); add([F.B.enquiry, F.B.multi], el => () => Modals.enquiry({ sellerId: contextSeller(el) }));
  add(F.B.profile, el => '/seller/' + (contextSeller(el) || 'srilakshmi'));
  add(F.B.notifDrop, () => Modals.notificationsDropdown());
  add([F.B.myenq, F.S.myenq, F.B.replies], () => { Store.setSidebar('expanded'); return '/myenq'; });
  add([F.B.myenqC, F.S.myenqC], () => { Store.setSidebar('collapsed'); return '/myenq'; });
  add([F.B.chat, F.B.chatWait, F.B.closed, F.S.chat, F.S.request, F.S.reqRequest, F.S.declined, F.S.closed], '/myenq');
  add([F.B.notifications, F.S.notifications], '/notifications'); add(F.B.shortlists, '/shortlists');
  add([F.B.settings, F.S.settings], '/settings'); add(F.S.preview, '/settings/preview');
  add(F.S.hub, '/hub'); add(F.S.catalogue, '/catalogue'); add(F.S.subscription, '/subscription');
  /* Post a requirement was removed from the product; its old links land on Find a Seller */
  add([F.B.req, F.B.reqPicked], '/find'); add(F.B.reqPosted, '/myenq');
  Object.entries(F.L).forEach(([k, id]) => add(id, '/login/' + k));
  Object.entries(F.RB).forEach(([k, id]) => add(id, '/register/buyer/' + k));
  Object.entries(F.RS).forEach(([k, id]) => add(id, '/register/seller/' + k));

  function fromFrame(frameId, el) {
    let v = byFrame[frameId];
    if (typeof v === 'function') v = v(el);
    return v;
  }
  function contextSeller(el) {
    if (!el) return null;
    const row = el.closest('[data-seller-id]'); if (row) return row.dataset.sellerId;
    const p = App.page(); return p && p.params && p.params.id && Store.seller(p.params.id) ? p.params.id : null;
  }
  return { resolve, fromFrame };
})();
