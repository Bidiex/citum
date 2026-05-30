// src/components/onboarding-v2.js
import { auth } from '../core/auth.js';
import { supabase } from '../core/supabase.js';
import { 
  createInitialBusiness, 
  createInitialService, 
  createInitialProfessional, 
  updateOnboardingState 
} from '../utils/onboardingState.js';
import { showToast } from '../utils/toast.js';

// Helper function to replace native alert()
function showOnboardingAlert(message, type = 'warning') {
  showToast({
    title: type === 'error' ? 'Error' : 'Atención',
    subtitle: message,
    type: type
  });
}

// Scoped Lucide initializer to fix icon rendering (Instagram, etc.)
function createLucideIcons(node = null) {
  if (typeof lucide !== 'undefined') {
    if (node) {
      lucide.createIcons({ node });
    } else {
      lucide.createIcons();
    }
  }
}

// State in memory
const onboardingData = {
  business: { name: '', phone: '', address: '' },
  service: { name: '', price: 0, duration: 30 },
  professional: { name: '', schedules: {} },
  businessType: [],        // Max 2 selections
  numSedes: '',            // '1' | '2' | 'mas'
  discovery: '',           // 'redes' | 'referido' | 'otro'
  plan: '',                // 'esencial' | 'pro' | 'max'
  auth: { email: '', password: '' }
};

// Check for plan in URL
const planFromUrl = new URLSearchParams(location.search).get('plan');
if (planFromUrl && ['esencial', 'pro', 'max'].includes(planFromUrl.toLowerCase())) {
  onboardingData.plan = planFromUrl.toLowerCase();
}

// Define the steps flow dynamically
const activeSteps = [
  'step-business',
  'step-service',
  'step-professional',
  'step-biztype',
  'step-sedes',
  'step-discovery',
  ...(planFromUrl ? [] : ['step-plan']),
  'step-auth',
  'step-success'
];

let currentIndex = 0;
let isLoginMode = false;
let currentSession = null;

// Step title mappings
const stepTitles = {
  'step-business': { title: 'Registra tu Negocio', subtitle: 'Ingresa los datos principales de tu negocio' },
  'step-service': { title: 'Tu Primer Servicio', subtitle: '¿Qué servicio principal ofreces a tus clientes?' },
  'step-professional': { title: 'Equipo & Horario', subtitle: 'Agrega un profesional y define su disponibilidad' },
  'step-biztype': { title: 'Categoría del Negocio', subtitle: '¿Qué tipo de servicios prestas? (Selecciona hasta 2)' },
  'step-sedes': { title: 'Sucursales / Sedes', subtitle: '¿Cuántas ubicaciones físicas tienes actualmente?' },
  'step-discovery': { title: '¿Cómo nos encontraste?', subtitle: 'Nos gustaría saber cómo diste con Citum' },
  'step-plan': { title: 'Elige tu Plan', subtitle: 'Selecciona el plan que mejor se adapte a tu crecimiento' },
  'step-auth': { title: 'Crea tu Cuenta', subtitle: 'Ingresa tus credenciales para administrar tu negocio' },
  'step-success': { title: '¡Todo Listo!', subtitle: 'Tu negocio ya está configurado y al aire' }
};

// Initialize wizard when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  initDOM();
  renderScheduleGrid();
  renderBizTypes();
  renderSedes();
  renderDiscovery();
  renderPlans();
  
  // Check if returning from Google Auth flow
  const { session } = await auth.getSession();
  currentSession = session;
  if (session) {
    const pendingDataStr = localStorage.getItem('citum_onboarding_pending_data');
    if (pendingDataStr) {
      try {
        const parsed = JSON.parse(pendingDataStr);
        Object.assign(onboardingData, parsed);
        
        document.body.style.pointerEvents = 'none';
        const slug = await persistAll(session.user.id);
        localStorage.removeItem('citum_onboarding_pending_data');
        
        // Setup Step 9 Success view
        const successTitle = document.getElementById('success-message-title');
        const successDesc = document.getElementById('success-message-desc');
        if (successTitle) {
          successTitle.textContent = `¡Genial!, los clientes de ${onboardingData.business.name} ya pueden agendar sus citas`;
        }
        if (successDesc) {
          successDesc.textContent = `Tu cuenta ha sido creada y el negocio está listo. Tu enlace público de reservas: citum.app/b/${slug}`;
        }
        const btnBooking = document.getElementById('btn-success-booking');
        if (btnBooking) {
          btnBooking.href = `/booking.html?slug=${slug}`;
        }
        
        currentIndex = activeSteps.indexOf('step-success');
        if (currentIndex === -1) currentIndex = activeSteps.length - 1;
        document.body.style.pointerEvents = 'auto';
        updateUI();
        return;
      } catch (err) {
        console.error('Error recovering OAuth state:', err);
        localStorage.removeItem('citum_onboarding_pending_data');
      }
    }
  }
  updateUI();
});

