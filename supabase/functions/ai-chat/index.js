// supabase/functions/ai-chat/index.js
// Edge Function — Proxy seguro OpenAI para el Agente Interno de Citum
// Corre en Deno (servidor Supabase). La API key NUNCA llega al browser.

import OpenAI from 'https://esm.sh/openai@4';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_ITERATIONS = parseInt(Deno.env.get('AI_MAX_TOOL_CALLS') || '6');

// ── Helpers zona horaria Colombia (UTC-5) ────────────────────────────────────

function getColombiaTodayStr() {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getColombiaDateRange(dateStr) {
  // Convierte YYYY-MM-DD Colombia → rango UTC para filtrar starts_at
  const start = new Date(`${dateStr}T00:00:00-05:00`);
  const end   = new Date(`${dateStr}T23:59:59-05:00`);
  return { startUTC: start.toISOString(), endUTC: end.toISOString() };
}

function getColombiaRangeForPeriod(period) {
  const today = getColombiaTodayStr();
  if (period === 'today') {
    return getColombiaDateRange(today);
  }
  if (period === 'week') {
    const d = new Date(`${today}T00:00:00-05:00`);
    d.setDate(d.getDate() - d.getDay()); // lunes de la semana
    const weekStart = d.toISOString().split('T')[0];
    const { startUTC } = getColombiaDateRange(weekStart);
    const { endUTC }   = getColombiaDateRange(today);
    return { startUTC, endUTC };
  }
  // month
  const monthStart = `${today.substring(0, 7)}-01`;
  const { startUTC } = getColombiaDateRange(monthStart);
  const { endUTC }   = getColombiaDateRange(today);
  return { startUTC, endUTC };
}

function fmtTime(isoString) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(isoString));
}

function fmtDateTime(isoString) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(isoString));
}

function fmtCOP(n) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(Number(n) || 0);
}

// ── Definición de herramientas para OpenAI ───────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_appointments',
      description: 'Obtiene citas del negocio filtradas por fecha (Colombia), estado o profesional. Sin filtros devuelve las de hoy.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD (zona Colombia). Por defecto: hoy.',
          },
          status: {
            type: 'string',
            enum: ['pendiente', 'confirmada', 'en_proceso', 'completada', 'cancelada', 'no_asistio'],
          },
          professional_name: {
            type: 'string',
            description: 'Filtrar por nombre (parcial) del profesional.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_next_appointment',
      description: 'Obtiene la próxima cita pendiente o confirmada del negocio (a partir de ahora).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_metrics',
      description: 'Métricas del negocio: conteo de citas por estado e ingresos para un período.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month'],
            description: "'today' = hoy, 'week' = semana actual, 'month' = mes actual.",
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'Lista todos los servicios activos del negocio con nombre, precio y duración.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_professionals',
      description: 'Lista los profesionales activos del negocio.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_clients',
      description: 'Busca clientes del negocio por nombre o teléfono.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto a buscar en nombre o teléfono.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Crea una nueva cita. PIDE CONFIRMACIÓN EXPLÍCITA AL USUARIO ANTES DE EJECUTARLA. Necesitas: nombre del cliente, teléfono, nombres exactos de los servicios, nombre exacto del profesional, fecha (YYYY-MM-DD) y hora (HH:mm).',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string' },
          client_phone: { type: 'string' },
          service_names: { type: 'array', items: { type: 'string' }, description: 'Lista de nombres de servicios' },
          professional_name: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: 'HH:mm (Formato 24h)' },
        },
        required: ['client_name', 'client_phone', 'service_names', 'professional_name', 'date', 'time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancela una cita usando su ID. PIDE CONFIRMACIÓN ANTES DE EJECUTAR. Siempre busca la cita primero con get_appointments para obtener su ID real.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'UUID de la cita a cancelar' },
        },
        required: ['appointment_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Cambia la fecha/hora de una cita usando su ID. PIDE CONFIRMACIÓN ANTES DE EJECUTAR. Busca la cita primero para obtener su ID real.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string' },
          new_date: { type: 'string', description: 'YYYY-MM-DD' },
          new_time: { type: 'string', description: 'HH:mm (24h)' },
        },
        required: ['appointment_id', 'new_date', 'new_time'],
      },
    },
  },
];

// ── Ejecutores de herramientas ────────────────────────────────────────────────

