// src/ai/llm.js — Capa de abstracción cliente para el Agente Citum
// Este archivo corre en el browser. NUNCA llama a OpenAI directamente.
// Toda comunicación va a través de la Edge Function /functions/v1/ai-chat.

import { supabase } from '../core/supabase.js';

// URL de la Edge Function (construida desde la URL de Supabase del .env)
const AI_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

/**
 * Envía el historial de mensajes al agente y devuelve su respuesta.
 *
 * @param {Array<{role: string, content: string}>} messages
 *   Historial completo de la conversación (sin el system prompt, ese lo pone la Edge Function).
 * @param {string} businessId - UUID del negocio activo.
 * @returns {Promise<string>} Texto de respuesta del agente.
 * @throws {Error} Si la sesión expiró o la Edge Function devuelve un error.
 */
export async function callAgent(messages, businessId) {
  // Obtener el token de sesión activo
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error('No hay sesión activa. Por favor, inicia sesión.');
  }

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // El JWT permite que la Edge Function verifique la identidad del usuario
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages,
      business_id: businessId,
    }),
  });

  const body = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor' }));

  if (!res.ok) {
    throw new Error(body.error || `Error ${res.status} al contactar al agente`);
  }

  if (!body.message) {
    throw new Error('El agente no devolvió una respuesta');
  }

  return body.message;
}
