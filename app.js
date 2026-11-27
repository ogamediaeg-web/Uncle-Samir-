const STORAGE_KEY = "uncle_samir_menu_v1";
const AUTH_KEY = "uncle_samir_admin_logged";

let state = loadState();
let currentLang = "ar";
let activeCategory = "all";
let searchQuery = "";
let cart = [];
let currentModalItem = null;
let modalQty = 1;
let selectedOrderType = "delivery";

let lastActionLock = false;
let lastOrderHash = "";

function lockAction(ms = 600) {
  if (lastActionLock) return false;
  lastActionLock = true;
  setTimeout(() => { lastActionLock = false; }, ms);
  return true;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

let isApplyingRemote = false;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!isApplyingRemote && window.firebaseSync && typeof window.firebaseSync.saveToCloud === "function") {
    window.firebaseSync.saveToCloud(state);
  }
}

window.onInitialCloudLoad = function(remoteData) {
  if (!remoteData || !remoteData.items || !remoteData.categories) return;
  isApplyingRemote = true;
  state = remoteData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderBanners();
  renderCategories();
  renderMenu();
  renderBranches();
  renderCartUI();
  if (isAdminLoggedIn() && !document.getElementById("dashboard-modal").classList.contains("hidden")) {
    renderDashItems();
    renderDashCategories();
    renderDashZones();
    renderDashBranches();
    renderDashOrders();
    loadSettingsToDash();
  }
  isApplyingRemote = false;
};

function showToast(msg) {
  const box = document.getElementById("toast-box");
  box.textContent = msg;
  box.classList.remove("hidden");
  clearTimeout(box._timer);
  box._timer = setTimeout(() => box.classList.add("hidden"), 2500);
}

function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });

  const dict = I18N[lang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });

  updateAdminButtonLabel();
  renderBanners();
  renderCategories();
  renderMenu();
  renderBranches();
  renderCartUI();
}

function renderBanners() {
  const promoBanner = document.getElementById("promo-banner");
  const promoText = document.getElementById("promo-text");
  if (state.settings.promoActive && state.settings.promoText.trim()) {
    promoText.textContent = state.settings.promoText;
    promoBanner.classList.remove("hidden");
  } else {
    promoBanner.classList.add("hidden");
  }

  const statusBanner = document.getElementById("status-banner");
  const statusText = document.getElementById("status-text");
  const dict = I18N[currentLang];
  statusBanner.classList.remove("hidden", "closed");
  if (state.settings.status === "busy") {
    statusText.textContent = dict.statusBusyMsg;
  } else if (state.settings.status === "closed") {
    statusText.textContent = dict.statusClosedMsg;
    statusBanner.classList.add("closed");
  } else {
    statusBanner.classList.add("hidden");
  }

  document.getElementById("header-hotline").textContent = state.settings.hotline || "17205";
  const heroCall = document.getElementById("hero-call-btn");
  heroCall.href = `tel:${state.settings.hotline || "17205"}`;
  heroCall.textContent = `📞 ${state.settings.hotline || "17205"}`;
}

function renderCategories() {
  const tabs = document.getElementById("category-tabs");
  const dict = I18N[currentLang];
  let html = `<button type="button" class="cat-pill ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">${dict.allCat}</button>`;
  state.categories.forEach(cat => {
    const label = cat[currentLang] || cat.ar;
    html += `<button type="button" class="cat-pill ${activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">${label}</button>`;
  });
  tabs.innerHTML = html;

  tabs.querySelectorAll(".cat-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderCategories();
      renderMenu();
    });
  });
}

function renderMenu() {
  const wrapper = document.getElementById("menu-sections-wrapper");
  const dict = I18N[currentLang];
  const q = searchQuery.trim().toLowerCase();

  const catsToShow = activeCategory === "all"
    ? state.categories
    : state.categories.filter(c => c.id === activeCategory);

  let html = "";
  catsToShow.forEach(cat => {
    const catItems = state.items.filter(item => {
      if (item.cat !== cat.id) return false;
      if (!q) return true;
      return (item.ar + " " + (item.en || "") + " " + (item.fr || "") + " " + (item.descAr || "")).toLowerCase().includes(q);
    });

    if (catItems.length === 0) return;

    const catTitle = cat[currentLang] || cat.ar;
    html += `
      <section class="menu-section-block">
        <div class="cat-banner-header">
          <div>
            <h3>${catTitle}</h3>
            ${cat.desc && currentLang === "ar" ? `<small>${cat.desc}</small>` : ""}
          </div>
          <span class="badge-count">${catItems.length}</span>
        </div>
        <div class="products-grid">
          ${catItems.map(item => renderProductCard(item, dict)).join("")}
        </div>
      </section>
    `;
  });

  wrapper.innerHTML = html || `<p class="text-center muted-text my-3">لا توجد أصناف مطابقة للبحث.</p>`;

  wrapper.querySelectorAll(".add-plus-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!lockAction(450)) return;
      const item = state.items.find(i => i.id === btn.dataset.id);
      if (item && item.available) openProductModal(item);
    });
  });
}

