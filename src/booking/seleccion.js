// seleccion.js — Módulo del paso 2: Selección de Profesional, Fecha y Hora

export function init(container, state, actions) {
  // Profesionales de prueba
  const mockProfessionals = [
    { id: 'prof-1', name: 'Cualquiera (Cualquier Profesional)', role: 'Asignación automática' },
    { id: 'prof-2', name: 'Juan Pérez', role: 'Barbero Senior' },
    { id: 'prof-3', name: 'Carlos Gómez', role: 'Estilista & Colorista' }
  ];

  // Fechas de prueba (próximos 5 días)
  const getUpcomingDates = () => {
    const dates = [];
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        isoString: d.toISOString().split('T')[0],
        dayName: daysOfWeek[d.getDay()],
        dayNum: d.getDate(),
        monthName: months[d.getMonth()]
      });
    }
    return dates;
  };

  const dates = getUpcomingDates();

  // Horarios de prueba
  const mockTimeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
  ];

  // Asignar valores por defecto si no existen en el estado
  if (!state.selectedProfessional) state.selectedProfessional = mockProfessionals[0];
  if (!state.selectedDate) state.selectedDate = dates[0].isoString;

  // Renderizar la vista
  container.innerHTML = `
    <div class="flow-view">
      <div>
        <h2 class="flow-title">Elige fecha y hora</h2>
        <p class="flow-subtitle">Completa los detalles de tu reserva.</p>
      </div>

      <!-- Selector de Profesional -->
      <div class="scheduling-section">
        <span class="scheduling-label">1. ¿Con quién deseas tu servicio?</span>
        <div class="professionals-selector-grid">
          ${mockProfessionals.map(prof => {
            const isSelected = state.selectedProfessional?.id === prof.id;
            return `
              <div class="prof-card ${isSelected ? 'selected' : ''}" data-id="${prof.id}">
                <div class="prof-avatar-placeholder">
                  <i data-lucide="user" size="18"></i>
                </div>
                <div>
                  <div class="prof-name">${prof.name}</div>
                  <div class="prof-role">${prof.role}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Selector de Fechas -->
      <div class="scheduling-section" style="margin-top: var(--space-6);">
        <span class="scheduling-label">2. Selecciona la fecha</span>
        <div class="dates-carousel">
          ${dates.map(d => {
            const isSelected = state.selectedDate === d.isoString;
            return `
              <div class="date-carousel-item ${isSelected ? 'selected' : ''}" data-date="${d.isoString}">
                <span class="date-month">${d.monthName}</span>
                <span class="date-number">${d.dayNum}</span>
                <span class="date-day">${d.dayName}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Selector de Horas -->
      <div class="scheduling-section" style="margin-top: var(--space-6);">
        <span class="scheduling-label">3. Selecciona la hora</span>
        <div class="time-slots-grid">
          ${mockTimeSlots.map(time => {
            const isSelected = state.selectedTimeSlot === time;
            return `
              <button class="time-slot-btn ${isSelected ? 'selected' : ''}" data-time="${time}">
                ${time}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Botones de Acción -->
      <div class="step-actions-footer" style="margin-top: var(--space-8); display: flex; gap: var(--space-4);">
        <button class="btn btn-secondary" style="flex: 1;" id="btn-back-step-2">Atrás</button>
        <button class="btn btn-primary" style="flex: 1;" id="btn-next-step-2" ${state.selectedTimeSlot ? '' : 'disabled'}>Continuar</button>
      </div>
    </div>
  `;

  // Estilos rápidos para esta sección (para evitar inflar booking.css con clases muy específicas)
  const style = document.createElement('style');
  style.id = 'scheduling-styles';
  style.innerHTML = `
    .scheduling-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .scheduling-label {
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .professionals-selector-grid {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .prof-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-sm);
      padding: var(--space-3) var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-4);
      cursor: pointer;
      transition: all var(--transition-base);
    }
    .prof-card:hover {
      background: var(--bg-card);
      border-color: rgba(139, 92, 255, 0.2);
    }
    .prof-card.selected {
      background: rgba(139, 92, 255, 0.05);
      border-color: var(--accent-purple);
    }
    .prof-avatar-placeholder {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      border: 1px solid var(--border-soft);
    }
    .prof-card.selected .prof-avatar-placeholder {
      background: var(--accent-purple);
      color: #ffffff;
    }
    .prof-name {
      font-size: var(--text-base);
      font-weight: 700;
    }
    .prof-role {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }
    
    .dates-carousel {
      display: flex;
      gap: var(--space-2);
      overflow-x: auto;
      padding-bottom: var(--space-2);
    }
    .date-carousel-item {
      flex: 0 0 75px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-sm);
      padding: var(--space-3) var(--space-2);
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: all var(--transition-base);
    }
    .date-carousel-item:hover {
      background: var(--bg-card);
      border-color: rgba(139, 92, 255, 0.2);
    }
    .date-carousel-item.selected {
      background: rgba(139, 92, 255, 0.05);
      border-color: var(--accent-purple);
      box-shadow: 0 0 15px rgba(139, 92, 255, 0.1);
    }
    .date-month {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
    }
    .date-number {
      font-size: var(--text-xl);
      font-weight: 800;
      margin-vertical: 2px;
    }
    .date-day {
      font-size: 10px;
      color: var(--text-secondary);
    }
    .date-carousel-item.selected .date-month,
    .date-carousel-item.selected .date-day {
      color: var(--accent-neon);
    }

    .time-slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: var(--space-2);
    }
    .time-slot-btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-xs);
      padding: var(--space-3) var(--space-1);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-secondary);
      text-align: center;
      cursor: pointer;
      transition: all var(--transition-base);
    }
    .time-slot-btn:hover {
      background: var(--bg-card);
      border-color: rgba(139, 92, 255, 0.2);
      color: var(--text-primary);
    }
    .time-slot-btn.selected {
      background: var(--accent-purple);
      border-color: var(--accent-purple);
      color: #ffffff;
      box-shadow: 0 0 12px rgba(139, 92, 255, 0.35);
    }
  `;
  
  // Evitar duplicar estilos
  const oldStyles = document.getElementById('scheduling-styles');
  if (oldStyles) oldStyles.remove();
  document.head.appendChild(style);

  // Inicializar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Enlazar eventos de Profesionales
  container.querySelectorAll('.prof-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      state.selectedProfessional = mockProfessionals.find(p => p.id === id);
      
      container.querySelectorAll('.prof-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  // Enlazar eventos de Fechas
  container.querySelectorAll('.date-carousel-item').forEach(item => {
    item.addEventListener('click', () => {
      state.selectedDate = item.getAttribute('data-date');
      
      container.querySelectorAll('.date-carousel-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });

  // Enlazar eventos de Horas
  container.querySelectorAll('.time-slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedTimeSlot = btn.getAttribute('data-time');
      
      container.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Habilitar botón de continuar
      const nextBtn = document.getElementById('btn-next-step-2');
      if (nextBtn) {
        nextBtn.removeAttribute('disabled');
      }
    });
  });

  // Eventos de botones
  container.querySelector('#btn-back-step-2').addEventListener('click', () => actions.back());
  container.querySelector('#btn-next-step-2').addEventListener('click', () => actions.next());
}
