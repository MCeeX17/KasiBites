import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { FIREBASE_CONFIG, ADMIN_EMAILS, SITE_URL } from './config.js';
import { CATEGORIES, INGREDIENTS, MENU, SPECIALS, SCHEDULE, STEPS } from './data.js';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'R ' + Number(n).toFixed(2);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lsGet = (k, f) => { try { return JSON.parse(localStorage.getItem('kb_' + k)) ?? f; } catch { return f; } };
const lsSet = (k, v) => { try { localStorage.setItem('kb_' + k, JSON.stringify(v)); } catch {} };
const siteBase = () => SITE_URL || (location.origin + location.pathname.replace(/index\.html$/, ''));

/* ---------- state ---------- */
const over = { menu: {}, ing: {}, spec: {} };           // admin overrides from Firestore (price + available)
const COLL = { menu: 'menu', ing: 'ingredients', spec: 'specials' };
let settings = { allowDineIn: true, allowTakeaway: true };
let reviews = [], orders = [];
let cart = lsGet('cart', []);
let selected = ['b-base', 'b-atchar', 'b-chips', 's-cap'];
let builderQty = 1, menuCat = 'all', isAdmin = false, currentSlip = null, countdown = null;
let trackUnsub = null, ordersUnsub = null, termSearch = '', period = 'today', customRange = null, pending = null, revRating = 5, deferredInstall = null;

const merged = (defs, ov) => defs.map(d => ({ ...d, ...(ov[d.id] || {}) }));
const getMenu = () => merged(MENU, over.menu);
const getIngs = () => merged(INGREDIENTS, over.ing);
const getSpecs = () => merged(SPECIALS, over.spec);
const on = x => x.available !== false;

