// pos-modal.js — Componente Modal de Venta Directa (POS Express)
import { showToast } from '../utils/toast.js';
import { 
  getActiveBusinessId, 
  getServices, 
  fetchProfessionals, 
  searchClientsByName, 
  createInvoice,
  getActiveBusiness
} from '../utils/businessState.js';
import { generateClientTicket, generateServiceTicket } from '../utils/pdf.js';
import { supabase } from '../core/supabase.js';
import { descontarStockPorVenta } from '../utils/inventory.js';

export async function openPosModal({ onSave = null, appointmentContext = null } = {}) {
  const bizId = getActiveBusinessId();
  const business = getActiveBusiness();
  
  // Cargar servicios, profesionales y productos activos
  const [servicesData, professionalsData, sellableProductsResult] = await Promise.all([
    getServices(bizId),
    fetchProfessionals(bizId),
    supabase
      .from('inventory_products')
      .select('id, name, brand, unit_type, unit_label, sale_price, stock_current')
      .eq('business_id', bizId)
      .eq('is_sellable', true)
      .eq('is_active', true)
      .gt('stock_current', 0)
      .order('name', { ascending: true })
  ]);

  const SERVICES = servicesData.filter(s => s.active !== false);
  const professionals = professionalsData.filter(p => p.active !== false);
  const PRODUCTS = sellableProductsResult.data || [];

  // Asegurar que no haya otro modal duplicado
  const existing = document.getElementById('pos-modal-root');
  if (existing) existing.remove();

  // Contenedor principal
  const root = document.createElement('div');
  root.id = 'pos-modal-root';
  root.className = 'apt-modal-overlay';

  let selectedServices = [];
  let selectedProducts = []; // { id, name, qty, unit_price, subtotal }

  if (appointmentContext) {
    const contextServiceIds = (appointmentContext.rawServices || []).map(s => s.service_id);
    SERVICES.forEach(srv => {
      if (contextServiceIds.includes(srv.id)) {
        selectedServices.push(srv);
      }
    });
  }

  root.innerHTML = `
    <div class="apt-modal" role="dialog" aria-modal="true" style="max-width: 1050px; width: 95vw; height: 85vh; max-height: 750px; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: var(--radius-md); box-shadow: var(--shadow-card);">
      
      <!-- HEADER -->
      <div class="apt-modal-header" style="padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--border-soft); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; background: var(--bg-card);">
        <h2 style="margin: 0; font-size: var(--text-base); font-weight: 800; display: flex; align-items: center; gap: var(--space-2);">
          <i data-lucide="receipt" style="color: var(--accent-neon); width: 20px; height: 20px;"></i>
          Venta Directa (POS)
        </h2>
        <button class="apt-modal-close" id="pos-modal-close-btn" aria-label="Cerrar" style="width: 32px; height: 32px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; background: transparent; cursor: pointer; color: var(--text-secondary); transition: all var(--transition-base);">
          <i data-lucide="x" style="width: 18px; height: 18px;"></i>
        </button>
      </div>

      <!-- MAIN LAYOUT CONTAINER -->
      <div class="pos-layout" style="display: flex; flex-grow: 1; min-height: 0; overflow: hidden;">
        
        <!-- LEFT PANEL: CLIENT & CATALOG -->
        <div class="pos-left-panel" style="flex: 1.3; display: flex; flex-direction: column; padding: var(--space-4); overflow-y: auto; gap: var(--space-4); scrollbar-width: thin;">
          
          <!-- 👤 DATOS DEL CLIENTE (Compact) -->
          <div class="apt-modal-section" style="border: none; padding-bottom: 0; display: flex; flex-direction: column; gap: var(--space-2); background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: var(--space-3);">
            <div class="apt-modal-section-title" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: var(--space-2); margin-bottom: 0;">
              <i data-lucide="user" size="14"></i>
              Datos del Cliente
            </div>
            <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: var(--space-3);">
              <div class="form-group autocomplete-container" style="margin-bottom: 0;">
                <label for="pos-client-name" style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">Nombre completo *</label>
                <input type="text" id="pos-client-name" class="form-input" placeholder="Ej. Carlos Mendoza" autocomplete="off" required value="${appointmentContext ? appointmentContext.client : ''}" style="height: 36px; font-size: var(--text-xs);" />
              </div>
              <div class="form-group autocomplete-container" style="margin-bottom: 0;">
                <label for="pos-client-phone" style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">Teléfono (opcional)</label>
                <input type="tel" id="pos-client-phone" class="form-input" placeholder="Ej. 3001234567" autocomplete="off" value="${appointmentContext && appointmentContext.phone ? appointmentContext.phone : ''}" style="height: 36px; font-size: var(--text-xs);" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <input type="email" id="pos-client-email" class="form-input" placeholder="Email (opcional) — Ej. cliente@correo.com" value="${appointmentContext && appointmentContext.email ? appointmentContext.email : ''}" style="height: 32px; font-size: var(--text-xs); background: transparent; border-style: dashed;" />
            </div>
          </div>

          <!-- 📂 CATÁLOGO -->
          <div style="display: flex; flex-direction: column; flex-grow: 1; min-height: 250px; margin-bottom: var(--space-4);">
            
            <!-- TABS -->
            <div class="pos-catalog-tabs" style="display: flex; border-bottom: 1px solid var(--border-soft); gap: var(--space-2); margin-bottom: var(--space-3); flex-shrink: 0;">
              <button type="button" class="pos-tab-btn active" id="pos-tab-services" style="background: none; border: none; border-bottom: 2px solid var(--accent-neon); color: var(--text-primary); padding: var(--space-2) var(--space-4); font-weight: 700; font-size: var(--text-sm); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all var(--transition-base);">
                <i data-lucide="briefcase" size="14"></i> Servicios
              </button>
              <button type="button" class="pos-tab-btn" id="pos-tab-products" style="background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); padding: var(--space-2) var(--space-4); font-weight: 700; font-size: var(--text-sm); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all var(--transition-base);">
                <i data-lucide="package" size="14"></i> Productos
              </button>
            </div>

            <!-- PANEL SERVICIOS -->
            <div id="pos-panel-services" style="display: flex; flex-direction: column; flex-grow: 1;">
              <div class="apt-services-grid" id="pos-services-list" style="overflow-y: auto; max-height: 280px; scrollbar-width: thin; padding-right: 4px; margin-bottom: var(--space-4);">
                ${SERVICES.map((srv, index) => {
                  const isSelected = selectedServices.some(s => s.id === srv.id);
                  return `
                    <div class="apt-service-item ${isSelected ? 'selected' : ''}" data-index="${index}" data-id="${srv.id}" data-name="${srv.name}" data-price="${srv.price}">
                      <div class="apt-service-left">
                        <div class="apt-service-checkbox">
                          <i data-lucide="check" size="12"></i>
                        </div>
                        <div>
                          <div class="apt-service-name">${srv.name}</div>
                          <div class="apt-service-meta">${srv.duration} min</div>
                        </div>
                      </div>
                      <div class="apt-service-price">$${srv.price.toLocaleString('es-CO')}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- PANEL PRODUCTOS (Oculto inicialmente) -->
            <div id="pos-panel-products" style="display: none; flex-direction: column; flex-grow: 1;">
              ${PRODUCTS.length === 0 ? `
                <div style="text-align: center; padding: var(--space-6); color: var(--text-muted); font-size: var(--text-sm);">
                  No hay productos disponibles para venta directa.
                </div>
              ` : `
                <input
                  type="text"
                  id="pos-product-search"
                  class="form-input"
                  placeholder="Buscar producto en el inventario..."
                  style="margin-bottom: var(--space-3); height: 36px; font-size: var(--text-xs);"
                />
                <div class="apt-services-grid" id="pos-products-list" style="overflow-y: auto; max-height: 280px; scrollbar-width: thin; padding-right: 4px; margin-bottom: var(--space-4);">
                  ${PRODUCTS.map((p, index) => `
                    <div class="apt-service-item" data-index="${index}" data-id="${p.id}" data-name="${p.name}" data-price="${p.sale_price}">
                      <div class="apt-service-left">
                        <div class="apt-service-checkbox">
                          <i data-lucide="check" size="12"></i>
                        </div>
                        <div>
                          <div class="apt-service-name">${p.name}${p.brand ? ` <span style="color:var(--text-muted);font-weight:400;font-size:11px;">· ${p.brand}</span>` : ''}</div>
                          <div class="apt-service-meta">Stock: ${p.stock_current} ${p.unit_label || 'und'}</div>
                        </div>
                      </div>
                      <div class="apt-service-price">$${Number(p.sale_price).toLocaleString('es-CO')}</div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- RIGHT PANEL: CHECKOUT TERMINAL -->
        <div class="pos-right-panel" style="flex: 0.9; background: var(--bg-secondary); border-left: 1px solid var(--border-soft); display: flex; flex-direction: column; padding: var(--space-4); overflow-y: auto; gap: var(--space-4); scrollbar-width: thin;">
          
          <!-- UNIFIED CART LIST -->
          <div style="display: flex; flex-direction: column; flex-grow: 1; min-height: 180px; max-height: 250px;">
            <div class="apt-modal-section-title" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); flex-shrink: 0;">
              <i data-lucide="shopping-cart" size="14"></i>
              Detalle de la Venta
            </div>
            <div id="pos-unified-cart" style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-2); scrollbar-width: thin; padding-right: 4px;">
              <!-- Cargado dinámicamente -->
            </div>
          </div>

          <!-- Checkout setup -->
          <div style="display: flex; flex-direction: column; gap: var(--space-2); border-top: 1px solid var(--border-soft); padding-top: var(--space-3);">
            
            <!-- 👨‍💼 PROFESIONAL ASIGNADO -->
            <div class="form-group" style="margin-bottom: 0;">
              <label for="pos-prof-select" style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">Profesional que Atiende</label>
              <select class="form-input" id="pos-prof-select" style="height: 36px; font-size: var(--text-xs); padding-block: 0;">
                <option value="">Selecciona un profesional...</option>
                ${professionals.map(p => {
                  const isSelected = appointmentContext && appointmentContext.professional_id === p.id;
                  return `
                    <option value="${p.id}" data-name="${p.name}" ${isSelected ? 'selected' : ''}>${p.name}</option>
                  `;
                }).join('')}
              </select>
            </div>

            <!-- FORMA DE PAGO Y DESCUENTO -->
            <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: var(--space-2);">
              <div class="form-group" style="margin-bottom: 0;">
                <label for="pos-payment-method" style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">Método de Pago</label>
                <select class="form-input" id="pos-payment-method" style="height: 36px; font-size: var(--text-xs); padding-block: 0;">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="pos-discount" style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">Descuento (COP)</label>
                <input type="number" id="pos-discount" class="form-input" placeholder="0" min="0" value="0" style="height: 36px; font-size: var(--text-xs);" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label for="pos-notes" style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">Notas / Observaciones</label>
              <input type="text" id="pos-notes" class="form-input" placeholder="Ej. Pago dividido, propina..." value="${appointmentContext && appointmentContext.notes ? appointmentContext.notes : ''}" style="height: 36px; font-size: var(--text-xs);" />
            </div>
          </div>

          <!-- TOTALS SUMMARY -->
          <div class="pos-summary-bar" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-1); margin-top: auto; flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
              <span>Subtotal:</span>
              <strong id="pos-summary-subtotal">$0</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); color: #ff5a7a;">
              <span>Descuento:</span>
              <strong id="pos-summary-discount">-$0</strong>
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border-soft); margin-block: var(--space-1);">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--accent-neon);">
              <span>Total a Cobrar:</span>
              <strong id="pos-summary-total" style="font-size: var(--text-base); font-weight: 800; text-shadow: 0 0 10px rgba(179,136,255,0.25);">$0</strong>
            </div>
          </div>

          <!-- ACTIONS FOOTER -->
          <div style="display: flex; gap: var(--space-2); flex-shrink: 0;">
            <button class="btn btn-secondary" id="pos-cancel-btn" style="flex: 0.8; height: 38px; font-size: var(--text-xs);">Cancelar</button>
            <button class="btn btn-primary" id="pos-save-btn" style="flex: 1.2; height: 38px; font-size: var(--text-xs); display: flex; align-items: center; justify-content: center; gap: var(--space-2);">
              <i data-lucide="printer" size="14"></i>
              Cobrar e Imprimir
            </button>
          </div>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(root);

  // Inicializar Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: root });
  }

  // Elementos DOM
  const closeBtn = root.querySelector('#pos-modal-close-btn');
  const cancelBtn = root.querySelector('#pos-cancel-btn');
  const saveBtn = root.querySelector('#pos-save-btn');
  const nameInput = root.querySelector('#pos-client-name');
  const phoneInput = root.querySelector('#pos-client-phone');

  // Strict Phone validation constraints: only digits, max 10
  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 10) val = val.substring(0, 10);
    e.target.value = val;
  });
  const emailInput = root.querySelector('#pos-client-email');
  const servicesList = root.querySelector('#pos-services-list');
  const profSelect = root.querySelector('#pos-prof-select');
  const paymentMethodSelect = root.querySelector('#pos-payment-method');
  const discountInput = root.querySelector('#pos-discount');
  const notesInput = root.querySelector('#pos-notes');

  const subtotalText = root.querySelector('#pos-summary-subtotal');
  const discountText = root.querySelector('#pos-summary-discount');
  const totalText = root.querySelector('#pos-summary-total');
  const unifiedCart = root.querySelector('#pos-unified-cart');

  // Autocomplete
  const setupAutocomplete = (inputEl) => {
    let dropdown = null;
    const closeDropdown = () => {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
      }
    };

    inputEl.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      closeDropdown();
      if (!query || query.length < 2) return;

      searchClientsByName(query, bizId).then(matches => {
        if (!matches || matches.length === 0) return;

        dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        dropdown.innerHTML = matches.map(c => `
          <div class="autocomplete-item" data-name="${c.name}" data-phone="${c.phone || ''}" data-email="${c.email || ''}">
            <span class="autocomplete-item-name">${c.name}</span>
            <span class="autocomplete-item-phone">${c.phone || ''}</span>
          </div>
        `).join('');

        inputEl.parentNode.appendChild(dropdown);

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            nameInput.value = item.getAttribute('data-name');
            phoneInput.value = item.getAttribute('data-phone');
            emailInput.value = item.getAttribute('data-email');
            closeDropdown();
          });
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (dropdown && !inputEl.parentNode.contains(e.target)) {
        closeDropdown();
      }
    });
  };

  setupAutocomplete(nameInput);

  // Renderizar el carrito unificado
  const renderUnifiedCart = () => {
    if (!unifiedCart) return;

    if (selectedServices.length === 0 && selectedProducts.length === 0) {
      unifiedCart.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.35; text-align: center; padding: var(--space-4); margin: auto;">
          <i data-lucide="shopping-bag" style="width: 24px; height: 24px; margin-bottom: 6px; color: var(--text-muted);"></i>
          <p style="font-size: 11px; margin: 0; font-weight: 700; color: var(--text-muted);">Carrito vacío</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ node: unifiedCart });
      return;
    }

    const servicesHTML = selectedServices.map(s => `
      <div class="pos-cart-item service-item-row" style="display: flex; align-items: center; gap: var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-soft); border-radius: var(--radius-xs); padding: var(--space-2) var(--space-3);">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <span style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);">${s.name}</span>
          <span style="font-size: 9px; color: var(--accent-neon); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 4px; margin-top: 1px;">
            <i data-lucide="briefcase" style="width: 9px; height: 9px;"></i> Servicio
          </span>
        </div>
        <span style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);">$${s.price.toLocaleString('es-CO')}</span>
        <button class="pos-service-remove" data-id="${s.id}" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: var(--space-1); display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity var(--transition-base);">
          <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    `).join('');

    const productsHTML = selectedProducts.map((p, i) => `
      <div class="pos-cart-item product-item-row" style="display: flex; align-items: center; gap: var(--space-2); background: var(--bg-primary); border: 1px solid var(--border-soft); border-radius: var(--radius-xs); padding: var(--space-2) var(--space-3);">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <span style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); line-height: 1.2;">${p.name}</span>
          <span style="font-size: 9px; color: #10b981; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 4px; margin-top: 1px;">
            <i data-lucide="package" style="width: 9px; height: 9px;"></i> Producto
          </span>
        </div>
        <input
          type="number"
          class="pos-product-qty form-input"
          data-index="${i}"
          value="${p.qty}"
          min="1"
          style="width: 50px; height: 26px; padding: 0 var(--space-1); text-align: center; background: var(--bg-secondary); border-color: var(--border-soft); font-size: 11px; font-weight: 700;"
        />
        <input
          type="number"
          class="pos-product-price form-input"
          data-index="${i}"
          value="${p.unit_price}"
          min="0"
          style="width: 80px; height: 26px; padding: 0 var(--space-1); text-align: right; background: var(--bg-secondary); border-color: var(--border-soft); font-size: 11px; font-weight: 700;"
        />
        <button class="pos-product-remove" data-index="${i}" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: var(--space-1); display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity var(--transition-base);">
          <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    `).join('');

    unifiedCart.innerHTML = servicesHTML + productsHTML;

    if (typeof lucide !== 'undefined') lucide.createIcons({ node: unifiedCart });

    // Listeners de cantidad
    unifiedCart.querySelectorAll('.pos-product-qty').forEach(input => {
      input.addEventListener('input', () => {
        const i = parseInt(input.dataset.index);
        const qty = Math.max(1, parseInt(input.value) || 1);
        selectedProducts[i].qty = qty;
        selectedProducts[i].subtotal = qty * selectedProducts[i].unit_price;
        recalculateTotales();
      });
    });

    // Listeners de precio editable
    unifiedCart.querySelectorAll('.pos-product-price').forEach(input => {
      input.addEventListener('input', () => {
        const i = parseInt(input.dataset.index);
        const price = Math.max(0, parseFloat(input.value) || 0);
        selectedProducts[i].unit_price = price;
        selectedProducts[i].subtotal = selectedProducts[i].qty * price;
        recalculateTotales();
      });
    });

    // Listeners para eliminar producto
    unifiedCart.querySelectorAll('.pos-product-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index);
        const removedId = selectedProducts[i].id;
        selectedProducts.splice(i, 1);
        const listProductItem = root.querySelector(`#pos-products-list .apt-service-item[data-id="${removedId}"]`);
        if (listProductItem) listProductItem.classList.remove('selected');
        renderUnifiedCart();
        recalculateTotales();
      });
    });

    // Listeners para eliminar servicio
    unifiedCart.querySelectorAll('.pos-service-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        selectedServices = selectedServices.filter(s => s.id !== id);
        const listServiceItem = root.querySelector(`#pos-services-list .apt-service-item[data-id="${id}"]`);
        if (listServiceItem) listServiceItem.classList.remove('selected');
        renderUnifiedCart();
        recalculateTotales();
      });
    });
  };

  // Calcular Totales
  const recalculateTotales = () => {
    const subtotalServices = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const subtotalProducts = selectedProducts.reduce((sum, p) => sum + p.subtotal, 0);
    const subtotal = subtotalServices + subtotalProducts;
    const discount = Math.max(0, parseInt(discountInput.value, 10) || 0);
    const total = Math.max(0, subtotal - discount);

    subtotalText.textContent = `$${subtotal.toLocaleString('es-CO')}`;
    discountText.textContent = `-$${discount.toLocaleString('es-CO')}`;
    totalText.textContent = `$${total.toLocaleString('es-CO')}`;
  };

  discountInput.addEventListener('input', recalculateTotales);

  // Inicializar totales y carrito
  renderUnifiedCart();
  recalculateTotales();

  // Gestión de Pestañas (Tabs)
  const tabServices = root.querySelector('#pos-tab-services');
  const tabProducts = root.querySelector('#pos-tab-products');
  const panelServices = root.querySelector('#pos-panel-services');
  const panelProducts = root.querySelector('#pos-panel-products');

  if (tabServices && tabProducts) {
    tabServices.addEventListener('click', () => {
      tabServices.classList.add('active');
      tabServices.style.borderBottomColor = 'var(--accent-neon)';
      tabServices.style.color = 'var(--text-primary)';

      tabProducts.classList.remove('active');
      tabProducts.style.borderBottomColor = 'transparent';
      tabProducts.style.color = 'var(--text-secondary)';

      panelServices.style.display = 'flex';
      panelProducts.style.display = 'none';
    });

    tabProducts.addEventListener('click', () => {
      tabProducts.classList.add('active');
      tabProducts.style.borderBottomColor = 'var(--accent-neon)';
      tabProducts.style.color = 'var(--text-primary)';

      tabServices.classList.remove('active');
      tabServices.style.borderBottomColor = 'transparent';
      tabServices.style.color = 'var(--text-secondary)';

      panelServices.style.display = 'none';
      panelProducts.style.display = 'flex';
    });
  }

  // Click en servicios
  servicesList.addEventListener('click', (e) => {
    const item = e.target.closest('.apt-service-item');
    if (item) {
      const idx = parseInt(item.getAttribute('data-index'), 10);
      const srv = SERVICES[idx];
      const isSelected = item.classList.contains('selected');

      if (isSelected) {
        item.classList.remove('selected');
        selectedServices = selectedServices.filter(s => s.id !== srv.id);
      } else {
        item.classList.add('selected');
        selectedServices.push(srv);
      }

      renderUnifiedCart();
      recalculateTotales();
    }
  });

  // Click en producto del catálogo
  root.querySelector('#pos-products-list')?.addEventListener('click', (e) => {
    const item = e.target.closest('.apt-service-item');
    if (!item) return;
    const id = item.dataset.id;
    const name = item.dataset.name;
    const price = parseFloat(item.dataset.price) || 0;
    const isSelected = item.classList.contains('selected');

    if (isSelected) {
      item.classList.remove('selected');
      selectedProducts = selectedProducts.filter(p => p.id !== id);
    } else {
      item.classList.add('selected');
      selectedProducts.push({ id, name, qty: 1, unit_price: price, subtotal: price });
    }
    renderUnifiedCart();
    recalculateTotales();
  });

  // Buscador de productos
  root.querySelector('#pos-product-search')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    root.querySelectorAll('#pos-products-list .apt-service-item').forEach(item => {
      const name = item.dataset.name.toLowerCase();
      item.style.display = name.includes(query) ? '' : 'none';
    });
  });

  // Mostrar Modal con animación
  setTimeout(() => root.classList.add('open'), 10);

  const closeModal = () => {
    root.classList.remove('open');
    setTimeout(() => root.remove(), 300);
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Guardar y Generar PDF
  saveBtn.addEventListener('click', async () => {
    let hasError = false;
    nameInput.classList.remove('form-input-error');

    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }

    if (selectedServices.length === 0 && selectedProducts.length === 0) {
      showToast({
        title: 'Carrito vacío',
        subtitle: 'Debes seleccionar al menos un servicio o producto para cobrar.',
        type: 'warning'
      });
      hasError = true;
    }

    const phoneVal = phoneInput.value.trim();
    if (phoneVal && (phoneVal.length !== 10 || !phoneVal.startsWith('3'))) {
      phoneInput.classList.add('form-input-error');
      hasError = true;
      showToast({
        title: 'Teléfono inválido',
        subtitle: 'El teléfono debe tener exactamente 10 dígitos y empezar con 3 (o quedar vacío).',
        type: 'warning'
      });
    }

    if (hasError) {
      if (nameInput.classList.contains('form-input-error')) {
        nameInput.focus();
      } else if (phoneInput.classList.contains('form-input-error')) {
        phoneInput.focus();
      }
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Cobrando...';

    try {
      const subtotalServices = selectedServices.reduce((sum, s) => sum + s.price, 0);
      const subtotalProducts = selectedProducts.reduce((sum, p) => sum + p.subtotal, 0);
      const subtotal = subtotalServices + subtotalProducts;
      const discount = Math.max(0, parseInt(discountInput.value, 10) || 0);
      const total = Math.max(0, subtotal - discount);

      const invoicePayload = {
        appointment_id: appointmentContext ? appointmentContext.id : null,
        client_name: nameInput.value.trim(),
        client_phone: phoneInput.value.trim() || null,
        client_email: emailInput.value.trim() || null,
        subtotal,
        discount,
        total,
        payment_method: paymentMethodSelect.value,
        payment_notes: notesInput.value.trim(),
        status: 'pagada'
      };

      const serviceItems = selectedServices.map(s => ({
        service_id: s.id,
        description: s.name,
        qty: 1,
        unit_price: s.price,
        total: s.price
      }));

      const productItems = selectedProducts.map(p => ({
        product_id: p.id,
        description: p.name,
        qty: p.qty,
        unit_price: p.unit_price,
        total: p.subtotal
      }));

      const itemsPayload = [...serviceItems, ...productItems];

      // Insertar factura en la base de datos
      const invoice = await createInvoice(bizId, invoicePayload, itemsPayload);

      // Paralelizar la actualización de la cita y el descuento de stock
      await Promise.all([
        appointmentContext
          ? supabase
              .from('appointments')
              .update({ status: 'facturada' })
              .eq('id', appointmentContext.id)
              .then(({ error }) => {
                if (error) console.error('[pos-modal] Error al actualizar estado de cita:', error.message);
              })
          : Promise.resolve(),
        selectedProducts.length > 0
          ? descontarStockPorVenta(invoice.id, selectedProducts, bizId)
          : Promise.resolve()
      ]);

      showToast({
        title: 'Venta completada',
        subtitle: `Factura ${invoice.invoice_number} cobrada con éxito.`,
        type: 'success'
      });

      closeModal();
      if (onSave) onSave();

      // PDFs en background — no bloquean el cierre
      const selectedOption = profSelect.options[profSelect.selectedIndex];
      const profName = selectedOption ? selectedOption.getAttribute('data-name') : null;
      setTimeout(() => {
        generateClientTicket(invoice, business);
        if (profName) {
          generateServiceTicket(invoice, profName);
        }
      }, 300); // espera a que termine la animación de cierre del modal
    } catch (err) {
      showToast({
        title: 'Error al procesar cobro',
        subtitle: err.message,
        type: 'error'
      });
      saveBtn.disabled = false;
      saveBtn.textContent = 'Cobrar e Imprimir';
    }
  });
}
