// professional-drawer.js — Componente Drawer para Registro/Edición de Profesionales y sus Horarios
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';

const TIME_OPTIONS = [
  { value: '06:00:00', label: '06:00 AM' },
  { value: '06:30:00', label: '06:30 AM' },
  { value: '07:00:00', label: '07:00 AM' },
  { value: '07:30:00', label: '07:30 AM' },
  { value: '08:00:00', label: '08:00 AM' },
  { value: '08:30:00', label: '08:30 AM' },
  { value: '09:00:00', label: '09:00 AM' },
  { value: '09:30:00', label: '09:30 AM' },
  { value: '10:00:00', label: '10:00 AM' },
  { value: '10:30:00', label: '10:30 AM' },
  { value: '11:00:00', label: '11:00 AM' },
  { value: '11:30:00', label: '11:30 AM' },
  { value: '12:00:00', label: '12:00 PM' },
  { value: '12:30:00', label: '12:30 PM' },
  { value: '13:00:00', label: '01:00 PM' },
  { value: '13:30:00', label: '01:30 PM' },
  { value: '14:00:00', label: '02:00 PM' },
  { value: '14:30:00', label: '02:30 PM' },
  { value: '15:00:00', label: '03:00 PM' },
  { value: '15:30:00', label: '03:30 PM' },
  { value: '16:00:00', label: '04:00 PM' },
  { value: '16:30:00', label: '04:30 PM' },
  { value: '17:00:00', label: '05:00 PM' },
  { value: '17:30:00', label: '05:30 PM' },
  { value: '18:00:00', label: '06:00 PM' },
  { value: '18:30:00', label: '06:30 PM' },
  { value: '19:00:00', label: '07:00 PM' },
  { value: '19:30:00', label: '07:30 PM' },
  { value: '20:00:00', label: '08:00 PM' },
  { value: '20:30:00', label: '08:30 PM' },
  { value: '21:00:00', label: '09:00 PM' },
  { value: '21:30:00', label: '09:30 PM' },
  { value: '22:00:00', label: '10:00 PM' },
  { value: '22:30:00', label: '10:30 PM' },
  { value: '23:00:00', label: '11:00 PM' }
];

const DAYS_OF_WEEK = [
  { id: 0, name: 'Domingo' },
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
  { id: 6, name: 'Sábado' }
];

function generateId() {
  return typeof crypto.randomUUID === 'function' 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 9);
}

