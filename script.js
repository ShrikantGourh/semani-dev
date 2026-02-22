AOS.init();

const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzF4A6XBvsApmRnVX8hxjkRsflbA-n70Mvdc2hWxUN-bukf2-I0vWzpPynWjBlznOFS5Q/exec";
const CATALOG_URL = "assets/products/catalog.json";
const TARGET_CATALOG_SIZE = 4000;

const catalogueState = {
  query: "",
  category: "all",
  sortBy: "featured",
  page: 1,
  pageSize: 40
};

let baseCatalog = [];
let productCatalog = [];
let productById = new Map();
let filteredProducts = [];
let cart = JSON.parse(localStorage.getItem("seemaniCart")) || [];

function buildCatalog(items, targetSize) {
  const built = [];

  for (let i = 0; i < targetSize; i += 1) {
    const base = items[i % items.length];
    const variation = Math.floor(i / items.length) + 1;
    const priceOffset = (variation % 5) * 75;

    built.push({
      ...base,
      id: `${base.id}-${variation}`,
      name: `${base.name} #${variation}`,
      price: Number(base.price) + priceOffset,
      featuredOrder: i
    });
  }

  return built;
}

async function loadBaseCatalog() {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load product catalog JSON.");
  }

  const data = await response.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error("Catalog JSON is empty or malformed.");
  }

  return data;
}

function refreshCatalogData() {
  productCatalog = buildCatalog(baseCatalog, TARGET_CATALOG_SIZE);
  productById = new Map(productCatalog.map((product) => [product.id, product]));
  filteredProducts = productCatalog;
}

function saveCart() {
  localStorage.setItem("seemaniCart", JSON.stringify(cart));
}

function updateCategoryFilter() {
  const categoryFilter = document.getElementById("categoryFilter");
  if (!categoryFilter) return;

  const categories = [...new Set(productCatalog.map((product) => product.category))].sort();

  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function applyFilters() {
  const query = catalogueState.query.trim().toLowerCase();

  filteredProducts = productCatalog.filter((product) => {
    const queryMatch = !query || product.name.toLowerCase().includes(query);
    const categoryMatch = catalogueState.category === "all" || product.category === catalogueState.category;
    return queryMatch && categoryMatch;
  });

  const sorters = {
    featured: (a, b) => a.featuredOrder - b.featuredOrder,
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    "name-asc": (a, b) => a.name.localeCompare(b.name),
    "name-desc": (a, b) => b.name.localeCompare(a.name)
  };

  filteredProducts.sort(sorters[catalogueState.sortBy]);
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  const meta = document.getElementById("catalogMeta");
  const pageIndicator = document.getElementById("pageIndicator");
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  if (!grid || !meta || !pageIndicator || !prevBtn || !nextBtn) return;

  applyFilters();

  const totalCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / catalogueState.pageSize));
  catalogueState.page = Math.min(catalogueState.page, totalPages);

  const startIndex = (catalogueState.page - 1) * catalogueState.pageSize;
  const endIndex = startIndex + catalogueState.pageSize;
  const pageProducts = filteredProducts.slice(startIndex, endIndex);

  grid.innerHTML = "";

  if (!pageProducts.length) {
    grid.innerHTML = "<p>No products found. Try a different search or filter.</p>";
  } else {
    pageProducts.forEach((product) => {
      const card = document.createElement("article");
      card.className = "product-card";
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <div class="content">
          <h3>${product.name}</h3>
          <p class="meta">${product.category}</p>
          <p class="price">₹${product.price}</p>
          <div class="qty-controls card-qty" role="group" aria-label="Quantity picker for ${product.name}">
            <button class="qty-btn" type="button" onclick="changeCardQuantity('${product.id}', -1)">−</button>
            <span class="qty-value" id="qty-${product.id}">1</span>
            <button class="qty-btn" type="button" onclick="changeCardQuantity('${product.id}', 1)">+</button>
          </div>
          <button class="btn-main" type="button" onclick="addToCart('${product.id}')">Add to Cart</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  const pageStart = totalCount === 0 ? 0 : startIndex + 1;
  const pageEnd = Math.min(endIndex, totalCount);
  meta.textContent = `Showing ${pageStart}-${pageEnd} of ${totalCount} products`;
  pageIndicator.textContent = `Page ${catalogueState.page} of ${totalPages}`;
  prevBtn.disabled = catalogueState.page <= 1;
  nextBtn.disabled = catalogueState.page >= totalPages;
}

function getCardQuantity(productId) {
  const quantityEl = document.getElementById(`qty-${productId}`);
  if (!quantityEl) return 1;
  const parsed = Number(quantityEl.textContent);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function changeCardQuantity(productId, delta) {
  const quantityEl = document.getElementById(`qty-${productId}`);
  if (!quantityEl) return;
  const current = getCardQuantity(productId);
  quantityEl.textContent = Math.max(1, current + delta);
}

function addToCart(productId) {
  const product = productById.get(productId);
  if (!product) return;

  const quantityToAdd = getCardQuantity(productId);
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += quantityToAdd;
  } else {
    cart.push({ ...product, quantity: quantityToAdd });
  }

  saveCart();
  renderCart();
  renderCheckoutSummary();
}

function updateCartQuantity(productId, change) {
  cart = cart
    .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + change } : item))
    .filter((item) => item.quantity > 0);

  saveCart();
  renderCart();
  renderCheckoutSummary();
}

function deleteFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);

  saveCart();
  renderCart();
  renderCheckoutSummary();
}

function increaseCartQuantity(productId) {
  updateCartQuantity(productId, 1);
}

function decreaseCartQuantity(productId) {
  updateCartQuantity(productId, -1);
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
  renderCheckoutSummary();
}