function renderProductCard(item, dict) {
  const title = item[currentLang] || item.ar;
  const desc = currentLang === "ar" ? (item.descAr || "") : (item.descEn || item.descAr || "");
  const priceDisplay = item.p2
    ? `${item.p1} / ${item.p2} ${dict.currency}`
    : `${item.p1} ${dict.currency}`;

  return `
    <article class="product-card ${item.available ? '' : 'sold-out'}">
      ${!item.available ? `<span class="sold-out-badge">${dict.soldOut}</span>` : ""}
      <div class="product-img-wrap">
        <img src="${item.img || 'images/savory_feteer.jpg'}" alt="${title}" loading="lazy" />
      </div>
      <div class="product-info">
        <div>
          <h4 class="product-title">${title}</h4>
          <p class="product-desc">${desc}</p>
        </div>
        <div class="product-bottom">
          <span class="price-tag">${priceDisplay}</span>
          <button type="button" class="add-plus-btn" data-id="${item.id}" ${!item.available ? "disabled" : ""} aria-label="Add">+</button>
        </div>
      </div>
    </article>
  `;
}

function renderBranches() {
  const grid = document.getElementById("branches-grid");
  const pickupSelect = document.getElementById("pickup-branch-select");
  grid.innerHTML = state.branches.map(b => `
    <div class="branch-card">
      <h4>${b.name}</h4>
      <p class="muted-text">${b.address}</p>
      <div class="branch-actions">
        <a href="tel:${b.phone}" class="branch-btn">📞 ${b.phone}</a>
        <a href="https://wa.me/${state.settings.orderWhatsapp}" target="_blank" class="branch-btn wa">💬 واتساب</a>
        <a href="${b.map}" target="_blank" class="branch-btn">🗺️ الخريطة</a>
      </div>
    </div>
  `).join("");

  pickupSelect.innerHTML = state.branches.map(b => `<option value="${b.name}">${b.name} - ${b.address}</option>`).join("");
}

function openProductModal(item) {
  currentModalItem = item;
  modalQty = 1;
  const dict = I18N[currentLang];

  document.getElementById("modal-item-img").src = item.img || "images/savory_feteer.jpg";
  document.getElementById("modal-item-name").textContent = item[currentLang] || item.ar;
  document.getElementById("modal-item-desc").textContent = currentLang === "ar" ? (item.descAr || "") : (item.descEn || item.descAr || "");
  document.getElementById("modal-item-note").value = "";
  document.getElementById("modal-qty-val").textContent = "1";

  const varGroup = document.getElementById("modal-variants-group");
  const varList = document.getElementById("modal-variants-list");
  if (item.p2) {
    varGroup.classList.remove("hidden");
    varList.innerHTML = `
      <label class="choice-chip">
        <input type="radio" name="variant" value="p1" data-price="${item.p1}" data-label="${dict.sizeMedium}" checked />
        <span>${dict.sizeMedium} (${item.p1} ${dict.currency})</span>
      </label>
      <label class="choice-chip">
        <input type="radio" name="variant" value="p2" data-price="${item.p2}" data-label="${dict.sizeLarge}" />
        <span>${dict.sizeLarge} (${item.p2} ${dict.currency})</span>
      </label>
    `;
  } else {
    varGroup.classList.add("hidden");
    varList.innerHTML = "";
  }

  const dipsGroup = document.getElementById("modal-dips-group");
  const dipsList = document.getElementById("modal-dips-list");
  if (item.dipsLimit) {
    dipsGroup.classList.remove("hidden");
    document.getElementById("modal-dips-limit").textContent = item.dipsLimit;
    dipsList.innerHTML = state.dips.map(d => `
      <label class="choice-chip">
        <input type="checkbox" name="dip" value="${d[currentLang] || d.ar}" />
        <span>${d[currentLang] || d.ar}</span>
      </label>
    `).join("");

    dipsList.querySelectorAll("input[name='dip']").forEach(chk => {
      chk.addEventListener("change", () => {
        const checked = dipsList.querySelectorAll("input[name='dip']:checked");
        if (checked.length > item.dipsLimit) {
          chk.checked = false;
          showToast(`الحد الأقصى للغموس المجاني هو ${item.dipsLimit}`);
        }
      });
    });
  } else {
    dipsGroup.classList.add("hidden");
    dipsList.innerHTML = "";
  }

  const addonsList = document.getElementById("modal-addons-list");
  addonsList.innerHTML = state.addons.map(a => `
    <label class="choice-chip">
      <input type="checkbox" name="addon" value="${a[currentLang] || a.ar}" data-price="${a.price}" />
      <span>${a[currentLang] || a.ar} (+${a.price})</span>
    </label>
  `).join("");

  document.querySelectorAll("#product-modal input").forEach(inp => {
    inp.addEventListener("change", updateModalPrice);
  });

  updateModalPrice();
  document.getElementById("product-modal").classList.remove("hidden");
}