/* ---------- toast ---------- */
function toast(msg, type = 'info') {
  const c = { error: 'border-brand-red text-brand-red', success: 'border-emerald-400 text-emerald-400' }[type] || 'border-brand-gold text-brand-gold';
  const t = document.createElement('div');
  t.className = `px-4 py-3 rounded-2xl bg-brand-surface border shadow-2xl text-xs font-semibold pointer-events-auto transition-all duration-300 translate-y-3 opacity-0 ${c}`;
  t.textContent = msg;
  $('toastNotificationBox').appendChild(t);
  requestAnimationFrame(() => t.classList.remove('translate-y-3', 'opacity-0'));
  setTimeout(() => { t.classList.add('opacity-0'); setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------- auth ---------- */
let authReadyResolve; const authReady = new Promise(r => authReadyResolve = r);
onAuthStateChanged(auth, u => {
  if (!u) { signInAnonymously(auth).catch(e => console.warn('Anonymous sign-in failed', e)); return; }
  if (!u.isAnonymous && !ADMIN_EMAILS.includes((u.email || '').toLowerCase())) {
    toast('That Google account is not approved for the kitchen terminal.', 'error'); signOut(auth); return;
  }
  isAdmin = !u.isAnonymous;
  if (isAdmin) startOrdersFeed(); else stopOrdersFeed();
  refreshTerminal();
  $('terminalWho').textContent = isAdmin ? 'Signed in as ' + u.email : 'Live queue, prices & store controls';
  authReadyResolve();
});

/* ---------- live data ---------- */
const warn = e => { console.warn(e); if (e.code === 'permission-denied') toast('Database rules not set up yet. See README step 4.', 'error'); };
function watchOverrides(kind) {
  onSnapshot(collection(db, COLL[kind]), snap => {
    over[kind] = {}; snap.forEach(d => { const { price, available } = d.data(); over[kind][d.id] = { ...(Number.isFinite(price) && { price }), ...(typeof available === 'boolean' && { available }) }; });
    renderCatalog();
  }, warn);
}
['menu', 'ing', 'spec'].forEach(watchOverrides);
onSnapshot(doc(db, 'settings', 'store'), s => {
  if (s.exists()) settings = { allowDineIn: s.data().allowDineIn !== false, allowTakeaway: s.data().allowTakeaway !== false };
  $('toggleDineInAllowed').checked = settings.allowDineIn; $('toggleTakeawayAllowed').checked = settings.allowTakeaway;
}, warn);
onSnapshot(query(collection(db, 'reviews'), orderBy('createdMs', 'desc'), limit(80)), s => {
  reviews = s.docs.map(d => d.data()); renderReviews(); renderMenu();
}, warn);
function startOrdersFeed() {
  if (ordersUnsub) return;
  ordersUnsub = onSnapshot(query(collection(db, 'orders'), orderBy('createdMs', 'desc'), limit(300)), s => {
    orders = s.docs.map(d => d.data()); renderOrdersTable(); renderAnalytics();
  }, warn);
}
function stopOrdersFeed() { ordersUnsub?.(); ordersUnsub = null; orders = []; }

/* ---------- opening hours ---------- */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function renderStatus() {
  const now = new Date(), s = SCHEDULE.find(x => x.day === DAYS[now.getDay()]);
  const m = t => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi; };
  const mins = now.getHours() * 60 + now.getMinutes();
  const open = s && mins >= m(s.open) && mins < m(s.close);
  $('storeStatusBadge').className = `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${open ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-brand-red/20 text-brand-red border-brand-red/30'}`;
  $('storeStatusBadge').innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-400 animate-pulse' : 'bg-brand-red'}"></span> ${open ? 'OPEN NOW' : 'CLOSED'}`;
  $('storeStatusTimeText').textContent = open ? 'Closes ' + s.close : 'Opens ' + (s && mins < m(s.open) ? 'today ' + s.open : 'tomorrow');
  $('weeklyScheduleGrid').innerHTML = SCHEDULE.map(i => {
    const t = i.day === DAYS[now.getDay()];
    return `<div class="p-3.5 rounded-2xl border text-center ${t ? 'bg-brand-gold/15 border-brand-gold shadow-glow-gold' : 'bg-brand-surface/60 border-brand-border'}">
      <div class="text-xs font-heading uppercase ${t ? 'text-brand-gold' : 'text-gray-300'}">${i.day}</div>
      <div class="text-xs font-mono font-bold mt-1 text-white">${i.open} - ${i.close}</div>${t ? '<span class="text-[9px] font-bold text-brand-gold uppercase">● Today</span>' : ''}</div>`;
  }).join('');
}

/* ---------- kota builder ---------- */
const LAYER = { // [background, height, width, radius]
  'b-base': ['linear-gradient(#b45309,#451a03)', 48, 224, '0 0 16px 16px'], 'b-atchar': ['linear-gradient(90deg,#92400e,#7c2d12,#92400e)', 15, 200, '9999px'],
  'b-chips': ['repeating-linear-gradient(80deg,#fbbf24 0 16px,#f59e0b 16px 30px)', 18, 200, '6px'], 'm-polony': ['#fb7185', 15, 190, '12px'],
  'm-vienna': ['linear-gradient(90deg,#dc2626,#be123c)', 18, 195, '9999px'], 'm-russian': ['linear-gradient(90deg,#991b1b,#7f1d1d,#991b1b)', 20, 205, '9999px'],
  'm-patty': ['#1c1917', 20, 205, '12px'], 'm-mince': ['#451a03', 16, 195, '8px'], 'c-cheese': ['#facc15', 11, 215, '2px'], 'c-egg': ['#fff', 18, 190, '9999px'],
  'c-tomato': ['#dc2626', 11, 180, '9999px'], 'c-lettuce': ['#22c55e', 13, 210, '8px'], 's-cap': ['linear-gradient(#d97706,#92400e)', 36, 215, '16px 16px 0 0']
};
function renderBuilder() {
  const list = getIngs();
  selected = selected.filter(id => { const i = list.find(x => x.id === id); return i && (on(i) || i.required); });
  ['foundation', 'meats', 'cheeses', 'sauces'].forEach(g => {
    $('ingGroup-' + g).innerHTML = list.filter(i => i.group === g).map(i => {
      const s = selected.includes(i.id), off = !on(i);
      return `<button type="button" class="ing ${s ? 'on' : ''}" data-ing="${i.id}" ${off ? 'disabled' : ''}>
        <div class="flex items-center justify-between w-full gap-1"><span class="text-xs font-bold leading-tight">${i.emoji} ${esc(i.name)}</span><i class="fa-solid ${s ? 'fa-circle-check text-brand-gold' : 'fa-circle-plus text-gray-600'} text-xs"></i></div>
        <span class="text-xs font-mono font-bold mt-2 ${off ? 'text-brand-red' : 'text-brand-gold'}">${off ? 'Sold out' : '+ ' + money(i.price)}</span></button>`;
    }).join('');
  });
  const act = list.filter(i => selected.includes(i.id)), single = act.reduce((a, i) => a + i.price, 0);
  $('visualStackContainer').innerHTML = act.map(i => {
    const [bg, h, w, r] = LAYER[i.id] || [i.color || '#999', 8, 180, '9999px'];
    return `<div class="stack-layer-anim my-0.5"><div class="flex items-center justify-center text-[9px] font-black uppercase tracking-wider shadow ${i.id === 'c-egg' ? 'text-gray-800' : 'text-white/85'}" style="background:${bg};height:${h}px;width:min(${w}px,85vw);border-radius:${r}">${h > 12 ? i.emoji + ' ' + esc(i.name) : ''}</div></div>`;
  }).join('');
  $('includedLayersPills').innerHTML = act.map(i => `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-card text-[10px] text-amber-300 border border-brand-border font-mono">${i.emoji} ${esc(i.name)}${i.required ? '' : `<button data-ing="${i.id}" class="text-gray-400 hover:text-red-400 ml-1"><i class="fa-solid fa-xmark"></i></button>`}</span>`).join('');
  $('singleKotaPriceTag').textContent = money(single);
  $('builderTotalPriceDisplay').textContent = money(single * builderQty);
  $('cuttingBoardLayerTag').textContent = act.length + ' Layers';
  $('qtyCountDisplay').textContent = builderQty;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ing]'); if (!b) return;
  const i = getIngs().find(x => x.id === b.dataset.ing);
  if (i?.required) return toast('The hollowed bread base is mandatory!', 'error');
  selected = selected.includes(i.id) ? selected.filter(x => x !== i.id) : [...selected, i.id];
  renderBuilder();
});
$('qtyMinusBtn').onclick = () => { if (builderQty > 1) { builderQty--; renderBuilder(); } };
$('qtyPlusBtn').onclick = () => { if (builderQty < 20) { builderQty++; renderBuilder(); } };
$('resetBuilderBtn').onclick = () => { selected = ['b-base', 'b-chips', 's-cap']; builderQty = 1; renderBuilder(); toast('Cutting board reset'); };
$('addCustomKotaBtn').onclick = () => {
  const act = getIngs().filter(i => selected.includes(i.id));
  addToCart('custom:' + selected.join(','), 'Custom Spatlho Stack', act.map(i => i.name).join(', '), act.reduce((a, i) => a + i.price, 0), builderQty);
  openCart();
};

