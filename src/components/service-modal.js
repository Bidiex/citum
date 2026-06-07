// service-modal.js — Componente Drawer para Crear/Editar Servicios (Vanilla JS)
import { addService, updateService, deleteService, getActiveBusinessId } from '../utils/businessState.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { supabase } from '../core/supabase.js';

export async function openServiceModal({ mode = 'create', serviceData = null, onSave = null } = {}) {
  // Asegurar que no haya otro overlay abierto
  const existing = document.getElementById('srv-drawer-root');
  if (existing) {
    existing.remove();
  }

  const bizId = getActiveBusinessId();

  // 1. Cargar productos de inventario activos
  let activeProducts = [];
  try {
    const { data } = await supabase
      .from('inventory_products')
      .select('*')
      .eq('business_id', bizId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    activeProducts = data || [];
  } catch (err) {
    console.error('Error al cargar productos de inventario:', err);
  }

  // 2. Cargar productos ya asociados si es edición
  let associatedProductsList = [];
  if (mode === 'edit' && serviceData) {
    try {
      const { data, error } = await supabase
        .from('service_products')
        .select(`
          *,
          inventory_products (name, brand, unit_type, unit_label)
        `)
        .eq('service_id', serviceData.id);

      if (!error && data) {
        associatedProductsList = data.map(sp => ({
          product_id: sp.product_id,
          quantity_used: Number(sp.quantity_used),
          product_name: sp.inventory_products?.brand 
            ? `${sp.inventory_products.name} (${sp.inventory_products.brand})` 
            : sp.inventory_products?.name || 'Producto eliminado',
          unit_type: sp.inventory_products?.unit_type || 'unit',
          unit_label: sp.inventory_products?.unit_label || ''
        }));
      }
    } catch (err) {
      console.error('Error al cargar consumos de productos:', err);
    }
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
            placeholder="Ej. Consulta de Diagnóstico" 
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
            placeholder="Ej. Evaluación general, diagnóstico y plan de tratamiento." 
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

        <!-- Sección Colapsable de Productos Asociados -->
        <div class="form-group" style="margin-top: var(--space-6); border-top: 1px solid var(--border-soft); padding-top: var(--space-4);">
          <div id="toggle-service-products" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
            <span style="font-weight: 700; font-size: var(--text-sm); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="chevron-right" id="arrow-service-products" style="transition: transform var(--transition-base);"></i>
              Productos que se usan en este servicio <span style="font-weight: normal; color: var(--text-secondary); font-size: var(--text-xs);">(opcional)</span>
            </span>
          </div>
          
          <div id="service-products-content" style="display: none; margin-top: var(--space-4); padding-left: 20px;">
            <!-- Tabla / Lista de productos asociados -->
            <div id="service-products-list" style="margin-bottom: var(--space-4);"></div>

            <!-- Fila para agregar producto -->
            <div style="display: grid; grid-template-columns: 2fr 1.2fr auto; gap: var(--space-2); align-items: end;">
              <div class="form-group" style="margin-bottom: 0;">
                <label for="add-sp-product" style="font-size: var(--text-xs);">Seleccionar Producto</label>
                <select id="add-sp-product" class="form-input" style="height: 36px; padding-block: 0; font-size: var(--text-xs);">
                  <option value="">Selecciona un producto...</option>
                  ${activeProducts.map(p => `
                    <option value="${p.id}" data-name="${p.name} ${p.brand ? `(${p.brand})` : ''}" data-unit-type="${p.unit_type}" data-unit-label="${p.unit_label || ''}">${p.name} ${p.brand ? `(${p.brand})` : ''}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="add-sp-qty" style="font-size: var(--text-xs);">Cantidad</label>
                <input type="number" id="add-sp-qty" class="form-input" placeholder="Cantidad" min="0.001" step="any" style="height: 36px; padding-block: 0; font-size: var(--text-xs);" />
              </div>
              <button type="button" class="btn btn-secondary" id="btn-add-sp" style="height: 36px; padding-inline: var(--space-3); font-size: var(--text-xs); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                <i data-lucide="plus" size="14"></i> Agregar
              </button>
            </div>
          </div>
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
      attrs: { 'stroke-width': 2, 'size': 18 },
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

  // Colapsable
  const toggleSP = root.querySelector('#toggle-service-products');
  const contentSP = root.querySelector('#service-products-content');
  const arrowSP = root.querySelector('#arrow-service-products');

  // Agregar insumos
  const selectSP = root.querySelector('#add-sp-product');
  const qtySP = root.querySelector('#add-sp-qty');
  const btnAddSP = root.querySelector('#btn-add-sp');

  // Lógica de apertura con animación
  setTimeout(() => {
    root.classList.add('open');
  }, 10);

  // Cerrar modal
  const closeDrawer = () => {
    root.classList.remove('open');
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

  // --- LÓGICA DE PRODUCTOS ASOCIADOS ---
  
  // Toggle del colapsable
  let isExpanded = false;
  toggleSP.addEventListener('click', () => {
    isExpanded = !isExpanded;
    contentSP.style.display = isExpanded ? 'block' : 'none';
    arrowSP.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });

  // Cambiar placeholder dinámico según unidad
  selectSP.addEventListener('change', () => {
    const selectedOpt = selectSP.options[selectSP.selectedIndex];
    if (!selectedOpt || selectSP.value === '') {
      qtySP.placeholder = 'Cantidad';
      return;
    }
    const unitType = selectedOpt.getAttribute('data-unit-type');
    const unitLabel = selectedOpt.getAttribute('data-unit-label');

    if (unitType === 'unit') {
      qtySP.placeholder = 'Cantidad';
    } else {
      qtySP.placeholder = `Cantidad en ${unitLabel}`;
    }
  });

  // Renderizar tabla
  const renderAssociatedProducts = () => {
    const listContainer = root.querySelector('#service-products-list');
    if (!listContainer) return;

    if (associatedProductsList.length === 0) {
      listContainer.innerHTML = `<p style="font-size: var(--text-xs); color: var(--text-muted); font-style: italic; margin: 0; padding-block: var(--space-2);">No hay productos asociados a este servicio todavía.</p>`;
      return;
    }

    listContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: var(--text-xs); margin-bottom: var(--space-2);">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-soft); text-align: left; color: var(--text-muted);">
            <th style="padding-bottom: var(--space-1); font-weight: 700;">Producto</th>
            <th style="padding-bottom: var(--space-1); font-weight: 700;">Cantidad</th>
            <th style="padding-bottom: var(--space-1); text-align: right; font-weight: 700;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${associatedProductsList.map((ap, idx) => {
            const formattedQty = ap.quantity_used % 1 === 0 
              ? ap.quantity_used.toFixed(0) 
              : ap.quantity_used.toFixed(1);
            
            const unitText = ap.unit_type === 'unit' ? 'und' : ap.unit_label || '';

            return `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.02);">
                <td style="padding-block: var(--space-2); font-weight: 600; color: var(--text-primary);">${ap.product_name}</td>
                <td style="padding-block: var(--space-2); color: var(--text-secondary);">${formattedQty} ${unitText}</td>
                <td style="padding-block: var(--space-2); text-align: right;">
                  <button type="button" class="btn-remove-sp" data-index="${idx}" style="background: none; border: none; color: #ff5a7a; cursor: pointer; padding: var(--space-1);">
                    <i data-lucide="trash-2" size="14"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: listContainer });
    }

    listContainer.querySelectorAll('.btn-remove-sp').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'), 10);
        associatedProductsList.splice(index, 1);
        renderAssociatedProducts();
      });
    });
  };

  // Agregar producto a la lista
  btnAddSP.addEventListener('click', () => {
    const productId = selectSP.value;
    const qtyVal = parseFloat(qtySP.value);

    selectSP.classList.remove('form-input-error');
    qtySP.classList.remove('form-input-error');

    if (!productId) {
      selectSP.classList.add('form-input-error');
      selectSP.focus();
      return;
    }

    if (isNaN(qtyVal) || qtyVal <= 0) {
      qtySP.classList.add('form-input-error');
      qtySP.focus();
      return;
    }

    // Verificar si ya está en la lista
    const alreadyExists = associatedProductsList.some(ap => ap.product_id === productId);
    if (alreadyExists) {
      showToast({
        title: 'Producto duplicado',
        subtitle: 'El producto ya está en la lista de consumos.',
        type: 'warning'
      });
      return;
    }

    const selectedOpt = selectSP.options[selectSP.selectedIndex];
    const name = selectedOpt.getAttribute('data-name');
    const unitType = selectedOpt.getAttribute('data-unit-type');
    const unitLabel = selectedOpt.getAttribute('data-unit-label');

    associatedProductsList.push({
      product_id: productId,
      quantity_used: qtyVal,
      product_name: name,
      unit_type: unitType,
      unit_label: unitLabel
    });

    // Resetear formulario de inserción
    selectSP.value = '';
    qtySP.value = '';
    qtySP.placeholder = 'Cantidad';

    renderAssociatedProducts();
  });

  // Render inicial de la lista
  renderAssociatedProducts();

  // Eliminar servicio
  if (deleteBtn && mode === 'edit' && serviceData) {
    deleteBtn.addEventListener('click', () => {
      showConfirm({
        title: 'Eliminar Servicio',
        message: `¿Estás seguro de que deseas eliminar el servicio <strong>${serviceData.name}</strong>? Esta acción no se puede deshacer.`,
        confirmLabel: 'Sí, Eliminar',
        cancelLabel: 'Cancelar',
        confirmVariant: 'danger',
        onConfirm: async () => {
          try {
            await deleteService(bizId, serviceData.id);
            showToast({
              title: 'Servicio eliminado',
              subtitle: `El servicio "${serviceData.name}" ha sido eliminado.`,
              type: 'success'
            });
            if (onSave) onSave();
            closeDrawer();
          } catch (err) {
            showToast({ title: 'Error al eliminar', subtitle: err.message, type: 'error' });
          }
        }
      });
    });
  }

  // Validación y envío de formulario
  saveBtn.addEventListener('click', async () => {
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

    // Deshabilitar botón durante guardado
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      let savedService;

      if (mode === 'create') {
        savedService = await addService(bizId, payload);
      } else {
        savedService = await updateService(bizId, serviceData.id, payload);
      }

      const serviceId = savedService.id;

      // --- SINCRONIZAR PRODUCTOS DEL SERVICIO ---
      
      // 1. Borrar asociaciones anteriores
      const { error: delError } = await supabase
        .from('service_products')
        .delete()
        .eq('service_id', serviceId);

      if (delError) throw delError;

      // 2. Insertar las nuevas asociaciones (si hay en la lista)
      if (associatedProductsList.length > 0) {
        const insertPayload = associatedProductsList.map(ap => ({
          service_id: serviceId,
          product_id: ap.product_id,
          quantity_used: ap.quantity_used
        }));

        const { error: insError } = await supabase
          .from('service_products')
          .insert(insertPayload);

        if (insError) throw insError;
      }

      showToast({
        title: mode === 'create' ? 'Servicio creado' : 'Servicio actualizado',
        subtitle: `El servicio "${payload.name}" ha sido guardado con éxito.`,
        type: 'success'
      });

      if (onSave) onSave();
      closeDrawer();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = mode === 'create' ? 'Crear Servicio' : 'Guardar Cambios';
      showToast({ title: 'Error al guardar', subtitle: err.message || 'Intenta de nuevo', type: 'error' });
    }
  });
}
