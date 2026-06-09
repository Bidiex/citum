import { 
  addBusiness, 
  updateBusiness, 
  deleteBusiness,
  getBusinessSchedules,
  updateBusinessSchedules,
  getBusinessHolidays
} from '../utils/businessState.js';
import { showConfirm } from '../utils/confirm.js';
import { showToast } from '../utils/toast.js';
import { supabase } from '../core/supabase.js';

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

const PALETTE_COLORS = [
  // Rojos
  '#FF6B6B', '#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D',
  // Naranjas
  '#FF8C42', '#F97316', '#EA580C', '#C2410C', '#9A3412', '#7C2D12',
  // Amarillos / Lima
  '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#A3E635', '#84CC16',
  // Verdes
  '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534', '#14532D',
  // Teals / Cyan
  '#22D3EE', '#06B6D4', '#0891B2', '#0E7490', '#155E75', '#134E4A',
  // Azules
  '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A',
  // Violetas / Morados
  '#C084FC', '#A855F7', '#9333EA', '#7C3AED', '#6D28D9', '#4C1D95',
  // Rosas / Magentas
  '#F472B6', '#EC4899', '#DB2777', '#BE185D', '#9D174D', '#831843',
  // Neutros / Grises / Negro
  '#000000', '#1F2937', '#4B5563', '#9CA3AF'
];

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Reemplazar espacios por -
    .replace(/[^\w\-]+/g, '')       // Remover caracteres no alfanuméricos
    .replace(/\-\-+/g, '-');        // Reemplazar múltiples - por uno solo
}

