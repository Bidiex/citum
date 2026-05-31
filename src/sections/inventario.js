// src/sections/inventario.js
import { supabase } from '../core/supabase.js';
import { getActiveBusinessId, getActiveBusiness } from '../utils/businessState.js';
import { formatStock, isLowStock } from '../utils/inventory.js';
import { openProductModal, openStockEntryModal } from '../components/modal-inventario.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { generateClientTicket } from '../utils/pdf.js';

export async function init(container) {
  const activeBusiness = window.currentBusiness || getActiveBusiness();
  const businessId = activeBusiness?.id || getActiveBusinessId();

  if (!businessId) {
    container.innerHTML = `
      <div class="view-container">
        <div class="crm-empty-state">
          <i data-lucide="store" size="48" style="stroke-width:1.5; color:var(--accent-neon);"></i>
          <h3>Sin negocio activo</h3>
          <p>Selecciona o crea un negocio primero desde la sección "Negocios".</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Carga inicial
  container.innerHTML = `
    <div class="view-container">
      <div style="display:flex; align-items:center; justify-content:center; padding: var(--space-12);">
        <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  let activeTab = 'productos';
  let products = [];
  let movements = [];
  let alerts = [];
  let movementsFilter = 'all';

  // Canales en tiempo real
  const productsChannelName = `db-inventory-products-${businessId}`;
  const alertsChannelName = `db-stock-alerts-${businessId}`;

  // Eliminar suscripciones previas si existían
  supabase.removeChannel(supabase.channel(productsChannelName));
  supabase.removeChannel(supabase.channel(alertsChannelName));

  const loadData = async () => {
    try {
      // 1. Obtener Productos
      const { data: pData } = await supabase
        .from('inventory_products')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true });
      products = pData || [];

      // 2. Obtener Movimientos con datos del producto y creador (JOIN)
      const { data: mData } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          inventory_products (name, brand, unit_type, unit_label),
          user_profiles:user_profiles!created_by (full_name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      movements = mData || [];

      // 3. Obtener Alertas de stock activo
      const { data: aData } = await supabase
        .from('stock_alerts')
        .select(`
          *,
          inventory_products (name, brand)
        `)
        .eq('business_id', businessId)
        .eq('is_read', false)
        .order('triggered_at', { ascending: false });
      alerts = aData || [];
    } catch (err) {
      console.error('[Inventario loadData] Error:', err);
    }
  };

  // 1. Renderizador de Tab 1 - Productos
  const renderTab1 = () => {
    if (products.length === 0) {
      return `
        <div class="crm-empty-state">
          <i data-lucide="package-search"></i>
          <h3>No hay productos registrados</h3>
          <p>Comienza agregando un producto al catálogo de inventario.</p>
        </div>
      `;
    }

    return `
      <div class="crm-table-wrapper">
        <div class="crm-table-container">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Stock Actual</th>
                <th>Stock Mínimo</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => {
                const lowStock = isLowStock(p);
                const rowStyle = lowStock && p.is_active ? 'background-color: rgba(239, 68, 68, 0.06);' : '';
                return `
                  <tr style="${rowStyle}" class="${p.is_active ? '' : 'inactive-product-row'}">
                    <td>
                      <div style="font-weight: 700; color: ${p.is_active ? 'var(--text-primary)' : 'var(--text-muted)'};">
                        ${p.name}
                      </div>
                    </td>
                    <td><span style="color: var(--text-secondary); font-weight: 600;">${p.brand || '—'}</span></td>
                    <td style="font-weight: 700; color: ${lowStock && p.is_active ? '#ff5a7a' : 'inherit'}">${formatStock(p)}</td>
                    <td>${p.stock_minimum % 1 === 0 ? p.stock_minimum.toFixed(0) : p.stock_minimum}</td>
                    <td>
                      ${!p.is_active 
                        ? `<span class="profile-badge" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-soft); color: var(--text-muted);">Inactivo</span>`
                        : lowStock
                          ? `<span class="profile-badge" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.25); color: #ff5a7a;">Alerta Stock</span>`
                          : `<span class="profile-badge" style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.25); color: #10b981;">OK</span>`
                      }
                    </td>
                    <td style="text-align: right;">
                      <div style="display: flex; gap: var(--space-3); justify-content: flex-end; align-items: center;">
                        <button class="btn-entry-stock" data-id="${p.id}" style="background:none; border:none; color:var(--accent-neon); font-weight:600; cursor:pointer; font-size:var(--text-xs); display:flex; align-items:center; gap:4px;">
                          <i data-lucide="plus-circle" size="14"></i> Entrada
                        </button>
                        <button class="btn-edit-product" data-id="${p.id}" style="background:none; border:none; color:var(--accent-purple); font-weight:600; cursor:pointer; font-size:var(--text-xs); display:flex; align-items:center; gap:4px;">
                          <i data-lucide="edit-3" size="14"></i> Editar
                        </button>
                        ${p.is_active ? `
                          <button class="btn-toggle-product" data-id="${p.id}" data-active="false" style="background:none; border:none; color:var(--text-muted); font-weight:600; cursor:pointer; font-size:var(--text-xs); display:flex; align-items:center; gap:4px;">
                            <i data-lucide="eye-off" size="14"></i> Desactivar
                          </button>
                        ` : `
                          <button class="btn-toggle-product" data-id="${p.id}" data-active="true" style="background:none; border:none; color:var(--accent-neon); font-weight:600; cursor:pointer; font-size:var(--text-xs); display:flex; align-items:center; gap:4px;">
                            <i data-lucide="eye" size="14"></i> Activar
                          </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // 2. Renderizador de Tab 2 - Movimientos
  const renderTab2 = () => {
    const filteredMovements = movements.filter(m => {
      if (movementsFilter === 'all') return true;
      return m.type === movementsFilter;
    });

    if (movements.length === 0) {
      return `
        <div class="crm-empty-state">
          <i data-lucide="history"></i>
          <h3>Sin movimientos registrados</h3>
          <p>Los movimientos aparecerán automáticamente al registrar entradas o descontar por servicios facturados.</p>
        </div>
      `;
    }

    const typeBadge = (type) => {
      switch (type) {
        case 'entrada':
          return `<span class="profile-badge" style="background: rgba(16,185,129,0.12); color:#10b981; border: 1px solid rgba(16,185,129,0.2);">Entrada</span>`;
        case 'descuento_servicio':
          return `<span class="profile-badge" style="background: rgba(99,102,241,0.12); color:#6366f1; border: 1px solid rgba(99,102,241,0.2);">Venta / Servicio</span>`;
        case 'ajuste_manual':
          return `<span class="profile-badge" style="background: rgba(139,92,246,0.12); color:#8b5cf6; border: 1px solid rgba(139,92,246,0.2);">Ajuste</span>`;
        case 'merma':
          return `<span class="profile-badge" style="background: rgba(239,68,68,0.12); color:#ef4444; border: 1px solid rgba(239,68,68,0.2);">Merma</span>`;
        default:
          return type;
      }
    };

    return `
      <div class="crm-table-wrapper">
        <div class="crm-table-header-row">
          <div style="display:flex; align-items:center; gap: var(--space-3);">
            <span style="font-size: var(--text-sm); font-weight:600; color:var(--text-secondary);">Filtrar por:</span>
            <select id="select-movement-filter" class="form-input" style="width: 200px; height: 36px; padding-block: 0;">
              <option value="all" ${movementsFilter === 'all' ? 'selected' : ''}>Todos los movimientos</option>
              <option value="entrada" ${movementsFilter === 'entrada' ? 'selected' : ''}>Entradas de stock</option>
              <option value="descuento_servicio" ${movementsFilter === 'descuento_servicio' ? 'selected' : ''}>Consumo por servicio</option>
              <option value="ajuste_manual" ${movementsFilter === 'ajuste_manual' ? 'selected' : ''}>Ajustes manuales</option>
              <option value="merma" ${movementsFilter === 'merma' ? 'selected' : ''}>Mermas</option>
            </select>
          </div>
        </div>
        <div class="crm-table-container">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Referencia</th>
                <th>Notas</th>
                <th>Creado Por</th>
              </tr>
            </thead>
            <tbody>
              ${filteredMovements.map(m => {
                const prod = m.inventory_products;
                const formattedDate = new Date(m.created_at).toLocaleDateString('es-CO', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                
                const val = Number(m.quantity);
                const formattedQty = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1);
                const qtyText = prod 
                  ? (prod.unit_type === 'unit' ? `${formattedQty} und` : `${formattedQty} ${prod.unit_label || ''}`)
                  : `${formattedQty}`;

                return `
                  <tr>
                    <td><span style="font-size:var(--text-xs); color:var(--text-secondary);">${formattedDate}</span></td>
                    <td style="font-weight: 700;">${prod ? `${prod.name} ${prod.brand ? `(${prod.brand})` : ''}` : 'Producto eliminado'}</td>
                    <td>${typeBadge(m.type)}</td>
                    <td style="font-weight:700;">${qtyText}</td>
                    <td>
                      ${m.reference_id 
                        ? `<button class="btn-view-invoice" data-id="${m.reference_id}" style="background:none; border:none; color:var(--accent-purple); font-weight:700; cursor:pointer; font-size:var(--text-xs); text-decoration:underline;">Ver Factura</button>` 
                        : '—'
                      }
                    </td>
                    <td><span style="font-size: var(--text-xs); color:var(--text-secondary); max-width: 200px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.notes || ''}">${m.notes || '—'}</span></td>
                    <td><span style="font-size: var(--text-xs); color: var(--text-muted); font-weight:600;">${m.user_profiles?.full_name || 'Sistema'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // 3. Renderizador de Tab 3 - Alertas
  const renderTab3 = () => {
    if (alerts.length === 0) {
      return `
        <div class="crm-empty-state" style="padding-block: var(--space-12);">
          <i data-lucide="check-circle" style="color: #10b981;"></i>
          <h3>Todo el inventario está en orden</h3>
          <p>No tienes productos por debajo del stock mínimo configurado.</p>
        </div>
      `;
    }

    return `
      <div class="crm-table-wrapper">
        <div class="crm-table-container">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock al Disparar</th>
                <th>Fecha de Alerta</th>
              </tr>
            </thead>
            <tbody>
              ${alerts.map(a => {
                const prod = a.inventory_products;
                const formattedDate = new Date(a.triggered_at).toLocaleDateString('es-CO', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                return `
                  <tr>
                    <td style="font-weight: 700; color: #ff5a7a;">
                      ${prod ? `${prod.name} ${prod.brand ? `(${prod.brand})` : ''}` : 'Producto eliminado'}
                    </td>
                    <td style="font-weight: 700; color: #ff5a7a;">
                      ${prod ? formatStock({ ...prod, stock_current: a.stock_at_trigger }) : a.stock_at_trigger}
                    </td>
                    <td><span style="font-size: var(--text-xs); color: var(--text-secondary);">${formattedDate}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // 4. Coordinador General de Renderizado
  const render = () => {
    const alertsCount = alerts.length;

    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div>
            <p class="flow-subtitle" style="margin-bottom: 0;">Administra los insumos de tu negocio, consumos automáticos y alertas de reabastecimiento.</p>
          </div>
          <div class="view-actions" id="inventario-actions">
            <!-- Cargado dinámicamente según la pestaña activa -->
          </div>
        </div>

        <!-- Subnavegación de Pestañas (Tabs) -->
        <div class="tabs-navigation" style="display:flex; gap: var(--space-4); border-bottom: 1px solid var(--border-soft); padding-bottom: var(--space-2); margin-top: var(--space-2);">
          <button class="tab-btn ${activeTab === 'productos' ? 'active' : ''}" data-tab="productos" style="background:none; border:none; color:${activeTab === 'productos' ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'productos' ? '700' : '600'}; padding-bottom:var(--space-2); border-bottom: 2px solid ${activeTab === 'productos' ? 'var(--accent-neon)' : 'transparent'}; cursor:pointer; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
            <i data-lucide="package" size="16"></i> Productos
          </button>
          <button class="tab-btn ${activeTab === 'movimientos' ? 'active' : ''}" data-tab="movimientos" style="background:none; border:none; color:${activeTab === 'movimientos' ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'movimientos' ? '700' : '600'}; padding-bottom:var(--space-2); border-bottom: 2px solid ${activeTab === 'movimientos' ? 'var(--accent-neon)' : 'transparent'}; cursor:pointer; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
            <i data-lucide="history" size="16"></i> Movimientos
          </button>
          <button class="tab-btn ${activeTab === 'alertas' ? 'active' : ''}" data-tab="alertas" style="background:none; border:none; color:${activeTab === 'alertas' ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'alertas' ? '700' : '600'}; padding-bottom:var(--space-2); border-bottom: 2px solid ${activeTab === 'alertas' ? 'var(--accent-neon)' : 'transparent'}; cursor:pointer; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
            <i data-lucide="bell" size="16"></i> Alertas
            ${alertsCount > 0 ? `<span class="alerts-count-badge" style="background: #ff5a7a; color:white; font-size:10px; font-weight:800; padding:2px 6px; border-radius:var(--radius-pill);">${alertsCount}</span>` : ''}
          </button>
        </div>

        <!-- Contenido de Tab -->
        <div id="tab-content-area">
          ${activeTab === 'productos' 
            ? renderTab1() 
            : activeTab === 'movimientos' 
              ? renderTab2() 
              : renderTab3()
          }
        </div>
      </div>
    `;

    // Renderizar botones de acción según pestaña activa
    const actionsContainer = container.querySelector('#inventario-actions');
    if (actionsContainer) {
      if (activeTab === 'productos') {
        actionsContainer.innerHTML = `
          <button class="btn btn-primary" id="btn-add-product" style="height: 40px; padding-inline: var(--space-4);">
            <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
            Nuevo Producto
          </button>
        `;
      } else if (activeTab === 'alertas' && alerts.length > 0) {
        actionsContainer.innerHTML = `
          <button class="btn btn-secondary" id="btn-read-alerts" style="height: 40px; padding-inline: var(--space-4); border-color: rgba(255,255,255,0.1);">
            <i data-lucide="check-check" size="16" style="margin-right: var(--space-2); color: #10b981;"></i>
            Marcar todas como leídas
          </button>
        `;
      } else {
        actionsContainer.innerHTML = '';
      }
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: container });
    }

    // --- ENLAZAR EVENTOS DE TABS ---
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // --- ACCIONES TAB 1 - PRODUCTOS ---
    if (activeTab === 'productos') {
      const addProdBtn = container.querySelector('#btn-add-product');
      if (addProdBtn) {
        addProdBtn.addEventListener('click', () => {
          openProductModal({ mode: 'create', onSave: async () => {
            await loadData();
            render();
          }});
        });
      }

      container.querySelectorAll('.btn-entry-stock').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const prod = products.find(p => p.id === id);
          if (prod) {
            openStockEntryModal(prod, { onSave: async () => {
              await loadData();
              render();
            }});
          }
        });
      });

      container.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const prod = products.find(p => p.id === id);
          if (prod) {
            openProductModal({ mode: 'edit', productData: prod, onSave: async () => {
              await loadData();
              render();
            }});
          }
        });
      });

      container.querySelectorAll('.btn-toggle-product').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const activeVal = btn.getAttribute('data-active') === 'true';
          const prod = products.find(p => p.id === id);
          if (!prod) return;

          showConfirm({
            title: activeVal ? 'Activar Producto' : 'Desactivar Producto',
            message: `¿Estás seguro de que deseas ${activeVal ? 'activar' : 'desactivar'} el producto <strong>${prod.name}</strong>?`,
            confirmLabel: activeVal ? 'Sí, Activar' : 'Sí, Desactivar',
            cancelLabel: 'Cancelar',
            confirmVariant: activeVal ? 'success' : 'danger',
            onConfirm: async () => {
              try {
                const { error } = await supabase
                  .from('inventory_products')
                  .update({ is_active: activeVal })
                  .eq('id', id);

                if (error) throw error;
                showToast({
                  title: activeVal ? 'Producto activado' : 'Producto desactivado',
                  subtitle: `El producto "${prod.name}" cambió de estado.`,
                  type: 'success'
                });
                await loadData();
                render();
              } catch (err) {
                showToast({ title: 'Error al cambiar estado', subtitle: err.message, type: 'error' });
              }
            }
          });
        });
      });
    }

    // --- ACCIONES TAB 2 - MOVIMIENTOS ---
    if (activeTab === 'movimientos') {
      const filterSelect = container.querySelector('#select-movement-filter');
      if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
          movementsFilter = e.target.value;
          render();
        });
      }

      container.querySelectorAll('.btn-view-invoice').forEach(btn => {
        btn.addEventListener('click', async () => {
          const refId = btn.getAttribute('data-id');
          btn.disabled = true;
          btn.innerHTML = `<i data-lucide="loader" class="anim-spin" size="12"></i> Cargando...`;
          if (typeof lucide !== 'undefined') lucide.createIcons({ node: btn });

          try {
            const { data: invoice, error } = await supabase
              .from('invoices')
              .select('*, invoice_items(*)')
              .eq('id', refId)
              .single();

            if (error) throw error;
            if (invoice) {
              const biz = getActiveBusiness();
              generateClientTicket(invoice, biz);
            }
          } catch (err) {
            showToast({ title: 'Error al cargar factura', subtitle: err.message, type: 'error' });
          } finally {
            btn.disabled = false;
            btn.innerHTML = 'Ver Factura';
          }
        });
      });
    }

    // --- ACCIONES TAB 3 - ALERTAS ---
    if (activeTab === 'alertas') {
      const readAlertsBtn = container.querySelector('#btn-read-alerts');
      if (readAlertsBtn) {
        readAlertsBtn.addEventListener('click', async () => {
          readAlertsBtn.disabled = true;
          readAlertsBtn.textContent = 'Guardando...';

          try {
            const { error } = await supabase
              .from('stock_alerts')
              .update({ is_read: true })
              .eq('business_id', businessId)
              .eq('is_read', false);

            if (error) throw error;

            showToast({
              title: 'Alertas limpiadas',
              subtitle: 'Todas las alertas de stock mínimo se marcaron como leídas.',
              type: 'success'
            });
            await loadData();
            render();
          } catch (err) {
            readAlertsBtn.disabled = false;
            readAlertsBtn.textContent = 'Marcar todas como leídas';
            showToast({ title: 'Error al limpiar alertas', subtitle: err.message, type: 'error' });
          }
        });
      }
    }
  };

  // Cargar datos y renderizar por primera vez
  await loadData();
  render();

  // --- ESCUCHA EN TIEMPO REAL ---
  const productsChannel = supabase
    .channel(productsChannelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_products', filter: `business_id=eq.${businessId}` }, async () => {
      await loadData();
      render();
    })
    .subscribe();

  const alertsChannel = supabase
    .channel(alertsChannelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_alerts', filter: `business_id=eq.${businessId}` }, async () => {
      await loadData();
      render();
    })
    .subscribe();

  // Guardar cleanup para remover la suscripción SPA al desmontar
  container.cleanup = () => {
    supabase.removeChannel(productsChannel);
    supabase.removeChannel(alertsChannel);
  };
}