function updateModalPrice() {
  if (!currentModalItem) return;
  let base = currentModalItem.p1;
  const chosenVar = document.querySelector("#modal-variants-list input[name='variant']:checked");
  if (chosenVar) base = Number(chosenVar.dataset.price);

  let addonsSum = 0;
  document.querySelectorAll("#modal-addons-list input[name='addon']:checked").forEach(chk => {
    addonsSum += Number(chk.dataset.price);
  });

  const total = (base + addonsSum) * modalQty;
  document.getElementById("modal-total-price").textContent = total;
}

document.getElementById("modal-add-confirm").addEventListener("click", () => {
  if (!lockAction(650)) return;
  if (!currentModalItem) return;

  let base = currentModalItem.p1;
  let variantLabel = "";
  const chosenVar = document.querySelector("#modal-variants-list input[name='variant']:checked");
  if (chosenVar) {
    base = Number(chosenVar.dataset.price);
    variantLabel = chosenVar.dataset.label;
  }

  const chosenDips = Array.from(document.querySelectorAll("#modal-dips-list input[name='dip']:checked")).map(c => c.value);
  const chosenAddons = Array.from(document.querySelectorAll("#modal-addons-list input[name='addon']:checked")).map(c => ({
    name: c.value,
    price: Number(c.dataset.price)
  }));
  const note = document.getElementById("modal-item-note").value.trim();

  const unitPrice = base + chosenAddons.reduce((s, a) => s + a.price, 0);
  const signature = JSON.stringify({ id: currentModalItem.id, variantLabel, chosenDips, chosenAddons, note });

  const existing = cart.find(c => c.signature === signature);
  if (existing) {
    existing.qty += modalQty;
  } else {
    cart.push({
      signature,
      id: currentModalItem.id,
      name: currentModalItem[currentLang] || currentModalItem.ar,
      arName: currentModalItem.ar,
      variantLabel,
      dips: chosenDips,
      addons: chosenAddons,
      note,
      unitPrice,
      qty: modalQty
    });
  }

  document.getElementById("product-modal").classList.add("hidden");
  renderCartUI();
  showToast("✅ تمت الإضافة للسلة بنجاح");
});

document.getElementById("modal-qty-plus").addEventListener("click", () => {
  modalQty++;
  document.getElementById("modal-qty-val").textContent = modalQty;
  updateModalPrice();
});
document.getElementById("modal-qty-minus").addEventListener("click", () => {
  if (modalQty > 1) {
    modalQty--;
    document.getElementById("modal-qty-val").textContent = modalQty;
    updateModalPrice();
  }
});
document.getElementById("close-product-modal").addEventListener("click", () => {
  document.getElementById("product-modal").classList.add("hidden");
});

function renderCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  const dict = I18N[currentLang];

  document.getElementById("header-cart-count").textContent = totalQty;
  document.getElementById("floating-cart-count").textContent = totalQty;
  document.getElementById("floating-cart-total").textContent = `${subtotal} ${dict.currency}`;

  const floatingBar = document.getElementById("floating-cart-bar");
  if (totalQty > 0) floatingBar.classList.remove("hidden");
  else floatingBar.classList.add("hidden");

  const zoneSelect = document.getElementById("delivery-zone-select");
  const prevZone = zoneSelect.value;
  zoneSelect.innerHTML = state.zones.map(z => `<option value="${z.id}" data-fee="${z.fee}">${z[currentLang] || z.ar} (${z.fee} ${dict.currency})</option>`).join("");
  if (prevZone && state.zones.some(z => z.id === prevZone)) zoneSelect.value = prevZone;

  const list = document.getElementById("cart-items-list");
  if (cart.length === 0) {
    list.innerHTML = `<p class="text-center muted-text my-3">${dict.emptyCart}</p>`;
  } else {
    list.innerHTML = cart.map((item, idx) => `
      <div class="cart-item-row">
        <div>
          <strong>${item.name}</strong> ${item.variantLabel ? `<small>(${item.variantLabel})</small>` : ""}
          ${item.dips.length ? `<div class="muted-text">غموس: ${item.dips.join("، ")}</div>` : ""}
          ${item.addons.length ? `<div class="muted-text">إضافات: ${item.addons.map(a => a.name).join("، ")}</div>` : ""}
          ${item.note ? `<div class="muted-text">ملاحظة: ${item.note}</div>` : ""}
          <div class="price-tag">${item.unitPrice * item.qty} ${dict.currency}</div>
        </div>
        <div class="qty-control">
          <button type="button" onclick="changeCartQty(${idx}, -1)">−</button>
          <span>${item.qty}</span>
          <button type="button" onclick="changeCartQty(${idx}, 1)">+</button>
        </div>
      </div>
    `).join("");
  }

  recalcTotals();
}

