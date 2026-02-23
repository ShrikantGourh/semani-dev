if (window.AOS?.init) {
  window.AOS.init();
}

const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzF4A6XBvsApmRnVX8hxjkRsflbA-n70Mvdc2hWxUN-bukf2-I0vWzpPynWjBlznOFS5Q/exec";
const WHATSAPP_CHANNEL_URL = "https://wa.me/message/JJIVVOZGZ4LHL1";
const CATALOG_URL = "assets/products/catalog.json";

/**
 * Data source priority:
 * 1) Google Sheet + Google Drive (when configured)
 * 2) Local JSON fallback (assets/products/catalog.json)
 */
const GOOGLE_SHEET_PRODUCTS = {
  enabled: false,
  sheetId: "",
  sheetName: "Sheet1"
};

const GOOGLE_DRIVE_IMAGES = {
  enabled: false,
  apiKey: "",
  rootFolderId: ""
};

const FALLBACK_IMAGE = "assets/products/pearl-drop-earrings.svg";

const catalogueState = {
  query: "",
  category: "all",
  sortBy: "featured",
  page: 1,
  pageSize: 40
};

const DEFAULT_REELS = [
  {
    title: "Seemani Style Reel",
    embedUrl: "https://www.instagram.com/reel/DU92TGLlA4w/embed"
  }
];

let productCatalog = [];
let productById = new Map();
let filteredProducts = [];
let cart = JSON.parse(localStorage.getItem("seemaniCart")) || [];

function getStringCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getNumberCell(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function driveFileToPublicImageUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
}

function normalizeProductRow(row) {
  const sku = getStringCell(row.sku || row.SKU || row.id || row.ID);
  if (!sku) return null;

  const name = getStringCell(row.productName || row["Product Name"] || row.name || sku);
  const category = getStringCell(row.productCategory || row["Product Catagory"] || row["Product Category"] || row.category || "Uncategorized");
  const type = getStringCell(row.type || row.Type);
  const marketPrice = getNumberCell(row.marketPrice || row["Market Price"] || row.price, 0);
  const quantity = getNumberCell(row.quantity || row.Quantity, 0);
  const extraDeliveryCharges = getNumberCell(row.extraDeliveryCharges || row["Extra Delivery charges"] || 0, 0);

  return {
    id: sku,
    sku,
    name: name || sku,
    category,
    type,
    quantity,
    price: marketPrice,
    extraDeliveryCharges,
    image: FALLBACK_IMAGE,
    images: [],
    description: getStringCell(row.description || row.Description || row.details || row.Details),
    reels: [],
    featuredOrder: 0,
    variantOf: null,
    variantIndex: 1,
    variantCount: 1
  };
}

