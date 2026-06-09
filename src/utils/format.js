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

/**
 * Convierte un timestamptz ISO (UTC) a la fecha (YYYY-MM-DD) y la hora ('HH:MM AM/PM') en la zona horaria de Colombia.
 */
export function parseTimestamptzToColombia(isoString) {
  if (!isoString) return { date: '', time: '' };
  const d = new Date(isoString);
  
  // Fecha en Colombia: YYYY-MM-DD
  const dateStr = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
  
  // Hora en Colombia (HH:MM AM/PM)
  const timeStrRaw = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
  
  // Normalizar formato a "HH:MM AM/PM"
  let timeStr = timeStrRaw.replace(/\s+/g, ' ').toUpperCase();
  const parts = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/);
  if (parts) {
    const hr = parts[1].padStart(2, '0');
    const min = parts[2];
    const ampm = parts[3];
    timeStr = `${hr}:${min} ${ampm}`;
  }
  
  return { date: dateStr, time: timeStr };
}

/**
 * Convierte una fecha (YYYY-MM-DD) y una hora ('HH:MM AM/PM') en Colombia a un timestamptz ISO de UTC.
 */
export function parseColombiaToTimestamptz(dateStr, timeStr) {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  // Colombia es UTC-5 todo el año
  const isoStr = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`;
  return new Date(isoStr).toISOString();
}

export const STATUS_COLORS = {
  pendiente:   'var(--color-warning)',
  confirmada:  'var(--color-primary)',
  en_proceso:  '#8b5cf6', // purple
  completada:  'var(--color-success)',
  facturada:   '#22c55e', // mismo success pero con check icon
  cancelada:   'var(--color-danger)',
  no_asistio:  'var(--color-text-subtle)'
};