/* ---------- menu & specials ---------- */
const avgFor = name => { const r = reviews.filter(x => x.meal === name); return r.length ? { avg: (r.reduce((a, x) => a + x.rating, 0) / r.length).toFixed(1), n: r.length } : null; };
const art = i => i.image ? `<img src="${esc(i.image)}" alt="">` : i.emoji;
function renderMenu() {
  $('menuFilterBar').innerHTML = [{ id: 'all', label: 'All Items', emoji: '🍽️' }, ...CATEGORIES].map(c => `<button class="chip ${menuCat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.emoji} ${c.label}</button>`).join('');
  $('menuCardsGrid').innerHTML = getMenu().filter(m => menuCat === 'all' || m.category === menuCat).map(m => {
    const r = avgFor(m.name), off = !on(m);
    return `<div class="panel p-5 shadow-xl hover:!border-brand-gold/50 transition-all flex flex-col justify-between ${off ? 'sold-out' : ''}">
      <div><div class="flex items-center justify-between mb-3">
        <span class="px-2.5 py-0.5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold text-[10px] font-bold uppercase font-mono">${esc(m.badge)}</span>
        <span class="text-xs text-amber-400 font-bold">${r ? `★ ${r.avg} <span class="text-gray-500 font-normal">(${r.n})</span>` : '<span class="text-gray-500 font-normal">New</span>'}</span></div>
        <div class="emoji-box mb-3">${art(m)}</div>
        <h3 class="font-heading text-2xl text-white tracking-wide">${esc(m.name)}</h3>
        <p class="text-xs text-gray-400 mt-1 leading-relaxed">${esc(m.desc)}</p></div>
      <div class="flex items-center justify-between pt-4 border-t border-brand-border mt-4">
        <div><span class="text-[10px] text-gray-500 font-mono block">PRICE</span><div class="font-heading text-3xl text-brand-gold">${money(m.price)}</div></div>
        <button class="btn-dark" data-add-menu="${m.id}" ${off ? 'disabled' : ''}>${off ? 'Sold out' : '🛍️ Add'}</button></div></div>`;
  }).join('');
}
function renderSpecials() {
  $('specialsCardsGrid').innerHTML = getSpecs().map(s => {
    const off = !on(s);
    return `<div class="panel !border-brand-red/40 p-6 shadow-xl relative flex flex-col justify-between hover:!border-brand-gold transition-all ${off ? 'sold-out' : ''}">
      <div class="absolute -top-3 right-6 bg-gradient-to-r from-brand-red to-brand-orange text-white text-[10px] font-black uppercase px-3 py-1 rounded-full">${esc(s.badge)}</div>
      <div><div class="text-3xl mb-2">${s.emoji}</div><h3 class="font-heading text-2xl text-white tracking-wide">${esc(s.title)}</h3><p class="text-xs text-gray-400 mt-1 mb-5">${esc(s.subtitle)}</p></div>
      <div class="flex items-center justify-between pt-3 border-t border-brand-border"><div><span class="text-xs text-gray-500 line-through">R ${s.oldPrice}</span><div class="font-heading text-3xl text-brand-gold">${money(s.price)}</div></div>
      <button class="btn-gold !py-2" data-add-spec="${s.id}" ${off ? 'disabled' : ''}>${off ? 'Sold out' : 'Claim Deal'}</button></div></div>`;
  }).join('');
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-cat]'); if (c) { menuCat = c.dataset.cat; renderMenu(); }
  const m = e.target.closest('[data-add-menu]'); if (m) { const i = getMenu().find(x => x.id === m.dataset.addMenu); addToCart('menu:' + i.id, i.name, i.desc, i.price); }
  const s = e.target.closest('[data-add-spec]'); if (s) { const i = getSpecs().find(x => x.id === s.dataset.addSpec); addToCart('spec:' + i.id, i.title, i.subtitle, i.price); }
});
function renderCatalog() { renderBuilder(); renderMenu(); renderSpecials(); fillReviewMeals(); if (!$('pricesList').contains(document.activeElement)) renderPrices(); }

/* ---------- cart & checkout ---------- */
function addToCart(key, name, desc, unit, qty = 1) {
  const l = cart.find(x => x.key === key && x.unit === unit);
  l ? l.qty += qty : cart.push({ key, name, desc, unit, qty });
  saveCart(); toast(name + ' added!', 'success');
}
const cartTotal = () => cart.reduce((a, l) => a + l.unit * l.qty, 0);
function saveCart() { lsSet('cart', cart); renderCart(); }
function renderCart() {
  $('cartCountBadge').textContent = cart.reduce((a, l) => a + l.qty, 0);
  $('cartDrawerTotalDisplay').textContent = money(cartTotal());
  $('cartItemsListContainer').innerHTML = cart.length ? cart.map((l, i) => `
    <div class="bg-brand-dark p-3.5 rounded-2xl border border-brand-border flex items-start justify-between gap-3">
      <div class="min-w-0"><h4 class="font-heading text-xl text-white">${esc(l.name)}</h4><p class="text-[11px] text-gray-400 line-clamp-2">${esc(l.desc)}</p><span class="font-mono text-xs font-bold text-brand-gold mt-1 block">${money(l.unit * l.qty)}</span></div>
      <div class="flex flex-col items-end gap-2"><button data-rm="${i}" class="text-gray-500 hover:text-red-400"><i class="fa-solid fa-trash text-xs"></i></button>
        <div class="flex items-center bg-brand-surface rounded-lg border border-brand-border"><button data-qty="${i}" data-d="-1" class="w-7 h-7">-</button><span class="w-6 text-center font-mono text-xs text-brand-gold">${l.qty}</span><button data-qty="${i}" data-d="1" class="w-7 h-7">+</button></div></div></div>`).join('')
    : `<div class="text-center py-16 text-gray-500 space-y-2"><div class="text-4xl">🥖</div><p class="text-sm font-semibold">Your bag is empty.</p><p class="text-xs">Add a spatlho, spykos or full meal!</p></div>`;
}
document.addEventListener('click', e => {
  const r = e.target.closest('[data-rm]'), q = e.target.closest('[data-qty]');
  if (r) { cart.splice(+r.dataset.rm, 1); saveCart(); }
  if (q) { const l = cart[+q.dataset.qty]; l.qty = Math.max(1, Math.min(20, l.qty + +q.dataset.d)); saveCart(); }
});
const openCart = () => { $('cartDrawerBackdrop').classList.remove('hidden'); setTimeout(() => $('cartDrawer').classList.remove('translate-x-full'), 10); };
const closeCart = () => { $('cartDrawer').classList.add('translate-x-full'); setTimeout(() => $('cartDrawerBackdrop').classList.add('hidden'), 300); };
$('openCartBtn').onclick = openCart; $('closeCartBtn').onclick = closeCart;
$('cartDrawerBackdrop').onclick = e => { if (e.target.id === 'cartDrawerBackdrop') closeCart(); };

