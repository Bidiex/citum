// src/components/modal-inventario.js
import { supabase } from '../core/supabase.js';
import { showToast } from '../utils/toast.js';
import { getActiveBusinessId } from '../utils/businessState.js';

/**
 * Abre el modal para crear o editar un producto de inventario.
 */
export function openProductModal({ mode = 'create', productData = null, onSave = null } = {}) {
  const existing = document.getElementById('prod-drawer-root');
  if (existing) existing.remove();

  // Valores iniciales
  const name = productData?.name || '';
  const brand = productData?.brand || '';
  const unitType = productData?.unit_type || 'unit';
  const unitLabel = productData?.unit_label || '';
  const stockCurrent = productData?.stock_current || 0;
  const stockMinimum = productData?.stock_minimum || 0;
  const stockIdeal = productData?.stock_ideal || '';
  const costPerUnit = productData?.cost_per_unit || '';
  const isActive = productData ? (productData.is_active !== false) : true;
  const isSellable = productData?.is_sellable ?? false;
  const salePrice = productData?.sale_price ?? '';

  const root = document.createElement('div');
  root.id = 'prod-drawer-root';
  root.className = 'biz-drawer-overlay';

  root.innerHTML = `
    <div class="biz-drawer" role="dialog" aria-modal="true">
      <div class="biz-drawer-header">
        <h2>${mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}</h2>
        <button class="biz-drawer-close" id="prod-drawer-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="biz-drawer-body">
        <div class="form-group">
          <label for="prod-name">Nombre del producto *</label>
          <input type="text" id="prod-name" class="form-input" placeholder="Ej. Gel de Contacto / Insumo Base" value="${name}" required />
        </div>

        <div class="form-group">
          <label for="prod-brand">Marca (opcional)</label>
          <input type="text" id="prod-brand" class="form-input" placeholder="Ej. Marca Distribuidora" value="${brand}" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
          <div class="form-group">
            <label for="prod-unit-type">Tipo de Unidad *</label>
            <select id="prod-unit-type" class="form-input">
              <option value="unit" ${unitType === 'unit' ? 'selected' : ''}>Unidad entera</option>
              <option value="measurable" ${unitType === 'measurable' ? 'selected' : ''}>Cantidad medible</option>
            </select>
          </div>
          <div class="form-group" id="prod-unit-label-wrapper" style="display: ${unitType === 'measurable' ? 'block' : 'none'};">
            <label for="prod-unit-label">Unidad de Medida *</label>
            <select id="prod-unit-label" class="form-input">
              <option value="">Selecciona unidad...</option>
              <option value="ml" ${unitLabel === 'ml' ? 'selected' : ''}>ml (Mililitros)</option>
              <option value="g" ${unitLabel === 'g' ? 'selected' : ''}>g (Gramos)</option>
              <option value="L" ${unitLabel === 'L' ? 'selected' : ''}>L (Litros)</option>
              <option value="kg" ${unitLabel === 'kg' ? 'selected' : ''}>kg (Kilogramos)</option>
              <option value="oz" ${unitLabel === 'oz' ? 'selected' : ''}>oz (Onzas)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
          <div class="form-group">
            <label for="prod-stock-current">Stock Actual *</label>
            <input type="number" id="prod-stock-current" class="form-input" placeholder="0" value="${stockCurrent}" min="0" step="any" required />
          </div>
          <div class="form-group">
            <label for="prod-stock-minimum">Stock Mínimo *</label>
            <input type="number" id="prod-stock-minimum" class="form-input" placeholder="0" value="${stockMinimum}" min="0" step="any" required />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
          <div class="form-group">
            <label for="prod-stock-ideal">Stock Ideal (opcional)</label>
            <input type="number" id="prod-stock-ideal" class="form-input" placeholder="Ej. 10" value="${stockIdeal}" min="0" step="any" />
          </div>
          <div class="form-group">
            <label for="prod-cost">Costo por Unidad (COP)</label>
            <input type="number" id="prod-cost" class="form-input" placeholder="Ej. 15000" value="${costPerUnit}" min="0" step="0.01" />
          </div>
        </div>

        <!-- ¿Se vende al cliente? -->
        <div class="form-group" style="margin-top: var(--space-4);">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <label class="schedule-day-toggle">
              <input type="checkbox" id="prod-sellable" ${isSellable ? 'checked' : ''} />
              <div class="schedule-day-toggle-custom"></div>
            </label>
            <div>
              <span style="font-weight: 700; font-size: var(--text-sm); display: block; color: var(--text-primary);">Disponible para venta al cliente</span>
              <span style="display: block; font-size: 11px; color: var(--text-muted); font-weight: 400;">
                Aparecerá en el POS al momento de facturar
              </span>
            </div>
          </div>
        </div>

        <!-- Precio de venta — visible solo si is_sellable -->
        <div class="form-group" id="sale-price-group" style="display: ${isSellable ? 'block' : 'none'}; margin-top: var(--space-3);">
          <label class="form-label" for="prod-sale-price">Precio de venta al cliente *</label>
          <div style="position: relative;">
            <span style="position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted); font-weight: 700;">$</span>
            <input
              type="number"
              id="prod-sale-price"
              class="form-input"
              min="0"
              step="100"
              placeholder="0"
              value="${salePrice}"
              style="padding-left: var(--space-6);"
            />
          </div>
          <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block;">
            Diferente al costo de insumo. Este es el precio que verá el cajero en el POS.
          </span>
        </div>

        ${mode === 'edit' ? `
          <div class="form-group">
            <label for="prod-active">Estado</label>
            <select id="prod-active" class="form-input">
              <option value="true" ${isActive ? 'selected' : ''}>Activo</option>
              <option value="false" ${!isActive ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
        ` : ''}
      </div>

      <div class="biz-drawer-footer">
        <button class="btn btn-secondary" id="prod-cancel-btn" style="height: 40px; padding-inline: var(--space-4);">Cancelar</button>
        <button class="btn btn-primary" id="prod-save-btn" style="height: 40px; padding-inline: var(--space-4);">
          ${mode === 'create' ? 'Crear Producto' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons({
      attrs: { 'stroke-width': 2, 'size': 18 },
      nameAttr: 'data-lucide',
      node: root
    });
  }

  const closeBtn = root.querySelector('#prod-drawer-close-btn');
  const cancelBtn = root.querySelector('#prod-cancel-btn');
  const saveBtn = root.querySelector('#prod-save-btn');
  const nameInput = root.querySelector('#prod-name');
  const brandInput = root.querySelector('#prod-brand');
  const unitTypeSelect = root.querySelector('#prod-unit-type');
  const unitLabelSelect = root.querySelector('#prod-unit-label');
  const unitLabelWrapper = root.querySelector('#prod-unit-label-wrapper');
  const stockCurrentInput = root.querySelector('#prod-stock-current');
  const stockMinimumInput = root.querySelector('#prod-stock-minimum');
  const stockIdealInput = root.querySelector('#prod-stock-ideal');
  const costInput = root.querySelector('#prod-cost');
  const activeSelect = root.querySelector('#prod-active');
  const sellableCheckbox = root.querySelector('#prod-sellable');
  const salePriceGroup = root.querySelector('#sale-price-group');

  sellableCheckbox.addEventListener('change', () => {
    salePriceGroup.style.display = sellableCheckbox.checked ? 'block' : 'none';
  });

  unitTypeSelect.addEventListener('change', () => {
    if (unitTypeSelect.value === 'measurable') {
      unitLabelWrapper.style.display = 'block';
    } else {
      unitLabelWrapper.style.display = 'none';
      unitLabelSelect.value = '';
    }
  });

  setTimeout(() => root.classList.add('open'), 10);

  const closeDrawer = () => {
    root.classList.remove('open');
    setTimeout(() => root.remove(), 350);
  };

  closeBtn.addEventListener('click', closeDrawer);
  cancelBtn.addEventListener('click', closeDrawer);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeDrawer();
  });

  saveBtn.addEventListener('click', async () => {
    let hasError = false;
    [nameInput, unitLabelSelect, stockCurrentInput, stockMinimumInput].forEach(i => i.classList.remove('form-input-error'));

    if (!nameInput.value.trim()) {
      nameInput.classList.add('form-input-error');
      hasError = true;
    }
    if (unitTypeSelect.value === 'measurable' && !unitLabelSelect.value) {
      unitLabelSelect.classList.add('form-input-error');
      hasError = true;
    }
    const stockVal = parseFloat(stockCurrentInput.value);
    if (isNaN(stockVal) || stockVal < 0) {
      stockCurrentInput.classList.add('form-input-error');
      hasError = true;
    }
    const minVal = parseFloat(stockMinimumInput.value);
    if (isNaN(minVal) || minVal < 0) {
      stockMinimumInput.classList.add('form-input-error');
      hasError = true;
    }

    if (hasError) return;

    const isSellableVal = sellableCheckbox?.checked ?? false;
    const salePriceVal = parseFloat(root.querySelector('#prod-sale-price')?.value) || null;

    if (isSellableVal && !salePriceVal) {
      showToast({ title: 'Precio requerido', subtitle: 'Ingresa el precio de venta al cliente.', type: 'warning' });
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const businessId = getActiveBusinessId();
    const payload = {
      business_id: businessId,
      name: nameInput.value.trim(),
      brand: brandInput.value.trim() || null,
      unit_type: unitTypeSelect.value,
      unit_label: unitTypeSelect.value === 'measurable' ? unitLabelSelect.value : null,
      stock_current: stockVal,
      stock_minimum: minVal,
      stock_ideal: parseFloat(stockIdealInput.value) || null,
      cost_per_unit: parseFloat(costInput.value) || null,
      is_sellable: isSellableVal,
      sale_price: isSellableVal ? salePriceVal : null,
      is_active: activeSelect ? activeSelect.value === 'true' : true
    };

    try {
      if (mode === 'create') {
        const { error } = await supabase.from('inventory_products').insert(payload);
        if (error) throw error;
        showToast({ title: 'Producto registrado', subtitle: `"${payload.name}" agregado.`, type: 'success' });
      } else {
        const { error } = await supabase.from('inventory_products').update(payload).eq('id', productData.id);
        if (error) throw error;
        showToast({ title: 'Producto actualizado', subtitle: `"${payload.name}" guardado.`, type: 'success' });
      }

      if (onSave) onSave();
      closeDrawer();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = mode === 'create' ? 'Crear Producto' : 'Guardar Cambios';
      showToast({ title: 'Error al guardar', subtitle: err.message, type: 'error' });
    }
  });
}

/**
 * Abre el modal para registrar entrada manual de stock.
 */
export function openStockEntryModal(product, { onSave = null } = {}) {
  const existing = document.getElementById('entry-drawer-root');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = 'entry-drawer-root';
  root.className = 'biz-drawer-overlay';

  root.innerHTML = `
    <div class="biz-drawer" role="dialog" aria-modal="true" style="max-width: 450px;">
      <div class="biz-drawer-header">
        <h2>Registrar Entrada de Stock</h2>
        <button class="biz-drawer-close" id="entry-drawer-close-btn" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="biz-drawer-body">
        <div class="form-group">
          <label>Producto</label>
          <input type="text" class="form-input" value="${product.brand ? `${product.name} (${product.brand})` : product.name}" disabled style="opacity: 0.7; background: rgba(255,255,255,0.02);" />
        </div>
        <div class="form-group">
          <label for="entry-qty">Cantidad que entra *</label>
          <input type="number" id="entry-qty" class="form-input" placeholder="Ej. 10 o 250" min="0.001" step="any" required />
        </div>
        <div class="form-group">
          <label for="entry-notes">Notas (opcional)</label>
          <textarea id="entry-notes" class="form-input" placeholder="Ej. Compra mensual a proveedor" rows="3" style="resize: vertical; font-family: inherit;"></textarea>
        </div>
      </div>

      <div class="biz-drawer-footer">
        <button class="btn btn-secondary" id="entry-cancel-btn" style="height: 40px; padding-inline: var(--space-4);">Cancelar</button>
        <button class="btn btn-primary" id="entry-save-btn" style="height: 40px; padding-inline: var(--space-4);">Registrar Entrada</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons({
      attrs: { 'stroke-width': 2, 'size': 18 },
      nameAttr: 'data-lucide',
      node: root
    });
  }

  const closeBtn = root.querySelector('#entry-drawer-close-btn');
  const cancelBtn = root.querySelector('#entry-cancel-btn');
  const saveBtn = root.querySelector('#entry-save-btn');
  const qtyInput = root.querySelector('#entry-qty');
  const notesInput = root.querySelector('#entry-notes');

  setTimeout(() => root.classList.add('open'), 10);

  const closeDrawer = () => {
    root.classList.remove('open');
    setTimeout(() => root.remove(), 350);
  };

  closeBtn.addEventListener('click', closeDrawer);
  cancelBtn.addEventListener('click', closeDrawer);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeDrawer();
  });

  saveBtn.addEventListener('click', async () => {
    qtyInput.classList.remove('form-input-error');
    const qty = parseFloat(qtyInput.value);

    if (isNaN(qty) || qty <= 0) {
      qtyInput.classList.add('form-input-error');
      qtyInput.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Registrando...';

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || null;

      // 1. Insertar movimiento
      const { error: moveError } = await supabase.from('inventory_movements').insert({
        business_id: product.business_id,
        product_id: product.id,
        type: 'entrada',
        quantity: qty,
        notes: notesInput.value.trim() || null,
        created_by: userId
      });
      if (moveError) throw moveError;

      // 2. Sumar al stock del producto
      const newStock = Number(product.stock_current) + qty;
      const { error: updateError } = await supabase.from('inventory_products').update({ stock_current: newStock }).eq('id', product.id);
      if (updateError) throw updateError;

      showToast({ title: 'Entrada registrada', subtitle: `Se sumaron ${qty} unidades a "${product.name}".`, type: 'success' });
      if (onSave) onSave();
      closeDrawer();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Registrar Entrada';
      showToast({ title: 'Error al registrar', subtitle: err.message, type: 'error' });
    }
  });
}