async function toolGetAppointments(args, sb, bizId) {
  const dateStr = args.date || getColombiaTodayStr();
  const { startUTC, endUTC } = getColombiaDateRange(dateStr);

  let q = sb
    .from('appointments')
    .select(`
      id, status, client_name, client_phone, notes, total_price, starts_at,
      professionals ( name ),
      appointment_services ( service_name, price_at_time, duration_at_time )
    `)
    .eq('business_id', bizId)
    .gte('starts_at', startUTC)
    .lte('starts_at', endUTC)
    .order('starts_at', { ascending: true });

  if (args.status) q = q.eq('status', args.status);

  const { data, error } = await q;
  if (error) return { error: error.message };

  let rows = (data || []).map(a => ({
    id: a.id,
    cliente:      a.client_name,
    telefono:     a.client_phone,
    hora:         fmtTime(a.starts_at),
    estado:       a.status,
    profesional:  a.professionals?.name || 'Sin asignar',
    servicios:    (a.appointment_services || []).map(s => s.service_name).join(', '),
    total:        fmtCOP(a.total_price),
    notas:        a.notes || '',
  }));

  if (args.professional_name) {
    const q2 = args.professional_name.toLowerCase();
    rows = rows.filter(r => r.profesional.toLowerCase().includes(q2));
  }

  return { fecha: dateStr, total: rows.length, citas: rows };
}

async function toolGetNextAppointment(sb, bizId) {
  const { data, error } = await sb
    .from('appointments')
    .select(`
      id, status, client_name, client_phone, starts_at, total_price,
      professionals ( name ),
      appointment_services ( service_name )
    `)
    .eq('business_id', bizId)
    .in('status', ['pendiente', 'confirmada'])
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data)  return { resultado: 'No hay próximas citas programadas.' };

  return {
    id:          data.id,
    cliente:     data.client_name,
    telefono:    data.client_phone,
    cuando:      fmtDateTime(data.starts_at),
    profesional: data.professionals?.name || 'Sin asignar',
    servicios:   (data.appointment_services || []).map(s => s.service_name).join(', '),
    estado:      data.status,
    total:       fmtCOP(data.total_price),
  };
}

async function toolGetMetrics(args, sb, bizId) {
  const { startUTC, endUTC } = getColombiaRangeForPeriod(args.period);

  const { data, error } = await sb
    .from('appointments')
    .select('status, total_price')
    .eq('business_id', bizId)
    .gte('starts_at', startUTC)
    .lte('starts_at', endUTC);

  if (error) return { error: error.message };

  const apts = data || [];
  const revenue = (statuses) =>
    fmtCOP(apts.filter(a => statuses.includes(a.status)).reduce((s, a) => s + (Number(a.total_price) || 0), 0));

  const labelMap = { today: 'Hoy', week: 'Esta semana', month: 'Este mes' };

  return {
    periodo:             labelMap[args.period],
    total_citas:         apts.length,
    pendientes:          apts.filter(a => a.status === 'pendiente').length,
    confirmadas:         apts.filter(a => a.status === 'confirmada').length,
    completadas:         apts.filter(a => a.status === 'completada').length,
    canceladas:          apts.filter(a => a.status === 'cancelada').length,
    ingresos_cobrados:   revenue(['completada', 'facturada']),
    ingresos_pendientes: revenue(['pendiente', 'confirmada']),
  };
}

