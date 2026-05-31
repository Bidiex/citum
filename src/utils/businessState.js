import { supabase } from '../core/supabase.js';
import { parseTimestamptzToColombia, parseColombiaToTimestamptz } from './format.js';

// ============================================================
// ESTADO LOCAL (cache en memoria para la sesión activa)
// ============================================================

let _cachedBusinesses = null;
let _activeBusinessId = null;

/**
 * Obtiene el user_id de la sesión activa.
 * En modo de prueba sin login real, se puede pasar un override.
 */
async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

// ============================================================
// GESTIÓN DE NEGOCIOS
// ============================================================

/**
 * Carga todos los negocios del usuario autenticado desde Supabase.
 */
export async function getBusinesses() {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getBusinesses] Error:', error.message);
    return [];
  }

  _cachedBusinesses = data || [];
  return _cachedBusinesses;
}

/**
 * Retorna el id del negocio activo (cache o primer negocio cargado).
 */
export function getActiveBusinessId() {
  if (_activeBusinessId) return _activeBusinessId;
  if (_cachedBusinesses && _cachedBusinesses.length > 0) {
    _activeBusinessId = _cachedBusinesses[0].id;
  }
  return _activeBusinessId || null;
}

/**
 * Cambia el negocio activo y dispara evento para que el panel se refresque.
 */
export function setActiveBusinessId(id) {
  _activeBusinessId = id;
  window.dispatchEvent(new CustomEvent('citum_active_business_changed', { detail: id }));
}

/**
 * Devuelve el negocio activo del cache.
 */
export function getActiveBusiness() {
  if (!_cachedBusinesses || !_activeBusinessId) return null;
  return _cachedBusinesses.find(b => b.id === _activeBusinessId) || _cachedBusinesses[0] || null;
}

/**
 * Crea un nuevo negocio en Supabase.
 */
export async function addBusiness(payload) {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      user_id: userId,
      name: payload.name,
      slug: payload.slug,
      phone: payload.phone || null,
      address: payload.address || null,
      color: payload.color || '#8B5CF6',
      logo_url: payload.logo || null,
      is_paused: false,
      plan: payload.plan || 'esencial',
    })
    .select()
    .single();

  if (error) {
    console.error('[addBusiness] Error:', error.message);
    throw error;
  }

  // Actualizar cache
  _cachedBusinesses = null;
  setActiveBusinessId(data.id);
  window.dispatchEvent(new CustomEvent('citum_businesses_changed', { detail: data }));
  return data;
}

/**
 * Actualiza datos de un negocio existente.
 */
export async function updateBusiness(id, payload) {
  const update = {
    phone: payload.phone,
    address: payload.address || null,
    color: payload.color || '#8B5CF6',
    logo_url: payload.logo || null,
    is_paused: payload.paused || false,
  };

  if (payload.has_configured_hours !== undefined) {
    update.has_configured_hours = payload.has_configured_hours;
  }

  const { data, error } = await supabase
    .from('businesses')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateBusiness] Error:', error.message);
    throw error;
  }

  // Actualizar cache
  _cachedBusinesses = null;
  window.dispatchEvent(new CustomEvent('citum_businesses_changed', { detail: data }));
  return data;
}

/**
 * Elimina un negocio (CASCADE elimina todo lo relacionado).
 */
export async function deleteBusiness(id) {
  const { error } = await supabase
    .from('businesses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteBusiness] Error:', error.message);
    throw error;
  }

  // Limpiar cache
  _cachedBusinesses = null;
  if (_activeBusinessId === id) {
    _activeBusinessId = null;
  }
  window.dispatchEvent(new CustomEvent('citum_businesses_changed'));
}

// ============================================================
// GESTIÓN DE CLIENTES (CRM)
// ============================================================

/**
 * Obtiene todos los clientes de un negocio.
 */
