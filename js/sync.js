/* Design sync — the Figma changes recorded in "IngredienPro - Change Log.md",
   applied to the screens as they render.

   The frames in screens/*.js are a snapshot of the Figma file taken before those
   changes. Re-fetching needs a Figma REST token (tools/fetch_figma.py). Until then
   this module brings every screen in line with the current design:

   - Header: no utility bar. Guest: About Us · How it Works · Category · Pricing ·
     Find a Seller · Log in · Register for free. Buyer: the same five items + bell +
     My Account. Seller: logo + Seller Hub badge · Help · bell · account.
   - Footer: Marketplace (All categories · Find a seller · List your business) or
     Seller Hub (Dashboard · My enQ · Catalogue · Subscription) · Company (About us ·
     How it works · Pricing · Contact us) · Support (Help centre · FAQ) · Legal.
   - Home: one "Browse by category" section; the supplier card rewritten.
   - How it Works: "List your business". Help: the "posted requirement" wording gone.
   - About Us and Pricing pages (Pages.about / Pages.pricing), built inside the real
     header, breadcrumb and footer of the How it Works frame for that role.

   When the snapshot is re-fetched from the updated Figma file, each step finds
   nothing left to change and does nothing. */
const Sync = (function () {
  const INK = '#111111', MUTE = '#555555';

  /* ---------------------------------------------------------------- header */
  function header(el, role, path) {
    const nav = el.querySelector('[data-name="Navigation bar"]'); if (!nav || nav.dataset.synced) return;
    nav.dataset.synced = '1';
    const ub = nav.querySelector('[data-name="Utility bar"]');
    if (ub) { ub.remove(); nav.style.height = 'auto'; nav.style.minHeight = '0'; }
    el.querySelectorAll('[data-name^="Header space"]').forEach(h => { h.style.height = '80px'; h.style.minHeight = '80px'; });
    const head = nav.querySelector('[data-name="Header"]'); if (!head) return;

    const pn = head.querySelector('[data-name="Primary nav"]');
    if (pn) {
      const cat = pn.querySelector('[data-name="Nav item / All Categories"], [data-name="Nav item / Category"]');
      const hiw = pn.querySelector('[data-name="Nav item / How it Works"]');
      const fas = pn.querySelector('[data-name="Nav item / Find a Seller"]');
      if (cat) {
        cat.dataset.name = 'Nav item / Category';
        [...cat.querySelectorAll('div')].forEach(d => { if (!d.children.length && /^(☰|▾)$/.test(d.textContent.trim())) d.remove(); });
        const lab = $.texts(cat).find(d => /All Categories|Category/.test(d.textContent)); if (lab) lab.textContent = 'Category';
      }
      const make = label => { let it = pn.querySelector(`[data-name="Nav item / ${label}"]`); if (it) return it; it = $.clone(hiw); it.dataset.name = 'Nav item / ' + label; $.texts(it)[0].textContent = label; return it; };
      if (hiw) [make('About Us'), hiw, cat, make('Pricing'), fas].filter(Boolean).forEach(n => pn.appendChild(n));
      const active = /^\/about/.test(path) ? 'About Us' : /^\/pricing/.test(path) ? 'Pricing' : /^\/how/.test(path) ? 'How it Works'
        : /^\/(categories|product)/.test(path) ? 'Category' : /^\/(find|seller)/.test(path) ? 'Find a Seller' : null;
      pn.querySelectorAll('[data-name^="Nav item / "]').forEach(it => {
        const on = it.dataset.name === 'Nav item / ' + active;
        it.style.borderBottom = on ? `2px solid ${INK}` : '0 solid transparent';
        $.texts(it).forEach(t => { t.style.fontWeight = on ? 600 : 500; t.style.color = on ? INK : MUTE; });
      });
    }
    const acts = head.querySelector('[data-name="Header actions"]');
    const textLink = (label, color) => { const d = document.createElement('div'); d.dataset.name = label; d.textContent = label; d.className = 'hdr-link'; d.style.color = color; return d; };
    if (acts && role === 'guest') {
      if (!acts.querySelector('[data-name="Log in"]')) acts.insertBefore(textLink('Log in', INK), acts.firstChild);
      const b = acts.querySelector('[data-name="Btn / Register Free"]');
      if (b) { b.dataset.name = 'Btn / Register for free'; const t = $.texts(b)[0]; if (t) t.textContent = 'Register for free'; }
      acts.style.gap = '24px'; acts.style.alignItems = 'center';
    }
    if (acts && role === 'seller' && !acts.querySelector('[data-name="Help"]')) {
      acts.insertBefore(textLink('Help', '#333333'), acts.firstChild); acts.style.gap = '20px'; acts.style.alignItems = 'center';
    }
  }

  /* ---------------------------------------------------------------- footer */
  function footer(el, role) {
    el.querySelectorAll('[data-name="Section / Footer"], [data-name="Footer"]').forEach(f => {
      if (f.dataset.synced) return; f.dataset.synced = '1';
      const buy = f.querySelector('[data-name="Col / Buy"]'), comp = f.querySelector('[data-name="Col / Company"]'), legal = f.querySelector('[data-name="Col / Legal"]');
      if (!buy || !comp || !legal) return;           // already the new footer
      const setCol = (col, labels) => { const t0 = $.texts(col)[0]; $.texts(col).forEach(t => t.remove()); labels.forEach(l => { const t = $.clone(t0); t.textContent = l; t.dataset.name = l; col.appendChild(t); }); };
      if (role === 'seller') { buy.dataset.name = 'Col / Seller Hub'; setCol(buy, ['Dashboard', 'My enQ', 'Catalogue', 'Subscription']); }
      else { buy.dataset.name = 'Col / Marketplace'; setCol(buy, ['All categories', 'Find a seller', 'List your business']); }
      setCol(comp, ['About us', 'How it works', 'Pricing', 'Contact us']);
      const sup = $.clone(legal); sup.dataset.name = 'Col / Support'; legal.before(sup); setCol(sup, ['Help centre', 'FAQ']);
    });
  }

  /* ---------------------------------------------------------------- page content */
  function content(el, path) {
    /* Home: the Browse by category section appeared twice */
    [...el.querySelectorAll('[data-name="Section / Browse by category"]')].slice(1).forEach(s => s.remove());
    /* Home: supplier pathway card — IngredienPro lists verified suppliers, it doesn't sell */
    const card = el.querySelector('[data-name="Card / Sell pathway"], [data-name="Card / Supplier listing"]');
    if (card && !card.dataset.synced) {
      card.dataset.synced = '1';
      $.set(card, /^WANT TO GROW/, 'FOR INGREDIENT SUPPLIERS');
      $.set(card, /^Sell on IngredienPro$/, 'Get listed as a verified supplier');
      $.set(card, /^Get verified, list your products/, 'Once your GST and FSSAI documents are verified, food businesses can find you by category and send you enquiries directly.');
      const btn = card.querySelector('[data-name^="Btn / "]');
      if (btn) { btn.dataset.name = 'Btn / List your business'; const t = $.texts(btn)[0]; if (t) t.textContent = 'List your business'; }
    }
    /* How it Works (buyer): the seller call to action */
    el.querySelectorAll('[data-name="Btn / Register as seller"]').forEach(b => { const t = $.texts(b)[0]; if (t && /Sell on IngredienPro/.test(t.textContent)) { t.textContent = 'List your business'; b.dataset.name = 'Btn / List your business'; } });
    /* Help: posted requirements no longer exist */
    $.texts(el).forEach(t => { if (/ or a posted requirement/.test(t.textContent)) t.textContent = t.textContent.replace(' or a posted requirement', ''); });
    /* any stray "Sell on IngredienPro" / "Become a seller" copy */
    $.texts(el).forEach(t => { const v = t.textContent.trim(); if (v === 'Sell on IngredienPro' || v === 'Become a seller' || v === 'Become  a seller') t.textContent = 'List your business'; });
  }

  function apply(el, route) {
    const role = Store.db.session.role, path = App.path();
    header(el, role, path); footer(el, role); content(el, path);
  }

  /* ---------------------------------------------------------------- About Us / Pricing
     Built inside the How it Works frame for the role, so the header, breadcrumb and
     footer are the real ones. Content follows G-08 / G-09 in Figma. */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function host(el, crumb) {
    const bc = el.querySelector('[data-name="Breadcrumb"]'); if (bc) { const t = $.texts(bc); t[t.length - 1].textContent = crumb; }
    const bar = el.querySelector('[data-name="Breadcrumb bar"]'); const foot = el.querySelector('[data-name="Section / Footer"], [data-name="Footer"]');
    [...el.children].filter(c => c !== bar && c !== foot && !/Navigation bar/.test(c.dataset.name || '')).forEach(c => c.remove());
    const wrap = document.createElement('div'); wrap.className = 'pg';
    el.insertBefore(wrap, foot || null);
    return wrap;
  }
  function wire(root) { root.querySelectorAll('[data-go]').forEach(x => x.addEventListener('click', e => { e.stopPropagation(); App.go(x.dataset.go); })); }

  function about(el) {
    const buyer = Store.db.session.role === 'buyer';
    const w = host(el, 'About Us');
    w.innerHTML = `
      <section class="pg-sec pg-hero"><span class="pg-eyebrow">ABOUT US</span><h1>We help food businesses find suppliers they can trust</h1>
        <p class="pg-lead">IngredienPro is an Indian B2B platform that lists verified food ingredient suppliers and connects them with buyers in India and around the world. We are a small team of people from the food and ingredient trade, and from technology.</p></section>
      <section class="pg-sec pg-flush"><div class="pg-photo" role="img" aria-label="Team or warehouse photo">TEAM / WAREHOUSE PHOTO</div></section>
      <section class="pg-sec"><div class="pg-two"><div><span class="pg-eyebrow">OUR STORY</span><h2>Built by people from the ingredient trade</h2></div>
        <div class="pg-story"><p>Our founders spent years buying and selling ingredients for Indian food manufacturers. Every new requirement meant the same routine: calling contacts, asking for references and hoping the supplier on the other end held the licences they claimed.</p>
        <p>Good suppliers were hard to find, and harder to verify. Buyers wasted days on calls that went nowhere, while reliable manufacturers and traders struggled to reach buyers beyond their own networks.</p>
        <p>IngredienPro is the platform they wanted then: one place where every supplier has been checked, enquiries arrive with the details that matter, and both sides agree the deal directly.</p></div></div></section>
      <section class="pg-sec pg-soft"><span class="pg-eyebrow">MILESTONES</span><h2>How we got here</h2><div class="pg-grid4 pg-timeline">
        ${[['20XX', 'The idea', 'Founders map how Indian food businesses source ingredients, and where trust breaks down.'], ['20XX', 'First suppliers verified', 'The first spice and oil suppliers complete GST and FSSAI verification.'], ['2026', 'Platform launch', 'IngredienPro opens to buyers worldwide, free during the launch offer.'], ['Next', 'Growing the directory', 'More categories, more verified suppliers and more cities across India.']].map(([y, t, b]) => `<div class="pg-mile"><strong class="pg-year">${y}</strong><h3>${t}</h3><p>${b}</p></div>`).join('')}</div></section>
      <section class="pg-sec"><span class="pg-eyebrow">OUR MISSION</span><p class="pg-mission">To make ingredient sourcing in India verified, structured and fair — for the business buying and the business supplying.</p>
        <div class="pg-grid3">${[['Trust you can check', 'We show buyers what we have verified and when certificates expire, instead of asking them to take our word for it.'], ['Respect for everyone’s time', 'Enquiries carry quantity, price and delivery details, so suppliers can answer properly or decline quickly.'], ['We connect, you decide', 'Price, payment and delivery are agreed between buyer and supplier. We never take a cut of the deal.']].map(([t, b]) => `<div class="pg-card"><h3>${t}</h3><p>${b}</p></div>`).join('')}</div></section>
      <section class="pg-sec pg-soft"><span class="pg-eyebrow">THE PEOPLE BEHIND IT</span><h2>Meet the founders</h2><p class="pg-sub">Backgrounds in ingredient trading, food manufacturing and technology.</p>
        <div class="pg-grid3">${[['Co-founder & CEO', 'years in ingredient trading, companies worked with, why they started IngredienPro'], ['Co-founder & COO', 'food manufacturing and supply-chain experience'], ['Co-founder & CTO', 'building marketplaces and B2B software']].map(([r, b]) => `<div class="pg-card pg-person"><div class="pg-photo sm" role="img" aria-label="Founder photo">PHOTO</div><h3>[Founder name]</h3><span class="pg-role">${r}</span><p>[Two lines on background — e.g. ${b}.]</p><span class="pg-li">LinkedIn ↗</span></div>`).join('')}</div></section>
      <section class="pg-sec"><span class="pg-eyebrow">INGREDIENPRO TODAY</span><h2>A growing directory of checked suppliers</h2><p class="pg-sub">Figures update as suppliers are verified and buyers join.</p>
        <div class="pg-grid4">${[['[000]+', 'Verified suppliers listed'], ['[00]', 'Ingredient categories'], ['[00]', 'Indian states with listed suppliers'], ['[00]', 'Countries our buyers source from']].map(([n, l]) => `<div class="pg-card pg-stat"><strong>${n}</strong><p>${l}</p></div>`).join('')}</div></section>
      <section class="pg-sec pg-soft"><span class="pg-eyebrow">WHERE TO NEXT</span><h2>Start with what you need</h2><div class="pg-grid2">
        <div class="pg-card pg-path"><span class="pg-eyebrow">FOR BUYERS</span><h3>Looking for an ingredient supplier?</h3><p>Search verified suppliers by category, certification and location, and send your first enquiry free.</p><button class="ep-btn primary" data-go="/find">Find a seller</button></div>
        <div class="pg-card pg-path"><span class="pg-eyebrow">FOR SUPPLIERS</span><h3>Supplying food ingredients?</h3><p>Get verified and listed in the categories you supply, so buyers searching for them can find you.</p><button class="ep-btn primary" data-go="/register/seller">List your business</button></div></div>
        <button class="pg-textlink" data-go="/how">Want the details first? See how IngredienPro works →</button></section>
      <section class="pg-sec"><div class="pg-band"><div><h2>Get in touch</h2><p>For partnerships, press or questions about listing your business, write to our team.</p></div><button class="ep-btn pg-inv" data-contact>Contact us</button></div></section>`;
    w.querySelector('[data-contact]').addEventListener('click', () => App.toast('Contact Us is not built yet — it’s an open item in the change log'));
    wire(w);
    if (buyer) { /* nothing else differs for a signed-in buyer — the header already does */ }
  }

  const RATES = [['Spices & Seasonings', 2500], ['Oils & Fats', 2500], ['Dairy Ingredients', 3000], ['Proteins & Isolates', 3000], ['Sweeteners', 2000], ['Flours & Grains', 2000]];
  const inr = n => '₹' + n.toLocaleString('en-IN');
  function pricing(el) {
    const w = host(el, 'Pricing');
    let billing = 'monthly';
    w.innerHTML = `
      <section class="pg-sec pg-hero"><h1>Pricing</h1><p class="pg-lead">Buyers use IngredienPro free during the launch offer. Suppliers pay a subscription for each product category they want to be listed in — there are no packages, and we never take a commission on deals.</p></section>
      <section class="pg-sec"><div class="pg-headrow"><div><span class="pg-eyebrow">FOR SUPPLIERS</span><h2>Pay only for the categories you supply</h2><p class="pg-sub">Fees include GST · Billed monthly or annually · Your subscription is the total of your categories</p></div>
        <div class="pg-toggle" role="radiogroup" aria-label="Billing"><button role="radio" data-bill="monthly">Monthly</button><button role="radio" data-bill="annual">Annual · save 15%</button></div></div>
        <div class="pg-table" role="table"></div>
        <p class="pg-note">Illustrative rates. The final rate card is set by IngredienPro and shown live as you add products during onboarding. All fees include GST.</p></section>
      <section class="pg-sec pg-soft"><span class="pg-eyebrow">HOW BILLING WORKS</span><h2>You pay only after you’re verified</h2><p class="pg-sub">Payments are processed securely by Razorpay.</p>
        <div class="pg-grid4">${[['Choose your categories', 'Add your products during onboarding and assign each to a category. The fee for each one shows as you go.', 'Live pricing'], ['Get verified', 'We check your GST, FSSAI and quality documents. A payment link is sent the moment you’re approved.', 'Link on WhatsApp + email'], ['Pay and go live', 'Pay monthly or annually. Every payment comes with a GST invoice, and renewal reminders arrive 30, 7 and 1 days ahead.', 'GST invoice included'], ['Add categories any time', 'Expand your range after going live. A new category is prorated to your current billing period.', 'Prorated']].map(([t, b, m], i) => `<div class="pg-card"><span class="pg-num">${i + 1}</span><h3>${t}</h3><p>${b}</p><span class="pg-chip">${m}</span></div>`).join('')}</div></section>
      <section class="pg-sec"><h2>Also good to know</h2><div class="pg-grid3">${[['Free for buyers', 'Buyers search, enquire and chat at no cost during the launch offer, from anywhere in the world.'], ['Profile Views add-on', 'See which buyers viewed your profile and when. Billed separately on top of your category subscription.'], ['No commission on deals', 'Price, payment and delivery are agreed directly with the buyer. We never take a cut.']].map(([t, b]) => `<div class="pg-card pg-plain"><h3>${t}</h3><p>${b}</p></div>`).join('')}</div></section>
      <section class="pg-sec"><div class="pg-band"><div><h2>Ready to list your business?</h2><p>Register with your WhatsApp number and email. Add products and documents at your own pace — you pay only once you’re approved.</p></div><button class="ep-btn pg-inv" data-go="/register/seller">List your business</button></div></section>`;
    const table = w.querySelector('.pg-table');
    const draw = () => {
      const annual = billing === 'annual';
      const val = m => annual ? inr(Math.round(m * 12 * 0.85 / 100) * 100) + ' / year' : inr(m) + ' / month';
      table.innerHTML = `<div class="pg-tr pg-th" role="row"><span role="columnheader">CATEGORY</span><span role="columnheader">${annual ? 'ANNUAL (BILLED YEARLY)' : 'MONTHLY'}</span></div>`
        + RATES.map(([c, m]) => `<div class="pg-tr" role="row"><span role="cell">${esc(c)}</span><span role="cell">${val(m)}</span></div>`).join('')
        + `<div class="pg-tr pg-total" role="row"><span role="cell">Example: Spices & Seasonings + Oils & Fats</span><span role="cell">${val(5000)}</span></div>`;
      w.querySelectorAll('[data-bill]').forEach(b => { const on = b.dataset.bill === billing; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    };
    w.querySelectorAll('[data-bill]').forEach(b => b.addEventListener('click', () => { billing = b.dataset.bill; draw(); }));
    draw(); wire(w);
  }

  return { apply, about, pricing };
})();
Pages.about = el => Sync.about(el);
Pages.pricing = el => Sync.pricing(el);
