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

export async function openPosModal({ onSave = null, appointmentContext = null } = {}) {
  const bizId = getActiveBusinessId();
  const business = getActiveBusiness();
  
  // Cargar servicios y profesionales activos
  const [servicesData, professionalsData] = await Promise.all([
    getServices(bizId),
    fetchProfessionals(bizId)
  ]);

  const SERVICES = servicesData.filter(s => s.active !== false);
  const professionals = professionalsData.filter(p => p.active !== false);

  // Asegurar que no haya otro modal duplicado
  const existing = document.getElementById('pos-modal-root');
  if (existing) existing.remove();

  // Contenedor principal
  const root = document.createElement('div');
  root.id = 'pos-modal-root';
  root.className = 'apt-modal-overlay';

  let selectedServices = [];
  if (appointmentContext) {
    const contextServiceIds = (appointmentContext.rawServices || []).map(s => s.service_id);
    SERVICES.forEach(srv => {
      if (contextServiceIds.includes(srv.id)) {
        selectedServices.push(srv);
      }
    });
  }

  root.innerHTML = `
    <div class="apt-modal" role="dialog" aria-modal="true" style="max-width: 600px;">
      <div class="apt-modal-header">
        <h2>
          <i data-lucide="receipt" style="color: var(--accent-neon);"></i>
          Nueva Venta Directa (POS)
        </h2>
        <button class="apt-modal-close" id="pos-modal-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="apt-modal-body">
        <!-- 👤 DATOS DEL CLIENTE -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="user" size="14"></i>
            Datos del Cliente
          </div>
          <div class="form-group autocomplete-container">
            <label for="pos-client-name">Nombre completo *</label>
            <input type="text" id="pos-client-name" class="form-input" placeholder="Ej. Carlos Mendoza" autocomplete="off" required value="${appointmentContext ? appointmentContext.client : ''}" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group autocomplete-container">
              <label for="pos-client-phone">Teléfono (opcional)</label>
              <input type="tel" id="pos-client-phone" class="form-input" placeholder="Ej. 3001234567" autocomplete="off" value="${appointmentContext && appointmentContext.phone ? appointmentContext.phone : ''}" />
            </div>
            <div class="form-group">
              <label for="pos-client-email">Email (opcional)</label>
              <input type="email" id="pos-client-email" class="form-input" placeholder="Ej. cliente@correo.com" value="${appointmentContext && appointmentContext.email ? appointmentContext.email : ''}" />
            </div>
          </div>
        </div>

        <!-- ✂️ SELECCIÓN DE SERVICIOS -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="briefcase" size="14"></i>
            Seleccionar Servicios
          </div>
          <div class="apt-services-grid" id="pos-services-list" style="max-height: 160px; overflow-y: auto;">
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

        <!-- 👨‍💼 PROFESIONAL ASIGNADO (para el ticket de servicio) -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="user-check" size="14"></i>
            Profesional que Atiende
          </div>
          <div class="form-group">
            <select class="form-input" id="pos-prof-select">
              <option value="">Selecciona un profesional...</option>
              ${professionals.map(p => {
                const isSelected = appointmentContext && appointmentContext.professional_id === p.id;
                return `
                  <option value="${p.id}" data-name="${p.name}" ${isSelected ? 'selected' : ''}>${p.name}</option>
                `;
              }).join('')}
            </select>
          </div>
        </div>

        <!-- 💰 FORMA DE PAGO Y DESCUENTO -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="credit-card" size="14"></i>
            Forma de Pago
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label for="pos-payment-method">Método de Pago</label>
              <select class="form-input" id="pos-payment-method">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label for="pos-discount">Descuento (COP)</label>
              <input type="number" id="pos-discount" class="form-input" placeholder="0" min="0" value="0" />
            </div>
          </div>
          <div class="form-group" style="margin-top: var(--space-3);">
            <label for="pos-notes">Notas / Observaciones</label>
            <input type="text" id="pos-notes" class="form-input" placeholder="Ej. Pago dividido, propina..." value="${appointmentContext && appointmentContext.notes ? appointmentContext.notes : ''}" />
          </div>
        </div>

        <!-- Resumen de Totales -->
        <div class="apt-summary-bar" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-sm);">
            <span>Subtotal:</span>
            <strong id="pos-summary-subtotal">$0</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: var(--text-sm); color: #ff5a7a;">
            <span>Descuento:</span>
            <strong id="pos-summary-discount">-$0</strong>
          </div>
          <hr style="border: 0; border-top: 1px solid var(--border-soft); margin-block: var(--space-1);">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-base); color: var(--accent-neon);">
            <span>Total a Cobrar:</span>
            <strong id="pos-summary-total">$0</strong>
          </div>
        </div>
      </div>

      <div class="apt-modal-footer" style="display: flex; gap: var(--space-3); justify-content: flex-end;">
        <button class="btn btn-secondary" id="pos-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="pos-save-btn" style="display: flex; align-items: center; gap: 8px;">
          <i data-lucide="printer" size="16"></i>
          Cobrar e Imprimir
        </button>
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

  // Calcular Totales
  const recalculateTotales = () => {
    const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Math.max(0, parseInt(discountInput.value, 10) || 0);
    const total = Math.max(0, subtotal - discount);

    subtotalText.textContent = `$${subtotal.toLocaleString('es-CO')}`;
    discountText.textContent = `-$${discount.toLocaleString('es-CO')}`;
    totalText.textContent = `$${total.toLocaleString('es-CO')}`;
  };

  discountInput.addEventListener('input', recalculateTotales);

  // Calcular Totales inicialmente
  recalculateTotales();

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

      recalculateTotales();
    }
  });

  // Mostrar Modal
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
    servicesList.style.borderColor = 'transparent';

    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }

    if (selectedServices.length === 0) {
      servicesList.style.border = '1px solid #ef4444';
      servicesList.style.borderRadius = 'var(--radius-sm)';
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
      const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
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

      const itemsPayload = selectedServices.map(s => ({
        service_id: s.id,
        description: s.name,
        qty: 1,
        unit_price: s.price,
        total: s.price
      }));

      // Insertar factura en la base de datos
      const invoice = await createInvoice(bizId, invoicePayload, itemsPayload);

      // Si viene de una cita, actualizar su estado a 'facturada' en Supabase
      if (appointmentContext) {
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ status: 'facturada' })
          .eq('id', appointmentContext.id);

        if (updateError) {
          console.error('[pos-modal] Error al actualizar estado de cita:', updateError.message);
        }
      }

      // Generar e imprimir Ticket de Cobro PDF
      generateClientTicket(invoice, business);

      // Si hay un profesional seleccionado, generar orden de servicio sin precio
      const selectedOption = profSelect.options[profSelect.selectedIndex];
      const profName = selectedOption ? selectedOption.getAttribute('data-name') : null;
      if (profName) {
        generateServiceTicket(invoice, profName);
      }

      showToast({
        title: 'Venta completada',
        subtitle: `Factura ${invoice.invoice_number} cobrada con éxito.`,
        type: 'success'
      });

      if (onSave) onSave();
      closeModal();
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
