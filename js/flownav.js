/* The reviewer's sidebar: the eleven prototype flows, filtered by who they are for.

   The role chips at the top do two things at once, deliberately — they set the role
   the app is viewed as, and they narrow the list to that role's flows. One control,
   one meaning. "All" shows every flow without changing the current role.

   It replaces the floating role bar, and keeps that bar's markup (`.rolebar`,
   `[data-role]`, `.rb-reset`) so the scripted checks in tools/ still find it. */

const Flows = [
  { n: '01', for: ['guest'], as: 'guest', title: 'Browse categories → product → sellers',
    note: 'Category tiles, a product page, then the sellers who make it' },
  { n: '02', for: ['guest'], as: 'guest', title: 'Find a seller → enquiry → sign-up gate',
    note: 'Seller names are masked; any enquiry opens the gate' },
  { n: '03', for: ['guest', 'buyer'], as: 'guest', title: 'Register Free — buyer',
    note: 'Form → WhatsApp and email codes → sourcing preferences', path: '/register/buyer' },
  { n: '04', for: ['guest', 'seller'], as: 'guest', title: 'Register Free — seller',
    note: 'Documents → automated check → products → plan → review → live', path: '/register/seller' },
  { n: '05', for: ['guest', 'buyer', 'seller'], as: 'guest', title: 'Log in — WhatsApp or email',
    note: 'A number starting 98450 lands in the Seller Hub', path: '/login' },
  { n: '06', for: ['buyer'], as: 'buyer', title: 'Send an enquiry',
    note: 'One or more products · similar sellers · the not-sold prompt', path: '/find' },
  { n: '07', for: ['buyer'], as: 'buyer', title: 'Post a requirement',
    note: 'Goes to every seller in the detected category', path: '/find', opens: 'requirement' },
  { n: '08', for: ['buyer'], as: 'buyer', title: 'My enQ — chats & My Account',
    note: 'Chat list beside the open chat · notifications · shortlists', path: '/myenq' },
  { n: '09', for: ['seller'], as: 'seller', title: 'Seller Hub — dashboard & sections',
    note: 'Dashboard, catalogue, subscription, profile & settings', path: '/hub' },
  { n: '10', for: ['seller'], as: 'seller', title: 'My enQ — accept or decline',
    note: 'A new request, then accept, decline with a reason, or close', path: '/myenq' },
  { n: '11', for: ['seller'], as: 'seller', title: 'Requirement request',
    note: 'An enquiry posted to the whole category, seller side', path: '/myenq' }
];
/* the first two guest flows start where the browsing does */
Flows[0].path = '/categories';
Flows[1].path = '/find';

/* paths that read the same whoever is looking, so switching role stays put */
const SHARED = ['/find', '/categories', '/product', '/how', '/help', '/screens', '/s/'];

