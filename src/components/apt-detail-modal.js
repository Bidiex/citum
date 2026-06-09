import { showConfirm } from '../utils/confirm.js';
import { showToast } from '../utils/toast.js';
import { getServices, getActiveBusinessId } from '../utils/businessState.js';
import { supabase } from '../core/supabase.js';
import { openWhatsAppModal } from './whatsapp-modal.js';

// Helper para formatear fecha en español
function formatDateSpanish(dateStr) {
  if (!dateStr) return '';
  // Se concatena T00:00:00 para evitar desajustes de zona horaria local
  const dateObj = new Date(dateStr + 'T00:00:00');
  if (isNaN(dateObj.getTime())) return dateStr;
  
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  let formatted = dateObj.toLocaleDateString('es-ES', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Helper para estilos del badge según estado
function getStatusBadgeStyle(status) {
  switch (status) {
    case 'pendiente':
      return {
        bg: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        dot: 'var(--text-muted)'
      };
    case 'confirmada':
      return {
        bg: 'rgba(139, 92, 255, 0.08)',
        color: 'var(--accent-neon)',
        dot: 'var(--accent-neon)'
      };
    case 'completada':
      return {
        bg: 'rgba(16, 185, 129, 0.08)',
        color: 'var(--color-success)',
        dot: 'var(--color-success)'
      };
    case 'facturada':
      return {
        bg: 'rgba(139, 92, 255, 0.12)',
        color: 'var(--accent-neon)',
        dot: 'var(--accent-neon)'
      };
    case 'cancelada':
    case 'no_asistio':
    default:
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        color: 'var(--color-danger)',
        dot: 'var(--color-danger)'
      };
  }
}

// Modal personalizado para solicitar motivo de cancelación (UI premium)
function showCancellationReasonModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'apt-modal-overlay';
    overlay.style.zIndex = '1100';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 200ms ease';
    
    overlay.innerHTML = `
      <div class="apt-modal" style="max-width: 380px; padding: var(--space-6); transform: scale(0.95); opacity: 0; transition: all 200ms ease;">
        <h3 style="margin-bottom: var(--space-3); font-size: var(--text-base); font-weight: 800;">Motivo de Cancelación</h3>
        <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-4);">
          Por favor, indica la razón por la cual se cancela esta cita (opcional):
        </p>
        <textarea id="cancellation-reason-input" placeholder="Ej. El cliente llamó para cancelar, cambio de planes..." style="
          width: 100%;
          height: 80px;
          background: var(--bg-primary);
          border: 1px solid var(--border-soft);
          border-radius: var(--radius-sm);
          padding: var(--space-2) var(--space-3);
          color: var(--text-primary);
          font-size: var(--text-xs);
          resize: none;
          margin-bottom: var(--space-4);
          outline: none;
        "></textarea>
        <div style="display: flex; justify-content: flex-end; gap: var(--space-2);">
          <button class="btn btn-secondary" id="cancel-reason-btn" style="height: 36px; font-size: var(--text-xs);">Cancelar</button>
          <button class="btn btn-primary" id="confirm-reason-btn" style="height: 36px; font-size: var(--text-xs); background: var(--color-danger); border-color: var(--color-danger);">Confirmar Cancelación</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    const modal = overlay.querySelector('.apt-modal');
    
    setTimeout(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1)';
      modal.style.opacity = '1';
      overlay.querySelector('#cancellation-reason-input').focus();
    }, 10);
    
    const close = (result) => {
      modal.style.transform = 'scale(0.95)';
      modal.style.opacity = '0';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };
    
    overlay.querySelector('#cancel-reason-btn').addEventListener('click', () => close({ confirmed: false }));
    overlay.querySelector('#confirm-reason-btn').addEventListener('click', () => {
      const reason = overlay.querySelector('#cancellation-reason-input').value.trim();
      close({ confirmed: true, reason });
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close({ confirmed: false });
    });
  });
}

export async function openAptDetailModal({ apt, onEdit = null, onDelete = null, onUpdate = null }) {
  if (!apt) return;

  const bizId = getActiveBusinessId();
  const services = await getServices(bizId);
  const SERVICE_PRICES = {};
  services.forEach(s => {
    SERVICE_PRICES[s.name] = s.price;
  });

  // Evitar duplicados
  const existing = document.getElementById('apt-detail-root');
  if (existing) {
    existing.remove();
  }

  const root = document.createElement('div');
  root.id = 'apt-detail-root';
  root.className = 'apt-modal-overlay'; // Reutiliza los estilos premium del overlay

  // Desglosar servicios si vienen en cadena con '+'
  const servicesList = apt.service ? apt.service.split(' + ').map(s => s.trim()) : [];
  
  // Calcular precio total si no está especificado
  let total = apt.totalPrice;
  if (total === undefined || total === null) {
    total = servicesList.reduce((sum, s) => sum + (SERVICE_PRICES[s] || 0), 0);
  }

  // Estilos del Badge de Estado
  const statusStyle = getStatusBadgeStyle(apt.status);

  // 1. Configuración del Pipeline de Estados
  const pipelineStates = [
    { key: 'pendiente', label: 'Pendiente' },
    { key: 'confirmada', label: 'Confirmada' },
    { key: 'completada', label: 'Completada' },
    { key: 'facturada', label: 'Facturada' }
  ];
  const statusKeys = pipelineStates.map(s => s.key);
  let activeIndex = statusKeys.indexOf(apt.status);
  if (activeIndex === -1) {
    // Si está cancelada o no asistió, congelamos la barra en el estado previo
    activeIndex = apt.completed_at ? 2 : 1; 
  }
  const progressPct = (activeIndex / (pipelineStates.length - 1)) * 100;

  const pipelineHtml = `
    <div class="state-pipeline-container" style="margin-bottom: var(--space-6);">
      <div class="state-pipeline" style="display: flex; align-items: center; justify-content: space-between; position: relative; padding-inline: var(--space-2); margin-bottom: 8px;">
        <!-- Línea de fondo -->
        <div style="position: absolute; top: 12px; left: 8px; right: 8px; height: 3px; background: var(--border-soft); z-index: 1; border-radius: var(--radius-pill);"></div>
        <!-- Línea completada -->
        <div style="position: absolute; top: 12px; left: 8px; width: calc(${progressPct}% - 16px); height: 3px; background: var(--color-success); z-index: 1; transition: width 0.3s ease; border-radius: var(--radius-pill);"></div>
        
        ${pipelineStates.map((state, index) => {
          let circleStyle = '';
          let textStyle = 'font-size: 11px; font-weight: 700; margin-top: 6px; transition: color 0.3s ease;';
          let iconHtml = '';

          if (index < activeIndex) {
            // Estado anterior
            circleStyle = 'background: var(--color-success); border-color: var(--color-success); color: white;';
            textStyle += 'color: var(--color-success);';
            iconHtml = '<i data-lucide="check" size="12" style="stroke-width: 3;"></i>';
          } else if (index === activeIndex) {
            // Estado actual
            circleStyle = 'background: var(--color-primary); border-color: var(--color-primary); color: white; box-shadow: 0 0 10px rgba(139, 92, 255, 0.4);';
            textStyle += 'color: var(--color-primary); font-weight: 800;';
            iconHtml = `<span style="width: 6px; height: 6px; border-radius: 50%; background: white;"></span>`;
          } else {
            // Estado futuro
            circleStyle = 'background: var(--bg-card); border-color: var(--border-soft); color: var(--text-muted);';
            textStyle += 'color: var(--text-muted);';
            iconHtml = '';
          }

          return `
            <div class="pipeline-step" style="display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2; flex: 1;">
              <div class="pipeline-circle" style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; ${circleStyle}">
                ${iconHtml}
              </div>
              <span style="${textStyle}">${state.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Banner especial para estados cancelados o inasistencias
  let cancellationBannerHtml = '';
  if (apt.status === 'cancelada' || apt.status === 'no_asistio') {
    cancellationBannerHtml = `
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); display: flex; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-4);">
        <i data-lucide="x" style="color: var(--color-danger); flex-shrink: 0; margin-top: 2px;"></i>
        <div style="display: flex; flex-direction: column;">
          <span style="color: var(--color-danger); font-size: var(--text-sm); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
            ${apt.status === 'cancelada' ? 'Cita Cancelada' : 'No Asistió'}
          </span>
          ${apt.status === 'cancelada' && apt.cancellation_reason ? `
            <span style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; font-style: italic;">
              Motivo: "${apt.cancellation_reason}"
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 2. Botones de acción dinámicos según estado
  let actionsHtml = '';
  if (apt.status === 'pendiente') {
    actionsHtml = `
      <div class="apt-modal-section" id="apt-actions-section" style="border-top: 1px solid var(--border-soft); padding-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2.5);">
        <button class="btn btn-primary" id="btn-action-confirm" style="width: 100%; height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-weight: 700;">
          <i data-lucide="check" size="14"></i>
          Confirmar asistencia
        </button>
        <div style="display: flex; gap: var(--space-3); width: 100%;">
          <button class="btn btn-secondary" id="btn-action-no-show" style="flex: 1; height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); border-color: var(--border-soft);">
            <i data-lucide="clock" size="14"></i>
            No asistió
          </button>
          <button class="btn btn-secondary" id="btn-action-cancel" style="flex: 1; height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.01);">
            <i data-lucide="x" size="14"></i>
            Cancelar cita
          </button>
        </div>
      </div>
    `;
  } else if (apt.status === 'confirmada') {
    actionsHtml = `
      <div class="apt-modal-section" id="apt-actions-section" style="border-top: 1px solid var(--border-soft); padding-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2.5);">
        <button class="btn btn-primary" id="btn-action-complete" style="width: 100%; height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-weight: 700; background: var(--color-success); border-color: var(--color-success);">
          <i data-lucide="check" size="14"></i>
          Marcar como completada
        </button>
        <div style="display: flex; gap: var(--space-3); width: 100%;">
          <button class="btn btn-secondary" id="btn-action-no-show" style="flex: 1; height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); border-color: var(--border-soft);">
            <i data-lucide="clock" size="14"></i>
            No asistió
          </button>
          <button class="btn btn-secondary" id="btn-action-cancel" style="flex: 1; height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.01);">
            <i data-lucide="x" size="14"></i>
            Cancelar cita
          </button>
        </div>
      </div>
    `;
  } else if (apt.status === 'completada') {
    actionsHtml = `
      <div class="apt-modal-section" id="apt-actions-section" style="border-top: 1px solid var(--border-soft); padding-top: var(--space-4);">
        <button class="btn btn-primary" id="btn-action-invoice" style="width: 100%; height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-weight: 800; background: var(--grad-cta); box-shadow: 0 4px 12px rgba(139, 92, 255, 0.2);">
          Ir a Facturación
          <i data-lucide="arrow-right" size="14"></i>
        </button>
      </div>
    `;
  }

  const isReadOnly = ['facturada', 'cancelada', 'no_asistio'].includes(apt.status);

  // Footer condicional (solo visible si no es de solo lectura)
  let footerHtml = '';
  if (!isReadOnly) {
    footerHtml = `
      <div class="apt-modal-footer" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <button class="btn btn-secondary" id="apt-detail-delete-btn" style="
          color: #ef4444; 
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
          Eliminar Cita
        </button>
        <button class="btn btn-primary" id="apt-detail-edit-btn" style="
          height: 40px;
          padding-inline: var(--space-4);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
        ">
          <i data-lucide="edit-3" size="14"></i>
          Editar Cita
        </button>
      </div>
    `;
  }

  // 3. Lógica de transición de estados
  const transicionarEstado = async (nuevoEstado, metadata = {}) => {
    try {
      if (nuevoEstado === 'facturada') {
        navegarAFacturacion(apt);
        closeModal();
        return;
      }

      const updateData = { status: nuevoEstado };
      if (nuevoEstado === 'completada') {
        updateData.completed_at = new Date().toISOString();
      } else if (nuevoEstado === 'cancelada') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = metadata.reason || null;
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', apt.id);

      if (error) throw error;

      // Actualizar objeto apt localmente
      apt.status = nuevoEstado;
      if (nuevoEstado === 'completada') {
        apt.completed_at = updateData.completed_at;
      } else if (nuevoEstado === 'cancelada') {
        apt.cancelled_at = updateData.cancelled_at;
        apt.cancellation_reason = updateData.cancellation_reason;
      }

      // Disparar evento global para recargar appointments en agenda y CRM
      const bizId = getActiveBusinessId();
      window.dispatchEvent(new CustomEvent('citum_appointments_changed', { detail: { businessId: bizId } }));

      // Notificar al calendario para actualizar UI instantáneamente
      if (onUpdate) {
        await onUpdate(apt);
      }

      showToast({
        title: 'Estado actualizado',
        subtitle: `La cita ahora está en estado "${nuevoEstado}".`,
        type: 'success'
      });

      // Re-renderizar este mismo modal
      openAptDetailModal({ apt, onEdit, onDelete, onUpdate });

    } catch (err) {
      console.error('[transicionarEstado] Error:', err);
      showToast({
        title: 'Error al actualizar estado',
        subtitle: err.message,
        type: 'error'
      });
    }
  };

  // 4. Función navegarAFacturacion
  const navegarAFacturacion = (appointment) => {
    window.pendingInvoiceContext = appointment;
    const navItem = document.querySelector('.sidebar-item[data-section="facturacion"]');
    if (navItem) {
      navItem.click();
    }
  };

  root.innerHTML = `
    <div class="apt-modal" role="dialog" aria-modal="true" style="max-width: 480px;">
      <div class="apt-modal-header">
        <h2>
          <i data-lucide="calendar" style="color: var(--accent-neon);"></i>
          Detalles de la Cita
        </h2>
        <button class="apt-modal-close" id="apt-detail-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>
 
      <div class="apt-modal-body">
        <!-- 📈 Pipeline de Estados -->
        ${pipelineHtml}
        ${cancellationBannerHtml}

        <!-- 👤 Cliente — nombre + contacto en una sola fila -->
        <div class="apt-modal-section">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap;">
            <!-- Nombre -->
            <div style="display: flex; align-items: center; gap: var(--space-2); min-width: 0;">
              <i data-lucide="user" size="14" style="stroke-width: 2.5; color: var(--accent-neon); flex-shrink: 0;"></i>
              <span style="font-size: var(--text-base); font-weight: 900; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${apt.client}</span>
            </div>
            <!-- Contacto -->
            <div style="display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0;">
              ${apt.phone ? `
                <a href="tel:${apt.phone}" style="display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); text-decoration: none; font-size: var(--text-xs); font-weight: 600; transition: color 0.15s;" onmouseover="this.style.color='var(--accent-neon)'" onmouseout="this.style.color='var(--text-secondary)'">
                  <i data-lucide="phone" size="12"></i> ${apt.phone}
                </a>
                <span style="color: var(--border-soft); font-size: 12px;">|</span>
                <button id="btn-wa-notify" style="background: none; border: none; padding: 0; color: var(--color-success, #10b981); font-weight: 700; cursor: pointer; font-size: var(--text-xs); display: inline-flex; align-items: center; gap: 4px; transition: opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                  <i data-lucide="message-circle" size="12"></i>
                  Notificar
                </button>
              ` : ''}
              ${apt.phone && apt.email ? `<span style="color: var(--border-soft); font-size: 12px;">|</span>` : ''}
              ${apt.email ? `
                <a href="mailto:${apt.email}" style="display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); text-decoration: none; font-size: var(--text-xs); font-weight: 600; transition: color 0.15s;" onmouseover="this.style.color='var(--accent-neon)'" onmouseout="this.style.color='var(--text-secondary)'">
                  <i data-lucide="mail" size="12"></i> ${apt.email}
                </a>
              ` : ''}
            </div>
          </div>
        </div>
 
        <!-- 📋 Información de la Cita -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title" style="margin-bottom: var(--space-3);">
            <i data-lucide="info" size="12"></i>
            Información de la Cita
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0;">
            <!-- Fila: Profesional + Estado -->
            <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--border-soft);">
              <div style="display: flex; align-items: center; gap: var(--space-2); flex: 1; min-width: 0;">
                <i data-lucide="user" size="12" style="color: var(--text-muted); flex-shrink: 0;"></i>
                <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: var(--text-muted); letter-spacing: 0.06em; flex-shrink: 0;">Profesional</span>
                <span style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); margin-left: auto; text-align: right;">${apt.prof}</span>
              </div>
              <div style="width: 1px; height: 16px; background: var(--border-soft); flex-shrink: 0;"></div>
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <i data-lucide="tag" size="12" style="color: var(--text-muted); flex-shrink: 0;"></i>
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  padding: 2px 8px;
                  border-radius: var(--radius-pill);
                  font-size: 10px;
                  font-weight: 700;
                  text-transform: capitalize;
                  border: 1px solid var(--border-soft);
                  background: ${statusStyle.bg};
                  color: ${statusStyle.color};
                ">
                  <span style="width: 5px; height: 5px; border-radius: 50%; display: inline-block; background: ${statusStyle.dot};"></span>
                  ${apt.status || 'confirmada'}
                </span>
              </div>
            </div>

            <!-- Fila: Fecha y Hora -->
            <div style="display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0;">
              <i data-lucide="clock" size="12" style="color: var(--text-muted); flex-shrink: 0;"></i>
              <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: var(--text-muted); letter-spacing: 0.06em; flex-shrink: 0;">Fecha y Hora</span>
              <span style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); margin-left: auto;">${formatDateSpanish(apt.date)} — ${apt.time}</span>
            </div>
          </div>
        </div>
 
        <!-- ✂️ Desglose de servicios -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title" style="margin-bottom: var(--space-3);">
            <i data-lucide="briefcase" size="12"></i>
            Servicios Contratados
          </div>
          <div style="
            background: var(--bg-primary); 
            border: 1px solid var(--border-soft); 
            border-radius: var(--radius-sm); 
            padding: var(--space-3);
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          ">
            ${servicesList.map(srv => {
              const price = SERVICE_PRICES[srv] || 0;
              return `
                <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); align-items: center;">
                  <span style="display: inline-flex; align-items: center; gap: 5px;">
                    <i data-lucide="chevron-right" style="width: 12px; height: 12px; stroke-width: 2.5; color: var(--accent-neon);"></i>
                    ${srv}
                  </span>
                  <span style="color: var(--accent-neon); font-weight: 800;">${price > 0 ? `$${price.toLocaleString('es-CO')}` : 'Consultar'}</span>
                </div>
              `;
            }).join('')}
            
            <div style="
              display: flex; 
              justify-content: space-between; 
              margin-top: var(--space-1); 
              padding-top: var(--space-2); 
              border-top: 1px solid var(--border-soft); 
              font-size: var(--text-xs); 
              font-weight: 800; 
              color: var(--text-primary);
            ">
              <span>Total Estimado</span>
              <span style="color: var(--accent-neon); font-weight: 900; font-size: var(--text-sm);">$${total.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>
 
        <!-- 📝 Notas internas -->
        ${apt.notes ? `
          <div class="apt-modal-section">
            <div class="apt-modal-section-title" style="margin-bottom: var(--space-3);">
              <i data-lucide="file-text" size="12"></i>
              Notas del Personal
            </div>
            <div style="
              background: var(--bg-primary);
              border-left: 3px solid var(--accent-neon);
              padding: var(--space-2) var(--space-3);
              font-size: var(--text-xs);
              color: var(--text-secondary);
              line-height: 1.5;
              font-style: italic;
              border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
            ">${apt.notes}</div>
          </div>
        ` : ''}

        <!-- ⚡ Acciones del Pipeline -->
        ${actionsHtml}
      </div>
      ${footerHtml}
    </div>
  `;

  document.body.appendChild(root);

  // Inicializar Lucide en este modal
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({
      attrs: {
        'stroke-width': 2.5,
        'size': 16
      },
      nameAttr: 'data-lucide',
      node: root
    });
  }

  // Animar apertura
  setTimeout(() => {
    root.classList.add('open');
  }, 10);

  // Cerrar modal
  const closeModal = () => {
    root.classList.remove('open');
    setTimeout(() => {
      root.remove();
    }, 300);
  };

  root.querySelector('#apt-detail-close-btn').addEventListener('click', closeModal);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeModal();
  });

  // Cerrar con Escape
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Botón Editar (si existe)
  const editBtn = root.querySelector('#apt-detail-edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      closeModal();
      if (onEdit) {
        onEdit(apt);
      }
    });
  }

  // Botón Eliminar (si existe)
  const deleteBtn = root.querySelector('#apt-detail-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      showConfirm({
        title: 'Eliminar Cita',
        message: `¿Estás seguro de que deseas eliminar la cita de <strong>${apt.client}</strong> para el <strong>${formatDateSpanish(apt.date)} a las ${apt.time}</strong>? Esta acción es irreversible.`,
        confirmLabel: 'Sí, Eliminar',
        cancelLabel: 'Cancelar',
        confirmVariant: 'danger',
        onConfirm: () => {
          closeModal();
          if (onDelete) {
            onDelete(apt);
          }
          showToast({
            title: 'Cita eliminada',
            subtitle: `La cita de ${apt.client} ha sido eliminada con éxito.`,
            type: 'success'
          });
        }
      });
    });
  }

  // Listeners de Acciones de Transición
  const confirmBtn = root.querySelector('#btn-action-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => transicionarEstado('confirmada'));
  }
  const completeBtn = root.querySelector('#btn-action-complete');
  if (completeBtn) {
    completeBtn.addEventListener('click', () => transicionarEstado('completada'));
  }
  const noShowBtn = root.querySelector('#btn-action-no-show');
  if (noShowBtn) {
    noShowBtn.addEventListener('click', () => transicionarEstado('no_asistio'));
  }
  const invoiceBtn = root.querySelector('#btn-action-invoice');
  if (invoiceBtn) {
    invoiceBtn.addEventListener('click', () => transicionarEstado('facturada'));
  }
  const cancelBtn = root.querySelector('#btn-action-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      const res = await showCancellationReasonModal();
      if (res.confirmed) {
        transicionarEstado('cancelada', { reason: res.reason });
      }
    });
  }

  // Botón Notificar WhatsApp
  const waNotifyBtn = root.querySelector('#btn-wa-notify');
  if (waNotifyBtn) {
    waNotifyBtn.addEventListener('click', async () => {
      if (!apt.phone) {
        showToast({
          title: 'Sin teléfono',
          subtitle: 'Esta cita no tiene registrado ningún número de contacto.',
          type: 'error'
        });
        return;
      }
      await openWhatsAppModal({
        client: {
          name: apt.client,
          phone: apt.phone
        },
        appointment: apt,
        onClose: () => {}
      });
    });
  }
}