// Setup event listeners and inputs
function initDOM() {
  const btnNext = document.getElementById('btn-next');
  const btnBack = document.getElementById('btn-back');
  const phoneInput = document.getElementById('biz-phone');

  // Strict Phone validation constraints: only digits, max 10
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 10) val = val.substring(0, 10);
      e.target.value = val;
    });
  }

  // Switch signup/login links
  const linkSwitchLogin = document.getElementById('link-switch-login');
  const linkSwitchSignup = document.getElementById('link-switch-signup');
  const authSignupMode = document.getElementById('auth-signup-mode');
  const authLoginMode = document.getElementById('auth-login-mode');
  const wizardTitle = document.getElementById('wizard-title');
  const wizardSubtitle = document.getElementById('wizard-subtitle');

  if (linkSwitchLogin) {
    linkSwitchLogin.addEventListener('click', (e) => {
      e.preventDefault();
      isLoginMode = true;
      authSignupMode.style.display = 'none';
      authLoginMode.style.display = 'block';
      wizardTitle.textContent = 'Inicia Sesión';
      wizardSubtitle.textContent = 'Ingresa a tu cuenta para registrar tu negocio';
    });
  }

  if (linkSwitchSignup) {
    linkSwitchSignup.addEventListener('click', (e) => {
      e.preventDefault();
      isLoginMode = false;
      authLoginMode.style.display = 'none';
      authSignupMode.style.display = 'block';
      wizardTitle.textContent = stepTitles['step-auth'].title;
      wizardSubtitle.textContent = stepTitles['step-auth'].subtitle;
    });
  }

  // Next / Back buttons
  if (btnNext) btnNext.addEventListener('click', handleNext);
  if (btnBack) btnBack.addEventListener('click', handleBack);

  // Google OAuth button handlers
  const googleSignupBtn = document.getElementById('btn-google-signup');
  const googleLoginBtn = document.getElementById('btn-google-login');

  const handleGoogleAuth = async (btn) => {
    try {
      btn.disabled = true;
      const oldHtml = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader" class="anim-spin" style="margin-right: 8px;"></i> Conectando...';
      if (typeof lucide !== 'undefined') lucide.createIcons();

      // Store pending onboarding data to localStorage
      localStorage.setItem('citum_onboarding_pending_data', JSON.stringify(onboardingData));

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/onboarding.html'
        }
      });
    } catch (err) {
      showOnboardingAlert(err.message || 'Error al conectar con Google.', 'error');
      btn.disabled = false;
      btn.innerHTML = `<svg class="google-icon" viewBox="0 0 24 24" width="18" height="18" style="margin-right: 10px;">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
      </svg> Google`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  };

  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', () => handleGoogleAuth(googleSignupBtn));
  }
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => handleGoogleAuth(googleLoginBtn));
  }
}

// Render schedule grid Mon-Sun
function renderScheduleGrid() {
  const container = document.getElementById('schedule-container');
  if (!container) return;

  const daysInfo = [
    { key: 'lunes', label: 'Lunes', active: true },
    { key: 'martes', label: 'Martes', active: true },
    { key: 'miercoles', label: 'Miércoles', active: true },
    { key: 'jueves', label: 'Jueves', active: true },
    { key: 'viernes', label: 'Viernes', active: true },
    { key: 'sabado', label: 'Sábado', active: false },
    { key: 'domingo', label: 'Domingo', active: false }
  ];

  container.innerHTML = daysInfo.map(day => `
    <div class="schedule-row ${day.active ? '' : 'inactive'}" id="row-${day.key}">
      <div class="schedule-day-label">
        <div class="switch-container">
          <input type="checkbox" class="switch-input day-toggle-checkbox" id="toggle-${day.key}" ${day.active ? 'checked' : ''}>
          <label class="switch-label" for="toggle-${day.key}"></label>
        </div>
        <span class="day-name">${day.label}</span>
      </div>
      <input type="time" class="form-input start-time-input" id="start-${day.key}" value="09:00" ${day.active ? '' : 'disabled'}>
      <input type="time" class="form-input end-time-input" id="end-${day.key}" value="18:00" ${day.active ? '' : 'disabled'}>
    </div>
  `).join('');

  // Add event listener to toggles
  daysInfo.forEach(day => {
    const toggle = document.getElementById(`toggle-${day.key}`);
    const row = document.getElementById(`row-${day.key}`);
    const startInput = document.getElementById(`start-${day.key}`);
    const endInput = document.getElementById(`end-${day.key}`);

    toggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        row.classList.remove('inactive');
        startInput.disabled = false;
        endInput.disabled = false;
      } else {
        row.classList.add('inactive');
        startInput.disabled = true;
        endInput.disabled = true;
      }
    });
  });
}

