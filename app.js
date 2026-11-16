'use strict';
/* كتالوج المندوب — PWA يعمل بدون إنترنت
   البيانات: data/products.json  |  الصور: images/thumbs و images/full */
(() => {
  const $ = s => document.querySelector(s);
  const FONT = '"Geeza Pro","SF Arabic","Segoe UI",Tahoma,Arial,sans-serif';
  const ORANGE = '#c25e27';
  const CHUNK = 60;

  /* ═══════════ إعدادات يمكنك تغييرها من هنا ═══════════ */
  const OWNER_CODE = '9999';           // رمز المالك لإظهار إجمالي الديون (غيّره). الإجمالي مخفي عن المندوبين دائماً ويُخفى من جديد عند كل دخول
  const SETTINGS_CODE = '1234';        // رمز دخول الإعدادات (يُطلب في كل مرة). غيّره كما تشاء، أو اتركه فارغاً '' لإلغاء الرمز
  const COMPANY_NAME = 'BİRİNCİLER';   // اسم الشركة على غلاف ملف PDF وشريط صفحاته (بدون اسم المندوب)
  const DEBT_LATE_DAYS = 30;           // الزبون الذي مضى على آخر قبض منه أكثر من هذا العدد من الأيام يظهر «متأخراً» في قائمة الديون
  /* ═══════════════════════════════════════════════════ */

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ممتلئ أو غير متاح */ } }
  };

  const state = {
    items: [], all: [], companies: [], colors: {}, list: [],
    q: '', company: '', category: '', view: 'all', sort: store.get('sort') || 'file', inStock: true,
    shown: 0, version: '', updated: '', cur: -1,
    customer: store.get('customer') === '1',
    smart: store.get('smart') !== '0',
    favOnly: false, pMin: null, pMax: null,
    listMode: store.get('viewmode') === 'list'
  };

  /* ميزات إضافية: كل ميزة لها مفتاح تشغيل في الإعدادات */
  const FEAT_DEFS = [
    ['fav', 'المختارات ★', 'نجمة على كل مادة وتبويب «المختارات» لقائمتك الخاصة (تُصدَّر PDF أو تُعرض شرائح)'],
    ['split', 'عرض بنافذتين (آيباد / لابتوب)', 'القائمة بجانب تفاصيل المادة على الشاشات العريضة'],
    ['list', 'عرض القائمة المضغوطة', 'زر للتبديل بين البطاقات وصفوف مضغوطة'],
    ['slide', 'عرض الشرائح (Slideshow)', 'عرض المواد بالتتابع بملء الشاشة'],
    ['price', 'فلتر نطاق السعر', 'زر «السعر» لعرض المواد ضمن نطاق سعر محدد'],
    ['cover', 'غلاف وفهرس لملف PDF', 'يضيف غلافاً باسم الشركة وفهرساً بالشركات أو الأقسام'],
    ['link', 'رابط مباشر للمادة', 'زر «رابط» داخل تفاصيل المادة لمشاركتها'],
    ['table', 'قائمة أسعار جدولية (PDF)', 'خيار جدول أسعار بدون صور في تصدير PDF']
  ];
  const feat = {}; FEAT_DEFS.forEach(d => { feat[d[0]] = true; });
  try { Object.assign(feat, JSON.parse(store.get('feat') || '{}')); } catch { /* تجاهل */ }
  const F = k => !!feat[k];
  let favs = new Set();
  try { favs = new Set(JSON.parse(store.get('favs') || '[]')); } catch { /* تجاهل */ }
  const sl = { list: [], i: 0, playing: true, open: false, tok: 0, wl: null };      // عرض الشرائح
  let pendingLink = null, booted = false, favDirty = false;
  try { pendingLink = new URLSearchParams(location.search).get('p'); } catch { /* تجاهل */ }
  document.body.classList.toggle('feat-fav', F('fav'));

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
    chevR: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9z"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    play: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    stock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>',
    scan: '<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>'
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

  /* ───────────── البحث الذكي ─────────────
     ترتيب النتائج: كود مطابق ← كود يبدأ بالكلمة ← تطابق عادي ← تطابق مرن ← تطابق تقريبي (أخطاء إملائية).
     المرن: يتجاهل «ال» التعريف والحروف المكررة (مثل: الترمّس / ترمــس / ترمسس).
     التقريبي: يتحمل حرفاً خاطئاً أو ناقصاً أو مبدلاً في الكلمات الأطول من 3 أحرف (حرفان للأطول من 6). */
  const stripAl = w => (w.length > 3 && w.startsWith('ال')) ? w.slice(2) : w;
  const fold = w => w.replace(/([^\d\s])\1+/g, '$1');
  const foldWord = w => fold(stripAl(w));
  function near(a, b, k) {                         // مسافة التحرير (مع تبديل حرفين متجاورين) ≤ k
    const n = a.length, m = b.length;
    if (Math.abs(n - m) > k) return false;
    let p2 = null, p1 = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= m; j++) {
        let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v; if (v < best) best = v;
      }
      if (best > k) return false;
      p2 = p1; p1 = cur;
    }
    return p1[m] <= k;
  }
  function searchFields(it) {
    const words = norm([it.name, it.company, it.category].join(' ')).split(' ').filter(w => w && !/\d/.test(w));
    return {
      _c: norm(it.code),
      _f: norm([it.name, it.code, it.barcode, it.company, it.category].join(' ')).split(' ').map(foldWord).join(' '),
      _fw: words.map(foldWord)
    };
  }
  const looseHas = (it, t) => { const f = foldWord(t); return !!f && it._f.includes(f); };
  function fuzzyHas(it, t) {
    if (looseHas(it, t)) return true;
    const f = foldWord(t), L = f.length;
    if (L < 4 || /\d/.test(f)) return false;
    const k = L >= 7 ? 2 : 1;
    return it._fw.some(w => near(f, w, k) || (w.length > L && near(f, w.slice(0, L), k)));
  }
  function smartRank(it, qn, toks) {               // 9 = لا يطابق
    if (toks.every(t => it._s.includes(t))) return it._c === qn ? 0 : it._c.startsWith(qn) ? 1 : 2;
    if (!state.smart) return 9;                     // البحث الذكي متوقف: تطابق حرفي فقط
    if (toks.every(t => looseHas(it, t))) return 3;
    return toks.every(t => fuzzyHas(it, t)) ? 4 : 9;
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

  /* ───────────── المواد المزالة (على هذا الجهاز فقط) ─────────────
     تُحفظ بالكود مع المخزون وقت الإزالة. تحديث الأسعار وحده لا يُرجعها.
     تعود تلقائياً إذا زاد مخزونها، أو إذا تغيّر مخزون نصف المواد أو أكثر (تحديث مخزون كامل). */
  let removed = {};
  try { removed = JSON.parse(store.get('removed') || '{}') || {}; } catch { removed = {}; }
  const saveRemoved = () => store.set('removed', JSON.stringify(removed));
  const filterRemoved = () => { state.items = state.all.filter(it => !removed[it.code]); };
  function reconcileRemoved(prev) {
    const codes = Object.keys(removed); if (!codes.length) return 0;
    const cur = new Map(state.all.map(i => [i.code, i]));
    let tot = 0, ch = 0;
    if (prev.size) cur.forEach((it, c) => { if (prev.has(c)) { tot++; if (prev.get(c) !== it.stock) ch++; } });
    const bulk = tot >= 10 && ch / tot >= 0.5;
    let back = 0;
    codes.forEach(c => { const it = cur.get(c); if (it && (bulk || it.stock > (removed[c].s || 0))) { delete removed[c]; back++; } });
    if (back) saveRemoved();
    return back;
  }

  function applyData(d) {
    state.version = d.version; state.updated = d.updated;
    state.companies = d.companies || [];
    state.colors = d.colors || {};
    const prev = new Map(state.all.map(i => [i.code, i.stock]));
    state.all = (d.items || []).map(it => ({ ...it, _s: norm([it.name, it.code, it.barcode, it.company, it.category].join(' ')), ...searchFields(it) }));
    const back = reconcileRemoved(prev);
    filterRemoved();
    if (back) setTimeout(() => toast(`رجعت ${back} مادة من المزالة بعد تحديث المخزون ✓`, 2600), 1800);
    if (state.company && !state.companies.includes(state.company)) state.company = '';
    if (state.view === 'companies') buildCompanies(); else apply(false);
    updateDataInfo(); updateRemovedCount();
    tryLink();
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
    state.favOnly = v === 'favs'; if (state.favOnly) v = 'all';
    state.view = v;
    const tab = state.favOnly ? 'favs' : v;
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === tab));
    const co = v === 'companies';
    $('#coGrid').hidden = !co; $('#grid').hidden = co; $('#meta').hidden = co; $('#sentinel').hidden = co;
    if (co) { $('#cobar').hidden = true; $('#chips').hidden = true; $('#empty').hidden = true; buildCompanies(); }
    else apply();
    updToolsUi();
    window.scrollTo(0, 0);
  }

  /* شريط الأدوات (السعر / قائمة / شرائح) وشريط المختارات */
  function priceLabel() {
    const a = state.pMin, b = state.pMax;
    return a != null && b != null ? `${num(a)} – ${num(b)}` : a != null ? `من ${num(a)}` : `حتى ${num(b)}`;
  }
  function updToolsUi() {
    const co = state.view === 'companies', pa0 = state.pMin != null || state.pMax != null;
    $('#btnPrice').hidden = !F('price'); $('#btnView').hidden = !F('list'); $('#btnSlide').hidden = !F('slide') || state.favOnly;
    $('#btnQuick').hidden = co;
    $('#qDot').hidden = !(pa0 || !state.inStock);
    const pa = pa0;
    $('#btnPrice').classList.toggle('on', pa);
    $('#priceLbl').textContent = pa ? priceLabel() : 'غير محدد';
    $('#favbar').hidden = co || !state.favOnly || !F('fav');
    $('#favSlide').hidden = !F('slide');
    $('#favCount').textContent = `${num(state.list.length)} مختارة`;
    const n = state.items.reduce((a, i) => a + (favs.has(i.code) ? 1 : 0), 0);
    $('#favN').textContent = n ? String(n) : ''; $('#favN').hidden = !n;
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
    const pool = state.items.filter(it =>
      (!state.company || it.company === state.company) &&
      (!state.category || it.category === state.category) &&
      (!state.inStock || it.stock > 0) &&
      (!state.favOnly || favs.has(it.code)) &&
      (state.pMin == null || it.price >= state.pMin) &&
      (state.pMax == null || it.price <= state.pMax));
    const rk = new Map();                       // رتبة كل نتيجة في البحث الذكي
    let r = pool;
    if (toks.length) {
      r = [];
      for (const it of pool) { const s = smartRank(it, qn, toks); if (s < 9) { rk.set(it, s); r.push(it); } }
    }
    if (state.sort !== 'file') {
      const col = new Intl.Collator('ar'), cx = {}; state.companies.forEach((c, k) => { cx[c] = k; });
      const by = {
        code: (x, y) => x.code.localeCompare(y.code, 'en', { numeric: true }),
        priceAsc: (x, y) => x.price - y.price,
        priceDesc: (x, y) => y.price - x.price,
        stockDesc: (x, y) => y.stock - x.stock,
        stockAsc: (x, y) => x.stock - y.stock,
        inFirst: (x, y) => (y.stock > 0) - (x.stock > 0),
        company: (x, y) => cx[x.company] - cx[y.company],
        name: (x, y) => col.compare(x.name, y.name)
      }[state.sort];
      if (by) r = r.map((it, k) => [k, it]).sort((x, y) => by(x[1], y[1]) || x[0] - y[0]).map(x => x[1]);
    }
    buildCats();
    let approx = 0;
    if (qn) {                                   // الأدق أولاً (الكود ثم الاسم ثم التقريبي)، وداخل كل رتبة يبقى الترتيب المختار
      const rank = it => { const s = rk.get(it) ?? 9; return s <= 1 ? s : s === 2 ? 2 : 3 + s; };
      r = r.map((it, i) => [rank(it), i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
      approx = r.filter(it => rk.get(it) >= 3).length;
    }
    state.list = r;
    $('#count').textContent = approx
      ? (approx === r.length ? `${num(r.length)} نتيجة قريبة من بحثك` : `${num(r.length)} مادة · ${num(approx)} قريبة`)
      : `${num(r.length)} مادة`;
    updToolsUi();
    const g = $('#grid'); g.innerHTML = ''; state.shown = 0;
    $('#empty').hidden = r.length > 0 || !state.items.length;
    if (!r.length && state.items.length) showEmpty(state.favOnly && !favs.size && !state.q ? 'لا توجد مواد مختارة بعد.\nاضغط النجمة ★ على أي مادة لإضافتها هنا.' : 'لا توجد نتائج مطابقة');
    renderMore();
    if (resetScroll) window.scrollTo(0, 0);
  }

  function showEmpty(msg) { const e = $('#empty'); e.textContent = msg; e.style.whiteSpace = 'pre-line'; e.hidden = false; }

  function cardHtml(it, i) {
    const t = imgPath(it, 'thumbs');
    const im = t ? `<img src="${t}" loading="lazy" decoding="async" alt="">` : `<div class="ph">${esc(it.code)}</div>`;
    const badge = it.stock <= 0 ? '<span class="outb">غير متوفر</span>' : '';
    const star = `<span class="fstar${favs.has(it.code) ? ' on' : ''}" data-fav="${esc(it.code)}" role="button" aria-label="مختارات">${ICONS.star}</span>`;
    const pk = (!state.customer && it.pack > 0) ? `<span class="half pk"><small>التعبئة</small><b>${num(it.pack)}</b></span>` : '';
    const st = (!state.customer && it.stock > 0) ? `<span class="half st${it.stock <= 10 ? ' low' : ''}"><small>الباقي</small><b>${num(it.stock)}</b></span>` : '';
    const info = (pk || st) ? `<div class="cinfo">${pk}${st}</div>` : '';
    const price = it.price > 0 ? `<span class="cprice">${num(it.price)}<i> IQD</i></span>` : '<span class="cprice">—</span>';
    return `<button class="card" type="button" style="--co:${coColor(it.company)};--t:${textOn(coColor(it.company))}" data-i="${i}"><div class="cimg">${im}${badge}${star}</div>` +
      `<div class="cname">${esc(it.name)}</div><div class="cfoot"><span class="ccode">${esc(it.code)}</span>${price}</div>${info}</button>`;
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
    const sb = e.target.closest('[data-fav]');
    if (sb) { e.stopPropagation(); const code = sb.dataset.fav; toggleFav(code); sb.classList.toggle('on', favs.has(code)); if (state.favOnly) apply(false); return; }
    const c = e.target.closest('.card'); if (c) openDetail(+c.dataset.i);
  });
  function toggleFav(code) {
    if (favs.has(code)) favs.delete(code); else favs.add(code);
    store.set('favs', JSON.stringify([...favs]));
    updToolsUi();
    const cur = state.list[state.cur];
    if (cur && cur.code === code && !$('#detail').hidden) { $('#dFav').classList.toggle('on', favs.has(code)); if (state.favOnly) favDirty = true; }
  }

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
      (!cust && it.carton > 0 ? `<div class="p-sub"><small>سعر الكارتون</small><b>${fmt(it.carton)}</b></div>` : '') +
      `<div class="p-code"><small>الكود</small><b>${esc(it.code)}</b></div>`;
    const status = it.stock > 0 ? (cust ? 'متوفر' : `متوفر (${num(it.stock)})`) : 'غير متوفر';
    const rows = [
      ['الحالة', `<span class="${it.stock > 0 ? 'st-ok' : 'st-no'}">${status}</span>`, false, true], ['الشركة', `<span class="cdot" style="background:${coColor(it.company)}"></span>${esc(it.company)}`, false, true],
      !cust && it.barcode ? ['الباركود', it.barcode, true] : null,
      !cust && it.pack ? ['عدد التعبئة', num(it.pack), true] : null,
    ].filter(Boolean);
    $('#dRows').innerHTML = rows.map(r => `<dt>${r[0]}</dt><dd class="${r[2] ? 'ltr' : ''}">${r[3] ? r[1] : esc(r[1])}</dd>`).join('');
    $('#dPrev').hidden = i <= 0;
    $('#dNext').hidden = i >= state.list.length - 1;
    $('#dPos').textContent = `${i + 1} / ${state.list.length}`;
    $('#detail .panel').scrollTop = 0;
    $('#dFav').classList.toggle('on', favs.has(it.code));
    const gr = $('#grid'), old = gr.querySelector('.card.sel'); if (old) old.classList.remove('sel');
    const cd = gr.querySelector(`.card[data-i="${i}"]`);
    if (cd) { cd.classList.add('sel'); if (document.body.classList.contains('pane-open')) cd.scrollIntoView({ block: 'nearest' }); }
    scheduleShareRender(it);
  }

  /* عرض بنافذتين: على الشاشات العريضة (آيباد/لابتوب) تظهر التفاصيل بجانب القائمة بدل نافذة تغطي الصفحة */
  const splitOn = () => F('split') && window.innerWidth >= 800;
  const anySheetOpen = () => ['pdfSheet', 'settings', 'removedSheet', 'priceSheet', 'debtSheet', 'quickSheet', 'scanOvl', 'slideOvl'].some(id => !$('#' + id).hidden);
  function syncDetailMode() {
    const split = splitOn(), open = !$('#detail').hidden, b = document.body.classList;
    b.toggle('split-on', split);
    b.toggle('pane-open', split && open);
    if (open) { if (!split) b.add('lock'); else if (!anySheetOpen()) b.remove('lock'); }
    relayout();
  }
  function openDetail(i) {
    const was = !$('#detail').hidden;
    showDetail(i);
    $('#detail').hidden = false;
    if (!splitOn()) document.body.classList.add('lock');
    syncDetailMode();
    if (!was) history.pushState({ o: 'detail' }, '');
  }
  /* ───────────── إزالة مادة من الكتالوج وإرجاعها ───────────── */
  function updateRemovedCount() { const n = Object.keys(removed).length; const el = $('#remCount'); if (el) el.textContent = num(n); }
  function refreshViews() { if (state.view === 'companies') buildCompanies(); else apply(false); updateDataInfo(); updateRemovedCount(); }
  let rmArm = null;
  function resetRmBtn() { const b = $('#dRemove'); clearTimeout(rmArm); rmArm = null; if (b) { b.textContent = 'إزالة من الكتالوج'; b.classList.remove('armed'); } }
  $('#dRemove').onclick = () => {
    const it = state.list[state.cur]; if (!it) return;
    if (!rmArm) {
      const b = $('#dRemove'); b.textContent = 'اضغط مرة ثانية للتأكيد'; b.classList.add('armed');
      rmArm = setTimeout(resetRmBtn, 3500); return;
    }
    resetRmBtn();
    removed[it.code] = { s: it.stock || 0, at: Date.now(), n: it.name, c: it.company };
    saveRemoved(); filterRemoved(); closeDetail(false); refreshViews();
    toast('تمت الإزالة — تجدها في الإعدادات › المواد المزالة', 2600);
  };
  function restoreItem(code) { delete removed[code]; saveRemoved(); filterRemoved(); refreshViews(); renderRemoved(); }
  function renderRemoved() {
    const codes = Object.keys(removed).sort((a, b) => (removed[b].at || 0) - (removed[a].at || 0));
    const byCode = new Map(state.all.map(i => [i.code, i]));
    $('#remInfo').textContent = codes.length
      ? 'هذه المواد مخفية عن الكتالوج في هذا الجهاز فقط. تعود تلقائياً إذا زاد مخزونها أو حُدّث المخزون كاملاً، أما تحديث الأسعار وحده فلا يُرجعها.'
      : 'لا توجد مواد مزالة.';
    $('#remAll').hidden = !codes.length;
    $('#remList').innerHTML = codes.map(c => {
      const e = removed[c], it = byCode.get(c);
      const th = it && it.img ? `<img alt="" src="${imgPath(it, 'thumbs')}">` : `<div class="rph">${esc(c)}</div>`;
      const now = it ? `المخزون الآن: ${num(it.stock)}` : 'غير موجودة في الملف الحالي';
      return `<div class="remrow">${th}<div class="t"><b>${esc((it && it.name) || e.n || c)}</b><small>${esc(c)} · ${esc((it && it.company) || e.c || '')}</small>` +
        `<small>عند الإزالة: ${num(e.s)} · ${now}</small></div><button class="btn small" type="button" data-restore="${esc(c)}">إرجاع</button></div>`;
    }).join('');
  }
  $('#remList').addEventListener('click', e => { const b = e.target.closest('[data-restore]'); if (b) restoreItem(b.dataset.restore); });
  $('#remAll').onclick = () => { removed = {}; saveRemoved(); filterRemoved(); refreshViews(); renderRemoved(); toast('تم إرجاع كل المواد ✓'); };
  $('#btnRemoved').onclick = () => { renderRemoved(); openSheet('removedSheet'); };

  function closeDetail(viaPop) {
    resetRmBtn();
    $('#detail').hidden = true; document.body.classList.remove('lock', 'pane-open');
    const old = $('#grid').querySelector('.card.sel'); if (old) old.classList.remove('sel');
    if (!viaPop && history.state && history.state.o === 'detail') history.back();
    relayout();
    if (favDirty) { favDirty = false; if (state.favOnly) apply(false); }
  }
  window.addEventListener('popstate', () => {
    if (sl.popGuard) { sl.popGuard = false; return; }
    if (sl.open) { closeSlide(true); return; }
    if (!$('#detail').hidden) closeDetail(true);
  });
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
  const TABLE_ROWS = 28;                                                  // صفوف الصفحة في القائمة الجدولية
  const perPage = l => l === 'table' ? TABLE_ROWS : LAYOUTS[l][0] * LAYOUTS[l][1];
  let pdfBlob = null, pdfCancel = false, pdfName = 'catalog.pdf';

  function pdfScopeItems() {
    const v = $('#pdfScope').value;
    let base = v === 'current' ? state.list : v === 'all' ? state.items : v === 'favs' ? state.items.filter(i => favs.has(i.code)) : state.items.filter(i => i.company === v.slice(3));
    if ($('#pdfStock').checked) base = base.filter(i => i.stock > 0);
    return base;
  }
  function pdfScopeTitle() {
    const v = $('#pdfScope').value;
    return v === 'favs' ? 'المختارات' : v === 'all' ? 'كل المنتجات' : v === 'current' ? (state.company || 'المنتجات المعروضة') : v.slice(3);
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
    const items = pdfScopeItems(), per = perPage($('#pdfLayout').value);
    const pages = pdfPages(items, per).length, cv = F('cover') && $('#pdfCover').checked;
    $('#pdfInfo').textContent = `${num(items.length)} مادة — ${num(pages)} صفحة` + (cv ? ' + غلاف وفهرس' : '');
    $('#pdfStart').disabled = !items.length;
  }
  const tableOpt = $('#pdfLayout option[value="table"]');
  function openPdfSheet(preset) {
    const sel = $('#pdfScope');
    sel.innerHTML = `<option value="current">المعروض حالياً (${num(state.list.length)})</option><option value="all">كل المواد (${num(state.items.length)})</option>` +
      (F('fav') && favs.size ? `<option value="favs">★ المختارات (${num(state.items.filter(i => favs.has(i.code)).length)})</option>` : '') +
      state.companies.map(c => `<option value="co:${esc(c)}">شركة: ${esc(c)}</option>`).join('');
    if (typeof preset === 'string' && [...sel.options].some(o => o.value === preset)) sel.value = preset;
    const lay = $('#pdfLayout');
    if (F('table')) { if (!tableOpt.parentNode) lay.appendChild(tableOpt); } else { tableOpt.remove(); if (lay.value === 'table' || !lay.value) lay.value = '6'; }
    $('#pdfCoverRow').hidden = !F('cover'); $('#pdfCover').checked = store.get('pdfCover') !== '0';
    $('#pdfStock').checked = state.inStock;
    let saved = {}; try { saved = JSON.parse(store.get('pdfFields') || '{}'); } catch { /* تجاهل */ }
    Object.keys(PDF_FIELD_IDS).forEach(k => { $('#' + PDF_FIELD_IDS[k]).checked = k in saved ? !!saved[k] : k !== 'carton'; });
    $('#pdfFieldsBox').hidden = state.customer;
    $('#pdfDone').hidden = true; $('#pdfProg').hidden = true; $('#pdfText').textContent = '';
    updatePdfInfo(); openSheet('pdfSheet');
  }
  $('#pdfCover').addEventListener('change', e => { store.set('pdfCover', e.target.checked ? '1' : '0'); updatePdfInfo(); });
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

  /* ───── غلاف وفهرس وقائمة جدولية ───── */
  const IDX_ROWS = 16;
  function fitText(g, text, maxW, size, weight = 'bold', min = 15) {     // يصغّر الخط ثم يقصّ بنقاط عند الحاجة
    text = String(text); let z = size; g.font = `${weight} ${z}px ${FONT}`;
    while (z > min && g.measureText(text).width > maxW) { z -= 1; g.font = `${weight} ${z}px ${FONT}`; }
    if (g.measureText(text).width > maxW) { while (text.length > 1 && g.measureText(text + '…').width > maxW) text = text.slice(0, -1); text += '…'; }
    return text;
  }
  function pdfIndexEntries(pgs, items) {                  // فهرس بالشركات، أو بالأقسام إن كانت شركة واحدة
    const cos = [...new Set(items.map(i => i.company || ''))];
    let by;
    if (cos.length > 1) by = it => it.company || '';
    else { const cats = new Set(items.map(i => i.category || '').filter(Boolean)); if (cats.size < 2) return []; by = it => it.category || ''; }
    const map = new Map();
    items.forEach(it => { const k = by(it); if (k) map.set(k, (map.get(k) || 0) + 1); });
    const out = [];
    map.forEach((count, k) => out.push({ label: k, count, p: pgs.findIndex(pg => pg.items.some(it => by(it) === k)), color: coColor(cos.length > 1 ? k : cos[0]) }));
    return out;
  }
  function pdfHeader(g, W, color, title, brand) {
    g.fillStyle = color; g.fillRect(0, 0, W, 104);
    g.fillStyle = textOn(color); g.textBaseline = 'middle';
    g.textAlign = 'right'; g.direction = 'rtl'; g.font = `bold 46px ${FONT}`; g.fillText(title, W - 40, 54);
    g.textAlign = 'left'; g.direction = 'ltr'; g.font = `bold 36px ${FONT}`; g.fillText(brand, 40, 54);
    g.direction = 'rtl';
  }
  function pdfFooter(g, W, H, p, total, today) {
    g.fillStyle = '#9a938a'; g.font = `22px ${FONT}`; g.textAlign = 'center'; g.direction = 'ltr'; g.textBaseline = 'middle';
    g.fillText(`${p + 1} / ${total}`, W / 2, H - 34);
    g.textAlign = 'left'; g.fillText(today, 40, H - 34); g.textAlign = 'center'; g.direction = 'rtl';
  }
  function drawCover(g, W, H, opt, count, logo, today) {          // اسم الشركة فقط، بلا اسم المندوب
    const accent = opt.accent, fg = textOn(accent);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = accent; g.fillRect(0, 0, W, 600);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let ny = 300;
    if (logo) { drawContain(g, logo, (W - 420) / 2, 90, 420, 190); ny = 410; }
    g.fillStyle = fg; g.direction = /[A-Za-z]/.test(opt.coName) ? 'ltr' : 'rtl';
    g.fillText(fitText(g, opt.coName, W - 160, 120), W / 2, ny);
    g.direction = 'rtl'; g.fillStyle = '#1f1d1b';
    g.fillText(fitText(g, opt.title, W - 160, 76), W / 2, 800);
    g.fillStyle = '#7a736a'; g.font = `600 42px ${FONT}`;
    g.fillText(opt.layout === 'table' ? 'قائمة الأسعار' : 'كتالوج المنتجات', W / 2, 890);
    g.fillStyle = accent; g.fillRect(W / 2 - 90, 950, 180, 8);
    g.fillStyle = '#1f1d1b'; g.font = `bold 48px ${FONT}`; g.fillText(`${num(count)} مادة`, W / 2, 1040);
    g.fillStyle = '#9a938a'; g.font = `36px ${FONT}`; g.direction = 'ltr'; g.fillText(today, W / 2, 1110); g.direction = 'rtl';
  }
  function drawIndex(g, W, H, opt, rows) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    pdfHeader(g, W, opt.accent, 'الفهرس', opt.coName);
    const top = 150, rh = 72;
    rows.forEach((e, k) => {
      const y = top + k * rh;
      g.strokeStyle = '#e8e3dc'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(40, y + rh); g.lineTo(W - 40, y + rh); g.stroke();
      g.fillStyle = e.color; rr(g, W - 54, y + 16, 14, rh - 32, 5); g.fill();
      g.textBaseline = 'middle'; g.fillStyle = '#1f1d1b'; g.textAlign = 'right'; g.direction = 'rtl';
      g.fillText(fitText(g, e.label, 560, 34), W - 76, y + rh / 2 + 1);
      g.fillStyle = '#8a837a'; g.font = `26px ${FONT}`; g.textAlign = 'center'; g.fillText(`${num(e.count)} مادة`, 330, y + rh / 2 + 1);
      g.fillStyle = '#1f1d1b'; g.font = `bold 36px ${FONT}`; g.textAlign = 'left'; g.direction = 'ltr'; g.fillText(String(e.page), 60, y + rh / 2 + 1);
      g.direction = 'rtl';
    });
  }
  function drawTablePage(g, W, slice, color, f) {
    const fg = textOn(color), x0 = 40, x1 = W - 40, tw = x1 - x0, ink = '#1f1d1b', RH = 44, y0 = 124, HH = 52;
    const defs = [{ k: 'code', l: 'الكود', w: 124 }, { k: 'name', l: 'اسم المادة', w: 0 }];
    if (f.price) defs.push({ k: 'price', l: 'السعر', w: 150 });
    if (f.carton) defs.push({ k: 'carton', l: 'سعر الكارتون', w: 160 });
    if (f.pack) defs.push({ k: 'pack', l: 'التعبئة', w: 96 });
    if (f.stock) defs.push({ k: 'stock', l: 'الباقي', w: 116 });
    if (f.barcode) defs.push({ k: 'barcode', l: 'الباركود', w: 200 });
    const nameCol = defs[1]; nameCol.w = Math.max(240, tw - defs.reduce((a, d) => a + d.w, 0));
    const tot = defs.reduce((a, d) => a + d.w, 0), sc = tot > tw ? tw / tot : 1;
    let xr = x1; defs.forEach(d => { d.w *= sc; d.xr = xr; xr -= d.w; });
    g.fillStyle = color; g.fillRect(x0, y0, tw, HH);
    g.fillStyle = fg; g.textBaseline = 'middle'; g.font = `bold 24px ${FONT}`; g.direction = 'rtl';
    defs.forEach(d => { if (d.k === 'name') { g.textAlign = 'right'; g.fillText(d.l, d.xr - 12, y0 + HH / 2 + 1); } else { g.textAlign = 'center'; g.fillText(d.l, d.xr - d.w / 2, y0 + HH / 2 + 1); } });
    slice.forEach((it, n) => {
      const y = y0 + HH + n * RH, ym = y + RH / 2 + 1;
      if (n % 2 === 0) { g.fillStyle = '#f6f4f1'; g.fillRect(x0, y, tw, RH); }
      g.strokeStyle = '#e6e1d9'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y + RH); g.lineTo(x1, y + RH); g.stroke();
      defs.forEach(d => {
        const cx = d.xr - d.w / 2; g.fillStyle = ink;
        if (d.k === 'name') { g.textAlign = 'right'; g.direction = 'rtl'; g.fillText(fitText(g, it.name, d.w - 24, 24, '600', 15), d.xr - 12, ym); return; }
        g.textAlign = 'center'; g.direction = 'ltr';
        if (d.k === 'code') g.fillText(fitText(g, it.code, d.w - 12, 24, 'bold'), cx, ym);
        else if (d.k === 'price') g.fillText(fitText(g, fmt(it.price), d.w - 12, 25, 'bold'), cx, ym);
        else if (d.k === 'carton') g.fillText(fitText(g, fmt(it.carton), d.w - 12, 22, '600'), cx, ym);
        else if (d.k === 'pack') g.fillText(fitText(g, it.pack > 0 ? num(it.pack) : '—', d.w - 8, 23, '600'), cx, ym);
        else if (d.k === 'barcode') g.fillText(fitText(g, it.barcode ? String(it.barcode) : '—', d.w - 12, 21, '600'), cx, ym);
        else if (d.k === 'stock') {
          if (it.stock > 0) { g.fillStyle = it.stock <= 10 ? '#b45309' : ink; g.fillText(num(it.stock), cx, ym); }
          else { g.direction = 'rtl'; g.fillStyle = '#b3261e'; g.fillText(fitText(g, 'غير متوفر', d.w - 8, 19, 'bold'), cx, ym); }
        }
      });
      g.direction = 'rtl';
    });
  }

  async function buildPdf(items, opt, onProgress) {
    const W = 1050, H = 1485, table = opt.layout === 'table', per = perPage(opt.layout);
    const cols = table ? 1 : LAYOUTS[opt.layout][0];
    const pgs = pdfPages(items, per);
    const cos = [...new Set(items.map(i => i.company || ''))];
    opt.accent = cos.length === 1 && cos[0] ? coColor(cos[0]) : ORANGE;
    opt.coName = opt.coName || COMPANY_NAME;
    const plan = [];
    if (opt.cover) {
      const ent = pdfIndexEntries(pgs, items), nIdx = Math.ceil(ent.length / IDX_ROWS), front = 1 + nIdx;
      ent.forEach(e => { e.page = front + e.p + 1; });
      plan.push({ kind: 'cover' });
      for (let k = 0; k < nIdx; k++) plan.push({ kind: 'index', rows: ent.slice(k * IDX_ROWS, (k + 1) * IDX_ROWS) });
    }
    pgs.forEach(pg => plan.push({ kind: 'items', pg }));
    const pages = plan.length;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.direction = 'rtl';
    const today = new Date().toISOString().slice(0, 10);
    const logo = opt.cover ? await getLogo() : null;
    const parts = []; let pos = 0; const offs = {};
    const push = d => { parts.push(d); pos += typeof d === 'string' ? d.length : d.size; };
    const obj = n => { offs[n] = pos; push(`${n} 0 obj\n`); };
    const PW = 595.28, PH = 841.89;
    push('%PDF-1.4\n');

    for (let p = 0; p < pages; p++) {
      if (pdfCancel) return null;
      const pl = plan[p];
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      if (pl.kind === 'cover') { drawCover(g, W, H, opt, items.length, logo, today); }
      else if (pl.kind === 'index') { drawIndex(g, W, H, opt, pl.rows); pdfFooter(g, W, H, p, pages, today); }
      else {
        const slice = pl.pg.items, co = pl.pg.company;
        const color = co ? coColor(co) : ORANGE;
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        pdfHeader(g, W, color, co || opt.title, opt.coName);                     // شريط الصفحة بلون الشركة (كما كان)
        if (table) drawTablePage(g, W, slice, color, opt.fields);
        else {
          const imgs = await Promise.all(slice.map(it => loadImg(
            (per >= 6 ? [imgPath(it, 'thumbs')] : [imgPath(it, 'full'), imgPath(it, 'thumbs')]).filter(Boolean))));
          const rows = per / cols;
          const mx = 40, gap = 22, top = 128, bottom = H - 70;
          const cw = (W - 2 * mx - gap * (cols - 1)) / cols, ch = (bottom - top - gap * (rows - 1)) / rows;
          slice.forEach((it, n) => {
            const col = n % cols, row = Math.floor(n / cols);
            drawCell(g, it, imgs[n], W - mx - cw - col * (cw + gap), top + row * (ch + gap), cw, ch, opt.fields, color);
          });
        }
        pdfFooter(g, W, H, p, pages, today);
      }

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
        layout: $('#pdfLayout').value, fields: pdfFields(), title: pdfScopeTitle(),
        cover: F('cover') && $('#pdfCover').checked, coName: store.get('coName') || ''
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
    $('#dataInfo').textContent = `${num(state.all.length)} مادة في ${state.companies.length} شركة — آخر تحديث للأسعار: ${d}`;
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
    const urls = state.all.filter(i => i.img).map(i => imgPath(i, kind));
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
    ['pdfSheet', 'settings', 'removedSheet', 'priceSheet', 'debtSheet', 'quickSheet'].forEach(id => { $('#' + id).hidden = true; });
    if ($('#detail').hidden || splitOn()) document.body.classList.remove('lock');
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
    if (b.dataset.view === 'all' || b.dataset.view === 'favs') { state.company = ''; state.category = ''; }
    setView(b.dataset.view);
  });
  $('#sort').value = state.sort;
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; store.set('sort', state.sort); apply(); });
  $('#inStock').checked = state.inStock;   // «المتوفر فقط» مفعّل تلقائياً في كل فتح، والمستخدم يلغيه بنفسه
  /* «المتوفر فقط»: خطوتان — ضغط الزر ثم رسالة تأكيد (لتفادي الضغط بالخطأ).
     لا يُحفظ الاختيار: عند كل فتح جديد للتطبيق يرجع «المتوفر فقط» مفعّلاً. */
  const codeNorm = v => String(v).trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  function askDialog({ title, text = '', input = false, validate }) {      // نافذة تأكيد، أو إدخال رمز عند input
    return new Promise(res => {
      const sh = $('#confirmSheet'), inp = $('#cfPass'), err = $('#cfErr');
      $('#cfTitle').textContent = title; $('#cfText').textContent = text; $('#cfText').hidden = !text;
      $('#cfYes').textContent = input ? 'دخول' : 'نعم';
      inp.hidden = !input; inp.value = ''; err.hidden = true; sh.hidden = false;
      if (input) inp.focus();
      const done = v => { sh.hidden = true; inp.value = ''; $('#cfYes').onclick = $('#cfNo').onclick = sh.onclick = inp.onkeydown = null; res(v); };
      const ok = () => {
        if (!input) return done(true);
        const m = validate ? validate(codeNorm(inp.value)) : true;
        if (m === true) done(true); else { err.textContent = m; err.hidden = false; inp.select(); }
      };
      $('#cfYes').onclick = ok; $('#cfNo').onclick = () => done(false);
      sh.onclick = e => { if (e.target === sh) { e.stopPropagation(); done(false); } };
      inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
    });
  }
  const askConfirm = (title, text) => askDialog({ title, text });
  $('#inStock').addEventListener('click', async e => {
    e.preventDefault();
    const want = !state.inStock;
    const ok = await askConfirm(want ? 'عرض المتوفر فقط' : 'إظهار جميع المنتجات',
      want ? 'هل تريد عرض المواد المتوفرة فقط؟' : 'هل تريد إظهار جميع المنتجات بما فيها غير المتوفرة؟');
    if (!ok) return;
    state.inStock = want; $('#inStock').checked = want; apply();
  });
  $('#btnQuick').onclick = () => { updToolsUi(); openSheet('quickSheet'); };
  $('#btnPdf').onclick = () => openPdfSheet();
  $('#btnSettings').onclick = async () => {
    if (SETTINGS_CODE && !(await askDialog({ title: 'الإعدادات', text: 'أدخل الرمز للدخول', input: true, validate: v => v === codeNorm(SETTINGS_CODE) || 'الرمز غير صحيح' }))) return;
    $('#optCustomer').checked = state.customer; $('#optSmart').checked = state.smart;
    $('#secDebts').hidden = state.customer;
    renderFeatList(); $('#optSlideSec').value = String(slideSec()); $('#optCoName').value = store.get('coName') || '';
    updateDataInfo(); updateRemovedCount(); updateStorageInfo(); openSheet('settings');
  };
  $('#optCustomer').addEventListener('change', e => { state.customer = e.target.checked; store.set('customer', state.customer ? '1' : '0'); applyScanBtn(); toast(state.customer ? 'وضع الزبون مفعّل' : 'وضع الزبون متوقف'); });
  $('#optSmart').addEventListener('change', e => { state.smart = e.target.checked; store.set('smart', state.smart ? '1' : '0'); if (state.view === 'all') apply(false); toast(state.smart ? 'البحث الذكي مفعّل' : 'البحث الذكي متوقف'); });
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
    if ($('#detail').hidden || sl.open || !$('#confirmSheet').hidden) return;
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
  const autoCols = () => Math.max(2, Math.min(4, Math.floor(($('main').clientWidth || window.innerWidth) / 190)));
  const lmOn = () => state.listMode && F('list');
  function relayout() { if (!cols) setCols(autoCols(), true); else updTier(); }
  let cols = +store.get('cols') || 0;                  // 0 = تلقائي حسب حجم الشاشة
  function setCols(n, silent) {
    n = LEVELS.includes(n) ? n : LEVELS.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a);
    grid.style.setProperty('--cols', n);
    grid.dataset.cols = n;
    updTier();
    if (!silent) toast(`${n} في الصف`, 900);
    return n;
  }
  const curCols = () => +grid.dataset.cols || autoCols();
  /* المعلومات تتناقص حسب العرض الفعلي للبطاقة (لا حسب عدد الأعمدة فقط):
     0: كل شيء · 1: بدون تجاور السعر والكود · 2: بلا الاسم · 3: بلا التعبئة والباقي · 4: كود فقط · 5: صور فقط */
  function updTier() {
    const w = grid.clientWidth; if (!w) return;
    const n = +grid.dataset.cols || autoCols();
    const cw = (w - 28 - 12 * (n - 1)) / n;
    let t = cw >= 190 ? 0 : cw >= 150 ? 1 : cw >= 120 ? 2 : cw >= 90 ? 3 : cw >= 62 ? 4 : 5, cwv = Math.max(40, Math.round(cw));
    if (lmOn()) { t = 0; cwv = 200; }                       // عرض القائمة: كل المعلومات ظاهرة دائماً
    if (grid.dataset.t !== String(t)) grid.dataset.t = t;
    grid.style.setProperty('--cw', cwv + 'px');
  }
  if ('ResizeObserver' in window) new ResizeObserver(updTier).observe(grid);
  window.addEventListener('resize', updTier);

  /* ما الذي يظهر في البطاقة (من الإعدادات) */
  const CARD_F = ['name', 'code', 'price', 'pack', 'stock'];
  let cardF = { name: true, code: true, price: true, pack: true, stock: true };
  try { Object.assign(cardF, JSON.parse(store.get('cardf') || '{}')); } catch { /* تجاهل */ }
  function applyCardF() {
    CARD_F.forEach(k => grid.classList.toggle('hf-' + k, !cardF[k]));
    grid.classList.toggle('hf-foot', !cardF.code && !cardF.price);
    grid.classList.toggle('hf-info', !cardF.pack && !cardF.stock);
  }
  applyCardF();
  CARD_F.forEach(k => {
    const el = $('#optF' + k[0].toUpperCase() + k.slice(1)); if (!el) return;
    el.checked = cardF[k];
    el.addEventListener('change', () => { cardF[k] = el.checked; store.set('cardf', JSON.stringify(cardF)); applyCardF(); });
  });
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
  const canPinch = () => state.view === 'all' && !lmOn() && !document.body.classList.contains('lock');
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

  /* ───────────── قارئ الباركود (نفس نظام برنامج البيرينجيلر: html5-qrcode) ─────────────
     إضافة مستقلة: لا تُحمَّل المكتبة إلا عند الضغط على الزر، والبحث محلي على البيانات المحفوظة (يعمل بدون إنترنت). */
  const QR_SRCS = ['https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js', 'html5-qrcode.min.js'];
  let qrPromise = null, scanner = null, scanning = false;
  const applyScanBtn = () => { $('#btnScan').hidden = state.customer; };
  applyScanBtn();
  function loadQr() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (qrPromise) return qrPromise;
    qrPromise = (async () => {
      for (const src of QR_SRCS) {
        try {
          await new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => { el.remove(); no(); }; document.head.appendChild(el); });
          if (window.Html5Qrcode) return;
        } catch { /* جرّب المصدر التالي */ }
      }
      qrPromise = null; throw new Error('qr-lib');
    })();
    return qrPromise;
  }
  function scanMsg(t, kind) { const el = $('#scanMsg'); el.textContent = t; el.className = 'scan-msg ' + (kind || ''); }
  const sameCode = (a, b) => {
    a = String(a || '').trim(); b = String(b || '').trim(); if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    return /^\d+$/.test(a) && /^\d+$/.test(b) && a.replace(/^0+/, '') === b.replace(/^0+/, '');   // UPC-A / EAN-13
  };
  async function startCam() {
    try {
      const F = Html5QrcodeSupportedFormats;
      await scanner.start({ facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 120 }, aspectRatio: 1.5,
          formatsToSupport: [F.EAN_13, F.EAN_8, F.CODE_128, F.CODE_39, F.UPC_A, F.UPC_E, F.ITF, F.CODABAR] },
        onScanned, () => { });
      scanMsg('وجّه الكاميرا على الباركود', '');
    } catch (e) { scanMsg('⚠️ اسمح للكاميرا من إعدادات Safari', 'bad'); console.warn('camera', e); }
  }
  async function openScan() {
    if ($('#scanOvl').hidden === false) return;
    $('#scanOvl').hidden = false; document.body.classList.add('lock'); scanning = true;
    scanMsg('جارٍ تشغيل الكاميرا…', '');
    try { await loadQr(); } catch { scanMsg('⚠️ تعذّر تحميل قارئ الباركود — افتح البرنامج مرة وأنت متصل بالإنترنت ثم حاول', 'bad'); return; }
    if (!scanning) return;
    scanner = new Html5Qrcode('qrReader');
    await startCam();
  }
  async function closeScan() {
    scanning = false;
    try { if (scanner) await scanner.stop(); } catch { /* تجاهل */ }
    try { if (scanner) scanner.clear(); } catch { /* تجاهل */ }
    scanner = null; $('#qrReader').innerHTML = '';
    $('#scanOvl').hidden = true;
    if ($('#detail').hidden || splitOn()) document.body.classList.remove('lock');
  }
  async function onScanned(code) {
    if (!scanning) return; scanning = false;
    try { await scanner.stop(); } catch { /* تجاهل */ }
    if (navigator.vibrate) navigator.vibrate(120);
    const hit = state.items.find(it => sameCode(it.barcode, code) || sameCode(it.code, code));
    if (hit) {
      scanMsg('✅ ' + hit.name, 'ok');
      setTimeout(async () => {
        await closeScan();
        let idx = state.list.indexOf(hit);
        if (idx < 0) {                                      // المادة خارج الفلتر الحالي: صفّر الفلاتر
          state.q = ''; $('#q').value = ''; $('#clear').hidden = true; state.company = ''; state.category = ''; state.inStock = false; $('#inStock').checked = false; state.pMin = state.pMax = null;
          if (state.view === 'companies' || state.favOnly) setView('all'); else apply(false);
          idx = state.list.indexOf(hit);
        }
        if (idx >= 0) openDetail(idx);
      }, 650);
      return;
    }
    const gone = state.all.find(it => removed[it.code] && (sameCode(it.barcode, code) || sameCode(it.code, code)));
    scanMsg(gone ? '🗑 مزالة من الكتالوج: ' + gone.name + ' — أرجعها من الإعدادات' : '❌ غير موجود: ' + code, 'bad');
    setTimeout(async () => {                                // أعد المسح
      if ($('#scanOvl').hidden || !scanner) return;
      scanning = true; scanMsg('وجّه الكاميرا على الباركود', ''); await startCam();
    }, 2500);
  }
  $('#btnScan').onclick = openScan;
  $('#scanClose').onclick = closeScan;


  /* ═══════════════ الميزات الإضافية ═══════════════ */
  function renderFeatList() {
    $('#featList').innerHTML = FEAT_DEFS.map(([k, t, d]) =>
      `<label class="row-switch"><span><b>${t}</b><small>${d}</small></span><input type="checkbox" data-feat="${k}"${F(k) ? ' checked' : ''}></label>`).join('');
  }
  $('#featList').addEventListener('change', e => {
    const k = e.target.dataset.feat; if (!k) return;
    feat[k] = e.target.checked; store.set('feat', JSON.stringify(feat));
    applyFeatures();
    toast((FEAT_DEFS.find(d => d[0] === k) || [])[1] + (feat[k] ? ': مفعّلة' : ': متوقفة'));
  });
  function applyFeatures() {
    document.body.classList.toggle('feat-fav', F('fav'));
    if (!F('fav') && state.favOnly) setView('all');
    if (!F('price')) state.pMin = state.pMax = null;
    if (!F('slide') && sl.open) closeSlide(false);
    $('#tabFav').hidden = !F('fav'); $('#dFav').hidden = !F('fav'); $('#dShareLink').hidden = !F('link');
    paintListMode();
    syncDetailMode();
    if (state.view === 'all') apply(false); else updToolsUi();
  }

  /* عرض القائمة المضغوطة */
  function paintListMode() {
    const on = lmOn();
    grid.classList.toggle('lm', on);
    document.querySelector('.zoom').hidden = on;
    $('#viewLbl').textContent = on ? 'قائمة' : 'بطاقات';
    $('#viewIcon').innerHTML = on ? ICONS.grid : ICONS.list;
    updTier();
  }
  $('#btnView').onclick = () => { state.listMode = !state.listMode; store.set('viewmode', state.listMode ? 'list' : 'grid'); paintListMode(); };
  window.addEventListener('resize', syncDetailMode);

  /* فلتر نطاق السعر */
  const numIn = t => { t = String(t).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d.]/g, ''); return t === '' ? null : Number(t); };
  $('#btnPrice').onclick = () => {
    closeSheets();
    const ps = state.items.map(i => i.price).filter(p => p > 0);
    $('#priceInfo').textContent = ps.length ? `أقل سعر: ${num(ps.reduce((a, b) => Math.min(a, b)))} — أعلى سعر: ${num(ps.reduce((a, b) => Math.max(a, b)))} IQD` : '';
    $('#pMin').value = state.pMin == null ? '' : state.pMin; $('#pMax').value = state.pMax == null ? '' : state.pMax;
    openSheet('priceSheet');
  };
  const applyPrice = () => {
    let a = numIn($('#pMin').value), b = numIn($('#pMax').value);
    if (a != null && b != null && a > b) [a, b] = [b, a];
    state.pMin = a; state.pMax = b; closeSheets(); apply();
  };
  $('#pApply').onclick = applyPrice;
  ['pMin', 'pMax'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') applyPrice(); }));
  $('#pClear').onclick = () => { state.pMin = state.pMax = null; closeSheets(); apply(); };

  /* المختارات */
  $('#dFav').onclick = () => {
    const it = state.list[state.cur]; if (!it) return;
    toggleFav(it.code);
    const st = $('#grid').querySelector(`[data-fav="${CSS.escape(it.code)}"]`); if (st) st.classList.toggle('on', favs.has(it.code));
    toast(favs.has(it.code) ? '★ أُضيفت إلى المختارات' : 'أُزيلت من المختارات', 1200);
  };
  $('#favClear').onclick = async () => {
    if (!favs.size) return;
    if (!(await askConfirm('مسح المختارات', 'هل تريد إزالة كل المواد من المختارات؟'))) return;
    favs.clear(); store.set('favs', '[]'); apply(false);
  };
  $('#favPdf').onclick = () => openPdfSheet('favs');
  $('#favSlide').onclick = () => openSlide();

  /* رابط مباشر للمادة */
  const linkFor = it => `${location.origin}${location.pathname}?p=${encodeURIComponent(it.code)}`;
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch { /* جرّب الطريقة القديمة */ }
    try {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
  $('#dShareLink').onclick = async () => {
    const it = state.list[state.cur]; if (!it) return;
    const url = linkFor(it);
    if (navigator.share) { try { await navigator.share({ title: it.name, text: it.name, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    toast((await copyText(url)) ? 'تم نسخ رابط المادة ✓' : url, 4000);
  };
  function tryLink() {
    if (!pendingLink || !booted || !state.items.length) return;
    const code = pendingLink; pendingLink = null;
    try { history.replaceState(history.state, '', location.pathname); } catch { /* تجاهل */ }
    if (!F('link')) return;
    const it = state.items.find(x => sameCode(x.code, code));
    if (!it) { toast('المادة غير موجودة في الكتالوج'); return; }
    state.q = ''; $('#q').value = ''; $('#clear').hidden = true; state.company = ''; state.category = ''; state.pMin = state.pMax = null;
    if (it.stock <= 0) { state.inStock = false; $('#inStock').checked = false; }
    setView('all');
    const idx = state.list.indexOf(it); if (idx >= 0) openDetail(idx);
  }

  /* عرض الشرائح (Slideshow) */
  const slideSec = () => +store.get('slideSec') || 5;
  function restartBar() {
    const bar = $('#slBar'); bar.style.animation = 'none'; void bar.offsetWidth;
    bar.style.animation = `slbar ${slideSec()}s linear forwards`; bar.style.animationPlayState = sl.playing ? 'running' : 'paused';
  }
  function slideShow(i) {
    const it = sl.list[i]; if (!it) return;
    sl.i = i;
    const img = $('#slImg'), ph = $('#slPh'), col = coColor(it.company), k = ++sl.tok;
    $('#slPos').textContent = `${i + 1} / ${sl.list.length}`;
    $('#slName').textContent = it.name; $('#slCode').textContent = it.code;
    const pr = $('#slPrice'); pr.textContent = fmt(it.price); pr.style.background = col; pr.style.color = textOn(col);
    const st = $('#slStage'); st.classList.remove('in'); void st.offsetWidth; st.classList.add('in');
    const noImg = () => { img.hidden = true; ph.hidden = false; ph.textContent = it.code; };
    if (it.img) {
      img.hidden = false; ph.hidden = true; img.onerror = noImg; img.src = imgPath(it, 'thumbs');
      const f = new Image(); f.onload = () => { if (k === sl.tok) img.src = f.src; }; f.src = imgPath(it, 'full');
    } else noImg();
    const nx = sl.list[(i + 1) % sl.list.length]; if (nx && nx.img) new Image().src = imgPath(nx, 'full');
    restartBar();
  }
  const slideStep = d => { const n = sl.list.length; if (n) slideShow((sl.i + d + n) % n); };
  function paintPlay() { $('#slPlay').textContent = sl.playing ? '❚❚' : '▶'; $('#slBar').style.animationPlayState = sl.playing ? 'running' : 'paused'; }
  async function openSlide() {
    if (!state.list.length) { toast('لا توجد مواد لعرضها'); return; }
    sl.list = state.list.slice(); sl.playing = true; sl.open = true;
    $('#slideOvl').hidden = false; document.body.classList.add('lock');
    history.pushState({ o: 'slide' }, '');
    paintPlay(); slideShow(0);
    try { if (navigator.wakeLock) sl.wl = await navigator.wakeLock.request('screen'); } catch { /* تجاهل */ }
  }
  function closeSlide(viaPop) {
    if (!sl.open) return;
    sl.open = false; $('#slideOvl').hidden = true;
    try { if (sl.wl) sl.wl.release(); } catch { /* تجاهل */ } sl.wl = null;
    if ($('#detail').hidden || splitOn()) { if (!anySheetOpen()) document.body.classList.remove('lock'); }
    if (!viaPop && history.state && history.state.o === 'slide') { sl.popGuard = true; history.back(); }
  }
  $('#btnSlide').onclick = () => { closeSheets(); openSlide(); };
  $('#slClose').onclick = () => closeSlide(false);
  $('#slPlay').onclick = () => { sl.playing = !sl.playing; paintPlay(); };
  $('#slPrev').onclick = e => { e.stopPropagation(); slideStep(-1); };
  $('#slNext').onclick = e => { e.stopPropagation(); slideStep(1); };
  $('#slBar').addEventListener('animationend', () => { if (sl.open && sl.playing) slideStep(1); });
  $('#slStage').addEventListener('click', e => { if (e.target.closest('.sl-nav')) return; sl.playing = !sl.playing; paintPlay(); });
  let slx = null;
  $('#slStage').addEventListener('touchstart', e => { slx = e.touches[0].clientX; }, { passive: true });
  $('#slStage').addEventListener('touchend', e => {
    if (slx === null) return; const dx = e.changedTouches[0].clientX - slx; slx = null;
    if (dx < -60) slideStep(1); else if (dx > 60) slideStep(-1);                  // نفس اتجاه التفاصيل (RTL)
  });
  document.addEventListener('keydown', e => {
    if (!sl.open) return;
    if (e.key === 'Escape') closeSlide(false);
    else if (e.key === 'ArrowLeft') slideStep(1);
    else if (e.key === 'ArrowRight') slideStep(-1);
    else if (e.key === ' ') { e.preventDefault(); sl.playing = !sl.playing; paintPlay(); }
  });
  $('#optSlideSec').addEventListener('change', e => { store.set('slideSec', e.target.value); if (sl.open) restartBar(); toast('مدة الشريحة: ' + e.target.value + ' ث'); });
  $('#optCoName').addEventListener('input', e => store.set('coName', e.target.value.trim()));

  /* حجم الخط */
  function applyFs(v) {
    if (!['s', 'm', 'l', 'xl'].includes(v)) v = 'm';
    document.documentElement.dataset.fs = v;
    document.querySelectorAll('#fsSeg button').forEach(b => b.classList.toggle('on', b.dataset.fs === v));
    return v;
  }
  $('#fsSeg').addEventListener('click', e => { const b = e.target.closest('[data-fs]'); if (b) { store.set('fs', applyFs(b.dataset.fs)); updTier(); } });
  applyFs(store.get('fs') || 'm');

  applyFeatures();
  booted = true; tryLink();


  /* ═══════════════ ديون الزبائن (من ملف إكسل) ═══════════════
     الأعمدة بالترتيب: A اسم الزبون | B المبلغ المديون | C تاريخ آخر قائمة | D تاريخ آخر قبض | E آخر مبلغ مقبوض
     يُقرأ الملف data/debts.xlsx من الموقع، أو يُستورد من الجهاز (فيبقى خاصاً على الجهاز ولا يُرفع للموقع). */
  function inflateRaw(src) {                                        // فك ضغط deflate (بدون مكتبات، يعمل على كل المتصفحات)
    let pos = 0, bb = 0, bc = 0; const out = [];
    const bits = n => { let v = bb; while (bc < n) { if (pos >= src.length) throw new Error('eof'); v |= src[pos++] << bc; bc += 8; } bb = v >>> n; bc -= n; return v & ((1 << n) - 1); };
    const build = lens => { const count = new Array(16).fill(0), sym = [], offs = new Array(16).fill(0); lens.forEach(l => count[l]++); for (let i = 1; i < 15; i++) offs[i + 1] = offs[i] + count[i]; lens.forEach((l, k) => { if (l) sym[offs[l]++] = k; }); return { count, sym }; };
    const dec = h => { let code = 0, first = 0, idx = 0; for (let len = 1; len <= 15; len++) { code |= bits(1); const c = h.count[len]; if (code - c < first) return h.sym[idx + (code - first)]; idx += c; first += c; first <<= 1; code <<= 1; } throw new Error('code'); };
    const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577], DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    let fixed = null;
    const codes = (hl, hd) => {
      for (;;) {
        let sy = dec(hl);
        if (sy < 256) out.push(sy);
        else if (sy === 256) return;
        else { sy -= 257; const len = LB[sy] + bits(LE[sy]), ds = dec(hd), dist = DB[ds] + bits(DE[ds]); for (let k = 0; k < len; k++) out.push(out[out.length - dist]); }
      }
    };
    for (let last = 0; !last;) {
      last = bits(1); const type = bits(2);
      if (type === 0) {
        bb = 0; bc = 0; const len = src[pos] | (src[pos + 1] << 8); pos += 4;
        for (let k = 0; k < len; k++) out.push(src[pos++]);
      } else if (type === 1) {
        if (!fixed) { const l = []; for (let k = 0; k < 288; k++) l.push(k < 144 ? 8 : k < 256 ? 9 : k < 280 ? 7 : 8); fixed = [build(l), build(new Array(30).fill(5))]; }
        codes(fixed[0], fixed[1]);
      } else if (type === 2) {
        const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, ord = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], cl = new Array(19).fill(0);
        for (let k = 0; k < nc; k++) cl[ord[k]] = bits(3);
        const hc = build(cl), lens = [];
        while (lens.length < nl + nd) {
          const sy = dec(hc);
          if (sy < 16) lens.push(sy);
          else { let rep = 0, v = 0; if (sy === 16) { v = lens[lens.length - 1]; rep = 3 + bits(2); } else if (sy === 17) rep = 3 + bits(3); else rep = 11 + bits(7); while (rep--) lens.push(v); }
        }
        codes(build(lens.slice(0, nl)), build(lens.slice(nl)));
      } else throw new Error('block');
    }
    return Uint8Array.from(out);
  }
  function zipReader(buf) {                                          // يقرأ ملف zip (xlsx) ويرجع دالة تعيد نص أي ملف داخله
    const u8 = new Uint8Array(buf), dv = new DataView(buf); let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('not-zip');
    const n = dv.getUint16(e + 10, true), files = {}; let p = dv.getUint32(e + 16, true);
    for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cm = dv.getUint16(p + 32, true);
      files[new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl))] = { m: dv.getUint16(p + 10, true), c: dv.getUint32(p + 20, true), o: dv.getUint32(p + 42, true) };
      p += 46 + nl + el + cm;
    }
    return name => {
      const f = files[name]; if (!f) return null;
      const st = f.o + 30 + dv.getUint16(f.o + 26, true) + dv.getUint16(f.o + 28, true), raw = u8.subarray(st, st + f.c);
      return new TextDecoder().decode(f.m === 0 ? raw : inflateRaw(raw));
    };
  }
  const colIdx = ref => { let n = 0; for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  function xlsxRows(buf) {                                           // → مصفوفة صفوف، كل صف مصفوفة خلايا
    const rd = zipReader(buf), xml = t => new DOMParser().parseFromString(t, 'application/xml');
    const wb = rd('xl/workbook.xml'); let target = 'xl/worksheets/sheet1.xml';
    if (wb) {
      const sh = xml(wb).getElementsByTagName('sheet')[0], rid = sh && (sh.getAttribute('r:id') || sh.getAttribute('id')), rels = rd('xl/_rels/workbook.xml.rels');
      if (rid && rels) for (const r of xml(rels).getElementsByTagName('Relationship')) if (r.getAttribute('Id') === rid) { const t = r.getAttribute('Target'); target = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.?\//, ''); }
    }
    const sheet = rd(target); if (!sheet) throw new Error('no-sheet');
    const sst = [], sx = rd('xl/sharedStrings.xml');
    if (sx) for (const si of xml(sx).getElementsByTagName('si')) sst.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
    const rows = [];
    for (const row of xml(sheet).getElementsByTagName('row')) {
      const cells = [];
      for (const c of row.getElementsByTagName('c')) {
        const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], idx = colIdx(c.getAttribute('r') || '');
        let val = null;
        if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        else if (v) val = t === 's' ? (sst[+v.textContent] ?? '') : (t === 'str' || t === 'e') ? v.textContent : t === 'b' ? v.textContent : Number(v.textContent);
        cells[idx] = val;
      }
      rows.push(cells);
    }
    return rows;
  }
  const isoOf = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  function toIsoDate(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') { if (!(v > 0)) return ''; const d = new Date(Math.round((v - 25569) * 86400000)); return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
    const t = codeNorm(v).replace(/\s+/g, ''); let m;
    if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return isoOf(+m[1], +m[2], +m[3]);
    if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return isoOf(+m[3], +m[2], +m[1]);          // يوم/شهر/سنة
    return '';
  }
  const toAmount = v => typeof v === 'number' ? v : (Number(codeNorm(v || '').replace(/[,٬\sA-Za-z]/g, '')) || 0);
  function parseDebts(buf) {
    const rows = xlsxRows(buf), out = [];
    const nz = v => String(v ?? '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
    let col = { name: 0, debt: 1, pay: 2, addr: 3 }, start = 0;
    for (let k = 0; k < Math.min(rows.length, 6); k++) {                    // البحث عن سطر العناوين (يقبل ملف المحاسبة كما هو)
      const h = (rows[k] || []).map(nz);
      const iName = h.findIndex(x => x.includes('اسم') && x.includes('زبون'));
      if (iName < 0) continue;
      const iDebt = h.findIndex(x => x.includes('دينار')) >= 0 ? h.findIndex(x => x.includes('دينار')) : h.findIndex(x => x.includes('مبلغ'));
      const iPay = h.findIndex(x => x.includes('اخر') && (x.includes('دفع') || x.includes('قبض')));
      const iAddr = h.findIndex(x => x.includes('عنوان'));
      col = { name: iName, debt: iDebt >= 0 ? iDebt : 1, pay: iPay >= 0 ? iPay : 2, addr: iAddr >= 0 ? iAddr : 3 }; start = k + 1; break;
    }
    rows.slice(start).forEach(r => {
      if (!r) return;
      const name = String(r[col.name] ?? '').trim(); if (!name || nz(name) === 'المجموع') return;
      const debt = toAmount(r[col.debt]); if (!(debt >= 1)) return;                                              // صفر أو دائن أو كسور تافهة = لا يظهر
      out.push({ name, debt: Math.round(debt), pay: toIsoDate(r[col.pay]), addr: String(r[col.addr] ?? '').replace(/\s+/g, ' ').trim() });
    });
    return out;
  }
  let debts = { rows: [], at: '', src: '' };
  try { const d = JSON.parse(store.get('debts') || 'null'); if (d && Array.isArray(d.rows)) debts = d; } catch { /* تجاهل */ }
  const saveDebts = (rows, src) => { debts = { rows, at: new Date().toISOString(), src }; store.set('debts', JSON.stringify(debts)); };
  async function fetchDebtsFile() {
    const r = await fetch('data/debts.xlsx', { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    return parseDebts(await r.arrayBuffer());
  }
  const dayDiff = iso => { if (!iso) return null; const [y, m, d] = iso.split('-').map(Number); const t = new Date(); return Math.floor((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000); };
  const ago = n => n === null ? '' : n < 0 ? '' : n === 0 ? 'اليوم' : n === 1 ? 'أمس' : n === 2 ? 'قبل يومين' : n <= 10 ? `قبل ${n} أيام` : `قبل ${n} يوماً`;
  const showDate = iso => iso ? iso.split('-').reverse().join('/') : '—';
  const iqd = n => `${num(n)} IQD`;
  const remDays = d => { const n = dayDiff(d.pay); return n === null ? null : DEBT_LATE_DAYS - n; };   // المدة الباقية للدفع التالي = 30 يوماً من آخر دفع
  let ownerOpen = false;                                                                                    // إجمالي الديون مخفي حتى يُدخل المالك رمزه
  function renderDebts() {
    const q = norm($('#debtQ').value), sort = $('#debtSort').value;
    let list = debts.rows.filter(d => !q || norm(d.name).includes(q));
    const rk = d => { const r = remDays(d); return r === null ? 1e9 : r; };
    const by = { amount: (a, b) => b.debt - a.debt, name: (a, b) => a.name.localeCompare(b.name, 'ar'), rem: (a, b) => rk(a) - rk(b), pay: (a, b) => (b.pay || '').localeCompare(a.pay || '') }[sort];
    list = list.slice().sort(by);
    $('#debtTotal').textContent = ownerOpen ? iqd(debts.rows.reduce((a, d) => a + d.debt, 0)) : '••••••';
    $('#debtTotalBtn').textContent = ownerOpen ? 'إخفاء' : 'إظهار (المالك)';
    $('#debtCount').textContent = num(debts.rows.length);
    $('#debtInfo').textContent = debts.at ? `آخر تحديث: ${new Date(debts.at).toLocaleString('ar-IQ')} — ${debts.src === 'device' ? 'من ملف على جهازك' : 'من الموقع'}` : '';
    $('#debtList').innerHTML = list.length ? list.map(d => {
      const r = remDays(d), late = r !== null && r < 0, np = dayDiff(d.pay);
      const remTxt = r === null ? '—' : late ? `متأخر ${num(-r)} يوماً` : r === 0 ? 'ينتهي اليوم' : `${num(r)} يوماً`;
      return `<div class="debt${late ? ' late' : ''}">
        <div class="d-top"><b class="d-name">${esc(d.name)}</b><span class="d-amt">${iqd(d.debt)}</span></div>
        <div class="d-grid">
          <span>آخر دفع</span><b>${showDate(d.pay)}${ago(np) ? ` <small>${ago(np)}</small>` : ''}</b>
          <span>المدة الباقية للدفع</span><b class="${late ? 'd-red' : ''}">${remTxt}</b>
          <span>العنوان</span><b>${d.addr ? esc(d.addr) : '—'}</b>
        </div>${late ? `<div class="d-late">⚠ تجاوز مدة الدفع (${num(DEBT_LATE_DAYS)} يوماً من آخر دفع)</div>` : ''}</div>`;
    }).join('') : `<p class="hint" style="text-align:center;padding:24px 8px">${debts.rows.length ? 'لا توجد نتائج مطابقة' : 'لا توجد بيانات ديون بعد.<br>ضع الملف <b dir="ltr">data/debts.xlsx</b> على الموقع ثم اضغط «تحديث من الموقع»، أو اضغط «استيراد ملف إكسل» واختر الملف من جهازك.'}</p>`;
  }
  $('#debtTotalBtn').onclick = async () => {
    if (ownerOpen) { ownerOpen = false; renderDebts(); return; }
    if (OWNER_CODE && !(await askDialog({ title: 'إجمالي الديون', text: 'أدخل رمز المالك', input: true, validate: v => v === codeNorm(OWNER_CODE) || 'الرمز غير صحيح' }))) return;
    ownerOpen = true; renderDebts();
  };
  async function refreshDebts(manual) {
    try {
      const rows = await fetchDebtsFile(); saveDebts(rows, 'site'); renderDebts();
      if (manual) toast(`تم التحديث: ${num(rows.length)} زبون`);
    } catch (e) {
      if (manual) toast(String(e.message).startsWith('http') ? 'لم أجد الملف data/debts.xlsx على الموقع' : 'تعذّر قراءة الملف أو لا يوجد اتصال', 3500);
    }
  }
  $('#btnDebts').onclick = () => {
    $('#debtQ').value = ''; ownerOpen = false; renderDebts(); openSheet('debtSheet');
    if (!debts.src || debts.src === 'site') refreshDebts(false);        // الملف المستورد من الجهاز لا يُستبدل تلقائياً
  };
  $('#debtQ').addEventListener('input', renderDebts);
  $('#debtSort').addEventListener('change', renderDebts);
  $('#debtRefresh').onclick = () => refreshDebts(true);
  $('#debtImport').onclick = () => $('#debtFile').click();
  $('#debtFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const rows = parseDebts(await f.arrayBuffer()); saveDebts(rows, 'device'); renderDebts(); toast(`تم الاستيراد: ${num(rows.length)} زبون`); }
    catch { toast('تعذّر قراءة الملف — تأكد أنه بصيغة xlsx وبالأعمدة المطلوبة', 4000); }
  });
  window.__parseDebts = parseDebts;                                  // للفحص فقط

  window.__catalog = { state, apply, norm, stepCols, curCols };     // للفحص والاختبار فقط
})();
