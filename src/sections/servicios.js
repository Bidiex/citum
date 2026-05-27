// servicios.js — Módulo de Servicios del Panel
import { getServices, getActiveBusinessId } from '../utils/businessState.js';
import { openServiceModal } from '../components/service-modal.js';

export function init(container) {
  const render = () => {
    const activeBizId = getActiveBusinessId();
    const services = getServices(activeBizId);

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div>
            <p class="flow-subtitle" style="margin-bottom: 0;">Administra el catálogo de servicios de tu negocio, precios y tiempos.</p>
          </div>
          <div class="view-actions">
            <button class="btn btn-primary" id="btn-add-srv" style="height: 40px; padding-inline: var(--space-4);">
              <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
              Crear Servicio
            </button>
          </div>
        </div>

        ${services.length === 0 ? `
          <div class="crm-empty-state">
            <i data-lucide="scissors"></i>
            <h3>No hay servicios registrados</h3>
            <p>Comienza creando el primer servicio para que tus clientes puedan reservar citas en línea.</p>
          </div>
        ` : `
          <div class="grid-panel" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
            ${services.map(srv => `
              <div class="card" style="padding: var(--space-6); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3); gap: var(--space-2);">
                    <h4 style="font-size: var(--text-base); font-weight: 700; max-width: 70%; word-break: break-word;">${srv.name}</h4>
                    <span style="
                      font-size: var(--text-xs); 
                      font-weight: 800; 
                      color: var(--accent-neon);
                      flex-shrink: 0;
                    ">COP $${srv.price.toLocaleString('es-CO')}</span>
                  </div>
                  ${srv.desc ? `
                    <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: var(--space-3); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${srv.desc}">
                      ${srv.desc}
                    </p>
                  ` : ''}
                  <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
                    Duración estimada: <strong>${srv.duration} min</strong>
                  </p>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-muted); border-top: 1px solid var(--border-soft); padding-top: var(--space-3); margin-top: auto;">
                  <span>Estado: <strong style="color: ${srv.active !== false ? 'var(--accent-neon)' : 'var(--text-muted)'};">${srv.active !== false ? 'Activo' : 'Inactivo'}</strong></span>
                  <a href="#" class="edit-srv-link" data-id="${srv.id}" style="color: var(--accent-purple); font-weight: 600;">Editar Detalles</a>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Inicializar iconos
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Vincular creación de servicio
    const addBtn = container.querySelector('#btn-add-srv');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openServiceModal({
          mode: 'create',
          onSave: render
        });
      });
    }

    // Vincular edición de servicio
    container.querySelectorAll('.edit-srv-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const srvId = link.getAttribute('data-id');
        const srv = services.find(s => s.id === srvId);
        if (srv) {
          openServiceModal({
            mode: 'edit',
            serviceData: srv,
            onSave: render
          });
        }
      });
    });
  };

  render();
}
