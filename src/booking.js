// booking.js — Coordinador y Enrutador del Flujo de Reserva Público
import { getBusinessBySlug, addAppointment, getProfessionalsForBooking, getAppointments } from './utils/businessState.js';

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

    // Logo / Inicial
    const logoEl = document.querySelector('.business-logo');
    if (logoEl) {
      if (activeBiz.logo) {
        logoEl.innerHTML = `<img src="${activeBiz.logo}" alt="${activeBiz.name}" style="width: 100%; height: 100%; object-fit: cover;" />`;
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

  // Cargar paso 1 por defecto (catálogo)
  goToStep(1);
});
