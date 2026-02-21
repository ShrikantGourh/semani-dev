AOS.init();

const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec";

const BASE_CATALOG = [
  { id: "earring-1", name: "Pearl Drop Earrings", category: "Earrings", price: 599, image: "assets/products/pearl-drop-earrings.svg" },
  { id: "earring-2", name: "Stone Hoop Earrings", category: "Earrings", price: 699, image: "assets/products/stone-hoop-earrings.svg" },
  { id: "necklace-1", name: "Kundan Necklace Set", category: "Necklace", price: 1599, image: "assets/products/kundan-necklace-set.svg" },
  { id: "necklace-2", name: "Temple Choker Set", category: "Necklace", price: 1799, image: "assets/products/temple-choker-set.svg" },
  { id: "bangle-1", name: "Mirror Work Bangles", category: "Bangles", price: 899, image: "assets/products/mirror-work-bangles.svg" },
  { id: "bangle-2", name: "Gold Tone Kada", category: "Bangles", price: 999, image: "assets/products/gold-tone-kada.svg" },
  { id: "bridal-1", name: "Bridal Jewellery Combo", category: "Bridal", price: 2999, image: "assets/products/bridal-jewellery-combo.svg" },
  { id: "hair-1", name: "Floral Hair Pins", category: "Hair Accessory", price: 499, image: "assets/products/floral-hair-pins.svg" }
];

const TARGET_CATALOG_SIZE = 4000;

function buildCatalog(targetSize) {
  const built = [];

  for (let i = 0; i < targetSize; i += 1) {
    const base = BASE_CATALOG[i % BASE_CATALOG.length];
    const variation = Math.floor(i / BASE_CATALOG.length) + 1;
    const priceOffset = (variation % 5) * 75;

    built.push({
      id: `${base.id}-${variation}`,
      name: `${base.name} #${variation}`,
      category: base.category,
      price: base.price + priceOffset,
      image: base.image,
      featuredOrder: i
    });
  }

  return built;
}

const PRODUCT_CATALOG = buildCatalog(TARGET_CATALOG_SIZE);
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

const catalogueState = {
  query: "",
  category: "all",
  sortBy: "featured",
  page: 1,
  pageSize: 40
};

let filteredProducts = PRODUCT_CATALOG;
let cart = JSON.parse(localStorage.getItem("seemaniCart")) || [];

function saveCart() {
  localStorage.setItem("seemaniCart", JSON.stringify(cart));
}

function updateCategoryFilter() {
  const categoryFilter = document.getElementById("categoryFilter");
  const categories = [...new Set(PRODUCT_CATALOG.map((product) => product.category))].sort();

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

  filteredProducts = PRODUCT_CATALOG.filter((product) => {
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
  applyFilters();

  const totalCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / catalogueState.pageSize));
  catalogueState.page = Math.min(catalogueState.page, totalPages);

  const startIndex = (catalogueState.page - 1) * catalogueState.pageSize;
  const endIndex = startIndex + catalogueState.pageSize;
  const pageProducts = filteredProducts.slice(startIndex, endIndex);

  const grid = document.getElementById("productGrid");
  const meta = document.getElementById("catalogMeta");
  const pageIndicator = document.getElementById("pageIndicator");
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

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

function addToCart(productId) {
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return;

  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
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

function removeFromCart(productId) {
  updateCartQuantity(productId, -1);
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
            <button class="qty-btn" type="button" onclick="decreaseCartQuantity('${item.id}')" aria-label="Decrease quantity for ${item.name}">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" type="button" onclick="increaseCartQuantity('${item.id}')" aria-label="Increase quantity for ${item.name}">+</button>
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
  const { total } = getCartTotals();

  if (!cart.length) {
    summaryEl.innerHTML = "No products selected yet.";
    return;
  }

  const lines = cart.map((item) => `${item.name} × ${item.quantity} = ₹${item.quantity * item.price}`);
  summaryEl.innerHTML = `<strong>Order Items</strong><br>${lines.join("<br>")}<br><br><strong>Total: ₹${total}</strong>`;
}

function goToCheckout() {
  document.getElementById("checkout").scrollIntoView({ behavior: "smooth" });
}

async function submitToGoogleSheet(orderPayload) {
  if (GOOGLE_SHEET_WEB_APP_URL.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID")) {
    console.warn("Google Sheet API URL not configured. Update GOOGLE_SHEET_WEB_APP_URL in script.js");
    return;
  }

  await fetch(GOOGLE_SHEET_WEB_APP_URL, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload)
  });
}

function setupCatalogControls() {
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const sortSelect = document.getElementById("sortSelect");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");

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
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  nextPageBtn.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / catalogueState.pageSize));
    if (catalogueState.page < totalPages) {
      catalogueState.page += 1;
      renderProducts();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

document.getElementById("orderForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!cart.length) {
    alert("Your cart is empty. Add products before checkout.");
    return;
  }

  const orderPayload = {
    orderId: `SM-${Date.now()}`,
    createdAt: new Date().toISOString(),
    customerName: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    address: document.getElementById("address").value.trim(),
    items: cart,
    total: getCartTotals().total
  };

  try {
    await submitToGoogleSheet(orderPayload);
    alert("Order placed successfully.");
    clearCart();
    this.reset();
  } catch (error) {
    console.error(error);
    alert("Order failed. Please try again.");
  }
});

updateCategoryFilter();
setupCatalogControls();
renderProducts();
renderCart();
renderCheckoutSummary();
