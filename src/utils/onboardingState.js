// src/utils/onboardingState.js
import { supabase } from '../core/supabase.js';
import { addBusiness } from './businessState.js';

export async function getOnboardingState(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('onboarding_state')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return 'pending';
  }
  return data.onboarding_state || 'pending';
}

export async function updateOnboardingState(userId, state) {
  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_state: state })
    .eq('id', userId);

  if (error) {
    console.error('[updateOnboardingState] Error:', error.message);
  }
}

export async function createInitialBusiness(payload) {
  return await addBusiness(payload);
}

export async function createInitialService(businessId, payload) {
  const { data, error } = await supabase
    .from('services')
    .insert({
      business_id: businessId,
      name: payload.name,
      price: payload.price,
      duration_min: payload.duration,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createInitialProfessional(businessId, payload) {
  // 1. Insert Professional (Removed 'email' and 'color' which do not exist in the DB schema)
  const { data: prof, error: profError } = await supabase
    .from('professionals')
    .insert({
      business_id: businessId,
      name: payload.name,
      role: 'Profesional',
      phone: payload.phone || null,
      is_active: true
    })
    .select()
    .single();

  if (profError) throw profError;

  // 2. Insert Default Schedules
  const schedules = [];
  const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  
  days.forEach(day => {
    // If the day is enabled in the payload
    if (payload.schedules && payload.schedules[day] && payload.schedules[day].active) {
      schedules.push({
        professional_id: prof.id,
        day_of_week: day,
        start_time: payload.schedules[day].start + ':00',
        end_time: payload.schedules[day].end + ':00',
        is_available: true
      });
    } else {
      // Default off days
      schedules.push({
        professional_id: prof.id,
        day_of_week: day,
        start_time: '09:00:00',
        end_time: '18:00:00',
        is_available: false
      });
    }
  });

  if (schedules.length > 0) {
    const { error: schedError } = await supabase
      .from('professional_schedules')
      .insert(schedules);
    if (schedError) console.error('[createInitialProfessional] Error schedules:', schedError.message);
  }

  return prof;
}
