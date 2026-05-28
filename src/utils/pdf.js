// pdf.js — Generación de tickets PDF con jsPDF
import { jsPDF } from 'jspdf';

export function generateClientTicket(invoice, business) {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 150 + (invoice.invoice_items?.length || 0) * 10]
  });

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);

  let y = 10;
  
  // Center alignment helper
  const centerText = (text, yPos) => {
    const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const xPos = (80 - textWidth) / 2;
    doc.text(text, xPos, yPos);
  };

  // Header
  centerText(business?.name || 'CITUM', y);
  y += 5;
  if (business?.address) {
    doc.setFontSize(8);
    centerText(business.address, y);
    y += 4;
  }
  if (business?.phone) {
    doc.setFontSize(8);
    centerText(`Tel: ${business.phone}`, y);
    y += 4;
  }
  
  doc.setFontSize(9);
  y += 2;
  doc.text('--------------------------------', 5, y);
  y += 5;

  doc.text(`TICKET: ${invoice.invoice_number || 'VCTA-0000'}`, 5, y);
  y += 5;
  const dateStr = new Date(invoice.created_at || new Date()).toLocaleString('es-CO');
  doc.text(`FECHA: ${dateStr}`, 5, y);
  y += 5;
  doc.text(`CLIENTE: ${invoice.client_name || 'Consumidor Final'}`, 5, y);
  y += 5;
  if (invoice.client_phone) {
    doc.text(`TEL: ${invoice.client_phone}`, 5, y);
    y += 5;
  }
  doc.text('--------------------------------', 5, y);
  y += 5;

  // Items
  doc.setFontSize(8);
  doc.text('DESC', 5, y);
  doc.text('CANT', 45, y);
  doc.text('TOTAL', 60, y);
  y += 4;
  doc.text('--------------------------------', 5, y);
  y += 5;

  const items = invoice.invoice_items || [];
  items.forEach(it => {
    const desc = it.description || 'Servicio';
    const qty = it.qty || 1;
    const total = it.total || 0;
    
    doc.text(desc.substring(0, 18), 5, y);
    doc.text(String(qty), 45, y);
    doc.text(`$${Number(total).toLocaleString('es-CO')}`, 60, y);
    y += 5;
  });

  doc.setFontSize(9);
  doc.text('--------------------------------', 5, y);
  y += 5;

  doc.text(`SUBTOTAL:`, 5, y);
  doc.text(`$${Number(invoice.subtotal || invoice.total).toLocaleString('es-CO')}`, 55, y);
  y += 5;
  if (invoice.discount) {
    doc.text(`DESCUENTO:`, 5, y);
    doc.text(`-$${Number(invoice.discount).toLocaleString('es-CO')}`, 55, y);
    y += 5;
  }
  doc.setFontSize(10);
  doc.text(`TOTAL:`, 5, y);
  doc.text(`$${Number(invoice.total).toLocaleString('es-CO')}`, 55, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`PAGO: ${invoice.payment_method?.toUpperCase() || 'EFECTIVO'}`, 5, y);
  y += 7;

  doc.text('--------------------------------', 5, y);
  y += 5;
  centerText('¡Gracias por su visita!', y);
  y += 4;
  centerText('Citum SaaS', y);

  doc.save(`ticket-${invoice.invoice_number}.pdf`);
}

export function generateServiceTicket(invoice, professionalName) {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 130 + (invoice.invoice_items?.length || 0) * 10]
  });

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);

  let y = 10;
  
  const centerText = (text, yPos) => {
    const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const xPos = (80 - textWidth) / 2;
    doc.text(text, xPos, yPos);
  };

  centerText('ORDEN DE SERVICIO', y);
  y += 5;
  doc.text('--------------------------------', 5, y);
  y += 5;

  doc.text(`TICKET: ${invoice.invoice_number || 'OS-0000'}`, 5, y);
  y += 5;
  const dateStr = new Date(invoice.created_at || new Date()).toLocaleString('es-CO');
  doc.text(`FECHA: ${dateStr}`, 5, y);
  y += 5;
  doc.text(`PROF: ${professionalName || 'Asignado'}`, 5, y);
  y += 5;
  doc.text(`CLIENTE: ${invoice.client_name || 'Consumidor Final'}`, 5, y);
  y += 5;
  doc.text('--------------------------------', 5, y);
  y += 5;

  doc.text('SERVICIOS A REALIZAR:', 5, y);
  y += 5;

  const items = invoice.invoice_items || [];
  items.forEach(it => {
    doc.text(`[ ] ${it.description || 'Servicio'} (x${it.qty || 1})`, 5, y);
    y += 5;
  });

  y += 5;
  doc.text('--------------------------------', 5, y);
  y += 5;
  centerText('Control de Calidad Citum', y);

  doc.save(`orden-${invoice.invoice_number}.pdf`);
}