function getCartTotals() {
  return {
    count: cart.reduce((sum, item) => sum + item.quantity, 0),
    total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  };
}

function renderCart() {
  const cartItemsEl = document.getElementById("cartItems");
  const cartCountEl = document.getElementById("cartCount");
  const cartTotalEl = document.getElementById("cartTotal");
  if (!cartItemsEl || !cartCountEl || !cartTotalEl) return;

  cartItemsEl.innerHTML = "";

  if (!cart.length) {
    cartItemsEl.innerHTML = '<li class="cart-empty">Your cart is empty.</li>';
  } else {
    cart.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="cart-line-details">
          <p class="cart-item-name">${item.name}</p>
          <p class="cart-item-price">₹${item.price} each</p>
        </div>
        <div class="cart-actions">
          <div class="qty-controls" role="group" aria-label="Quantity controls for ${item.name}">
            <button class="qty-btn" type="button" onclick="decreaseCartQuantity('${item.id}')">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" type="button" onclick="increaseCartQuantity('${item.id}')">+</button>
          </div>
          <strong class="line-total">₹${item.quantity * item.price}</strong>
          <button class="remove-btn" type="button" onclick="deleteFromCart('${item.id}')">Delete</button>
        </div>
      `;
      cartItemsEl.appendChild(li);
    });
  }

  const totals = getCartTotals();
  cartCountEl.textContent = totals.count;
  cartTotalEl.textContent = totals.total;
}

function renderCheckoutSummary() {
  const summaryEl = document.getElementById("checkoutProducts");
  if (!summaryEl) return;

  const { total } = getCartTotals();

  if (!cart.length) {
    summaryEl.innerHTML = "No products selected yet.";
    return;
  }

  const lines = cart.map((item) => `${item.name} × ${item.quantity} = ₹${item.quantity * item.price}`);
  summaryEl.innerHTML = `<strong>Order Items</strong><br>${lines.join("<br>")}<br><br><strong>Total: ₹${total}</strong>`;
}

function goToCheckout() {
  const checkoutSection = document.getElementById("checkout");
  if (!checkoutSection) return;
  checkoutSection.scrollIntoView({ behavior: "smooth" });
}

async function submitToGoogleSheet(orderPayload) {
  const hiddenForm = document.createElement("form");
  hiddenForm.method = "POST";
  hiddenForm.action = GOOGLE_SHEET_WEB_APP_URL;
  hiddenForm.target = "hidden_iframe";

  Object.entries(orderPayload).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    hiddenForm.appendChild(input);
  });

  document.body.appendChild(hiddenForm);
  hiddenForm.submit();
  hiddenForm.remove();
}

function setupCatalogControls() {
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const sortSelect = document.getElementById("sortSelect");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  if (!searchInput || !categoryFilter || !sortSelect || !pageSizeSelect || !prevPageBtn || !nextPageBtn) return;

  let searchTimer;

  searchInput.addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      catalogueState.query = event.target.value;
      catalogueState.page = 1;
      renderProducts();
    }, 150);
  });

  categoryFilter.addEventListener("change", (event) => {
    catalogueState.category = event.target.value;
    catalogueState.page = 1;
    renderProducts();
  });

  sortSelect.addEventListener("change", (event) => {
    catalogueState.sortBy = event.target.value;
    catalogueState.page = 1;
    renderProducts();
  });

  pageSizeSelect.addEventListener("change", (event) => {
    catalogueState.pageSize = Number(event.target.value);
    catalogueState.page = 1;
    renderProducts();
  });

  prevPageBtn.addEventListener("click", () => {
    if (catalogueState.page > 1) {
      catalogueState.page -= 1;
      renderProducts();
      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  nextPageBtn.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / catalogueState.pageSize));
    if (catalogueState.page < totalPages) {
      catalogueState.page += 1;
      renderProducts();
      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function setupCheckoutForm() {
  const orderForm = document.getElementById("orderForm");
  if (!orderForm) return;

  orderForm.addEventListener("submit", async function onSubmit(event) {
    event.preventDefault();

    if (!cart.length) {
      alert("Your cart is empty. Add products before checkout.");
      return;
    }

    const customerName = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();
    const orderStatus = document.getElementById("orderStatus");
    const productLine = cart.map((item) => `${item.name} x ${item.quantity}`).join(", ");

    const orderPayload = {
      name: customerName,
      phone,
      product: productLine,
      address
    };

    try {
      await submitToGoogleSheet(orderPayload);
      if (orderStatus) {
        orderStatus.textContent = "✅ Order Submitted Successfully!";
      }
      clearCart();
      this.reset();
    } catch (error) {
      console.error(error);
      if (orderStatus) {
        orderStatus.textContent = "Order failed. Please try again.";
      }
    }
  });
}

async function initializeApp() {
  try {
    const needsCatalog = Boolean(document.getElementById("productGrid"));

    if (needsCatalog) {
      baseCatalog = await loadBaseCatalog();
      refreshCatalogData();
      updateCategoryFilter();
    }

    setupCatalogControls();
    setupCheckoutForm();
    renderProducts();
    renderCart();
    renderCheckoutSummary();
  } catch (error) {
    console.error(error);
    const catalogMeta = document.getElementById("catalogMeta");
    if (catalogMeta) {
      catalogMeta.textContent = "Failed to load catalogue. Please check assets/products/catalog.json.";
    }
  }
}

initializeApp();

window.goToCheckout = goToCheckout;
window.clearCart = clearCart;
window.addToCart = addToCart;
window.changeCardQuantity = changeCardQuantity;
window.increaseCartQuantity = increaseCartQuantity;
window.decreaseCartQuantity = decreaseCartQuantity;
window.deleteFromCart = deleteFromCart;
