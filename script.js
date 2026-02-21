AOS.init();

const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec";

// Static product catalogue.
// To update images: upload your own file to assets/products/ and replace image path below.
const PRODUCT_CATALOG = [
  { id: "earring-1", name: "Pearl Drop Earrings", category: "Earrings", price: 599, image: "assets/products/pearl-drop-earrings.svg" },
  { id: "earring-2", name: "Stone Hoop Earrings", category: "Earrings", price: 699, image: "assets/products/stone-hoop-earrings.svg" },
  { id: "necklace-1", name: "Kundan Necklace Set", category: "Necklace", price: 1599, image: "assets/products/kundan-necklace-set.svg" },
  { id: "necklace-2", name: "Temple Choker Set", category: "Necklace", price: 1799, image: "assets/products/temple-choker-set.svg" },
  { id: "bangle-1", name: "Mirror Work Bangles", category: "Bangles", price: 899, image: "assets/products/mirror-work-bangles.svg" },
  { id: "bangle-2", name: "Gold Tone Kada", category: "Bangles", price: 999, image: "assets/products/gold-tone-kada.svg" },
  { id: "bridal-1", name: "Bridal Jewellery Combo", category: "Bridal", price: 2999, image: "assets/products/bridal-jewellery-combo.svg" },
  { id: "hair-1", name: "Floral Hair Pins", category: "Hair Accessory", price: 499, image: "assets/products/floral-hair-pins.svg" }
];

let cart = JSON.parse(localStorage.getItem("seemaniCart")) || [];

function saveCart() {
  localStorage.setItem("seemaniCart", JSON.stringify(cart));
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  PRODUCT_CATALOG.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <div class="content">
        <h3>${product.name}</h3>
        <p class="meta">${product.category}</p>
        <p class="price">₹${product.price}</p>
        <button class="btn-main" onclick="addToCart('${product.id}')">Add to Cart</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function addToCart(productId) {
  const product = PRODUCT_CATALOG.find((item) => item.id === productId);
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

function removeFromCart(productId) {
  cart = cart
    .map((item) => (item.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
    .filter((item) => item.quantity > 0);

  saveCart();
  renderCart();
  renderCheckoutSummary();
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
    cartItemsEl.innerHTML = '<li>Your cart is empty.</li>';
  } else {
    cart.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${item.name} × ${item.quantity} <strong>(₹${item.quantity * item.price})</strong></span>
        <button class="remove-btn" onclick="removeFromCart('${item.id}')">Remove</button>
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

renderProducts();
renderCart();
renderCheckoutSummary();
