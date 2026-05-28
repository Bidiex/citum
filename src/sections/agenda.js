// agenda.js — Módulo de la Agenda del Panel con Vista de Calendario (conectado a Supabase)
import { openAppointmentModal } from '../components/appointment-modal.js';
import { initCalendar } from '../components/calendar.js';
import { getColombiaTodayStr } from '../utils/format.js';
import { 
  getAppointments, 
  addAppointment, 
  updateAppointment, 
  deleteAppointment, 
  getActiveBusinessId 
} from '../utils/businessState.js';
import { supabase } from '../core/supabase.js';

export async function init(container) {
  const businessId = getActiveBusinessId();

  if (!businessId) {
    container.innerHTML = `
      <div class="view-container">
        <div class="crm-empty-state">
          <i data-lucide="store" size="48" style="stroke-width:1.5; color:var(--accent-neon);"></i>
          <h3>Sin negocio activo</h3>
          <p>Selecciona o crea un negocio primero desde la sección "Negocios".</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Mostrar indicador de carga
  container.innerHTML = `
    <div class="view-container">
      <div style="display:flex; align-items:center; justify-content:center; padding: var(--space-12);">
        <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Cargar citas reales
  let appointments = await getAppointments(businessId);

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

  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: container.querySelector('.view-header') });
  }

  const calWrapper = container.querySelector('#cal-view-wrapper');

  // Inicializar Calendario interactivo
  const calendarInstance = initCalendar({
    container: calWrapper,
    appointments: appointments,
    onNewAppointment: async (newApt) => {
      // (Si el calendario dispara esto directamente, se puede agregar)
    },
    onAppointmentUpdate: async (updatedApt, oldApt) => {
      try {
        await updateAppointment(updatedApt.id, updatedApt, updatedApt.rawServices || []);
        appointments = await getAppointments(businessId);
        calendarInstance.updateAppointments(appointments);
      } catch (err) {
        console.error('[onAppointmentUpdate] Error:', err);
      }
    },
    onAppointmentDelete: async (deletedApt) => {
      try {
        await deleteAppointment(deletedApt.id);
        appointments = await getAppointments(businessId);
        calendarInstance.updateAppointments(appointments);
      } catch (err) {
        console.error('[onAppointmentDelete] Error:', err);
      }
    }
  });

  // Asociar evento para abrir el modal de nueva cita
  const btnNewApt = container.querySelector('#btn-new-apt');
  btnNewApt.addEventListener('click', async () => {
    await openAppointmentModal({
      appointments: appointments,
      mode: 'create',
      onSave: async (newApt, selectedServices) => {
        try {
          await addAppointment(businessId, newApt, selectedServices);
          appointments = await getAppointments(businessId);
          calendarInstance.updateAppointments(appointments);
        } catch (err) {
          console.error('[onSave new appointment] Error:', err);
          throw err; // El modal maneja el error y rehabilita el botón
        }
      }
    });
  });

  // SUSCRIPCIÓN EN TIEMPO REAL (Realtime)
  const channel = supabase
    .channel(`appointments-changes-${businessId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'appointments',
      filter: `business_id=eq.${businessId}`
    }, async () => {
      appointments = await getAppointments(businessId);
      calendarInstance.updateAppointments(appointments);
    })
    .subscribe();

  // Limpiar suscripción cuando el contenedor sea destruido / removido de la vista
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === container || node.contains(container)) {
          supabase.removeChannel(channel);
          observer.disconnect();
        }
      });
    });
  });
  
  if (container.parentNode) {
    observer.observe(container.parentNode, { childList: true });
  }
}