// Render Step 4 Business types
function renderBizTypes() {
  const container = document.getElementById('biztype-container');
  if (!container) return;

  const types = [
    { label: 'Barbería', icon: 'scissors' },
    { label: 'Salón de belleza', icon: 'sparkles' },
    { label: 'Spa', icon: 'flower' },
    { label: 'Uñas y manicure', icon: 'hand' },
    { label: 'Cejas y pestañas', icon: 'eye' },
    { label: 'Maquillaje', icon: 'palette' },
    { label: 'Masajes', icon: 'heart' },
    { label: 'Estética corporal', icon: 'activity' },
    { label: 'Peluquería', icon: 'smile' },
    { label: 'Otro', icon: 'help-circle' }
  ];

  container.innerHTML = types.map(t => `
    <div class="selection-card" data-val="${t.label}">
      <div class="selection-icon-wrapper">
        <i data-lucide="${t.icon}"></i>
      </div>
      <div class="selection-details">
        <span class="selection-title">${t.label}</span>
      </div>
      <div class="checkbox-indicator">
        <i data-lucide="check"></i>
      </div>
    </div>
  `).join('');

  createLucideIcons(container);

  container.querySelectorAll('.selection-card').forEach(card => {
    card.addEventListener('click', () => {
      const val = card.getAttribute('data-val');
      const idx = onboardingData.businessType.indexOf(val);

      if (idx > -1) {
        // Deselect
        onboardingData.businessType.splice(idx, 1);
        card.classList.remove('selected');
      } else {
        // Check max 2 limit
        if (onboardingData.businessType.length >= 2) {
          showOnboardingAlert('Puedes seleccionar un máximo de 2 categorías.');
          return;
        }
        onboardingData.businessType.push(val);
        card.classList.add('selected');
      }
    });
  });
}

// Render Step 5 Sedes
function renderSedes() {
  const container = document.getElementById('sedes-container');
  if (!container) return;

  const options = [
    { key: '1', title: '1 Sede Única', desc: 'Gestionas un solo local o establecimiento físico', icon: 'home' },
    { key: '2', title: '2 Sedes', desc: 'Tienes dos locales independientes bajo tu marca', icon: 'git-branch' },
    { key: 'mas', title: 'Más de 2 sedes', desc: 'Cuentas con una franquicia o múltiples sucursales', icon: 'layers' }
  ];

  container.innerHTML = options.map(o => `
    <div class="selection-card" data-val="${o.key}">
      <div class="selection-icon-wrapper">
        <i data-lucide="${o.icon}"></i>
      </div>
      <div class="selection-details">
        <span class="selection-title">${o.title}</span>
        <span class="selection-desc">${o.desc}</span>
      </div>
    </div>
  `).join('');

  createLucideIcons(container);

  container.querySelectorAll('.selection-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
      onboardingData.numSedes = card.getAttribute('data-val');
      card.classList.add('selected');
    });
  });
}

// Render Step 6 Discovery
function renderDiscovery() {
  const container = document.getElementById('discovery-container');
  if (!container) return;

  const options = [
    { key: 'redes', title: 'Redes Sociales', desc: 'Instagram, Facebook, TikTok o publicidad online', icon: 'instagram' },
    { key: 'referido', title: 'Recomendación o Referido', desc: 'Un amigo o colega te recomendó nuestra plataforma', icon: 'users' },
    { key: 'otro', title: 'Búsqueda web u Otro', desc: 'Buscaste en Google o nos viste en otro sitio', icon: 'globe' }
  ];

  container.innerHTML = options.map(o => `
    <div class="selection-card" data-val="${o.key}">
      <div class="selection-icon-wrapper">
        <i data-lucide="${o.icon}"></i>
      </div>
      <div class="selection-details">
        <span class="selection-title">${o.title}</span>
        <span class="selection-desc">${o.desc}</span>
      </div>
    </div>
  `).join('');

  createLucideIcons(container);

  container.querySelectorAll('.selection-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
      onboardingData.discovery = card.getAttribute('data-val');
      card.classList.add('selected');
    });
  });
}