function setDining(v) {
  [['DINE IN', 'optDineInLabel'], ['TAKEAWAY', 'optTakeawayLabel']].forEach(([val, id]) => {
    $(id).className = `flex flex-col items-center p-3 rounded-2xl border-2 cursor-pointer text-center ${v === val ? 'border-brand-gold bg-brand-gold/15' : 'border-brand-border bg-brand-dark'}`;
  });
  document.querySelector(`input[name="diningType"][value="${v}"]`).checked = true;
}
document.querySelectorAll('input[name="diningType"]').forEach(r => r.onchange = e => setDining(e.target.value));
$('cartProceedToOrderBtn').onclick = () => {
  if (!cart.length) return toast('Your bag is empty! Add something first.', 'error');
  if (!settings.allowDineIn && !settings.allowTakeaway) return toast('Orders are paused for a moment. Please check back soon.', 'error');
  closeCart();
  $('checkoutModalTotal').textContent = money(cartTotal());
  const d = $('optDineInLabel'), t = $('optTakeawayLabel'), n = $('disabledDiningNotice');
  d.style.cssText = settings.allowDineIn ? '' : 'opacity:.4;pointer-events:none';
  t.style.cssText = settings.allowTakeaway ? '' : 'opacity:.4;pointer-events:none';
  setDining(settings.allowDineIn ? 'DINE IN' : 'TAKEAWAY');
  n.classList.toggle('hidden', settings.allowDineIn && settings.allowTakeaway);
  n.textContent = !settings.allowDineIn ? 'Dine-In seating is currently full. Takeaway only.' : 'Takeaway is paused due to volume. Dine-In only.';
  $('checkoutModal').classList.remove('hidden');
};
$('closeCheckoutModalBtn').onclick = () => $('checkoutModal').classList.add('hidden');

const genId = () => 'KB-' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
$('checkoutSubmitForm').onsubmit = async e => {
  e.preventDefault();
  const whatsapp = $('custWhatsappInput').value.trim();
  if (whatsapp.replace(/\D/g, '').length < 9) return toast('Please enter a valid WhatsApp number', 'error');
  const now = new Date(), exp = new Date(now.getTime() + 2 * 3600e3), tm = d => d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  const order = {
    id: genId(), customer: $('custNameInput').value.trim(), whatsapp, diningType: document.querySelector('input[name="diningType"]:checked').value,
    items: cart.map(l => ({ name: l.name, qty: l.qty, total: l.unit * l.qty })), total: cartTotal(),
    date: ymd(now), time: tm(now), createdMs: now.getTime(), step: 0, statusText: STEPS[0].status, expiresAtMs: exp.getTime(), expiryTime: tm(exp)
  };
  const btn = $('placeOrderBtn'); btn.disabled = true;
  try {
    await authReady; await setDoc(doc(db, 'orders', order.id), order);
  } catch (err) { console.error(err); btn.disabled = false; return toast('Could not send your order. Check your connection and try again.', 'error'); }
  btn.disabled = false;
  cart = []; saveCart(); $('checkoutModal').classList.add('hidden'); e.target.reset();
  lsSet('lastOrder', order.id); showSlip(order);
};