async function toolGetServices(sb, bizId) {
  const { data, error } = await sb
    .from('services')
    .select('name, price, duration_min, description')
    .eq('business_id', bizId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return { error: error.message };

  return {
    total: (data || []).length,
    servicios: (data || []).map(s => ({
      nombre:      s.name,
      precio:      fmtCOP(s.price),
      duracion:    `${s.duration_min} min`,
      descripcion: s.description || '',
    })),
  };
}

async function toolGetProfessionals(sb, bizId) {
  const { data, error } = await sb
    .from('professionals')
    .select('name, role')
    .eq('business_id', bizId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return { error: error.message };

  return {
    total: (data || []).length,
    profesionales: (data || []).map(p => ({
      nombre: p.name,
      rol:    p.role || 'Profesional',
    })),
  };
}

async function toolGetClients(args, sb, bizId) {
  let q = sb
    .from('clients')
    .select('name, phone, email, total_visits, total_spent, last_visit_at')
    .eq('business_id', bizId)
    .limit(20);

  if (args.query) {
    q = q.or(`name.ilike.%${args.query}%,phone.ilike.%${args.query}%`);
  } else {
    q = q.order('name', { ascending: true });
  }

  const { data, error } = await q;
  if (error) return { error: error.message };

  return {
    total: (data || []).length,
    clientes: (data || []).map(c => ({
      nombre:        c.name,
      telefono:      c.phone,
      email:         c.email || '',
      visitas:       c.total_visits || 0,
      gasto_total:   fmtCOP(c.total_spent || 0),
      ultima_visita: c.last_visit_at
        ? new Date(c.last_visit_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
        : 'Sin visitas',
    })),
  };
}

async function toolCreateAppointment(args, sb, bizId) {
  try {
    // Buscar al profesional
    const { data: profs } = await sb.from('professionals')
      .select('id, name')
      .eq('business_id', bizId)
      .ilike('name', `%${args.professional_name}%`);

    if (!profs || profs.length === 0) {
      return { error: `No encontré ningún profesional llamado "${args.professional_name}".` };
    }
    const profId = profs[0].id;

    // Buscar servicios y calcular precio/duración total
    const servicesToInsert = [];
    let totalPrice = 0;
    let totalDuration = 0;

    for (const sName of args.service_names) {
      const { data: srvs } = await sb.from('services')
        .select('id, name, price, duration_min')
        .eq('business_id', bizId)
        .ilike('name', `%${sName}%`);

      if (!srvs || srvs.length === 0) {
        return { error: `No encontré el servicio "${sName}".` };
      }
      
      const srv = srvs[0];
      totalPrice += srv.price;
      totalDuration += srv.duration_min;
      servicesToInsert.push(srv);
    }

    // Calcular hora de fin
    const startsAt = new Date(`${args.date}T${args.time}:00-05:00`);
    if (isNaN(startsAt.getTime())) return { error: "Fecha/hora inválida." };
    
    const endsAt = new Date(startsAt.getTime() + totalDuration * 60000);

    // Insertar la cita
    const { data: apt, error: aptError } = await sb.from('appointments').insert({
      business_id: bizId,
      professional_id: profId,
      client_name: args.client_name,
      client_phone: args.client_phone,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'confirmada',
      total_price: totalPrice,
      source: 'panel'
    }).select().single();

    if (aptError) return { error: `Error al crear cita: ${aptError.message}` };

    // Insertar appointment_services
    const aptServicesData = servicesToInsert.map(s => ({
      appointment_id: apt.id,
      service_id: s.id,
      service_name: s.name,
      price_at_time: s.price,
      duration_at_time: s.duration_min
    }));

    await sb.from('appointment_services').insert(aptServicesData);

    return { 
      resultado: 'Cita creada exitosamente', 
      cita: {
        id: apt.id,
        cliente: args.client_name,
        profesional: profs[0].name,
        fecha: args.date,
        hora: args.time,
        servicios: servicesToInsert.map(s => s.name).join(', '),
        total: fmtCOP(totalPrice)
      }
    };
  } catch(e) {
    return { error: e.message };
  }
}

async function toolCancelAppointment(args, sb, bizId) {
  const { data, error } = await sb.from('appointments')
    .update({ status: 'cancelada' })
    .eq('id', args.appointment_id)
    .eq('business_id', bizId)
    .select('client_name, starts_at')
    .single();

  if (error || !data) return { error: "No se pudo cancelar o la cita no existe." };
  
  return { 
    resultado: `Cita cancelada exitosamente para ${data.client_name} (${fmtDateTime(data.starts_at)}).` 
  };
}

async function toolRescheduleAppointment(args, sb, bizId) {
  // Solo obtener duración para recalcular ends_at
  const { data: apt } = await sb.from('appointments')
    .select('id, starts_at, ends_at, client_name')
    .eq('id', args.appointment_id)
    .eq('business_id', bizId)
    .single();

  if (!apt) return { error: "La cita no existe." };

  const oldStart = new Date(apt.starts_at);
  const oldEnd = new Date(apt.ends_at);
  const durationMs = oldEnd.getTime() - oldStart.getTime();

  const startsAt = new Date(`${args.new_date}T${args.new_time}:00-05:00`);
  if (isNaN(startsAt.getTime())) return { error: "Nueva fecha/hora inválida." };
  const endsAt = new Date(startsAt.getTime() + durationMs);

  const { error } = await sb.from('appointments')
    .update({ 
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString()
    })
    .eq('id', args.appointment_id);

  if (error) return { error: `Error al reagendar: ${error.message}` };

  return { 
    resultado: `Cita de ${apt.client_name} reagendada exitosamente al ${fmtDateTime(startsAt.toISOString())}.` 
  };
}

// Dispatcher central
async function executeTool(name, args, sb, bizId) {
  switch (name) {
    case 'get_appointments':     return toolGetAppointments(args, sb, bizId);
    case 'get_next_appointment': return toolGetNextAppointment(sb, bizId);
    case 'get_metrics':          return toolGetMetrics(args, sb, bizId);
    case 'get_services':         return toolGetServices(sb, bizId);
    case 'get_professionals':    return toolGetProfessionals(sb, bizId);
    case 'get_clients':          return toolGetClients(args, sb, bizId);
    case 'create_appointment':       return toolCreateAppointment(args, sb, bizId);
    case 'cancel_appointment':       return toolCancelAppointment(args, sb, bizId);
    case 'reschedule_appointment':   return toolRescheduleAppointment(args, sb, bizId);
    default: return { error: `Herramienta desconocida: ${name}` };
  }
}

// ── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt({ businessName, businessId }) {
  const now = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date());

  return `Eres el asistente inteligente de "${businessName}" en la plataforma Citum.
Tu misión: ayudar al administrador a gestionar su agenda, clientes y métricas mediante lenguaje natural.

CONTEXTO ACTUAL
• Fecha y hora (Colombia): ${now}
• Negocio: ${businessName} (ID: ${businessId})

REGLAS DE COMPORTAMIENTO
1. Responde siempre en español, tono profesional y cercano.
2. Zona horaria: Colombia (UTC-5) para todas las fechas y horas.
3. Precios siempre en pesos colombianos (COP).
4. Sé conciso: respuestas cortas y directas. Detalla solo si te lo piden.
5. No inventes datos. Si no encuentras información, dilo claramente.
6. Antes de ejecutar CUALQUIER acción de escritura (crear, cancelar, reagendar citas), pide confirmación explícita al usuario.

CAPACIDADES DISPONIBLES
✅ Ver citas por fecha, estado o profesional
✅ Ver la próxima cita del negocio
✅ Métricas: ingresos y conteos por período (hoy / semana / mes)
✅ Listar servicios y precios
✅ Listar profesionales
✅ Buscar clientes por nombre o teléfono

⏳ Próximamente: crear, cancelar y reagendar citas desde el chat.`;
}

// ── Handler Principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1 — Verificar JWT (sesión activa del admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Cliente con el JWT del usuario → respeta RLS
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 2 — Leer body
    const { messages, business_id } = await req.json();
    if (!Array.isArray(messages) || !business_id) {
      return new Response(JSON.stringify({ error: 'Parámetros requeridos: messages[], business_id' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 3 — Verificar que el negocio pertenece al usuario (RLS del cliente user lo valida)
    const { data: business, error: bizError } = await supabaseUser
      .from('businesses')
      .select('id, name')
      .eq('id', business_id)
      .maybeSingle();

    if (bizError || !business) {
      return new Response(JSON.stringify({ error: 'Negocio no encontrado o sin acceso' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 4 — Cliente service_role para ejecutar tools (queries directas sin RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 5 — OpenAI
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    const model     = Deno.env.get('AI_MODEL')      || 'gpt-5.4-mini';
    const maxTokens = parseInt(Deno.env.get('AI_MAX_TOKENS') || '1024');

    // 6 — Construir mensajes
    const systemPrompt = buildSystemPrompt({ businessName: business.name, businessId: business_id });
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // 7 — Tool call loop (máx MAX_ITERATIONS)
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await openai.chat.completions.create({
        model,
        messages: openaiMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        max_completion_tokens: maxTokens,
      });

      const assistantMsg = response.choices[0].message;

      // Sin tool calls → respuesta final para el usuario
      if (!assistantMsg.tool_calls?.length) {
        return new Response(
          JSON.stringify({ message: assistantMsg.content }),
          { headers: { ...CORS, 'Content-Type': 'application/json' } },
        );
      }

      // Agregar mensaje del asistente (con tool_calls) al historial
      openaiMessages.push(assistantMsg);

      // Ejecutar todas las tools en paralelo
      await Promise.all(
        assistantMsg.tool_calls.map(async (tc) => {
          let args = {};
          try { args = JSON.parse(tc.function.arguments); } catch (_) {}

          const result = await executeTool(tc.function.name, args, supabaseAdmin, business_id);

          openaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }),
      );
    }

    // Límite de iteraciones alcanzado
    return new Response(
      JSON.stringify({ message: 'No pude completar la operación en el límite de pasos. Intenta reformular tu pregunta.' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[ai-chat] Error inesperado:', err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
