// negocios.js — Módulo de Negocios del Panel

export function init(container) {
  const businesses = [
    { name: 'Barbería Imperial', slug: 'barberia-imperial', address: 'Calle 72 #10-15, Bogotá', phone: '3001234567' },
    { name: 'Salón Deluxe', slug: 'salon-deluxe', address: 'Av. 19 #100-80, Bogotá', phone: '3009876543' }
  ];

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
          <div class="card" style="padding: var(--space-6);">
            <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);">
              <div style="
                width: 40px; 
                height: 40px; 
                border-radius: var(--radius-sm); 
                background: var(--grad-brand); 
                color: #ffffff; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                font-weight: 800;
              ">
                ${biz.name.charAt(0)}
              </div>
              <div>
                <h4 style="font-size: var(--text-base); font-weight: 700;">${biz.name}</h4>
                <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">/b/${biz.slug}</p>
              </div>
            </div>
            
            <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">
              Dirección: <strong>${biz.address}</strong>
            </p>
            <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
              Teléfono: <strong>${biz.phone}</strong>
            </p>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs);">
              <a href="/booking.html" class="text-gradient" style="font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                Ver Agendador
                <i data-lucide="external-link" size="12"></i>
              </a>
              <a href="#" style="color: var(--text-muted);">Editar Ajustes</a>
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
