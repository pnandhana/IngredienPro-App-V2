/* The prototype's only chrome: a small floating role switch.

   Guest / Buyer / Seller changes who the app is viewed as, straight away, and stays
   on the same page when that page reads the same for everyone. In Seller view a
   "Signed in as" picker lets you act as any seller in the directory — so when the
   buyer sends an enquiry to, say, Sri Lakshmi Spice Mills, you switch to Seller,
   pick Sri Lakshmi and accept it. Sellers with new enquiries are marked.

   It replaced the flow sidebar and keeps that bar's hooks (`.rolebar`,
   `[data-role]`, `.rb-reset`) so the scripted checks in tools/ still find it. */

/* paths that read the same whoever is looking, so switching role stays put */
const SHARED = ['/find', '/categories', '/product', '/how', '/help', '/screens', '/s/'];

const RoleBar = (function () {
  let bar = null;

  function build() {
    bar = document.createElement('div');
    bar.className = 'rolebar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Prototype controls');
    bar.innerHTML = `
      <span class="rb-label">View as</span>
      <div class="rb-tabs" role="tablist" aria-label="View the app as">
        <button role="tab" data-role="guest">Guest</button>
        <button role="tab" data-role="buyer">Buyer</button>
        <button role="tab" data-role="seller">Seller</button>
      </div>
      <label class="rb-who"><span class="rb-who-l"></span><select aria-label="Signed in as"></select></label>
      <button class="rb-btn rb-reset" type="button" title="Clear every enquiry, chat, account and picture and start again">↺ Reset</button>`;

    bar.querySelectorAll('[data-role]').forEach(b => b.onclick = () => {
      const role = b.dataset.role, was = Store.db.session.role;
      if (was === role) return;
      Store.setRole(role);
      const here = App.path();
      const shared = SHARED.some(p => here === p || here.indexOf(p) === 0);
      App.go(shared ? here : (role === 'seller' ? '/hub' : '/'));
      update();
    });
    bar.querySelector('select').onchange = e => {
      Store.setSellerIdentity(e.target.value);
      const c = Store.convsFor('seller')[0];
      App.go(c && c.enquiries.some(x => x.status === 'pending') ? '/myenq/' + c.id : '/hub');
      App.toast('Signed in as ' + Store.db.accounts.seller.company);
    };
    bar.querySelector('.rb-reset').onclick = () => {
      if (!confirm('Reset the prototype? This clears every enquiry, chat, registered account and uploaded picture.')) return;
      Store.reset(); Behaviour.reset(); try { sessionStorage.removeItem('ingredienpro.auth'); } catch (e) {}
      App.go('/'); App.toast('Prototype reset — everything starts empty');
    };
    document.body.appendChild(bar);
  }

  /* who you can act as: the account you registered, then sellers with new
     enquiries, then everyone else in the directory */
  function sellerOptions() {
    const db = Store.db; const cur = db.accounts.seller.id;
    const pendingFor = sid => db.conversations.filter(c => c.sellerId === sid).reduce((n, c) => n + c.enquiries.filter(e => e.status === 'pending').length, 0);
    const reg = db.registered.seller;
    return db.sellers.map(s => ({ id: s.id, name: s.name, n: pendingFor(s.id), reg: s.id === reg, cur: s.id === cur }))
      .sort((a, b) => (b.reg - a.reg) || (b.n - a.n) || a.name.localeCompare(b.name));
  }

  function update() {
    if (!bar) build();
    const role = Store.db.session.role, acc = Store.db.accounts;
    bar.querySelectorAll('[data-role]').forEach(b => { const on = b.dataset.role === role; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    bar.querySelector('[data-role="buyer"]').title = 'Buyer · ' + acc.buyer.company;
    const who = bar.querySelector('.rb-who');
    who.hidden = role === 'guest';
    if (role === 'buyer') {
      who.querySelector('.rb-who-l').textContent = acc.buyer.company.replace(/ Pvt Ltd$/, '');
      who.querySelector('select').hidden = true;
    } else if (role === 'seller') {
      const sel = who.querySelector('select'); sel.hidden = false;
      who.querySelector('.rb-who-l').textContent = 'as';
      sel.innerHTML = '';
      sellerOptions().forEach(o => { const op = document.createElement('option'); op.value = o.id; op.textContent = o.name + (o.reg ? ' (you registered)' : '') + (o.n ? `  ·  ${o.n} new` : ''); op.selected = o.cur; sel.appendChild(op); });
    }
  }

  return { update };
})();