window.changeCartQty = function(idx, delta) {
  if (!lockAction(250)) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCartUI();
};

function recalcTotals() {
  const dict = I18N[currentLang];
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  let deliveryFee = 0;

  const feeRow = document.getElementById("delivery-fee-row");
  if (selectedOrderType === "delivery") {
    feeRow.classList.remove("hidden");
    const zoneOpt = document.getElementById("delivery-zone-select").selectedOptions[0];
    deliveryFee = zoneOpt ? Number(zoneOpt.dataset.fee) : 0;
  } else {
    feeRow.classList.add("hidden");
  }

  document.getElementById("cart-subtotal").textContent = `${subtotal} ${dict.currency}`;
  document.getElementById("cart-delivery-fee").textContent = `${deliveryFee} ${dict.currency}`;
  document.getElementById("cart-grand-total").textContent = `${subtotal + deliveryFee} ${dict.currency}`;
}

document.getElementById("delivery-zone-select").addEventListener("change", recalcTotals);

document.querySelectorAll(".order-type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedOrderType = btn.dataset.type;
    document.querySelectorAll(".order-type-btn").forEach(b => b.classList.toggle("active", b === btn));
    document.getElementById("delivery-fields").classList.toggle("hidden", selectedOrderType !== "delivery");
    document.getElementById("pickup-fields").classList.toggle("hidden", selectedOrderType !== "pickup");
    document.getElementById("dinein-fields").classList.toggle("hidden", selectedOrderType !== "dinein");
    recalcTotals();
  });
});

document.getElementById("header-cart-btn").addEventListener("click", () => {
  renderCartUI();
  document.getElementById("cart-modal").classList.remove("hidden");
});
document.getElementById("floating-cart-btn").addEventListener("click", () => {
  renderCartUI();
  document.getElementById("cart-modal").classList.remove("hidden");
});
document.getElementById("close-cart-modal").addEventListener("click", () => {
  document.getElementById("cart-modal").classList.add("hidden");
});
document.getElementById("clear-cart-btn").addEventListener("click", () => {
  cart = [];
  renderCartUI();
});