function toSlug(value) {
  return getStringCell(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseImagesField(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => getStringCell(item)).filter(Boolean);
  }

  const text = getStringCell(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => getStringCell(item)).filter(Boolean);
    }
  } catch (error) {
    // no-op: plain delimited string fallback below
  }

  return text
    .split(/[|,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseReelsField(value) {
  const rawItems = parseImagesField(value);
  return rawItems.map((item, index) => ({
    title: `Product Reel ${index + 1}`,
    embedUrl: item
  }));
}

function getProductAssetImageCandidates(sku) {
  if (!sku) return [FALLBACK_IMAGE];
  const safeSku = encodeURIComponent(String(sku).trim());
  const imageNames = ["image", "1", "2", "3", "4", "5"];
  const imageExtensions = ["jpg", "jpeg", "png"];

  const candidates = imageNames.flatMap((name) => imageExtensions.map((ext) => `assets/products/${safeSku}/${name}.${ext}`));

  return candidates;
}

function buildWhatsAppOrderMessage(orderPayload) {
  const { name, phone, address, product } = orderPayload;
  return [
    "Hello Seemani, new order placed:",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Address: ${address}`,
    `Products: ${product}`
  ].join("\n");
}

function openWhatsAppChannelWithOrder(orderPayload) {
  const message = buildWhatsAppOrderMessage(orderPayload);
  const hasQuery = WHATSAPP_CHANNEL_URL.includes("?");
  const separator = hasQuery ? "&" : "?";
  const url = `${WHATSAPP_CHANNEL_URL}${separator}text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function imageExists(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${url}?v=${Date.now()}`;
  });
}

async function resolveAssetImagesForSku(sku) {
  const candidates = getProductAssetImageCandidates(sku);
  const checks = await Promise.all(candidates.map((url) => imageExists(url)));
  const existing = candidates.filter((_, index) => checks[index]);
  return existing.length ? existing : [FALLBACK_IMAGE];
}

function parseSheetRowsFromGviz(rawText) {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Unexpected Google Sheet response format.");
  }

  const jsonText = rawText.slice(start, end + 1);
  const data = JSON.parse(jsonText);
  const cols = data?.table?.cols || [];
  const rows = data?.table?.rows || [];

  const keys = cols.map((col, index) => {
    const label = getStringCell(col.label);
    if (label) return label;
    const id = getStringCell(col.id);
    return id || `column_${index}`;
  });

  return rows.map((row) => {
    const mapped = {};
    (row.c || []).forEach((cell, index) => {
      mapped[keys[index]] = cell?.v ?? "";
    });
    return mapped;
  });
}

async function loadSheetProducts() {
  const params = new URLSearchParams({
    tqx: "out:json",
    sheet: GOOGLE_SHEET_PRODUCTS.sheetName
  });

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_PRODUCTS.sheetId}/gviz/tq?${params.toString()}`;
  const response = await fetch(sheetUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load product rows from Google Sheet.");
  }

  const rawText = await response.text();
  const rows = parseSheetRowsFromGviz(rawText);

  return rows
    .map(normalizeProductRow)
    .filter(Boolean)
    .map((item, index) => ({ ...item, featuredOrder: index }));
}

async function loadSkuImageMapFromDrive() {
  const folderListQuery = `'${GOOGLE_DRIVE_IMAGES.rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const folderUrl = new URL("https://www.googleapis.com/drive/v3/files");
  folderUrl.searchParams.set("key", GOOGLE_DRIVE_IMAGES.apiKey);
  folderUrl.searchParams.set("fields", "files(id,name)");
  folderUrl.searchParams.set("q", folderListQuery);
  folderUrl.searchParams.set("pageSize", "1000");

  const folderResponse = await fetch(folderUrl.toString(), { cache: "no-store" });
  if (!folderResponse.ok) {
    throw new Error("Unable to list SKU folders from Google Drive.");
  }

  const folderData = await folderResponse.json();
  const skuFolders = folderData.files || [];

  const skuImageEntries = await Promise.all(
    skuFolders.map(async (folder) => {
      const fileQuery = `'${folder.id}' in parents and mimeType contains 'image/' and trashed = false`;
      const imageUrl = new URL("https://www.googleapis.com/drive/v3/files");
      imageUrl.searchParams.set("key", GOOGLE_DRIVE_IMAGES.apiKey);
      imageUrl.searchParams.set("fields", "files(id,name),nextPageToken");
      imageUrl.searchParams.set("q", fileQuery);
      imageUrl.searchParams.set("orderBy", "name");
      imageUrl.searchParams.set("pageSize", "1000");

      const imageResponse = await fetch(imageUrl.toString(), { cache: "no-store" });
      if (!imageResponse.ok) {
        return [folder.name, []];
      }

      const imageData = await imageResponse.json();
      const images = (imageData.files || []).map((file) => ({
        id: file.id,
        name: file.name,
        url: driveFileToPublicImageUrl(file.id)
      }));

      return [folder.name, images];
    })
  );

  return new Map(skuImageEntries);
}

function applyDriveImagesAsVariants(products, skuImageMap) {
  const expanded = [];

  products.forEach((product, index) => {
    const images = skuImageMap.get(product.sku) || [];

    if (!images.length) {
      expanded.push({ ...product, featuredOrder: expanded.length || index });
      return;
    }

    const variantCount = images.length;

    images.forEach((image, imageIndex) => {
      expanded.push({
        ...product,
        id: variantCount > 1 ? `${product.sku}-v${imageIndex + 1}` : product.sku,
        name: variantCount > 1 ? `${product.name} (Variant ${imageIndex + 1})` : product.name,
        image: image.url,
        variantOf: product.sku,
        variantIndex: imageIndex + 1,
        variantCount,
        featuredOrder: expanded.length
      });
    });
  });

  return expanded;
}


async function loadBaseCatalogFromJson() {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load product catalog JSON.");
  }

  const rawText = await response.text();
  let items = [];

  try {
    const data = JSON.parse(rawText);
    if (Array.isArray(data)) {
      items = data.map((item) => ({
        ...item,
        sku: item.sku || item.id,
        id: item.id || item.sku
      }));
    }
  } catch (error) {
    const rows = parseSheetRowsFromGviz(rawText);
    items = rows.map(normalizeProductRow).filter(Boolean);
  }

  if (!items.length) {
    throw new Error("Catalog JSON is empty or malformed.");
  }

  const mappedProducts = items.map((item, index) => {
    const sku = item.sku || item.id;
    const imagesFromJson = parseImagesField(item.images || item.galleryImages || item.productImages);
    const fallbackPrimary = `assets/products/${encodeURIComponent(String(sku).trim())}/image.jpg`;
    const resolvedImages = imagesFromJson.length
      ? imagesFromJson
      : [item.image || fallbackPrimary || FALLBACK_IMAGE];

    return {
      ...item,
      id: item.id || sku,
      sku,
      image: item.image || resolvedImages[0] || FALLBACK_IMAGE,
      images: resolvedImages,
      description: getStringCell(item.description || item.productDescription || item.details),
      reels: parseReelsField(item.reels || item.reelsLinks || item.productReels),
      featuredOrder: index,
      variantOf: sku,
      variantIndex: 1,
      variantCount: 1
    };
  });

  return mappedProducts;
}

function refreshCatalogData(items) {
  productCatalog = items;
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
    const textBlob = `${product.name} ${product.sku || ""} ${product.type || ""}`.toLowerCase();
    const queryMatch = !query || textBlob.includes(query);
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
      const cartQty = getCartQuantityForProduct(product.id);
      const card = document.createElement("article");
      card.className = "product-card";
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.addEventListener("click", () => openProductDetail(product.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProductDetail(product.id);
        }
      });
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';">
        <div class="content">
          <h3>${product.name}</h3>
          <p class="meta">${product.category}${product.type ? ` • ${product.type}` : ""}</p>
          <p class="meta">SKU: ${product.sku}</p>
          <p class="price">₹${product.price}</p>
          ${
            cartQty > 0
              ? `<div class="qty-controls card-qty" role="group" aria-label="Quantity picker for ${product.name}" onclick="event.stopPropagation()">
                   <button class="qty-btn" type="button" onclick="event.stopPropagation();changeProductCardCartQuantity('${product.id}', -1)">−</button>
                   <span class="qty-value" id="qty-${product.id}">${cartQty}</span>
                   <button class="qty-btn" type="button" onclick="event.stopPropagation();changeProductCardCartQuantity('${product.id}', 1)">+</button>
                 </div>`
              : `<button class="btn-main" type="button" onclick="event.stopPropagation();addToCart('${product.id}')">Add to Cart</button>`
          }
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

function getSafeReels(product) {
  if (Array.isArray(product.reels) && product.reels.length) {
    return product.reels;
  }
  return DEFAULT_REELS;
}

function buildProductGallery(images, productName) {
  return images
    .map(
      (imageUrl, index) => `
      <figure class="product-gallery-item">
        <img src="${imageUrl}" alt="${productName} image ${index + 1}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';">
      </figure>
    `
    )
    .join("");
}

function buildProductReels(reels) {
  const multipleReels = reels.length > 1;

  return reels
    .map(
      (reel) => `
      <article class="reel-card${multipleReels ? " reel-card-multiple" : " reel-card-single"}">
        <h4>${reel.title || "Product Reel"}</h4>
        <div class="reel-embed-wrap">
          <iframe
            src="${reel.embedUrl}"
            loading="lazy"
            allowfullscreen
            title="${reel.title || "Product Reel"}">
          </iframe>
        </div>
      </article>
    `
    )
    .join("");
}

async function openProductDetail(productId) {
  const product = productById.get(productId);
  const detailSection = document.getElementById("productDetail");
  const detailBody = document.getElementById("productDetailBody");
  if (!product || !detailSection || !detailBody) return;

  const detailDescription = product.description || `${product.name} is a premium ${product.category} design made to elevate your look.`;
  let detailImages = Array.isArray(product.images) && product.images.length ? product.images : [product.image || FALLBACK_IMAGE];

  if ((!product.images || product.images.length <= 1) && (!product.images?.[0] || product.images[0].includes(`/image.jpg`))) {
    detailImages = await resolveAssetImagesForSku(product.sku);
    product.images = detailImages;
    product.image = detailImages[0] || product.image;
  }
  const reels = getSafeReels(product);
  const slug = toSlug(product.name || product.sku);

  detailBody.innerHTML = `
    <div class="product-detail-grid">
      <div class="product-gallery">${buildProductGallery(detailImages, product.name)}</div>
      <div class="product-detail-content">
        <p class="product-chip">${product.category}</p>
        <h2>${product.name}</h2>
        <p class="product-detail-price">₹${product.price}</p>
        <p class="product-detail-description">${detailDescription}</p>
        <dl class="product-specs">
          <div><dt>SKU</dt><dd>${product.sku}</dd></div>
          <div><dt>Type</dt><dd>${product.type || "Classic"}</dd></div>
          <div><dt>Available Qty</dt><dd>${product.quantity ?? "NA"}</dd></div>
          <div><dt>Extra Delivery</dt><dd>₹${product.extraDeliveryCharges || 0}</dd></div>
          <div><dt>Handle</dt><dd>@${slug || "seemani-style"}</dd></div>
        </dl>
        <button class="btn-main" type="button" onclick="addToCart('${product.id}')">Add to Cart</button>
      </div>
    </div>
    <div class="product-reels-wrap">
      <h3>Style Reels for this Product</h3>
      <div class="product-reels-grid ${reels.length > 1 ? "product-reels-grid-multiple" : "product-reels-grid-single"}">
        ${buildProductReels(reels)}
      </div>
    </div>
  `;

  detailSection.classList.remove("product-detail-hidden");
  detailSection.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProductDetail() {
  const detailSection = document.getElementById("productDetail");
  if (!detailSection) return;
  detailSection.classList.add("product-detail-hidden");
  detailSection.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function getCartQuantityForProduct(productId) {
  const existing = cart.find((item) => item.id === productId);
  return existing ? existing.quantity : 0;
}

function addToCart(productId) {
  const product = productById.get(productId);
  if (!product) return;

  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  saveCart();
  updateCartToggleCount();
  renderCart();
  renderCheckoutSummary();
  renderProducts();
}

function changeProductCardCartQuantity(productId, change) {
  updateCartQuantity(productId, change);
}

function updateCartQuantity(productId, change) {
  cart = cart
    .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + change } : item))
    .filter((item) => item.quantity > 0);

  saveCart();
  updateCartToggleCount();
  renderCart();
  renderCheckoutSummary();
  renderProducts();
}

function deleteFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);

  saveCart();
  updateCartToggleCount();
  renderCart();
  renderCheckoutSummary();
  renderProducts();
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
  updateCartToggleCount();
  renderCart();
  renderCheckoutSummary();
  renderProducts();
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

function updateCartToggleCount() {
  const cartToggleBtn = document.getElementById("cartToggleBtn");
  if (!cartToggleBtn) return;
  const { count } = getCartTotals();
  cartToggleBtn.textContent = `Cart (${count})`;
}

function toggleCartVisibility() {
  const cartSection = document.getElementById("cart");
  if (!cartSection) return;
  const isHidden = cartSection.classList.contains("cart-hidden");
  cartSection.classList.toggle("cart-hidden", !isHidden);
  cartSection.setAttribute("aria-hidden", String(!isHidden));

  if (isHidden) {
    cartSection.scrollIntoView({ behavior: "smooth" });
  }
}

function setupCartTools() {
  const cartToggleBtn = document.getElementById("cartToggleBtn");
  const pasteCouponBtn = document.getElementById("pasteCouponBtn");
  const couponInput = document.getElementById("couponInput");

  cartToggleBtn?.addEventListener("click", toggleCartVisibility);

  pasteCouponBtn?.addEventListener("click", async () => {
    if (!couponInput) return;
    try {
      const text = await navigator.clipboard.readText();
      couponInput.value = text.trim();
    } catch (error) {
      console.error(error);
      alert("Clipboard access failed. Please paste coupon manually.");
    }
  });
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
  const productDetailCloseBtn = document.getElementById("productDetailCloseBtn");
  const productDetailOverlay = document.getElementById("productDetailOverlay");
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

  productDetailCloseBtn?.addEventListener("click", closeProductDetail);
  productDetailOverlay?.addEventListener("click", closeProductDetail);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProductDetail();
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
      openWhatsAppChannelWithOrder(orderPayload);
      if (orderStatus) {
        orderStatus.innerHTML = `✅ Order submitted successfully! <a href="${WHATSAPP_CHANNEL_URL}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>`;
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

function setupWhatsAppChatLinks() {
  const links = document.querySelectorAll("[data-whatsapp-channel-link]");
  links.forEach((link) => {
    link.setAttribute("href", WHATSAPP_CHANNEL_URL);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });
}

async function loadRuntimeCatalog() {
  if (!GOOGLE_SHEET_PRODUCTS.enabled || !GOOGLE_SHEET_PRODUCTS.sheetId) {
    return loadBaseCatalogFromJson();
  }

  const sheetProducts = await loadSheetProducts();

  if (!GOOGLE_DRIVE_IMAGES.enabled || !GOOGLE_DRIVE_IMAGES.apiKey || !GOOGLE_DRIVE_IMAGES.rootFolderId) {
    return sheetProducts;
  }

  const skuImageMap = await loadSkuImageMapFromDrive();
  return applyDriveImagesAsVariants(sheetProducts, skuImageMap);
}

async function initializeApp() {
  try {
    const needsCatalog = Boolean(document.getElementById("productGrid"));

    if (needsCatalog) {
      const runtimeCatalog = await loadRuntimeCatalog();
      refreshCatalogData(runtimeCatalog);
      updateCategoryFilter();
    }

    setupCatalogControls();
    setupCartTools();
    setupCheckoutForm();
    setupWhatsAppChatLinks();
    renderProducts();
    renderCart();
    renderCheckoutSummary();
    updateCartToggleCount();
  } catch (error) {
    console.error(error);
    const catalogMeta = document.getElementById("catalogMeta");
    if (catalogMeta) {
      catalogMeta.textContent = "Failed to load catalogue. Check Google Sheet/Drive config or assets/products/catalog.json.";
    }
  }
}

initializeApp();

window.goToCheckout = goToCheckout;
window.clearCart = clearCart;
window.addToCart = addToCart;
window.changeProductCardCartQuantity = changeProductCardCartQuantity;
window.increaseCartQuantity = increaseCartQuantity;
window.decreaseCartQuantity = decreaseCartQuantity;
window.deleteFromCart = deleteFromCart;
window.openProductDetail = openProductDetail;