export async function getClients(businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', bizId)
    .order('name', { ascending: true });

  if (error) {
    console.error('[getClients] Error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Busca clientes por nombre o teléfono.
 */
export async function searchClientsByName(query, businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId || !query || query.length < 2) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone, email')
    .eq('business_id', bizId)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(10);

  if (error) return [];
  return data || [];
}

/**
 * Upsert de cliente desde una cita (suma visitas y gasto).
 * Llama al RPC del servidor para atomicidad.
 */
export async function upsertClientFromAppointment(appointment, businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) return;

  const { error } = await supabase.rpc('upsert_client_from_appointment', {
    p_business_id: bizId,
    p_name: appointment.client,
    p_phone: appointment.phone,
    p_email: appointment.email || null,
    p_service_name: appointment.service || null,
    p_service_date: appointment.date || null,
    p_amount: appointment.totalPrice || 0,
  });

  if (error) console.error('[upsertClientFromAppointment] Error:', error.message);

  window.dispatchEvent(new CustomEvent('citum_clients_changed', { detail: { businessId: bizId } }));
}

/**
 * Descontar estadísticas de un cliente al cancelar/eliminar cita.
 * (Manejado automáticamente por el trigger de la DB, pero disparamos el evento)
 */
export async function removeClientAppointmentStats(appointment, businessId) {
  const bizId = businessId || getActiveBusinessId();
  window.dispatchEvent(new CustomEvent('citum_clients_changed', { detail: { businessId: bizId } }));
}

// ============================================================
// GESTIÓN DE SERVICIOS
// ============================================================

/**
 * Obtiene todos los servicios de un negocio.
 */
export async function getServices(businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) return [];

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', bizId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getServices] Error:', error.message);
    return [];
  }

  // Normalizar nombres de campo para compatibilidad con código existente:
  // DB usa duration_min y description → código usa duration y desc
  return (data || []).map(s => ({
    ...s,
    duration: s.duration_min,      // alias para el código existente
    desc: s.description || '',     // alias para el código existente
    active: s.is_active,           // alias para el código existente
  }));
}

/**
 * Crea un nuevo servicio.
 */
export async function addService(businessId, payload) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) throw new Error('No hay negocio activo');

  const { data, error } = await supabase
    .from('services')
    .insert({
      business_id: bizId,
      name: payload.name,
      description: payload.desc || '',
      price: payload.price,
      duration_min: payload.duration,
      is_active: payload.active !== false,
    })
    .select()
    .single();

  if (error) {
    console.error('[addService] Error:', error.message);
    throw error;
  }

  window.dispatchEvent(new CustomEvent('citum_services_changed', { detail: { businessId: bizId } }));
  return { ...data, duration: data.duration_min, desc: data.description, active: data.is_active };
}

/**
 * Actualiza un servicio existente.
 */
export async function updateService(businessId, serviceId, payload) {
  const { data, error } = await supabase
    .from('services')
    .update({
      name: payload.name,
      description: payload.desc || '',
      price: payload.price,
      duration_min: payload.duration,
      is_active: payload.active !== false,
    })
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    console.error('[updateService] Error:', error.message);
    throw error;
  }

  const bizId = businessId || getActiveBusinessId();
  window.dispatchEvent(new CustomEvent('citum_services_changed', { detail: { businessId: bizId } }));
  return { ...data, duration: data.duration_min, desc: data.description, active: data.is_active };
}

/**
 * Elimina un servicio.
 */
export async function deleteService(businessId, serviceId) {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId);

  if (error) {
    console.error('[deleteService] Error:', error.message);
    throw error;
  }

  const bizId = businessId || getActiveBusinessId();
  window.dispatchEvent(new CustomEvent('citum_services_changed', { detail: { businessId: bizId } }));
}

// ============================================================
// HELPER: Buscar cliente por teléfono (para formularios)
// ============================================================
export async function findClientByPhone(phone, businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId || !phone) return null;

  const { data } = await supabase
    .from('clients')
    .select('id, name, phone, email')
    .eq('business_id', bizId)
    .eq('phone', phone.trim())
    .maybeSingle();

  return data || null;
}

