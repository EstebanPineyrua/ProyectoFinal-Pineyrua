const STORAGE_KEY = 'mequi_cart_v1';
let products = []; // Array vacío para los productos cargados por fetch

// Cargar SweetAlert2 dinámicamente
function loadSwal() {
  return new Promise((res, rej) => {
    if (window.Swal) return res(window.Swal);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    s.onload = () => res(window.Swal);
    document.head.appendChild(s);
  });
}

// ---------------- Modelo: Cart ----------------
class Cart {
  constructor() {
    this.items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }
  save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)); }
  find(id) { return this.items.find(i => i.id === id); }
  
  add(product, qty = 1) {
    const mainProduct = products.find(p => p.id === product.id);
    if (!mainProduct) return;

    if (mainProduct.stock <= 0) {
      showToast("error", `Stock insuficiente de ${product.name}`);
      return;
    }
    
    const existing = this.find(product.id);
    let finalQty = Math.min(qty, mainProduct.stock);

    if (existing) {
      existing.qty += finalQty;
    } else {
      this.items.push({ id: product.id, qty: finalQty, product });
    }
    
    mainProduct.stock -= finalQty;
    this.save();
  }

  updateQty(id, qty) {
    const it = this.find(id);
    if (!it) return;
    
    const mainProduct = products.find(p => p.id === id);
    if (!mainProduct) return;

    const oldQty = it.qty;
    const newQty = Math.max(0, qty);
    const availableStock = mainProduct.stock + oldQty;
    
    if (newQty > availableStock) {
      showToast("error", `Cantidad ajustada a stock máximo (${availableStock})`);
      it.qty = availableStock;
    } else {
      it.qty = newQty;
    }

    const delta = it.qty - oldQty;
    mainProduct.stock -= delta;
    
    if (it.qty === 0) {
      this.remove(id);
    }

    this.save();
  }

  remove(id) {
    const it = this.find(id);
    if (!it) return;
    
    const mainProduct = products.find(p => p.id === id);
    if (mainProduct) {
      mainProduct.stock += it.qty;
    }
    
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  }
  
  clear() {
    this.items.forEach(it => {
      const mainProduct = products.find(p => p.id === it.id);
      if (mainProduct) {
        mainProduct.stock += it.qty;
      }
    });
    this.items = [];
    this.save();
  }
  
  total() { return this.items.reduce((s, i) => s + i.product.price * i.qty, 0); }
  count() { return this.items.reduce((s, i) => s + i.qty, 0); }
}

// ---------------- Selectores DOM ----------------
const productListEl = document.getElementById('product-list');
const productSelectEl = document.getElementById('product-select');
const quantityInputEl = document.getElementById('quantity-input');
const addToCartForm = document.getElementById('add-to-cart-form');
const cartItemsEl = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const clearCartBtn = document.getElementById('clear-cart-btn');

const cart = new Cart();
let SwalLib = null;

// ---------------- Render: Productos (grid) ----------------
function renderProductsGrid() {
  productListEl.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${p.img}" alt="${escapeHtml(p.name)}">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description)}</p>
      <p><strong>Precio:</strong> $${Number(p.price).toLocaleString()}</p>
      <p class="small-note"><strong>Stock:</strong> ${p.stock}</p>
      <div class="card-button-container">
        <button class="btn" data-id="${p.id}" data-action="add-card" ${p.stock <= 0 ? 'disabled' : ''}>Agregar</button>
      </div>
    `;
    productListEl.appendChild(card);
  });

  // botones "Agregar" en tarjetas
  productListEl.querySelectorAll('button[data-action="add-card"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const p = products.find(x => x.id === id);
      if (!p) return;
      if (p.stock <= 0) {
        showToast("error", `Stock insuficiente de ${p.name}`);
        return;
      }
      cart.add(p, 1);
      renderCart();
      renderProductsGrid();
      populateSelect(); 
      showToast("success", `Agregado ${p.name}`);
    });
  });
}

// ---------------- Populate select ----------------
function populateSelect() {
  productSelectEl.innerHTML = '';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} — $${Number(p.price).toLocaleString()} (Stock: ${p.stock})`;
    if (p.stock <= 0) {
      opt.disabled = true;
      opt.textContent += " (AGOTADO)";
    }
    productSelectEl.appendChild(opt);
  });
}

