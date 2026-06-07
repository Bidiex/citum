// src/utils/whatsappState.js
import { supabase } from '../core/supabase.js';
import { getActiveBusinessId } from './businessState.js';

/**
 * Obtiene todas las plantillas del negocio activo
 * @param {string} businessId - ID del negocio (opcional)
 */
export async function getTemplates(businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) return [];

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('business_id', bizId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getTemplates] Error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Agrega una nueva plantilla de WhatsApp
 * @param {string} businessId - ID del negocio (opcional)
 * @param {object} payload - { name, content }
 */
export async function addTemplate(businessId, payload) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) throw new Error('No hay negocio activo');

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .insert({
      business_id: bizId,
      name: payload.name,
      content: payload.content
    })
    .select()
    .single();

  if (error) {
    console.error('[addTemplate] Error:', error.message);
    throw error;
  }

  // Disparar evento para avisar de cambios
  window.dispatchEvent(new CustomEvent('citum_templates_changed', { detail: { businessId: bizId } }));
  return data;
}

/**
 * Actualiza una plantilla existente
 * @param {string} templateId - ID de la plantilla
 * @param {object} payload - { name, content }
 */
export async function updateTemplate(templateId, payload) {
  const bizId = getActiveBusinessId();

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .update({
      name: payload.name,
      content: payload.content,
      updated_at: new Date().toISOString()
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    console.error('[updateTemplate] Error:', error.message);
    throw error;
  }

  window.dispatchEvent(new CustomEvent('citum_templates_changed', { detail: { businessId: bizId } }));
  return data;
}

/**
 * Elimina una plantilla
 * @param {string} templateId - ID de la plantilla
 */
export async function deleteTemplate(templateId) {
  const bizId = getActiveBusinessId();

  const { error } = await supabase
    .from('whatsapp_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('[deleteTemplate] Error:', error.message);
    throw error;
  }

  window.dispatchEvent(new CustomEvent('citum_templates_changed', { detail: { businessId: bizId } }));
}