document.getElementById("send-whatsapp-order-btn").addEventListener("click", () => {
  if (!lockAction(1500)) return;

  if (state.settings.status === "closed") {
    showToast("🔴 عذراً، المطعم مغلق مؤقتاً حالياً.");
    return;
  }
  if (cart.length === 0) {
    showToast("السلة فارغة!");
    return;
  }

  const name = document.getElementById("cust-name").value.trim();
  const phone = document.getElementById("cust-phone").value.trim();
  if (!name || !phone) {
    showToast("⚠️ من فضلك أدخل الاسم ورقم الموبايل");
    return;
  }

  let locationInfo = "";
  let deliveryFee = 0;
  if (selectedOrderType === "delivery") {
    const zoneOpt = document.getElementById("delivery-zone-select").selectedOptions[0];
    const address = document.getElementById("cust-address").value.trim();
    if (!address) {
      showToast("⚠️ من فضلك أدخل عنوان التوصيل بالتفصيل");
      return;
    }
    deliveryFee = zoneOpt ? Number(zoneOpt.dataset.fee) : 0;
    locationInfo = `🛵 *نوع الطلب:* توصيل للمنزل\n📍 *المنطقة:* ${zoneOpt ? zoneOpt.textContent : ""}\n🏠 *العنوان:* ${address}`;
  } else if (selectedOrderType === "pickup") {
    const branch = document.getElementById("pickup-branch-select").value;
    locationInfo = `🏪 *نوع الطلب:* استلام من الفرع (${branch})`;
  } else {
    const table = document.getElementById("table-number").value.trim();
    if (!table) {
      showToast("⚠️ من فضلك أدخل رقم الطاولة");
      return;
    }
    locationInfo = `🍽️ *نوع الطلب:* داخل المطعم - طاولة رقم (${table})`;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  const grandTotal = subtotal + deliveryFee;
  const generalNotes = document.getElementById("order-notes").value.trim();

  const orderFingerprint = `${name}|${phone}|${grandTotal}|${JSON.stringify(cart.map(c => c.signature + c.qty))}`;
  if (orderFingerprint === lastOrderHash) {
    showToast("⚠️ تم إرسال هذا الطلب للتو! تم منع التكرار.");
    return;
  }
  lastOrderHash = orderFingerprint;

  const itemsText = cart.map((item, i) => {
    let line = `${i + 1}. *${item.arName}* ${item.variantLabel ? `(${item.variantLabel})` : ""} × ${item.qty} = ${item.unitPrice * item.qty} ج.م`;
    if (item.dips.length) line += `\n   - غموس: ${item.dips.join("، ")}`;
    if (item.addons.length) line += `\n   - إضافات: ${item.addons.map(a => a.name).join("، ")}`;
    if (item.note) line += `\n   - ملاحظة: ${item.note}`;
    return line;
  }).join("\n");

  const msg = `🔥 *طلب جديد - عم سمير بتاع الفطير* 🔥\n\n` +
    `👤 *العميل:* ${name}\n` +
    `📱 *الموبايل:* ${phone}\n` +
    `${locationInfo}\n\n` +
    `📋 *تفاصيل الطلب:*\n${itemsText}\n\n` +
    `💵 *المجموع الفرعي:* ${subtotal} ج.م\n` +
    (selectedOrderType === "delivery" ? `🛵 *التوصيل:* ${deliveryFee} ج.م\n` : "") +
    `💰 *الإجمالي النهائي:* ${grandTotal} ج.م` +
    (generalNotes ? `\n📝 *ملاحظات عامة:* ${generalNotes}` : "");

  state.orders.unshift({
    id: "ORD-" + Date.now().toString().slice(-5),
    date: new Date().toLocaleString("ar-EG"),
    customer: name,
    phone,
    type: selectedOrderType,
    total: grandTotal,
    items: cart.map(c => ({ name: c.arName, qty: c.qty }))
  });
  saveState();

  const waUrl = `https://wa.me/${state.settings.orderWhatsapp}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, "_blank");
});

function isAdminLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

function updateAdminButtonLabel() {
  const dict = I18N[currentLang];
  document.getElementById("admin-btn-label").textContent = isAdminLoggedIn() ? dict.dashBtn : dict.loginBtn;
}

document.getElementById("admin-entry-btn").addEventListener("click", () => {
  if (isAdminLoggedIn()) {
    openDashboard();
  } else {
    document.getElementById("login-error-msg").classList.add("hidden");
    document.getElementById("login-modal").classList.remove("hidden");
  }
});

document.getElementById("close-login-modal").addEventListener("click", () => {
  document.getElementById("login-modal").classList.add("hidden");
});

document.getElementById("admin-login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("admin-email-input").value.trim();
  const pass = document.getElementById("admin-pass-input").value.trim();

  if (email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() && pass === ADMIN_CREDENTIALS.password) {
    sessionStorage.setItem(AUTH_KEY, "true");
    document.getElementById("login-modal").classList.add("hidden");
    updateAdminButtonLabel();
    openDashboard();
  } else {
    document.getElementById("login-error-msg").classList.remove("hidden");
  }
});

document.getElementById("admin-logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem(AUTH_KEY);
  document.getElementById("dashboard-modal").classList.add("hidden");
  updateAdminButtonLabel();
  showToast("تم تسجيل الخروج من لوحة التحكم");
});

document.getElementById("close-dashboard-btn").addEventListener("click", () => {
  document.getElementById("dashboard-modal").classList.add("hidden");
});

document.querySelectorAll(".dash-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".dash-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

function openDashboard() {
  renderDashItems();
  renderDashCategories();
  renderDashZones();
  renderDashBranches();
  renderDashOrders();
  loadSettingsToDash();
  document.getElementById("dashboard-modal").classList.remove("hidden");
}

function renderDashItems() {
  const filterCat = document.getElementById("dash-filter-cat");
  const itemCatSelect = document.getElementById("item-cat-select");
  const prevFilter = filterCat.value;

  filterCat.innerHTML = `<option value="all">كل الأقسام</option>` + state.categories.map(c => `<option value="${c.id}">${c.ar}</option>`).join("");
  if (prevFilter) filterCat.value = prevFilter;
  itemCatSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.ar}</option>`).join("");

  const q = document.getElementById("dash-search-item").value.trim().toLowerCase();
  const tbody = document.getElementById("dash-items-tbody");

  const filtered = state.items.filter(item => {
    if (filterCat.value !== "all" && item.cat !== filterCat.value) return false;
    if (q && !(item.ar + " " + (item.en || "")).toLowerCase().includes(q)) return false;
    return true;
  });

  tbody.innerHTML = filtered.map(item => {
    const catObj = state.categories.find(c => c.id === item.cat);
    return `
      <tr>
        <td><img src="${item.img}" class="table-thumb" /></td>
        <td><strong>${item.ar}</strong><br><small class="muted-text">${item.en || ""}</small></td>
        <td>${catObj ? catObj.ar : item.cat}</td>
        <td>${item.p1}${item.p2 ? " / " + item.p2 : ""} ج.م</td>
        <td>
          <button type="button" class="btn-outline" style="padding:4px 10px;font-size:0.8rem" onclick="toggleItemAvailability('${item.id}')">
            ${item.available ? "✅ متاح" : "🚫 مخفي / غير متاح"}
          </button>
        </td>
        <td>
          <button type="button" class="btn-gold" style="padding:4px 10px;font-size:0.8rem" onclick="editDashItem('${item.id}')">تعديل</button>
          <button type="button" class="btn-text-danger" onclick="deleteDashItem('${item.id}')">حذف</button>
        </td>
      </tr>
    `;
  }).join("");
}

document.getElementById("dash-filter-cat").addEventListener("change", renderDashItems);
document.getElementById("dash-search-item").addEventListener("input", renderDashItems);

document.getElementById("open-add-item-btn").addEventListener("click", () => {
  document.getElementById("edit-item-id").value = "";
  document.getElementById("item-editor-title").textContent = "إضافة صنف جديد";
  document.getElementById("item-name-ar").value = "";
  document.getElementById("item-name-en").value = "";
  document.getElementById("item-name-fr").value = "";
  document.getElementById("item-price-1").value = "";
  document.getElementById("item-price-2").value = "";
  document.getElementById("item-desc-ar").value = "";
  document.getElementById("item-desc-en").value = "";
  document.getElementById("item-editor-box").classList.remove("hidden");
});

document.getElementById("cancel-item-btn").addEventListener("click", () => {
  document.getElementById("item-editor-box").classList.add("hidden");
});

document.getElementById("save-item-btn").addEventListener("click", () => {
  if (!lockAction(800)) return;

  const id = document.getElementById("edit-item-id").value;
  const cat = document.getElementById("item-cat-select").value;
  const ar = document.getElementById("item-name-ar").value.trim();
  const en = document.getElementById("item-name-en").value.trim();
  const fr = document.getElementById("item-name-fr").value.trim();
  const p1 = Number(document.getElementById("item-price-1").value);
  const p2Raw = document.getElementById("item-price-2").value;
  const p2 = p2Raw ? Number(p2Raw) : null;
  const descAr = document.getElementById("item-desc-ar").value.trim();
  const descEn = document.getElementById("item-desc-en").value.trim();
  const img = document.getElementById("item-img-select").value;

  if (!ar || !p1) {
    showToast("⚠️ أدخل اسم الصنف والسعر الأساسي");
    return;
  }

  if (id) {
    const idx = state.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      state.items[idx] = { ...state.items[idx], cat, ar, en, fr, p1, p2, descAr, descEn, img };
    }
  } else {
    const duplicate = state.items.some(i => i.cat === cat && i.ar.trim() === ar);
    if (duplicate) {
      showToast("⚠️ هذا الصنف موجود بالفعل في نفس القسم!");
      return;
    }
    state.items.unshift({
      id: "item_" + Date.now(),
      cat, ar, en, fr, p1, p2, descAr, descEn, img,
      available: true
    });
  }

  saveState();
  document.getElementById("item-editor-box").classList.add("hidden");
  renderDashItems();
  renderMenu();
  showToast("✅ تم حفظ الصنف بنجاح");
});