// ============================================================
// HELPER: Guardar negocios (compatibilidad, no se usa directamente)
// ============================================================
export function saveBusinesses() {
  // No-op: En Supabase, los cambios se hacen directamente en la DB.
  // Se mantiene por compatibilidad con código legacy que pudiera llamarlo.
}

export function saveClients() {
  // No-op: El CRM ahora se actualiza via DB trigger y RPC.
}

export function saveServices() {
  // No-op
}

// ============================================================
// GESTIÓN DE CITAS (APPOINTMENTS)
// ============================================================

/**
 * Carga todas las citas del negocio activo.
 */
export async function getAppointments(businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) return [];

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      professionals (name),
      appointment_services (
        service_id,
        service_name,
        price_at_time,
        duration_at_time
      )
    `)
    .eq('business_id', bizId);

  if (error) {
    console.error('[getAppointments] Error:', error.message);
    return [];
  }

  // Mapear al formato usado por el calendario
  return (data || []).map(apt => {
    const { date, time } = parseTimestamptzToColombia(apt.starts_at);
    const serviceNames = (apt.appointment_services || []).map(s => s.service_name);
    return {
      id: apt.id,
      date,
      time,
      client: apt.client_name,
      phone: apt.client_phone,
      email: apt.client_email,
      service: serviceNames.join(' + '),
      prof: apt.professionals ? apt.professionals.name : 'Cualquiera',
      professional_id: apt.professional_id,
      status: apt.status,
      notes: apt.notes,
      totalPrice: Number(apt.total_price),
      rawServices: apt.appointment_services
    };
  });
}

/**
 * Crea una nueva cita y sus servicios correspondientes.
 */
export async function addAppointment(businessId, payload, selectedServices) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) throw new Error('No hay negocio activo');

  // Convertir a timestamptz en Colombia UTC-5
  const startsAt = parseColombiaToTimestamptz(payload.date, payload.time);
  
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const startsAtDate = new Date(startsAt);
  const endsAtDate = new Date(startsAtDate.getTime() + totalDuration * 60000);
  const endsAt = endsAtDate.toISOString();

  // 1. Insertar la cita
  const { data: apt, error: aptError } = await supabase
    .from('appointments')
    .insert({
      business_id: bizId,
      professional_id: payload.professional_id || payload.prof,
      client_name: payload.client,
      client_phone: payload.phone,
      client_email: payload.email || null,
      starts_at: startsAt,
      ends_at: endsAt,
      status: payload.status || 'confirmada',
      notes: payload.notes || '',
      source: payload.source || 'panel',
      total_price: payload.totalPrice || selectedServices.reduce((sum, s) => sum + s.price, 0)
    })
    .select()
    .single();

  if (aptError) {
    console.error('[addAppointment] Error:', aptError.message);
    throw aptError;
  }

  // 2. Insertar los servicios vinculados
  if (selectedServices && selectedServices.length > 0) {
    const aptServices = selectedServices.map(s => ({
      appointment_id: apt.id,
      service_id: s.id,
      service_name: s.name,
      price_at_time: s.price,
      duration_at_time: s.duration
    }));

    const { error: srvError } = await supabase
      .from('appointment_services')
      .insert(aptServices);

    if (srvError) {
      console.error('[addAppointment - services] Error:', srvError.message);
      throw srvError;
    }
  }

  window.dispatchEvent(new CustomEvent('citum_appointments_changed', { detail: { businessId: bizId } }));
  return apt;
}

/**
 * Actualiza una cita y reemplaza sus servicios vinculados.
 */
export async function updateAppointment(appointmentId, payload, selectedServices) {
  const startsAt = parseColombiaToTimestamptz(payload.date, payload.time);
  
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const startsAtDate = new Date(startsAt);
  const endsAtDate = new Date(startsAtDate.getTime() + totalDuration * 60000);
  const endsAt = endsAtDate.toISOString();

  // 1. Actualizar cita
  const { error: aptError } = await supabase
    .from('appointments')
    .update({
      professional_id: payload.professional_id || payload.prof,
      client_name: payload.client,
      client_phone: payload.phone,
      client_email: payload.email || null,
      starts_at: startsAt,
      ends_at: endsAt,
      status: payload.status,
      notes: payload.notes || '',
      total_price: payload.totalPrice || selectedServices.reduce((sum, s) => sum + s.price, 0)
    })
    .eq('id', appointmentId);

  if (aptError) {
    console.error('[updateAppointment] Error:', aptError.message);
    throw aptError;
  }

  // 2. Eliminar servicios antiguos e insertar los nuevos
  const { error: delError } = await supabase
    .from('appointment_services')
    .delete()
    .eq('appointment_id', appointmentId);

  if (delError) {
    console.error('[updateAppointment - delete services] Error:', delError.message);
  }

  if (selectedServices && selectedServices.length > 0) {
    const aptServices = selectedServices.map(s => ({
      appointment_id: appointmentId,
      service_id: s.id,
      service_name: s.name,
      price_at_time: s.price,
      duration_at_time: s.duration
    }));

    const { error: srvError } = await supabase
      .from('appointment_services')
      .insert(aptServices);

    if (srvError) throw srvError;
  }

  const bizId = getActiveBusinessId();
  window.dispatchEvent(new CustomEvent('citum_appointments_changed', { detail: { businessId: bizId } }));
}

/**
 * Elimina una cita de la base de datos.
 */
export async function deleteAppointment(appointmentId) {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', appointmentId);

  if (error) {
    console.error('[deleteAppointment] Error:', error.message);
    throw error;
  }

  const bizId = getActiveBusinessId();
  window.dispatchEvent(new CustomEvent('citum_appointments_changed', { detail: { businessId: bizId } }));
}

// ============================================================
// GESTIÓN DE PROFESIONALES (PARA DROPDOWNS Y FILTROS)
// ============================================================

export async function fetchProfessionals(businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) return [];

  const { data, error } = await supabase
    .from('professionals')
    .select(`
      *,
      professional_schedules (*),
      professional_breaks (*)
    `)
    .eq('business_id', bizId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[fetchProfessionals]', error.message);
    return [];
  }

  return (data || []).map(p => ({
    ...p,
    active: p.is_active,
    schedules: (p.professional_schedules || []).map(s => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_available: s.is_available,
    })),
    breaks: (p.professional_breaks || []).map(b => ({
      id: b.id,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      label: b.label,
    })),
  }));
}

// ============================================================
// GESTIÓN DE FACTURACIÓN (INVOICES)
// ============================================================

/**
 * Carga el historial de facturas del negocio.
 */
export async function getInvoices(businessId) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items (*)
    `)
    .eq('business_id', bizId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getInvoices] Error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Crea una nueva factura generando su número correlativo automático.
 */
