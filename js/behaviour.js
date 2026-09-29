/* Behaviour layer on top of the rendered Figma screens.
   - Fields (inputs, textareas, search boxes, selects) become typeable.
   - Chat composers send: the message is added to the thread and kept in this
     browser, so it is still there when you come back to the chat.
   - Quick-reply chips fill the composer.
   Everything typed is stored under one localStorage key; Reset clears it. */
const Behaviour = (function () {
  const KEY = 'ingredienpro.app-v2';
  let store = read();
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || { chats: {}, fields: {} }; } catch (e) { return { chats: {}, fields: {} }; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function reset() { store = { chats: {}, fields: {} }; save(); }

  const FIELD = /^(Input|Textarea|Search|Select|Search bar|Product search|Field input|input)$/i;
  const hasLink = el => !!el.closest('.is-link');

  function texts(el) { return [...el.querySelectorAll('div')].filter(d => !d.children.length || [...d.children].every(c => c.tagName === 'SPAN')).filter(d => d.textContent.trim()); }

  /* Make the main text in a field editable. Fields that are prototype links
     (e.g. "click the product field to pick a suggestion") stay as links. */
  function fields(root, screenId) {
    root.querySelectorAll('[data-name]').forEach(f => {
      if (!FIELD.test(f.dataset.name) || hasLink(f) || f.dataset.override || f.querySelector('[data-bound]') || f.closest('[data-bound]')) return;
      const t = texts(f).filter(d => !/^[⌕🔍▾×|+]$/.test(d.textContent.trim())).sort((a, b) => b.textContent.length - a.textContent.length)[0];
      if (!t || t.closest('.is-link')) return;
      makeEditable(t, screenId + '|' + t.dataset.id);
    });
    // chat composer placeholder
    root.querySelectorAll('div').forEach(d => {
      if (d.children.length || d.dataset.bound || d.closest('[data-bound]') || !/^(Write a message|Type a message)/.test(d.textContent.trim())) return;
      d.dataset.placeholder = d.textContent.trim();
      d.textContent = '';
      d.classList.add('composer-input');
      d.setAttribute('contenteditable', 'plaintext-only');
      d.style.minWidth = '200px'; d.style.flex = '1 1 auto'; d.style.outline = 'none';
    });
  }

  function makeEditable(t, key) {
    t.setAttribute('contenteditable', 'plaintext-only');
    t.classList.add('editable');
    t.spellcheck = false;
    if (store.fields[key] !== undefined) t.textContent = store.fields[key];
    t.addEventListener('input', () => { store.fields[key] = t.textContent; save(); });
    t.addEventListener('click', e => e.stopPropagation());
    // placeholder look: grey text clears on first focus
    const col = getComputedStyle(t).color;
    if (/138, 138, 138|154, 154, 162|118, 118, 118/.test(col) && store.fields[key] === undefined) {
      t.addEventListener('focus', function once() { t.textContent = ''; t.style.color = '#111'; t.removeEventListener('focus', once); });
    }
  }

  /* ---- chat ------------------------------------------------------------ */
  function chat(root, screenId) {
    const composer = root.querySelector('[data-name="Composer"]');
    const input = root.querySelector('.composer-input');
    const messages = root.querySelector('[data-name="Messages"]');
    if (!composer || !input || !messages || composer.dataset.bound || messages.dataset.bound) return;
    // template = the last plain text bubble we sent (not a file or voice note)
    const templ = [...messages.querySelectorAll('[data-name^="Msg / outgoing"]')].filter(m => !/▶|\.pdf|PDF ·/.test(m.textContent) && !m.querySelector('[data-name*="File"],[data-name*="Voice"],[data-name*="file"]')).pop();
    const send = [...composer.querySelectorAll('div')].find(d => d.textContent.trim() === '➤');
    const sendBtn = send ? send.parentElement : null;
    const list = store.chats[screenId] || [];
    list.forEach(m => append(messages, templ, m));
    function submit() {
      const text = input.textContent.trim(); if (!text) return;
      const now = new Date(); const time = now.toTimeString().slice(0, 5);
      const m = { text, time }; list.push(m); store.chats[screenId] = list; save();
      append(messages, templ, m, true);
      input.textContent = '';
    }
    if (sendBtn) { sendBtn.style.cursor = 'pointer'; sendBtn.addEventListener('click', e => { e.stopPropagation(); submit(); }); }
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    // quick-reply chips put their text into the composer
    const chips = root.querySelector('[data-name="Quick replies"], [data-name="Chips"], [data-name="Starters"]');
    if (chips) chips.querySelectorAll(':scope > div').forEach(c => {
      c.style.cursor = 'pointer';
      c.addEventListener('click', e => { e.stopPropagation(); input.textContent = c.textContent.trim(); input.focus(); });
    });
  }

  function append(messages, templ, m, scroll) {
    let el;
    if (templ) {
      el = templ.cloneNode(true);
      const ts = texts(el);
      const body = ts.sort((a, b) => b.textContent.length - a.textContent.length)[0];
      const time = texts(el).find(d => /^\d{1,2}:\d{2}/.test(d.textContent.trim()) && d !== body);
      if (body) body.textContent = m.text;
      if (time) time.textContent = m.time + '  ✓';
      // a sent message may contain attachments in the template — keep only text bubbles
      el.querySelectorAll('[data-name*="File"],[data-name*="Voice"],[data-name*="file"]').forEach(x => x.remove());
    } else {
      el = document.createElement('div'); el.className = 'fallback-msg'; el.textContent = m.text;
    }
    el.classList.add('sent-here');
    messages.appendChild(el);
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* Checkboxes: click to toggle. Links on the same element still win. */
  function checkboxes(root) {
    root.querySelectorAll('[data-name="Checkbox"], [data-name="checkbox"], [data-name^="Checkbox /"]').forEach(cb => {
      if (cb.closest('.is-link') || cb.dataset.override || cb.closest('[data-override]')) return;
      const tick = [...cb.querySelectorAll('div')].find(d => d.textContent.trim() === '✓');
      const onBg = cb.style.background;
      cb.style.cursor = 'pointer';
      cb.addEventListener('click', e => {
        e.stopPropagation();
        const off = cb.dataset.off === '1';
        cb.dataset.off = off ? '0' : '1';
        cb.style.background = off ? onBg : '#fff';
        if (!off) cb.style.border = '1.5px solid #aaaaaa'; else cb.style.border = '';
        if (tick) tick.style.visibility = off ? 'visible' : 'hidden';
      });
    });
  }

  /* Esc closes a pop-up the same way its Cancel / × link does. */
  function escape(root) {
    const cancel = [...root.querySelectorAll('.is-link')].find(el => /^(Button \/ Cancel|Close|Button \/ Keep editing)$/.test(el.dataset.name) || el.textContent.trim() === '×');
    document.onkeydown = e => { if (e.key === 'Escape' && cancel && !e.target.closest('[contenteditable]')) cancel.click(); };
  }

  function apply(root, screenId) { fields(root, screenId); chat(root, screenId); checkboxes(root); }
  return { apply, reset };
})();
