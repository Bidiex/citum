// booking.js — Coordinador y Enrutador del Flujo de Reserva Público
import { getBusinessBySlug, addAppointment, getProfessionalsForBooking, getAppointments, getBusinessSchedules, getBusinessHolidays } from './utils/businessState.js';
import { getColombiaTodayStr, getColombiaTimeParts } from './utils/format.js';

function parseTimeString(timeStr) {
  if (!timeStr) return 480;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function hexToRgba(hex, alpha) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
  }
  return hex;
}

function hexToRgb(hex) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',');
  }
  return '139, 92, 255';
}

function getContrastColor(hex) {
  let r = 0, g = 0, b = 0;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    const cleanHex = hex.substring(1);
    const fullHex = cleanHex.length === 3
      ? cleanHex.split('').map(x => x + x).join('')
      : cleanHex;
    const num = parseInt(fullHex, 16);
    r = (num >> 16) & 255;
    g = (num >> 8) & 255;
    b = num & 255;
  }
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 180) ? '#181135' : '#ffffff';
}

// ============================================================
// LÓGICA DE HORARIO — "LOCAL CERRADO"
// ============================================================

/**
 * Convierte una cadena de tiempo "HH:MM:SS" o "HH:MM" a minutos desde medianoche.
 */
function timeStrToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

/**
 * Evalúa si el negocio está abierto en este momento.
 * Retorna { isOpen: bool, todaySchedule: obj|null }
 */
function checkBusinessIsOpen(schedules, holidays) {
  if (!schedules || schedules.length === 0) {
    // Sin horarios configurados → no bloqueamos
    return { isOpen: true, todaySchedule: null };
  }

  const todayStr = getColombiaTodayStr();
  const now = getColombiaTimeParts();
  const nowMinutes = now.hours * 60 + now.minutes;

  // Verificar si hoy es feriado
  const isTodayHoliday = (holidays || []).some(h => h.date === todayStr);
  if (isTodayHoliday) {
    return { isOpen: false, todaySchedule: null, reason: 'holiday' };
  }

  // Día de semana local Colombia (0=Dom … 6=Sáb)
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayDow = new Date(y, m - 1, d).getDay();

  const todaySchedule = schedules.find(s => s.day_of_week === todayDow);

  if (!todaySchedule || !todaySchedule.is_open) {
    return { isOpen: false, todaySchedule: null, reason: 'day_closed' };
  }

  const openMin = timeStrToMinutes(todaySchedule.start_time);
  const closeMin = timeStrToMinutes(todaySchedule.end_time);

  if (nowMinutes < openMin || nowMinutes >= closeMin) {
    return { isOpen: false, todaySchedule, reason: 'outside_hours' };
  }

  return { isOpen: true, todaySchedule };
}

/**
 * Busca el próximo momento de apertura y retorna info para mostrarlo.
 * Busca hasta 14 días hacia adelante.
 */
function getNextOpeningInfo(schedules, holidays) {
  if (!schedules || schedules.length === 0) return null;

  const todayStr = getColombiaTodayStr();
  const [y, m, d] = todayStr.split('-').map(Number);
  const now = getColombiaTimeParts();
  const nowMinutes = now.hours * 60 + now.minutes;

  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (let offset = 0; offset <= 14; offset++) {
    const candidate = new Date(y, m - 1, d + offset);
    const candDateStr = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(candidate);
    const dow = candidate.getDay();

    // Saltar feriados
    if ((holidays || []).some(h => h.date === candDateStr)) continue;

    const sched = schedules.find(s => s.day_of_week === dow);
    if (!sched || !sched.is_open) continue;

    const openMin = timeStrToMinutes(sched.start_time);

    // Si es hoy, el próximo turno debe ser después de ahora
    if (offset === 0 && nowMinutes >= openMin) continue;

    // Formatear hora de apertura en 12h AM/PM
    let hrs = Math.floor(openMin / 60);
    const mins = openMin % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    if (hrs > 12) hrs -= 12;
    if (hrs === 0) hrs = 12;
    const timeFormatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;

    // Etiqueta del día
    let dayLabel;
    if (offset === 0) {
      dayLabel = 'hoy';
    } else if (offset === 1) {
      dayLabel = 'mañana';
    } else {
      dayLabel = `el ${DAY_NAMES[dow]} ${candidate.getDate()} ${MONTHS[candidate.getMonth()]}`;
    }

    return { dayLabel, time: timeFormatted, sched };
  }

  return null; // No se encontró apertura en los próximos 14 días
}