export function openBusinessModal({ mode = 'create', businessData = null, onSave = null } = {}) {
  // Asegurar que no haya otro overlay abierto
  const existing = document.getElementById('biz-drawer-root');
  if (existing) {
    existing.remove();
  }

  // Valores iniciales
  const name = businessData?.name || '';
  const slug = businessData?.slug || '';
  const phone = businessData?.phone || '';
  const address = businessData?.address || '';
  const selectedColor = businessData?.color || '#8B5CF6'; // Violeta por defecto
  let logoBase64 = businessData?.logo || '';
  const business = businessData || {};

  // Crear contenedor principal
  const root = document.createElement('div');
  root.id = 'biz-drawer-root';
  root.className = 'biz-drawer-overlay';
  
  // Renderizar estructura base
  root.innerHTML = `
    <div class="biz-drawer" role="dialog" aria-modal="true">
      <div class="biz-drawer-header">
        <h2>${mode === 'create' ? 'Agregar Negocio' : 'Editar Ajustes'}</h2>
        <button class="biz-drawer-close" id="biz-drawer-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="biz-drawer-body">
        ${mode === 'edit' ? `
          <div class="biz-drawer-tabs" style="display: flex; gap: var(--space-4); border-bottom: 1px solid var(--border-soft); margin-bottom: var(--space-6); padding-bottom: 6px;">
            <button type="button" class="biz-tab-btn active" data-tab="general" style="padding: var(--space-2) var(--space-4); background: none; border: none; border-bottom: 2px solid var(--accent-purple); color: var(--text-primary); font-weight: 700; cursor: pointer; transition: all var(--transition-base);">General</button>
            <button type="button" class="biz-tab-btn" data-tab="schedule" style="padding: var(--space-2) var(--space-4); background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 700; cursor: pointer; transition: all var(--transition-base);">Horario Semanal</button>
            <button type="button" class="biz-tab-btn" data-tab="holidays" style="padding: var(--space-2) var(--space-4); background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 700; cursor: pointer; transition: all var(--transition-base);">Días Feriados</button>
          </div>
        ` : ''}

        <div class="biz-tab-content active" id="biz-tab-content-general">
        <!-- Campo Nombre -->
        <div class="form-group">
          <label for="biz-name">Nombre del negocio *${mode === 'edit' ? '<span class="badge-no-edit">No editable</span>' : ''}</label>
          <input 
            type="text" 
            id="biz-name" 
            class="form-input" 
            placeholder="Ej. Consultorio Sonrisas" 
            value="${name}"
            ${mode === 'edit' ? 'readonly' : ''}
            required
          />
          ${mode === 'create' ? `
            <div class="slug-preview" id="biz-slug-container">
              Enlace público: <strong>/b/<span id="biz-slug-text">...</span></strong>
            </div>
          ` : `
            <div class="slug-preview">
              Enlace público inalterable: <strong>/b/${slug}</strong>
            </div>
          `}
        </div>

        <!-- Campo Contacto -->
        <div class="form-group">
          <label for="biz-phone">Teléfono / Contacto *</label>
          <input 
            type="tel" 
            id="biz-phone" 
            class="form-input" 
            placeholder="Ej. 3001234567" 
            value="${phone}"
            required
          />
        </div>

        <!-- Campo Dirección -->
        <div class="form-group">
          <label for="biz-address">Dirección (opcional)</label>
          <input 
            type="text" 
            id="biz-address" 
            class="form-input" 
            placeholder="Ej. Calle 72 #10-15, Bogotá" 
            value="${address}"
          />
        </div>

        <!-- Imagen / Logo -->
        <div class="form-group">
          <label>Imagen / Logo del negocio (opcional)</label>
          <div class="logo-upload-container">
            <div class="logo-preview-box" id="logo-preview">
              ${logoBase64 ? `<img src="${logoBase64}" alt="Logo preview" />` : (name ? name.charAt(0).toUpperCase() : 'B')}
            </div>
            <div class="logo-upload-actions">
              <label class="logo-upload-btn">
                <i data-lucide="upload-cloud" size="14"></i>
                Subir Imagen
                <input type="file" id="logo-file-input" accept="image/*" style="display: none;" />
              </label>
              <span class="logo-upload-hint">Formatos PNG, JPG. Máx 2MB</span>
            </div>
          </div>
        </div>

        <!-- Color del Negocio -->
        <div class="form-group colors-grid-container">
          <label>Color del negocio (Tema de reservas)</label>
          <div class="colors-grid" id="colors-grid">
            ${PALETTE_COLORS.map(color => `
              <div 
                class="color-option-dot ${color.toLowerCase() === selectedColor.toLowerCase() ? 'selected' : ''}" 
                data-color="${color}" 
                style="background-color: ${color};"
                title="${color}"
              ></div>
            `).join('')}
          </div>
        </div>

        ${mode === 'edit' ? `
          <!-- ⚠️ ESTADO Y ACCIONES AVANZADAS -->
          <div class="apt-modal-section" style="margin-top: var(--space-6); border-top: 1px solid var(--border-soft); padding-top: var(--space-6);">
            <div class="apt-modal-section-title" style="color: var(--accent-purple); margin-bottom: var(--space-3); font-weight: 700; font-size: var(--text-sm);">
              <i data-lucide="shield-alert" size="14"></i>
              Ajustes Avanzados
            </div>

            <!-- Toggle de Pausa -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-6);">
              <label class="schedule-day-toggle">
                <input type="checkbox" id="biz-status-toggle" ${businessData?.paused ? 'checked' : ''} />
                <div class="schedule-day-toggle-custom"></div>
                <span style="font-size: var(--text-sm); font-weight: 700;">Pausar negocio (Temporalmente)</span>
              </label>
              <span style="font-size: var(--text-xs); color: var(--text-muted); margin-left: 44px;">
                (Cuando un negocio está en pausa, los clientes no pueden agendar citas ni ver la página pública de reservas)
              </span>
            </div>

            <!-- Anticipación Alerta -->
            <div class="form-group" style="margin-top: var(--space-4); margin-bottom: var(--space-6);">
              <label class="form-label" for="biz-alert-minutes">
                <i data-lucide="bell" style="width: 14px; height: 14px; margin-right: 4px;"></i>
                Anticipación para alerta de confirmación
              </label>
              <div style="display: flex; align-items: center; gap: var(--space-3);">
                <input
                  type="number"
                  id="biz-alert-minutes"
                  class="form-input"
                  min="5"
                  max="120"
                  step="5"
                  value="${business.alert_minutes_before ?? 15}"
                  style="width: 100px;"
                />
                <span style="font-size: var(--text-sm); color: var(--text-muted);">
                  minutos antes de la cita
                </span>
              </div>
              <span style="font-size: 11px; color: var(--text-muted); margin-top: var(--space-1); display: block;">
                El sistema alertará para confirmar citas faltando este tiempo para su inicio.
              </span>
            </div>

            <!-- Sección de Eliminación -->
            <div style="
              border: 1px solid rgba(239, 68, 68, 0.2); 
              background: rgba(239, 68, 68, 0.02); 
              border-radius: var(--radius-sm); 
              padding: var(--space-4);
            ">
              <h4 style="color: #ef4444; font-size: var(--text-sm); font-weight: 700; margin-top: 0; margin-bottom: var(--space-2); display: flex; align-items: center; gap: var(--space-2);">
                <i data-lucide="trash-2" size="16"></i>
                Eliminar Negocio permanentemente
              </h4>
              <p style="font-size: var(--text-xs); color: var(--text-muted); line-height: 1.4; margin-bottom: var(--space-4);">
                Esta acción es <strong>completamente irreversible</strong>. Se eliminarán todos los registros asociados: profesionales, servicios, citas e historial de este negocio.
              </p>
              
              <div class="form-group" style="margin-bottom: var(--space-3);">
                <label for="biz-delete-confirm-input" style="font-size: var(--text-xs); color: var(--text-secondary);">
                  Escribe el nombre del negocio <strong>"${name}"</strong> para confirmar:
                </label>
                <input 
                  type="text" 
                  id="biz-delete-confirm-input" 
                  class="form-input" 
                  placeholder="Ej. ${name}" 
                  style="border-color: var(--border-soft); height: 36px; font-size: var(--text-xs);"
                  autocomplete="off"
                />
              </div>

              <button 
                type="button" 
                class="btn btn-danger" 
                id="biz-delete-btn" 
                style="width: 100%; height: 36px; font-size: var(--text-xs); font-weight: 700; opacity: 0.5; pointer-events: none;"
              >
                Eliminar Negocio
              </button>
            </div>
          </div>
        ` : ''}
        </div> <!-- Fin Tab General -->

        ${mode === 'edit' ? `
          <!-- Pestaña 2: Horarios de Atención -->
          <div class="biz-tab-content" id="biz-tab-content-schedule" style="display: none;">
            <div class="apt-modal-section-title" style="margin-bottom: var(--space-4); font-weight: 700; font-size: var(--text-sm); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="calendar-clock" size="14"></i>
              Horario Semanal de Atención
            </div>
            
            <div class="schedule-week-grid" id="biz-schedule-grid-container">
              <div style="text-align: center; padding: var(--space-6);">
                <i data-lucide="loader" class="anim-spin" style="color: var(--accent-purple); display: inline-block;"></i>
                <p style="margin-top: 10px; font-size: var(--text-xs); color: var(--text-muted);">Cargando horarios...</p>
              </div>
            </div>
          </div>

          <!-- Pestaña 3: Días Feriados -->
          <div class="biz-tab-content" id="biz-tab-content-holidays" style="display: none;">
            <div class="apt-modal-section-title" style="margin-bottom: var(--space-4); font-weight: 700; font-size: var(--text-sm); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="calendar-x" size="14"></i>
              Días Feriados / Festivos (Cierre Total)
            </div>

            <!-- Formulario para agregar feriado -->
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-soft); padding: var(--space-4); border-radius: var(--radius-sm); margin-bottom: var(--space-6);">
              <h4 style="font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; margin-top: 0; margin-bottom: var(--space-3); color: var(--text-secondary);">Agregar nuevo feriado</h4>
              <div style="display: flex; flex-direction: column; gap: var(--space-3);">
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="new-holiday-date" style="font-size: var(--text-xs); font-weight: 700;">Fecha *</label>
                  <input type="date" id="new-holiday-date" class="form-input" style="height: 36px; font-size: var(--text-xs);" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="new-holiday-desc" style="font-size: var(--text-xs); font-weight: 700;">Descripción (opcional)</label>
                  <input type="text" id="new-holiday-desc" class="form-input" placeholder="Ej. Navidad, Reparaciones..." style="height: 36px; font-size: var(--text-xs);" />
                </div>
                <button type="button" class="btn btn-primary" id="btn-add-holiday" style="height: 36px; font-size: var(--text-xs); font-weight: 700; width: 100%; border-radius: var(--radius-xs); cursor: pointer;">
                  Agregar Día de Cierre
                </button>
              </div>
            </div>

            <!-- Listado de feriados -->
            <div id="biz-holidays-list-container">
              <div style="text-align: center; padding: var(--space-6);">
                <i data-lucide="loader" class="anim-spin" style="color: var(--accent-purple); display: inline-block;"></i>
                <p style="margin-top: 10px; font-size: var(--text-xs); color: var(--text-muted);">Cargando feriados...</p>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="biz-drawer-footer">
        <button class="btn btn-secondary" id="biz-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="biz-save-btn">
          ${mode === 'create' ? 'Crear Negocio' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  document.body.appendChild(root);

  // Tab State and Operations
  let localSchedules = [];
  let localHolidays = [];

  const gridContainer = root.querySelector('#biz-schedule-grid-container');
  const holidaysContainer = root.querySelector('#biz-holidays-list-container');

  if (mode === 'edit' && businessData) {
    Promise.all([
      getBusinessSchedules(businessData.id),
      getBusinessHolidays(businessData.id)
    ]).then(([schedules, holidays]) => {
      localSchedules = schedules.map(s => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_open: s.is_open
      }));
      
      localHolidays = holidays.map(h => ({
        id: h.id || Math.random().toString(36).substring(2, 9),
        date: h.date,
        description: h.description || ''
      }));

      renderScheduleGrid();
      renderHolidaysList();
    });
  }

  function renderScheduleGrid() {
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    DAYS_OF_WEEK.forEach(day => {
      const state = localSchedules.find(s => s.day_of_week === day.id) || {
        day_of_week: day.id,
        start_time: '08:00:00',
        end_time: '20:00:00',
        is_open: true
      };

      const dayRow = document.createElement('div');
      dayRow.className = 'schedule-day-row';
      dayRow.dataset.dayId = day.id;

      const startTime = state.start_time && state.start_time.split(':').length === 2 ? state.start_time + ':00' : state.start_time || '08:00:00';
      const endTime = state.end_time && state.end_time.split(':').length === 2 ? state.end_time + ':00' : state.end_time || '20:00:00';

      dayRow.innerHTML = `
        <div class="schedule-day-left" style="display:flex; align-items:center;">
          <label class="schedule-day-toggle">
            <input type="checkbox" class="day-active-checkbox" data-day-id="${day.id}" ${state.is_open ? 'checked' : ''} />
            <div class="schedule-day-toggle-custom"></div>
            <span class="schedule-day-name" style="font-size: var(--text-sm); font-weight: 700; margin-left: 8px;">${day.name}</span>
          </label>
        </div>
        
        <div class="schedule-day-right" style="${state.is_open ? '' : 'opacity: 0.4; pointer-events: none;'} display: flex; align-items: center; gap: 8px;">
          <select class="schedule-time-select start-time-select" data-day-id="${day.id}" style="height: 32px; font-size: var(--text-xs); border: 1px solid var(--border-soft); border-radius: var(--radius-xs); background: var(--bg-secondary); color: var(--text-primary); padding-inline: 4px;">
            ${TIME_OPTIONS.map(opt => `<option value="${opt.value}" ${startTime === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
          </select>
          <span class="schedule-time-separator" style="font-size: var(--text-xs); color: var(--text-muted);">a</span>
          <select class="schedule-time-select end-time-select" data-day-id="${day.id}" style="height: 32px; font-size: var(--text-xs); border: 1px solid var(--border-soft); border-radius: var(--radius-xs); background: var(--bg-secondary); color: var(--text-primary); padding-inline: 4px;">
            ${TIME_OPTIONS.map(opt => `<option value="${opt.value}" ${endTime === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
          </select>
        </div>
      `;

      gridContainer.appendChild(dayRow);
    });

    // Re-bind change listeners
    gridContainer.querySelectorAll('.day-active-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        const sched = localSchedules.find(s => s.day_of_week === dayId);
        if (sched) {
          sched.is_open = e.target.checked;
        } else {
          localSchedules.push({ day_of_week: dayId, start_time: '08:00:00', end_time: '20:00:00', is_open: e.target.checked });
        }
        renderScheduleGrid();
      });
    });

    gridContainer.querySelectorAll('.start-time-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        const sched = localSchedules.find(s => s.day_of_week === dayId);
        if (sched) sched.start_time = e.target.value;
      });
    });

    gridContainer.querySelectorAll('.end-time-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const dayId = parseInt(e.target.dataset.dayId, 10);
        const sched = localSchedules.find(s => s.day_of_week === dayId);
        if (sched) sched.end_time = e.target.value;
      });
    });
  }

  function renderHolidaysList() {
    if (!holidaysContainer) return;
    holidaysContainer.innerHTML = '';

    if (localHolidays.length === 0) {
      holidaysContainer.innerHTML = `
        <div style="text-align: center; padding: var(--space-6); color: var(--text-muted); border: 1px dashed var(--border-soft); border-radius: var(--radius-sm);">
          <i data-lucide="calendar" size="20" style="margin-bottom: 6px; color: var(--text-muted); display: inline-block;"></i>
          <p style="font-size: var(--text-xs); margin: 0;">No hay días feriados registrados.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ node: holidaysContainer });
      }
      return;
    }

    const listHtml = `
      <div style="display: flex; flex-direction: column; gap: var(--space-2); max-height: 250px; overflow-y: auto; padding-right: 4px;">
        ${localHolidays.map(h => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3); background: var(--bg-secondary); border: 1px solid var(--border-soft); border-radius: var(--radius-xs);">
            <div>
              <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${h.date}</div>
              <div style="font-size: var(--text-xs); color: var(--text-muted);">${h.description || 'Feriado / Cerrado'}</div>
            </div>
            <button type="button" class="btn-delete-holiday" data-id="${h.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: var(--space-2); display: flex; align-items: center; justify-content: center; transition: all var(--transition-base);">
              <i data-lucide="trash-2" size="14"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;

    holidaysContainer.innerHTML = listHtml;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({
        attrs: { 'stroke-width': 2.5, 'size': 14 },
        nameAttr: 'data-lucide',
        node: holidaysContainer
      });
    }

    // Bind delete buttons
    holidaysContainer.querySelectorAll('.btn-delete-holiday').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        localHolidays = localHolidays.filter(h => h.id !== id);
        renderHolidaysList();
      });
    });
  }

  // Bind Add Holiday Button
  const addHolidayBtn = root.querySelector('#btn-add-holiday');
  if (addHolidayBtn) {
    const holidayDateInput = root.querySelector('#new-holiday-date');
    if (holidayDateInput) {
      holidayDateInput.min = new Date().toISOString().split('T')[0];
    }

    addHolidayBtn.addEventListener('click', () => {
      const dateInput = root.querySelector('#new-holiday-date');
      const descInput = root.querySelector('#new-holiday-desc');
      
      const dateVal = dateInput.value;
      const descVal = descInput.value.trim();

      if (!dateVal) {
        showToast({ title: 'Fecha requerida', subtitle: 'Por favor selecciona una fecha.', type: 'warning' });
        return;
      }

      if (localHolidays.some(h => h.date === dateVal)) {
        showToast({ title: 'Fecha duplicada', subtitle: 'Esta fecha ya está en la lista.', type: 'warning' });
        return;
      }

      localHolidays.push({
        id: Math.random().toString(36).substring(2, 9),
        date: dateVal,
        description: descVal
      });

      dateInput.value = '';
      descInput.value = '';

      renderHolidaysList();
    });
  }

  // Bind Tab Click Handlers
  if (mode === 'edit') {
    root.querySelectorAll('.biz-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = btn.dataset.tab;

        root.querySelectorAll('.biz-tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.borderBottomColor = 'transparent';
          b.style.color = 'var(--text-muted)';
        });
        btn.classList.add('active');
        btn.style.borderBottomColor = 'var(--accent-purple)';
        btn.style.color = 'var(--text-primary)';

        root.querySelectorAll('.biz-tab-content').forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
        });
        const content = root.querySelector(`#biz-tab-content-${tabName}`);
        if (content) {
          content.classList.add('active');
          content.style.display = 'block';
        }
      });
    });
  }

  // Inicializar Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({
      attrs: {
        'stroke-width': 2,
        'size': 18
      },
      nameAttr: 'data-lucide',
      node: root
    });
  }

  // Referencias a elementos
  const closeBtn = root.querySelector('#biz-drawer-close-btn');
  const cancelBtn = root.querySelector('#biz-cancel-btn');
  const saveBtn = root.querySelector('#biz-save-btn');
  const nameInput = root.querySelector('#biz-name');
  const phoneInput = root.querySelector('#biz-phone');

  // Strict Phone validation constraints: only digits, max 10
  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 10) val = val.substring(0, 10);
    e.target.value = val;
  });
  const addressInput = root.querySelector('#biz-address');
  const fileInput = root.querySelector('#logo-file-input');
  const logoPreview = root.querySelector('#logo-preview');
  const colorsGrid = root.querySelector('#colors-grid');

  let activeColor = selectedColor;

  // Lógica de apertura con animación
  setTimeout(() => {
    root.classList.add('open');
  }, 10);

  // Cerrar modal
  const closeDrawer = () => {
    root.classList.remove('open');
    // Esperar a que termine la animación
    setTimeout(() => {
      root.remove();
    }, 350);
  };

  // Eventos de cierre
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

  // Lógica de slug en modo creación
  if (mode === 'create') {
    const slugText = root.querySelector('#biz-slug-text');
    nameInput.addEventListener('input', () => {
      const currentName = nameInput.value;
      const currentSlug = slugify(currentName);
      slugText.textContent = currentSlug || '...';
      
      // Si no hay logo subido, actualizar la inicial en el preview
      if (!logoBase64) {
        logoPreview.textContent = currentName ? currentName.charAt(0).toUpperCase() : 'B';
      }
    });
  }

  // Manejo de archivo / imagen a Base64
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast({ title: 'Imagen muy grande', subtitle: 'La imagen no debe superar los 2MB', type: 'warning' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        logoBase64 = event.target.result;
        logoPreview.innerHTML = `<img src="${logoBase64}" alt="Logo preview" />`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Selección de color
  colorsGrid.addEventListener('click', (e) => {
    const dot = e.target.closest('.color-option-dot');
    if (dot) {
      colorsGrid.querySelectorAll('.color-option-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      activeColor = dot.getAttribute('data-color');
    }
  });

  // Acciones de edición (Pausar y Eliminar)
  if (mode === 'edit') {
    const deleteInput = root.querySelector('#biz-delete-confirm-input');
    const deleteBtn = root.querySelector('#biz-delete-btn');

    deleteInput.addEventListener('input', (e) => {
      const match = e.target.value.trim() === name.trim();
      if (match) {
        deleteBtn.style.opacity = '1';
        deleteBtn.style.pointerEvents = 'auto';
      } else {
        deleteBtn.style.opacity = '0.5';
        deleteBtn.style.pointerEvents = 'none';
      }
    });

    deleteBtn.addEventListener('click', () => {
      showConfirm({
        title: '¿Eliminar negocio permanentemente?',
        message: `Estás a punto de eliminar "${name}". Esta acción NO se puede deshacer y borrará permanentemente todos los datos, incluyendo servicios, profesionales y citas asociadas.`,
        confirmLabel: 'Sí, eliminar negocio',
        cancelLabel: 'Cancelar',
        confirmVariant: 'danger',
        onConfirm: async () => {
          try {
            await deleteBusiness(businessData.id);
            showToast({
              title: 'Negocio eliminado',
              subtitle: `El negocio "${name}" ha sido borrado de tu cuenta.`,
              type: 'success'
            });
            closeDrawer();
            if (onSave) onSave();
          } catch (err) {
            showToast({ title: 'Error al eliminar', subtitle: err.message, type: 'error' });
          }
        }
      });
    });
  }

  // Validación y envío de formulario
  saveBtn.addEventListener('click', async () => {
    let hasError = false;

    // Resetear clases de error
    nameInput.classList.remove('form-input-error');
    phoneInput.classList.remove('form-input-error');

    // Validar nombre (obligatorio)
    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }

    // Validar teléfono (obligatorio)
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
      // Focus en el primer campo con error
      const firstError = root.querySelector('.form-input-error');
      if (firstError) firstError.focus();
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
      color: activeColor,
      logo: logoBase64
    };

    if (mode === 'edit') {
      const statusToggle = root.querySelector('#biz-status-toggle');
      if (statusToggle) {
        payload.paused = statusToggle.checked;
      }
      payload.alert_minutes_before = parseInt(document.getElementById('biz-alert-minutes')?.value) || 15;
    }

    // Deshabilitar botón durante guardado
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      if (mode === 'create') {
        const baseSlug = slugify(nameInput.value.trim());
        let finalSlug = baseSlug;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
          const { data, error } = await supabase
            .from('businesses')
            .select('id')
            .eq('slug', finalSlug)
            .maybeSingle();

          if (error) {
            console.error('Error checking slug uniqueness:', error);
          }

          if (!data) {
            isUnique = true;
          } else {
            attempts++;
            finalSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
          }
        }
        payload.slug = finalSlug;
        await addBusiness(payload);
      } else {
        // Validar horarios antes de guardar
        let schedulesValid = true;
        localSchedules.forEach(s => {
          if (s.is_open) {
            const startParts = s.start_time.split(':').map(Number);
            const endParts = s.end_time.split(':').map(Number);
            const startMins = startParts[0] * 60 + startParts[1];
            const endMins = endParts[0] * 60 + endParts[1];
            if (startMins >= endMins) {
              schedulesValid = false;
              const dayName = DAYS_OF_WEEK.find(d => d.id === s.day_of_week)?.name || 'Día';
              showToast({
                title: 'Error de Horario',
                subtitle: `La hora de inicio en el día ${dayName} debe ser menor que la de fin.`,
                type: 'error'
              });
            }
          }
        });
        if (!schedulesValid) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar Cambios';
          return;
        }

        // Guardar negocio con has_configured_hours en true
        await updateBusiness(businessData.id, { ...payload, has_configured_hours: true });

        // Guardar horarios
        await updateBusinessSchedules(businessData.id, localSchedules);

        // Guardar feriados (delete + insert)
        await supabase.from('business_holidays').delete().eq('business_id', businessData.id);
        if (localHolidays.length > 0) {
          const { error: holidayError } = await supabase.from('business_holidays').insert(
            localHolidays.map(h => ({
              business_id: businessData.id,
              date: h.date,
              description: h.description || null
            }))
          );
          if (holidayError) {
            console.error('Error saving holidays:', holidayError);
            throw holidayError;
          }
        }
      }

      showToast({
        title: mode === 'create' ? 'Negocio creado' : 'Cambios guardados',
        subtitle: payload.name,
        type: 'success'
      });

      closeDrawer();
      if (onSave) onSave();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = mode === 'create' ? 'Crear Negocio' : 'Guardar Cambios';
      showToast({ title: 'Error al guardar', subtitle: err.message || 'Intenta de nuevo', type: 'error' });
    }
  });
}
