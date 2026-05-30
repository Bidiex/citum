// confirmacion.js — Módulo del paso 3: Resumen y Confirmación de Datos del Cliente
import { getColombiaTodayStr, getColombiaTimeParts } from '../utils/format.js';

export function init(container, state, actions) {
  const total = state.selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0);

  // Formatear la fecha para hacerla amigable
  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-CO', options);
  };

  // Renderizar la vista
  container.innerHTML = `
    <div class="flow-view">
      <div>
        <h2 class="flow-title">Resumen de tu cita</h2>
        <p class="flow-subtitle">Revisa los detalles y completa tu información para confirmar.</p>
      </div>

      <!-- Resumen Detallado -->
      <div class="summary-card" id="booking-summary-card">
        <div class="summary-header">
          <i data-lucide="info" size="16" style="color: var(--accent-neon);"></i>
          <span>Detalles Seleccionados</span>
        </div>
        
        <div class="summary-body">
          <!-- Servicios -->
          <div class="summary-item">
            <span class="item-label">Servicio(s):</span>
            <div class="item-value-list">
              ${state.selectedServices.map(s => `
                <div class="summary-sub-item">
                  <span>${s.name}</span>
                  <span style="color: var(--text-muted); font-size: var(--text-xs);">COP $${s.price.toLocaleString('es-CO')}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Profesional -->
          <div class="summary-item">
            <span class="item-label">Profesional:</span>
            <span class="item-value">${state.selectedProfessional?.name || 'Cualquiera'}</span>
          </div>

          <!-- Fecha y Hora -->
          <div class="summary-item">
            <span class="item-label">Fecha:</span>
            <span class="item-value" style="text-transform: capitalize;">${formatDateString(state.selectedDate)}</span>
          </div>
          
          <div class="summary-item">
            <span class="item-label">Hora:</span>
            <span class="item-value">${state.selectedTimeSlot}</span>
          </div>

          <!-- Totales -->
          <hr style="border: 0; border-top: 1px solid var(--border-soft); margin-block: var(--space-4);">
          
          <div class="summary-totals">
            <div>
              <span class="total-label">Duración Total:</span>
              <span class="total-val">${totalDuration} minutos</span>
            </div>
            <div>
              <span class="total-label">Total a Pagar:</span>
              <span class="total-val text-gradient" style="font-weight: 800; font-size: var(--text-lg);">COP $${total.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Formulario de Datos -->
      <form id="booking-client-form" class="client-details-form" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <h3 style="font-size: var(--text-sm); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: var(--space-1);">
          Ingresa tus datos
        </h3>
        
        <div class="form-group-booking">
          <label class="label-booking" for="client-name">Nombre y Apellido *</label>
          <input type="text" id="client-name" class="input-booking" placeholder="Ej. Juan Pérez" required value="${state.clientInfo.name}">
        </div>

        <div class="form-group-booking">
          <label class="label-booking" for="client-phone">Número de Teléfono *</label>
          <input type="tel" id="client-phone" class="input-booking" placeholder="Ej. 3001234567" required value="${state.clientInfo.phone}">
        </div>

        <div class="form-group-booking">
          <label class="label-booking" for="client-email">Correo Electrónico (Opcional)</label>
          <input type="email" id="client-email" class="input-booking" placeholder="Ej. tu@correo.com" value="${state.clientInfo.email}">
        </div>

        <div class="form-group-booking">
          <label class="label-booking" for="client-notes">Notas adicionales (Opcional)</label>
          <textarea id="client-notes" class="input-booking textarea-booking" placeholder="Ej. Alguna indicación especial o preferencia..." rows="3">${state.clientInfo.notes}</textarea>
        </div>

        <!-- Botones de Acción -->
        <div class="step-actions-footer" style="margin-top: var(--space-4); display: flex; gap: var(--space-4);">
          <button type="button" class="btn btn-secondary" style="flex: 1;" id="btn-back-step-3">Atrás</button>
          <button type="submit" class="btn btn-primary" style="flex: 1;" id="btn-submit-booking">Confirmar Reserva</button>
        </div>
      </form>
    </div>
  `;

  // Estilos rápidos para esta sección
  const style = document.createElement('style');
  style.id = 'confirmation-styles';
  style.innerHTML = `
    .summary-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-md);
      padding: var(--space-6);
    }
    .summary-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: var(--space-4);
    }
    .summary-body {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: var(--text-base);
    }
    .item-label {
      color: var(--text-muted);
      font-weight: 600;
    }
    .item-value {
      color: var(--text-primary);
      font-weight: 700;
      text-align: right;
    }
    .item-value-list {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-1);
      max-width: 60%;
    }
    .summary-sub-item {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.2;
    }
    .summary-sub-item span {
      font-weight: 700;
      font-size: var(--text-sm);
    }
    .summary-totals {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .summary-totals div {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: 600;
    }
    .total-val {
      font-weight: 700;
      color: var(--text-primary);
    }

    .form-group-booking {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .label-booking {
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-secondary);
    }
    .input-booking {
      height: 48px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-xs);
      padding-inline: var(--space-4);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
      transition: all var(--transition-base);
    }
    .input-booking:focus {
      border-color: var(--accent-purple);
      box-shadow: 0 0 0 3px rgba(139, 92, 255, 0.15);
    }
    .textarea-booking {
      height: auto;
      padding-block: var(--space-3);
      resize: none;
    }
  `;
  
  const oldStyles = document.getElementById('confirmation-styles');
  if (oldStyles) oldStyles.remove();
  document.head.appendChild(style);

  // Inicializar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Enlazar eventos de botones
  const phoneInput = container.querySelector('#client-phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 10) val = val.substring(0, 10);
      e.target.value = val;
    });
  }

  container.querySelector('#btn-back-step-3').addEventListener('click', () => {
    // Guardar estado parcial del form antes de volver
    state.clientInfo.name = document.getElementById('client-name').value;
    state.clientInfo.phone = document.getElementById('client-phone').value;
    state.clientInfo.email = document.getElementById('client-email').value;
    state.clientInfo.notes = document.getElementById('client-notes').value;
    actions.back();
  });

  const form = container.querySelector('#booking-client-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const phoneVal = phoneInput ? phoneInput.value.trim() : '';
    if (!phoneVal || phoneVal.length !== 10 || !phoneVal.startsWith('3')) {
      alert('Por favor, ingresa un número de teléfono válido de 10 dígitos que comience con 3.');
      if (phoneInput) phoneInput.focus();
      return;
    }

    // Validar que la fecha y hora seleccionada no sea en el pasado
    const todayStr = getColombiaTodayStr();
    const selectedDate = state.selectedDate;
    const selectedTimeSlot = state.selectedTimeSlot;
    let isPast = false;

    if (selectedDate < todayStr) {
      isPast = true;
    } else if (selectedDate === todayStr && selectedTimeSlot) {
      const nowParts = getColombiaTimeParts();
      const currentMinutes = nowParts.hours * 60 + nowParts.minutes;
      
      const [time, modifier] = selectedTimeSlot.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      const slotMinutes = hours * 60 + minutes;

      if (slotMinutes < currentMinutes) {
        isPast = true;
      }
    }

    if (isPast) {
      alert('La fecha u hora seleccionada ya ha pasado. Por favor, selecciona un horario diferente.');
      actions.back(); // Volver al paso 2
      return;
    }
    
    // Guardar estado del formulario
    state.clientInfo.name = document.getElementById('client-name').value;
    state.clientInfo.phone = phoneVal;
    state.clientInfo.email = document.getElementById('client-email').value;
    state.clientInfo.notes = document.getElementById('client-notes').value;

    actions.submit();
  });
}