window.editDashItem = function(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  document.getElementById("edit-item-id").value = item.id;
  document.getElementById("item-editor-title").textContent = "تعديل الصنف: " + item.ar;
  document.getElementById("item-cat-select").value = item.cat;
  document.getElementById("item-name-ar").value = item.ar;
  document.getElementById("item-name-en").value = item.en || "";
  document.getElementById("item-name-fr").value = item.fr || "";
  document.getElementById("item-price-1").value = item.p1;
  document.getElementById("item-price-2").value = item.p2 || "";
  document.getElementById("item-desc-ar").value = item.descAr || "";
  document.getElementById("item-desc-en").value = item.descEn || "";
  document.getElementById("item-img-select").value = item.img || "images/savory_feteer.jpg";
  document.getElementById("item-editor-box").classList.remove("hidden");
};

window.toggleItemAvailability = function(id) {
  if (!lockAction(300)) return;
  const item = state.items.find(i => i.id === id);
  if (item) {
    item.available = !item.available;
    saveState();
    renderDashItems();
    renderMenu();
  }
};

window.deleteDashItem = function(id) {
  if (!confirm("هل أنت متأكد من حذف هذا الصنف؟")) return;
  state.items = state.items.filter(i => i.id !== id);
  saveState();
  renderDashItems();
  renderMenu();
  showToast("🗑️ تم حذف الصنف");
};