// Render Step 7 Plans
function renderPlans() {
  const container = document.getElementById('plan-container');
  if (!container) return;

  const plans = [
    { 
      key: 'esencial', 
      name: 'Esencial', 
      price: '$0', 
      period: '/ mes', 
      features: ['Hasta 3 profesionales', 'Agenda digital básica', 'Reservas públicas 24/7'],
      badge: null
    },
    { 
      key: 'pro', 
      name: 'Pro', 
      price: '$49.000', 
      period: '/ mes', 
      features: ['Hasta 10 profesionales', 'Agenda multi-profesional', 'POS & Facturación PDF', 'Reportes de ventas'],
      badge: 'Popular'
    },
    { 
      key: 'max', 
      name: 'Max', 
      price: '$99.000', 
      period: '/ mes', 
      features: ['Profesionales ilimitados', 'Negocios ilimitados', 'Facturación express ilimitada', 'Reportes avanzados'],
      badge: 'Completo'
    }
  ];

  container.innerHTML = plans.map(p => `
    <div class="plan-card" data-val="${p.key}">
      ${p.badge ? `<span class="plan-badge">${p.badge}</span>` : ''}
      <span class="plan-name">${p.name}</span>
      <div class="plan-price">
        <span class="amount">${p.price}</span>
        <span class="period">${p.period}</span>
      </div>
      <ul class="plan-features">
        ${p.features.map(f => `<li class="plan-feature-item"><i data-lucide="check" size="14"></i> ${f}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  createLucideIcons(container);

  container.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
      onboardingData.plan = card.getAttribute('data-val');
      card.classList.add('selected');
    });
  });
}

