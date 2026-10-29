'use strict';
/* كتالوج المندوب — PWA يعمل بدون إنترنت
   البيانات: data/products.json  |  الصور: images/thumbs و images/full */
(() => {
  const $ = s => document.querySelector(s);
  const FONT = '"Geeza Pro","SF Arabic","Segoe UI",Tahoma,Arial,sans-serif';
  const ORANGE = '#c25e27';
  const CHUNK = 60;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ممتلئ أو غير متاح */ } }
  };

  const state = {
    items: [], companies: [], colors: {}, list: [],
    q: '', company: '', category: '', view: 'all', sort: store.get('sort') || 'file', inStock: false,
    shown: 0, version: '', updated: '', cur: -1,
    customer: store.get('customer') === '1'
  };

  /* ───────────── أدوات عامة ───────────── */
  const ICONS = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    pdf: '<svg viewBox="0 0 24 24"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 14h6M9 17h4"/></svg>',
    sliders: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 12v8h14v-8"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chevL: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
    building: '<svg viewBox="0 0 24 24"><path d="M5 21V5l9-2v18"/><path d="M14 9h5v12"/><path d="M9 8h1M9 12h1M9 16h1M17 13h.01M17 17h.01"/></svg>',
    chevR: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'
  };
  document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', ICONS[el.dataset.icon] || ''));

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('en-US');
  const fmt = n => (n > 0 ? num(n) + ' IQD' : '—');
  const ltr = s => '‪' + s + '‬';               // يمنع قلب ترتيب الأرقام داخل النص العربي
  const imgPath = (it, kind) => (it.img ? `images/${kind}/${encodeURIComponent(it.img)}.webp` : '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let lastPinch = 0;
  const coColor = n => state.colors[n] || ORANGE;                      // لون الشركة
  const textOn = hex => {                                              // أبيض أو داكن حسب سطوع اللون
    const h = String(hex).replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#1f1d1b' : '#fff';
  };

  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  /* توحيد النص العربي للبحث: يتجاهل التشكيل والهمزات والتاء المربوطة والأرقام الهندية… */
  function norm(s) {
    return String(s ?? '').toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/[ةە]/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[کڪ]/g, 'ك').replace(/[یێ]/g, 'ي').replace(/ڵ/g, 'ل').replace(/ڕ/g, 'ر').replace(/[ۆ]/g, 'و')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/\s+/g, ' ').trim();
  }

  /* ───────────── تحميل البيانات ───────────── */
  async function fetchData() {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch('data/products.json', { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  function applyData(d) {
    state.version = d.version; state.updated = d.updated;
    state.companies = d.companies || [];
    state.colors = d.colors || {};
    state.items = (d.items || []).map(it => ({ ...it, _s: norm([it.name, it.code, it.barcode, it.company, it.category].join(' ')) }));
    if (state.company && !state.companies.includes(state.company)) state.company = '';
    if (state.view === 'companies') buildCompanies(); else apply(false);
    updateDataInfo();
  }

  async function refresh(manual) {
    try {
      const d = await fetchData();
      if (d.version !== state.version) {
        const hadData = !!state.version;
        store.set('catalog-data', JSON.stringify(d));
        applyData(d);
        if (hadData) toast('تم تحديث الأسعار والمواد ✓');
      } else if (manual) toast('الأسعار محدّثة ✓');
    } catch {
      if (manual) toast('تعذّر التحديث — تحقق من الإنترنت');
      else if (!state.items.length) showEmpty('لا توجد بيانات محفوظة بعد.\nافتح التطبيق مرة وأنت متصل بالإنترنت.');
    }
  }

  /* ───────────── البحث والفلترة ───────────── */
  /* التبويب الأول: كل المواد | التبويب الثاني: الشركات */
  function setView(v) {
    state.view = v;
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    const co = v === 'companies';
    $('#coGrid').hidden = !co; $('#grid').hidden = co; $('#meta').hidden = co; $('#sentinel').hidden = co;
    if (co) { $('#cobar').hidden = true; $('#chips').hidden = true; $('#empty').hidden = true; buildCompanies(); }
    else apply();
    window.scrollTo(0, 0);
  }

  function buildCompanies() {
    const n = {}, inS = {};
    state.items.forEach(i => { n[i.company] = (n[i.company] || 0) + 1; if (i.stock > 0) inS[i.company] = (inS[i.company] || 0) + 1; });
    $('#coGrid').innerHTML = state.companies.map(c => {
      const col = coColor(c);
      return `<button class="cotile" type="button" data-co="${esc(c)}" style="--c:${col};--t:${textOn(col)}"><b>${esc(c)}</b>` +
        `<span>${num(n[c] || 0)} مادة</span>${state.customer ? '' : `<small>متوفر: ${num(inS[c] || 0)}</small>`}</button>`;
    }).join('') || '<div class="empty">لا توجد شركات</div>';
  }

  function buildCats() {                     // أقسام الشركة المختارة (إن وُجد عمود القسم)
    const bar = $('#cobar'), chips = $('#chips');
    bar.hidden = !state.company;
    if (state.company) {
      const col = coColor(state.company);
      bar.style.setProperty('--c', col); bar.style.setProperty('--t', textOn(col));
      $('#coName').textContent = state.company;
    }
    const cats = {};
    if (state.company) state.items.forEach(i => { if (i.company === state.company && i.category) cats[i.category] = (cats[i.category] || 0) + 1; });
    const names = Object.keys(cats);
    chips.hidden = names.length < 2;
    if (chips.hidden) { state.category = ''; return; }
    const col = coColor(state.company), tot = names.reduce((a, k) => a + cats[k], 0);
    const chip = (name, label, c) => `<button class="chip${state.category === name ? ' on' : ''}" style="--c:${col};--t:${textOn(col)}" data-cat="${esc(name)}" type="button">${esc(label)}<small>${c}</small></button>`;
    chips.innerHTML = chip('', 'الكل', tot) + names.map(k => chip(k, k, cats[k])).join('');
  }

  function apply(resetScroll = true) {
    const qn = norm(state.q);
    const toks = qn ? qn.split(' ') : [];
    let r = state.items.filter(it =>
      (!state.company || it.company === state.company) &&
      (!state.category || it.category === state.category) &&
      (!state.inStock || it.stock > 0) &&
      toks.every(t => it._s.includes(t)));
    if (state.sort !== 'file') {
      const col = new Intl.Collator('ar'), cx = {}; state.companies.forEach((c, k) => { cx[c] = k; });
      const by = {
        code: (x, y) => x.code.localeCompare(y.code, 'en', { numeric: true }),
        priceAsc: (x, y) => x.price - y.price,
        priceDesc: (x, y) => y.price - x.price,
        company: (x, y) => cx[x.company] - cx[y.company],
        name: (x, y) => col.compare(x.name, y.name)
      }[state.sort];
      if (by) r = r.map((it, k) => [k, it]).sort((x, y) => by(x[1], y[1]) || x[0] - y[0]).map(x => x[1]);
    }
    buildCats();
    if (qn) {                                   // تطابق الكود أولاً
      const rank = it => { const c = norm(it.code); return c === qn ? 0 : c.startsWith(qn) ? 1 : 2; };
      r = r.map((it, i) => [rank(it), i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
    }
    state.list = r;
    $('#count').textContent = `${num(r.length)} مادة`;
    const g = $('#grid'); g.innerHTML = ''; state.shown = 0;
    $('#empty').hidden = r.length > 0 || !state.items.length;
    if (!r.length && state.items.length) showEmpty('لا توجد نتائج مطابقة');
    renderMore();
    if (resetScroll) window.scrollTo(0, 0);
  }

  function showEmpty(msg) { const e = $('#empty'); e.textContent = msg; e.style.whiteSpace = 'pre-line'; e.hidden = false; }

  function cardHtml(it, i) {
    const t = imgPath(it, 'thumbs');
    const im = t ? `<img src="${t}" loading="lazy" decoding="async" alt="">` : `<div class="ph">${esc(it.code)}</div>`;
    let info = '';
    if (it.stock <= 0) info = '<div class="cinfo"><span class="half out">غير متوفر</span></div>';
    else if (!state.customer) info = `<div class="cinfo"><span class="half st${it.stock <= 10 ? ' low' : ''}"><small>الباقي</small><b>${num(it.stock)}</b></span>` +
      (it.pack > 0 ? `<span class="half pk"><small>التعبئة</small><b>${num(it.pack)}</b></span>` : '') + '</div>';
    return `<button class="card" type="button" style="--co:${coColor(it.company)};--t:${textOn(coColor(it.company))}" data-i="${i}"><div class="cimg">${im}</div>` +
      `<div class="cname">${esc(it.name)}</div>${info}<div class="cfoot"><span class="ccode">${esc(it.code)}</span><span class="cprice">${fmt(it.price)}</span></div></button>`;
  }

  function renderMore() {
    if (state.shown >= state.list.length) return;
    const end = Math.min(state.shown + CHUNK, state.list.length);
    let html = '';
    for (let i = state.shown; i < end; i++) html += cardHtml(state.list[i], i);
    $('#grid').insertAdjacentHTML('beforeend', html);
    state.shown = end;
    if (io) { io.unobserve($('#sentinel')); io.observe($('#sentinel')); }
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => { if (es[0].isIntersecting) renderMore(); }, { rootMargin: '900px' }) : null;
  if (io) io.observe($('#sentinel'));

  $('#grid').addEventListener('error', e => {
    const t = e.target;
    if (t.tagName !== 'IMG') return;
    const card = t.closest('.card'); const ph = document.createElement('div');
    ph.className = 'ph'; ph.textContent = (state.list[+(card && card.dataset.i)] || {}).code || '';
    t.replaceWith(ph);
  }, true);
  $('#grid').addEventListener('click', e => {
    if (Date.now() - lastPinch < 450) return;          // لا تفتح بطاقة بالخطأ بعد التقريب بإصبعين
    const c = e.target.closest('.card'); if (c) openDetail(+c.dataset.i);
  });

  /* ───────────── تفاصيل المنتج ───────────── */
  let detailToken = 0;
  function showDetail(i) {
    const it = state.list[i]; if (!it) return;
    state.cur = i; const token = ++detailToken;
    const cust = state.customer;

    const media = $('#dMedia');
    media.innerHTML = it.img ? `<img alt="" src="${imgPath(it, 'thumbs')}">` : `<div class="ph">${esc(it.code)}</div>`;
    if (it.img) {
      const f = new Image();
      f.onload = () => { if (token === detailToken) { const el = media.querySelector('img'); if (el) el.src = f.src; } };
      f.src = imgPath(it, 'full');
    }
    const pc = $('#detail .panel'), col = coColor(it.company);
    pc.style.setProperty('--co', col); pc.style.setProperty('--t', textOn(col));
    $('#dName').textContent = it.name;
    $('#dPrices').innerHTML =
      `<div class="p-main"><small>سعر المفرد</small><b>${fmt(it.price)}</b></div>` +
      (!cust && it.carton > 0 ? `<div class="p-sub"><small>سعر الكارتون</small><b>${fmt(it.carton)}</b></div>` : '');
    const status = it.stock > 0 ? (cust ? 'متوفر' : `متوفر (${num(it.stock)})`) : 'غير متوفر';
    const rows = [
      ['الكود', it.code, true], ['الشركة', `<span class="cdot" style="background:${coColor(it.company)}"></span>${esc(it.company)}`, false, true],
      !cust && it.barcode ? ['الباركود', it.barcode, true] : null,
      !cust && it.pack ? ['عدد التعبئة', num(it.pack), true] : null,
      ['الحالة', status]
    ].filter(Boolean);
    $('#dRows').innerHTML = rows.map(r => `<dt>${r[0]}</dt><dd class="${r[2] ? 'ltr' : ''}">${r[3] ? r[1] : esc(r[1])}</dd>`).join('');
    $('#dPrev').hidden = i <= 0;
    $('#dNext').hidden = i >= state.list.length - 1;
    $('#dPos').textContent = `${i + 1} / ${state.list.length}`;
    $('#detail .panel').scrollTop = 0;
    scheduleShareRender(it);
  }

  function openDetail(i) {
    const was = !$('#detail').hidden;
    showDetail(i);
    $('#detail').hidden = false; document.body.classList.add('lock');
    if (!was) history.pushState({ o: 'detail' }, '');
  }
  function closeDetail(viaPop) {
    $('#detail').hidden = true; document.body.classList.remove('lock');
    if (!viaPop && history.state && history.state.o === 'detail') history.back();
  }
  window.addEventListener('popstate', () => { if (!$('#detail').hidden) closeDetail(true); });
  $('#dPrev').onclick = () => showDetail(state.cur - 1);
  $('#dNext').onclick = () => showDetail(state.cur + 1);
  let tx = null;
  $('#dSwipe').addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  $('#dSwipe').addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (dx < -60 && state.cur < state.list.length - 1) showDetail(state.cur + 1);   // سحب لليسار = التالي (RTL)
    else if (dx > 60 && state.cur > 0) showDetail(state.cur - 1);
  });

  /* ───────────── رسم الصور (للمشاركة والـ PDF) ───────────── */
  function loadImg(urls) {
    return new Promise(res => {
      let k = 0;
      const next = () => {
        if (k >= urls.length) return res(null);
        const im = new Image(); im.onload = () => res(im); im.onerror = next; im.src = urls[k++];
      };
      next();
    });
  }
  let logoP = null;
  const getLogo = () => logoP || (logoP = loadImg(['assets/logo.png']));   // اختياري: ضع شعارك في assets/logo.png

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function drawContain(g, im, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const s = Math.min(w / im.width, h / im.height);
    const dw = im.width * s, dh = im.height * s;
    g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function wrap(g, text, maxW) {
    const words = String(text).split(/\s+/); const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (!cur || g.measureText(t).width <= maxW) cur = t; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* صورة المشاركة: نفس شكل تصاميم Canva (صورة + شرائح برتقالية: الاسم / الكود / السعر) */
  async function renderShareBlob(it) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.direction = 'rtl';
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, W, H);
    const [img, logo] = await Promise.all([loadImg([imgPath(it, 'full'), imgPath(it, 'thumbs')].filter(Boolean)), getLogo()]);

    const barW = 780, barX = (W - barW) / 2, gap = 16, lh = 62;
    g.font = `bold 50px ${FONT}`;
    const nameLines = wrap(g, it.name, barW - 70).slice(0, 3);
    const bars = [
      { h: Math.max(88, nameLines.length * lh + 26), lines: nameLines, font: 50, ltr: false },
      { h: 84, lines: [it.code], font: 46, ltr: true },
      { h: 84, lines: [fmt(it.price)], font: 46, ltr: true }
    ];
    const total = bars.reduce((a, b) => a + b.h, 0) + gap * 2;
    const top = H - 70 - total;

    if (logo) { const lw = 150, lh2 = logo.height * lw / logo.width; g.drawImage(logo, W - 60 - lw, 55, lw, lh2); }
    if (img) drawContain(g, img, 90, 130, W - 180, top - 130 - 40);
    else { g.fillStyle = '#c9c2b8'; g.font = `bold 90px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'ltr'; g.fillText(it.code, W / 2, top / 2); g.direction = 'rtl'; }

    let y = top;
    for (const b of bars) {
      g.fillStyle = ORANGE; rr(g, barX, y, barW, b.h, 44); g.fill();
      g.fillStyle = '#fff'; g.font = `bold ${b.font}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.direction = b.ltr ? 'ltr' : 'rtl';
      const start = y + b.h / 2 - (b.lines.length - 1) * lh / 2;
      b.lines.forEach((t, k) => g.fillText(t, W / 2, start + k * lh));
      y += b.h + gap;
    }
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  }

  let shareCache = { key: '', p: null }, shareTimer;
  const shareKey = it => [it.code, it.company, it.name, it.price].join('|');
  function getShareBlob(it) {
    const key = shareKey(it);
    if (shareCache.key !== key) shareCache = { key, p: renderShareBlob(it) };
    return shareCache.p;
  }
  function scheduleShareRender(it) {          // نجهّز الصورة مسبقاً حتى تكون المشاركة فورية
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => getShareBlob(it), 350);
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  const safeName = s => String(s).replace(/[^A-Za-z0-9_-]+/g, '_');

  $('#dShare').onclick = async () => {
    const it = state.list[state.cur]; if (!it) return;
    const btn = $('#dShare'); btn.disabled = true;
    try {
      const blob = await getShareBlob(it);
      const file = new File([blob], `${safeName(it.code)}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
      downloadBlob(blob, file.name);
      toast('تم حفظ الصورة — أرفقها في واتساب');
    } catch { toast('تعذّر إنشاء الصورة'); }
    finally { btn.disabled = false; }
  };

  $('#dShareText').onclick = async () => {
    const it = state.list[state.cur]; if (!it) return;
    const text = `${it.name}\nالكود: ${it.code}\nالسعر: ${fmt(it.price)}`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* أُلغيت */ } }
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  /* ───────────── تصدير PDF ───────────── */
  const LAYOUTS = { 12: [3, 4], 6: [2, 3], 4: [2, 2], 1: [1, 1] };      // [أعمدة, صفوف]
  let pdfBlob = null, pdfCancel = false, pdfName = 'catalog.pdf';

  function pdfScopeItems() {
    const v = $('#pdfScope').value;
    let base = v === 'current' ? state.list : v === 'all' ? state.items : state.items.filter(i => i.company === v.slice(3));
    if ($('#pdfStock').checked) base = base.filter(i => i.stock > 0);
    return base;
  }
  function pdfScopeTitle() {
    const v = $('#pdfScope').value;
    return v === 'all' ? 'كل المنتجات' : v === 'current' ? (state.company || 'المنتجات المعروضة') : v.slice(3);
  }
  // كل صفحة تخص شركة واحدة (ليكون شريط الصفحة بلون واسم الشركة الصحيح)
  function pdfPages(items, per) {
    const order = [], map = new Map();
    items.forEach(it => { const c = it.company || ''; if (!map.has(c)) { map.set(c, []); order.push(c); } map.get(c).push(it); });
    const pages = [];
    order.forEach(c => { const a = map.get(c); for (let i = 0; i < a.length; i += per) pages.push({ company: c, items: a.slice(i, i + per) }); });
    return pages;
  }
  const PDF_FIELD_IDS = { price: 'pdfFPrice', pack: 'pdfFPack', stock: 'pdfFStock', barcode: 'pdfFBarcode', carton: 'pdfFCarton' };
  function pdfFields() {
    const f = {}; Object.keys(PDF_FIELD_IDS).forEach(k => { f[k] = $('#' + PDF_FIELD_IDS[k]).checked; });
    if (state.customer) { f.pack = f.stock = f.barcode = f.carton = false; }
    return f;
  }
  function updatePdfInfo() {
    const items = pdfScopeItems(), per = +$('#pdfLayout').value;
    const pages = pdfPages(items, per).length;
    $('#pdfInfo').textContent = `${num(items.length)} مادة — ${num(pages)} صفحة`;
    $('#pdfStart').disabled = !items.length;
  }
  function openPdfSheet() {
    const sel = $('#pdfScope');
    sel.innerHTML = `<option value="current">المعروض حالياً (${num(state.list.length)})</option><option value="all">كل المواد (${num(state.items.length)})</option>` +
      state.companies.map(c => `<option value="co:${esc(c)}">شركة: ${esc(c)}</option>`).join('');
    $('#pdfStock').checked = state.inStock;
    let saved = {}; try { saved = JSON.parse(store.get('pdfFields') || '{}'); } catch { /* تجاهل */ }
    Object.keys(PDF_FIELD_IDS).forEach(k => { $('#' + PDF_FIELD_IDS[k]).checked = k in saved ? !!saved[k] : k !== 'carton'; });
    $('#pdfFieldsBox').hidden = state.customer;
    $('#pdfDone').hidden = true; $('#pdfProg').hidden = true; $('#pdfText').textContent = '';
    updatePdfInfo(); openSheet('pdfSheet');
  }
  ['pdfScope', 'pdfLayout', 'pdfStock'].forEach(id => $('#' + id).addEventListener('change', updatePdfInfo));
  Object.values(PDF_FIELD_IDS).forEach(id => $('#' + id).addEventListener('change', () => {
    const f = {}; Object.keys(PDF_FIELD_IDS).forEach(k => { f[k] = $('#' + PDF_FIELD_IDS[k]).checked; }); store.set('pdfFields', JSON.stringify(f));
  }));

  /* باركود EAN-13 / EAN-8 قابل للمسح */
  const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  const EAN_R = EAN_L.map(s => s.replace(/[01]/g, c => (c === '0' ? '1' : '0')));
  const EAN_P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  function eanBits(code) {
    let c = String(code || '').replace(/\D/g, '');
    if (c.length === 12) c = '0' + c;
    if (c.length === 13) {
      const d = c.split('').map(Number), par = EAN_P[d[0]];
      let b = '101';
      for (let i = 0; i < 6; i++) b += (par[i] === 'L' ? EAN_L : EAN_G)[d[i + 1]];
      b += '01010';
      for (let i = 7; i < 13; i++) b += EAN_R[d[i]];
      return b + '101';
    }
    if (c.length === 8) {
      const d = c.split('').map(Number); let b = '101';
      for (let i = 0; i < 4; i++) b += EAN_L[d[i]];
      b += '01010';
      for (let i = 4; i < 8; i++) b += EAN_R[d[i]];
      return b + '101';
    }
    return '';
  }

  // ارتفاعات عناصر البطاقة بوحدات تصميم (تتكبّر بنسبة عرض البطاقة)
  const U = { name: 56, code: 30, price: 48, sub: 48, carton: 30, bar: 72, gap: 6, pad: 10 };
  function cellRows(f) {
    const r = ['name', 'code'];
    if (f.price) r.push('price');
    if (f.pack || f.stock) r.push('sub');
    if (f.carton) r.push('carton');
    if (f.barcode) r.push('bar');
    return r;
  }
  function cellScale(w, h, f) {
    const rows = cellRows(f);
    const h0 = rows.reduce((s, k) => s + U[k], 0) + U.gap * rows.length + 2 * U.pad;
    return Math.min(w / 430, 0.60 * h / h0, 1.6);
  }
  function box(g, x, y, w, h, r, fill, stroke, lw) {
    rr(g, x, y, w, h, r);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function drawCell(g, it, im, x, y, w, h, f, accent) {
    const k = cellScale(w, h, f), u = n => n * k;
    const pad = u(U.pad), gap = u(U.gap), bw = w - 2 * pad, bx = x + pad, ink = '#1f1d1b';
    box(g, x, y, w, h, u(16), '#fff', '#d3ccc0', 2);
    const rows = cellRows(f);
    // من الأسفل إلى الأعلى
    let yb = y + h - pad;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const place = key => { const hh = u(U[key]); yb -= hh; const yy = yb; yb -= gap; return yy; };
    const rev = rows.slice().reverse();
    const pos = {}; rev.forEach(key => { pos[key] = place(key); });

    if (pos.bar !== undefined) {
      const yy = pos.bar, hh = u(U.bar);
      box(g, bx, yy, bw, hh, u(9), '#fff', '#cfc8bd', 2);
      const bits = eanBits(it.barcode);
      if (bits) {
        const mw = Math.max(1, Math.floor(bw / 117 * 4) / 4), tw = mw * 95;   // مساحة فارغة 11 وحدة على الجانبين كما يطلب المعيار
        const bh = hh - u(27), x0 = bx + (bw - tw) / 2, y0 = yy + u(6);
        g.fillStyle = '#000';
        for (let i = 0; i < bits.length; i++) if (bits[i] === '1') {
          let j = i; while (j < bits.length && bits[j] === '1') j++;
          g.fillRect(x0 + i * mw, y0, (j - i) * mw, bh); i = j - 1;
        }
        g.fillStyle = ink; g.font = `600 ${u(17)}px ${FONT}`; g.direction = 'ltr';
        g.fillText(String(it.barcode).replace(/\D/g, ''), bx + bw / 2, yy + hh - u(10));
      } else {
        g.fillStyle = it.barcode ? ink : '#b3aca2'; g.font = `600 ${u(19)}px ${FONT}`; g.direction = 'ltr';
        g.fillText(it.barcode ? String(it.barcode) : 'بدون باركود', bx + bw / 2, yy + hh / 2 + 1);
      }
      g.direction = 'rtl';
    }
    if (pos.carton !== undefined) {
      const yy = pos.carton, hh = u(U.carton);
      box(g, bx, yy, bw, hh, u(9), '#faf8f5', '#cfc8bd', 2);
      g.fillStyle = ink; g.font = `600 ${u(18)}px ${FONT}`; g.direction = 'rtl';
      g.fillText(`سعر الكارتون: ${ltr(fmt(it.carton))}`, bx + bw / 2, yy + hh / 2 + 1);
    }
    if (pos.sub !== undefined) {
      const yy = pos.sub, hh = u(U.sub);
      const parts = [];
      if (f.pack) parts.push({ lbl: 'التعبئة', val: it.pack > 0 ? num(it.pack) : '—', bad: false });
      if (f.stock) parts.push({ lbl: 'الباقي', val: it.stock > 0 ? num(it.stock) : 'غير متوفر', bad: it.stock <= 0, low: it.stock > 0 && it.stock <= 10 });
      const sg = u(8), sw = (bw - sg * (parts.length - 1)) / parts.length;
      parts.forEach((p, n) => {
        const sx = bx + bw - sw - n * (sw + sg);                  // الأول يمين
        box(g, sx, yy, sw, hh, u(9), p.bad ? '#b3261e' : '#f3f1ed', p.bad ? '#b3261e' : '#cfc8bd', 2);
        g.direction = 'rtl';
        if (p.bad) { g.fillStyle = '#fff'; g.font = `bold ${u(23)}px ${FONT}`; g.fillText(`${p.lbl}: ${p.val}`, sx + sw / 2, yy + hh / 2 + 1); }
        else {
          g.fillStyle = '#7a736a'; g.font = `600 ${u(15.5)}px ${FONT}`; g.fillText(p.lbl, sx + sw / 2, yy + hh * 0.27);
          g.fillStyle = p.low ? '#b45309' : ink; g.font = `bold ${u(25)}px ${FONT}`; g.direction = 'ltr'; g.fillText(p.val, sx + sw / 2, yy + hh * 0.69); g.direction = 'rtl';
        }
      });
    }
    if (pos.price !== undefined) {
      const yy = pos.price, hh = u(U.price);
      box(g, bx, yy, bw, hh, u(11), '#fff', accent, Math.max(2.5, u(3.5)));
      g.fillStyle = ink; g.font = `bold ${u(35)}px ${FONT}`; g.direction = 'ltr';
      g.fillText(fmt(it.price), bx + bw / 2, yy + hh / 2 + 1); g.direction = 'rtl';
    }
    {
      const yy = pos.code, hh = u(U.code);
      box(g, bx, yy, bw, hh, u(9), '#efece7', '#cfc8bd', 2);
      g.fillStyle = ink; g.font = `bold ${u(23)}px ${FONT}`; g.direction = 'ltr';
      g.fillText(String(it.code), bx + bw / 2, yy + hh / 2 + 1); g.direction = 'rtl';
    }
    {
      const yy = pos.name, hh = u(U.name);
      box(g, bx, yy, bw, hh, u(9), '#fff', '#cfc8bd', 2);
      g.fillStyle = ink; g.font = `bold ${u(23)}px ${FONT}`; g.direction = 'rtl';
      const lines = wrap(g, it.name, bw - u(16)).slice(0, 2);
      if (lines.length === 1) g.fillText(lines[0], bx + bw / 2, yy + hh / 2 + 1);
      else lines.forEach((t, n) => g.fillText(t, bx + bw / 2, yy + hh / 2 + (n - 0.5) * u(25) + 1));
    }
    // الصورة في الأعلى
    const iy = y + pad, ih = yb + gap - iy - gap;       // ما تبقّى فوق العناصر
    box(g, bx, iy, bw, ih, u(12), '#f5f3f0', null, 0);
    if (im) drawContain(g, im, bx + u(6), iy + u(6), bw - u(12), ih - u(12));
    else { g.fillStyle = '#c9c2b8'; g.font = `bold ${u(34)}px ${FONT}`; g.direction = 'ltr'; g.fillText(String(it.code), bx + bw / 2, iy + ih / 2); g.direction = 'rtl'; }
  }

  async function buildPdf(items, opt, onProgress) {
    const W = 1050, H = 1485, [cols, rows] = LAYOUTS[opt.layout], per = cols * rows;
    const pgs = pdfPages(items, per), pages = pgs.length;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.direction = 'rtl';
    const today = new Date().toISOString().slice(0, 10);
    const parts = []; let pos = 0; const offs = {};
    const push = d => { parts.push(d); pos += typeof d === 'string' ? d.length : d.size; };
    const obj = n => { offs[n] = pos; push(`${n} 0 obj\n`); };
    const PW = 595.28, PH = 841.89;
    push('%PDF-1.4\n');

    for (let p = 0; p < pages; p++) {
      if (pdfCancel) return null;
      const slice = pgs[p].items, co = pgs[p].company;
      const color = co ? coColor(co) : ORANGE, fg = textOn(color);
      const imgs = await Promise.all(slice.map(it => loadImg(
        (per >= 6 ? [imgPath(it, 'thumbs')] : [imgPath(it, 'full'), imgPath(it, 'thumbs')]).filter(Boolean))));

      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      // شريط الصفحة بلون الشركة: اسم الشركة يميناً · BİRİNCİLER يساراً
      g.fillStyle = color; g.fillRect(0, 0, W, 104);
      g.fillStyle = fg; g.textBaseline = 'middle';
      g.textAlign = 'right'; g.direction = 'rtl'; g.font = `bold 46px ${FONT}`; g.fillText(co || opt.title, W - 40, 54);
      g.textAlign = 'left'; g.direction = 'ltr'; g.font = `bold 36px ${FONT}`; g.fillText('BİRİNCİLER', 40, 54);
      g.direction = 'rtl';

      const mx = 40, gap = 22, top = 128, bottom = H - 70;
      const cw = (W - 2 * mx - gap * (cols - 1)) / cols, ch = (bottom - top - gap * (rows - 1)) / rows;
      slice.forEach((it, n) => {
        const col = n % cols, row = Math.floor(n / cols);
        drawCell(g, it, imgs[n], W - mx - cw - col * (cw + gap), top + row * (ch + gap), cw, ch, opt.fields, color);
      });
      g.fillStyle = '#9a938a'; g.font = `22px ${FONT}`; g.textAlign = 'center'; g.direction = 'ltr';
      g.fillText(`${p + 1} / ${pages}`, W / 2, H - 34);
      g.textAlign = 'left'; g.fillText(today, 40, H - 34); g.textAlign = 'center'; g.direction = 'rtl';

      const jb = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
      const im = 3 + 3 * p, ct = im + 1, pg = im + 2;
      obj(im);
      push(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jb.size} >>\nstream\n`);
      push(jb); push('\nendstream\nendobj\n');
      const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
      obj(ct); push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
      obj(pg); push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
      onProgress(p + 1, pages);
      await sleep(0);
    }
    const kids = Array.from({ length: pages }, (_, p) => `${5 + 3 * p} 0 R`).join(' ');
    obj(2); push(`<< /Type /Pages /Count ${pages} /Kids [${kids}] >>\nendobj\n`);
    obj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    const total = 3 + 3 * pages, xref = pos;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
    x += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    push(x);
    return new Blob(parts, { type: 'application/pdf' });
  }

  $('#pdfStart').onclick = async () => {
    const items = pdfScopeItems(); if (!items.length) return;
    pdfCancel = false; pdfBlob = null;
    $('#pdfStart').hidden = true; $('#pdfCancel').hidden = false; $('#pdfDone').hidden = true;
    const prog = $('#pdfProg'); prog.hidden = false; prog.value = 0;
    try {
      const blob = await buildPdf(items, {
        layout: $('#pdfLayout').value, fields: pdfFields(), title: pdfScopeTitle()
      }, (d, t) => { prog.max = t; prog.value = d; $('#pdfText').textContent = `جارٍ الإنشاء… صفحة ${d} من ${t}`; });
      if (!blob) { $('#pdfText').textContent = 'تم الإيقاف'; }
      else {
        pdfBlob = blob; pdfName = `catalog-${new Date().toISOString().slice(0, 10)}.pdf`;
        $('#pdfText').textContent = `الملف جاهز (${(blob.size / 1048576).toFixed(1)} MB)`;
        $('#pdfDone').hidden = false;
      }
    } catch (e) { $('#pdfText').textContent = 'حدث خطأ أثناء الإنشاء — جرّب عدداً أقل من المواد'; }
    $('#pdfStart').hidden = false; $('#pdfCancel').hidden = true;
  };
  $('#pdfCancel').onclick = () => { pdfCancel = true; };
  $('#pdfShare').onclick = async () => {
    if (!pdfBlob) return;
    const file = new File([pdfBlob], pdfName, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    downloadBlob(pdfBlob, pdfName);
  };
  $('#pdfSave').onclick = () => { if (pdfBlob) downloadBlob(pdfBlob, pdfName); };

  /* ───────────── الإعدادات والعمل بدون إنترنت ───────────── */
  function updateDataInfo() {
    const d = state.updated ? new Date(state.updated).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    $('#dataInfo').textContent = `${num(state.items.length)} مادة في ${state.companies.length} شركة — آخر تحديث للأسعار: ${d}`;
  }
  async function updateStorageInfo() {
    try {
      const e = await navigator.storage.estimate();
      $('#storageInfo').textContent = `المساحة المستخدمة على الجهاز: ${(e.usage / 1048576).toFixed(0)} MB`;
    } catch { $('#storageInfo').textContent = ''; }
  }

  let dlBusy = false;
  async function downloadImages(kind) {
    if (dlBusy) return;
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) { toast('أغلق التطبيق وافتحه مرة ثانية ثم أعد المحاولة'); return; }
    const urls = state.items.filter(i => i.img).map(i => imgPath(i, kind));
    if (!urls.length) { toast('لا توجد صور'); return; }
    dlBusy = true; ['btnDlThumbs', 'btnDlFull'].forEach(id => { $('#' + id).disabled = true; });
    const prog = $('#dlProg'); prog.hidden = false; prog.max = urls.length; prog.value = 0;
    let done = 0, fail = 0; const q = urls.slice();
    const worker = async () => {
      while (q.length) {
        const u = q.pop();
        try {
          if (!(await caches.match(u))) { const r = await fetch(u); if (!r.ok) throw 0; await r.arrayBuffer(); }
        } catch { fail++; }
        prog.value = ++done;
        $('#dlText').textContent = `تم ${num(done)} من ${num(urls.length)}` + (fail ? ` (فشل ${fail})` : '');
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    $('#dlText').textContent = fail ? `اكتمل مع ${fail} صورة فشلت — أعد المحاولة` : `اكتمل: ${num(urls.length)} صورة محفوظة للعمل بدون إنترنت ✓`;
    dlBusy = false; ['btnDlThumbs', 'btnDlFull'].forEach(id => { $('#' + id).disabled = false; });
    updateStorageInfo();
  }

  function openSheet(id) { $('#' + id).hidden = false; document.body.classList.add('lock'); }
  function closeSheets() {
    ['pdfSheet', 'settings'].forEach(id => { $('#' + id).hidden = true; });
    if ($('#detail').hidden) document.body.classList.remove('lock');
  }

  /* ───────────── ربط الواجهة ───────────── */
  let searchTimer;
  $('#q').addEventListener('input', e => {
    state.q = e.target.value; $('#clear').hidden = !state.q;
    if (state.q && state.view === 'companies') { state.company = ''; state.category = ''; setView('all'); return; }
    clearTimeout(searchTimer); searchTimer = setTimeout(() => apply(), 120);
  });
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('#clear').onclick = () => { $('#q').value = ''; state.q = ''; $('#clear').hidden = true; apply(); $('#q').focus(); };
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.category = b.dataset.cat; apply();
  });
  $('#coGrid').addEventListener('click', e => {
    const b = e.target.closest('.cotile'); if (!b) return;
    state.company = b.dataset.co; state.category = '';
    $('#coGrid').hidden = true; setView('all');
  });
  $('#coBack').onclick = () => { state.company = ''; state.category = ''; setView('companies'); };
  $('#tabbar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.view === 'all') { state.company = ''; state.category = ''; }
    setView(b.dataset.view);
  });
  $('#sort').value = state.sort;
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; store.set('sort', state.sort); apply(); });
  $('#inStock').addEventListener('change', e => { state.inStock = e.target.checked; apply(); });
  $('#btnPdf').onclick = openPdfSheet;
  $('#btnSettings').onclick = () => { $('#optCustomer').checked = state.customer; updateDataInfo(); updateStorageInfo(); openSheet('settings'); };
  $('#optCustomer').addEventListener('change', e => { state.customer = e.target.checked; store.set('customer', state.customer ? '1' : '0'); toast(state.customer ? 'وضع الزبون مفعّل' : 'وضع الزبون متوقف'); });
  $('#btnRefresh').onclick = () => refresh(true);
  $('#btnDlThumbs').onclick = () => downloadImages('thumbs');
  $('#btnDlFull').onclick = () => downloadImages('full');
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) {
      if (e.target.closest('#detail')) closeDetail(false); else closeSheets();
    } else if (e.target.classList.contains('overlay')) {
      if (e.target.id === 'detail') closeDetail(false); else closeSheets();
    }
  });
  document.addEventListener('keydown', e => {
    if ($('#detail').hidden) return;
    if (e.key === 'Escape') closeDetail(false);
    else if (e.key === 'ArrowLeft' && state.cur < state.list.length - 1) showDetail(state.cur + 1);
    else if (e.key === 'ArrowRight' && state.cur > 0) showDetail(state.cur - 1);
  });

  /* ───────────── التشغيل ───────────── */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });

  let had = false;
  const cached = store.get('catalog-data');
  if (cached) { try { applyData(JSON.parse(cached)); had = true; } catch { /* نسخة تالفة */ } }
  if (!had) showEmpty('جارٍ تحميل البيانات…');
  refresh(false).then(() => { if (!state.items.length) return; $('#empty').hidden = state.list.length > 0; });

  /* ───────────── التقريب بإصبعين (مثل معرض الصور): تغيير عدد الأعمدة ───────────── */
  const LEVELS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  const grid = $('#grid');
  const autoCols = () => Math.max(2, Math.min(4, Math.floor(window.innerWidth / 190)));
  let cols = +store.get('cols') || 0;                  // 0 = تلقائي حسب حجم الشاشة
  function setCols(n, silent) {
    n = LEVELS.includes(n) ? n : LEVELS.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a);
    grid.style.setProperty('--cols', n);
    grid.classList.toggle('d1', n >= 3 && n <= 4);     // بطاقة مبسّطة: بلا الباقي والتعبئة
    grid.classList.toggle('d2', n >= 5 && n <= 6);     // صورة + كود فقط
    grid.classList.toggle('d3', n >= 7);               // صور مصغّرة فقط
    grid.dataset.cols = n;
    if (!silent) toast(`${n} في الصف`, 900);
    return n;
  }
  const curCols = () => +grid.dataset.cols || autoCols();
  function stepCols(dir, cx, cy) {                     // dir = -1: تكبير (أعمدة أقل) | +1: تصغير (أعمدة أكثر)
    const cur = curCols();
    let i = LEVELS.indexOf(cur); if (i < 0) i = LEVELS.findIndex(v => v >= cur);
    const nx = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i + dir))];
    if (nx === cur) return false;
    const el = cx != null ? (document.elementFromPoint(cx, cy) || document.body).closest('.card') : null;
    const top0 = el ? el.getBoundingClientRect().top : 0;
    cols = nx; store.set('cols', String(nx)); setCols(nx);
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - top0);   // يبقى المنتج تحت أصابعك في مكانه
    return true;
  }
  setCols(cols || autoCols(), true);
  window.addEventListener('resize', () => { if (!cols) setCols(autoCols(), true); });

  let pinch = null;
  const dist = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const canPinch = () => state.view === 'all' && !document.body.classList.contains('lock');
  document.addEventListener('touchstart', e => { pinch = e.touches.length === 2 && canPinch() ? { d: dist(e) } : null; }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault(); lastPinch = Date.now();
    const d = dist(e), r = d / pinch.d;
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    if (r > 1.28) { stepCols(-1, cx, cy); pinch.d = d; }          // تباعد الأصابع = تكبير
    else if (r < 0.78) { stepCols(+1, cx, cy); pinch.d = d; }     // تقارب الأصابع = تصغير
  }, { passive: false });
  document.addEventListener('touchend', e => { if (pinch) lastPinch = Date.now(); if (e.touches.length < 2) pinch = null; }, { passive: true });
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault()));   // يمنع تكبير صفحة Safari
  $('#zIn').onclick = () => stepCols(-1);
  $('#zOut').onclick = () => stepCols(+1);

  window.__catalog = { state, apply, norm, stepCols, curCols };     // للفحص والاختبار فقط
})();
