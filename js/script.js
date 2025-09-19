
const STORAGE_KEY = 'mequi_cart_v1';

// Productos incrustados directamente
const products = [
  { "id":1,"name":"Auriculares Gamer","price":32000,"stock":10,"description":"Auriculares con micrófono y RGB." },
  { "id":2,"name":"Mouse Óptico","price":78500,"stock":15,"description":"Mouse ergonómico 16000 DPI." },
  { "id":3,"name":"Teclado Mecánico","price":115000,"stock":5,"description":"Switches azules, retroiluminado." }
];

// Cargar SweetAlert2 dinámicamente
function loadSwal() {
  return new Promise((res, rej) => {
    if (window.Swal) return res(window.Swal);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    s.onload = () => res(window.Swal);
    s.onerror = () => rej(new Error('No se pudo cargar SweetAlert2'));
    document.head.appendChild(s);
  });
}

/* ---------------- Modelo: Cart ---------------- */
class Cart {
  constructor() {
    this.items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }
  save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)); }
  find(id) { return this.items.find(i => i.id === id); }
  add(product, qty = 1) {
    const existing = this.find(product.id);
    if (existing) {
      existing.qty = Math.min(product.stock, existing.qty + qty);
    } else {
      this.items.push({ id: product.id, qty: Math.min(qty, product.stock), product });
    }
    this.save();
  }
  updateQty(id, qty) {
    const it = this.find(id);
    if (!it) return;
    it.qty = Math.max(0, Math.min(it.product.stock, qty));
    if (it.qty === 0) this.remove(id);
    this.save();
  }
  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  }
  clear() { this.items = []; this.save(); }
  total() { return this.items.reduce((s, i) => s + i.product.price * i.qty, 0); }
  count() { return this.items.reduce((s, i) => s + i.qty, 0); }
}

/* ---------------- Selectores DOM ---------------- */
const productListEl = document.getElementById('product-list');
const productSelectEl = document.getElementById('product-select');
const quantityInputEl = document.getElementById('quantity-input');
const addToCartForm = document.getElementById('add-to-cart-form');
const cartItemsEl = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const clearCartBtn = document.getElementById('clear-cart-btn');

const cart = new Cart();
let SwalLib = null;

/* ---------------- Render: Productos (grid) ---------------- */
function renderProductsGrid() {
  productListEl.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description)}</p>
      <p><strong>Precio:</strong> $${Number(p.price).toLocaleString()}</p>
      <p class="small-note"><strong>Stock:</strong> ${p.stock}</p>
      <div style="margin-top:.5rem;width:100%;display:flex;gap:.5rem">
        <button class="btn" data-id="${p.id}" data-action="add-card">Agregar 1</button>
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
      const existingQty = (cart.find(p.id) || {}).qty || 0;
      if (existingQty >= p.stock) {
        showToast(`Stock insuficiente de ${p.name}`);
        return;
      }
      cart.add(p, 1);
      renderCart();
      showToast(`Agregado ${p.name}`);
    });
  });
}

/* ---------------- Populate select ---------------- */
function populateSelect() {
  productSelectEl.innerHTML = '';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} — $${Number(p.price).toLocaleString()} (stock: ${p.stock})`;
    productSelectEl.appendChild(opt);
  });
}

/* ---------------- Form: agregar al carrito ---------------- */
addToCartForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = Number(productSelectEl.value);
  let qty = Number(quantityInputEl.value) || 1;
  const p = products.find(x => x.id === id);
  if (!p) return alert('Producto no válido');
  if (qty < 1) qty = 1;
  const existingQty = (cart.find(p.id) || {}).qty || 0;
  if (existingQty + qty > p.stock) {
    const allowed = p.stock - existingQty;
    if (allowed <= 0) {
      showToast(`No queda stock disponible de ${p.name}`);
      return;
    } else {
      qty = allowed;
      showToast(`Solo se agregaron ${allowed} unidades de ${p.name} (límite por stock)`);
    }
  }
  cart.add(p, qty);
  renderCart();
  quantityInputEl.value = '1';
});

/* ---------------- Render carrito ---------------- */
function renderCart() {
  cartItemsEl.innerHTML = '';
  if (cart.items.length === 0) {
    cartItemsEl.innerHTML = '<p>El carrito está vacío.</p>';
    cartTotalEl.textContent = (0).toFixed(2);
    return;
  }

  cart.items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(it.product.name)}</strong>
        <div>$${Number(it.product.price).toLocaleString()} c/u</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem">
        <input type="number" class="qty-input" min="1" max="${it.product.stock}" value="${it.qty}" data-id="${it.id}">
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
      const it = cart.find(id);
      if (!it) return;
      if (qty > it.product.stock) {
        qty = it.product.stock;
        e.target.value = qty;
        showToast(`Cantidad ajustada a stock máximo (${qty})`);
      } else if (qty < 1) {
        qty = 1;
        e.target.value = 1;
      }
      cart.updateQty(id, qty);
      renderCart();
    });
  });

  cartItemsEl.querySelectorAll('button.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      cart.remove(id);
      renderCart();
      showToast('Artículo eliminado');
    });
  });

  cartTotalEl.textContent = cart.total().toFixed(2);
}

/* ---------------- Limpiar carrito ---------------- */
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
});

/* ---------------- Utils ---------------- */
function showToast(msg) {
  if (SwalLib) {
    SwalLib.fire({ toast:true, position:'top-end', icon:'success', title: msg, showConfirmButton:false, timer:1200 });
  } else {
    console.log(msg);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

/* ---------------- Inicio ---------------- */
(async function init(){
  try {
    try { SwalLib = await loadSwal(); } catch(e) { console.warn('No se cargó SweetAlert2, se usarán fallbacks'); }
    renderProductsGrid();
    populateSelect();
    renderCart();
  } catch (err) {
    console.error('Error init', err);
  }
})();