function renderDashCategories() {
  const list = document.getElementById("dash-categories-list");
  list.innerHTML = state.categories.map((cat, idx) => `
    <div class="dash-list-card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;flex:1;">
        <input type="text" class="form-input" style="max-width:200px" value="${cat.ar}" onchange="updateCatName(${idx}, 'ar', this.value)" />
        <input type="text" class="form-input" style="max-width:200px" value="${cat.en || ''}" onchange="updateCatName(${idx}, 'en', this.value)" />
        <input type="text" class="form-input" style="max-width:200px" value="${cat.fr || ''}" onchange="updateCatName(${idx}, 'fr', this.value)" />
      </div>
      <button type="button" class="btn-text-danger" onclick="deleteCategory('${cat.id}')">حذف القسم</button>
    </div>
  `).join("");
}

window.updateCatName = function(idx, field, val) {
  state.categories[idx][field] = val.trim();
  saveState();
  renderCategories();
  renderMenu();
  showToast("✅ تم تحديث اسم القسم");
};

document.getElementById("add-cat-btn").addEventListener("click", () => {
  if (!lockAction(700)) return;
  const ar = document.getElementById("new-cat-ar").value.trim();
  const en = document.getElementById("new-cat-en").value.trim();
  const fr = document.getElementById("new-cat-fr").value.trim();
  if (!ar) return showToast("⚠️ أدخل اسم القسم بالعربي");
  if (state.categories.some(c => c.ar === ar)) return showToast("⚠️ القسم موجود بالفعل!");

  state.categories.push({ id: "cat_" + Date.now(), ar, en: en || ar, fr: fr || ar, desc: "" });
  saveState();
  document.getElementById("new-cat-ar").value = "";
  document.getElementById("new-cat-en").value = "";
  document.getElementById("new-cat-fr").value = "";
  renderDashCategories();
  renderDashItems();
  renderCategories();
  showToast("✅ تمت إضافة القسم");
});

window.deleteCategory = function(id) {
  if (!confirm("سيتم حذف القسم، هل أنت متأكد؟")) return;
  state.categories = state.categories.filter(c => c.id !== id);
  saveState();
  renderDashCategories();
  renderCategories();
  renderMenu();
};

function renderDashZones() {
  const tbody = document.getElementById("dash-zones-tbody");
  tbody.innerHTML = state.zones.map(z => `
    <tr>
      <td>${z.ar}</td>
      <td>${z.en || z.ar}</td>
      <td><strong>${z.fee} ج.م</strong></td>
      <td><button type="button" class="btn-text-danger" onclick="deleteZone('${z.id}')">حذف</button></td>
    </tr>
  `).join("");
}

document.getElementById("add-zone-btn").addEventListener("click", () => {
  if (!lockAction(700)) return;
  const ar = document.getElementById("new-zone-ar").value.trim();
  const en = document.getElementById("new-zone-en").value.trim();
  const fee = Number(document.getElementById("new-zone-fee").value);
  if (!ar || isNaN(fee)) return showToast("⚠️ أدخل اسم المنطقة وسعر التوصيل");
  if (state.zones.some(z => z.ar === ar)) return showToast("⚠️ هذه المنطقة مضافة بالفعل!");

  state.zones.push({ id: "z_" + Date.now(), ar, en: en || ar, fee });
  saveState();
  document.getElementById("new-zone-ar").value = "";
  document.getElementById("new-zone-en").value = "";
  document.getElementById("new-zone-fee").value = "";
  renderDashZones();
  renderCartUI();
  showToast("✅ تمت إضافة منطقة التوصيل");
});

window.deleteZone = function(id) {
  state.zones = state.zones.filter(z => z.id !== id);
  saveState();
  renderDashZones();
  renderCartUI();
};

function renderDashBranches() {
  const list = document.getElementById("dash-branches-list");
  list.innerHTML = state.branches.map(b => `
    <div class="dash-list-card">
      <div>
        <strong>${b.name}</strong>
        <div class="muted-text">${b.address} • 📞 ${b.phone}</div>
      </div>
      <button type="button" class="btn-text-danger" onclick="deleteBranch('${b.id}')">حذف الفرع</button>
    </div>
  `).join("");
}

