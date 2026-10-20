(() => {
  const grid = document.getElementById("product-grid");
  const search = document.getElementById("search");
  const filters = [...document.querySelectorAll(".filter")];
  const note = document.getElementById("catalog-note");
  let products = [];
  let category = "all";

  const palettes = {
    birthday: ["#ffe5d9", "#f7d2d8"], love: ["#f9dce7", "#f4e2ef"],
    memories: ["#e7e5fa", "#f3e5f0"], anniversary: ["#f7dce2", "#f7e9d9"],
    friends: ["#dff0e8", "#e6e6fb"], family: ["#fae7cf", "#f7dce5"]
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function sitePath(path) {
    if (!path || !path.startsWith("/")) return path || "mailto:hello@seemani.in";
    const prefix = location.hostname === "shrikantgourh.github.io" ? "/seemani.github.io" : "";
    return prefix + path;
  }

  function card(product, index) {
    const colors = palettes[product.theme] || palettes.birthday;
    const available = product.status === "available";
    const label = product.badge || product.category;
    const url = sitePath(product.url || "mailto:hello@seemani.in");
    const action = available ? "Create your gift" : (product.status === "preview" ? "Ask about this gift" : "Coming soon");
    const image = product.image ? `<img class="product-image" src="${escapeHTML(product.image)}" alt="" loading="lazy" onerror="this.remove()">` : "";
    return `<article class="product-card" style="animation-delay:${Math.min(index*70,420)}ms">
      <div class="product-art" style="background:linear-gradient(135deg,${colors[0]},${colors[1]})">
        ${image}<span class="product-label">${escapeHTML(label)}</span><span class="product-emoji" aria-hidden="true">${escapeHTML(product.emoji || "🎁")}</span>
      </div>
      <div class="product-info"><h3>${escapeHTML(product.title)}</h3><p>${escapeHTML(product.description)}</p>
        <div class="product-bottom"><span class="price ${product.priceLabel === "Free" ? "free" : ""}">${escapeHTML(product.priceLabel || "Explore")}</span>
        <a class="product-link" href="${escapeHTML(url)}">${action} <span aria-hidden="true">↗</span></a></div>
      </div>
    </article>`;
  }

  function render() {
    const term = search.value.trim().toLowerCase();
    const visible = products.filter(p => (category === "all" || p.category === category) &&
      [p.title, p.description, p.category, p.badge].some(v => String(v || "").toLowerCase().includes(term)));
    grid.innerHTML = visible.length ? visible.map((product,index) => card(product,index)).join("") :
      '<div class="empty-state">No gifts match that search yet. Try another word or choose “All gifts”.</div>';
    note.textContent = products.length ? "For the words you keep in your heart and the moments you wish could last forever. ♡" : "We couldn't load the catalogue. Please refresh the page.";
  }

  filters.forEach(button => button.addEventListener("click", () => {
    category = button.dataset.category;
    filters.forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    render();
  }));
  search.addEventListener("input", render);
  document.getElementById("year").textContent = new Date().getFullYear();

  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : new URL("store.js", location.href).href;
  const catalogueUrl = new URL("products.json", scriptUrl);
  fetch(catalogueUrl, { headers: { "Accept": "application/json" } })
    .then(response => { if (!response.ok) throw new Error("Catalogue unavailable"); return response.json(); })
    .then(data => {
      if (!Array.isArray(data)) throw new Error("Invalid catalogue");
      products = data;
      render();
    })
    .catch(() => {
      grid.innerHTML = '<div class="empty-state">Our gift collection is taking a little break. Please try again soon.</div>';
      note.textContent = "If the issue continues, contact hello@seemani.in.";
    });
})();