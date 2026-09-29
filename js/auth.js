/* Log in and Register Free — real inputs on top of the Figma screens.
   Demo rules (shown in a hint on the code screens):
   code ending 000 = wrong code, ending 111 = expired, anything else = correct.
   Log in with a number starting 98450 → Seller Hub; any other number → buyer. */
const Auth = (function () {
  const SS = 'ingredienpro.auth';
  const get = () => { try { return JSON.parse(sessionStorage.getItem(SS)) || {}; } catch (e) { return {}; } };
  const put = o => sessionStorage.setItem(SS, JSON.stringify(Object.assign(get(), o)));

  /* 6-digit boxes: a hidden input drives the Digit frames. */
  function otp(boxes, onDone) {
    if (!boxes) return;
    const digits = [...boxes.querySelectorAll('[data-name="Digit"]')];
    const inp = document.createElement('input'); inp.inputMode = 'numeric'; inp.maxLength = 6; inp.className = 'otp-input'; inp.setAttribute('aria-label', 'Enter the 6-digit code');
    boxes.style.position = 'relative'; boxes.appendChild(inp);
    const paint = () => digits.forEach((d, i) => { let t = $.texts(d)[0]; if (!t) { t = document.createElement('div'); t.style.cssText = 'font:600 20px Inter;color:#111'; d.appendChild(t); } t.textContent = inp.value[i] || (i === inp.value.length ? '|' : ''); t.style.color = i === inp.value.length ? '#aaaaaa' : '#111111'; d.style.borderColor = i === inp.value.length ? '#111111' : ''; });
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); paint(); if (inp.value.length === 6 && onDone) onDone(inp.value); });
    boxes.dataset.override = '1'; boxes.addEventListener('click', e => { e.stopPropagation(); inp.focus(); });
    paint(); return inp;
  }
  function hint(el, text) { const h = document.createElement('div'); h.className = 'demo-hint'; h.textContent = text; el.appendChild(h); }
  const outcome = code => /000$/.test(code) ? 'wrong' : /111$/.test(code) ? 'expired' : 'correct';

  /* ---------- Log in ---------- */
  function login(el, p) {
    const s = get();
    if (p.step === 'phone' || p.step === 'email') {
      const card = el.querySelector('[data-name="Login card"]');
      const inp = card.querySelector('[data-name="Input"], [data-name="Phone input"], [data-name="Field"]') || [...card.querySelectorAll('[data-name]')].find(x => /Input|Number|Email/.test(x.dataset.name));
      let val = p.step === 'phone' ? (s.phone || '') : (s.email || '');
      const t = Modals.field(inp && (inp.querySelector('[data-name="Input"]') || inp), val, v => val = v.trim(), { placeholder: p.step === 'phone' ? '98470 22110' : 'you@company.com', onEnter: () => send() });
      const btn = card.querySelector('[data-name^="Btn / Send code"]');
      function send() { if (val.replace(/\D/g, '').length < (p.step === 'phone' ? 8 : 0) && p.step === 'phone') return App.toast('Enter your WhatsApp number'); if (p.step === 'email' && !/@/.test(val)) return App.toast('Enter your work email'); put(p.step === 'phone' ? { phone: val, channel: 'WhatsApp' } : { email: val, channel: 'email' }); App.go('/login/code'); }
      $.on(btn, send);
      hint(card, 'Demo: numbers starting 98450 log in to the Seller Hub (Ashwin Spice Works). Any other number logs in as the buyer (Vega Foods).');
      if (t) setTimeout(() => t.focus(), 50);
    }
    if (p.step === 'code') {
      const card = el.querySelector('[data-name="Login card"]');
      $.set(card, /^We sent a 6-digit code/, `We sent a 6-digit code ${s.channel === 'email' ? 'to ' + s.email : 'on WhatsApp to +91 ' + (s.phone || '98470 12345')}.`);
      let code = '';
      const i = otp(card.querySelector('[data-name="OTP boxes"]'), v => code = v); if (i) setTimeout(() => i.focus(), 50);
      $.on(card.querySelector('[data-name="Btn / Log in"]'), () => {
        if (code.length < 6) return App.toast('Enter the 6-digit code');
        if (outcome(code) !== 'correct') return App.toast(outcome(code) === 'wrong' ? 'That code isn’t right. Check the latest message and try again.' : 'That code has expired. We’ve sent a new one.');
        const role = /^98450/.test((s.phone || '').replace(/\s/g, '')) ? 'seller' : 'buyer';
        Store.login(role); App.toast('Welcome back, ' + Store.db.accounts[role].company); App.go(role === 'seller' ? '/hub' : '/');
      });
      hint(card, 'Demo: any 6 digits log you in. Codes ending 000 are wrong, 111 are expired.');
    }
  }

  /* ---------- Register Free ---------- */
  function register(el, p) {
    const s = get(); const kind = p.kind; const step = p.step;
    const base = '/register/' + kind + '/';
    const card = el.querySelector('[data-name="Body"]') || el;
    // buyer / seller switch on the form
    el.querySelectorAll('[data-name*="I’m buying"], [data-name*="I\'m buying"]').forEach(x => $.on(x, () => App.go('/register/buyer')));
    [...el.querySelectorAll('div')].filter(d => !d.children.length && /^I’m (buying|selling)$/.test(d.textContent.trim())).forEach(d => $.on(d.parentElement, () => App.go('/register/' + (/buying/.test(d.textContent) ? 'buyer' : 'seller'))));

    if (step === 'form' || step === 'errors') {
      const form = s[kind] || {};
      const labels = { 'Your name': 'name', 'Company name': 'company', 'WhatsApp number': 'phone', 'Work email': 'email' };
      Object.entries(labels).forEach(([label, key]) => {
        const lab = $.text(card, label); if (!lab) return; const fieldEl = lab.closest('[data-name^="Field"]') || lab.parentElement;
        const inp = fieldEl.querySelector('[data-name="Input"]') || [...fieldEl.children].find(c => c !== lab && c.style.border);
        const sample = inp ? ($.texts(inp).filter(x => x.textContent.trim().length > 3).pop() || {}).textContent : '';
        if (form[key] === undefined) form[key] = step === 'errors' ? '' : (sample || '').trim();
        const box = inp && (inp.querySelector('[data-name="Number"]') || inp);
        Modals.field(box, form[key], v => { form[key] = v.trim(); put({ [kind]: form }); });
      });
      const types = [...card.querySelectorAll('div')].filter(d => !d.children.length && /^(Manufacturer|Trader \/ Distributor|Importer)$/.test(d.textContent.trim()));
      types.forEach(t => $.on(t.parentElement, () => { form.type = t.textContent.trim(); put({ [kind]: form }); types.forEach(x => { const on = x === t; x.parentElement.style.background = on ? '#ffffff' : 'transparent'; x.style.fontWeight = on ? 600 : 500; }); }));
      put({ [kind]: form });
      const cont = card.querySelector('[data-name="Button / Continue"]');
      $.on(cont, () => { const f = get()[kind] || {}; const missing = ['name', 'company', 'phone', 'email'].filter(k => !(f[k] || '').trim()); if (missing.length) { if (kind === 'buyer' && step !== 'errors') return App.go(base + 'errors'); return App.toast('Fill in: ' + missing.join(', ')); } if (!/@/.test(f.email)) return App.toast('Enter a valid work email'); App.go(base + (kind === 'buyer' ? 'verify' : 'codes')); });
      return;
    }
    // code screens
    if (['verify', 'codes', 'wrong', 'expired', 'correct'].includes(step)) {
      const f = s[kind] || {}; $.texts(card).forEach(t => { if (/^\+91 \d/.test(t.textContent.trim()) && f.phone) t.textContent = '+91 ' + f.phone; if (/@/.test(t.textContent) && t.textContent.trim().split(' ').length === 1 && f.email) t.textContent = f.email; });
      const codes = {}; card.querySelectorAll('[data-name="Boxes"], [data-name="OTP boxes"]').forEach((b, i) => { if (step === 'correct' || step === 'verify') return; otp(b, v => codes[i] = v); });
      const next = card.querySelector('[data-name="Button / Verify and continue"]');
      $.on(next, () => { const vals = Object.values(codes); if (vals.length < 1 || vals.some(v => v.length < 6)) return App.toast('Enter both 6-digit codes'); const bad = vals.map(outcome).find(o => o !== 'correct'); App.go(base + (bad || 'correct')); });
      const cont = card.querySelector('[data-name="Button / Continue"]'); $.on(cont, () => App.go(base + (kind === 'buyer' ? 'prefs' : 'docs')));
      if (step !== 'correct' && step !== 'verify') hint(card, 'Demo: codes ending 000 are wrong, 111 are expired, anything else is correct.');
      return;
    }
    if (step === 'prefs') {
      card.querySelectorAll('[data-name^="Chip / "]').forEach(ch => $.on(ch, () => { const on = ch.dataset.on !== '1'; ch.dataset.on = on ? '1' : '0'; ch.style.background = on ? '#111111' : '#ffffff'; $.texts(ch).forEach(t => t.style.color = on ? '#ffffff' : '#111111'); }));
      const done = to => { const f = get().buyer || {}; Store.registerBuyer({ name: f.name || 'New buyer', company: f.company || 'New Buyer Co', phone: f.phone, email: f.email }); App.toast('Your buyer account is ready'); App.go(to); };
      $.on(card.querySelector('[data-name="Button / Start sourcing"]'), () => done('/find'));
      card.querySelectorAll('[data-name="Button / Skip for now"], [data-name="Skip for now"]').forEach(b => $.on(b, () => done('/')));
      return;
    }
    // seller onboarding
    if (step === 'docs' || step === 'docsError') {
      card.querySelectorAll('[data-name="Button / Upload"], [data-name="Button / Upload again"]').forEach(b => $.on(b, () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.pdf,.jpg,.png'; i.onchange = () => { if (i.files[0]) { const row = b.parentElement; const name = $.texts(row).find(t => /\.(pdf|jpg|png)$/i.test(t.textContent.trim())); if (name) name.textContent = i.files[0].name; $.texts(b)[0].textContent = 'Replace'; App.toast(i.files[0].name + ' uploaded'); } }; i.click(); }));
      $.on(card.querySelector('[data-name="Button / Run verification check"]'), () => App.go(base + 'running'));
      return;
    }
    if (step === 'running') { setTimeout(() => { if (App.path() === base + 'running') App.go(base + 'pass'); }, 2600); hint(card, 'Checking your documents… (demo: passes in a few seconds)'); return; }
    if (step === 'pass') { $.on(card.querySelector('[data-name="Button / Continue"]'), () => App.go(base + 'products')); return; }
    if (['products', 'searching', 'added'].includes(step)) {
      const picked = get().products || [];
      const search = card.querySelector('[data-name="Product search"]');
      if (search) { const t = Modals.field(search, step === 'searching' ? '' : '', v => Modals.suggest(search, v, h => { if (!picked.find(x => x.name === h.name)) picked.push({ name: h.name, category: h.category }); put({ products: picked }); App.toast(h.name + ' added'); App.go(base + 'added'); }), { placeholder: 'Search products — e.g. chilli, turmeric' }); if (step !== 'added') setTimeout(() => t && t.focus(), 60); }
      card.querySelectorAll('[data-name="Button / + Add"]').forEach(b => $.on(b, () => { const row = b.parentElement; const nm = $.texts(row)[0].textContent.trim(); const pr = SEED.PRODUCTS.find(x => x.name === nm) || { name: nm, category: SEED.CAT.SPICE }; if (!picked.find(x => x.name === pr.name)) picked.push({ name: pr.name, category: pr.category }); put({ products: picked }); App.go(base + 'added'); }));
      $.on(card.querySelector('[data-name="Button / + Add product"]'), () => App.go(base + 'searching'));
      card.querySelectorAll('[data-name="Button / Continue to plan"]').forEach(b => $.on(b, () => { if (!picked.length && step !== 'added') return App.toast('Add at least one product'); App.go(base + 'plan'); }));
      card.querySelectorAll('[data-name^="Suggestion chip /"]').forEach(ch => $.on(ch, () => App.go(base + 'searching')));
      if (picked.length && step === 'added') hint(card, 'You added: ' + picked.map(p => p.name).join(', '));
      return;
    }
    if (step === 'plan') { $.on(card.querySelector('[data-name="Button / Submit for review"]'), () => App.go(base + 'review')); return; }
    if (step === 'review') { setTimeout(() => { if (App.path() === base + 'review') App.go(base + 'approved'); }, 3000); hint(card, 'Demo: approval arrives in a few seconds.'); $.on(card.querySelector('[data-name="Button / Go to Seller Hub"]'), () => finish()); return; }
    if (step === 'approved') { $.on(card.querySelector('[data-name^="Button / Pay"]'), () => App.go(base + 'live')); return; }
    if (step === 'live') { $.on(card.querySelector('[data-name="Button / Open Seller Hub"]'), () => finish()); return; }
    if (step === 'rejected') { $.on(card.querySelector('[data-name^="Button / Replace"]'), () => App.go(base + 'docs')); }
    function finish() { const f = get().seller || {}; const prods = (get().products || []); Store.registerSeller({ name: f.name || 'New seller', company: f.company || 'New Seller Co', phone: f.phone, email: f.email, type: f.type }, prods.length ? prods : [{ name: 'Chilli / Red Pepper', category: SEED.CAT.SPICE }]); App.toast('You’re live — welcome to the Seller Hub'); App.go('/hub'); }
  }
  return { login, register };
})();
