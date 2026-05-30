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
  let searchQuery = '';

  const renderTableContent = () => {
    const tableContent = container.querySelector('#crm-table-content');
    if (!tableContent) return;

    const filteredInvoices = invoices.filter(inv => {
      const numMatch = inv.invoice_number && inv.invoice_number.toLowerCase().includes(searchQuery);
      const clientMatch = inv.client_name && inv.client_name.toLowerCase().includes(searchQuery);
      return numMatch || clientMatch;
    });

    if (invoices.length === 0) {
      tableContent.innerHTML = `
        <div class="crm-empty-state">
          <i data-lucide="receipt" size="48" style="stroke-width: 1.5; color: var(--accent-neon); margin-bottom: var(--space-2);"></i>
          <h3>Sin facturas</h3>
          <p>No se han registrado facturas en este negocio todavía.</p>
        </div>
      `;
    } else if (filteredInvoices.length === 0) {
      tableContent.innerHTML = `
        <div class="crm-empty-state">
          <i data-lucide="search" size="48" style="stroke-width: 1.5; color: var(--accent-neon); margin-bottom: var(--space-2);"></i>
          <h3>No se encontraron resultados</h3>
          <p>No hay facturas que coincidan con la búsqueda "${searchQuery}".</p>
        </div>
      `;
    } else {
      tableContent.innerHTML = `
        <table class="crm-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Método</th>
              <th>Fecha</th>
              <th>Total</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filteredInvoices.map(inv => `
              <tr>
                <td style="font-weight: 700; color: var(--accent-neon);">${inv.invoice_number}</td>
                <td>${inv.client_name}</td>
                <td style="text-transform: capitalize;">${inv.payment_method}</td>
                <td>${new Date(inv.created_at).toLocaleDateString('es-CO')}</td>
                <td style="font-weight: 700;">COP $${Number(inv.total).toLocaleString('es-CO')}</td>
                <td style="text-align: right;">
                  <button class="btn-print-invoice" data-id="${inv.id}" style="
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
      `;
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: tableContent });
    }

    tableContent.querySelectorAll('.btn-print-invoice').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const invoice = invoices.find(inv => inv.id === id);
        if (invoice) {
          generateClientTicket(invoice, business);
        }
      });
    });
  };

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
        <div class="crm-table-wrapper">
          <div class="crm-table-header-row">
            <div class="crm-search-input-wrapper">
              <i data-lucide="search"></i>
              <input type="text" id="crm-invoice-search" class="crm-search-input" placeholder="Buscar por número o cliente...">
            </div>
          </div>
          <div class="crm-table-container" id="crm-table-content"></div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: container.querySelector('.view-container') });
    }

    const searchInput = container.querySelector('#crm-invoice-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderTableContent();
      });
    }

    const newBillBtn = container.querySelector('#btn-new-bill');
    if (newBillBtn) {
      newBillBtn.addEventListener('click', () => {
        openPosModal({
          onSave: async () => {
            invoices = await getInvoices(businessId);
            renderTableContent();
          }
        });
      });
    }

    renderTableContent();
  };

  // Render inicial
  render();

  // SUSCRIPCIÓN EN TIEMPO REAL
  const channelName = `invoices-changes-${businessId}`;

  // Eliminar canal previo con el mismo nombre si ya existía para evitar duplicación y el error "cannot add postgres_changes callbacks after subscribe"
  const existingChannel = supabase.channel(channelName);
  supabase.removeChannel(existingChannel);

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'invoices',
      filter: `business_id=eq.${businessId}`
    }, async () => {
      invoices = await getInvoices(businessId);
      renderTableContent();
    })
    .subscribe();

  // Registrar cleanup para la navegación SPA
  container.cleanup = () => {
    supabase.removeChannel(channel);
  };
}
