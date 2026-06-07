// src/components/whatsapp-modal.js
import { formatWhatsAppMessage, replaceTemplateVariables, wrapSelection } from '../utils/whatsappFormatter.js';
import { getTemplates } from '../utils/whatsappState.js';
import { getActiveBusiness } from '../utils/businessState.js';
import { supabase } from '../core/supabase.js';
import { parseTimestamptzToColombia } from '../utils/format.js';

/**
 * Abre el modal para enviar un WhatsApp al cliente
 * @param {object} options
 * @param {object} options.client - { name, phone, last_service, last_service_date }
 * @param {function} [options.onClose] - Callback al cerrar
 */
export async function openWhatsAppModal({ client, onClose }) {
  // 1. Obtener datos necesarios
  const activeBusiness = getActiveBusiness();
  const businessId = activeBusiness?.id;
  const businessName = activeBusiness?.name || 'Mi Negocio';
  const templates = await getTemplates(businessId);

  // 2. Obtener la próxima cita pendiente o confirmada del cliente
  let nextApt = null;
  if (businessId) {
    try {
      const { data: apts, error: aptError } = await supabase
        .from('appointments')
        .select(`
          starts_at,
          total_price,
          professionals (name),
          appointment_services (service_name)
        `)
        .eq('business_id', businessId)
        .eq('client_phone', client.phone)
        .in('status', ['pendiente', 'confirmada'])
        .gt('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(1);

      if (!aptError && apts && apts.length > 0) {
        const apt = apts[0];
        const { date, time } = parseTimestamptzToColombia(apt.starts_at);
        const serviceNames = (apt.appointment_services || []).map(s => s.service_name);
        nextApt = {
          date,
          time,
          service: serviceNames.join(' + '),
          prof: apt.professionals ? apt.professionals.name : 'Cualquiera',
          totalPrice: apt.total_price
        };
      }
    } catch (err) {
      console.error('[whatsapp-modal] Error querying next appointment:', err);
    }
  }

  // 3. Crear estructura del DOM del modal
  const root = document.createElement('div');
  root.id = 'whatsapp-modal-root';
  root.className = 'apt-modal-overlay';

  root.innerHTML = `
    <div class="apt-modal" style="max-width: 560px; display: flex; flex-direction: column; gap: var(--space-4);">
      <div class="apt-modal-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-soft); padding-bottom: var(--space-3);">
        <h3 style="margin: 0; font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          <i data-lucide="message-square" style="color: var(--color-success, #10b981); width: 20px; height: 20px;"></i>
          Notificar a ${client.name}
        </h3>
        <button class="apt-modal-close-btn" id="wa-modal-close-btn" style="background: none; border: none; color: var(--text-muted); cursor: pointer;">
          <i data-lucide="x" style="width: 20px; height: 20px;"></i>
        </button>
      </div>

      <div class="apt-modal-body" style="display: flex; flex-direction: column; gap: var(--space-4); max-height: 70vh; overflow-y: auto;">
        
        <!-- Info del Cliente / Próxima Cita -->
        <div style="background: rgba(255,255,255,0.02); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border-soft); display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; gap: var(--space-4);">
            <div style="flex: 1;">
              <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; display: block; letter-spacing: 0.05em;">Teléfono</span>
              <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${client.phone || 'Sin número'}</span>
            </div>
            <div style="flex: 1;">
              <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; display: block; letter-spacing: 0.05em;">Negocio</span>
              <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${businessName}</span>
            </div>
          </div>
          ${nextApt ? `
            <div style="border-top: 1px dashed var(--border-soft); margin-top: 4px; padding-top: var(--space-2);">
              <span style="font-size: 10px; color: var(--accent-neon); font-weight: 800; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="calendar" style="width: 12px; height: 12px;"></i> PRÓXIMA CITA DETECTADA:
              </span>
              <span style="font-size: 12px; color: var(--text-secondary); font-weight: 600; display: block; margin-top: 2px;">
                ${nextApt.service} con <strong>${nextApt.prof}</strong> — <strong>${nextApt.date} a las ${nextApt.time}</strong>
              </span>
            </div>
          ` : `
            <div style="border-top: 1px dashed var(--border-soft); margin-top: 4px; padding-top: var(--space-2); font-size: 11px; color: var(--text-muted); font-weight: 600;">
              No se detectaron próximas citas. Se usarán datos del último servicio como variables.
            </div>
          `}
        </div>

        ${templates.length === 0 ? `
          <!-- Estado vacío si no hay plantillas -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-8) var(--space-4); text-align: center;">
            <div style="background: rgba(239, 68, 68, 0.05); padding: var(--space-3); border-radius: var(--radius-pill); border: 1px solid rgba(239, 68, 68, 0.1); display: inline-flex; align-items: center; justify-content: center;">
              <i data-lucide="alert-circle" style="color: var(--color-danger, #ef4444); width: 28px; height: 28px;"></i>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <h4 style="margin: 0; font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">Sin plantillas disponibles</h4>
              <p style="margin: 0; font-size: var(--text-xs); color: var(--text-muted); line-height: 1.5; max-width: 280px;">
                No tienes ninguna plantilla de WhatsApp creada en tu negocio. Crea una en la sección de <strong>Plantillas WhatsApp</strong> para poder notificar a tus clientes.
              </p>
            </div>
          </div>
        ` : `
          <!-- Selector de Plantilla -->
          <div class="form-group">
            <label class="form-label" for="wa-template-select">Seleccionar Plantilla</label>
            <select id="wa-template-select" class="form-input" style="width: 100%;">
              <option value="" disabled selected>-- Elige una plantilla --</option>
              ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          </div>

          <!-- Vista Previa (Simulación WhatsApp - Solo lectura) -->
          <div class="form-group" id="wa-preview-group" style="display: none; transition: all 0.2s;">
            <label class="form-label">Vista Previa del Mensaje</label>
            <div class="whatsapp-preview-container">
              <div class="whatsapp-preview-bubble" id="wa-preview-bubble-content">
                <!-- Se inyectará el texto de la plantilla resuelto -->
              </div>
              <span class="whatsapp-preview-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        `}

      </div>

      <div class="apt-modal-footer" style="display: flex; gap: var(--space-3); justify-content: flex-end; border-top: 1px solid var(--border-soft); padding-top: var(--space-3);">
        <button class="btn btn-secondary" id="wa-cancel-btn">Cancelar</button>
        ${templates.length > 0 ? `
          <button class="btn btn-primary" id="wa-send-btn" disabled style="display: flex; align-items: center; gap: 8px; background: var(--color-success, #10b981); border-color: var(--color-success, #10b981); opacity: 0.6; cursor: not-allowed;">
            <i data-lucide="send" style="width: 16px; height: 16px;"></i>
            Enviar por WhatsApp
          </button>
        ` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Forzar reflow para animación
  root.offsetHeight;
  root.classList.add('open');

  // Inicializar íconos Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: root });
  }

  // Elementos DOM
  const closeBtn = root.querySelector('#wa-modal-close-btn');
  const cancelBtn = root.querySelector('#wa-cancel-btn');
  const sendBtn = root.querySelector('#wa-send-btn');
  const selectTemplate = root.querySelector('#wa-template-select');
  const previewGroup = root.querySelector('#wa-preview-group');
  const previewBubble = root.querySelector('#wa-preview-bubble-content');

  // Función para cerrar modal con animación
  const destroy = () => {
    root.classList.remove('open');
    setTimeout(() => {
      root.remove();
      if (onClose) onClose();
    }, 300);
  };

  // Variable de estado para el mensaje resuelto
  let resolvedMessageText = '';

  // Evento al seleccionar plantilla (si existe el selector)
  if (selectTemplate) {
    selectTemplate.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const templateObj = templates.find(t => t.id === selectedId);

      if (!templateObj) {
        if (previewGroup) previewGroup.style.display = 'none';
        if (sendBtn) {
          sendBtn.disabled = true;
          sendBtn.style.opacity = '0.6';
          sendBtn.style.cursor = 'not-allowed';
        }
        resolvedMessageText = '';
        return;
      }

      // Reemplazar variables y dar formato HTML para la burbuja
      resolvedMessageText = replaceTemplateVariables(templateObj.content, client, activeBusiness, nextApt);
      const formattedHTML = formatWhatsAppMessage(resolvedMessageText);

      if (previewBubble) {
        previewBubble.innerHTML = formattedHTML;
      }
      if (previewGroup) {
        previewGroup.style.display = 'block';
      }

      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        sendBtn.style.cursor = 'pointer';
      }
    });
  }

  // Enviar mensaje a WhatsApp (si existe el botón)
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (!resolvedMessageText.trim()) return;

      // Quitar cualquier carácter no numérico del teléfono excepto el signo +
      let phoneNum = (client.phone || '').replace(/[^\d+]/g, '');

      // Si no tiene prefijo, asumir prefijo de Colombia (+57) por defecto si tiene 10 dígitos
      if (phoneNum.length === 10 && !phoneNum.startsWith('+')) {
        phoneNum = '+57' + phoneNum;
      }

      const encodedText = encodeURIComponent(resolvedMessageText);
      const waUrl = `https://wa.me/${phoneNum}?text=${encodedText}`;

      window.open(waUrl, '_blank');
      destroy();
    });
  }

  // Cerrar eventos
  if (closeBtn) closeBtn.addEventListener('click', destroy);
  if (cancelBtn) cancelBtn.addEventListener('click', destroy);

  // Cerrar al dar clic fuera del box
  root.addEventListener('click', (e) => {
    if (e.target === root) destroy();
  });
}
