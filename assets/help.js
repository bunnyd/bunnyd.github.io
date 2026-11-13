// «Помічник» of the public site: asks the cms (Jev) which menu section, page or document answers a question and links to it.
// Only text is written into the page with textContent, and a link is used only when it is an address of this site or http(s).
(() => {
  const script = document.currentScript;
  const API = (script?.dataset.api || '').replace(/\/+$/, '');
  const KEY = 'help.messages';
  const EXAMPLES = ['Де прочитати правила прийому?', 'Де знайти розклад занять?', 'Які документи потрібні для вступу?', 'Де контакти училища?'];
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v); }
    n.append(...kids.flat(Infinity).filter((x) => x != null && x !== false));
    return n;
  };
  const safe = (href) => (/^\/(?!\/)/.test(href) || /^https?:\/\//i.test(href) ? href : '#');
  const load = () => { try { const m = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(m) ? m : []; } catch { return []; } };
  const save = (m) => { try { sessionStorage.setItem(KEY, JSON.stringify(m.slice(-24))); } catch { /* private window */ } };

  async function call(path, body) {
    const res = await fetch(`${API}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Помічник зараз не відповідає.');
    return data;
  }

  function mount() {
    let messages = load(), busy = false, open = false, showEx = false;
    const list = el('div', { class: 'hc-list', role: 'log', 'aria-live': 'polite' });
    const input = el('input', { type: 'text', maxlength: '300', placeholder: 'Що ви шукаєте на сайті?', 'aria-label': 'Запитання помічнику', autocomplete: 'off' });
    const send = el('button', { type: 'submit', class: 'hc-btn hc-primary' }, 'Запитати');
    const box = el('section', { class: 'hc-box', hidden: true, 'aria-label': 'Помічник' },
      el('header', {}, el('b', {}, 'Помічник'),
        el('button', { type: 'button', class: 'hc-btn', title: 'Приклади запитань', 'aria-label': 'Приклади запитань', onclick: () => { showEx = !showEx; paint(); } }, '💡'),
        el('button', { type: 'button', class: 'hc-btn', title: 'Очистити розмову', onclick: () => { messages = []; showEx = false; save(messages); paint(); } }, 'Очистити'),
        el('button', { type: 'button', class: 'hc-btn', 'aria-label': 'Закрити', onclick: () => toggle(false) }, '✕')),
      list,
      el('form', { class: 'hc-form', onsubmit: (e) => { e.preventDefault(); ask(input.value); } }, input, send),
      el('p', { class: 'hc-hint' }, 'Помічник підказує, де що знайти на сайті. Не вводьте персональні дані.'));
    const fab = el('button', { type: 'button', class: 'hc-fab', 'aria-expanded': 'false', 'aria-label': 'Помічник: допоможе знайти потрібне на сайті', onclick: () => toggle(!open) }, '? Помічник');
    document.body.append(box, fab);

    function toggle(v) { open = v; box.hidden = !v; fab.hidden = v; fab.setAttribute('aria-expanded', String(v)); if (v) { paint(); input.focus(); } else fab.focus(); }
    const link = (href, text, primary) => el('a', { class: `hc-link${primary ? ' hc-primary' : ''}`, href: safe(href) }, text);
    const card = (it, main) => el('div', { class: `hc-card${main ? ' main' : ''}` }, el('b', {}, it.title), it.path && it.path !== it.title ? el('p', {}, it.path) : null, link(it.href, 'Перейти →', main));
    const docCard = (d) => el('div', { class: 'hc-card' }, el('b', {}, d.title), el('p', {}, d.hint), link(d.href, d.href.startsWith('/uploads/') ? 'Відкрити документ →' : 'Відкрити →', true));

    function bubble(m) {
      if (m.role === 'user') return el('div', { class: 'hc-msg me', 'data-q': '' }, m.text);
      if (m.role === 'error') return el('div', { class: 'hc-msg err' }, m.text);
      const a = m.answer, docs = a.docs || [], items = a.items || [];
      if (!docs.length && !items.length) return el('div', { class: 'hc-msg' }, a.kind === 'off_topic' ? 'Я підказую лише, де що знайти на сайті училища. Спробуйте запитати про вступ, документи, новини чи контакти.' : 'Не знайшов, куди вас спрямувати. Спробуйте інакше або скористайтеся пошуком по сайту.');
      const sure = a.kind === 'answer' && items.length > 0;
      // a sure section is the answer; what else was found stays short (2 rows) and the rest is one click away
      const more = (rows, draw, label) => {
        const shown = m.more ? rows : rows.slice(0, 2);
        return [el('p', { class: 'hc-sub' }, label), shown.map(draw), rows.length > 2 && !m.more ? el('button', { type: 'button', class: 'hc-btn', onclick: () => { m.more = true; paint(true); } }, `Показати ще (${rows.length - 2})`) : null];
      };
      if (sure) return el('div', { class: 'hc-msg' }, card(items[0], true), docs.length ? more(docs, miniDoc, 'Також знайшов:') : null, items.length > 1 ? more(items.slice(1), (it) => miniDoc({ title: it.title, href: it.href, hint: it.path }), 'Схожі розділи:') : null);
      return el('div', { class: 'hc-msg' }, docs.length ? [el('p', {}, 'Знайшов:'), (m.more ? docs : docs.slice(0, 3)).map(docCard), !m.more && docs.length > 3 ? el('button', { type: 'button', class: 'hc-btn', onclick: () => { m.more = true; paint(true); } }, `Показати ще (${docs.length - 3})`) : null] : el('p', {}, 'Можливо, ви шукаєте:'), items.length ? more(items, (it) => miniDoc({ title: it.title, href: it.href, hint: it.path }), docs.length ? 'Або розділ:' : '') : null);
    }
    // a compact result: the title is the link, one line of context under it
    const miniDoc = (d) => el('div', { class: 'hc-mini' }, el('a', { class: 'hc-mlink', href: safe(d.href) }, d.title), d.hint && d.hint !== d.title ? el('small', {}, d.hint) : null);
    function chips() {
      const last = messages[messages.length - 1], qs = showEx ? EXAMPLES : last?.role === 'bot' ? last.answer.suggest : null;
      return qs?.length ? [el('div', { class: 'hc-sug' }, el('small', {}, showEx ? 'Приклади запитань:' : 'Можна ще запитати:'), qs.map((t) => el('button', { type: 'button', class: 'hc-btn', onclick: () => ask(t) }, t)))] : [];
    }
    // keep: redraw without moving the list (a click on «Показати ще»)
    function paint(keep) {
      const top = list.scrollTop;
      list.replaceChildren(...(messages.length ? messages.map(bubble) : [el('div', { class: 'hc-msg' }, 'Запитайте, що шукаєте. Наприклад:', el('div', { class: 'hc-sug' }, EXAMPLES.map((t) => el('button', { type: 'button', class: 'hc-btn', onclick: () => ask(t) }, t))))]),
        ...(busy ? [el('div', { class: 'hc-msg' }, 'Шукаю…')] : []), ...(!busy && messages.length ? chips() : []));
      // waiting: down to «Шукаю…»; an answer: its question at the top, so it is read from its start, not its end
      const qs = list.querySelectorAll('[data-q]'), lastQ = qs[qs.length - 1];
      list.scrollTop = keep ? top : busy || !lastQ ? list.scrollHeight : lastQ.offsetTop - list.offsetTop - 8;
      send.disabled = busy;
    }
    async function ask(text) {
      const question = String(text || '').trim();
      if (!question || busy) return;
      input.value = ''; showEx = false; messages.push({ role: 'user', text: question }); busy = true; paint();
      try { messages.push({ role: 'bot', answer: await call('/api/help/ask', { question }) }); } catch (e) { messages.push({ role: 'error', text: e.message }); }
      busy = false; save(messages); paint();
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle(false); });
  }

  // shown only when the cms answers and the helper is on
  call('/api/help/status').then((s) => { if (s.enabled) mount(); }).catch(() => {});
})();
