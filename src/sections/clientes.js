// clientes.js — Módulo de Clientes CRM (conectado a Supabase)
import { getClients, getActiveBusinessId } from '../utils/businessState.js';
import { formatCurrency } from '../utils/format.js';

export async function init(container) {
  const businessId = getActiveBusinessId();

  if (!businessId) {
    container.innerHTML = `
      <div class="view-container">
        <div class="crm-empty-state">
          <i data-lucide="store" size="48" style="stroke-width:1.5; color:var(--accent-neon);"></i>
          <h3>Sin negocio activo</h3>
          <p>Selecciona un negocio desde el selector del header para ver sus clientes.</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div>
          <p class="flow-subtitle" style="margin-bottom: 0;">Administra la base de datos de tus clientes y el histórico de sus servicios.</p>
        </div>
      </div>

      <div class="crm-table-wrapper">
        <div class="crm-table-header-row">
          <div class="crm-search-input-wrapper">
            <i data-lucide="search" size="16"></i>
            <input type="text" id="crm-client-search" class="crm-search-input" placeholder="Buscar por nombre o teléfono..." />
          </div>
        </div>

        <div class="crm-table-container" id="crm-table-content">
          <div style="display:flex; align-items:center; justify-content:center; padding: var(--space-12);">
            <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
          </div>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: container });
  }

  const searchInput = container.querySelector('#crm-client-search');
  const tableContent = container.querySelector('#crm-table-content');

  // Cache de clientes para filtrado local rápido
  let allClients = await getClients(businessId);

  function renderTable(query = '') {
    const lowerQuery = query.toLowerCase().trim();
    const filteredClients = lowerQuery
      ? allClients.filter(c =>
          c.name.toLowerCase().includes(lowerQuery) ||
          (c.phone || '').includes(lowerQuery)
        )
      : allClients;

    if (filteredClients.length === 0) {
      tableContent.innerHTML = `
        <div class="crm-empty-state">
          <i data-lucide="users" size="48" style="stroke-width: 1.5; color: var(--accent-neon); margin-bottom: var(--space-2);"></i>
          <h3>No se encontraron clientes</h3>
          <p>${query ? 'Intenta buscar con otros términos.' : 'Los clientes se crean automáticamente al agendar una cita.'}</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ node: tableContent });
      return;
    }

    tableContent.innerHTML = `
      <table class="crm-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Contacto</th>
            <th>Email</th>
            <th>Último Servicio</th>
            <th>Total Servicios</th>
          </tr>
        </thead>
        <tbody>
          ${filteredClients.map(c => {
            let dateFormatted = '';
            if (c.last_service_date) {
              try {
                const dateObj = new Date(c.last_service_date + 'T00:00:00');
                dateFormatted = dateObj.toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
              } catch (_) {
                dateFormatted = c.last_service_date;
              }
            }

            return `
              <tr>
                <td>
                  <span class="crm-client-name">${c.name}</span>
                </td>
                <td>
                  <div class="crm-client-contact">
                    <span class="crm-contact-item">
                      <i data-lucide="phone" size="12"></i>
                      ${c.phone || '—'}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="crm-client-email">${c.email || '<span style="color: var(--text-muted); font-style: italic;">Sin correo</span>'}</span>
                </td>
                <td>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span class="crm-client-service-pill">${c.last_service || 'Ninguno'}</span>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${dateFormatted}</span>
                  </div>
                </td>
                <td>
                  <div style="display: flex; align-items: center;">
                    <span class="crm-client-visits-badge">${c.total_visits || 0} ${(c.total_visits || 0) === 1 ? 'visita' : 'visitas'}</span>
                    <span class="crm-client-total-spent">${formatCurrency(c.total_spent || 0)}</span>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons({ node: tableContent });
  }

  // Búsqueda en tiempo real (filtrado local)
  searchInput.addEventListener('input', (e) => {
    renderTable(e.target.value);
  });

  // Render inicial
  renderTable();

  // Escuchar actualizaciones (cuando se agenda una cita)
  const handleClientsChanged = async (e) => {
    if (!e.detail || e.detail.businessId === businessId) {
      allClients = await getClients(businessId);
      renderTable(searchInput.value);
    }
  };
  window.addEventListener('citum_clients_changed', handleClientsChanged);

  // Limpieza al desmontar
  const checkInterval = setInterval(() => {
    if (!document.body.contains(container)) {
      window.removeEventListener('citum_clients_changed', handleClientsChanged);
      clearInterval(checkInterval);
    }
  }, 3000);
}