// ---------------- Form: agregar al carrito ----------------
addToCartForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = Number(productSelectEl.value);
  let qty = Number(quantityInputEl.value) || 1;
  const p = products.find(x => x.id === id);
  if (!p) return alert('Producto no válido');
  
  if (qty < 1) qty = 1;
  
  const existingQtyInCart = (cart.find(p.id) || {}).qty || 0;
  
  const totalQtyRequested = existingQtyInCart + qty;
  
  if (totalQtyRequested > (p.stock + existingQtyInCart)) {
    const allowed = p.stock;
    if (allowed <= 0) {
      showToast("error", `No queda stock disponible de ${p.name}`);
      return;
    } else {
      qty = allowed;
      showToast("warning", `Solo se agregaron ${allowed} unidades de ${p.name} (límite por stock)`);
    }
  }

  cart.add(p, qty);
  renderCart();
  renderProductsGrid();
  populateSelect(); 
  quantityInputEl.value = '1';
});

// ---------------- Render carrito ----------------
function renderCart() {
  cartItemsEl.innerHTML = '';
  if (cart.items.length === 0) {
    cartItemsEl.innerHTML = '<p>El carrito está vacío.</p>';
    cartTotalEl.textContent = (0).toFixed(2);
    return;
  }

  cart.items.forEach(it => {
    const mainProduct = products.find(p => p.id === it.id);
    const maxQty = it.qty + mainProduct.stock;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(it.product.name)}</strong>
        <div>$${Number(it.product.price).toLocaleString()} c/u</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem">
        <input type="number" class="qty-input" min="1" max="${maxQty}" value="${it.qty}" data-id="${it.id}">
        <div style="display:flex;gap:.4rem;align-items:center">
          <div>$${(it.product.price * it.qty).toLocaleString()}</div>
          <button class="remove" data-id="${it.id}">Eliminar</button>
        </div>
      </div>
    `;
    cartItemsEl.appendChild(row);
  });

  // listeners para qty change y remove
  cartItemsEl.querySelectorAll('input.qty-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      let qty = Number(e.target.value) || 1;
      const id = Number(e.target.dataset.id);
      cart.updateQty(id, qty);
      renderCart();
      renderProductsGrid();
      populateSelect(); 
    });
  });

  cartItemsEl.querySelectorAll('button.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      cart.remove(id);
      renderCart();
      renderProductsGrid();
      populateSelect(); 
      showToast("success", 'Artículo eliminado');
    });
  });

  cartTotalEl.textContent = cart.total().toFixed(2);
}

// ---------------- Limpiar carrito ----------------
clearCartBtn.addEventListener('click', async () => {
  if (SwalLib) {
    const { isConfirmed } = await SwalLib.fire({
      title: 'Vaciar carrito',
      text: '¿Estás seguro?',
      icon: 'warning',
      showCancelButton: true
    });
    if (!isConfirmed) return;
  } else {
    if (!confirm('Vaciar carrito?')) return;
  }
  cart.clear();
  renderCart();
  renderProductsGrid();
  populateSelect(); 
});

// ---------------- Utils ----------------
function showToast(icon, msg) {
  if (SwalLib) {
    SwalLib.fire({ 
      toast:true, 
      position:'top-end', 
      icon: icon, 
      title: msg, 
      showConfirmButton:false, 
      timer:1200 
    });
  } else {
    console.log(msg);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

// ----------------Fetch ----------------
async function fetchProducts() {
  try {
    const res = await fetch('/ProyectoFinal-Pineyrua/data/products.json');
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    products = await res.json();
  } catch (err) {
    console.error('Error al cargar los datos:', err);
    productListEl.innerHTML = '<p>Error al cargar los productos. Por favor, intente de nuevo más tarde.</p>';
  }
}

// ---------------- Inicio ----------------
(async function init(){
  try {
    await fetchProducts();
    try { SwalLib = await loadSwal(); } catch(e) { console.warn('No se cargó SweetAlert2, se usarán fallbacks'); }
    renderProductsGrid();
    populateSelect();
    renderCart();
  } catch (err) {
    console.error('Error en la inicialización:', err);
  }
})();