// format.js — Formateadores de datos y utilidades de zona horaria (Bogotá / Colombia)

export function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount);
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00'); // Asegurar interpretación local
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Retorna la fecha actual en Bogotá (Colombia) en formato YYYY-MM-DD.
 */
export function getColombiaTodayStr() {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/**
 * Retorna cualquier objeto Date formateado en la zona horaria de Bogotá en formato YYYY-MM-DD.
 */
export function getColombiaDate(date = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Obtiene la hora y minutos actuales ajustados específicamente a la zona horaria de Bogotá (UTC-5).
 */
export function getColombiaTimeParts() {
  const options = { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
  
  const hours = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute').value, 10);
  
  return { hours, minutes };
}
