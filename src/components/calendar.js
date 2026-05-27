import { openAptDetailModal } from './apt-detail-modal.js';
import { openAppointmentModal } from './appointment-modal.js';
import { getColombiaTodayStr, getColombiaTimeParts } from '../utils/format.js';

// Duración de servicios por defecto
const SERVICE_DURATIONS = {
  'Corte Premium': 40,
  'Perfilado de Cejas': 15,
  'Afeitado de Barba': 30,
  'Combo Imperial': 75,
  'Corte de Cabello Premium': 40,
  'Afeitado de Barba Ritual': 30
};

// Horas del calendario (8:00 AM a 8:00 PM)
const TIME_LABELS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM',
  '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM',
  '08:00 PM'
];

function parseTimeString(timeStr) {
  if (!timeStr) return 480; // default 8am
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  // Ajuste para que la semana empiece el Lunes
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDays(startOfWeek) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
}

function getWeekRangeLabel(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(start.getDate() + 6);

  const startMonth = start.toLocaleDateString('es-ES', { month: 'short' });
  const endMonth = end.toLocaleDateString('es-ES', { month: 'short' });

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} - ${end.getDate()} de ${start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
  } else {
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} de ${end.getFullYear()}`;
  }
}

function getDayLabel(date) {
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  let formatted = date.toLocaleDateString('es-ES', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getAptDuration(apt) {
  if (apt.totalDuration) return apt.totalDuration;
  if (!apt.service) return 30;
  const services = apt.service.split(' + ').map(s => s.trim());
  let sum = 0;
  services.forEach(s => {
    sum += SERVICE_DURATIONS[s] || 30;
  });
  return sum || 30;
}

export function initCalendar({
  container,
  appointments = [],
  onNewAppointment = null,
  onAppointmentUpdate = null,
  onAppointmentDelete = null
}) {
  if (!container) return;

  // Estado interno del calendario (persiste la vista elegida)
  let currentView = localStorage.getItem('citum_calendar_view') || 'day'; // 'day' | 'week'
  let currentDate = new Date(getColombiaTodayStr() + 'T00:00:00');
  let timeLineInterval = null;

  // Renderizar la estructura del contenedor
  container.innerHTML = `
    <div class="cal-shell">
      <div class="cal-header">
        <div class="cal-nav-group">
          <button class="cal-btn" id="cal-prev-btn" aria-label="Anterior">
            <i data-lucide="chevron-left"></i>
          </button>
          <button class="cal-btn cal-btn-today" id="cal-today-btn">Hoy</button>
          <button class="cal-btn" id="cal-next-btn" aria-label="Siguiente">
            <i data-lucide="chevron-right"></i>
          </button>
          <h3 class="cal-title" id="cal-title-text">Cargando...</h3>
        </div>
        <div class="cal-view-toggle">
          <button class="cal-toggle-btn${currentView === 'day' ? ' active' : ''}" id="cal-toggle-day" data-view="day">Día</button>
          <button class="cal-toggle-btn${currentView === 'week' ? ' active' : ''}" id="cal-toggle-week" data-view="week">Semana</button>
        </div>
      </div>
      <div class="cal-body-scroll" id="cal-scroll-area">
        <div id="cal-grid-container"></div>
      </div>
    </div>
  `;

  // Referencias a elementos
  const prevBtn = container.querySelector('#cal-prev-btn');
  const nextBtn = container.querySelector('#cal-next-btn');
  const todayBtn = container.querySelector('#cal-today-btn');
  const titleText = container.querySelector('#cal-title-text');
  const toggleDay = container.querySelector('#cal-toggle-day');
  const toggleWeek = container.querySelector('#cal-toggle-week');
  const gridContainer = container.querySelector('#cal-grid-container');
  const scrollArea = container.querySelector('#cal-scroll-area');

  // Inicializar íconos Lucide para la cabecera
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: container.querySelector('.cal-header') });
  }

  // Manejo de eventos de navegación
  prevBtn.addEventListener('click', () => {
    if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() - 7);
    }
    render();
  });

  nextBtn.addEventListener('click', () => {
    if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 7);
    }
    render();
  });

  todayBtn.addEventListener('click', () => {
    currentDate = new Date(getColombiaTodayStr() + 'T00:00:00');
    render();
  });

  // Toggles de vistas (con persistencia)
  toggleDay.addEventListener('click', () => {
    currentView = 'day';
    localStorage.setItem('citum_calendar_view', 'day');
    toggleDay.classList.add('active');
    toggleWeek.classList.remove('active');
    render();
  });

  toggleWeek.addEventListener('click', () => {
    currentView = 'week';
    localStorage.setItem('citum_calendar_view', 'week');
    toggleWeek.classList.add('active');
    toggleDay.classList.remove('active');
    render();
  });

  // Función principal de renderizado
  function render() {
    // 1. Actualizar título de cabecera
    if (currentView === 'day') {
      titleText.textContent = getDayLabel(currentDate);
    } else {
      const weekStart = getStartOfWeek(currentDate);
      titleText.textContent = getWeekRangeLabel(weekStart);
    }

    // Limpiar intervalos antiguos de la línea de tiempo
    if (timeLineInterval) {
      clearInterval(timeLineInterval);
      timeLineInterval = null;
    }

    // 2. Renderizar Grid del cuerpo
    if (currentView === 'day') {
      renderDayView();
    } else {
      renderWeekView();
    }

    // 3. Renderizar línea de tiempo y arrancar intervalo
    renderTimeIndicator();
    timeLineInterval = setInterval(renderTimeIndicator, 60000);

    // 4. Centrar scroll vertical a las 9:00 AM la primera vez
    setTimeout(() => {
      // 9:00 AM está a 60px de la parte superior (1 hora desde las 8:00 AM)
      if (scrollArea.scrollTop === 0) {
        scrollArea.scrollTop = 60;
      }
    }, 50);
  }

  // Renderizar vista diaria
  function renderDayView() {
    const dateStr = formatDateISO(currentDate);
    
    // Generar HTML para líneas de división y columna de tiempo
    gridContainer.className = 'cal-grid cal-grid-day';
    gridContainer.innerHTML = `
      <div class="cal-time-col">
        ${TIME_LABELS.map(lbl => `<div class="cal-hour-label">${lbl}</div>`).join('')}
      </div>
      <div class="cal-day-col" id="cal-day-column" data-date="${dateStr}">
        <div class="cal-grid-lines">
          ${TIME_LABELS.map(() => `<div class="cal-grid-line"></div>`).join('')}
        </div>
        <!-- Cards se insertan por JS -->
      </div>
    `;

    const dayCol = gridContainer.querySelector('#cal-day-column');
    const dayApts = appointments.filter(apt => apt.date === dateStr);

    // Si no hay citas, mostrar placeholder sutil
    if (dayApts.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'cal-no-appointments';
      placeholder.innerHTML = `
        <i data-lucide="calendar-days" size="32"></i>
        <span>No hay citas programadas para hoy</span>
      `;
      dayCol.appendChild(placeholder);
      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ node: placeholder });
      }
    } else {
      layoutDayAppointments(dayCol, dayApts, 'day');
    }
  }

  // Renderizar vista semanal
  function renderWeekView() {
    const weekStart = getStartOfWeek(currentDate);
    const weekDays = getWeekDays(weekStart);
    const todayStr = getColombiaTodayStr();

    // La cabecera semanal va arriba del scrollable
    gridContainer.className = '';
    gridContainer.innerHTML = `
      <div class="cal-week-header-row">
        <div class="cal-week-header-spacer"></div>
        ${weekDays.map(d => {
          const isToday = formatDateISO(d) === todayStr;
          const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }).substring(0, 3);
          return `
            <div class="cal-week-day-header ${isToday ? 'is-today' : ''}">
              <span class="cal-week-day-name">${dayName}</span>
              <span class="cal-week-day-number">${d.getDate()}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="cal-grid cal-grid-week">
        <div class="cal-time-col">
          ${TIME_LABELS.map(lbl => `<div class="cal-hour-label">${lbl}</div>`).join('')}
        </div>
        ${weekDays.map(d => {
          const dateStr = formatDateISO(d);
          return `
            <div class="cal-day-col" data-date="${dateStr}">
              <div class="cal-grid-lines">
                ${TIME_LABELS.map(() => `<div class="cal-grid-line"></div>`).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Rellenar cada columna con sus citas
    const dayCols = gridContainer.querySelectorAll('.cal-grid-week .cal-day-col');
    dayCols.forEach((colEl, idx) => {
      const colDateStr = formatDateISO(weekDays[idx]);
      const dayApts = appointments.filter(apt => apt.date === colDateStr);
      layoutDayAppointments(colEl, dayApts, 'week');
    });
  }

  // Algoritmo de posicionamiento y solapamiento
  function layoutDayAppointments(colElement, dayApts, viewMode) {
    if (dayApts.length === 0) return;

    // Convertir citas a objetos de rango y ordenar por inicio
    const sorted = dayApts.map(apt => {
      const start = parseTimeString(apt.time);
      const duration = getAptDuration(apt);
      return {
        apt,
        start,
        end: start + duration,
        el: null
      };
    }).sort((a, b) => a.start - b.start);

    // Agrupar en columnas virtuales para solapamiento
    const columns = [];
    sorted.forEach(item => {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const last = col[col.length - 1];
        if (item.start >= last.end) {
          col.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
      }
    });

    // Renderizar y posicionar side-by-side
    const colCount = columns.length;
    for (let c = 0; c < colCount; c++) {
      const col = columns[c];
      col.forEach(item => {
        const card = document.createElement('div');
        card.className = `cal-apt-card ${item.apt.status || 'confirmada'} ${viewMode === 'week' ? 'compact' : ''}`;
        
        // 8:00 AM es 480 minutos. El alto de hora es 60px.
        const top = item.start - 480;
        const height = Math.max(item.end - item.start, 25); // mínimo 25px para legibilidad
        
        card.style.top = `${top}px`;
        card.style.height = `${height}px`;

        // Calcular ancho y left porcentual
        const widthPct = 100 / colCount;
        const leftPct = c * widthPct;
        card.style.left = `${leftPct}%`;
        card.style.width = `calc(${widthPct}% - 6px)`;

        // Contenidos
        const serviceShort = item.apt.service.split(' + ')[0];
        card.innerHTML = `
          <div>
            <div class="cal-apt-time">${item.apt.time}</div>
            <div class="cal-apt-client">${item.apt.client}</div>
          </div>
          <div class="cal-apt-details">
            <span class="cal-apt-status-dot"></span> ${serviceShort} · 👤 ${item.apt.prof.split(' ')[0]}
          </div>
        `;

        // Click abre detalle
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          openAptDetailModal({
            apt: item.apt,
            onEdit: (editedApt) => {
              // Abrir formulario con datos precargados
              openAppointmentModal({
                appointments: appointments,
                mode: 'edit',
                appointmentData: editedApt,
                onSave: (savedPayload, originalApt) => {
                  const oldAptCopy = { ...originalApt };
                  // Actualizar en caliente
                  Object.assign(originalApt, savedPayload);
                  
                  if (onAppointmentUpdate) {
                    onAppointmentUpdate(originalApt, oldAptCopy);
                  }
                  render();
                }
              });
            },
            onDelete: (deletedApt) => {
              // Eliminar de la lista local
              const index = appointments.indexOf(deletedApt);
              if (index !== -1) {
                appointments.splice(index, 1);
              }
              if (onAppointmentDelete) {
                onAppointmentDelete(deletedApt);
              }
              render();
            }
          });
        });

        colElement.appendChild(card);
        item.el = card;
      });
    }
  }

  // Dibujar indicador rojo de la hora actual
  function renderTimeIndicator() {
    // Buscar cualquier línea vieja y removerla
    gridContainer.querySelectorAll('.cal-current-time-line').forEach(el => el.remove());

    const todayStr = getColombiaTodayStr();
    const { hours, minutes } = getColombiaTimeParts();
    const nowMins = hours * 60 + minutes;

    // Si está fuera de horario (8 AM a 8 PM), no dibujar
    if (nowMins < 480 || nowMins > 1200) return;

    if (currentView === 'day') {
      if (formatDateISO(currentDate) === todayStr) {
        const dayCol = gridContainer.querySelector('.cal-day-col');
        if (dayCol) {
          const line = document.createElement('div');
          line.className = 'cal-current-time-line';
          line.style.top = `${nowMins - 480}px`;
          dayCol.appendChild(line);
        }
      }
    } else if (currentView === 'week') {
      const weekStart = getStartOfWeek(currentDate);
      const weekDays = getWeekDays(weekStart);
      const todayIdx = weekDays.findIndex(d => formatDateISO(d) === todayStr);

      if (todayIdx !== -1) {
        const dayCols = gridContainer.querySelectorAll('.cal-grid-week .cal-day-col');
        const targetCol = dayCols[todayIdx];
        if (targetCol) {
          const line = document.createElement('div');
          line.className = 'cal-current-time-line';
          line.style.top = `${nowMins - 480}px`;
          targetCol.appendChild(line);
        }
      }
    }
  }

  // Renderizado inicial
  render();

  // Retornar API pública por si se quiere forzar actualización desde fuera
  return {
    updateAppointments(newApts) {
      appointments = newApts;
      render();
    },
    refresh() {
      render();
    }
  };
}
