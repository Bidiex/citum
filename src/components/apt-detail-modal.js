import { showConfirm } from '../utils/confirm.js';
import { showToast } from '../utils/toast.js';
import { getServices, getActiveBusinessId } from '../utils/businessState.js';

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

export async function openAptDetailModal({ apt, onEdit = null, onDelete = null }) {
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
        <!-- 👤 Información del cliente (sin avatar) -->
        <div class="apt-modal-section">
          <div class="apt-detail-client-section" style="display: flex; flex-direction: column; gap: var(--space-2);">
            <div style="display: flex; align-items: center; gap: var(--space-2.5); color: var(--accent-neon);">
              <i data-lucide="user" size="18" style="stroke-width: 2.5; flex-shrink: 0;"></i>
              <span class="apt-detail-client-name" style="font-size: var(--text-xl); font-weight: 900; color: var(--text-primary); line-height: 1.2;">${apt.client}</span>
            </div>
            <div class="apt-detail-client-meta" style="font-size: var(--text-sm); color: var(--text-muted); padding-left: 28px; display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
              ${apt.phone ? `
                <a href="tel:${apt.phone}" style="display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); text-decoration: none; font-weight: 600;">
                  <i data-lucide="phone" size="14"></i> ${apt.phone}
                </a>
              ` : ''}
              ${apt.phone && apt.email ? '·' : ''}
              ${apt.email ? `
                <a href="mailto:${apt.email}" style="display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); text-decoration: none; font-weight: 600;">
                  <i data-lucide="mail" size="14"></i> ${apt.email}
                </a>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- 📋 Detalles de asignación y fecha -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="info" size="14"></i>
            Información de la Cita
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div style="display: flex; gap: var(--space-2); align-items: flex-start;">
              <div style="color: var(--accent-neon); margin-top: 2px;"><i data-lucide="user" size="14"></i></div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Profesional</span>
                <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-top: 2px;">${apt.prof}</span>
              </div>
            </div>

            <div style="display: flex; gap: var(--space-2); align-items: flex-start;">
              <div style="color: var(--accent-neon); margin-top: 2px;"><i data-lucide="tag" size="14"></i></div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Estado</span>
                <div style="margin-top: 2px;">
                  <span class="apt-detail-badge ${apt.status || 'confirmada'}" style="
                    display: inline-flex;
                    align-items: center;
                    padding: 2px 10px;
                    border-radius: var(--radius-pill);
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: capitalize;
                    border: 1px solid var(--border-soft);
                    background: ${apt.status === 'pendiente' ? 'var(--bg-secondary)' : 'rgba(139, 92, 255, 0.08)'};
                    color: ${apt.status === 'pendiente' ? 'var(--text-secondary)' : 'var(--accent-neon)'};
                  ">
                    <span style="
                      width: 6px;
                      height: 6px;
                      border-radius: 50%;
                      display: inline-block;
                      margin-right: var(--space-1);
                      background: ${apt.status === 'pendiente' ? 'var(--text-muted)' : 'var(--accent-neon)'};
                    "></span>
                    ${apt.status || 'confirmada'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: var(--space-2); align-items: flex-start; margin-top: var(--space-2);">
            <div style="color: var(--accent-neon); margin-top: 2px;"><i data-lucide="clock" size="14"></i></div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Fecha y Hora</span>
              <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-top: 2px;">${formatDateSpanish(apt.date)} a las ${apt.time}</span>
            </div>
          </div>
        </div>

        <!-- ✂️ Desglose de servicios -->
        <div class="apt-modal-section">
          <div class="apt-modal-section-title">
            <i data-lucide="scissors" size="14"></i>
            Servicios Contratados
          </div>
          <div class="apt-detail-services-box" style="
            background: var(--bg-primary); 
            border: 1px solid var(--border-soft); 
            border-radius: var(--radius-sm); 
            padding: var(--space-4);
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          ">
            ${servicesList.map(srv => {
              const price = SERVICE_PRICES[srv] || 0;
              return `
                <div class="apt-detail-service-row" style="display: flex; justify-content: space-between; font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">
                  <span>✂️ ${srv}</span>
                  <span class="apt-detail-service-price" style="color: var(--accent-neon); font-weight: 800;">${price > 0 ? `$${price.toLocaleString('es-CO')}` : 'Consultar'}</span>
                </div>
              `;
            }).join('')}
            
            <div class="apt-detail-total-row" style="
              display: flex; 
              justify-content: space-between; 
              margin-top: var(--space-2); 
              padding-top: var(--space-3); 
              border-top: 1px solid var(--border-soft); 
              font-size: var(--text-sm); 
              font-weight: 800; 
              color: var(--text-primary);
            ">
              <span>Total Estimado</span>
              <span style="color: var(--accent-neon); font-weight: 900; font-size: var(--text-base);">$${total.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>

        <!-- 📝 Notas internas -->
        ${apt.notes ? `
          <div class="apt-modal-section">
            <div class="apt-modal-section-title">
              <i data-lucide="file-text" size="14"></i>
              Notas del Personal
            </div>
            <div class="apt-detail-notes-box" style="
              background: var(--bg-primary);
              border-left: 3px solid var(--accent-neon);
              padding: var(--space-3) var(--space-4);
              font-size: var(--text-xs);
              color: var(--text-secondary);
              line-height: 1.4;
              font-style: italic;
              border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
            ">${apt.notes}</div>
          </div>
        ` : ''}
      </div>

      <div class="apt-modal-footer" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <button class="btn btn-secondary" id="apt-detail-delete-btn" style="
          color: #ef4444; 
          border-color: rgba(239, 68, 68, 0.2); 
          background: rgba(239, 68, 68, 0.02);
          height: 40px;
          padding-inline: var(--space-4);
        ">
          <i data-lucide="trash-2" size="16" style="margin-right: var(--space-2);"></i>
          Eliminar Cita
        </button>
        <button class="btn btn-primary" id="apt-detail-edit-btn" style="
          height: 40px;
          padding-inline: var(--space-4);
        ">
          <i data-lucide="edit-3" size="16" style="margin-right: var(--space-2);"></i>
          Editar Cita
        </button>
      </div>
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

  // Botón Editar
  root.querySelector('#apt-detail-edit-btn').addEventListener('click', () => {
    closeModal();
    if (onEdit) {
      onEdit(apt);
    }
  });

  // Botón Eliminar
  root.querySelector('#apt-detail-delete-btn').addEventListener('click', () => {
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