const RoleBar = (function () {
  let nav = null, filter = 'all', current = null;

  function matches(f) { return filter === 'all' || f.for.indexOf(filter) !== -1; }

  function build() {
    nav = document.createElement('aside');
    nav.className = 'flownav';
    nav.setAttribute('aria-label', 'Prototype flows');
    nav.innerHTML = `
      <div class="fn-top">
        <div class="fn-title">IngredienPro <span>prototype</span></div>
        <div class="rolebar">
          <span class="rb-label">View as</span>
          <div class="rb-tabs" role="tablist" aria-label="View the app as">
            <button role="tab" data-role="guest">Guest</button>
            <button role="tab" data-role="buyer">Buyer <small></small></button>
            <button role="tab" data-role="seller">Seller <small></small></button>
          </div>
        </div>
        <button class="fn-all" type="button">Show all flows</button>
      </div>
      <nav class="fn-flows" aria-label="Flows"></nav>
      <div class="fn-foot">
        <button class="rb-btn rb-index" type="button">All screens</button>
        <button class="rb-btn rb-reset" type="button" title="Reset all demo data">↺ Reset</button>
      </div>`;

    nav.querySelectorAll('[data-role]').forEach(b => b.onclick = () => {
      const role = b.dataset.role;
      filter = role;
      const was = Store.db.session.role;
      if (was !== role) Store.setRole(role);
      const here = App.path();
      const shared = SHARED.some(p => here === p || here.indexOf(p) === 0);
      if (was !== role) { current = null; App.go(shared ? here : (role === 'seller' ? '/hub' : '/')); }
      update();
    });
    nav.querySelector('.fn-all').onclick = () => { filter = filter === 'all' ? Store.db.session.role : 'all'; update(); };
    nav.querySelector('.rb-index').onclick = () => App.go('/screens');
    nav.querySelector('.rb-reset').onclick = () => { Store.reset(); Behaviour.reset(); App.go('/'); App.toast('Demo data reset'); };

    document.body.appendChild(nav);

    /* off-canvas below 1100, with its own toggle so it never fights the app's nav */
    const toggle = document.createElement('button');
    toggle.className = 'fn-toggle';
    toggle.type = 'button';
    toggle.innerHTML = '<span></span>Flows';
    toggle.onclick = () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    };
    document.body.appendChild(toggle);
    nav.addEventListener('click', e => { if (e.target.closest('.fn-flow, .rb-btn, [data-role]')) nav.classList.remove('open'); });
  }

  function drawFlows() {
    const list = nav.querySelector('.fn-flows');
    const here = App.path();
    list.innerHTML = '';
    const shown = Flows.filter(matches);
    for (const f of shown) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fn-flow';
      if (f === active(shown, here)) b.classList.add('on');
      b.innerHTML = `<span class="fn-n">${f.n}</span><span class="fn-t"></span><span class="fn-note"></span>`;
      b.querySelector('.fn-t').textContent = f.title;
      b.querySelector('.fn-note').textContent = f.note;
      b.onclick = () => run(f);
      list.appendChild(b);
    }
    if (!shown.length) {
      const p = document.createElement('p');
      p.className = 'fn-empty';
      p.textContent = 'No flows for this role.';
      list.appendChild(p);
    }
  }

  /* several flows start on the same page, so a path alone cannot say which one is
     running. The one last picked wins; otherwise the first that fits both the path
     and the role being viewed. */
  function active(shown, here) {
    if (current && shown.indexOf(current) !== -1) return current;
    const role = Store.db.session.role;
    const fits = f => here === f.path || (f.path !== '/' && here.indexOf(f.path) === 0);
    return shown.find(f => fits(f) && f.as === role) || shown.find(fits) || null;
  }

  function run(f) {
    current = f;
    if (Store.db.session.role !== f.as) Store.setRole(f.as);
    App.go(f.path);
    if (f.opens === 'requirement') setTimeout(() => Modals.requirement(), 420);
    update();
  }

  function update() {
    if (!nav) build();
    /* a flow stops being "the one running" once you navigate away from its start */
    if (current) {
      const here = App.path();
      const still = here === current.path || (current.path !== '/' && here.indexOf(current.path) === 0);
      if (!still && !document.querySelector('.overlay')) current = null;
    }
    const role = Store.db.session.role;
    nav.querySelectorAll('[data-role]').forEach(b => {
      const on = b.dataset.role === role;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
      b.classList.toggle('filtering', filter === b.dataset.role);
    });
    const acc = Store.db.accounts;
    nav.querySelector('[data-role="buyer"] small').textContent = '· ' + (acc.buyer.company || '').replace(/ Pvt Ltd$/, '');
    nav.querySelector('[data-role="seller"] small').textContent = '· ' + (acc.seller.company || '').replace(/ Works$/, '');
    nav.querySelector('.fn-all').textContent = filter === 'all' ? 'Filter to this role' : 'Show all flows';
    nav.querySelector('.fn-all').classList.toggle('on', filter === 'all');
    drawFlows();
  }

  return { update, flows: Flows };
})();