document.getElementById("add-branch-btn").addEventListener("click", () => {
  if (!lockAction(700)) return;
  const name = document.getElementById("new-branch-name").value.trim();
  const address = document.getElementById("new-branch-address").value.trim();
  const phone = document.getElementById("new-branch-phone").value.trim() || "17205";
  const map = document.getElementById("new-branch-map").value.trim() || "https://maps.google.com";
  if (!name || !address) return showToast("⚠️ أدخل اسم الفرع والعنوان");

  state.branches.push({ id: "br_" + Date.now(), name, address, phone, map });
  saveState();
  document.getElementById("new-branch-name").value = "";
  document.getElementById("new-branch-address").value = "";
  document.getElementById("new-branch-phone").value = "";
  document.getElementById("new-branch-map").value = "";
  renderDashBranches();
  renderBranches();
  showToast("✅ تمت إضافة الفرع");
});

window.deleteBranch = function(id) {
  state.branches = state.branches.filter(b => b.id !== id);
  saveState();
  renderDashBranches();
  renderBranches();
};

function renderDashOrders() {
  document.getElementById("stat-total-orders").textContent = state.orders.length;
  const rev = state.orders.reduce((s, o) => s + o.total, 0);
  document.getElementById("stat-total-revenue").textContent = `${rev} ج.م`;

  const counts = {};
  state.orders.forEach(o => o.items.forEach(it => {
    counts[it.name] = (counts[it.name] || 0) + it.qty;
  }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("stat-top-item").textContent = top ? `${top[0]} (${top[1]})` : "-";

  const list = document.getElementById("dash-orders-list");
  if (state.orders.length === 0) {
    list.innerHTML = `<p class="muted-text text-center my-3">لا توجد طلبات مسجلة بعد.</p>`;
  } else {
    list.innerHTML = state.orders.map(o => `
      <div class="dash-list-card mb-2">
        <div>
          <strong>#${o.id} • ${o.customer} (${o.phone})</strong>
          <div class="muted-text">${o.date} • ${o.items.map(i => `${i.name} ×${i.qty}`).join("، ")}</div>
        </div>
        <strong class="price-tag">${o.total} ج.م</strong>
      </div>
    `).join("");
  }
}

document.getElementById("reset-stats-btn").addEventListener("click", () => {
  if (!confirm("هل تريد تصفير سجل الطلبات والإحصائيات؟")) return;
  state.orders = [];
  saveState();
  renderDashOrders();
  showToast("تم تصفير السجل");
});

function loadSettingsToDash() {
  document.getElementById("setting-shop-status").value = state.settings.status;
  document.getElementById("setting-promo-active").checked = state.settings.promoActive;
  document.getElementById("setting-promo-text").value = state.settings.promoText;
  document.getElementById("setting-order-whatsapp").value = state.settings.orderWhatsapp;
  document.getElementById("setting-hotline").value = state.settings.hotline;
}

document.getElementById("save-settings-btn").addEventListener("click", () => {
  state.settings.status = document.getElementById("setting-shop-status").value;
  state.settings.promoActive = document.getElementById("setting-promo-active").checked;
  state.settings.promoText = document.getElementById("setting-promo-text").value.trim();
  state.settings.orderWhatsapp = document.getElementById("setting-order-whatsapp").value.trim() || "201124349186";
  state.settings.hotline = document.getElementById("setting-hotline").value.trim() || "17205";
  saveState();
  renderBanners();
  renderBranches();
  showToast("✅ تم حفظ إعدادات المطعم");
});

document.getElementById("export-backup-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `uncle_samir_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-backup-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (parsed && parsed.items && parsed.categories) {
        state = parsed;
        saveState();
        openDashboard();
        applyLanguage(currentLang);
        showToast("✅ تم استعادة النسخة الاحتياطية بنجاح");
      } else {
        showToast("⚠️ ملف النسخة الاحتياطية غير صالح");
      }
    } catch {
      showToast("⚠️ خطأ في قراءة الملف");
    }
  };
  reader.readAsText(file);
});

document.getElementById("factory-reset-btn").addEventListener("click", () => {
  if (!confirm("هل أنت متأكد من استعادة المنيو الأصلي ومسح كل التعديلات؟")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = JSON.parse(JSON.stringify(DEFAULT_DATA));
  saveState();
  openDashboard();
  applyLanguage(currentLang);
  showToast("✅ تمت استعادة المنيو الأصلي");
});

document.getElementById("menu-search").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderMenu();
});

document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
});

applyLanguage("ar");
