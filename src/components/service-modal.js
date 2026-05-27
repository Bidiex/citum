// service-modal.js — Componente Drawer para Crear/Editar Servicios (Vanilla JS)
import { addService, updateService, deleteService, getActiveBusinessId } from '../utils/businessState.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';

export function openServiceModal({ mode = 'create', serviceData = null, onSave = null } = {}) {
  // Asegurar que no haya otro overlay abierto
  const existing = document.getElementById('srv-drawer-root');
  if (existing) {
    existing.remove();
  }

  // Valores iniciales
  const name = serviceData?.name || '';
  const price = serviceData?.price || 0;
  const duration = serviceData?.duration || 30;
  const desc = serviceData?.desc || '';
  const active = serviceData ? (serviceData.active !== false) : true;

  // Crear contenedor principal
  const root = document.createElement('div');
  root.id = 'srv-drawer-root';
  root.className = 'biz-drawer-overlay';
  
  // Renderizar estructura base
  root.innerHTML = `
    <div class="biz-drawer" role="dialog" aria-modal="true">
      <div class="biz-drawer-header">
        <h2>${mode === 'create' ? 'Crear Servicio' : 'Editar Servicio'}</h2>
        <button class="biz-drawer-close" id="srv-drawer-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="biz-drawer-body">
        <!-- Campo Nombre -->
        <div class="form-group">
          <label for="srv-name">Nombre del servicio *</label>
          <input 
            type="text" 
            id="srv-name" 
            class="form-input" 
            placeholder="Ej. Corte de Cabello Premium" 
            value="${name}"
            required
          />
        </div>

        <!-- Campo Precio y Duración -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
          <div class="form-group">
            <label for="srv-price">Precio (COP) *</label>
            <input 
              type="number" 
              id="srv-price" 
              class="form-input" 
              placeholder="35000" 
              value="${price}"
              min="0"
              required
            />
          </div>
          <div class="form-group">
            <label for="srv-duration">Duración (min) *</label>
            <input 
              type="number" 
              id="srv-duration" 
              class="form-input" 
              placeholder="40" 
              value="${duration}"
              min="5"
              step="5"
              required
            />
          </div>
        </div>

        <!-- Campo Descripción -->
        <div class="form-group">
          <label for="srv-desc">Descripción (opcional)</label>
          <textarea 
            id="srv-desc" 
            class="form-input" 
            placeholder="Ej. Lavado capilar, corte personalizado y peinado." 
            rows="3"
            style="resize: vertical; font-family: inherit;"
          >${desc}</textarea>
        </div>

        <!-- Campo Estado -->
        <div class="form-group">
          <label for="srv-active">Estado</label>
          <select id="srv-active" class="form-input">
            <option value="true" ${active ? 'selected' : ''}>Activo (Visible en reservas)</option>
            <option value="false" ${!active ? 'selected' : ''}>Inactivo (Oculto)</option>
          </select>
        </div>
      </div>

      <div class="biz-drawer-footer">
        ${mode === 'edit' && serviceData ? `
          <button class="btn btn-secondary" id="srv-delete-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.02); margin-right: auto; padding-inline: var(--space-4); height: 40px;">
            <i data-lucide="trash-2" size="14" style="margin-right: var(--space-2);"></i>
            Eliminar
          </button>
        ` : ''}
        <button class="btn btn-secondary" id="srv-cancel-btn" style="height: 40px; padding-inline: var(--space-4);">Cancelar</button>
        <button class="btn btn-primary" id="srv-save-btn" style="height: 40px; padding-inline: var(--space-4);">
          ${mode === 'create' ? 'Crear Servicio' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Inicializar Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({
      attrs: {
        'stroke-width': 2,
        'size': 18
      },
      nameAttr: 'data-lucide',
      node: root
    });
  }

  // Referencias a elementos
  const closeBtn = root.querySelector('#srv-drawer-close-btn');
  const cancelBtn = root.querySelector('#srv-cancel-btn');
  const saveBtn = root.querySelector('#srv-save-btn');
  const nameInput = root.querySelector('#srv-name');
  const priceInput = root.querySelector('#srv-price');
  const durationInput = root.querySelector('#srv-duration');
  const descInput = root.querySelector('#srv-desc');
  const activeInput = root.querySelector('#srv-active');
  const deleteBtn = root.querySelector('#srv-delete-btn');

  // Lógica de apertura con animación
  setTimeout(() => {
    root.classList.add('open');
  }, 10);

  // Cerrar modal
  const closeDrawer = () => {
    root.classList.remove('open');
    // Esperar a que termine la animación
    setTimeout(() => {
      root.remove();
    }, 350);
  };

  // Eventos de cierre
  closeBtn.addEventListener('click', closeDrawer);
  cancelBtn.addEventListener('click', closeDrawer);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeDrawer();
  });

  // Cerrar con Escape
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Eliminar servicio
  if (deleteBtn && mode === 'edit' && serviceData) {
    deleteBtn.addEventListener('click', () => {
      showConfirm({
        title: 'Eliminar Servicio',
        message: `¿Estás seguro de que deseas eliminar el servicio <strong>${serviceData.name}</strong>? Esta acción no se puede deshacer.`,
        confirmLabel: 'Sí, Eliminar',
        cancelLabel: 'Cancelar',
        confirmVariant: 'danger',
        onConfirm: () => {
          const bizId = getActiveBusinessId();
          deleteService(bizId, serviceData.id);
          showToast({
            title: 'Servicio eliminado',
            subtitle: `El servicio "${serviceData.name}" ha sido eliminado.`,
            type: 'success'
          });
          if (onSave) onSave();
          closeDrawer();
        }
      });
    });
  }

  // Validación y envío de formulario
  saveBtn.addEventListener('click', () => {
    let hasError = false;

    // Resetear clases de error
    nameInput.classList.remove('form-input-error');
    priceInput.classList.remove('form-input-error');
    durationInput.classList.remove('form-input-error');

    // Validar nombre
    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }

    // Validar precio
    const parsedPrice = parseFloat(priceInput.value);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      priceInput.classList.add('form-input-error');
      hasError = true;
    }

    // Validar duración
    const parsedDuration = parseInt(durationInput.value, 10);
    if (isNaN(parsedDuration) || parsedDuration < 5) {
      durationInput.classList.add('form-input-error');
      hasError = true;
    }

    if (hasError) {
      const firstError = root.querySelector('.form-input-error');
      if (firstError) firstError.focus();
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      price: parsedPrice,
      duration: parsedDuration,
      desc: descInput.value.trim(),
      active: activeInput.value === 'true'
    };

    const bizId = getActiveBusinessId();

    if (mode === 'create') {
      addService(bizId, payload);
      showToast({
        title: 'Servicio creado',
        subtitle: `El servicio "${payload.name}" ha sido creado con éxito.`,
        type: 'success'
      });
    } else {
      updateService(bizId, serviceData.id, payload);
      showToast({
        title: 'Servicio actualizado',
        subtitle: `El servicio "${payload.name}" ha sido actualizado con éxito.`,
        type: 'success'
      });
    }

    if (onSave) {
      onSave();
    }

    closeDrawer();
  });
}
