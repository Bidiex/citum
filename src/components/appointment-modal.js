// appointment-modal.js — Componente Modal de Nueva/Editar Cita para Recepcionistas
import { showToast } from '../utils/toast.js';
import { getColombiaTodayStr, getColombiaTimeParts } from '../utils/format.js';
import { searchClientsByName, getActiveBusinessId, getServices, fetchProfessionals, getBusinessSchedules, getBusinessHolidays } from '../utils/businessState.js';

function formatTimeString(minutesSinceMidnight) {
  let hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

const TIME_SLOTS = [];
for (let min = 8 * 60; min <= 20 * 60; min += 10) {
  TIME_SLOTS.push(formatTimeString(min));
}

function parseTimeString(timeStr) {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export async function openAppointmentModal({ appointments = [], onSave = null, mode = 'create', appointmentData = null } = {}) {
  const bizId = getActiveBusinessId();
  
  // Carga asíncrona de servicios, profesionales, horarios del negocio y feriados
  const [servicesData, professionalsData, bizSchedules, bizHolidays] = await Promise.all([
    getServices(bizId),
    fetchProfessionals(bizId),
    getBusinessSchedules(bizId),
    getBusinessHolidays(bizId)
  ]);
  
  const SERVICES = servicesData.filter(s => s.active !== false);
  const professionals = professionalsData.filter(p => p.active !== false);
  
  const SERVICE_DURATIONS = {};
  SERVICES.forEach(s => {
    SERVICE_DURATIONS[s.name] = s.duration;
  });

  // Asegurar que no haya otro modal duplicado
  const existing = document.getElementById('apt-modal-root');
  if (existing) {
    existing.remove();
  }

  // Contenedor principal del modal (overlay)
  const root = document.createElement('div');
  root.id = 'apt-modal-root';
  root.className = 'apt-modal-overlay';

  // Obtener fecha actual en la zona horaria de Colombia
  const todayStr = getColombiaTodayStr();

  // Configurar modo de profesional e inicializaciones de edición
  let isNextFreeMode = true;
  let selectedTimeSlot = '';
  let serviceNames = [];
  let isManualTimeMode = false;

  if (mode === 'edit' && appointmentData) {
    isNextFreeMode = false; // Edición suele fijar un profesional asignado
    selectedTimeSlot = appointmentData.time || '';
    if (appointmentData.service) {
      serviceNames = appointmentData.service.split(' + ').map(s => s.trim());
    }
  }

  const clientNameVal = mode === 'edit' && appointmentData ? appointmentData.client || '' : '';
  const clientPhoneVal = mode === 'edit' && appointmentData ? appointmentData.phone || '' : '';
  const clientEmailVal = mode === 'edit' && appointmentData ? appointmentData.email || '' : '';
  const dateVal = mode === 'edit' && appointmentData ? appointmentData.date || todayStr : todayStr;
  const notesVal = mode === 'edit' && appointmentData ? appointmentData.notes || '' : '';

  root.innerHTML = `
    <div class="apt-modal" role="dialog" aria-modal="true">
      <div class="apt-modal-header">
        <h2>
          <i data-lucide="${mode === 'edit' ? 'edit-3' : 'plus-circle'}" style="color: var(--accent-neon);"></i>
          ${mode === 'edit' ? 'Editar Cita' : 'Nueva Cita'}
        </h2>
        <button class="apt-modal-close" id="apt-modal-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="apt-modal-body">
        <!-- 👤 DATOS DEL CLIENTE -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="user" size="14"></i>
            Datos del Cliente
          </div>
          <div class="form-group autocomplete-container">
            <label for="apt-client-name">Nombre completo *</label>
            <input type="text" id="apt-client-name" class="form-input" placeholder="Ej. Carlos Mendoza" value="${clientNameVal}" autocomplete="off" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group autocomplete-container">
              <label for="apt-client-phone">Teléfono *</label>
              <input type="tel" id="apt-client-phone" class="form-input" placeholder="Ej. 3001234567" value="${clientPhoneVal}" autocomplete="off" required />
            </div>
            <div class="form-group">
              <label for="apt-client-email">Email (opcional)</label>
              <input type="email" id="apt-client-email" class="form-input" placeholder="Ej. cliente@correo.com" value="${clientEmailVal}" />
            </div>
          </div>
        </div>

        <!-- ✂️ SERVICIOS -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="briefcase" size="14"></i>
            Catálogo de Servicios
          </div>
          <div class="apt-services-grid" id="apt-services-list">
            ${SERVICES.map((srv, index) => {
              const isSelected = serviceNames.includes(srv.name);
              return `
                <div class="apt-service-item${isSelected ? ' selected' : ''}" data-index="${index}" data-name="${srv.name}" data-price="${srv.price}" data-duration="${srv.duration}" tabindex="0">
                  <div class="apt-service-left">
                    <div class="apt-service-checkbox">
                      <i data-lucide="check" size="12"></i>
                    </div>
                    <div>
                      <div class="apt-service-name">${srv.name}</div>
                      <div class="apt-service-meta">${srv.duration} min</div>
                    </div>
                  </div>
                  <div class="apt-service-price">$${srv.price.toLocaleString('es-CO')}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="apt-summary-bar">
            <div>Servicios seleccionados: <strong id="summary-count">0</strong></div>
            <div>Total: <strong id="summary-total" style="color: var(--accent-neon);">$0</strong> · Duración: <strong id="summary-duration">0 min</strong></div>
          </div>
        </div>

        <!-- 👨‍💼 PROFESIONAL -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="users" size="14"></i>
            Profesional Asignado
          </div>
          <div class="prof-toggle-group">
            <button type="button" class="prof-toggle-btn${isNextFreeMode ? ' active' : ''}" id="btn-next-free-toggle">
              <i data-lucide="zap" size="14"></i>
              El próximo libre
            </button>
            <button type="button" class="prof-toggle-btn${!isNextFreeMode ? ' active' : ''}" id="btn-manual-toggle">
              <i data-lucide="user-check" size="14"></i>
              Manual
            </button>
          </div>
          <div class="form-group" id="prof-select-container">
            <select class="form-input" id="apt-prof-select" ${isNextFreeMode ? 'disabled' : ''}>
              ${professionals.map(p => `
                <option value="${p.id}"${mode === 'edit' && appointmentData && appointmentData.professional_id === p.id ? ' selected' : ''}>${p.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="prof-context-hint" id="prof-hint-box">
            <i data-lucide="info" size="12"></i>
            <span id="prof-hint-text">Auto-asignando según disponibilidad...</span>
          </div>
        </div>

        <!-- 📅 FECHA Y HORA -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title" style="justify-content: space-between; align-items: center; width: 100%;">
            <span style="display: flex; align-items: center; gap: var(--space-2);">
              <i data-lucide="calendar" size="14"></i>
              Fecha y Horario
            </span>
            <div style="display: flex; gap: var(--space-2);">
              <button type="button" class="apt-quick-btn" id="btn-quick-today">📅 Hoy</button>
              <button type="button" class="apt-quick-btn" id="btn-quick-now">⚡ Ahora mismo</button>
            </div>
          </div>
          
          <div class="form-group">
            <label for="apt-date">Fecha de la cita</label>
            <input type="date" id="apt-date" class="form-input" value="${dateVal}" min="${todayStr}" />
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <label style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); display: block; margin: 0;">
                Horarios Disponibles
              </label>
              <button type="button" id="btn-toggle-timepicker" class="apt-quick-btn">
                🕐 Hora manual
              </button>
            </div>
            <input type="time" id="manual-time-input" style="display: none; width: 100%; padding: var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--text-base); font-family: var(--font-body); margin-bottom: var(--space-3);">
            <div class="time-chip-row" id="time-chips-container">
              <!-- Chips se renderizan por JS -->
            </div>
          </div>
        </div>

        <!-- 📝 NOTAS INTERNAS -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="file-text" size="14"></i>
            Notas Internas (Opcional)
          </div>
          <textarea id="apt-notes" class="form-input" rows="2" placeholder="Observaciones especiales para el profesional..." style="resize: vertical; min-height: 60px; font-family: inherit;">${notesVal}</textarea>
        </div>
      </div>

      <div class="apt-modal-footer">
        <button class="btn btn-secondary" id="apt-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="apt-save-btn">
          ${mode === 'edit' ? 'Guardar Cambios' : 'Confirmar Cita Ahora'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Inicializar Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({
      attrs: {
        'stroke-width': 2.5,
        'size': 16
      },
      nameAttr: 'data-lucide',
      node: root
    });
  }

  // Referencias a elementos del DOM
  const closeBtn = root.querySelector('#apt-modal-close-btn');
  const cancelBtn = root.querySelector('#apt-cancel-btn');
  const saveBtn = root.querySelector('#apt-save-btn');
  const nameInput = root.querySelector('#apt-client-name');
  const phoneInput = root.querySelector('#apt-client-phone');
  const emailInput = root.querySelector('#apt-client-email');
  const dateInput = root.querySelector('#apt-date');
  const profSelect = root.querySelector('#apt-prof-select');
  const nextFreeToggle = root.querySelector('#btn-next-free-toggle');
  const manualToggle = root.querySelector('#btn-manual-toggle');
  const profHintText = root.querySelector('#prof-hint-text');
  const timeChipsContainer = root.querySelector('#time-chips-container');
  const btnToggleTimepicker = root.querySelector('#btn-toggle-timepicker');
  const manualTimeInput = root.querySelector('#manual-time-input');
  const notesInput = root.querySelector('#apt-notes');
  const servicesList = root.querySelector('#apt-services-list');
  const summaryCount = root.querySelector('#summary-count');
  const summaryTotal = root.querySelector('#summary-total');
  const summaryDuration = root.querySelector('#summary-duration');

  // Configuración de autocompletado para Clientes
  const setupAutocomplete = (inputEl) => {
    let dropdown = null;
    let currentQuery = '';
    let activeIndex = -1;

    const closeDropdown = () => {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
        activeIndex = -1;
      }
    };

    inputEl.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      currentQuery = query;
      closeDropdown();
      if (!query || query.length < 2) return;

      const bizId = getActiveBusinessId();
      searchClientsByName(query, bizId).then(matches => {
        if (query !== currentQuery) return;

        closeDropdown();

        if (!matches || matches.length === 0) return;

        activeIndex = -1;
        dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        
        dropdown.innerHTML = matches.map(c => `
          <div class="autocomplete-item" data-name="${c.name}" data-phone="${c.phone}" data-email="${c.email || ''}">
            <span class="autocomplete-item-name">${c.name}</span>
            <span class="autocomplete-item-phone">${c.phone}</span>
          </div>
        `).join('');

        inputEl.parentNode.appendChild(dropdown);

        // Vincular eventos de click a los items
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            nameInput.value = item.getAttribute('data-name');
            phoneInput.value = item.getAttribute('data-phone');
            emailInput.value = item.getAttribute('data-email');
            closeDropdown();
          });
        });
      });
    });

    // Cerrar al perder foco (ej. navegación con Tab)
    inputEl.addEventListener('blur', () => {
      setTimeout(closeDropdown, 200);
    });

    // Cerrar al presionar Escape o Tab de forma inmediata, y navegar con ArrowDown/ArrowUp/Enter
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        closeDropdown();
        return;
      }

      if (!dropdown) return;

      const items = dropdown.querySelectorAll('.autocomplete-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        updateActiveSuggestion(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateActiveSuggestion(items);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < items.length) {
          e.preventDefault();
          const activeItem = items[activeIndex];
          nameInput.value = activeItem.getAttribute('data-name');
          phoneInput.value = activeItem.getAttribute('data-phone');
          emailInput.value = activeItem.getAttribute('data-email');
          closeDropdown();
        }
      }
    });

    const updateActiveSuggestion = (items) => {
      items.forEach((item, index) => {
        if (index === activeIndex) {
          item.classList.add('active');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('active');
        }
      });
    };

    // Cerrar si se hace click en otro lugar
    document.addEventListener('click', (e) => {
      if (dropdown && !inputEl.parentNode.contains(e.target)) {
        closeDropdown();
      }
    });
  };

  setupAutocomplete(nameInput);
  setupAutocomplete(phoneInput);

  // Strict Phone validation constraints: only digits, max 10
  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 10) val = val.substring(0, 10);
    e.target.value = val;
  });

  // Inicializar servicios seleccionados en el estado
  let selectedServices = [];
  if (mode === 'edit' && appointmentData) {
    selectedServices = SERVICES.filter(srv => serviceNames.includes(srv.name));
    updateServicesSummary();
  }

  function updateServicesSummary() {
    const count = selectedServices.length;
    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const duration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

    summaryCount.textContent = count;
    summaryTotal.textContent = `$${total.toLocaleString('es-CO')}`;
    summaryDuration.textContent = `${duration} min`;
  }

  // Iniciar animación de apertura
  setTimeout(() => {
    root.classList.add('open');
  }, 10);

  // Cerrar modal
  const closeModal = () => {
    root.classList.remove('open');
    setTimeout(() => {
      root.remove();
    }, 300);
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeModal();
  });

  // Cerrar con Escape
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Helper: Rango ocupado por cita
  function getAppointmentTimeRange(apt) {
    const start = parseTimeString(apt.time);
    let duration = 0;
    if (apt.service) {
      const parts = apt.service.split(' + ').map(s => s.trim());
      parts.forEach(part => {
        duration += SERVICE_DURATIONS[part] || 30;
      });
    } else {
      duration = 30;
    }
    return { start, end: start + duration };
  }

  // Helper: Convertir 'HH:MM:SS' o 'HH:MM' a minutos desde medianoche
  function parseTimeToMinutes(tStr) {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return h * 60 + m;
  }

  // Helper: Comprobar solapamiento
  function checkOverlap(profId, slotStart, duration, dateVal) {
    return appointments.some(apt => {
      // Excluir la cita en edición
      if (mode === 'edit' && appointmentData && apt.id === appointmentData.id) return false;
      if (apt.date !== dateVal) return false;
      if (apt.professional_id !== profId) return false;
      const range = getAppointmentTimeRange(apt);
      return slotStart < range.end && (slotStart + duration) > range.start;
    });
  }

  // Helper: Comprobar disponibilidad completa del profesional (horario, descansos y citas)
  function isProfAvailableForSlot(prof, slotStart, totalDuration, dateVal) {
    const dateObj = new Date(dateVal + 'T00:00:00');
    const dow = dateObj.getDay();

    // 1. Verificar que el profesional trabaja ese día
    const profSched = prof.schedules?.find(s => s.day_of_week === dow);
    if (!profSched || !profSched.is_available) return false;

    // 2. Verificar que el slot cae dentro de su horario
    const profStart = parseTimeToMinutes(profSched.start_time);
    const profEnd = parseTimeToMinutes(profSched.end_time);
    if (slotStart < profStart || slotStart + totalDuration > profEnd) return false;

    // 3. Verificar que no cae en un break
    const breaks = prof.breaks?.filter(b => b.day_of_week === dow) || [];
    const inBreak = breaks.some(b => {
      const bStart = parseTimeToMinutes(b.start_time);
      const bEnd = parseTimeToMinutes(b.end_time);
      return slotStart < bEnd && (slotStart + totalDuration) > bStart;
    });
    if (inBreak) return false;

    // 4. Verificar que no tiene cita en ese horario
    if (checkOverlap(prof.id, slotStart, totalDuration, dateVal)) return false;

    return true;
  }

  // Renderizar chips de hora dinámicamente
  function renderTimeChips() {
    timeChipsContainer.innerHTML = '';
    const dateVal = dateInput.value;
    const profName = profSelect.value;
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0) || 30;

    // Verificar si la fecha seleccionada es un día feriado en el negocio
    const isHoliday = bizHolidays.some(h => h.date === dateVal);
    
    // Verificar si el negocio abre este día de la semana
    const dateObj = new Date(dateVal + 'T00:00:00');
    const dow = dateObj.getDay();
    const bizSched = bizSchedules.find(s => s.day_of_week === dow);
    const isBizClosed = bizSched ? !bizSched.is_open : false;

    const bizStartMin = bizSched ? parseTimeToMinutes(bizSched.start_time) : 8 * 60; // 8:00 AM por defecto
    const bizEndMin = bizSched ? parseTimeToMinutes(bizSched.end_time) : 20 * 60;   // 8:00 PM por defecto

    // Si está en modo "próximo libre" (isNextFreeMode), no filtrar por profesional específico
    let profStartMin = bizStartMin;
    let profEndMin = bizEndMin;
    let profBreaks = [];
    let isProfUnavailable = false;

    if (!isNextFreeMode && profName) {
      const selectedProf = professionals.find(p => p.id === profName);
      if (selectedProf) {
        const profSched = selectedProf.schedules?.find(s => s.day_of_week === dow);
        if (profSched) {
          if (!profSched.is_available) {
            // Profesional no trabaja este día — deshabilitar todos los slots
            profStartMin = 0;
            profEndMin = 0;
            isProfUnavailable = true;
          } else {
            profStartMin = parseTimeToMinutes(profSched.start_time);
            profEndMin = parseTimeToMinutes(profSched.end_time);
          }
        }
        profBreaks = selectedProf.breaks?.filter(b => b.day_of_week === dow) || [];
      }
    }

    // Chip especial "Ahora" si la fecha es hoy
    if (dateVal === todayStr) {
      const nowTimeParts = getColombiaTimeParts();
      let nowMinutes = nowTimeParts.hours * 60 + nowTimeParts.minutes;
      // Redondear hacia arriba al próximo múltiplo de 10 minutos
      nowMinutes = Math.floor(nowMinutes / 10) * 10 + 10;

      const nowSlot = formatTimeString(nowMinutes);
      const slotStart = nowMinutes;
      const isOccupied = isNextFreeMode
        ? !professionals.some(p => isProfAvailableForSlot(p, slotStart, totalDuration, dateVal))
        : checkOverlap(profName, slotStart, totalDuration, dateVal);
      const isPastClose = slotStart + totalDuration > bizEndMin;
      const isBeforeOpen = slotStart < bizStartMin;

      const isBeforeProfOpen = slotStart < profStartMin;
      const isAfterProfClose = slotStart + totalDuration > profEndMin;
      const isInProfBreak = profBreaks.some(b => {
        const breakStart = parseTimeToMinutes(b.start_time);
        const breakEnd = parseTimeToMinutes(b.end_time);
        return slotStart < breakEnd && (slotStart + totalDuration) > breakStart;
      });

      const disabled = isOccupied || isPastClose || isBeforeOpen || isHoliday || isBizClosed
        || isBeforeProfOpen || isAfterProfClose || isInProfBreak;

      if (!disabled) {
        const chip = document.createElement('div');
        chip.className = `time-chip${selectedTimeSlot === nowSlot ? ' selected' : ''}`;
        chip.textContent = `Ahora (${nowSlot})`;
        chip.tabIndex = 0;
        chip.addEventListener('click', () => {
          root.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          selectedTimeSlot = nowSlot;
          updateAvailabilityHint();
        });
        chip.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            chip.click();
          }
        });
        timeChipsContainer.appendChild(chip);
      }
    }

    TIME_SLOTS.forEach(slot => {
      const slotStart = parseTimeString(slot);
      const isOccupied = isNextFreeMode
        ? !professionals.some(p => isProfAvailableForSlot(p, slotStart, totalDuration, dateVal))
        : checkOverlap(profName, slotStart, totalDuration, dateVal);
      const isPastClose = slotStart + totalDuration > bizEndMin; 
      const isBeforeOpen = slotStart < bizStartMin;
      
      const isBeforeProfOpen = slotStart < profStartMin;
      const isAfterProfClose = slotStart + totalDuration > profEndMin;
      const isInProfBreak = profBreaks.some(b => {
        const breakStart = parseTimeToMinutes(b.start_time);
        const breakEnd = parseTimeToMinutes(b.end_time);
        return slotStart < breakEnd && (slotStart + totalDuration) > breakStart;
      });

      // Check if slot is in the past
      let isPastTime = false;
      if (dateVal === todayStr) {
        const nowTimeParts = getColombiaTimeParts();
        const currentMinutes = nowTimeParts.hours * 60 + nowTimeParts.minutes;
        if (slotStart < currentMinutes) {
          isPastTime = true;
        }
      } else if (dateVal < todayStr) {
        isPastTime = true;
      }

      const disabled = isOccupied || isPastClose || isBeforeOpen || isPastTime || isHoliday || isBizClosed
        || isBeforeProfOpen || isAfterProfClose || isInProfBreak;

      const chip = document.createElement('div');
      chip.className = `time-chip${selectedTimeSlot === slot ? ' selected' : ''}${disabled ? ' disabled' : ''}`;
      chip.textContent = slot;

      if (!disabled) {
        chip.tabIndex = 0;
        chip.addEventListener('click', () => {
          root.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          selectedTimeSlot = slot;
          updateAvailabilityHint();
        });
        chip.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            chip.click();
          }
        });
      }

      timeChipsContainer.appendChild(chip);
    });

    // Mostrar aviso si es feriado o está cerrado el negocio
    const hintBox = root.querySelector('#prof-hint-box');
    if (hintBox) {
      if (isHoliday) {
        profHintText.textContent = '⚠️ El negocio se encuentra cerrado este día por feriado / festivo.';
        hintBox.classList.add('warning-hint');
      } else if (isBizClosed) {
        profHintText.textContent = '⚠️ El negocio no abre los días seleccionados en su horario semanal.';
        hintBox.classList.add('warning-hint');
      } else if (isProfUnavailable) {
        const selectedProf = professionals.find(p => p.id === profName);
        profHintText.textContent = `⚠️ ${selectedProf?.name || 'El profesional'} no tiene horario disponible para la fecha seleccionada.`;
        hintBox.classList.add('warning-hint');
      } else {
        hintBox.classList.remove('warning-hint');
      }
    }
  }

  // Actualizar indicador de disponibilidad y profesional libre
  function updateAvailabilityHint() {
    const dateVal = dateInput.value;
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0) || 30;

    if (isNextFreeMode) {
      if (selectedTimeSlot) {
        const slotStart = parseTimeString(selectedTimeSlot);
        let assignedProf = null;
        let bestEndTime = Infinity;

        for (const prof of professionals) {
          const isBusy = !isProfAvailableForSlot(prof, slotStart, totalDuration, dateVal);
          if (!isBusy) {
            assignedProf = prof;
            break;
          } else {
            const freeTime = getEarliestFreeAfter(slotStart, prof.id, dateVal);
            if (freeTime < bestEndTime) {
              bestEndTime = freeTime;
              assignedProf = prof;
            }
          }
        }

        if (assignedProf) {
          profSelect.value = assignedProf.id;
          const isBusy = !isProfAvailableForSlot(assignedProf, slotStart, totalDuration, dateVal);
          if (!isBusy) {
            profHintText.textContent = `✨ ${assignedProf.name} está libre en este horario.`;
          } else {
            profHintText.textContent = `⚠️ Todos ocupados. ${assignedProf.name} se libera antes (a las ${formatTimeString(bestEndTime)}).`;
          }
        } else {
          profHintText.textContent = 'No hay profesionales disponibles.';
        }
      } else {
        profHintText.textContent = 'Auto-asignando el profesional más disponible...';
      }
    } else {
      // Modo manual
      const profId = profSelect.value;
      const prof = professionals.find(p => p.id === profId);
      const profName = prof ? prof.name : '';
      if (selectedTimeSlot && profId) {
        const slotStart = parseTimeString(selectedTimeSlot);
        const isBusy = !isProfAvailableForSlot(prof, slotStart, totalDuration, dateVal);
        if (isBusy) {
          const nextFree = getEarliestFreeAfter(slotStart, profId, dateVal);
          profHintText.textContent = `⚠️ ${profName} está ocupado en ese bloque. Disponible a las ${formatTimeString(nextFree)}.`;
        } else {
          profHintText.textContent = `✨ ${profName} está libre a las ${selectedTimeSlot}.`;
        }
      } else if (profId) {
        const nextFree = getEarliestFreeAfter(8 * 60, profId, dateVal);
        profHintText.textContent = `Próxima disponibilidad de ${profName}: ~${formatTimeString(nextFree)}.`;
      }
    }

    // Dar relevancia visual al banner
    const hintBox = root.querySelector('#prof-hint-box');
    if (hintBox) {
      const text = profHintText.textContent;
      if (text.includes('⚠️')) {
        hintBox.classList.add('warning-hint');
      } else {
        hintBox.classList.remove('warning-hint');
      }
    }
  }

  // Helper para buscar cuándo se libera un profesional
  function getEarliestFreeAfter(startMinutes, profId, dateVal) {
    const profApts = appointments
      .filter(apt => apt.date === dateVal && apt.professional_id === profId)
      .map(getAppointmentTimeRange)
      .sort((a, b) => a.start - b.start);

    let current = startMinutes;
    for (const range of profApts) {
      if (current >= range.start && current < range.end) {
        current = range.end;
      }
    }
    return current;
  }

  // Cambiar de modo de profesional
  nextFreeToggle.addEventListener('click', () => {
    isNextFreeMode = true;
    nextFreeToggle.classList.add('active');
    manualToggle.classList.remove('active');
    profSelect.disabled = true;
    updateAvailabilityHint();
    renderTimeChips();
  });

  manualToggle.addEventListener('click', () => {
    isNextFreeMode = false;
    manualToggle.classList.add('active');
    nextFreeToggle.classList.remove('active');
    profSelect.disabled = false;
    updateAvailabilityHint();
    renderTimeChips();
  });

  profSelect.addEventListener('change', () => {
    updateAvailabilityHint();
    renderTimeChips();
  });

  dateInput.addEventListener('change', () => {
    if (dateInput.value < todayStr) {
      dateInput.value = todayStr;
    }
    selectedTimeSlot = '';
    updateAvailabilityHint();
    renderTimeChips();
  });

  // Manejo de clicks en cards de servicios (multi-select)
  servicesList.addEventListener('click', (e) => {
    const item = e.target.closest('.apt-service-item');
    if (item) {
      const srvIndex = parseInt(item.getAttribute('data-index'), 10);
      const service = SERVICES[srvIndex];

      const isSelected = item.classList.contains('selected');
      if (isSelected) {
        item.classList.remove('selected');
        selectedServices = selectedServices.filter(s => s.name !== service.name);
      } else {
        item.classList.add('selected');
        selectedServices.push(service);
      }

      updateServicesSummary();

      // Si cambia la duración, puede cambiar la disponibilidad de los slots
      renderTimeChips();
      updateAvailabilityHint();
    }
  });

  // Manejo de teclado en cards de servicios (navegabilidad Space/Enter)
  servicesList.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const item = e.target.closest('.apt-service-item');
      if (item) {
        item.click();
      }
    }
  });

  // Ataques rápidos / Shortcuts
  // 1. Botón "Hoy"
  root.querySelector('#btn-quick-today').addEventListener('click', () => {
    dateInput.value = todayStr;
    selectedTimeSlot = '';
    updateAvailabilityHint();
    renderTimeChips();
  });

  // 2. Botón "Ahora mismo"
  root.querySelector('#btn-quick-now').addEventListener('click', () => {
    dateInput.value = todayStr;
    const { hours, minutes } = getColombiaTimeParts();
    let nowMinutes = hours * 60 + minutes;
    // Redondear hacia arriba al próximo múltiplo de 10 minutos
    nowMinutes = Math.floor(nowMinutes / 10) * 10 + 10;
    const slotStr = formatTimeString(nowMinutes);
    selectedTimeSlot = slotStr;

    if (isManualTimeMode) {
      const displayHours = Math.floor(nowMinutes / 60) % 24;
      const displayMins = nowMinutes % 60;
      manualTimeInput.value = `${String(displayHours).padStart(2, '0')}:${String(displayMins).padStart(2, '0')}`;
    }

    // Actualizar ui
    renderTimeChips();
    updateAvailabilityHint();

    // Centrar scroll en el chip seleccionado
    setTimeout(() => {
      const selectedChip = timeChipsContainer.querySelector('.time-chip.selected');
      if (selectedChip) {
        selectedChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 50);
  });

  // Lógica del modo de hora manual
  btnToggleTimepicker.addEventListener('click', () => {
    isManualTimeMode = !isManualTimeMode;
    if (isManualTimeMode) {
      timeChipsContainer.style.display = 'none';
      manualTimeInput.style.display = 'block';
      btnToggleTimepicker.textContent = '📋 Ver disponibilidad';
      if (manualTimeInput.value) {
        manualTimeInput.dispatchEvent(new Event('change'));
      }
    } else {
      timeChipsContainer.style.display = '';
      manualTimeInput.style.display = 'none';
      btnToggleTimepicker.textContent = '🕐 Hora manual';
      selectedTimeSlot = '';
      root.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
      updateAvailabilityHint();
    }
  });

  manualTimeInput.addEventListener('change', () => {
    const val = manualTimeInput.value;
    if (!val) {
      selectedTimeSlot = '';
      updateAvailabilityHint();
      return;
    }
    const [h, m] = val.split(':').map(Number);
    const minutesSinceMidnight = h * 60 + m;
    selectedTimeSlot = formatTimeString(minutesSinceMidnight);
    updateAvailabilityHint();
  });

  // Render inicial de chips de hora
  renderTimeChips();
  updateAvailabilityHint();

  // Si editamos y ya hay un slot cargado, centrarlo
  if (selectedTimeSlot) {
    setTimeout(() => {
      const selectedChip = timeChipsContainer.querySelector('.time-chip.selected');
      if (selectedChip) {
        selectedChip.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      }
    }, 50);
  }

  // Guardar / Confirmar Cita
  saveBtn.addEventListener('click', async () => {
    let hasError = false;

    // Resetear clases de error
    nameInput.classList.remove('form-input-error');
    phoneInput.classList.remove('form-input-error');
    root.querySelector('#apt-services-list').style.borderColor = 'transparent';
    timeChipsContainer.style.outline = 'none';

    // 1. Validar nombre
    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }

    // 2. Validar teléfono
    const phoneVal = phoneInput.value.trim();
    if (!phoneVal || phoneVal.length !== 10 || !phoneVal.startsWith('3')) {
      phoneInput.classList.add('form-input-error');
      hasError = true;
      showToast({
        title: 'Teléfono inválido',
        subtitle: 'El teléfono debe tener exactamente 10 dígitos y empezar con 3.',
        type: 'warning'
      });
    }

    // 3. Validar al menos un servicio seleccionado
    if (selectedServices.length === 0) {
      root.querySelector('#apt-services-list').style.border = '1px solid #ef4444';
      root.querySelector('#apt-services-list').style.borderRadius = 'var(--radius-sm)';
      hasError = true;
    }

    // 4. Validar hora seleccionada
    if (!selectedTimeSlot) {
      timeChipsContainer.style.outline = '2px solid #ef4444';
      timeChipsContainer.style.outlineOffset = '4px';
      timeChipsContainer.style.borderRadius = 'var(--radius-sm)';
      hasError = true;
    }

    // 5. Validar fecha y hora futuras/presentes y horarios del negocio
    const selectedDate = dateInput.value;
    let isPast = false;
    if (selectedDate < todayStr) {
      isPast = true;
    } else if (selectedDate === todayStr && selectedTimeSlot) {
      const nowTimeParts = getColombiaTimeParts();
      const currentMinutes = nowTimeParts.hours * 60 + nowTimeParts.minutes;
      if (parseTimeString(selectedTimeSlot) < currentMinutes) {
        isPast = true;
      }
    }
    if (isPast) {
      showToast({
        title: 'Fecha u hora pasada',
        subtitle: 'No se pueden agendar citas en el pasado.',
        type: 'warning'
      });
      hasError = true;
    }

    const isHoliday = bizHolidays.some(h => h.date === selectedDate);
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dow = dateObj.getDay();
    const bizSched = bizSchedules.find(s => s.day_of_week === dow);
    const isBizClosed = bizSched ? !bizSched.is_open : false;

    if (isHoliday || isBizClosed) {
      showToast({
        title: 'Negocio Cerrado',
        subtitle: 'El negocio se encuentra cerrado el día seleccionado.',
        type: 'warning'
      });
      hasError = true;
    } else if (selectedTimeSlot) {
      const slotStart = parseTimeString(selectedTimeSlot);
      const bizStartMin = bizSched ? parseTimeToMinutes(bizSched.start_time) : 8 * 60;
      const bizEndMin = bizSched ? parseTimeToMinutes(bizSched.end_time) : 20 * 60;
      
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0) || 30;
      if (slotStart < bizStartMin || slotStart + totalDuration > bizEndMin) {
        showToast({
          title: 'Fuera de Horario',
          subtitle: 'La cita está fuera del horario de atención del negocio.',
          type: 'warning'
        });
        hasError = true;
      }
    }

    if (hasError) {
      const firstInputErr = root.querySelector('.form-input-error');
      if (firstInputErr) {
        firstInputErr.focus();
      }
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      const payload = {
        time: selectedTimeSlot,
        client: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        service: selectedServices.map(s => s.name).join(' + '),
        professional_id: profSelect.value,
        status: mode === 'edit' && appointmentData ? appointmentData.status : 'confirmada',
        notes: notesInput.value.trim(),
        date: dateInput.value,
        totalPrice: selectedServices.reduce((sum, s) => sum + s.price, 0)
      };

      if (onSave) {
        if (mode === 'edit') {
          await onSave(payload, appointmentData);
        } else {
          await onSave(payload, selectedServices);
        }
      }

      showToast({
        title: mode === 'edit' ? 'Cita actualizada' : 'Cita agendada',
        subtitle: `${payload.client} · ${payload.time}`,
        type: 'success'
      });

      closeModal();
    } catch (err) {
      showToast({
        title: 'Error al guardar la cita',
        subtitle: err.message,
        type: 'error'
      });
      saveBtn.disabled = false;
      saveBtn.textContent = mode === 'edit' ? 'Guardar Cambios' : 'Confirmar Cita Ahora';
    }
  });
}
