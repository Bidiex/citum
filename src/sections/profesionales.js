// profesionales.js — Módulo de Profesionales del Panel

export function init(container) {
  const professionals = [
    { id: 'prof-2', name: 'Juan Pérez', role: 'Barbero Senior', email: 'juan@citum.app', active: true },
    { id: 'prof-3', name: 'Carlos Gómez', role: 'Estilista & Colorista', email: 'carlos@citum.app', active: true }
  ];

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div>
          <p class="flow-subtitle" style="margin-bottom: 0;">Administra los profesionales de tu negocio y sus horarios.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="btn-add-prof" style="height: 40px; padding-inline: var(--space-4);">
            <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
            Registrar Profesional
          </button>
        </div>
      </div>

      <div class="grid-panel" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
        ${professionals.map(prof => `
          <div class="card" style="padding: var(--space-6);">
            <div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-4);">
              <div style="
                width: 48px; 
                height: 48px; 
                border-radius: 50%; 
                background: rgba(139, 92, 255, 0.12); 
                display: flex; 
                align-items: center; 
                justify-content: center;
                color: var(--accent-neon);
              ">
                <i data-lucide="user"></i>
              </div>
              <div>
                <h4 style="font-size: var(--text-base); font-weight: 700;">${prof.name}</h4>
                <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">${prof.role}</p>
              </div>
            </div>
            <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
              Contacto: ${prof.email}
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-muted);">
              <span>Estado: <strong style="color: var(--accent-neon);">Activo</strong></span>
              <a href="#" style="color: var(--accent-purple); font-weight: 600;">Configurar Horarios</a>
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