export async function createInvoice(businessId, payload, items) {
  const bizId = businessId || getActiveBusinessId();
  if (!bizId) throw new Error('No hay negocio activo');

  const userId = await getUserId();

  // Generar número correlativo
  const { data: invNum, error: numError } = await supabase.rpc('generate_invoice_number', {
    p_business_id: bizId,
    p_type: payload.appointment_id ? 'CITA' : 'VCTA'
  });

  if (numError) {
    console.error('[createInvoice] Error generating invoice number:', numError.message);
    throw numError;
  }

  // 1. Insertar factura
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      business_id: bizId,
      appointment_id: payload.appointment_id || null,
      invoice_number: invNum,
      client_name: payload.client_name,
      client_phone: payload.client_phone || null,
      client_email: payload.client_email || null,
      subtotal: payload.subtotal,
      discount: payload.discount || 0,
      total: payload.total,
      payment_method: payload.payment_method || 'efectivo',
      payment_notes: payload.payment_notes || '',
      status: payload.status || 'pagada',
      created_by: userId
    })
    .select()
    .single();

  if (invError) {
    console.error('[createInvoice] Error inserting invoice:', invError.message);
    throw invError;
  }

  // 2. Insertar ítems
  if (items && items.length > 0) {
    const invoiceItems = items.map(it => ({
      invoice_id: invoice.id,
      service_id: it.service_id || null,
      description: it.description,
      qty: it.qty || 1,
      unit_price: it.unit_price,
      total: it.total
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      console.error('[createInvoice] Error inserting items:', itemsError.message);
      throw itemsError;
    }
  }

  // Descontar stock por inventario de manera automática
  const serviceIds = items.filter(it => it.service_id).map(it => it.service_id);
  if (serviceIds.length > 0) {
    try {
      const { descontarStockPorFactura } = await import('./inventory.js');
      await descontarStockPorFactura(invoice.id, serviceIds);
    } catch (err) {
      console.error('[createInvoice] Error descontando stock de inventario:', err);
    }
  }

  window.dispatchEvent(new CustomEvent('citum_invoices_changed', { detail: { businessId: bizId } }));
  return { ...invoice, invoice_items: items };
}

// ============================================================
// CONSULTAS PÚBLICAS (PORTAL DE RESERVAS - ANÓNIMO)
// ============================================================

/**
 * Obtiene un negocio por su slug (Portal público).
 */
export async function getBusinessBySlug(slug) {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .eq('is_paused', false)
    .maybeSingle();

  if (error) {
    console.error('[getBusinessBySlug] Error:', error.message);
    return null;
  }
  return data;
}

/**
 * Obtiene todos los servicios activos de un negocio.
 */
export async function getActiveServices(businessId) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getActiveServices] Error:', error.message);
    return [];
  }

  return (data || []).map(s => ({
    ...s,
    duration: s.duration_min,
    desc: s.description || '',
    active: s.is_active,
  }));
}

