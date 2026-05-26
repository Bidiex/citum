// availability.js — Lógica de disponibilidad de citas

// Retorna slots disponibles dado un profesional, fecha y duración total requerida
export async function getAvailableSlots(professionalId, date, totalDurationMin) {
  // 1. Obtener horario del profesional para ese día de semana
  // 2. Obtener breaks del profesional para ese día
  // 3. Obtener citas confirmadas/pendientes de ese profesional en esa fecha
  // 4. Calcular slots libres de `totalDurationMin` minutos dentro del horario
  //    evitando solapamientos con citas existentes y breaks
  
  // Por ahora, retornamos slots simulados
  return [
    { startsAt: '09:00 AM', endsAt: '09:40 AM' },
    { startsAt: '10:00 AM', endsAt: '10:40 AM' },
    { startsAt: '11:00 AM', endsAt: '11:40 AM' }
  ];
}
