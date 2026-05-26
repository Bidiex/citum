// facturacion.js — Módulo de Facturación del Panel

export function init(container) {
  const invoices = [
    { number: 'CITA-0001', client: 'Carlos Mendoza', total: 35000, method: 'Efectivo', date: 'Hoy' },
    { number: 'VCTA-0002', client: 'Andrés López', total: 25000, method: 'Transferencia', date: 'Ayer' }
  ];

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div>
          <p class="flow-subtitle" style="margin-bottom: 0;">Gestiona tus cobros, ventas directas e historial de facturas.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="btn-new-bill" style="height: 40px; padding-inline: var(--space-4);">
            <i data-lucide="plus" size="16" style="margin-right: var(--space-2);"></i>
            Venta Directa
          </button>
        </div>
      </div>

      <!-- Tabla de Facturación -->
      <div class="table-container" style="
        background: var(--bg-secondary); 
        border: 1px solid var(--border-soft); 
        border-radius: var(--radius-md); 
        margin-top: var(--space-4);
        overflow-x: auto;
      ">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: var(--text-sm);">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-soft); color: var(--text-muted); font-weight: 700;">
              <th style="padding: var(--space-4);">Número</th>
              <th style="padding: var(--space-4);">Cliente</th>
              <th style="padding: var(--space-4);">Método</th>
              <th style="padding: var(--space-4);">Fecha</th>
              <th style="padding: var(--space-4);">Total</th>
              <th style="padding: var(--space-4); text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => `
              <tr style="border-bottom: 1px solid var(--border-soft);">
                <td style="padding: var(--space-4); font-weight: 700; color: var(--accent-neon);">${inv.number}</td>
                <td style="padding: var(--space-4);">${inv.client}</td>
                <td style="padding: var(--space-4);">${inv.method}</td>
                <td style="padding: var(--space-4);">${inv.date}</td>
                <td style="padding: var(--space-4); font-weight: 700;">COP $${inv.total.toLocaleString('es-CO')}</td>
                <td style="padding: var(--space-4); text-align: right;">
                  <button class="btn-print-invoice" style="
                    background: none; 
                    border: none; 
                    color: var(--accent-purple); 
                    font-weight: 600; 
                    cursor: pointer;
                  ">
                    <i data-lucide="printer" size="16" style="display: inline; vertical-align: middle; margin-right: 4px;"></i>
                    Imprimir
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
