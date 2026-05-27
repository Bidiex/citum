// agenda.js — Módulo de la Agenda del Panel con Vista de Calendario
import { openAppointmentModal } from '../components/appointment-modal.js';
import { initCalendar } from '../components/calendar.js';
import { getColombiaTodayStr } from '../utils/format.js';
import { upsertClientFromAppointment, removeClientAppointmentStats, getActiveBusinessId } from '../utils/businessState.js';

// Obtener fecha de hoy en formato YYYY-MM-DD ajustada a la zona horaria de Colombia
const todayStr = getColombiaTodayStr();

// Citas de prueba enriquecidas con campo date
const mockAppointments = [
  { date: todayStr, time: '09:00 AM', client: 'Carlos Mendoza', service: 'Corte Premium', prof: 'Juan Pérez', status: 'confirmada' },
  { date: todayStr, time: '10:00 AM', client: 'Diana Turbay', service: 'Perfilado de Cejas', prof: 'Carlos Gómez', status: 'pendiente' },
  { date: todayStr, time: '11:00 AM', client: 'Andrés López', service: 'Afeitado de Barba', prof: 'Juan Pérez', status: 'confirmada' },
  { date: todayStr, time: '02:00 PM', client: 'Mateo Restrepo', service: 'Combo Imperial', prof: 'Carlos Gómez', status: 'pendiente' },
];

export function init(container) {
  container.innerHTML = `
    <div class="view-container" style="display: flex; flex-direction: column; height: 100%;">
      <div class="view-header" style="flex-shrink: 0;">
        <div>
          <p class="flow-subtitle" style="margin-bottom: 0;">Administra y organiza las citas reservadas en tu agenda diaria y semanal.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="btn-new-apt" style="height: 40px; padding-inline: var(--space-4);">
            <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
            Nueva Cita
          </button>
        </div>
      </div>

      <!-- Contenedor del Calendario -->
      <div id="cal-view-wrapper" style="flex-grow: 1; display: flex; flex-direction: column; min-height: 0;">
      </div>
    </div>
  `;

  // Inicializar iconos de Lucide en la cabecera de la sección
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: container.querySelector('.view-header') });
  }

  const calWrapper = container.querySelector('#cal-view-wrapper');
  
  // Inicializar Calendario interactivo
  const calendarInstance = initCalendar({
    container: calWrapper,
    appointments: mockAppointments,
    onNewAppointment: (newApt) => {
      upsertClientFromAppointment(newApt, getActiveBusinessId(), false);
    },
    onAppointmentUpdate: (updatedApt, oldApt) => {
      upsertClientFromAppointment(updatedApt, getActiveBusinessId(), true, oldApt);
    },
    onAppointmentDelete: (deletedApt) => {
      removeClientAppointmentStats(deletedApt, getActiveBusinessId());
    }
  });

  // Asociar evento para abrir el modal de nueva cita
  const btnNewApt = container.querySelector('#btn-new-apt');
  btnNewApt.addEventListener('click', () => {
    openAppointmentModal({
      appointments: mockAppointments,
      mode: 'create',
      onSave: (newApt) => {
        newApt.isNew = true;
        mockAppointments.push(newApt);
        // Registrar cliente en el CRM
        upsertClientFromAppointment(newApt, getActiveBusinessId(), false);
        // Actualizar datos del calendario
        calendarInstance.updateAppointments(mockAppointments);
      }
    });
  });
}
