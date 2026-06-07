// src/utils/whatsappFormatter.js

/**
 * Convierte el formato de WhatsApp (*bold*, _italic_, ~strike~, ```code```, \n) a HTML
 * @param {string} text - Texto en bruto
 * @returns {string} Texto formateado en HTML (con escape de XSS previo)
 */
export function formatWhatsAppMessage(text) {
  if (!text) return '';

  // 1. Escapar HTML para evitar inyección de scripts en la previsualización
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Monospace: ```código``` -> <code>código</code>
  formatted = formatted.replace(/```([^`]+)```/g, '<code>$1</code>');

  // 3. Negrita: *texto* -> <strong>texto</strong>
  formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

  // 4. Cursiva: _texto_ -> <em>texto</em>
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. Tachado: ~texto~ -> <del>texto</del>
  formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');

  // 6. Saltos de línea
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

import { formatCurrency } from './format.js';

/**
 * Reemplaza las variables soportadas por sus valores correspondientes
 * @param {string} text - Contenido de la plantilla
 * @param {object} clientData - Datos del cliente { name, phone, last_service, last_service_date }
 * @param {string|object} businessData - Nombre del negocio (string) o el objeto completo de negocio
 * @param {object} [appointmentData] - Datos opcionales de cita { date, time, service, prof, totalPrice }
 * @returns {string} Texto con variables reemplazadas
 */
export function replaceTemplateVariables(text, clientData = {}, businessData = {}, appointmentData = null) {
  if (!text) return '';

  const clientName = clientData.name || '';
  const clientPhone = clientData.phone || '';

  // Detectar si businessData es objeto o string simple
  const isObj = typeof businessData === 'object' && businessData !== null;
  const businessName = isObj ? (businessData.name || '') : (businessData || '');
  const businessAddress = isObj ? (businessData.address || '') : '';
  const businessSlug = isObj ? (businessData.slug || '') : '';
  
  // URL de reserva pública
  const bookingLink = businessSlug ? `${window.location.origin}/booking.html?b=${businessSlug}` : '';

  // Si hay datos de cita usar esos, si no usar el histórico del cliente, o en su defecto vacío
  const service = appointmentData?.service || clientData.last_service || '';
  const professional = appointmentData?.prof || appointmentData?.professional || appointmentData?.professionals?.name || '';
  
  let priceStr = '';
  const rawPrice = appointmentData?.totalPrice || appointmentData?.total_price || appointmentData?.price;
  if (rawPrice !== undefined && rawPrice !== null) {
    priceStr = formatCurrency(Number(rawPrice));
  }

  let dateStr = '';
  if (appointmentData?.date) {
    dateStr = appointmentData.date;
  } else if (clientData.last_service_date) {
    try {
      const dateObj = new Date(clientData.last_service_date + 'T00:00:00');
      dateStr = dateObj.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (_) {
      dateStr = clientData.last_service_date;
    }
  }

  const timeStr = appointmentData?.time || '';

  return text
    .replace(/{cliente}/g, clientName)
    .replace(/{telefono}/g, clientPhone)
    .replace(/{negocio}/g, businessName)
    .replace(/{direccion}/g, businessAddress)
    .replace(/{servicio}/g, service)
    .replace(/{profesional}/g, professional)
    .replace(/{precio}/g, priceStr)
    .replace(/{link_reserva}/g, bookingLink)
    .replace(/{fecha}/g, dateStr)
    .replace(/{hora}/g, timeStr);
}

/**
 * Envuelve el texto seleccionado en el textarea con los caracteres de formato indicados
 * @param {HTMLTextAreaElement} textarea - Elemento DOM textarea
 * @param {string} prefix - Carácter de inicio (ej. '*', '_')
 * @param {string} suffix - Carácter de fin (ej. '*', '_')
 */
export function wrapSelection(textarea, prefix, suffix = prefix) {
  if (!textarea) return;

  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const originalText = textarea.value;
  const selectedText = originalText.substring(startPos, endPos);

  const wrappedText = prefix + selectedText + suffix;
  textarea.value = originalText.substring(0, startPos) + wrappedText + originalText.substring(endPos);

  textarea.focus();
  // Posicionar cursor después del texto insertado
  if (startPos === endPos) {
    textarea.selectionStart = textarea.selectionEnd = startPos + prefix.length;
  } else {
    textarea.selectionStart = textarea.selectionEnd = startPos + wrappedText.length;
  }
}
