// profesionales.js — Módulo de Profesionales del Panel
import { openProfessionalDrawer } from '../components/professional-drawer.js';

export function init(container) {
  let professionals = [
    { 
      id: 'prof-2', 
      name: 'Juan Pérez', 
      role: 'Barbero Senior', 
      phone: '3001234567', 
      active: true,
      schedules: [
        { day_of_week: 1, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 2, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 3, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 4, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 5, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 6, start_time: '09:00:00', end_time: '14:00:00', is_available: true },
        { day_of_week: 0, start_time: '09:00:00', end_time: '19:00:00', is_available: false }
      ],
      breaks: [
        { day_of_week: 1, start_time: '13:00:00', end_time: '14:00:00', label: 'Almuerzo' }
      ]
    },
    { 
      id: 'prof-3', 
      name: 'Carlos Gómez', 
      role: 'Estilista & Colorista', 
      phone: '3109876543', 
      active: true,
      schedules: [
        { day_of_week: 1, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 2, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 3, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 4, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 5, start_time: '09:00:00', end_time: '19:00:00', is_available: true },
        { day_of_week: 6, start_time: '09:00:00', end_time: '14:00:00', is_available: true },
        { day_of_week: 0, start_time: '09:00:00', end_time: '19:00:00', is_available: false }
      ],
      breaks: []
    }
  ];

  function render() {
    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div>
            <p class="flow-subtitle" style="margin-bottom: 0;">Administra los profesionales de tu negocio y sus horarios.</p>
          </div>
          <div class="view-actions">
            <button class="btn btn-primary" id="btn-add-prof" style="height: 40px; padding-inline: var(--space-4);">
              <i data-lucide="user-plus" size="16" style="margin-right: var(--space-2);"></i>
              Registrar Profesional
            </button>
          </div>
        </div>

        <div class="grid-panel" id="prof-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
          ${professionals.map(prof => {
            const avatarLetters = prof.name ? prof.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
            return `
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
                    font-weight: 700;
                    border: 1px solid rgba(139, 92, 255, 0.2);
                  ">
                    ${avatarLetters}
                  </div>
                  <div>
                    <h4 style="font-size: var(--text-base); font-weight: 700;">${prof.name}</h4>
                    <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">${prof.role}</p>
                  </div>
                </div>
                <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
                  <i data-lucide="phone" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
                  ${prof.phone}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-muted);">
                  <span>Estado: <strong style="color: ${prof.active ? 'var(--accent-neon)' : '#ef4444'};">${prof.active ? 'Activo' : 'Inactivo'}</strong></span>
                  <a href="#" class="btn-config-hours" data-id="${prof.id}" style="color: var(--accent-purple); font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                    Editar Profesional
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Registrar Evento para Nuevo Profesional
    const btnAdd = container.querySelector('#btn-add-prof');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        openProfessionalDrawer({
          mode: 'create',
          onSave: (newProf) => {
            professionals.push(newProf);
            render();
          }
        });
      });
    }

    // Registrar Eventos para Configurar Horarios (Editar)
    container.querySelectorAll('.btn-config-hours').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const profId = e.currentTarget.dataset.id;
        const profObj = professionals.find(p => p.id === profId);
        
        if (profObj) {
          openProfessionalDrawer({
            mode: 'edit',
            professional: profObj,
            onSave: (updatedProf) => {
              const idx = professionals.findIndex(p => p.id === profId);
              if (idx !== -1) {
                professionals[idx] = updatedProf;
                render();
              }
            },
            onDelete: (deletedProfId) => {
              professionals = professionals.filter(p => p.id !== deletedProfId);
              render();
            }
          });
        }
      });
    });
  }

  render();
}

