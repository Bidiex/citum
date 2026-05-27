// booking.js — Coordinador y Enrutador del Flujo de Reserva Público
import { getBusinesses } from './utils/businessState.js';

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

document.addEventListener('DOMContentLoaded', () => {
  // 1. Cargar negocio dinámico desde query param ?b=slug o localStorage por defecto
  const urlParams = new URLSearchParams(window.location.search);
  const bizSlug = urlParams.get('b');
  const businesses = getBusinesses();
  
  let activeBiz = businesses[0]; // Fallback al primero
  if (bizSlug) {
    const found = businesses.find(b => b.slug === bizSlug);
    if (found) activeBiz = found;
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
  }

  // Inicializar íconos Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Estado global de la reserva en el cliente
  const bookingState = {
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
  const submitBooking = () => {
    const container = document.getElementById('booking-flow-container');
    if (!container) return;

    container.innerHTML = `
      <div class="booking-loading-placeholder" style="padding-top: var(--space-8);">
        <i data-lucide="check-circle" style="width: 64px; height: 64px; color: var(--biz-accent); filter: drop-shadow(0 0 10px var(--biz-accent-light));"></i>
        <h2 style="margin-top: var(--space-4);">¡Reserva Confirmada Exitosamente!</h2>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">Tu cita ha sido agendada. Te esperamos el día seleccionado.</p>
        <a href="/index.html" class="btn btn-primary" style="background: var(--biz-accent); border:none; box-shadow: 0 4px 15px var(--biz-accent-light);">Volver al Inicio</a>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  };

  // Cargar paso 1 por defecto (catálogo)
  goToStep(1);
});
