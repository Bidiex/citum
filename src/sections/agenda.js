// agenda.js — Módulo de la Agenda del Panel

export function init(container) {
  // Citas de prueba
  const mockAppointments = [
    { time: '09:00 AM', client: 'Carlos Mendoza', service: 'Corte Premium', prof: 'Juan Pérez', status: 'confirmada' },
    { time: '10:00 AM', client: 'Diana Turbay', service: 'Perfilado de Cejas', prof: 'Carlos Gómez', status: 'pendiente' },
    { time: '11:00 AM', client: 'Andrés López', service: 'Afeitado de Barba', prof: 'Juan Pérez', status: 'confirmada' },
    { time: '02:00 PM', client: 'Mateo Restrepo', service: 'Combo Imperial', prof: 'Carlos Gómez', status: 'pendiente' },
  ];

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div>
          <p class="flow-subtitle" style="margin-bottom: 0;">Administra y organiza las citas reservadas para hoy.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="btn-new-apt" style="height: 40px; padding-inline: var(--space-4);">
            <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
            Nueva Cita
          </button>
        </div>
      </div>

      <!-- Grid de Citas -->
      <div class="agenda-daily-timeline" style="display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4);">
        ${mockAppointments.map(apt => `
          <div class="agenda-item-card" style="
            background: var(--bg-secondary); 
            border: 1px solid var(--border-soft); 
            border-radius: var(--radius-sm); 
            padding: var(--space-4); 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
          ">
            <div style="display: flex; align-items: center; gap: var(--space-6);">
              <div style="
                font-size: var(--text-lg); 
                font-weight: 800; 
                color: var(--accent-neon);
                min-width: 90px;
              ">${apt.time}</div>
              
              <div>
                <h4 style="font-size: var(--text-base); font-weight: 700;">${apt.client}</h4>
                <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">
                  Servicio: <strong style="color: var(--text-secondary);">${apt.service}</strong> | Prof: <strong style="color: var(--text-secondary);">${apt.prof}</strong>
                </p>
              </div>
            </div>

            <div>
              <span class="status-badge ${apt.status}" style="
                font-size: 10px; 
                font-weight: 800; 
                text-transform: uppercase; 
                letter-spacing: 0.05em; 
                padding: var(--space-1) var(--space-3); 
                border-radius: var(--radius-pill);
                background: ${apt.status === 'confirmada' ? 'rgba(139, 92, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)'};
                color: ${apt.status === 'confirmada' ? 'var(--accent-neon)' : 'var(--text-muted)'};
                border: 1px solid ${apt.status === 'confirmada' ? 'rgba(139, 92, 255, 0.25)' : 'var(--border-soft)'};
              ">${apt.status}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Inicializar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
