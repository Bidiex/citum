// src/utils/inventory.js
import { supabase } from '../core/supabase.js';

/**
 * Descuenta stock de productos asociados a los servicios facturados y genera alertas si el stock baja del límite.
 */
export async function descontarStockPorFactura(invoiceId, serviceIds) {
  try {
    if (!invoiceId || !serviceIds || serviceIds.length === 0) {
      return { success: true, movimientos: [] };
    }

    // 1. Obtener la factura para saber a qué negocio pertenece, su número y creador
    const { data: inv, error: invError } = await supabase
      .from('invoices')
      .select('business_id, invoice_number, created_by')
      .eq('id', invoiceId)
      .single();

    if (invError) throw invError;
    const businessId = inv.business_id;
    const invoiceNumber = inv.invoice_number;
    const userId = inv.created_by;

    // 2. Obtener los insumos/productos que consume cada servicio facturado
    const { data: spList, error: spError } = await supabase
      .from('service_products')
      .select('product_id, quantity_used')
      .in('service_id', serviceIds);

    if (spError) throw spError;
    if (!spList || spList.length === 0) {
      return { success: true, movimientos: [] };
    }

    // 3. Agrupar consumos sumando cantidades si un producto se repite en varios servicios
    const productsMap = {};
    for (const sp of spList) {
      const pid = sp.product_id;
      const qty = Number(sp.quantity_used);
      productsMap[pid] = (productsMap[pid] || 0) + qty;
    }

    const movimientos = [];

    // 4. Procesar y actualizar el stock de cada producto afectado
    for (const productId of Object.keys(productsMap)) {
      const qtyToDeduct = productsMap[productId];

      // Obtener stock actual del producto
      const { data: prod, error: prodError } = await supabase
        .from('inventory_products')
        .select('stock_current, stock_minimum, name')
        .eq('id', productId)
        .single();

      if (prodError) throw prodError;

      const currentStock = Number(prod.stock_current);
      const newStock = currentStock - qtyToDeduct;

      // Actualizar stock en la tabla de productos
      const { error: updateError } = await supabase
        .from('inventory_products')
        .update({ stock_current: newStock })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Registrar el log de movimiento (descuento)
      const { data: movement, error: moveError } = await supabase
        .from('inventory_movements')
        .insert({
          business_id: businessId,
          product_id: productId,
          type: 'descuento_servicio',
          quantity: qtyToDeduct,
          reference_id: invoiceId,
          notes: `Descuento automático por servicios en Factura #${invoiceNumber}`,
          created_by: userId
        })
        .select()
        .single();

      if (moveError) throw moveError;
      movimientos.push(movement);

      // 5. Si el stock cae por debajo del mínimo, registrar una alerta en stock_alerts
      if (newStock <= Number(prod.stock_minimum)) {
        const { error: alertError } = await supabase
          .from('stock_alerts')
          .insert({
            business_id: businessId,
            product_id: productId,
            stock_at_trigger: newStock,
            is_read: false
          });

        if (alertError) {
          console.error(`[descontarStock] Error al generar alerta para ${prod.name}:`, alertError.message);
        }
      }
    }

    return { success: true, movimientos };
  } catch (error) {
    console.error('[descontarStockPorFactura] Error:', error);
    return { success: false, error: error.message || error };
  }
}

/**
 * Formatea el stock según el tipo de unidad del producto.
 */
export function formatStock(product) {
  if (!product) return '0';
  const val = Number(product.stock_current);
  const formattedVal = val % 1 === 0 ? val.toString() : val.toFixed(1);

  if (product.unit_type === 'unit') {
    return `${formattedVal} ${val === 1 ? 'unidad' : 'unidades'}`;
  } else {
    return `${formattedVal} ${product.unit_label || ''}`;
  }
}

/**
 * Verifica si el stock de un producto está por debajo o igual al stock mínimo.
 */
export function isLowStock(product) {
  if (!product) return false;
  return Number(product.stock_current) <= Number(product.stock_minimum);
}
