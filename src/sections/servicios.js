// servicios.js — Módulo de Servicios del Panel

export function init(container) {
  const services = [
    { name: 'Corte de Cabello Premium', price: 35000, duration: 40, active: true },
    { name: 'Afeitado de Barba Ritual', price: 25000, duration: 30, active: true },
    { name: 'Perfilado de Cejas', price: 12000, duration: 15, active: true },
    { name: 'Combo Imperial', price: 55000, duration: 75, active: true }
  ];

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

      <div class="grid-panel" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
        ${services.map(srv => `
          <div class="card" style="padding: var(--space-6);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
              <h4 style="font-size: var(--text-base); font-weight: 700; max-width: 70%;">${srv.name}</h4>
              <span style="
                font-size: var(--text-xs); 
                font-weight: 800; 
                color: var(--accent-neon);
              ">COP $${srv.price.toLocaleString('es-CO')}</span>
            </div>
            <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
              Duración estimada: <strong>${srv.duration} min</strong>
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-muted);">
              <span>Estado: <strong style="color: var(--accent-neon);">Activo</strong></span>
              <a href="#" style="color: var(--accent-purple); font-weight: 600;">Editar Detalles</a>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