/* ---------- slip ---------- */
const itemLine = i => `${i.name}${i.qty > 1 ? ' (x' + i.qty + ')' : ''}`;
function showSlip(o) {
  currentSlip = o;
  $('slipTicketId').textContent = '#' + o.id; $('slipDateTime').textContent = `${o.date} ${o.time}`; $('slipCustomerName').textContent = o.customer;
  $('slipDiningMode').textContent = o.diningType; $('slipWhatsappNum').textContent = o.whatsapp; $('slipTotalAmount').textContent = money(o.total);
  $('slipExpiryTimeLine').textContent = `Expires at ${o.expiryTime}. Present slip or WhatsApp alert at counter.`;
  $('slipItemsList').innerHTML = o.items.map(i => `<div>• ${esc(itemLine(i))}</div>`).join('');
  clearInterval(countdown); const clk = $('countdownTimerDisplay'); clk.className = 'font-mono text-base font-bold text-emerald-400';
  const tick = () => {
    const d = o.expiresAtMs - Date.now();
    if (d <= 0) { clk.textContent = 'EXPIRED'; clk.className = 'font-mono text-base font-bold text-brand-red'; return clearInterval(countdown); }
    const p = n => String(n).padStart(2, '0');
    clk.textContent = `${p(Math.floor(d / 36e5))}h ${p(Math.floor(d % 36e5 / 6e4))}m ${p(Math.floor(d % 6e4 / 1e3))}s`;
  };
  tick(); countdown = setInterval(tick, 1000);
  $('orderSuccessModal').classList.remove('hidden');
}
$('closeOrderSuccessModalBtn').onclick = () => $('orderSuccessModal').classList.add('hidden');
$('trackThisOrderBtn').onclick = () => { $('orderSuccessModal').classList.add('hidden'); $('trackerSearchInput').value = currentSlip.id; trackOrder(currentSlip.id); $('tracker').scrollIntoView(); };
$('saveSlipImageBtn').onclick = () => {
  toast('Capturing receipt...');
  html2canvas($('thermalDigitalSlip'), { scale: 2, backgroundColor: '#fff', logging: false }).then(c => {
    const a = document.createElement('a'); a.download = `KasiBites_Receipt_${currentSlip.id}.png`; a.href = c.toDataURL('image/png'); a.click(); toast('Receipt saved!', 'success');
  }).catch(() => toast('Screenshot failed. Try Download PDF.', 'error'));
};
$('saveSlipPdfBtn').onclick = () => {
  if (!window.jspdf) return toast('PDF engine still loading, retry.', 'error');
  const o = currentSlip, doc = new window.jspdf.jsPDF({ unit: 'mm', format: [80, 160] });
  const T = (t, x, y, o2) => doc.text(t, x, y, o2);
  doc.setFont('courier', 'bold'); doc.setFontSize(16); T('KASI BITES', 40, 12, { align: 'center' });
  doc.setFont('courier', 'normal'); doc.setFontSize(8); T('AUTHENTIC SPATLHO & SPYKOS', 40, 17, { align: 'center' }); T('OFFICIAL COLLECTION SLIP', 40, 21, { align: 'center' });
  doc.line(6, 24, 74, 24); doc.setFont('courier', 'bold'); doc.setFontSize(10); T('TICKET: #' + o.id, 6, 30);
  doc.setFont('courier', 'normal'); doc.setFontSize(8); T(`DATE: ${o.date} ${o.time}`, 6, 35); T('NAME: ' + o.customer, 6, 40); T('DINING: ' + o.diningType, 6, 45); T('WHATSAPP: ' + o.whatsapp, 6, 50);
  doc.line(6, 53, 74, 53); doc.setFont('courier', 'bold'); T('ITEMS ORDERED:', 6, 58); doc.setFont('courier', 'normal');
  let y = 64; o.items.forEach(i => { const l = doc.splitTextToSize('- ' + itemLine(i), 68); T(l, 6, y); y += l.length * 4.5; });
  doc.line(6, y + 2, 74, y + 2); y += 8; doc.setFont('courier', 'bold'); doc.setFontSize(11); T('TOTAL: ' + money(o.total), 6, y); y += 8;
  doc.rect(6, y, 68, 14); doc.setFontSize(7); T('NOTICE: VALID FOR 2 HOURS', 40, y + 5, { align: 'center' }); doc.setFont('courier', 'normal'); T(`Expires at ${o.expiryTime}. Show at counter.`, 40, y + 10, { align: 'center' });
  doc.setFont('courier', 'bold'); doc.setFontSize(7); T('HOPE YOU ENJOY YOUR MEAL', 40, y + 24, { align: 'center' });
  doc.save(`KasiBites_Receipt_${o.id}.pdf`); toast('PDF downloaded!', 'success');
};

/* ---------- tracker ---------- */
function renderTracker(o) {
  const c = $('trackerOrderDetailsContainer');
  if (!o) { c.innerHTML = `<div class="text-center py-10 text-gray-500"><div class="text-3xl">🧾</div><p class="text-xs mt-1">No order loaded. Enter your Order ID above.</p></div>`; return; }
  c.innerHTML = `<div class="bg-brand-dark p-5 rounded-2xl border border-brand-border space-y-5">
    <div class="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b border-brand-border gap-2">
      <div><span class="text-[10px] uppercase font-mono text-gray-400">Order ticket</span><h4 class="font-heading text-2xl text-brand-gold">#${esc(o.id)} • ${esc(o.customer)}</h4></div>
      <div class="sm:text-right"><span class="text-[10px] text-gray-500">${esc(o.time)}</span><div class="text-xs font-mono font-bold ${o.step === 4 ? 'text-blue-400' : 'text-emerald-400'}">${esc(o.statusText)}</div></div></div>
    <div class="grid grid-cols-1 sm:grid-cols-5 gap-2.5">${STEPS.map((s, i) => {
      const past = i < o.step, cur = i === o.step;
      const dot = past ? 'bg-emerald-500 text-brand-dark border-emerald-400' : cur ? (o.step === 4 ? 'bg-blue-500 text-white border-blue-400' : 'bg-brand-gold text-brand-dark border-amber-300 animate-pulse') : 'bg-brand-card text-gray-600 border-brand-border';
      return `<div class="p-2.5 rounded-xl ${cur ? 'bg-brand-gold/10 border border-brand-gold/30' : 'bg-brand-surface'} flex sm:flex-col items-center sm:items-start gap-2.5">
        <div class="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${dot}">${past ? '✓' : i + 1}</div>
        <div><span class="text-xs font-bold text-white uppercase block">${s.name}</span><span class="text-[10px] text-gray-400">${s.desc}</span></div></div>`;
    }).join('')}</div>
    <div class="flex justify-between items-center text-xs pt-3 border-t border-brand-border text-gray-400"><div><strong class="text-white">Items:</strong> ${esc(o.items.map(itemLine).join(', '))}</div><div class="font-heading text-2xl text-brand-gold">${money(o.total)}</div></div></div>`;
}
async function trackOrder(id) {
  trackUnsub?.(); await authReady;
  trackUnsub = onSnapshot(doc(db, 'orders', id), s => { if (s.exists()) renderTracker(s.data()); else { renderTracker(null); toast(`Order #${id} not found`, 'error'); } }, () => toast('Could not load that order.', 'error'));
}
$('trackerSearchBtn').onclick = () => { const q = $('trackerSearchInput').value.trim().toUpperCase(); q ? trackOrder(q) : toast('Please type your Order ID', 'error'); };

