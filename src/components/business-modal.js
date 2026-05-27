// business-modal.js — Componente Drawer de Configuración de Negocio (Vanilla JS)
import { addBusiness, updateBusiness } from '../utils/businessState.js';

const PALETTE_COLORS = [
  // Rojos
  '#FF6B6B', '#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D',
  // Naranjas
  '#FF8C42', '#F97316', '#EA580C', '#C2410C', '#9A3412', '#7C2D12',
  // Amarillos / Lima
  '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#A3E635', '#84CC16',
  // Verdes
  '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534', '#14532D',
  // Teals / Cyan
  '#22D3EE', '#06B6D4', '#0891B2', '#0E7490', '#155E75', '#134E4A',
  // Azules
  '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A',
  // Violetas / Morados
  '#C084FC', '#A855F7', '#9333EA', '#7C3AED', '#6D28D9', '#4C1D95',
  // Rosas / Magentas
  '#F472B6', '#EC4899', '#DB2777', '#BE185D', '#9D174D', '#831843'
];

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Reemplazar espacios por -
    .replace(/[^\w\-]+/g, '')       // Remover caracteres no alfanuméricos
    .replace(/\-\-+/g, '-');        // Reemplazar múltiples - por uno solo
}

export function openBusinessModal({ mode = 'create', businessData = null, onSave = null } = {}) {
  // Asegurar que no haya otro overlay abierto
  const existing = document.getElementById('biz-drawer-root');
  if (existing) {
    existing.remove();
  }

  // Valores iniciales
  const name = businessData?.name || '';
  const slug = businessData?.slug || '';
  const phone = businessData?.phone || '';
  const address = businessData?.address || '';
  const selectedColor = businessData?.color || '#8B5CF6'; // Violeta por defecto
  let logoBase64 = businessData?.logo || '';

  // Crear contenedor principal
  const root = document.createElement('div');
  root.id = 'biz-drawer-root';
  root.className = 'biz-drawer-overlay';
  
  // Renderizar estructura base
  root.innerHTML = `
    <div class="biz-drawer" role="dialog" aria-modal="true">
      <div class="biz-drawer-header">
        <h2>${mode === 'create' ? 'Agregar Negocio' : 'Editar Ajustes'}</h2>
        <button class="biz-drawer-close" id="biz-drawer-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="biz-drawer-body">
        <!-- Campo Nombre -->
        <div class="form-group">
          <label for="biz-name">Nombre del negocio *${mode === 'edit' ? '<span class="badge-no-edit">No editable</span>' : ''}</label>
          <input 
            type="text" 
            id="biz-name" 
            class="form-input" 
            placeholder="Ej. Barbería Imperial" 
            value="${name}"
            ${mode === 'edit' ? 'readonly' : ''}
            required
          />
          ${mode === 'create' ? `
            <div class="slug-preview" id="biz-slug-container">
              Enlace público: <strong>/b/<span id="biz-slug-text">...</span></strong>
            </div>
          ` : `
            <div class="slug-preview">
              Enlace público inalterable: <strong>/b/${slug}</strong>
            </div>
          `}
        </div>

        <!-- Campo Contacto -->
        <div class="form-group">
          <label for="biz-phone">Teléfono / Contacto *</label>
          <input 
            type="tel" 
            id="biz-phone" 
            class="form-input" 
            placeholder="Ej. 3001234567" 
            value="${phone}"
            required
          />
        </div>

        <!-- Campo Dirección -->
        <div class="form-group">
          <label for="biz-address">Dirección (opcional)</label>
          <input 
            type="text" 
            id="biz-address" 
            class="form-input" 
            placeholder="Ej. Calle 72 #10-15, Bogotá" 
            value="${address}"
          />
        </div>

        <!-- Imagen / Logo -->
        <div class="form-group">
          <label>Imagen / Logo del negocio (opcional)</label>
          <div class="logo-upload-container">
            <div class="logo-preview-box" id="logo-preview">
              ${logoBase64 ? `<img src="${logoBase64}" alt="Logo preview" />` : (name ? name.charAt(0).toUpperCase() : 'B')}
            </div>
            <div class="logo-upload-actions">
              <label class="logo-upload-btn">
                <i data-lucide="upload-cloud" size="14"></i>
                Subir Imagen
                <input type="file" id="logo-file-input" accept="image/*" style="display: none;" />
              </label>
              <span class="logo-upload-hint">Formatos PNG, JPG. Máx 2MB</span>
            </div>
          </div>
        </div>

        <!-- Color del Negocio -->
        <div class="form-group colors-grid-container">
          <label>Color del negocio (Tema de reservas)</label>
          <div class="colors-grid" id="colors-grid">
            ${PALETTE_COLORS.map(color => `
              <div 
                class="color-option-dot ${color.toLowerCase() === selectedColor.toLowerCase() ? 'selected' : ''}" 
                data-color="${color}" 
                style="background-color: ${color};"
                title="${color}"
              ></div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="biz-drawer-footer">
        <button class="btn btn-secondary" id="biz-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="biz-save-btn">
          ${mode === 'create' ? 'Crear Negocio' : 'Guardar Cambios'}
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
  const closeBtn = root.querySelector('#biz-drawer-close-btn');
  const cancelBtn = root.querySelector('#biz-cancel-btn');
  const saveBtn = root.querySelector('#biz-save-btn');
  const nameInput = root.querySelector('#biz-name');
  const phoneInput = root.querySelector('#biz-phone');
  const addressInput = root.querySelector('#biz-address');
  const fileInput = root.querySelector('#logo-file-input');
  const logoPreview = root.querySelector('#logo-preview');
  const colorsGrid = root.querySelector('#colors-grid');

  let activeColor = selectedColor;

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

  // Lógica de slug en modo creación
  if (mode === 'create') {
    const slugText = root.querySelector('#biz-slug-text');
    nameInput.addEventListener('input', () => {
      const currentName = nameInput.value;
      const currentSlug = slugify(currentName);
      slugText.textContent = currentSlug || '...';
      
      // Si no hay logo subido, actualizar la inicial en el preview
      if (!logoBase64) {
        logoPreview.textContent = currentName ? currentName.charAt(0).toUpperCase() : 'B';
      }
    });
  }

  // Manejo de archivo / imagen a Base64
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('La imagen no debe superar los 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        logoBase64 = event.target.result;
        logoPreview.innerHTML = `<img src="${logoBase64}" alt="Logo preview" />`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Selección de color
  colorsGrid.addEventListener('click', (e) => {
    const dot = e.target.closest('.color-option-dot');
    if (dot) {
      colorsGrid.querySelectorAll('.color-option-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      activeColor = dot.getAttribute('data-color');
    }
  });

  // Validación y envío de formulario
  saveBtn.addEventListener('click', () => {
    let hasError = false;

    // Resetear clases de error
    nameInput.classList.remove('form-input-error');
    phoneInput.classList.remove('form-input-error');

    // Validar nombre (obligatorio)
    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }

    // Validar teléfono (obligatorio)
    if (!phoneInput.value.trim()) {
      phoneInput.classList.add('form-input-error');
      hasError = true;
    }

    if (hasError) {
      // Focus en el primer campo con error
      const firstError = root.querySelector('.form-input-error');
      if (firstError) firstError.focus();
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
      color: activeColor,
      logo: logoBase64
    };

    if (mode === 'create') {
      payload.slug = slugify(nameInput.value.trim());
      addBusiness(payload);
    } else {
      updateBusiness(businessData.id, payload);
    }

    // Ejecutar callback si existe
    if (onSave) {
      onSave();
    }

    closeDrawer();
  });
}
