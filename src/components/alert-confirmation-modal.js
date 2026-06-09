import { supabase } from '../core/supabase.js';
import { showToast } from '../utils/toast.js';
import { formatWhatsAppMessage, replaceTemplateVariables } from '../utils/whatsappFormatter.js';

export function openAlertModal(apt, business, templates, onDismiss) {
  if (!apt) return;

  // Evitar duplicados
  const existing = document.getElementById('alert-confirmation-root');
  if (existing) {
    existing.remove();
  }

  const root = document.createElement('div');
  root.id = 'alert-confirmation-root';
  root.className = 'apt-modal-overlay';
  root.style.zIndex = '1200';

  root.innerHTML = `
    <div class="apt-modal" style="max-width: 480px; display: flex; flex-direction: column; gap: var(--space-4);">
      <div class="apt-modal-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-soft); padding-bottom: var(--space-3);">
        <h3 style="margin: 0; font-size: var(--text-base); font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
          <i data-lucide="clock" style="color: var(--color-warning, #f59e0b); width: 18px; height: 18px;"></i>
          Cita próxima sin confirmar
        </h3>
        <button class="apt-modal-close" id="alert-modal-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="apt-modal-body" style="display: flex; flex-direction: column; gap: var(--space-4); max-height: 65vh; overflow-y: auto;">
        
        <!-- Detalles de la cita -->
        <div style="background: rgba(255,255,255,0.02); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border-soft); display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2);">
            <div>
              <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; display: block; letter-spacing: 0.05em;">Cliente</span>
              <strong style="font-size: var(--text-sm); color: var(--text-primary);">${apt.client}</strong>
            </div>
            <div>
              <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; display: block; letter-spacing: 0.05em;">Teléfono</span>
              <strong style="font-size: var(--text-sm); color: var(--text-primary);">${apt.phone || 'Sin número'}</strong>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2); border-top: 1px dashed var(--border-soft); padding-top: var(--space-2); margin-top: 2px;">
            <div>
              <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; display: block; letter-spacing: 0.05em;">Fecha y Hora</span>
              <strong style="font-size: var(--text-sm); color: var(--text-primary);">${apt.date} a las ${apt.time}</strong>
            </div>
            <div>
              <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; display: block; letter-spacing: 0.05em;">Profesional</span>
              <strong style="font-size: var(--text-sm); color: var(--text-primary);">${apt.prof}</strong>
            </div>
          </div>
          <div style="border-top: 1px dashed var(--border-soft); padding-top: var(--space-2); margin-top: 2px;">
            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 800; display: block; letter-spacing: 0.05em;">Servicio</span>
            <strong style="font-size: var(--text-sm); color: var(--text-primary);">${apt.service}</strong>
          </div>
        </div>

        <!-- Selector de Plantilla -->
        <div class="form-group">
          <label class="form-label" for="alert-template-select">Seleccionar Plantilla de WhatsApp</label>
          ${templates.length === 0 ? `
            <select id="alert-template-select" class="form-input" style="width: 100%;" disabled>
              <option value="" disabled selected>No hay plantillas configuradas</option>
            </select>
          ` : `
            <select id="alert-template-select" class="form-input" style="width: 100%;">
              <option value="" disabled selected>-- Elige una plantilla --</option>
              ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          `}
        </div>

        <!-- Vista Previa (Simulación WhatsApp - Solo lectura) -->
        <div class="form-group" id="alert-preview-group" style="display: none; transition: all 0.2s;">
          <label class="form-label">Vista Previa del Mensaje</label>
          <div class="whatsapp-preview-container">
            <div class="whatsapp-preview-bubble" id="alert-preview-bubble"></div>
            <span class="whatsapp-preview-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

      </div>

      <div class="apt-modal-footer" style="display: flex; gap: var(--space-3); justify-content: space-between; border-top: 1px solid var(--border-soft); padding-top: var(--space-3); width: 100%;">
        <button class="btn btn-secondary" id="alert-discard-btn" style="
          color: var(--color-danger, #ef4444); 
          border-color: rgba(239, 68, 68, 0.2); 
          background: rgba(239, 68, 68, 0.02);
          height: 40px;
          padding-inline: var(--space-4);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
        ">
          <i data-lucide="trash-2" size="14"></i>
          Descartar alerta
        </button>
        <button class="btn btn-primary" id="alert-send-btn" disabled style="
          display: inline-flex; 
          align-items: center; 
          justify-content: center;
          gap: var(--space-2); 
          background: var(--color-success, #10b981); 
          border-color: var(--color-success, #10b981); 
          opacity: 0.6; 
          cursor: not-allowed;
          height: 40px;
          padding-inline: var(--space-4);
        ">
          <i data-lucide="send" size="14"></i>
          Enviar por WhatsApp
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Forzar reflow para animación
  root.offsetHeight;
  root.classList.add('open');

  // Inicializar Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: root });
  }

  const closeBtn = root.querySelector('#alert-modal-close-btn');
  const discardBtn = root.querySelector('#alert-discard-btn');
  const sendBtn = root.querySelector('#alert-send-btn');
  const selectTemplate = root.querySelector('#alert-template-select');
  const previewGroup = root.querySelector('#alert-preview-group');
  const previewBubble = root.querySelector('#alert-preview-bubble');

  const destroy = () => {
    root.classList.remove('open');
    setTimeout(() => {
      root.remove();
    }, 300);
  };

  let resolvedMessageText = '';

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
      resolvedMessageText = replaceTemplateVariables(templateObj.content, { name: apt.client, phone: apt.phone }, business, apt);
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

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (!resolvedMessageText.trim()) return;

      let phoneNum = (apt.phone || '').replace(/[^\d+]/g, '');

      if (phoneNum.length === 10 && !phoneNum.startsWith('+')) {
        phoneNum = '+57' + phoneNum;
      }

      const encodedText = encodeURIComponent(resolvedMessageText);
      const waUrl = `https://wa.me/${phoneNum}?text=${encodedText}`;

      window.open(waUrl, '_blank');
      destroy();
    });
  }

  if (discardBtn) {
    discardBtn.addEventListener('click', async () => {
      discardBtn.disabled = true;
      discardBtn.textContent = 'Descartando...';
      try {
        const { error } = await supabase
          .from('appointments')
          .update({ alert_dismissed: true })
          .eq('id', apt.id);

        if (error) throw error;

        showToast({
          title: 'Alerta descartada',
          subtitle: 'La alerta ha sido desactivada.',
          type: 'success'
        });

        destroy();
        if (onDismiss) onDismiss(apt.id);
      } catch (err) {
        console.error('[alert-confirmation-modal] Error discarding alert:', err);
        discardBtn.disabled = false;
        discardBtn.innerHTML = `<i data-lucide="trash-2" size="14"></i> Descartar alerta`;
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: discardBtn });
        showToast({
          title: 'Error al descartar',
          subtitle: err.message,
          type: 'error'
        });
      }
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', destroy);
  root.addEventListener('click', (e) => {
    if (e.target === root) destroy();
  });
}
