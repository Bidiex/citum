// negocios.js — Módulo de Negocios del Panel (conectado a Supabase)
import { getBusinesses, getActiveBusinessId, setActiveBusinessId } from '../utils/businessState.js';
import { openBusinessModal } from '../components/business-modal.js';
import { showToast } from '../utils/toast.js';

export async function init(container) {
  // Estado de carga
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <p class="flow-subtitle" style="margin-bottom: 0;">Cargando negocios...</p>
      </div>
    </div>
  `;

  const render = async () => {
    const businesses = await getBusinesses();
    const activeId = getActiveBusinessId();

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

        ${businesses.length === 0 ? `
          <div class="crm-empty-state" style="margin-top: var(--space-8);">
            <i data-lucide="store" size="48" style="stroke-width: 1.5; color: var(--accent-neon); margin-bottom: var(--space-2);"></i>
            <h3>Sin negocios registrados</h3>
            <p>Crea tu primer negocio para comenzar a gestionar citas, profesionales y servicios.</p>
          </div>
        ` : `
          <div class="grid-panel" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
            ${businesses.map(biz => {
              const isActive = biz.id === activeId;
              return `
              <div class="card" style="padding: var(--space-6); display: flex; flex-direction: column; justify-content: space-between; min-height: 240px;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4); gap: var(--space-2);">
                    <div style="display: flex; align-items: center; gap: var(--space-3);">
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
                        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                        flex-shrink: 0;
                      ">
                        ${biz.logo_url ? `<img src="${biz.logo_url}" style="width:100%; height:100%; object-fit:cover;" />` : biz.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary); margin: 0;">${biz.name}</h4>
                        <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">/b/${biz.slug}</p>
                      </div>
                    </div>
                    
                    ${isActive ? '' : `
                      <button class="btn-set-active" data-id="${biz.id}" style="
                        background: none; 
                        border: none; 
                        color: var(--text-muted); 
                        font-size: var(--text-xs); 
                        font-weight: 600;
                        cursor: pointer; 
                        padding: 0;
                      ">Activar</button>
                    `}
                  </div>
                  
                  <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-2); margin-top: 0;">
                    Dirección: <strong style="color: var(--text-primary);">${biz.address || 'No registrada'}</strong>
                  </p>
                  <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4); margin-top: 0;">
                    Teléfono: <strong style="color: var(--text-primary);">${biz.phone || '—'}</strong>
                  </p>
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-muted); border-top: 1px solid var(--border-soft); padding-top: var(--space-3); margin-top: auto;">
                  <span>Estado: <strong style="color: ${biz.is_paused ? '#f97316' : 'var(--accent-neon)'};">${biz.is_paused ? 'Pausado' : 'Activo'}</strong></span>
                  
                  <div style="display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-1);">
                    <a href="/booking.html?b=${biz.slug}" target="_blank" style="
                      color: var(--accent-purple); 
                      text-decoration: none; 
                      display: inline-flex; 
                      align-items: center; 
                      gap: 4px;
                      font-weight: 600;
                    ">
                      Ver Agendador
                      <i data-lucide="external-link" style="width: 10px; height: 10px;"></i>
                    </a>
                    <a href="#" class="edit-settings-link" data-id="${biz.id}" style="
                      color: var(--accent-purple); 
                      font-weight: 600; 
                      text-decoration: none;
                    ">Editar Ajustes</a>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        `}
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Activar negocio
    container.querySelectorAll('.btn-set-active').forEach(btn => {
      btn.addEventListener('click', () => {
        setActiveBusinessId(btn.dataset.id);
        render();
      });
    });

    // Editar negocio
    container.querySelectorAll('.edit-settings-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const bizId = link.getAttribute('data-id');
        const biz = businesses.find(b => b.id === bizId);
        if (biz) {
          // Normalizar campo paused para el modal
          openBusinessModal({
            mode: 'edit',
            businessData: { ...biz, paused: biz.is_paused, logo: biz.logo_url },
            onSave: async () => {
              await render();
            }
          });
        }
      });
    });

    // Nuevo negocio
    const addBtn = container.querySelector('#btn-add-biz');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openBusinessModal({
          mode: 'create',
          onSave: async () => {
            await render();
          }
        });
      });
    }
  };

  await render();

  // Escuchar cambios globales
  const onBizChanged = () => render();
  window.addEventListener('citum_businesses_changed', onBizChanged);
  window.addEventListener('citum_active_business_changed', onBizChanged);

  // Limpieza al desmontar
  const checkInterval = setInterval(() => {
    if (!document.body.contains(container)) {
      window.removeEventListener('citum_businesses_changed', onBizChanged);
      window.removeEventListener('citum_active_business_changed', onBizChanged);
      clearInterval(checkInterval);
    }
  }, 3000);
}