/**
 * Renderiza la pantalla de "Local Cerrado" en el contenedor del flujo.
 * @param {Function} [onScheduleAnyway] - Callback opcional cuando el usuario
 *   elige agendar igualmente para otro día.
 */
function renderClosedScreen(container, biz, closedInfo, nextOpening, onScheduleAnyway) {
  // Construir info de horario de hoy
  let todayHoursHTML = '';
  if (closedInfo.todaySchedule) {
    const s = closedInfo.todaySchedule;
    const fmt = (t) => {
      const [hh, mm] = t.split(':').map(Number);
      const ap = hh >= 12 ? 'PM' : 'AM';
      let h = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap}`;
    };
    todayHoursHTML = `
      <div class="closed-today-hours">
        <i data-lucide="clock" style="width:12px;height:12px;"></i>
        Hoy atendemos de ${fmt(s.start_time)} a ${fmt(s.end_time)}
      </div>`;
  }

  // Card de próxima apertura
  let nextCardHTML = '';
  if (nextOpening) {
    nextCardHTML = `
      <div class="closed-next-card">
        <span class="closed-next-label">Próxima disponibilidad</span>
        <div class="closed-next-divider"></div>
        <div class="closed-next-day">Abrimos ${nextOpening.dayLabel}</div>
        <div class="closed-next-time">${nextOpening.time}</div>
        ${todayHoursHTML}
      </div>`;
  } else {
    nextCardHTML = `
      <div class="closed-next-card">
        <span class="closed-next-label">Sin próxima apertura</span>
        <div class="closed-next-divider"></div>
        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin:0;">
          Consulta nuestras redes sociales para más información.
        </p>
      </div>`;
  }

  // Razón del cierre para el badge
  let badgeText = 'Cerrado ahora';
  if (closedInfo.reason === 'holiday') badgeText = 'Feriado hoy';
  else if (closedInfo.reason === 'day_closed') badgeText = 'Cerrado hoy';

  // Botón CTA solo si hay callback (es decir, si puede agendar para otro día)
  const ctaHTML = onScheduleAnyway ? `
    <button class="btn btn-primary closed-cta-btn" id="btn-schedule-anyway">
      <i data-lucide="calendar-plus" style="width:18px;height:18px;"></i>
      Agendar para otro día
    </button>
    <p class="closed-footer-tip">Elige la fecha que más te convenga.</p>
  ` : `
    <p class="closed-footer-tip">Puedes volver cuando abramos para agendar tu cita.</p>
  `;

  container.innerHTML = `
    <div class="closed-screen">
      <div class="closed-icon-ring">
        <div class="closed-icon-inner">
          <i data-lucide="moon" style="width:32px;height:32px;"></i>
        </div>
      </div>

      <div>
        <h2 class="closed-headline">En este momento<br>estamos cerrados</h2>
      </div>

      <div class="closed-today-badge">
        <span class="dot"></span>
        ${badgeText}
      </div>

      <p class="closed-subtext">
        No tomamos citas para hoy, pero <strong>puedes reservar tu lugar para otro día</strong> sin problema.
      </p>

      ${nextCardHTML}

      ${ctaHTML}
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Enlazar botón CTA
  if (onScheduleAnyway) {
    const btn = container.querySelector('#btn-schedule-anyway');
    if (btn) btn.addEventListener('click', onScheduleAnyway);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const bizSlug = urlParams.get('b');

  let activeBiz = null;
  if (bizSlug) {
    activeBiz = await getBusinessBySlug(bizSlug);
  }

  if (!activeBiz) {
    const container = document.getElementById('booking-flow-container');
    if (container) {
      container.innerHTML = `
        <div class="booking-loading-placeholder" style="padding-top: var(--space-12); text-align: center;">
          <i data-lucide="alert-triangle" style="width: 64px; height: 64px; color: #ff5a7a; margin-bottom: 20px;"></i>
          <h2 style="color: #ff5a7a;">Negocio no encontrado</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">El enlace que has seguido es inválido, o el negocio se encuentra pausado.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    return;
  }

  // Aplicar datos del negocio a la UI de reservas
  if (activeBiz) {
    // Título
    const titleEl = document.getElementById('booking-biz-title');
    if (titleEl) titleEl.textContent = activeBiz.name;

    // Dirección
    const addressEl = document.getElementById('booking-biz-address');
    if (addressEl) addressEl.textContent = activeBiz.address || 'Sin dirección registrada';

    // Portada (Cover)
    const heroEl = document.getElementById('booking-hero');
    if (heroEl) {
      if (activeBiz.cover_url) {
        heroEl.style.backgroundImage = `url("${activeBiz.cover_url}")`;
      } else {
        heroEl.style.backgroundImage = 'none';
      }
    }

    // Logo / Inicial
    const logoEl = document.getElementById('booking-hero-logo');
    if (logoEl) {
      if (activeBiz.logo_url) {
        logoEl.innerHTML = `<img src="${activeBiz.logo_url}" alt="${activeBiz.name}" style="width: 100%; height: 100%; object-fit: cover;" />`;
      } else {
        logoEl.textContent = activeBiz.name.charAt(0).toUpperCase();
      }
    }

    // Aplicar variables CSS
    const color = activeBiz.color || '#8B5CF6';
    document.documentElement.style.setProperty('--biz-accent', color);
    document.documentElement.style.setProperty('--biz-accent-light', hexToRgba(color, 0.12));
    document.documentElement.style.setProperty('--biz-accent-text', getContrastColor(color));
    document.documentElement.style.setProperty('--biz-accent-rgb', hexToRgb(color));
  }

  // Inicializar íconos Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Estado global de la reserva en el cliente
  const bookingState = {
    business: activeBiz,
    selectedServices: [],
    selectedProfessional: null,
    selectedDate: null,
    selectedTimeSlot: null,
    clientInfo: {
      name: '',
      phone: '',
      email: '',
      notes: ''
    }
  };

  // Referencias a los pasos del indicador
  const stepIndicators = {
    1: document.getElementById('step-1-indicator'),
    2: document.getElementById('step-2-indicator'),
    3: document.getElementById('step-3-indicator')
  };

  const connectors = {
    1: document.getElementById('connector-1'),
    2: document.getElementById('connector-2')
  };

  // Función para transicionar entre pasos
  const goToStep = async (step) => {
    const container = document.getElementById('booking-flow-container');
    if (!container) return;

    // Mostrar loader de transición
    container.innerHTML = `
      <div class="booking-loading-placeholder">
        <i data-lucide="loader" class="loader-icon anim-spin"></i>
        <h3>Cargando paso ${step}...</h3>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Actualizar barra de progreso (Steppers)
    Object.keys(stepIndicators).forEach(key => {
      const stepNum = parseInt(key);
      const indicator = stepIndicators[stepNum];

      if (stepNum === step) {
        indicator.classList.add('active');
        indicator.classList.remove('completed');
      } else if (stepNum < step) {
        indicator.classList.add('completed');
        indicator.classList.remove('active');
      } else {
        indicator.classList.remove('active', 'completed');
      }
    });

    Object.keys(connectors).forEach(key => {
      const connNum = parseInt(key);
      const connector = connectors[connNum];
      if (connNum < step) {
        connector.classList.add('completed');
      } else {
        connector.classList.remove('completed');
      }
    });

    try {
      let moduleName = '';
      if (step === 1) moduleName = 'catalogo';
      else if (step === 2) moduleName = 'seleccion';
      else if (step === 3) moduleName = 'confirmacion';

      const mod = await import(`./booking/${moduleName}.js`);

      container.innerHTML = '';
      mod.init(container, bookingState, {
        next: () => goToStep(step + 1),
        back: () => goToStep(step - 1),
        submit: () => submitBooking()
      });

    } catch (error) {
      console.error(`Error cargando el paso ${step} del booking:`, error);
      container.innerHTML = `
        <div class="booking-loading-placeholder" style="padding-top: var(--space-8);">
          <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #ff5a7a;"></i>
          <h3 style="color: #ff5a7a;">Error al cargar el paso</h3>
          <p>No se pudo iniciar el módulo de reservas. Intentelo nuevamente.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  };

  // Envío final del formulario de reserva
  const submitBooking = async () => {
    const container = document.getElementById('booking-flow-container');
    if (!container) return;

    container.innerHTML = `
      <div class="booking-loading-placeholder">
        <i data-lucide="loader" class="loader-icon anim-spin"></i>
        <h3>Confirmando tu reserva...</h3>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
      let assignedProfId = bookingState.selectedProfessional.id;

      // Auto-asignación ("Cualquiera")
      if (assignedProfId === 'prof-1') {
        const professionals = await getProfessionalsForBooking(bookingState.business.id);
        const appointments = await getAppointments(bookingState.business.id);

        const slotStart = parseTimeString(bookingState.selectedTimeSlot);
        const totalDuration = bookingState.selectedServices.reduce((sum, s) => sum + s.duration, 0);

        const checkOverlap = (profId) => {
          return appointments.some(apt => {
            if (apt.date !== bookingState.selectedDate) return false;
            if (apt.professional_id !== profId) return false;
            const start = parseTimeString(apt.time);
            const duration = apt.rawServices?.reduce((sum, s) => sum + s.duration_at_time, 0) || 30;
            const end = start + duration;
            return slotStart < end && (slotStart + totalDuration) > start;
          });
        };

        const freeProf = professionals.find(p => !checkOverlap(p.id));
        if (freeProf) {
          assignedProfId = freeProf.id;
        } else if (professionals.length > 0) {
          assignedProfId = professionals[0].id;
        } else {
          throw new Error('No hay profesionales activos en este negocio');
        }
      }

      // Preparar payload
      const payload = {
        date: bookingState.selectedDate,
        time: bookingState.selectedTimeSlot,
        client: bookingState.clientInfo.name.trim(),
        phone: bookingState.clientInfo.phone.trim(),
        email: bookingState.clientInfo.email.trim() || null,
        status: 'pendiente',
        notes: bookingState.clientInfo.notes.trim(),
        source: 'publica',
        professional_id: assignedProfId,
        totalPrice: bookingState.selectedServices.reduce((sum, s) => sum + s.price, 0)
      };

      // Guardar cita en Supabase
      await addAppointment(bookingState.business.id, payload, bookingState.selectedServices);

      container.innerHTML = `
        <div class="booking-loading-placeholder" style="padding-top: var(--space-8); text-align: center;">
          <i data-lucide="check-circle" style="width: 64px; height: 64px; color: var(--biz-accent); filter: drop-shadow(0 0 10px var(--biz-accent-light));"></i>
          <h2 style="margin-top: var(--space-4);">¡Reserva Confirmada Exitosamente!</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">Tu cita ha sido agendada. Te esperamos el día seleccionado.</p>
          <a href="/index.html" class="btn btn-primary" style="background: var(--biz-accent); border:none; box-shadow: 0 4px 15px var(--biz-accent-light);">Volver al Inicio</a>
        </div>
      `;
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="booking-loading-placeholder" style="padding-top: var(--space-8); text-align: center;">
          <i data-lucide="alert-circle" style="width: 64px; height: 64px; color: #ff5a7a;"></i>
          <h2 style="margin-top: var(--space-4); color: #ff5a7a;">Error al confirmar reserva</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">${err.message}</p>
          <button class="btn btn-primary" id="btn-retry-booking">Intentar de nuevo</button>
        </div>
      `;

      const retryBtn = container.querySelector('#btn-retry-booking');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => goToStep(3));
      }
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  };

  // ── Verificar si el negocio está abierto en este momento ──
  const stepper = document.getElementById('booking-progress-stepper');

  try {
    const [bizSchedules, bizHolidays] = await Promise.all([
      getBusinessSchedules(activeBiz.id),
      getBusinessHolidays(activeBiz.id)
    ]);

    const closedInfo = checkBusinessIsOpen(bizSchedules, bizHolidays);

    if (!closedInfo.isOpen) {
      // Ocultar stepper — no aplica hasta que el usuario elija agendar
      if (stepper) stepper.style.display = 'none';

      const nextOpening = getNextOpeningInfo(bizSchedules, bizHolidays);
      const container = document.getElementById('booking-flow-container');

      // Callback: el cliente decide agendar para otro día → retomar flujo normal
      const onScheduleAnyway = () => {
        if (stepper) stepper.style.display = '';
        goToStep(1);
      };

      if (container) renderClosedScreen(container, activeBiz, closedInfo, nextOpening, onScheduleAnyway);
      return; // Detener el flujo automático; el usuario decide cuándo continuar
    }
  } catch (err) {
    // Si falla la consulta de horarios, continuar normalmente
    console.warn('[Booking] No se pudo verificar horario del negocio:', err.message);
  }

  // Cargar paso 1 por defecto (catálogo)
  goToStep(1);
});