/* ---------- reviews ---------- */
const ago = ms => { const m = Math.floor((Date.now() - ms) / 6e4); return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago'; };
const stars = (n, cls = 'text-xs') => [1, 2, 3, 4, 5].map(i => `<i class="fa-solid fa-star ${i <= n ? 'text-amber-400' : 'text-gray-700'} ${cls}"></i>`).join('');
function renderReviews() {
  $('reviewsSummary').textContent = reviews.length ? `★ ${(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)} average from ${reviews.length} reviews` : 'No reviews yet. Be the first to rate a meal!';
  $('communityReviewsFeed').innerHTML = reviews.map(r => `<div class="panel !rounded-2xl p-4">
    <div class="flex justify-between items-start mb-2"><div><h4 class="font-bold text-xs text-white">${esc(r.author)}</h4><span class="text-[11px] text-brand-gold">${esc(r.meal)}</span></div>
    <div class="text-right"><div>${stars(r.rating)}</div><span class="text-[10px] text-gray-500 font-mono">${ago(r.createdMs)}</span></div></div>
    ${r.comment ? `<p class="text-xs text-gray-300 italic">"${esc(r.comment)}"</p>` : ''}</div>`).join('');
}
function starRow(el, init, cb) {
  el.innerHTML = [1, 2, 3, 4, 5].map(i => `<i class="fa-solid fa-star star ${i <= init ? 'on' : ''}" data-v="${i}"></i>`).join('');
  el.onclick = e => { const v = +e.target.dataset.v; if (!v) return; cb(v); el.querySelectorAll('.star').forEach(s => s.classList.toggle('on', +s.dataset.v <= v)); };
}
const fillReviewMeals = () => { const sel = $('revMeal'), cur = sel.value; sel.innerHTML = ['Custom Spatlho Stack', ...getMenu().map(m => m.name)].map(n => `<option>${esc(n)}</option>`).join(''); if (cur) sel.value = cur; };
starRow($('starRatingBox'), 5, v => revRating = v);
$('reviewSubmitForm').onsubmit = async e => {
  e.preventDefault(); await authReady;
  try {
    await setDoc(doc(collection(db, 'reviews')), { author: $('revName').value.trim(), meal: $('revMeal').value, rating: revRating, comment: $('revComment').value.trim(), createdMs: Date.now() });
    e.target.reset(); toast('Thank you for your rating! Enkosi!', 'success');
  } catch { toast('Could not post your review. Try again.', 'error'); }
};

/* rate-by-link: ?rate=KB-XXXXXX (sent in the WhatsApp message) */
async function openRateFromLink(id) {
  await authReady;
  let snap; try { snap = await getDoc(doc(db, 'orders', id)); } catch { return toast('Could not open your rating link.', 'error'); }
  if (!snap.exists()) return toast('We could not find that order.', 'error');
  const o = snap.data(), picks = o.items.map(() => 5), notes = [];
  $('rateSubtitle').textContent = `Hi ${o.customer.split(' ')[0]}, how was your meal? (Order #${o.id})`;
  $('rateItems').innerHTML = o.items.map((it, i) => `<div class="bg-brand-dark p-3 rounded-2xl border border-brand-border space-y-2"><div class="text-sm font-bold text-white">${esc(it.name)}</div><div class="flex gap-2 text-2xl" id="rs${i}"></div><input class="field" id="rc${i}" maxlength="400" placeholder="Say something about it (optional)"></div>`).join('');
  o.items.forEach((_, i) => starRow($('rs' + i), 5, v => picks[i] = v));
  $('rateModal').classList.remove('hidden');
  $('submitRatingsBtn').onclick = async () => {
    try {
      await Promise.all(o.items.map((it, i) => setDoc(doc(db, 'reviews', `${o.id}_${i}`), { author: o.customer.split(' ')[0], meal: it.name, rating: picks[i], comment: $('rc' + i).value.trim(), createdMs: Date.now(), orderId: o.id })));
      toast('Thanks for rating! Enkosi! 🤜🤛', 'success'); $('rateModal').classList.add('hidden'); history.replaceState(null, '', location.pathname);
    } catch { toast('This order has already been rated. Thank you!', 'error'); }
  };
}
$('closeRateModalBtn').onclick = () => $('rateModal').classList.add('hidden');

/* ---------- kitchen terminal ---------- */
let taps = 0, tapTimer;
$('stealthTriggerBtn').onclick = () => {
  if (++taps === 1) tapTimer = setTimeout(() => taps = 0, 1500);
  if (taps >= 3) { clearTimeout(tapTimer); taps = 0; $('stealthTerminalModal').classList.remove('hidden'); refreshTerminal(); }
};
function refreshTerminal() {
  $('terminalLockScreen').classList.toggle('hidden', isAdmin);
  $('terminalMainContent').classList.toggle('hidden', !isAdmin);
  $('signOutBtn').classList.toggle('hidden', !isAdmin);
  if (isAdmin) { renderOrdersTable(); renderAnalytics(); renderPrices(); }
}
$('closeTerminalModalBtn').onclick = () => $('stealthTerminalModal').classList.add('hidden');
$('googleAuthBtn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => e.code !== 'auth/popup-closed-by-user' && toast('Google sign-in failed: ' + e.code, 'error'));
$('signOutBtn').onclick = () => signOut(auth);
document.querySelectorAll('.terminal-tab-btn').forEach(t => t.onclick = () => {
  document.querySelectorAll('.terminal-tab-btn').forEach(b => b.className = 'terminal-tab-btn pb-3 text-gray-400 hover:text-white');
  t.className = 'terminal-tab-btn pb-3 border-b-2 border-brand-gold text-brand-gold';
  ['Orders', 'Prices', 'Analytics', 'Controls'].forEach(n => $('terminalTab' + n).classList.toggle('hidden', t.dataset.tab !== n.toLowerCase()));
});
$('terminalSearchInput').oninput = e => { termSearch = e.target.value.trim().toLowerCase(); renderOrdersTable(); };

function renderOrdersTable() {
  $('queueBadgeCount').textContent = orders.filter(o => o.step < 4).length;
  const list = orders.filter(o => !termSearch || o.id.toLowerCase().includes(termSearch) || o.customer.toLowerCase().includes(termSearch));
  $('terminalFilterCount').textContent = termSearch ? `Showing ${list.length} of ${orders.length}` : `${orders.length} total orders`;
  $('terminalOrdersTableBody').innerHTML = list.length ? list.map(o => `<tr class="${o.step === 4 ? 'opacity-60' : ''}">
    <td class="py-3 px-3.5"><div class="text-xs font-bold text-white">${esc(o.customer)}</div><div class="text-[10px] text-gray-400 font-mono">${esc(o.whatsapp)}</div></td>
    <td class="py-3 px-3 font-mono font-bold text-brand-gold whitespace-nowrap">#${esc(o.id)}</td>
    <td class="py-3 px-3"><span class="px-2 py-0.5 rounded-md font-bold text-[11px] ${o.diningType === 'DINE IN' ? 'bg-blue-500/15 text-blue-400' : 'bg-brand-orange/15 text-brand-orange'}">${esc(o.diningType)}</span></td>
    <td class="py-3 px-3 text-[11px] max-w-[200px]">${esc(o.items.map(itemLine).join(', '))}</td>
    <td class="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">${money(o.total)}</td>
    <td class="py-3 px-3"><select data-stage="${o.id}" ${o.step === 4 ? 'disabled' : ''} class="field !w-auto !py-1.5 font-mono text-brand-gold">${['0: Received', '1: Frying / Cooking', '2: Stacking / Cheeses', '3: Ready For Collection', '4: Collected / Finished'].map((l, i) => `<option value="${i}" ${o.step === i ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
    <td class="py-3 px-3 text-center"><button data-wa="${o.id}" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-brand-dark font-bold rounded-lg text-xs"><i class="fa-brands fa-whatsapp"></i> Alert + Rate link</button></td></tr>`).join('')
    : `<tr><td colspan="7" class="py-8 text-center text-gray-500">No orders found.</td></tr>`;
}
const setStage = (id, step) => updateDoc(doc(db, 'orders', id), { step, statusText: STEPS[step].status }).catch(() => toast('Could not update order.', 'error'));
document.addEventListener('change', e => {
  const s = e.target.closest('[data-stage]'); if (!s) return;
  const o = orders.find(x => x.id === s.dataset.stage), step = +s.value;
  if (step === 4) { pending = o; $('confirmOrderNumBadge').textContent = '#' + o.id; $('confirmCustomerNameBadge').textContent = o.customer; $('collectedConfirmModal').classList.remove('hidden'); }
  else setStage(o.id, step);
});
$('cancelCollectedConfirmBtn').onclick = () => { $('collectedConfirmModal').classList.add('hidden'); pending = null; renderOrdersTable(); };
$('executeCollectedConfirmBtn').onclick = async () => { await setStage(pending.id, 4); $('collectedConfirmModal').classList.add('hidden'); toast('Order marked as collected', 'success'); pending = null; };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-wa]'); if (!b) return;
  const o = orders.find(x => x.id === b.dataset.wa);
  let p = o.whatsapp.replace(/\D/g, ''); p = p.startsWith('0') ? '27' + p.slice(1) : p.startsWith('27') ? p : '27' + p;
  const msg = `Dear ${o.customer} (Order #${o.id}), your meal at Kasi Bites is fresh, hot & ready for collection! 🍔🔥\n\n🧾 ${o.items.map(itemLine).join(', ')}\n\n⭐ Enjoyed it? Rate your meal here:\n${siteBase()}?rate=${o.id}\n\nHope you enjoy your meal! 🤜🤛`;
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank');
});

/* analytics */
const PERIODS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 Days'], ['month', 'Last 30 Days']];
function renderAnalytics() {
  $('analyticsPeriodFilterGroup').innerHTML = PERIODS.map(([k, l]) => `<button data-period="${k}" class="px-3 py-1.5 rounded-lg ${!customRange && period === k ? 'bg-brand-gold text-brand-dark' : 'bg-brand-surface text-gray-300 hover:bg-brand-card'}">${l}</button>`).join('');
  const day = n => ymd(new Date(Date.now() - n * 864e5));
  const [a, b] = customRange || { today: [day(0), day(0)], yesterday: [day(1), day(1)], week: [day(6), day(0)], month: [day(29), day(0)] }[period];
  const f = orders.filter(o => o.date >= a && o.date <= b), rev = f.reduce((s, o) => s + o.total, 0), counts = {};
  f.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + i.qty));
  $('kpiRevenue').textContent = money(rev); $('kpiMealsCount').textContent = Object.values(counts).reduce((s, n) => s + n, 0); $('kpiAvgValue').textContent = money(f.length ? rev / f.length : 0);
  const top = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 6);
  $('analyticsTopMealsList').innerHTML = top.length ? top.map(([n, c]) => `<div class="flex justify-between bg-brand-surface p-2.5 rounded-xl border border-brand-border"><span class="text-gray-300 font-semibold truncate">${esc(n)}</span><span class="font-mono text-brand-gold font-bold">${c} sold</span></div>`).join('') : '<span class="text-gray-500">No sales recorded for this period.</span>';
}
document.addEventListener('click', e => { const b = e.target.closest('[data-period]'); if (b) { period = b.dataset.period; customRange = null; renderAnalytics(); } });
$('applyCustomDateBtn').onclick = () => { const a = $('analyticsDateFrom').value, b = $('analyticsDateTo').value; if (!a || !b) return toast('Pick both dates', 'error'); customRange = [a, b]; renderAnalytics(); };