// Convert HH:MM:SS to minutes for comparisons
function timeToMinutes(timeStr) {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

export function openProfessionalDrawer({ mode = 'create', professional = null, onSave = null, onDelete = null } = {}) {
  // Evitar duplicados
  const existing = document.getElementById('prof-drawer-root');
  if (existing) {
    existing.remove();
  }

  // Cargar estado inicial
  const nameVal = mode === 'edit' && professional ? professional.name || '' : '';
  const roleVal = mode === 'edit' && professional ? professional.role || '' : '';
  const phoneVal = mode === 'edit' && professional ? professional.phone || '' : '';
  const isActiveVal = mode === 'edit' && professional ? professional.active !== false : true;

  // Cargar o inicializar horarios por defecto
  let scheduleState = {};
  let breaksState = {};

  DAYS_OF_WEEK.forEach(day => {
    // Valores predeterminados: Lunes (1) a Viernes (5) 9am-7pm, Sábado (6) 9am-2pm, Domingo (0) libre.
    let isAvailable = day.id >= 1 && day.id <= 6;
    let start = '09:00:00';
    let end = day.id === 6 ? '14:00:00' : '19:00:00';
    let breaks = [];

    if (mode === 'edit' && professional && professional.schedules) {
      const match = professional.schedules.find(s => s.day_of_week === day.id);
      if (match) {
        isAvailable = !!match.is_available;
        start = match.start_time || start;
        end = match.end_time || end;
      }
    }

    if (mode === 'edit' && professional && professional.breaks) {
      breaks = professional.breaks
        .filter(b => b.day_of_week === day.id)
        .map(b => ({
          id: b.id || generateId(),
          start: b.start_time,
          end: b.end_time,
          label: b.label || 'Descanso'
        }));
    }

    scheduleState[day.id] = { isAvailable, start, end };
    breaksState[day.id] = breaks;
  });

  // Contenedor principal del drawer (overlay)
  const root = document.createElement('div');
  root.id = 'prof-drawer-root';
  root.className = 'prof-drawer-overlay';

  root.innerHTML = `
    <div class="prof-drawer" role="dialog" aria-modal="true">
      <div class="prof-drawer-header">
        <h2>
          <i data-lucide="${mode === 'edit' ? 'user-cog' : 'user-plus'}" style="color: var(--accent-neon);"></i>
          ${mode === 'edit' ? 'Editar Profesional' : 'Registrar Profesional'}
        </h2>
        <button class="prof-drawer-close" id="prof-drawer-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="prof-drawer-body">
        <!-- 👤 DATOS GENERALES -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="info" size="14"></i>
            Datos del Profesional
          </div>
          
          <div style="display: flex; gap: var(--space-4); align-items: center; margin-bottom: var(--space-2);">
            <div style="
              width: 56px; 
              height: 56px; 
              border-radius: 50%; 
              background: rgba(139, 92, 255, 0.12); 
              display: flex; 
              align-items: center; 
              justify-content: center;
              color: var(--accent-neon);
              font-weight: 700;
              font-size: var(--text-lg);
              flex-shrink: 0;
              border: 1px solid rgba(139, 92, 255, 0.25);
            " id="prof-avatar-preview">
              ${nameVal ? nameVal.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
            </div>
            <div style="flex-grow: 1;">
              <h4 style="font-size: var(--text-sm); font-weight: 700; margin: 0;" id="prof-header-name">${nameVal || 'Nuevo Profesional'}</h4>
              <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;" id="prof-header-role">${roleVal || 'Rol no especificado'}</p>
            </div>
          </div>

          <div class="form-group">
            <label for="prof-name">Nombre completo *</label>
            <input type="text" id="prof-name" class="form-input" placeholder="Ej. Juan Pérez" value="${nameVal}" required autocomplete="off" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label for="prof-role">Cargo / Especialidad *</label>
              <input type="text" id="prof-role" class="form-input" placeholder="Ej. Barbero Senior" value="${roleVal}" required autocomplete="off" />
            </div>
            <div class="form-group">
              <label for="prof-phone">Teléfono de contacto *</label>
              <input type="tel" id="prof-phone" class="form-input" placeholder="Ej. 3001234567" value="${phoneVal}" required autocomplete="off" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-1); margin-top: var(--space-2);">
            <label class="schedule-day-toggle">
              <input type="checkbox" id="prof-status" ${isActiveVal ? 'checked' : ''} />
              <div class="schedule-day-toggle-custom"></div>
              <span style="font-size: var(--text-sm); font-weight: 700;">Profesional Activo</span>
            </label>
            <span style="font-size: var(--text-xs); color: var(--text-muted); margin-left: 44px;">
              (Los profesionales inactivos no reciben nuevas citas en la agenda)
            </span>
          </div>
        </div>

        <!-- 📅 HORARIOS DE ATENCIÓN -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="calendar-clock" size="14"></i>
            Horario Semanal y Descansos
          </div>
          
          <div class="schedule-week-grid" id="schedule-grid-container">
            <!-- Renderizado dinámico de los 7 días -->
          </div>
        </div>

        ${mode === 'edit' ? `
          <!-- ⚠️ ZONA DE PELIGRO -->
          <div class="apt-modal-section" style="margin-top: var(--space-6); border-top: 1px solid var(--border-soft); padding-top: var(--space-6);">
            <div class="apt-modal-section-title" style="color: #ef4444; margin-bottom: var(--space-3); font-weight: 700; font-size: var(--text-sm);">
              <i data-lucide="shield-alert" size="14"></i>
              Zona de Peligro
            </div>
            
            <div style="
              border: 1px solid rgba(239, 68, 68, 0.2); 
              background: rgba(239, 68, 68, 0.02); 
              border-radius: var(--radius-sm); 
              padding: var(--space-4);
            ">
              <h4 style="color: #ef4444; font-size: var(--text-sm); font-weight: 700; margin-top: 0; margin-bottom: var(--space-2); display: flex; align-items: center; gap: var(--space-2);">
                <i data-lucide="user-x" size="16"></i>
                Eliminar Profesional permanentemente
              </h4>
              <p style="font-size: var(--text-xs); color: var(--text-muted); line-height: 1.4; margin-bottom: var(--space-4);">
                Se borrarán todos los datos del profesional en este sistema. Esta acción no se puede deshacer.
              </p>
              
              <button 
                type="button" 
                class="btn btn-danger" 
                id="prof-delete-btn" 
                style="width: 100%; height: 36px; font-size: var(--text-xs); font-weight: 700;"
              >
                Eliminar Profesional
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="prof-drawer-footer">
        <button class="btn btn-secondary" id="prof-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="prof-save-btn">
          ${mode === 'edit' ? 'Guardar Cambios' : 'Registrar Profesional'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Inicializar Iconos Lucide
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

  // Referencias a elementos
  const closeBtn = root.querySelector('#prof-drawer-close-btn');
  const cancelBtn = root.querySelector('#prof-cancel-btn');
  const saveBtn = root.querySelector('#prof-save-btn');
  const nameInput = root.querySelector('#prof-name');
  const roleInput = root.querySelector('#prof-role');
  const phoneInput = root.querySelector('#prof-phone');

  // Strict Phone validation constraints: only digits, max 10
  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 10) val = val.substring(0, 10);
    e.target.value = val;
  });
  const statusInput = root.querySelector('#prof-status');
  const headerName = root.querySelector('#prof-header-name');
  const headerRole = root.querySelector('#prof-header-role');
  const avatarPreview = root.querySelector('#prof-avatar-preview');
  const gridContainer = root.querySelector('#schedule-grid-container');

  // Reactividad básica para el header
  nameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    headerName.textContent = val || 'Nuevo Profesional';
    // Actualizar iniciales avatar
    if (val) {
      avatarPreview.textContent = val.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    } else {
      avatarPreview.textContent = '?';
    }
  });

  roleInput.addEventListener('input', (e) => {
    headerRole.textContent = e.target.value.trim() || 'Rol no especificado';
  });

  // Renderizar la grilla de horarios
  function renderScheduleGrid() {
    gridContainer.innerHTML = '';

    DAYS_OF_WEEK.forEach(day => {
      const state = scheduleState[day.id];
      const dayBreaks = breaksState[day.id];
      
      const dayRow = document.createElement('div');
      dayRow.className = `schedule-day-row${!state.isAvailable ? ' inactive' : ''}`;
      dayRow.dataset.dayId = day.id;

      dayRow.innerHTML = `
        <div class="schedule-day-header">
          <div class="schedule-day-left">
            <label class="schedule-day-toggle">
              <input type="checkbox" class="day-active-checkbox" data-day-id="${day.id}" ${state.isAvailable ? 'checked' : ''} />
              <div class="schedule-day-toggle-custom"></div>
              <span>${day.name}</span>
            </label>
            <span class="schedule-day-status">${state.isAvailable ? 'Atiende' : 'Libre'}</span>
          </div>

          <div class="schedule-day-controls" style="display: ${state.isAvailable ? 'flex' : 'none'};">
            <select class="schedule-time-select start-time-select" data-day-id="${day.id}">
              ${TIME_OPTIONS.map(opt => `<option value="${opt.value}" ${state.start === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
            <span class="schedule-time-separator">a</span>
            <select class="schedule-time-select end-time-select" data-day-id="${day.id}">
              ${TIME_OPTIONS.map(opt => `<option value="${opt.value}" ${state.end === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
            <button type="button" class="break-add-btn btn-add-break" data-day-id="${day.id}">
              <i data-lucide="coffee"></i> + Descanso
            </button>
          </div>
        </div>

        ${state.isAvailable ? `
          <!-- Listado de descansos -->
          <div class="schedule-day-breaks" id="breaks-container-${day.id}" style="display: ${dayBreaks.length > 0 ? 'flex' : 'none'};">
            ${dayBreaks.map(brk => `
              <div class="break-item" data-break-id="${brk.id}">
                <div class="break-info">
                  <span class="break-label">${brk.label}</span>
                  <span class="break-times">${formatTimeVal(brk.start)} - ${formatTimeVal(brk.end)}</span>
                </div>
                <button type="button" class="break-delete-btn btn-delete-break" data-day-id="${day.id}" data-break-id="${brk.id}">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            `).join('')}
          </div>

          <!-- Formulario inline para agregar descanso -->
          <div class="break-form-popover" id="break-form-${day.id}" style="display: none;">
            <input type="text" placeholder="Ej. Almuerzo" class="break-form-input break-input-label" style="flex: 1; min-width: 100px;" />
            <select class="schedule-time-select break-input-start">
              ${TIME_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === '12:00:00' ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
            <span class="schedule-time-separator">a</span>
            <select class="schedule-time-select break-input-end">
              ${TIME_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === '13:00:00' ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-primary btn-save-break" data-day-id="${day.id}" style="padding: var(--space-1) var(--space-3); height: 32px; font-size: var(--text-xs);">
              Agregar
            </button>
            <button type="button" class="btn btn-secondary btn-cancel-break" data-day-id="${day.id}" style="padding: var(--space-1) var(--space-3); height: 32px; font-size: var(--text-xs);">
              Cancelar
            </button>
          </div>
        ` : ''}
      `;

      gridContainer.appendChild(dayRow);
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({
        attrs: { 'stroke-width': 2.5, 'size': 14 },
        nameAttr: 'data-lucide',
        node: gridContainer
      });
    }

    // Vincular Eventos en la Grilla
    // 1. Toggle Disponibilidad Día
    gridContainer.querySelectorAll('.day-active-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        scheduleState[dayId].isAvailable = e.target.checked;
        renderScheduleGrid();
      });
    });

    // 2. Selectores de hora del horario principal
    gridContainer.querySelectorAll('.start-time-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        scheduleState[dayId].start = e.target.value;
      });
    });

    gridContainer.querySelectorAll('.end-time-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        scheduleState[dayId].end = e.target.value;
      });
    });

    // 3. Agregar break popover toggling
    gridContainer.querySelectorAll('.btn-add-break').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const btnEl = e.target.closest('.btn-add-break');
        const dayId = parseInt(btnEl.dataset.dayId, 10);
        const form = gridContainer.querySelector(`#break-form-${dayId}`);
        if (form) {
          form.style.display = form.style.display === 'none' ? 'flex' : 'none';
          // Pre-configurar horas basados en el horario de atención del día
          const dayStart = scheduleState[dayId].start;
          const dayEnd = scheduleState[dayId].end;
          form.querySelector('.break-input-start').value = dayStart;
          form.querySelector('.break-input-end').value = dayEnd;
          form.querySelector('.break-input-label').focus();
        }
      });
    });

    // 4. Cancelar Break Form
    gridContainer.querySelectorAll('.btn-cancel-break').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        const form = gridContainer.querySelector(`#break-form-${dayId}`);
        if (form) form.style.display = 'none';
      });
    });

    // 5. Guardar Break
    gridContainer.querySelectorAll('.btn-save-break').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        const form = gridContainer.querySelector(`#break-form-${dayId}`);
        if (!form) return;

        const label = form.querySelector('.break-input-label').value.trim() || 'Descanso';
        const start = form.querySelector('.break-input-start').value;
        const end = form.querySelector('.break-input-end').value;

        // Validaciones del Break
        const startMin = timeToMinutes(start);
        const endMin = timeToMinutes(end);
        const dayStartMin = timeToMinutes(scheduleState[dayId].start);
        const dayEndMin = timeToMinutes(scheduleState[dayId].end);

        if (startMin >= endMin) {
          showToast({ title: 'Rango de descanso inválido', subtitle: 'La hora de inicio debe ser menor a la de fin.', type: 'error' });
          return;
        }

        if (startMin < dayStartMin || endMin > dayEndMin) {
          showToast({ title: 'Rango fuera de horario', subtitle: `El descanso debe estar dentro de la jornada de atención (${formatTimeVal(scheduleState[dayId].start)} a ${formatTimeVal(scheduleState[dayId].end)}).`, type: 'error' });
          return;
        }

        // Agregar al estado
        breaksState[dayId].push({
          id: generateId(),
          start,
          end,
          label
        });

        renderScheduleGrid();
      });
    });

    // 6. Eliminar Break
    gridContainer.querySelectorAll('.btn-delete-break').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const btnEl = e.target.closest('.btn-delete-break');
        const dayId = parseInt(btnEl.dataset.dayId, 10);
        const breakId = btnEl.dataset.breakId;

        breaksState[dayId] = breaksState[dayId].filter(b => b.id !== breakId);
        renderScheduleGrid();
      });
    });
  }

  // Formato legible para visualización
  function formatTimeVal(timeStr) {
    const matched = TIME_OPTIONS.find(opt => opt.value === timeStr);
    return matched ? matched.label : timeStr.substring(0, 5);
  }

  // Render inicial de la grilla
  renderScheduleGrid();

  // Animación de apertura (slide-in)
  setTimeout(() => {
    root.classList.add('open');
  }, 10);

  // Cerrar Drawer
  const closeDrawer = () => {
    root.classList.remove('open');
    setTimeout(() => {
      root.remove();
    }, 350);
  };

  closeBtn.addEventListener('click', closeDrawer);
  cancelBtn.addEventListener('click', closeDrawer);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeDrawer();
  });

  // Cerrar con Escape
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Eliminar Profesional
  if (mode === 'edit') {
    const deleteBtn = root.querySelector('#prof-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        showConfirm({
          title: '¿Eliminar profesional permanentemente?',
          message: `Estás a punto de eliminar a "${nameVal}". Esta acción no se puede deshacer y borrará al profesional de la base de datos de tu agenda.`,
          confirmLabel: 'Sí, eliminar profesional',
          cancelLabel: 'Cancelar',
          confirmVariant: 'danger',
          onConfirm: () => {
            if (onDelete) {
              onDelete(professional.id);
            }
            showToast({
              title: 'Profesional eliminado',
              subtitle: `${nameVal} ha sido eliminado.`,
              type: 'success'
            });
            closeDrawer();
          }
        });
      });
    }
  }

  // Guardar Profesional Completo
  saveBtn.addEventListener('click', () => {
    // Validar Datos Básicos
    nameInput.classList.remove('form-input-error');
    roleInput.classList.remove('form-input-error');
    phoneInput.classList.remove('form-input-error');

    let hasError = false;

    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }
    if (!roleInput.value.trim()) {
      roleInput.classList.add('form-input-error');
      hasError = true;
    }
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

    if (hasError) {
      const firstErr = root.querySelector('.form-input-error');
      if (firstErr) firstErr.focus();
      return;
    }

    // Validar Rango de Horarios para los Días Activos
    let scheduleValidationPassed = true;
    DAYS_OF_WEEK.forEach(day => {
      const state = scheduleState[day.id];
      if (state.isAvailable) {
        const startMin = timeToMinutes(state.start);
        const endMin = timeToMinutes(state.end);
        if (startMin >= endMin) {
          showToast({
            title: `Error en ${day.name}`,
            subtitle: 'La hora de inicio de jornada debe ser menor a la hora de fin.',
            type: 'error'
          });
          const row = gridContainer.querySelector(`.schedule-day-row[data-day-id="${day.id}"]`);
          if (row) {
            row.style.borderColor = '#ef4444';
            setTimeout(() => row.style.borderColor = 'var(--border-soft)', 3000);
          }
          scheduleValidationPassed = false;
        }
      }
    });

    if (!scheduleValidationPassed) return;

    // Deshabilitar botón
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    // Generar Payload para guardar
    const payloadSchedules = [];
    const payloadBreaks = [];

    DAYS_OF_WEEK.forEach(day => {
      const state = scheduleState[day.id];
      const dayBreaks = breaksState[day.id];

      // Formatear schedule
      payloadSchedules.push({
        day_of_week: day.id,
        start_time: state.start,
        end_time: state.end,
        is_available: state.isAvailable
      });

      // Formatear breaks (solo si el día atiende)
      if (state.isAvailable) {
        dayBreaks.forEach(b => {
          payloadBreaks.push({
            day_of_week: day.id,
            start_time: b.start,
            end_time: b.end,
            label: b.label
          });
        });
      }
    });

    const result = {
      id: mode === 'edit' && professional ? professional.id : 'prof-' + Date.now(),
      name: nameInput.value.trim(),
      role: roleInput.value.trim(),
      phone: phoneInput.value.trim(),
      active: statusInput.checked,
      schedules: payloadSchedules,
      breaks: payloadBreaks
    };

    // Simular guardado local/remoto
    setTimeout(() => {
      if (onSave) {
        onSave(result);
      }

      showToast({
        title: mode === 'edit' ? 'Profesional actualizado' : 'Profesional registrado',
        subtitle: `${result.name} · ${result.role}`,
        type: 'success'
      });

      closeDrawer();
    }, 600);
  });
}
