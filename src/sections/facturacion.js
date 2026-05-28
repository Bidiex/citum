// facturacion.js — Módulo de Facturación del Panel (conectado a Supabase)
import { getInvoices, getActiveBusinessId, getActiveBusiness } from '../utils/businessState.js';
import { openPosModal } from '../components/pos-modal.js';
import { generateClientTicket } from '../utils/pdf.js';
import { supabase } from '../core/supabase.js';

export async function init(container) {
  const businessId = getActiveBusinessId();
  const business = getActiveBusiness();

  if (!businessId) {
    container.innerHTML = `
      <div class="view-container">
        <div class="crm-empty-state">
          <i data-lucide="store" size="48" style="stroke-width:1.5; color:var(--accent-neon);"></i>
          <h3>Sin negocio activo</h3>
          <p>Selecciona o crea un negocio primero desde la sección "Negocios".</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Indicador de carga
  container.innerHTML = `
    <div class="view-container">
      <div style="display:flex; align-items:center; justify-content:center; padding: var(--space-12);">
        <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  let invoices = await getInvoices(businessId);

  const render = () => {
    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div>
            <p class="flow-subtitle" style="margin-bottom: 0;">Gestiona tus cobros, ventas directas e historial de facturas.</p>
          </div>
          <div class="view-actions">
            <button class="btn btn-primary" id="btn-new-bill" style="height: 40px; padding-inline: var(--space-4);">
              <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
              Venta Directa (POS)
            </button>
          </div>
        </div>

        <!-- Tabla de Facturación -->
        <div class="table-container" style="
          background: var(--bg-secondary); 
          border: 1px solid var(--border-soft); 
          border-radius: var(--radius-md); 
          margin-top: var(--space-4);
          overflow-x: auto;
        ">
          ${invoices.length === 0 ? `
            <div style="text-align: center; padding: var(--space-10); color: var(--text-muted);">
              <i data-lucide="receipt" size="32" style="margin-bottom: 10px; color: var(--accent-neon);"></i>
              <p>No se han registrado facturas en este negocio todavía.</p>
            </div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: var(--text-sm);">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-soft); color: var(--text-muted); font-weight: 700;">
                  <th style="padding: var(--space-4);">Número</th>
                  <th style="padding: var(--space-4);">Cliente</th>
                  <th style="padding: var(--space-4);">Método</th>
                  <th style="padding: var(--space-4);">Fecha</th>
                  <th style="padding: var(--space-4);">Total</th>
                  <th style="padding: var(--space-4); text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map((inv, idx) => `
                  <tr style="border-bottom: 1px solid var(--border-soft);">
                    <td style="padding: var(--space-4); font-weight: 700; color: var(--accent-neon);">${inv.invoice_number}</td>
                    <td style="padding: var(--space-4);">${inv.client_name}</td>
                    <td style="padding: var(--space-4); text-transform: capitalize;">${inv.payment_method}</td>
                    <td style="padding: var(--space-4);">${new Date(inv.created_at).toLocaleDateString('es-CO')}</td>
                    <td style="padding: var(--space-4); font-weight: 700;">COP $${Number(inv.total).toLocaleString('es-CO')}</td>
                    <td style="padding: var(--space-4); text-align: right;">
                      <button class="btn-print-invoice" data-index="${idx}" style="
                        background: none; 
                        border: none; 
                        color: var(--accent-purple); 
                        font-weight: 600; 
                        cursor: pointer;
                      ">
                        <i data-lucide="printer" size="16" style="display: inline; vertical-align: middle; margin-right: 4px;"></i>
                        Imprimir
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Botón "Venta Directa"
    const newBillBtn = container.querySelector('#btn-new-bill');
    if (newBillBtn) {
      newBillBtn.addEventListener('click', () => {
        openPosModal({
          onSave: async () => {
            invoices = await getInvoices(businessId);
            render();
          }
        });
      });
    }

    // Botones de imprimir
    container.querySelectorAll('.btn-print-invoice').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const invoice = invoices[idx];
        if (invoice) {
          generateClientTicket(invoice, business);
        }
      });
    });
  };

  // Render inicial
  render();

  // SUSCRIPCIÓN EN TIEMPO REAL
  const channel = supabase
    .channel(`invoices-changes-${businessId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'invoices',
      filter: `business_id=eq.${businessId}`
    }, async () => {
      invoices = await getInvoices(businessId);
      render();
    })
    .subscribe();

  // Desconectar al destruir vista
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === container || node.contains(container)) {
          supabase.removeChannel(channel);
          observer.disconnect();
        }
      });
    });
  });
  
  if (container.parentNode) {
    observer.observe(container.parentNode, { childList: true });
  }
}