/* menu & prices editor (on/off + price, with search) */
function renderPrices() {
  const q = $('priceSearchInput').value.trim().toLowerCase(), catName = id => CATEGORIES.find(c => c.id === id)?.label || '';
  const groups = [
    ['🍽️ Meals, Spykos & Chips', 'menu', getMenu().map(m => ({ ...m, label: m.name, sub: catName(m.category) }))],
    ['🥖 Kota Ingredients', 'ing', getIngs().map(i => ({ ...i, label: i.name, sub: i.group }))],
    ['🏷️ Specials', 'spec', getSpecs().map(s => ({ ...s, label: s.title, sub: 'special' }))]
  ];
  $('pricesList').innerHTML = groups.map(([title, kind, items]) => {
    const rows = items.filter(i => !q || (i.label + ' ' + i.sub).toLowerCase().includes(q));
    if (!rows.length) return '';
    return `<div><h5 class="text-xs font-bold uppercase text-brand-gold font-mono mb-2">${title}</h5><div class="space-y-2">${rows.map(i => `
      <div class="flex items-center gap-3 p-2.5 rounded-xl bg-brand-dark border border-brand-border ${on(i) ? '' : 'opacity-60'}">
        <span class="text-xl">${i.emoji}</span>
        <div class="flex-1 min-w-0"><div class="text-xs font-bold text-white truncate">${esc(i.label)}</div><div class="text-[10px] text-gray-500 font-mono">${esc(i.sub)}${on(i) ? '' : ' • OFF'}</div></div>
        <label class="switch" title="Turn on/off"><input type="checkbox" data-kind="${kind}" data-id="${i.id}" data-f="available" ${on(i) ? 'checked' : ''}><span></span></label>
        <div class="flex items-center gap-1"><span class="text-xs text-gray-400">R</span><input type="number" min="0" step="1" value="${i.price}" data-kind="${kind}" data-id="${i.id}" data-f="price" class="field !w-20 !py-1.5 font-mono"></div></div>`).join('')}</div></div>`;
  }).join('') || '<p class="text-xs text-gray-500 text-center py-6">Nothing matches that search.</p>';
}
$('priceSearchInput').oninput = renderPrices;
$('pricesList').onchange = async e => {
  const t = e.target, { kind, id, f } = t.dataset; if (!f) return;
  const val = f === 'price' ? Number(t.value) : t.checked;
  if (f === 'price' && (!Number.isFinite(val) || val < 0 || t.value === '')) { toast('Enter a valid price', 'error'); return renderPrices(); }
  try { await setDoc(doc(db, COLL[kind], id), { [f]: val }, { merge: true }); toast(f === 'price' ? `Price saved: ${money(val)}` : `Turned ${val ? 'ON' : 'OFF'}`, 'success'); }
  catch { toast('Could not save. Are you signed in as a manager?', 'error'); }
};

