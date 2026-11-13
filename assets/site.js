(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const editing = document.body.classList.contains('editing');
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // ---- accessibility: font size + high contrast (the old site had a low-vision version) ----
  let fs = +store.get('fs') || 0;
  let hc = store.get('hc') === '1';
  let ff = store.get('ff') === '1'; // Times New Roman for the whole site
  const apply = () => {
    root.style.fontSize = `${100 + 12.5 * fs}%`;
    if (hc) root.dataset.contrast = 'high'; else delete root.dataset.contrast;
    $('[data-contrast-toggle]')?.setAttribute('aria-pressed', String(hc));
    if (ff) root.dataset.font = 'tnr'; else delete root.dataset.font;
    $('[data-font-toggle]')?.setAttribute('aria-pressed', String(ff));
  };
  apply();
  $$('[data-fs]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.fs;
    fs = v === '0' ? 0 : Math.max(-1, Math.min(3, fs + (v === '+' ? 1 : -1)));
    store.set('fs', fs); apply();
  }));
  $('[data-font-toggle]')?.addEventListener('click', () => { ff = !ff; store.set('ff', ff ? '1' : '0'); apply(); });
  $('[data-contrast-toggle]')?.addEventListener('click', () => { hc = !hc; store.set('hc', hc ? '1' : '0'); apply(); });

  // ---- home hero: a handle between the text and the photo (drag, click, arrow keys); by default the text and the photo take half each ----
  $$('.hero').forEach((hero) => {
    if (editing || hero.closest('.page-wrap')) return;
    const MIN = 8, MAX = 70, DEF = 50;
    let pct = DEF;
    const grip = document.createElement('div');
    grip.className = 'hero-grip'; grip.tabIndex = 0; grip.setAttribute('role', 'separator'); grip.setAttribute('aria-orientation', 'vertical');
    grip.setAttribute('aria-label', 'Ширина фото: перетягніть, натисніть або скористайтеся стрілками'); grip.setAttribute('aria-valuemin', MIN); grip.setAttribute('aria-valuemax', MAX);
    grip.innerHTML = '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></span>';
    hero.append(grip);
    const set = (v) => {
      pct = Math.min(MAX, Math.max(MIN, v));
      hero.style.setProperty('--hero-split', `${pct}%`);
      hero.classList.toggle('collapsed', pct < 22); // too narrow for the text: it fades out instead of breaking
      grip.setAttribute('aria-valuenow', Math.round(pct));
    };
    set(DEF);
    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // no text selection / native drag: the browser would cancel the pointer as soon as the mouse moves over the text
      grip.focus({ preventScroll: true });
      grip.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, from: pct, moved: false };
      hero.classList.add('dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;
      if (drag.moved) set(drag.from + ((e.clientX - drag.x) / hero.getBoundingClientRect().width) * 100);
    });
    const end = () => {
      if (!drag) return;
      hero.classList.remove('dragging');
      if (!drag.moved) set(Math.abs(pct - DEF) > 1 ? DEF : MIN); // a click: back to the default, or from the default to the wide photo
      drag = null;
    };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: () => set(pct - 5), ArrowRight: () => set(pct + 5), Home: () => set(MIN), End: () => set(MAX), Enter: () => set(Math.abs(pct - DEF) > 1 ? DEF : MIN), ' ': () => set(Math.abs(pct - DEF) > 1 ? DEF : MIN) }[e.key];
      if (k) { e.preventDefault(); k(); }
    });
  });

  // ---- header menus ----
  const hdr = $('.hdr');
  const megaBtn = $('.mega-btn'), mega = $('#mega'), burger = $('.burger');
  // the desktop mega menu is a panel under the header: as tall as the room left in the window, scrolls inside itself, the page behind it is locked and dimmed
  const fitMega = () => {
    if (!mega || mega.hidden) return;
    const floating = getComputedStyle(mega).position === 'absolute'; // on phones it is part of the folding menu instead
    mega.style.maxHeight = floating ? `${Math.max(240, window.innerHeight - mega.getBoundingClientRect().top)}px` : '';
    root.classList.toggle('mega-open', floating);
  };
  const setMega = (open) => {
    if (!megaBtn) return;
    megaBtn.setAttribute('aria-expanded', String(open));
    mega.hidden = !open;
    if (open) { fitMega(); mega.scrollTop = 0; } else { root.classList.remove('mega-open'); mega.style.maxHeight = ''; }
  };
  window.addEventListener('resize', fitMega);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && megaBtn?.getAttribute('aria-expanded') === 'true') { setMega(false); megaBtn.focus(); } });
  megaBtn?.addEventListener('click', () => setMega(megaBtn.getAttribute('aria-expanded') !== 'true'));
  burger?.addEventListener('click', () => {
    const open = hdr.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    root.classList.toggle('menu-open', open); // the page behind the open menu does not scroll
    if (!open) setMega(false);
  });
  // phone menu: a chevron button next to every item that has a sub-menu folds / unfolds it (the link itself still opens its page)
  $$('.nav li.has-sub').forEach((li) => {
    const a = $(':scope > a', li);
    if (!a) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sub-toggle';
    btn.setAttribute('aria-label', `Підпункти: ${a.textContent.trim()}`); btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => { const open = li.classList.toggle('sub-open'); btn.setAttribute('aria-expanded', String(open)); });
    a.after(btn);
    if (li.querySelector('[aria-current]')) { li.classList.add('sub-open'); btn.setAttribute('aria-expanded', 'true'); } // the section you are in is unfolded
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.hdr')) setMega(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMega(false); });

  // ---- contents list: highlight the section being read ----
  const tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const map = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) {
        tocLinks.forEach((a) => a.classList.remove('on'));
        map.get(en.target.id)?.classList.add('on');
      }
    }, { rootMargin: '-100px 0px -70% 0px' });
    map.forEach((_, id) => { const h = document.getElementById(id); if (h) io.observe(h); });
  }

  // ---- search (index is a static JSON built at publish time) ----
  let index = null, ov = null, sel = 0, hits = [];
  // the index is fetched once and normalised once (not on every keystroke)
  const loadIndex = () => (index ||= fetch('/assets/search.json').then((r) => { if (!r.ok) throw 0; return r.json(); })
    .then((docs) => { for (const d of docs) { d._t = norm(d.t); d._b = norm(d.b || d.x); } return docs; })
    .catch(() => { index = null; return []; }));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function norm(s) { return String(s || '').toLowerCase().replace(/[’ʼ`']/g, "'"); }
  const GROUPS = [['page', 'Сторінки', 8], ['news', 'Новини', 6], ['album', 'Фотоальбоми', 4]];
  const snippet = (d, words) => {
    const at = words.map((w) => d._b.indexOf(w)).filter((i) => i >= 0).sort((p, q) => p - q)[0];
    const b = d.b || d.x || '';
    return at === undefined || at < 60 ? b.slice(0, 120) : '…' + b.slice(at - 40, at + 90);
  };
  let timer = 0;
  async function run(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const box = $('.search-res', ov);
    if (!words.length) { box.innerHTML = ''; hits = []; return; }
    const docs = await loadIndex();
    if (!ov || norm($('input', ov).value.trim()).split(/\s+/).join(' ') !== words.join(' ')) return; // a newer query is already shown
    const found = { page: [], news: [], album: [] };
    for (const d of docs) {
      let s = 0, ok = true;
      for (const w of words) {
        const inT = d._t.includes(w);
        if (!inT && !d._b.includes(w)) { ok = false; break; }
        if (inT) s += d._t.startsWith(w) ? 14 : 10;
      }
      if (ok) (found[d.k] || found.page).push({ d, s });
    }
    hits = [];
    let out = '';
    for (const [k, label, max] of GROUPS) {
      const list = found[k].sort((a, b) => b.s - a.s);
      if (!list.length) continue;
      out += `<li class="s-group">${label}<span>${list.length}</span></li>`;
      for (const { d } of list.slice(0, max)) {
        out += `<li><a href="${esc(d.u)}" class="${hits.length ? '' : 'sel'}"><b>${esc(d.t)}</b><small>${esc(d.d || '')}${d.d ? ' · ' : ''}${esc(snippet(d, words))}</small></a></li>`;
        hits.push(d);
      }
      if (list.length > max) out += `<li class="s-more">і ще ${list.length - max} — уточніть запит</li>`;
    }
    sel = 0;
    box.innerHTML = out || '<li class="search-hint">Нічого не знайдено</li>';
  }
  function closeSearch() { ov?.remove(); ov = null; document.body.style.overflow = ''; }
  function openSearch() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'search-ov';
    ov.innerHTML = '<div class="search-box" role="dialog" aria-modal="true" aria-label="Пошук"><input type="search" placeholder="Пошук по сайту…" aria-label="Пошук"><ul class="search-res"></ul></div>';
    document.body.append(ov); document.body.style.overflow = 'hidden';
    const input = $('input', ov);
    input.focus(); loadIndex();
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(input.value.trim()), 90); });
    input.addEventListener('keydown', (e) => {
      const links = $$('.search-res a', ov);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % (links.length || 1);
        links.forEach((a, i) => a.classList.toggle('sel', i === sel));
        links[sel]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && links[sel]) location.href = links[sel].href;
    });
    ov.addEventListener('click', (e) => { if (!e.target.closest('.search-box')) closeSearch(); });
  }
  $('.search-btn')?.addEventListener('click', openSearch);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-search]')) openSearch(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
    else if (!editing && e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { e.preventDefault(); openSearch(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });

  // ---- lightbox for content images ----
  if (editing) return;
  let box, group = [], idx = 0;
  const show = () => {
    const im = group[idx];
    $('img', box).src = im.currentSrc || im.src;
    $('img', box).alt = im.alt;
    $('.lb-count', box).textContent = group.length > 1 ? `${idx + 1} / ${group.length}` : '';
    box.classList.toggle('single', group.length < 2);
  };
  const close = () => { box?.remove(); box = null; document.body.style.overflow = ''; };
  const step = (d) => { idx = (idx + d + group.length) % group.length; show(); };
  function open(im) {
    group = $$('img', im.closest('.b-gallery, .prose'));
    idx = Math.max(0, group.indexOf(im));
    box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button class="lb-close" aria-label="Закрити">×</button><button class="lb-nav lb-prev" aria-label="Попереднє">‹</button><img alt=""><button class="lb-nav lb-next" aria-label="Наступне">›</button><span class="lb-count"></span>';
    box.addEventListener('click', (e) => {
      if (e.target.closest('.lb-prev')) step(-1);
      else if (e.target.closest('.lb-next')) step(1);
      else if (e.target.tagName !== 'IMG') close();
    });
    document.body.append(box); document.body.style.overflow = 'hidden';
    show(); $('.lb-close', box).focus();
  }
  document.addEventListener('click', (e) => {
    const im = e.target.closest('.b-gallery img, .prose img');
    if (im && !im.closest('a')) open(im);
  });
  // ---- video gallery: search + player dialog ----
  const vg = $('.sec-vg');
  if (vg) {
    const cards = $$('.vitem', vg), input = $('.vsearch input', vg), count = $('.vcount', vg), empty = $('.v-empty', vg);
    if (input) {
      $('.vsearch', vg).hidden = false;
      const norm = (s) => s.toLowerCase().replace(/[’'`ʼ]/g, '');
      input.addEventListener('input', () => {
        const q = norm(input.value.trim()).split(/\s+/).filter(Boolean);
        let n = 0;
        for (const c of cards) { const hit = q.every((w) => norm(c.dataset.t).includes(w)); c.hidden = !hit; if (hit) n++; }
        count.textContent = q.length ? `Знайдено ${n} з ${cards.length}` : `${cards.length} відео`;
        empty.hidden = n > 0;
      });
    }
    // thumbnails that fail to load fall back to the plain play tile
    $$('.v-thumb img', vg).forEach((im) => {
      const bad = () => im.remove();
      im.addEventListener('error', bad);
      if (im.complete && !im.naturalWidth) bad();
    });
    let dlg, opener;
    const closeVideo = () => { dlg?.remove(); dlg = null; document.body.style.overflow = ''; opener?.focus(); };
    vg.addEventListener('click', (e) => {
      const a = e.target.closest('a.vcard[data-embed]');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault();
      opener = a;
      const title = $('.v-title', a).textContent;
      dlg = document.createElement('div');
      dlg.className = 'vmodal';
      dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', title);
      dlg.innerHTML = '<div class="vm-box"><button type="button" class="vm-close" aria-label="Закрити">×</button><div class="vm-frame"><iframe allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div class="vm-foot"><b></b><a target="_blank" rel="noopener"></a></div></div>';
      $('iframe', dlg).src = a.dataset.embed;
      $('iframe', dlg).title = title;
      $('b', dlg).textContent = title;
      const ext = $('.vm-foot a', dlg); ext.href = a.href; ext.textContent = a.dataset.kind === 'youtube' ? 'Дивитися на YouTube ↗' : 'Відкрити на Google Диску ↗';
      dlg.addEventListener('click', (ev) => { if (ev.target === dlg || ev.target.closest('.vm-close')) closeVideo(); });
      document.body.append(dlg); document.body.style.overflow = 'hidden';
      $('.vm-close', dlg).focus();
    });
    document.addEventListener('keydown', (e) => { if (dlg && e.key === 'Escape') closeVideo(); });
  }
  // ---- long document lists: a search box above the first document card ----
  if (!editing) {
    const docs = $$('.blocks > a.card[class*="ft-"]:not(.ft-ext):not(.ft-page)');
    // a list with at least 8 documents; links to Drive/web in the same list are searched too
    const cards = docs.length >= 8 ? $$('.blocks > a.card[class*="ft-"]:not(.ft-page)') : [];
    if (cards.length) {
      const wrap = document.createElement('div');
      wrap.className = 'vsearch docsearch';
      wrap.innerHTML = '<input type="search" placeholder="Пошук документа за назвою…" aria-label="Пошук документа"><span class="vcount" aria-live="polite"></span>';
      const input = $('input', wrap), count = $('.vcount', wrap);
      // above the first section heading that leads into the list, so the box covers all sections
      const first = [...cards[0].parentElement.children].find((el) => /^H[23]$/.test(el.tagName) || el === cards[0]);
      first.before(wrap);
      const norm = (s) => s.toLowerCase().replace(/[’'ʼ]/g, '');
      const texts = cards.map((c) => norm(c.textContent));
      const run = () => {
        const q = norm(input.value.trim()).split(/\s+/).filter(Boolean);
        let n = 0;
        cards.forEach((c, i) => { const ok = q.every((w) => texts[i].includes(w)); c.hidden = !ok; if (ok) n++; });
        // a heading stays only while something under it matches (an H2 counts everything up to the next H2)
        const kids = [...cards[0].parentElement.children];
        kids.forEach((el, i) => {
          if (!/^H[23]$/.test(el.tagName)) return;
          let seen = false;
          for (let j = i + 1; j < kids.length && !seen; j++) {
            const k = kids[j];
            if (/^H[23]$/.test(k.tagName) && (k.tagName === el.tagName || el.tagName === 'H3')) break;
            if (k.matches('a.card') && !k.hidden) seen = true;
          }
          el.hidden = !!q.length && !seen;
        });
        count.textContent = q.length ? (n ? `Знайдено: ${n} із ${cards.length}` : 'Нічого не знайдено') : `Документів: ${cards.length}`;
      };
      input.addEventListener('input', run);
      run();
    }
  }
  // ---- tag search: the field filters the chips, Enter opens the first match ----
  $$('.tagbar').forEach((bar) => {
    const input = $('.tag-q', bar), chips = $$('.tagchips li', bar), none = $('.tag-none', bar);
    if (!input) return;
    const run = () => {
      const q = input.value.trim().toLowerCase();
      let n = 0;
      chips.forEach((li) => { const ok = !q || li.textContent.toLowerCase().includes(q); li.hidden = !ok; if (ok) n++; });
      none.hidden = n > 0;
    };
    input.addEventListener('input', run);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = chips.find((li) => !li.hidden);
      if (first) location.href = $('a', first).href;
    });
  });
  document.addEventListener('keydown', (e) => {
    if (!box) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
})();
