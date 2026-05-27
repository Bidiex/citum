// clientes.js — Módulo de Clientes CRM para el Panel de Propietario
import { getClients, getActiveBusinessId } from '../utils/businessState.js';
import { formatCurrency } from '../utils/format.js';

export function init(container) {
  const businessId = getActiveBusinessId();
  
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
          <!-- Se renderiza por JS -->
        </div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#crm-client-search');
  const tableContent = container.querySelector('#crm-table-content');

  // Inicializar iconos de la cabecera
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: container.querySelector('.crm-table-header-row') });
  }

  function renderTable(query = '') {
    const clients = getClients(getActiveBusinessId());
    const lowerQuery = query.toLowerCase().trim();
    
    const filteredClients = clients.filter(c => {
      return c.name.toLowerCase().includes(lowerQuery) || c.phone.includes(lowerQuery);
    });

    if (filteredClients.length === 0) {
      tableContent.innerHTML = `
        <div class="crm-empty-state">
          <i data-lucide="users" size="48" style="stroke-width: 1.5; color: var(--accent-neon); margin-bottom: var(--space-2);"></i>
          <h3>No se encontraron clientes</h3>
          <p>${query ? 'Intenta buscar con otros términos.' : 'Registra tu primera cita para crear un cliente automáticamente.'}</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ node: tableContent });
      }
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
            // Formatear fecha
            let dateFormatted = '';
            if (c.lastServiceDate) {
              try {
                const dateObj = new Date(c.lastServiceDate + 'T00:00:00');
                dateFormatted = dateObj.toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
              } catch (e) {
                dateFormatted = c.lastServiceDate;
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
                      ${c.phone}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="crm-client-email">${c.email || '<span style="color: var(--text-muted); font-style: italic;">Sin correo</span>'}</span>
                </td>
                <td>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span class="crm-client-service-pill">${c.lastService || 'Ninguno'}</span>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${dateFormatted}</span>
                  </div>
                </td>
                <td>
                  <div style="display: flex; align-items: center;">
                    <span class="crm-client-visits-badge">${c.totalVisits} ${c.totalVisits === 1 ? 'visita' : 'visitas'}</span>
                    <span class="crm-client-total-spent">${formatCurrency(c.totalSpent || 0)}</span>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: tableContent });
    }
  }

  // Escuchar entrada de búsqueda
  searchInput.addEventListener('input', (e) => {
    renderTable(e.target.value);
  });

  // Render inicial
  renderTable();

  // Escuchar cambios de clientes en localStorage
  const handleClientsChanged = (e) => {
    if (e.detail.businessId === getActiveBusinessId()) {
      renderTable(searchInput.value);
    }
  };
  window.addEventListener('citum_clients_changed', handleClientsChanged);

  // Limpieza al desmontar para evitar fugas de memoria
  const checkInterval = setInterval(() => {
    if (!document.body.contains(container)) {
      window.removeEventListener('citum_clients_changed', handleClientsChanged);
      clearInterval(checkInterval);
    }
  }, 3000);
}
