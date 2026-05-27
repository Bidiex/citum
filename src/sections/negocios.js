// negocios.js — Módulo de Negocios del Panel
import { getBusinesses } from '../utils/businessState.js';
import { openBusinessModal } from '../components/business-modal.js';

export function init(container) {
  const render = () => {
    const businesses = getBusinesses();

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div>
            <p class="flow-subtitle" style="margin-bottom: 0;">Administra tus diferentes sucursales o establecimientos vinculados.</p>
          </div>
          <div class="view-actions">
            <button class="btn btn-primary" id="btn-add-biz" style="height: 40px; padding-inline: var(--space-4);">
              <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
              Nuevo Negocio
            </button>
          </div>
        </div>

        <div class="grid-panel" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
          ${businesses.map(biz => `
            <div class="card" style="padding: var(--space-6); background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: var(--radius-lg); box-shadow: var(--shadow-card);">
              <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);">
                <div style="
                  width: 40px; 
                  height: 40px; 
                  border-radius: var(--radius-sm); 
                  background: ${biz.color || 'var(--grad-brand)'}; 
                  color: #ffffff; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center;
                  font-weight: 800;
                  overflow: hidden;
                  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                ">
                  ${biz.logo ? `<img src="${biz.logo}" style="width:100%; height:100%; object-fit:cover;" />` : biz.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">${biz.name}</h4>
                  <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">/b/${biz.slug}</p>
                </div>
              </div>
              
              <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">
                Dirección: <strong style="color: var(--text-primary);">${biz.address || 'No registrada'}</strong>
              </p>
              <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
                Teléfono: <strong style="color: var(--text-primary);">${biz.phone}</strong>
              </p>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs);">
                <a href="/booking.html?b=${biz.slug}" target="_blank" class="text-gradient" style="font-weight: 700; display: inline-flex; align-items: center; gap: 4px; color: var(--accent-purple);">
                  Ver Agendador
                  <i data-lucide="external-link" size="12"></i>
                </a>
                <a href="#" class="edit-settings-link" data-id="${biz.id}" style="color: var(--text-muted); transition: color var(--transition-base);">Editar Ajustes</a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Registrar clics para Editar Ajustes
    container.querySelectorAll('.edit-settings-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const bizId = link.getAttribute('data-id');
        const biz = businesses.find(b => b.id === bizId);
        if (biz) {
          openBusinessModal({
            mode: 'edit',
            businessData: biz,
            onSave: () => {
              render();
            }
          });
        }
      });
    });

    // Registrar clics para Nuevo Negocio
    const addBtn = container.querySelector('#btn-add-biz');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openBusinessModal({
          mode: 'create',
          onSave: () => {
            render();
          }
        });
      });
    }
  };

  render();
}
