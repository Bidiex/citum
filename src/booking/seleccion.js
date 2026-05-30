import { getColombiaDate, parseTimestamptzToColombia, getColombiaTodayStr, getColombiaTimeParts } from '../utils/format.js';
import { getProfessionalsForBooking, getBusinessSchedules, getBusinessHolidays } from '../utils/businessState.js';
import { supabase } from '../core/supabase.js';

function parseTimeString(timeStr) {
  if (!timeStr) return 0;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

async function fetchAvailableSlots(profId, dateStr, totalDuration, professionals) {
  if (profId !== 'prof-1') {
    const { data, error } = await supabase.rpc('get_available_slots', {
      p_professional_id: profId,
      p_date: dateStr,
      p_duration_min: totalDuration
    });
    if (error) {
      console.error('[fetchAvailableSlots] Error:', error.message);
      return [];
    }
    return (data || []).map(slot => {
      const { time } = parseTimestamptzToColombia(slot.slot_start);
      return time;
    });
  } else {
    // Si es "Cualquiera", obtener la unión de todos los profesionales activos
    const promises = professionals.filter(p => p.id !== 'prof-1').map(p => 
      supabase.rpc('get_available_slots', {
        p_professional_id: p.id,
        p_date: dateStr,
        p_duration_min: totalDuration
      })
    );
    
    const results = await Promise.all(promises);
    const slotSet = new Set();
    
    results.forEach(res => {
      if (res.data) {
        res.data.forEach(slot => {
          const { time } = parseTimestamptzToColombia(slot.slot_start);
          slotSet.add(time);
        });
      }
    });
    
    return Array.from(slotSet).sort((a, b) => {
      return parseTimeString(a) - parseTimeString(b);
    });
  }
}

export async function init(container, state, actions) {
  const bizId = state.business ? state.business.id : '';

  // Mostrar loading
  container.innerHTML = `
    <div class="booking-loading-placeholder" style="text-align: center; padding: var(--space-8);">
      <i data-lucide="loader" class="loader-icon anim-spin" style="color: var(--biz-accent);"></i>
      <h3 style="margin-top: 15px;">Cargando horarios y profesionales...</h3>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Cargar profesionales, horarios del negocio y feriados de la DB
  const [professionalsList, bizSchedules, bizHolidays] = await Promise.all([
    getProfessionalsForBooking(bizId),
    getBusinessSchedules(bizId),
    getBusinessHolidays(bizId)
  ]);

  const mockProfessionals = [
    { id: 'prof-1', name: 'Cualquiera (Cualquier Profesional)', role: 'Asignación automática' },
    ...professionalsList
  ];

  // Fechas de la jornada
  const getUpcomingDates = () => {
    const dates = [];
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const todayStr = getColombiaTodayStr();
    const [year, month, day] = todayStr.split('-').map(Number);
    
    for (let i = 0; i < 5; i++) {
      const colD = new Date(year, month - 1, day + i);
      const colDateStr = getColombiaDate(colD);
      const dow = colD.getDay();
      
      // Verificar si es un día feriado en el negocio
      const isHoliday = bizHolidays.some(h => h.date === colDateStr);
      // Verificar si el negocio abre este día de la semana
      const bizSched = bizSchedules.find(s => s.day_of_week === dow);
      const isBizClosed = bizSched ? !bizSched.is_open : false;

      dates.push({
        isoString: colDateStr,
        dayName: daysOfWeek[dow],
        dayNum: colD.getDate(),
        monthName: months[colD.getMonth()],
        isClosed: isHoliday || isBizClosed
      });
    }
    return dates;
  };

  const dates = getUpcomingDates();

  // Valores predeterminados
  const firstOpenDate = dates.find(d => !d.isClosed) || dates[0];
  if (!state.selectedProfessional) state.selectedProfessional = mockProfessionals[0];
  if (!state.selectedDate || dates.every(d => d.isoString !== state.selectedDate)) {
    state.selectedDate = firstOpenDate.isoString;
  }

  // Renderizar Estructura
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
                  <div class="prof-role">${prof.role || 'Profesional'}</div>
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
              <div class="date-carousel-item ${isSelected ? 'selected' : ''} ${d.isClosed ? 'disabled-date' : ''}" data-date="${d.isoString}" ${d.isClosed ? 'style="opacity: 0.45; pointer-events: none;"' : ''}>
                <span class="date-month">${d.monthName}</span>
                <span class="date-number">${d.dayNum}</span>
                <span class="date-day">${d.isClosed ? 'Cerrado' : d.dayName}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Selector de Horas -->
      <div class="scheduling-section" style="margin-top: var(--space-6);">
        <span class="scheduling-label">3. Selecciona la hora</span>
        <div class="time-slots-grid">
          <!-- Se cargan por AJAX -->
        </div>
      </div>

      <!-- Botones de Acción -->
      <div class="step-actions-footer" style="margin-top: var(--space-8); display: flex; gap: var(--space-4);">
        <button class="btn btn-secondary" style="flex: 1;" id="btn-back-step-2">Atrás</button>
        <button class="btn btn-primary" style="flex: 1;" id="btn-next-step-2" ${state.selectedTimeSlot ? '' : 'disabled'}>Continuar</button>
      </div>
    </div>
  `;

  // Estilos
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
    .date-carousel-item.disabled-date {
      opacity: 0.45;
      pointer-events: none;
      cursor: not-allowed;
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
  
  const oldStyles = document.getElementById('scheduling-styles');
  if (oldStyles) oldStyles.remove();
  document.head.appendChild(style);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Duración total requerida
  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0);

  // Recarga de horarios
  const refreshSlots = async () => {
    const timeSlotsGrid = container.querySelector('.time-slots-grid');
    if (!timeSlotsGrid) return;

    timeSlotsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4);">
        <i data-lucide="loader" class="anim-spin" style="color: var(--biz-accent); display: inline-block;"></i>
        <span style="margin-left: 8px;">Buscando horarios disponibles...</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: timeSlotsGrid });

    let slots = await fetchAvailableSlots(
      state.selectedProfessional.id,
      state.selectedDate,
      totalDuration,
      mockProfessionals
    );

    // Filter out past time slots if the selected date is today in Colombia
    const todayStr = getColombiaTodayStr();
    if (state.selectedDate === todayStr) {
      const nowParts = getColombiaTimeParts();
      const currentMinutes = nowParts.hours * 60 + nowParts.minutes;
      slots = slots.filter(slot => parseTimeString(slot) >= currentMinutes);
    } else if (state.selectedDate < todayStr) {
      slots = [];
    }

    if (slots.length === 0) {
      timeSlotsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-6); color: var(--text-muted);">
          <i data-lucide="calendar-x" size="24" style="margin-bottom: 8px; color: #ff5a7a;"></i>
          <p>No hay turnos disponibles para esta fecha/profesional.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ node: timeSlotsGrid });
    } else {
      timeSlotsGrid.innerHTML = slots.map(time => {
        const isSelected = state.selectedTimeSlot === time;
        return `
          <button class="time-slot-btn ${isSelected ? 'selected' : ''}" data-time="${time}">
            ${time}
          </button>
        `;
      }).join('');
    }

    // Enlazar horas
    timeSlotsGrid.querySelectorAll('.time-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedTimeSlot = btn.getAttribute('data-time');
        timeSlotsGrid.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        const nextBtn = document.getElementById('btn-next-step-2');
        if (nextBtn) nextBtn.removeAttribute('disabled');
      });
    });

    const nextBtn = document.getElementById('btn-next-step-2');
    if (nextBtn) {
      if (slots.includes(state.selectedTimeSlot)) {
        nextBtn.removeAttribute('disabled');
      } else {
        state.selectedTimeSlot = null;
        nextBtn.setAttribute('disabled', 'true');
      }
    }
  };

  // Enlazar profesionales
  container.querySelectorAll('.prof-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.getAttribute('data-id');
      state.selectedProfessional = mockProfessionals.find(p => p.id === id);
      
      container.querySelectorAll('.prof-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      await refreshSlots();
    });
  });

  // Enlazar fechas
  container.querySelectorAll('.date-carousel-item').forEach(item => {
    item.addEventListener('click', async () => {
      state.selectedDate = item.getAttribute('data-date');
      
      container.querySelectorAll('.date-carousel-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      await refreshSlots();
    });
  });

  // Cargar primera vez
  await refreshSlots();

  // Enlazar botones
  container.querySelector('#btn-back-step-2').addEventListener('click', () => actions.back());
  container.querySelector('#btn-next-step-2').addEventListener('click', () => actions.next());
}