/**
 * Obtiene los profesionales activos con horarios y breaks (Portal público).
 */
export async function getProfessionalsForBooking(businessId) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('professionals')
    .select(`
      *,
      professional_schedules (*),
      professional_breaks (*)
    `)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getProfessionalsForBooking]', error.message);
    return [];
  }

  return (data || []).map(p => ({
    ...p,
    active: p.is_active,
    schedules: (p.professional_schedules || []).map(s => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_available: s.is_available,
    })),
    breaks: (p.professional_breaks || []).map(b => ({
      id: b.id,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      label: b.label,
    })),
  }));
}

// ============================================================
// GESTIÓN DE HORARIOS Y FERIADOS DEL NEGOCIO
// ============================================================

/**
 * Obtiene los horarios semanales de atención de un negocio.
 */
export async function getBusinessSchedules(businessId) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('business_schedules')
    .select('*')
    .eq('business_id', businessId)
    .order('day_of_week', { ascending: true });

  if (error) {
    console.error('[getBusinessSchedules] Error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Actualiza los horarios de atención de un negocio.
 */
export async function updateBusinessSchedules(businessId, schedules) {
  if (!businessId || !schedules || schedules.length === 0) return;
  
  const { error } = await supabase
    .from('business_schedules')
    .upsert(
      schedules.map(s => ({
        business_id: businessId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_open: s.is_open
      })),
      { onConflict: 'business_id,day_of_week' }
    );

  if (error) {
    console.error('[updateBusinessSchedules] Error:', error.message);
    throw error;
  }
}

/**
 * Obtiene el listado de días feriados de un negocio.
 */
export async function getBusinessHolidays(businessId) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('business_holidays')
    .select('*')
    .eq('business_id', businessId)
    .order('date', { ascending: true });

  if (error) {
    console.error('[getBusinessHolidays] Error:', error.message);
    return [];
  }
  return data || [];
}