// Validate fields in current step before proceeding
function validateCurrentStep() {
  const stepId = activeSteps[currentIndex];

  if (stepId === 'step-business') {
    const name = document.getElementById('biz-name').value.trim();
    const phone = document.getElementById('biz-phone').value.trim();
    const address = document.getElementById('biz-address').value.trim();

    if (!name) {
      showOnboardingAlert('Por favor ingresa el nombre de tu negocio.');
      return false;
    }
    if (!phone || phone.length !== 10 || !phone.startsWith('3')) {
      showOnboardingAlert('Por favor ingresa un teléfono válido de 10 dígitos que comience con 3.');
      return false;
    }

    onboardingData.business = { name, phone, address };
    return true;
  }

  if (stepId === 'step-service') {
    const name = document.getElementById('srv-name').value.trim();
    const price = document.getElementById('srv-price').value.trim();
    const duration = document.getElementById('srv-duration').value;

    if (!name) {
      showOnboardingAlert('Por favor ingresa el nombre del servicio.');
      return false;
    }
    if (!price || Number(price) < 0) {
      showOnboardingAlert('Por favor ingresa un precio válido.');
      return false;
    }

    onboardingData.service = { name, price: Number(price), duration: Number(duration) };
    return true;
  }

  if (stepId === 'step-professional') {
    const name = document.getElementById('prof-name').value.trim();
    if (!name) {
      showOnboardingAlert('Por favor ingresa el nombre del profesional.');
      return false;
    }

    const schedules = {};
    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    let activeDayCount = 0;

    days.forEach(day => {
      const active = document.getElementById(`toggle-${day}`).checked;
      const start = document.getElementById(`start-${day}`).value;
      const end = document.getElementById(`end-${day}`).value;
      
      schedules[day] = { active, start, end };
      if (active) activeDayCount++;
    });

    if (activeDayCount === 0) {
      showOnboardingAlert('Por favor activa al menos un día de disponibilidad para el profesional.');
      return false;
    }

    onboardingData.professional = { name, schedules };
    return true;
  }

  if (stepId === 'step-biztype') {
    if (onboardingData.businessType.length === 0) {
      showOnboardingAlert('Por favor selecciona al menos una categoría.');
      return false;
    }
    return true;
  }

  if (stepId === 'step-sedes') {
    if (!onboardingData.numSedes) {
      showOnboardingAlert('Por favor selecciona el número de sedes.');
      return false;
    }
    return true;
  }

  if (stepId === 'step-discovery') {
    if (!onboardingData.discovery) {
      showOnboardingAlert('Por favor indícanos cómo nos encontraste.');
      return false;
    }
    return true;
  }

  if (stepId === 'step-plan') {
    if (!onboardingData.plan) {
      showOnboardingAlert('Por favor selecciona un plan.');
      return false;
    }
    return true;
  }

  if (stepId === 'step-auth') {
    if (currentSession) return true;
    const email = isLoginMode 
      ? document.getElementById('login-email').value.trim() 
      : document.getElementById('auth-email').value.trim();
    
    const password = isLoginMode 
      ? document.getElementById('login-password').value.trim() 
      : document.getElementById('auth-password').value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showOnboardingAlert('Por favor ingresa un correo electrónico válido.');
      return false;
    }
    if (!password || password.length < 6) {
      showOnboardingAlert('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }

    onboardingData.auth = { email, password };
    return true;
  }

  return true;
}

// Progress wizard UI refresh
function updateUI() {
  const stepId = activeSteps[currentIndex];

  // Update step visibility
  document.querySelectorAll('.onboarding-step').forEach(el => {
    el.classList.remove('active');
  });
  const currentEl = document.getElementById(stepId);
  if (currentEl) currentEl.classList.add('active');

  // Toggle auth step modes if on step-auth
  if (stepId === 'step-auth') {
    const authSignupMode = document.getElementById('auth-signup-mode');
    const authLoginMode = document.getElementById('auth-login-mode');
    const authLoggedInMode = document.getElementById('auth-logged-in-mode');
    const loggedInEmail = document.getElementById('logged-in-email');

    if (currentSession) {
      if (authSignupMode) authSignupMode.style.display = 'none';
      if (authLoginMode) authLoginMode.style.display = 'none';
      if (authLoggedInMode) {
        authLoggedInMode.style.display = 'block';
        if (loggedInEmail) loggedInEmail.textContent = currentSession.user.email;
      }
    } else {
      if (authLoggedInMode) authLoggedInMode.style.display = 'none';
      if (authSignupMode) authSignupMode.style.display = isLoginMode ? 'none' : 'block';
      if (authLoginMode) authLoginMode.style.display = isLoginMode ? 'block' : 'none';
    }
  }

  // Progress bar
  const progressBar = document.getElementById('wizard-progress-bar');
  if (progressBar) {
    const pct = currentIndex === activeSteps.length - 1 
      ? 100 
      : (currentIndex / (activeSteps.length - 1)) * 100;
    progressBar.style.width = `${pct}%`;
  }

  // Header Title / Subtitle updates
  const headerTitle = document.getElementById('wizard-title');
  const headerSubtitle = document.getElementById('wizard-subtitle');
  if (headerTitle && headerSubtitle && stepTitles[stepId]) {
    if (stepId === 'step-auth') {
      if (currentSession) {
        headerTitle.textContent = 'Confirmar Cuenta';
        headerSubtitle.textContent = 'Asocia tu negocio a tu cuenta de Citum';
      } else if (isLoginMode) {
        headerTitle.textContent = 'Inicia Sesión';
        headerSubtitle.textContent = 'Ingresa a tu cuenta para registrar tu negocio';
      } else {
        headerTitle.textContent = stepTitles[stepId].title;
        headerSubtitle.textContent = stepTitles[stepId].subtitle;
      }
    } else {
      headerTitle.textContent = stepTitles[stepId].title;
      headerSubtitle.textContent = stepTitles[stepId].subtitle;
    }
  }

  // Button visibility & labels
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  const footer = document.getElementById('wizard-footer');

  if (stepId === 'step-success') {
    if (footer) footer.style.display = 'none';
  } else {
    if (footer) footer.style.display = 'flex';
    if (btnBack) {
      btnBack.style.display = currentIndex === 0 ? 'none' : 'inline-flex';
    }
    if (btnNext) {
      if (stepId === 'step-auth') {
        if (currentSession) {
          btnNext.innerHTML = 'Crear Negocio <i data-lucide="check" style="margin-left: 8px;"></i>';
        } else {
          btnNext.innerHTML = isLoginMode 
            ? 'Iniciar Sesión <i data-lucide="log-in" style="margin-left: 8px;"></i>' 
            : 'Registrar Negocio <i data-lucide="check" style="margin-left: 8px;"></i>';
        }
      } else {
        btnNext.innerHTML = 'Siguiente <i data-lucide="arrow-right" style="margin-left: 8px;"></i>';
      }
      createLucideIcons();
    }
  }

  // Pre-fill selected cards styles
  if (stepId === 'step-biztype') {
    const container = document.getElementById('biztype-container');
    if (container) {
      container.querySelectorAll('.selection-card').forEach(card => {
        const val = card.getAttribute('data-val');
        if (onboardingData.businessType.includes(val)) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    }
  }

  if (stepId === 'step-sedes') {
    const container = document.getElementById('sedes-container');
    if (container) {
      container.querySelectorAll('.selection-card').forEach(card => {
        const val = card.getAttribute('data-val');
        if (onboardingData.numSedes === val) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    }
  }

  if (stepId === 'step-discovery') {
    const container = document.getElementById('discovery-container');
    if (container) {
      container.querySelectorAll('.selection-card').forEach(card => {
        const val = card.getAttribute('data-val');
        if (onboardingData.discovery === val) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    }
  }

  if (stepId === 'step-plan') {
    const container = document.getElementById('plan-container');
    if (container) {
      container.querySelectorAll('.plan-card').forEach(card => {
        const val = card.getAttribute('data-val');
        if (onboardingData.plan === val) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    }
  }
}

// Next Step Action
async function handleNext() {
  if (!validateCurrentStep()) return;

  const stepId = activeSteps[currentIndex];

  if (stepId === 'step-auth') {
    const btnNext = document.getElementById('btn-next');
    btnNext.disabled = true;
    const oldText = btnNext.innerHTML;
    btnNext.innerHTML = '<i data-lucide="loader" class="anim-spin" style="margin-right: 8px;"></i> Guardando...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
      let userId = null;
      if (currentSession) {
        userId = currentSession.user.id;
      } else {
        let user = null;
        if (isLoginMode) {
          const { user: loggedUser, error } = await auth.login(onboardingData.auth.email, onboardingData.auth.password);
          if (error) throw error;
          user = loggedUser;
        } else {
          const { user: registeredUser, error } = await auth.register(
            onboardingData.auth.email, 
            onboardingData.auth.password, 
            onboardingData.business.name
          );
          if (error) throw error;
          user = registeredUser;
        }

        if (!user) throw new Error('Ocurrió un error al autenticar.');
        userId = user.id;
      }

      // Persist onboarding data to Supabase database
      const slug = await persistAll(userId);

      // Setup Step 9 Success view
      const successTitle = document.getElementById('success-message-title');
      const successDesc = document.getElementById('success-message-desc');
      if (successTitle) {
        successTitle.textContent = `¡Genial!, los clientes de ${onboardingData.business.name} ya pueden agendar sus citas`;
      }
      if (successDesc) {
        if (currentSession) {
          successDesc.textContent = `El negocio está listo. Tu enlace público de reservas: citum.app/b/${slug}`;
        } else {
          successDesc.textContent = `Tu cuenta ha sido creada y el negocio está listo. Tu enlace público de reservas: citum.app/b/${slug}`;
        }
      }

      // Configure booking links
      const btnBooking = document.getElementById('btn-success-booking');
      if (btnBooking) {
        btnBooking.href = `/booking.html?slug=${slug}`;
      }

      currentIndex++;
      updateUI();
    } catch (err) {
      showOnboardingAlert(err.message || 'Error al guardar la cuenta. Intenta de nuevo.', 'error');
    } finally {
      btnNext.disabled = false;
      btnNext.innerHTML = oldText;
      createLucideIcons();
    }
  } else {
    // Normal step increment
    currentIndex++;
    updateUI();
  }
}

// Back Step Action
function handleBack() {
  if (currentIndex > 0) {
    currentIndex--;
    updateUI();
  }
}

// Persist All step memory data atomically in Supabase
async function persistAll(userId) {
  // Generate slug
  const baseSlug = onboardingData.business.name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Check slug uniqueness in Supabase
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

  // 1. Create Business (including custom plan column value)
  const biz = await createInitialBusiness({
    name: onboardingData.business.name,
    phone: onboardingData.business.phone,
    address: onboardingData.business.address,
    slug: finalSlug,
    plan: onboardingData.plan || 'esencial'
  });

  if (!biz || !biz.id) {
    throw new Error('No se pudo crear el registro del negocio.');
  }

  // 2. Create Service
  await createInitialService(biz.id, {
    name: onboardingData.service.name,
    price: onboardingData.service.price,
    duration: onboardingData.service.duration
  });

  // 3. Create Professional + schedules
  await createInitialProfessional(biz.id, {
    name: onboardingData.professional.name,
    schedules: onboardingData.professional.schedules
  });

  // 4. Mark Onboarding completed
  await updateOnboardingState(userId, 'completed');

  return finalSlug;
}
