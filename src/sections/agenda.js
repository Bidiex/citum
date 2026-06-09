// agenda.js — Módulo de la Agenda del Panel con Vista de Calendario (conectado a Supabase)
import { openAppointmentModal } from '../components/appointment-modal.js';
import { initCalendar } from '../components/calendar.js';
import { getColombiaTodayStr, parseTimestamptzToColombia, STATUS_COLORS } from '../utils/format.js';
import { 
  getAppointments, 
  addAppointment, 
  updateAppointment, 
  deleteAppointment, 
  getActiveBusinessId,
  getActiveBusiness,
  getWhatsappTemplates
} from '../utils/businessState.js';
import { supabase } from '../core/supabase.js';
import { showToast } from '../utils/toast.js';

export async function init(container) {
  const businessId = getActiveBusinessId();
  const currentBusiness = getActiveBusiness();

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

  // Renderizar la estructura base de la vista primero
  container.innerHTML = `
    <div class="view-container" style="display: flex; flex-direction: column; height: 100%;">
      <div class="view-header" style="flex-shrink: 0;">
        <div>
          <p class="flow-subtitle" style="margin-bottom: 0;">Administra y organiza las citas reservadas en tu agenda diaria y semanal.</p>
        </div>
        <div class="view-actions" style="display: flex; gap: var(--space-2);">
          <button class="btn btn-secondary" id="btn-toggle-metrics" style="height: 40px; padding-inline: var(--space-3); display: flex; align-items: center; justify-content: center;" title="Mostrar/Ocultar métricas">
            <i data-lucide="chevron-up" size="16"></i>
          </button>
          <button class="btn btn-primary" id="btn-new-apt" style="height: 40px; padding-inline: var(--space-4);">
            <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
            Nueva Cita
          </button>
        </div>
      </div>

      <!-- 📊 Métricas de la Agenda -->
      <div class="agenda-metrics">
        <div style="grid-column: 1 / -1; display:flex; align-items:center; justify-content:center; padding: var(--space-4); width: 100%;">
          <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
        </div>
      </div>

      <!-- Contenedor del Calendario -->
      <div id="cal-view-wrapper" style="flex-grow: 1; display: flex; flex-direction: column; min-height: 0;">
      </div>
    </div>
  `;

  // Control del Toggle de métricas
  const btnToggleMetrics = container.querySelector('#btn-toggle-metrics');
  const metricsContainer = container.querySelector('.agenda-metrics');
  const isMetricsCollapsed = localStorage.getItem('citum_metrics_collapsed') === 'true';
  
  if (isMetricsCollapsed && metricsContainer && btnToggleMetrics) {
    metricsContainer.classList.add('collapsed');
    btnToggleMetrics.classList.add('collapsed');
  }

  if (btnToggleMetrics && metricsContainer) {
    btnToggleMetrics.addEventListener('click', () => {
      const collapsed = metricsContainer.classList.toggle('collapsed');
      localStorage.setItem('citum_metrics_collapsed', collapsed);
      btnToggleMetrics.classList.toggle('collapsed', collapsed);
    });
  }

  // Cargar citas e inicializar calendario
  let appointments = await getAppointments(businessId);

  if (container.getAttribute('data-active-section') !== 'agenda') return;

  const calWrapper = container.querySelector('#cal-view-wrapper');

  const calendarInstance = initCalendar({
    container: calWrapper,
    appointments: appointments,
    onNewAppointment: async (newApt) => {},
    onAppointmentUpdate: async (updatedApt, oldApt) => {
      try {
        await updateAppointment(updatedApt.id, updatedApt, updatedApt.rawServices || []);
        appointments = await getAppointments(businessId);
        calendarInstance.updateAppointments(appointments);
        await refreshMetricsAndNextApt();
      } catch (err) {
        console.error('[onAppointmentUpdate] Error:', err);
      }
    },
    onAppointmentDelete: async (deletedApt) => {
      try {
        await deleteAppointment(deletedApt.id);
        appointments = await getAppointments(businessId);
        calendarInstance.updateAppointments(appointments);
        await refreshMetricsAndNextApt();
      } catch (err) {
        console.error('[onAppointmentDelete] Error:', err);
      }
    }
  });

  // Detector de alertas de confirmación
  const shownAlerts = new Set(); // evita mostrar la misma alerta dos veces por sesión
  let alertModalOpen = false; // evita apilar modales
  const alertQueue = []; // cola si hay múltiples citas en alerta simultáneas

  const checkUpcomingAlerts = () => {
    const threshold = currentBusiness?.alert_minutes_before ?? 15;
    const now = new Date();

    const toAlert = appointments.filter(apt => {
      if (apt.status !== 'pendiente') return false;
      if (apt.alert_dismissed) return false;
      if (shownAlerts.has(apt.id)) return false;
      const startsAt = new Date(apt.starts_at || `${apt.date}T${convertTo24h(apt.time)}`);
      const minutesUntil = (startsAt - now) / 60000;
      return minutesUntil <= threshold && minutesUntil > 0;
    });

    toAlert.forEach(apt => {
      shownAlerts.add(apt.id);
      alertQueue.push(apt);
    });

    processAlertQueue();
  };

  const processAlertQueue = async () => {
    if (alertModalOpen || alertQueue.length === 0) return;
    alertModalOpen = true;
    const apt = alertQueue.shift();
    const templates = await getWhatsappTemplates(businessId);
    const { openAlertModal } = await import('../components/alert-confirmation-modal.js');
    openAlertModal(apt, currentBusiness, templates, (dismissedId) => {
      // Marcar en el array local para que el calendario se actualice
      const idx = appointments.findIndex(a => a.id === dismissedId);
      if (idx !== -1) appointments[idx].alert_dismissed = true;
      calendarInstance.updateAppointments(appointments);
      alertModalOpen = false;
      processAlertQueue(); // procesar siguiente en cola
    });
  };

  const alertInterval = setInterval(checkUpcomingAlerts, 60000);

  const sparksSVG = `
    <div class="metric-card-sparkles">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L22.2 12.8L33 15L22.2 17.2L20 28L17.8 17.2L7 15L17.8 12.8L20 2Z" fill="white" opacity="0.25"/>
        <path d="M31 22L32 27L37 28L32 29L31 34L30 29L25 28L30 27L31 22Z" fill="white" opacity="0.15"/>
      </svg>
    </div>
  `;

  // Función interna para refrescar dinámicamente las métricas y la próxima cita
  async function refreshMetricsAndNextApt() {
    let metrics = { pending_today: 0, completed_today: 0, billed_today: 0, projected_today: 0 };
    let nextApt = null;
    let nextTime = '';
    let nextAptStatusColor = '';
    let nextAptStatusTitle = '';
    let nextAptBadge = '';
    let nextTimeDisplay = '';

    try {
      const [metricsResult, nextAptResult] = await Promise.all([
        supabase
          .from('daily_agenda_metrics')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle(),
        supabase
          .from('appointments')
          .select(`
            id,
            starts_at,
            status,
            client_name,
            notes,
            total_price,
            client_phone,
            client_email,
            professionals (name),
            appointment_services (
              service_id,
              service_name,
              price_at_time,
              duration_at_time
            )
          `)
          .eq('business_id', businessId)
          .in('status', ['pendiente', 'confirmada'])
          .gt('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(1)
          .maybeSingle()
      ]);

      if (metricsResult.data) {
        metrics = metricsResult.data;
      }
      if (nextAptResult.data) {
        nextApt = nextAptResult.data;
        const { date, time } = parseTimestamptzToColombia(nextApt.starts_at);
        nextTime = time;
        nextAptStatusColor = STATUS_COLORS[nextApt.status] || 'var(--color-primary)';
        nextAptStatusTitle = nextApt.status.charAt(0).toUpperCase() + nextApt.status.slice(1).replace('_', ' ');
        nextAptBadge = `<span class="metric-badge" style="background: ${nextAptStatusColor}22; color: ${nextAptStatusColor}; border: 1px solid ${nextAptStatusColor}33; text-transform: capitalize; margin-left: auto;">${nextAptStatusTitle}</span>`;

        const todayStr = getColombiaTodayStr();
        if (date !== todayStr) {
          const formattedShortDate = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          }).format(new Date(nextApt.starts_at));
          const capitalizedDate = formattedShortDate
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).replace('.', ''))
            .join(' ');
          nextTimeDisplay = `<span style="font-size: 12px; font-weight: 700; color: ${nextAptStatusColor}; display: block; margin-bottom: 2px; letter-spacing: 0.02em;">${capitalizedDate}</span>${nextTime}`;
        } else {
          nextTimeDisplay = nextTime;
        }
      }
    } catch (err) {
      console.error('[refreshMetricsAndNextApt] Error:', err);
    }

    let nextGlow = 'rgba(139, 92, 255, 0.15)';
    let nextBg = 'rgba(139, 92, 255, 0.08)';
    let nextBorderColor = 'rgba(139, 92, 255, 0.15)';
    if (nextApt) {
      if (nextApt.status === 'confirmada') {
        nextGlow = 'rgba(139, 92, 255, 0.15)';
        nextBg = 'rgba(139, 92, 255, 0.08)';
        nextBorderColor = 'rgba(139, 92, 255, 0.15)';
      } else {
        nextGlow = 'rgba(245, 158, 11, 0.12)';
        nextBg = 'rgba(245, 158, 11, 0.08)';
        nextBorderColor = 'rgba(245, 158, 11, 0.15)';
      }
    }

    const projectedStr = Number(metrics.projected_today) === 0 
      ? 'Sin citas proyectadas' 
      : `Proyección: $${Number(metrics.projected_today).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
    
    const pctBadge = Number(metrics.projected_today) > 0
      ? `<span class="metric-badge" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success); margin-left: auto;">${((Number(metrics.billed_today) / Number(metrics.projected_today)) * 100).toFixed(0)}%</span>`
      : '';

    metricsContainer.innerHTML = `
      <!-- Card 1 — Pendientes hoy -->
      <div class="metric-card" style="--card-accent: var(--color-warning); --card-glow-color: rgba(245, 158, 11, 0.15); --card-accent-bg: rgba(245, 158, 11, 0.08); --card-accent-border: rgba(245, 158, 11, 0.15);">
        ${sparksSVG}
        <div class="metric-card-top">
          <div class="metric-card-icon-wrapper">
            <i data-lucide="calendar"></i>
          </div>
        </div>
        <div class="metric-card-content">
          <span class="metric-card-title">Pendientes hoy</span>
          <div class="metric-card-number">${metrics.pending_today}</div>
        </div>
        <div class="metric-card-subtext">Citas por atender hoy</div>
      </div>

      <!-- Card 2 — Completadas hoy -->
      <div class="metric-card" style="--card-accent: var(--color-success); --card-glow-color: rgba(16, 185, 129, 0.15); --card-accent-bg: rgba(16, 185, 129, 0.08); --card-accent-border: rgba(16, 185, 129, 0.15);">
        ${sparksSVG}
        <div class="metric-card-top">
          <div class="metric-card-icon-wrapper">
            <i data-lucide="check-circle"></i>
          </div>
        </div>
        <div class="metric-card-content">
          <span class="metric-card-title">Completadas hoy</span>
          <div class="metric-card-number">${metrics.completed_today}</div>
        </div>
        <div class="metric-card-subtext">Citas finalizadas hoy</div>
      </div>

      <!-- Card 3 — Facturación del día -->
      <div class="metric-card" style="--card-accent: var(--accent-purple); --card-glow-color: rgba(139, 92, 255, 0.18); --card-accent-bg: rgba(139, 92, 255, 0.08); --card-accent-border: rgba(139, 92, 255, 0.15);">
        ${sparksSVG}
        <div class="metric-card-top">
          <div class="metric-card-icon-wrapper">
            <i data-lucide="dollar-sign"></i>
          </div>
        </div>
        <div class="metric-card-content">
          <span class="metric-card-title">Facturado hoy</span>
          <div class="metric-card-number">COP $${Number(metrics.billed_today).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
        </div>
        <div class="metric-card-subtext" style="width: 100%;">
          <span>${projectedStr}</span>
          ${pctBadge}
        </div>
      </div>

      <!-- Card 4 — Próxima cita -->
      ${nextApt ? `
        <div class="metric-card" id="next-appointment-card" data-id="${nextApt.id}" style="cursor: pointer; --card-accent: ${nextAptStatusColor}; --card-glow-color: ${nextGlow}; --card-accent-bg: ${nextBg}; --card-accent-border: ${nextBorderColor};">
          ${sparksSVG}
          <div class="metric-card-top">
            <div class="metric-card-icon-wrapper">
              <i data-lucide="clock"></i>
            </div>
          </div>
          <div class="metric-card-content">
            <span class="metric-card-title">Próxima cita</span>
            <div class="metric-card-number">${nextTimeDisplay}</div>
          </div>
          <div class="metric-card-subtext" style="width: 100%; display: flex; align-items: center; gap: var(--space-1);">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; display: inline-flex; align-items: center; gap: 4px;" title="${nextApt.client_name} con ${nextApt.professionals ? nextApt.professionals.name : 'Cualquiera'}">
              ${nextApt.client_name} · <i data-lucide="user" style="width: 12px; height: 12px; stroke-width: 2.5;"></i> ${nextApt.professionals ? nextApt.professionals.name.split(' ')[0] : 'Cualquiera'}
            </span>
            ${nextAptBadge}
          </div>
        </div>
      ` : `
        <div class="metric-card" style="--card-accent: var(--text-muted); --card-glow-color: rgba(142, 138, 174, 0.08); --card-accent-bg: rgba(142, 138, 174, 0.05); --card-accent-border: rgba(142, 138, 174, 0.12);">
          ${sparksSVG}
          <div class="metric-card-top">
            <div class="metric-card-icon-wrapper">
              <i data-lucide="moon"></i>
            </div>
          </div>
          <div class="metric-card-content">
            <span class="metric-card-title">Próxima cita</span>
            <div class="metric-card-number" style="font-size: var(--text-lg); margin-top: var(--space-1);">No hay más</div>
          </div>
          <div class="metric-card-subtext">No hay más citas hoy</div>
        </div>
      `}
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: metricsContainer });
    }

    const nextAptCardBtn = metricsContainer.querySelector('#next-appointment-card');
    if (nextAptCardBtn && nextApt) {
      nextAptCardBtn.addEventListener('click', async () => {
        const nextAptCard = document.querySelector(`.cal-apt-card[data-id="${nextApt.id}"]`);
        if (nextAptCard) {
          nextAptCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nextAptCard.click();
        } else {
          const { date, time } = parseTimestamptzToColombia(nextApt.starts_at);
          const serviceNames = (nextApt.appointment_services || []).map(s => s.service_name);
          const formattedApt = {
            id: nextApt.id,
            date,
            time,
            client: nextApt.client_name,
            phone: nextApt.client_phone,
            email: nextApt.client_email,
            service: serviceNames.join(' + '),
            prof: nextApt.professionals ? nextApt.professionals.name : 'Cualquiera',
            professional_id: nextApt.professional_id,
            status: nextApt.status,
            notes: nextApt.notes,
            totalPrice: Number(nextApt.total_price),
            rawServices: nextApt.appointment_services
          };
          const { openAptDetailModal } = await import('../components/apt-detail-modal.js');
          openAptDetailModal({
            apt: formattedApt,
            onEdit: async () => {
              appointments = await getAppointments(businessId);
              calendarInstance.updateAppointments(appointments);
              await refreshMetricsAndNextApt();
            },
            onDelete: async () => {
              appointments = await getAppointments(businessId);
              calendarInstance.updateAppointments(appointments);
              await refreshMetricsAndNextApt();
            },
            onUpdate: async () => {
              appointments = await getAppointments(businessId);
              calendarInstance.updateAppointments(appointments);
              await refreshMetricsAndNextApt();
            }
          });
        }
      });
    }
  }

  // Cargar métricas y próxima cita inicialmente
  await refreshMetricsAndNextApt();

  if (container.getAttribute('data-active-section') !== 'agenda') return;

  const viewContainer = container.querySelector('.view-container');
  if (viewContainer && typeof lucide !== 'undefined') {
    lucide.createIcons({ node: viewContainer });
  }

  // Asociar evento para abrir el modal de nueva cita
  const btnNewApt = container.querySelector('#btn-new-apt');
  if (btnNewApt) {
    btnNewApt.addEventListener('click', async () => {
      await openAppointmentModal({
        appointments: appointments,
        mode: 'create',
        onSave: async (newApt, selectedServices) => {
          try {
            await addAppointment(businessId, newApt, selectedServices);
            appointments = await getAppointments(businessId);
            calendarInstance.updateAppointments(appointments);
            await refreshMetricsAndNextApt();
          } catch (err) {
            console.error('[onSave new appointment] Error:', err);
            throw err;
          }
        }
      });
    });
  }

  // SUSCRIPCIÓN EN TIEMPO REAL (Realtime)
  const channelName = `appointments-changes-${businessId}`;

  // Eliminar canal previo con el mismo nombre si ya existía para evitar duplicación
  const existingChannel = supabase.channel(channelName);
  supabase.removeChannel(existingChannel);

  let realtimeChannel = supabase
    .channel(channelName)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'appointments',
      filter: `business_id=eq.${businessId}`
    }, async (payload) => {
      appointments = await getAppointments(businessId);
      calendarInstance.updateAppointments(appointments);
      await refreshMetricsAndNextApt();
      checkUpcomingAlerts();

      if (payload.eventType === 'INSERT') {
        const clientName = payload.new?.client_name || 'Un cliente';
        showToast({
          title: 'Nueva cita agendada',
          subtitle: `${clientName} acaba de agendar una cita desde el portal.`,
          type: 'success'
        });
      }
    })
    .subscribe();

  // Temporizador para actualización periódica de la próxima cita cada 60s
  const metricsTimer = setInterval(async () => {
    await refreshMetricsAndNextApt();
  }, 60000);

  // Ejecutar verificación de alertas inicial tras inicializar completamente la agenda
  checkUpcomingAlerts();

  // Registrar cleanup para la navegación SPA
  container.cleanup = () => {
    clearInterval(metricsTimer);
    clearInterval(alertInterval);
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

function convertTo24h(timeStr) {
  if (!timeStr) return '00:00:00';
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}