/* store controls + flyer */
const saveSetting = (k, v) => setDoc(doc(db, 'settings', 'store'), { [k]: v }, { merge: true }).then(() => toast(`${k === 'allowDineIn' ? 'Dine-in' : 'Takeaway'} is now ${v ? 'ENABLED' : 'PAUSED'}`)).catch(() => toast('Could not save setting.', 'error'));
$('toggleDineInAllowed').onchange = e => saveSetting('allowDineIn', e.target.checked);
$('toggleTakeawayAllowed').onchange = e => saveSetting('allowTakeaway', e.target.checked);
$('printableTableQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(siteBase())}`;
$('printFlyerBtn').onclick = () => {
  const c = document.createElement('div'); c.id = 'flyerClone'; c.innerHTML = $('flyerPrint').innerHTML; document.body.appendChild(c);
  window.addEventListener('afterprint', () => c.remove(), { once: true }); window.print();
};

/* ---------- drawer, install, splash ---------- */
const mb = $('mobileDrawerBackdrop'), md = $('mobileDrawer');
$('openMobileDrawerBtn').onclick = () => { mb.classList.remove('hidden'); setTimeout(() => md.classList.remove('translate-x-full'), 10); };
const closeNav = () => { md.classList.add('translate-x-full'); setTimeout(() => mb.classList.add('hidden'), 300); };
$('closeMobileDrawerBtn').onclick = closeNav; mb.onclick = e => { if (e.target === mb) closeNav(); };
document.querySelectorAll('.mobile-nav-link').forEach(l => l.onclick = closeNav);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
$('openInstallModalBtn').onclick = () => $('installAppModal').classList.remove('hidden');
$('drawerInstallBtn').onclick = () => { closeNav(); $('installAppModal').classList.remove('hidden'); };
$('closeInstallModalBtn').onclick = () => $('installAppModal').classList.add('hidden');
$('pwaTriggerInstallBtn').onclick = async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast('Use your browser menu: "Add to Home screen"'); };

setTimeout(() => { $('splash').classList.add('out'); setTimeout(() => $('splash').remove(), 600); }, 2400);

/* ---------- boot ---------- */
renderStatus(); setInterval(renderStatus, 60000);
renderCatalog(); renderReviews(); renderCart(); renderTracker(null);
const rateId = new URLSearchParams(location.search).get('rate');
if (rateId) openRateFromLink(rateId.toUpperCase());
