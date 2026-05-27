// appointment-modal.js — Componente Modal de Nueva/Editar Cita para Recepcionistas
import { showToast } from '../utils/toast.js';
import { getColombiaTodayStr, getColombiaTimeParts } from '../utils/format.js';
import { searchClientsByName, getActiveBusinessId, getServices } from '../utils/businessState.js';

const TIME_SLOTS = [
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM'
];

function parseTimeString(timeStr) {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatTimeString(minutesSinceMidnight) {
  let hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function openAppointmentModal({ appointments = [], onSave = null, mode = 'create', appointmentData = null } = {}) {
  const bizId = getActiveBusinessId();
  const SERVICES = getServices(bizId).filter(s => s.active !== false);
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
            <i data-lucide="scissors" size="14"></i>
            Catálogo de Servicios
          </div>
          <div class="apt-services-grid" id="apt-services-list">
            ${SERVICES.map((srv, index) => {
              const isSelected = serviceNames.includes(srv.name);
              return `
                <div class="apt-service-item${isSelected ? ' selected' : ''}" data-index="${index}" data-name="${srv.name}" data-price="${srv.price}" data-duration="${srv.duration}">
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
              <option value="Juan Pérez"${mode === 'edit' && appointmentData && appointmentData.prof === 'Juan Pérez' ? ' selected' : ''}>Juan Pérez</option>
              <option value="Carlos Gómez"${mode === 'edit' && appointmentData && appointmentData.prof === 'Carlos Gómez' ? ' selected' : ''}>Carlos Gómez</option>
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
            <input type="date" id="apt-date" class="form-input" value="${dateVal}" />
          </div>

          <div class="form-group">
            <label style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); display: block;">
              Horarios Disponibles (bloques de 30 min)
            </label>
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
  const notesInput = root.querySelector('#apt-notes');
  const servicesList = root.querySelector('#apt-services-list');
  const summaryCount = root.querySelector('#summary-count');
  const summaryTotal = root.querySelector('#summary-total');
  const summaryDuration = root.querySelector('#summary-duration');

  // Configuración de autocompletado para Clientes
  const setupAutocomplete = (inputEl) => {
    let dropdown = null;

    const closeDropdown = () => {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
      }
    };

    inputEl.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      closeDropdown();
      if (!query || query.length < 2) return;

      const bizId = getActiveBusinessId();
      const matches = searchClientsByName(query, bizId);
      if (matches.length === 0) return;

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
          
          // Disparar evento input
          nameInput.dispatchEvent(new Event('input'));
          phoneInput.dispatchEvent(new Event('input'));
          emailInput.dispatchEvent(new Event('input'));

          closeDropdown();
        });
      });
    });

    // Cerrar si se hace click en otro lugar
    document.addEventListener('click', (e) => {
      if (dropdown && !inputEl.parentNode.contains(e.target)) {
        closeDropdown();
      }
    });
  };

  setupAutocomplete(nameInput);
  setupAutocomplete(phoneInput);

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

  // Helper: Comprobar solapamiento
  function checkOverlap(profName, slotStart, duration, dateVal) {
    // Si la fecha coincide con la del listado o es hoy
    return appointments.some(apt => {
      // Excluir la cita en edición de su propia comprobación de solapamiento
      if (mode === 'edit' && appointmentData && apt === appointmentData) return false;
      if (apt.date !== dateVal) return false;
      if (apt.prof !== profName) return false;
      const range = getAppointmentTimeRange(apt);
      return slotStart < range.end && (slotStart + duration) > range.start;
    });
  }

  // Renderizar chips de hora dinámicamente
  function renderTimeChips() {
    timeChipsContainer.innerHTML = '';
    const dateVal = dateInput.value;
    const profName = profSelect.value;
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0) || 30;

    TIME_SLOTS.forEach(slot => {
      const slotStart = parseTimeString(slot);
      const isOccupied = !isNextFreeMode && checkOverlap(profName, slotStart, totalDuration, dateVal);
      const isPastClose = slotStart + totalDuration > 20 * 60; // posterior a las 8:00 PM
      const disabled = isOccupied || isPastClose;

      const chip = document.createElement('div');
      chip.className = `time-chip${selectedTimeSlot === slot ? ' selected' : ''}${disabled ? ' disabled' : ''}`;
      chip.textContent = slot;

      if (!disabled) {
        chip.addEventListener('click', () => {
          root.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          selectedTimeSlot = slot;
          updateAvailabilityHint();
        });
      }

      timeChipsContainer.appendChild(chip);
    });
  }

  // Actualizar indicador de disponibilidad y profesional libre
  function updateAvailabilityHint() {
    const dateVal = dateInput.value;
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0) || 30;

    if (isNextFreeMode) {
      if (selectedTimeSlot) {
        const slotStart = parseTimeString(selectedTimeSlot);
        const juanBusy = checkOverlap('Juan Pérez', slotStart, totalDuration, dateVal);
        const carlosBusy = checkOverlap('Carlos Gómez', slotStart, totalDuration, dateVal);

        if (!juanBusy) {
          profSelect.value = 'Juan Pérez';
          profHintText.textContent = '✨ Juan Pérez está libre en este horario.';
        } else if (!carlosBusy) {
          profSelect.value = 'Carlos Gómez';
          profHintText.textContent = '✨ Carlos Gómez está libre en este horario.';
        } else {
          // Ambos ocupados: ver quién se libera antes
          const juanEnd = getEarliestFreeAfter(slotStart, 'Juan Pérez', dateVal);
          const carlosEnd = getEarliestFreeAfter(slotStart, 'Carlos Gómez', dateVal);
          
          if (juanEnd <= carlosEnd) {
            profSelect.value = 'Juan Pérez';
            profHintText.textContent = `⚠️ Ambos ocupados. Juan Pérez se libera antes (a las ${formatTimeString(juanEnd)}).`;
          } else {
            profSelect.value = 'Carlos Gómez';
            profHintText.textContent = `⚠️ Ambos ocupados. Carlos Gómez se libera antes (a las ${formatTimeString(carlosEnd)}).`;
          }
        }
      } else {
        profHintText.textContent = 'Auto-asignando el profesional más disponible...';
      }
    } else {
      // Modo manual
      const profName = profSelect.value;
      if (selectedTimeSlot) {
        const slotStart = parseTimeString(selectedTimeSlot);
        const isBusy = checkOverlap(profName, slotStart, totalDuration, dateVal);
        if (isBusy) {
          const nextFree = getEarliestFreeAfter(slotStart, profName, dateVal);
          profHintText.textContent = `⚠️ ${profName} está ocupado en ese bloque. Disponible a las ${formatTimeString(nextFree)}.`;
        } else {
          profHintText.textContent = `✨ ${profName} está libre a las ${selectedTimeSlot}.`;
        }
      } else {
        // Encontrar próxima disponibilidad general
        const nextFree = getEarliestFreeAfter(8 * 60, profName, dateVal);
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
  function getEarliestFreeAfter(startMinutes, profName, dateVal) {
    // Ordenar citas de hoy del profesional
    const profApts = appointments
      .filter(apt => apt.date === dateVal && apt.prof === profName)
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

    // Redondear al chip más cercano (bloques de 30)
    if (minutes < 15) {
      minutes = 0;
    } else if (minutes < 45) {
      minutes = 30;
    } else {
      minutes = 0;
      hours += 1;
    }

    // Limitar entre 8 AM y 8 PM
    if (hours < 8) {
      hours = 8;
      minutes = 0;
    } else if (hours >= 20 && minutes > 0) {
      hours = 20;
      minutes = 0;
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    let displayHour = hours;
    if (hours > 12) displayHour -= 12;
    if (hours === 0) displayHour = 12;

    const slotStr = `${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
    selectedTimeSlot = slotStr;

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
  saveBtn.addEventListener('click', () => {
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
    if (!phoneInput.value.trim()) {
      phoneInput.classList.add('form-input-error');
      hasError = true;
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

    if (hasError) {
      // Focus en el primer error
      const firstInputErr = root.querySelector('.form-input-error');
      if (firstInputErr) {
        firstInputErr.focus();
      }
      return;
    }

    // Deshabilitar botón para estado de guardado
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    // Simular retraso de guardado
    setTimeout(() => {
      const payload = {
        time: selectedTimeSlot,
        client: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        service: selectedServices.map(s => s.name).join(' + '),
        prof: profSelect.value,
        status: mode === 'edit' && appointmentData ? appointmentData.status : 'confirmada',
        notes: notesInput.value.trim(),
        date: dateInput.value,
        totalPrice: selectedServices.reduce((sum, s) => sum + s.price, 0)
      };

      if (onSave) {
        if (mode === 'edit') {
          onSave(payload, appointmentData);
        } else {
          onSave(payload);
        }
      }

      // Mostrar Toast interactivo global
      showToast({
        title: mode === 'edit' ? 'Cita actualizada' : 'Cita agendada',
        subtitle: `${payload.client} · ${payload.time} con ${payload.prof}`,
        type: 'success'
      });

      closeModal();
    }, 800);
  });
}
