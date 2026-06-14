// src/components/upgrade-modal.js
// Modal de upgrade que aparece cuando una feature está bloqueada por plan

import { PLAN_DEFINITIONS, getRequiredPlanForFeature, getActivePlan, formatPrice } from '../core/plans.js';

export function openUpgradeModal({ feature, context, onUpgrade }) {
  const requiredPlanDef = getRequiredPlanForFeature(feature);
  if (!requiredPlanDef) return;

  // Creamos el contenedor del modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fade-in';
  modal.id = 'upgrade-modal';
  
  // Beneficios según el plan requerido
  let benefitsHTML = '';
  if (requiredPlanDef.id === 'pro') {
    benefitsHTML = `
      <ul class="benefits-list">
        <li>Módulo de inventario completo</li>
        <li>Hasta 3 negocios</li>
        <li>Hasta 10 profesionales</li>
        <li>Control de insumos por servicio</li>
      </ul>
    `;
  } else if (requiredPlanDef.id === 'max') {
    benefitsHTML = `
      <ul class="benefits-list">
        <li>Todo lo del plan Pro</li>
        <li>Negocios y profesionales ilimitados</li>
        <li>Agente IA interno del panel</li>
        <li>Agente WhatsApp para clientes</li>
      </ul>
    `;
  }

  modal.innerHTML = `
    <div class="modal-content scale-in" style="max-width: 400px; text-align: center; border-radius: 16px; padding: 2rem 1.5rem;">
      <div class="modal-header" style="justify-content: center; border-bottom: none; padding-bottom: 0; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <div style="font-size: 3rem; line-height: 1; margin-bottom: 0.5rem;">👑</div>
        <h2 style="font-size: 1.25rem; font-weight: 600; margin: 0;">Función exclusiva del plan ${requiredPlanDef.name}</h2>
      </div>
      
      <div class="modal-body" style="padding-top: 1rem;">
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">
          Para usar <strong>${context}</strong> necesitas el plan ${requiredPlanDef.name}.
        </p>

        <div class="plan-card" style="border: 2px solid ${requiredPlanDef.badge_color}; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; text-align: left; background: var(--bg-secondary);">
          <h3 style="color: ${requiredPlanDef.badge_color}; margin: 0 0 0.5rem 0; font-size: 1.1rem;">Plan ${requiredPlanDef.name}</h3>
          <div style="font-size: 1.75rem; font-weight: bold; margin-bottom: 1rem; color: var(--text-primary);">
            ${formatPrice(requiredPlanDef.price_cop)}<span style="font-size: 1rem; color: var(--text-secondary); font-weight: normal;">/mes</span>
          </div>
          ${benefitsHTML}
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button id="btn-upgrade-confirm" class="btn btn-primary" style="background-color: ${requiredPlanDef.badge_color}; width: 100%; border: none; padding: 0.75rem; border-radius: 8px; font-weight: 600; font-size: 1rem;">
            Actualizar a ${requiredPlanDef.name} — ${formatPrice(requiredPlanDef.price_cop)}/mes
          </button>
          <button id="btn-upgrade-cancel" class="btn btn-ghost" style="width: 100%; padding: 0.75rem; border-radius: 8px; font-weight: 500; color: var(--text-secondary);">
            Quizás después
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Estilos inyectados solo para este modal si no existen de manera global
  const style = document.createElement('style');
  style.innerHTML = `
    #upgrade-modal .benefits-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    #upgrade-modal .benefits-list li {
      position: relative;
      padding-left: 1.5rem;
      margin-bottom: 0.5rem;
      color: var(--text-primary);
      font-size: 0.875rem;
    }
    #upgrade-modal .benefits-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: ${requiredPlanDef.badge_color};
      font-weight: bold;
    }
  `;
  modal.appendChild(style);

  // Función para cerrar con animación
  const closeModal = () => {
    modal.classList.remove('fade-in');
    modal.classList.add('fade-out');
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.classList.remove('scale-in');
      content.classList.add('scale-out');
    }
    
    setTimeout(() => {
      modal.remove();
    }, 200); // Mismo timing que otros modales del sistema (var(--transition-normal))
  };

  // Event Listeners
  modal.querySelector('#btn-upgrade-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(); // Clic fuera del modal
  });

  modal.querySelector('#btn-upgrade-confirm').addEventListener('click', () => {
    if (onUpgrade) {
      onUpgrade(requiredPlanDef);
    }
    closeModal();
  });
}
