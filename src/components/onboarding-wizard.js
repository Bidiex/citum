// src/components/onboarding-wizard.js
import { auth } from '../core/auth.js';
import { 
  getOnboardingState, 
  updateOnboardingState, 
  createInitialBusiness, 
  createInitialService, 
  createInitialProfessional 
} from '../utils/onboardingState.js';

let currentStep = 1;
let currentBusinessId = null;

export async function mountOnboardingWizard(containerElement) {
  // Load CSS dynamically
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/styles/onboarding.css';
  document.head.appendChild(link);

  const { session } = await auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  const html = `
    <div class="onboarding-overlay">
      <div class="onboarding-glass-panel">
        <div class="onboarding-progress">
          <div class="onboarding-progress-bar" id="wizard-progress"></div>
        </div>
        
        <!-- Header -->
        <div class="onboarding-header">
          <div class="onboarding-logo-area">
            <span class="logo-icon"></span>
            <span class="brand-text">Citum</span>
          </div>
          <h1 id="wizard-title">Bienvenido a Citum</h1>
          <p id="wizard-subtitle">Vamos a configurar tu negocio en 3 simples pasos.</p>
          
          <!-- Expanding dot stepper indicators -->
          <div class="onboarding-steps-indicator" style="display: flex; justify-content: center; gap: var(--space-2); margin-top: var(--space-4); margin-bottom: var(--space-1);">
            <span class="step-dot" data-step="1" style="width: 8px; height: 8px; border-radius: 50%; background-color: var(--border-soft); transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);"></span>
            <span class="step-dot" data-step="2" style="width: 8px; height: 8px; border-radius: 50%; background-color: var(--border-soft); transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);"></span>
            <span class="step-dot" data-step="3" style="width: 8px; height: 8px; border-radius: 50%; background-color: var(--border-soft); transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);"></span>
            <span class="step-dot" data-step="4" style="width: 8px; height: 8px; border-radius: 50%; background-color: var(--border-soft); transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);"></span>
          </div>
        </div>

        <div class="onboarding-content">
          <!-- Step 1: Business -->
          <div class="onboarding-step active" id="step-1">
            <div class="form-group">
              <label for="ob-biz-name">Nombre del Negocio</label>
              <input type="text" class="form-input" id="ob-biz-name" placeholder="Ej. Barbería Imperial" required>
            </div>
            <div class="form-group">
              <label for="ob-biz-phone">Teléfono (Opcional)</label>
              <input type="tel" class="form-input" id="ob-biz-phone" placeholder="Ej. 3001234567">
            </div>
          </div>

          <!-- Step 2: Service -->
          <div class="onboarding-step" id="step-2">
            <div class="form-group">
              <label for="ob-srv-name">Tu Primer Servicio</label>
              <input type="text" class="form-input" id="ob-srv-name" placeholder="Ej. Corte de Cabello" required>
            </div>
            <div class="form-group">
              <label for="ob-srv-price">Precio</label>
              <input type="number" class="form-input" id="ob-srv-price" placeholder="Ej. 25000" required>
            </div>
            <div class="form-group">
              <label for="ob-srv-duration">Duración</label>
              <select class="form-input" id="ob-srv-duration">
                <option value="15">15 min</option>
                <option value="30" selected>30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hora</option>
                <option value="90">1.5 horas</option>
              </select>
            </div>
          </div>

          <!-- Step 3: Professional -->
          <div class="onboarding-step" id="step-3">
            <div class="form-group">
              <label for="ob-prof-name">Nombre del Profesional</label>
              <input type="text" class="form-input" id="ob-prof-name" placeholder="Ej. Tu Nombre (o de un empleado)" required>
            </div>
            
            <div class="form-group" style="margin-top: var(--space-2);">
              <label>Horario de trabajo (Lunes a Viernes)</label>
              
              <div class="schedule-grid-container">
                <div class="schedule-grid">
                  <span>Lunes</span>
                  <input type="time" class="form-input" id="ob-sched-lun-start" value="09:00">
                  <input type="time" class="form-input" id="ob-sched-lun-end" value="18:00">
                </div>
                <div class="schedule-grid">
                  <span>Martes</span>
                  <input type="time" class="form-input" id="ob-sched-mar-start" value="09:00">
                  <input type="time" class="form-input" id="ob-sched-mar-end" value="18:00">
                </div>
                <div class="schedule-grid">
                  <span>Miércoles</span>
                  <input type="time" class="form-input" id="ob-sched-mie-start" value="09:00">
                  <input type="time" class="form-input" id="ob-sched-mie-end" value="18:00">
                </div>
                <div class="schedule-grid">
                  <span>Jueves</span>
                  <input type="time" class="form-input" id="ob-sched-jue-start" value="09:00">
                  <input type="time" class="form-input" id="ob-sched-jue-end" value="18:00">
                </div>
                <div class="schedule-grid">
                  <span>Viernes</span>
                  <input type="time" class="form-input" id="ob-sched-vie-start" value="09:00">
                  <input type="time" class="form-input" id="ob-sched-vie-end" value="18:00">
                </div>
              </div>
            </div>
          </div>

          <!-- Step 4: Success -->
          <div class="onboarding-step" id="step-4">
            <div class="celebration-area">
              <div class="celebration-icon">
                <i data-lucide="check-circle" size="40"></i>
              </div>
              <h2 style="font-weight: 800; letter-spacing: -0.02em; color: var(--text-primary); margin-bottom: var(--space-2);">¡Todo Listo!</h2>
              <p style="color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500;">Tu negocio está configurado y listo para empezar a recibir citas.</p>
            </div>
          </div>
        </div>

        <div class="onboarding-footer">
          <button class="btn btn-primary" id="btn-next" style="width: 100%; height: 48px;">
            Siguiente <i data-lucide="arrow-right" size="18" style="margin-left: var(--space-2);"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  containerElement.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const btnNext = document.getElementById('btn-next');
  const progressBar = document.getElementById('wizard-progress');
  const title = document.getElementById('wizard-title');
  const subtitle = document.getElementById('wizard-subtitle');
  const phoneInput = document.getElementById('ob-biz-phone');

  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 10) val = val.substring(0, 10);
      e.target.value = val;
    });
  }

  const updateUI = () => {
    document.querySelectorAll('.onboarding-step').forEach((el, index) => {
      if (index + 1 === currentStep) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    progressBar.style.width = `${(currentStep / 4) * 100}%`;

    // Expanding active dot stepper indicators
    document.querySelectorAll('.step-dot').forEach((dot, index) => {
      if (index + 1 === currentStep) {
        dot.style.backgroundColor = 'var(--accent-purple)';
        dot.style.width = '24px';
        dot.style.borderRadius = '4px';
      } else {
        dot.style.backgroundColor = 'var(--border-soft)';
        dot.style.width = '8px';
        dot.style.borderRadius = '50%';
      }
    });

    if (currentStep === 1) {
      title.textContent = 'Bienvenido a Citum';
      subtitle.textContent = 'Vamos a configurar tu negocio.';
    } else if (currentStep === 2) {
      title.textContent = 'Agrega tu primer servicio';
      subtitle.textContent = '¿Qué ofreces principalmente?';
    } else if (currentStep === 3) {
      title.textContent = 'Configura tu disponibilidad';
      subtitle.textContent = 'Agrega al primer profesional o a ti mismo.';
    } else if (currentStep === 4) {
      title.textContent = '¡Felicidades!';
      subtitle.textContent = '';
      btnNext.innerHTML = 'Ir a mi Panel <i data-lucide="home" size="18" style="margin-left: var(--space-2);"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  };

  updateUI();

  btnNext.addEventListener('click', async () => {
    btnNext.disabled = true;
    const oldText = btnNext.innerHTML;
    btnNext.innerHTML = '<i data-lucide="loader" class="anim-spin" size="18" style="margin-right: var(--space-2);"></i> Guardando...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
      if (currentStep === 1) {
        const name = document.getElementById('ob-biz-name').value.trim();
        const phone = phoneInput ? phoneInput.value.trim() : '';
        
        if (!name) throw new Error('El nombre del negocio es obligatorio.');
        if (phone && (phone.length !== 10 || !phone.startsWith('3'))) {
          throw new Error('El teléfono debe tener exactamente 10 dígitos y comenzar con 3 (o quedar vacío).');
        }

        // Create slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const biz = await createInitialBusiness({ name, phone, slug });
        currentBusinessId = biz.id;
        await updateOnboardingState(userId, 'business_created');
        currentStep++;
      } 
      else if (currentStep === 2) {
        const name = document.getElementById('ob-srv-name').value.trim();
        const price = document.getElementById('ob-srv-price').value;
        const duration = document.getElementById('ob-srv-duration').value;

        if (!name || !price) throw new Error('Nombre y precio son obligatorios.');

        await createInitialService(currentBusinessId, { name, price: Number(price), duration: Number(duration) });
        await updateOnboardingState(userId, 'service_created');
        currentStep++;
      }
      else if (currentStep === 3) {
        const name = document.getElementById('ob-prof-name').value.trim();
        if (!name) throw new Error('El nombre del profesional es obligatorio.');

        const schedules = {
          lunes: { active: true, start: document.getElementById('ob-sched-lun-start').value, end: document.getElementById('ob-sched-lun-end').value },
          martes: { active: true, start: document.getElementById('ob-sched-mar-start').value, end: document.getElementById('ob-sched-mar-end').value },
          miercoles: { active: true, start: document.getElementById('ob-sched-mie-start').value, end: document.getElementById('ob-sched-mie-end').value },
          jueves: { active: true, start: document.getElementById('ob-sched-jue-start').value, end: document.getElementById('ob-sched-jue-end').value },
          viernes: { active: true, start: document.getElementById('ob-sched-vie-start').value, end: document.getElementById('ob-sched-vie-end').value },
        };

        await createInitialProfessional(currentBusinessId, { name, schedules });
        await updateOnboardingState(userId, 'completed');
        currentStep++;
      }
      else if (currentStep === 4) {
        // Complete! Reload window to enter the standard panel flow
        window.location.reload();
        return;
      }
      
      updateUI();
    } catch (err) {
      alert(err.message || 'Ocurrió un error. Intenta nuevamente.');
    } finally {
      btnNext.disabled = false;
      btnNext.innerHTML = oldText;
    }
  });
}
