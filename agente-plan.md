# 🤖 Citum AI Agents — Plan de Arquitectura

> **Estado:** Planificación  
> **Versión:** 1.0  
> **Fecha:** Junio 2025  
> **Autores:** Equipo Citum

---

## Índice

1. [Visión General](#visión-general)
2. [Agente 1 — Citum Assistant (Panel Interno)](#agente-1--citum-assistant-panel-interno)
3. [Agente 2 — Business Agent (WhatsApp)](#agente-2--business-agent-whatsapp)
4. [Seguridad — Punto Crítico](#seguridad--punto-crítico)
5. [Estructura de Carpetas](#estructura-de-carpetas)
6. [Base de Datos](#base-de-datos)
7. [Variables de Entorno](#variables-de-entorno)
8. [Roadmap de Implementación](#roadmap-de-implementación)

---

## Visión General

Citum implementa dos agentes de IA con **propósitos, audiencias y arquitecturas distintas**:

| | Agente 1 — Assistant | Agente 2 — WhatsApp |
|---|---|---|
| **Usuario** | Admin del negocio | Cliente final del negocio |
| **Canal** | Panel web (drawer) | WhatsApp Business |
| **Quién paga la API** | Citum (key centralizada) | El negocio (key propia o la de Citum en plan superior) |
| **Modelo** | gpt-5.4-mini | gpt-5.4-mini (configurable) |
| **Ejecución** | Supabase Edge Function (proxy seguro) | Supabase Edge Function (webhook) |
| **Fase** | 1 (inmediata) | 2 (siguiente sprint) |

---

## Agente 1 — Citum Assistant (Panel Interno)

### Propósito
Asistente conversacional para el **administrador del negocio**. Permite gestionar el negocio mediante lenguaje natural desde el panel de Citum.

### UI
- Botón flotante circular `⚡` en esquina inferior derecha del panel
- Abre un **drawer lateral de 360px** que no bloquea la UI
- Entrada por texto y por voz (Web Speech API)
- Mensaje de confirmación antes de ejecutar tools de escritura

### Contexto que recibe el agente en cada request
```json
{
  "business_id": "uuid",
  "business_name": "Barber Monaco",
  "current_datetime_colombia": "2025-06-10T09:30:00-05:00",
  "plan": "pro",
  "conversation_history": [ ...últimos N mensajes ]
}
```

### Tools — Consulta (solo lectura)

| Tool | Descripción | Parámetros |
|---|---|---|
| `get_appointments` | Citas por fecha, estado o profesional | `date?`, `status?`, `professional_name?` |
| `get_metrics` | Métricas del negocio por período | `period` (today/week/month/custom) |
| `get_next_appointment` | Próxima cita pendiente | — |
| `get_low_stock_products` | Productos bajo stock mínimo | — |
| `get_clients` | Buscar clientes | `query?` |
| `get_professionals` | Listar profesionales y disponibilidad | `date?` |
| `get_services` | Listar servicios del negocio | — |
| `get_professional_availability` | Slots libres de un profesional | `date`, `professional_name?` |

### Tools — Gestión (escritura con confirmación)

| Tool | Descripción | Parámetros |
|---|---|---|
| `create_appointment` | Crear cita completa | `client_name`, `client_phone`, `service_names[]`, `professional_name`, `date`, `time` |
| `cancel_appointment` | Cancelar cita | `appointment_id`, `reason?` |
| `update_appointment_status` | Cambiar estado de cita | `appointment_id`, `status` |
| `reschedule_appointment` | Reagendar cita | `appointment_id`, `new_date`, `new_time` |

> ⚠️ Las tools de escritura **siempre piden confirmación** antes de ejecutar:
> *"¿Confirmas que quieres cancelar la cita de Pedro García a las 3:00 PM?"*

---

## Agente 2 — Business Agent (WhatsApp)

### Propósito
Agente conversacional que cada negocio despliega para sus **clientes finales vía WhatsApp**. Permite agendar citas, recibir recordatorios y mensajes de marketing.

### Arquitectura del Webhook

```
Cliente de WhatsApp
        │ mensaje
        ▼
WhatsApp Business API (del negocio)
        │ webhook POST
        ▼
Supabase Edge Function: /functions/whatsapp-webhook
        │ 1. Verificar firma HMAC (wa_webhook_secret)
        │ 2. Identificar negocio por wa_phone_number_id
        │ 3. Cargar contexto del negocio + historial de conversación
        │ 4. Llamar OpenAI con tools
        │ 5. Ejecutar tools (queries a Supabase)
        │ 6. Generar respuesta
        ▼
WhatsApp Business API
        │ mensaje de respuesta
        ▼
Cliente de WhatsApp
```

### Tools — Autoservicio del cliente

| Tool | Descripción |
|---|---|
| `check_availability` | Ver slots disponibles por fecha y servicio |
| `create_appointment` | Agendar cita (requiere confirmación) |
| `get_my_appointments` | Ver citas del cliente por teléfono |
| `cancel_my_appointment` | Cancelar cita propia |
| `get_services` | Ver servicios y precios del negocio |
| `get_client_history` | Historial de visitas del cliente |
| `get_business_info` | Info del negocio (dirección, horario, teléfono) |

### Tools — Mensajería activa (outbound)

| Tool | Descripción |
|---|---|
| `send_appointment_reminder` | Recordatorio automático X horas antes |
| `send_reactivation_message` | Mensaje a clientes inactivos hace N días |
| `send_marketing_blast` | Envío masivo a segmento de clientes |
| `send_post_visit_followup` | Mensaje automático post-servicio |

### UI de Configuración en el Panel (5 Tabs)

**Tab 1 — Conexión**
- Campo `wa_phone_number_id`
- Campo `wa_access_token`
- Campo `wa_webhook_secret`
- URL del webhook generada automáticamente (para pegar en Meta Developer)
- Botón "Verificar conexión"
- Toggle activar/desactivar agente

**Tab 2 — Personalidad**
- Nombre del agente (ej. "Asistente de Barber Monaco")
- Instrucciones de personalidad (textarea)
- Mensaje de bienvenida
- Preview live de cómo responde el agente

**Tab 3 — Automatizaciones**
- Recordatorios: toggle + cuántas horas antes
- Reactivación: toggle + días de inactividad + plantilla
- Follow-up post visita: toggle + tiempo + plantilla
- Marketing: segmentos y mensajes

**Tab 4 — Conversaciones**
- Lista de conversaciones activas
- Vista del historial por cliente
- Opción "Tomar control manualmente"

**Tab 5 — Analytics**
- Citas creadas por el agente
- Tasa de conversión (conversación → cita)
- Mensajes enviados/recibidos
- Clientes reactivados

---

## Seguridad — Punto Crítico

### ⚠️ El problema con `VITE_OPENAI_API_KEY`

El plan original incluía `VITE_OPENAI_API_KEY` como variable de entorno. Esto es un **riesgo de seguridad crítico**: Vite expone en el bundle de cliente *todo* lo que empieza con `VITE_`. Cualquier usuario podría inspeccionar el JS compilado y extraer la API key.

### ✅ Solución: Proxy via Supabase Edge Function

Las llamadas a OpenAI **nunca se hacen desde el browser**. Siempre pasan por una Edge Function:

```
Browser (panel.js / ai-assistant.js)
        │ POST /functions/ai-chat
        │ { messages, business_id, tool_results? }
        │ (con Supabase auth token — sesión activa del admin)
        ▼
Supabase Edge Function: /functions/ai-chat
        │ Verificar JWT del usuario
        │ Cargar contexto del negocio del usuario autenticado
        │ Llamar OpenAI con la key del servidor (OPENAI_API_KEY en secrets de Supabase)
        │ Tool call loop
        │ Queries directas a Supabase con service_role
        ▼
Browser: respuesta del agente
```

**Beneficios:**
- La API key de OpenAI vive en los **Supabase secrets** (servidor), nunca en el cliente
- El JWT de Supabase autentica cada request automáticamente
- Las RLS policies protegen los datos del negocio
- Límite de rate y control de costos centralizado en la Edge Function

### Seguridad del webhook (Agente 2)

```
POST /functions/whatsapp-webhook
  1. Verificar firma HMAC-SHA256 con wa_webhook_secret
  2. Identificar business_id por wa_phone_number_id
  3. Cargar whatsapp_config del negocio
  4. Procesar mensaje
```

Los tokens de WhatsApp se guardan **encriptados en Supabase** usando `pgcrypto`.

---

## Estructura de Carpetas

```
booking-saas/
│
├── agente-plan.md                    ← Este documento
│
├── src/
│   ├── ai/                           ← ★ Feature nueva (aislada)
│   │   ├── README.md
│   │   ├── agent.js                  ← Orquestador del agente (tool call loop)
│   │   ├── llm.js                    ← Capa de abstracción multi-modelo
│   │   │
│   │   ├── tools/                    ← Implementaciones de tools
│   │   │   ├── README.md
│   │   │   ├── appointments.js       ← CRUD de citas
│   │   │   ├── metrics.js            ← Métricas y reportes
│   │   │   ├── inventory.js          ← Stock e inventario
│   │   │   └── clients.js            ← Búsqueda y gestión de clientes
│   │   │
│   │   └── prompts/                  ← System prompts
│   │       ├── README.md
│   │       └── system.js             ← System prompt del agente interno
│   │
│   ├── components/
│   │   ├── ai-assistant.js           ← UI: flotante + drawer + chat (Fase 1)
│   │   └── ai-voice.js               ← Web Speech API wrapper (Fase 1)
│   │
│   └── ... (código existente sin modificar)
│
├── supabase/
│   └── functions/
│       ├── ai-chat/                  ← ★ Proxy seguro OpenAI (Fase 1)
│       │   ├── index.ts
│       │   └── README.md
│       │
│       └── whatsapp-webhook/         ← ★ Webhook del agente WA (Fase 2)
│           ├── index.ts
│           └── README.md
│
└── styles/
    └── ai-assistant.css              ← ★ Estilos del drawer/chat (Fase 1)
```

> **Principio de aislamiento:** Todo el código nuevo vive en `src/ai/` y `supabase/functions/`. No toca ningún archivo existente excepto `panel.html` (para incluir el componente flotante) y `panel.css` (para importar `ai-assistant.css`).

---

## Base de Datos

### Tablas nuevas (solo Fase 2)

```sql
-- Historial de conversaciones de WhatsApp
CREATE TABLE whatsapp_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_phone    text NOT NULL,
  messages        jsonb NOT NULL DEFAULT '[]',  -- [{role, content, timestamp}]
  last_message_at timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- Configuración del agente WhatsApp por negocio
CREATE TABLE whatsapp_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  wa_phone_number_id    text NOT NULL,
  wa_access_token       text NOT NULL,        -- encriptado con pgcrypto
  wa_webhook_secret     text NOT NULL,        -- encriptado con pgcrypto
  openai_api_key        text,                 -- nullable: usa la de Citum si null
  agent_name            text DEFAULT 'Asistente',
  agent_personality     text,
  welcome_message       text,
  is_active             boolean DEFAULT false,
  created_at            timestamptz DEFAULT now()
);
```

### Tablas existentes que usa el Agente 1 (solo lectura/escritura via tools)

- `appointments` + `appointment_services`
- `professionals` + `professional_schedules`
- `services`
- `clients`
- `businesses`
- `products` / `inventory_movements` (si aplica)

> **Nota:** El Agente 1 no requiere tablas nuevas. El historial de conversación del panel se guarda en memoria de la sesión (o `sessionStorage`). No es necesario persistirlo en DB para la Fase 1.

---

## Variables de Entorno

### Cliente (Vite — ya existentes, no añadir la key de OpenAI aquí)

```bash
# .env — Solo las vars ya existentes
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Secrets (servidor — nunca expuestos al cliente)

```bash
# Se configuran con: supabase secrets set OPENAI_API_KEY=sk-...
OPENAI_API_KEY=sk-...          # Key de Citum para el agente interno
AI_MODEL=gpt-4o-mini           # Modelo por defecto (configurable)
AI_MAX_TOKENS=1024             # Límite de tokens por respuesta
AI_MAX_TOOL_CALLS=6            # Máximo de iteraciones del tool call loop
```

---

## Roadmap de Implementación

### Fase 1 — Agente Interno del Panel

- [ ] Crear `supabase/functions/ai-chat/index.ts` (proxy seguro)
- [ ] Crear `src/ai/llm.js` (abstracción multi-modelo)
- [ ] Crear `src/ai/tools/appointments.js` (tools de consulta)
- [ ] Crear `src/ai/tools/metrics.js`
- [ ] Crear `src/ai/tools/clients.js`
- [ ] Crear `src/ai/agent.js` (orquestador + tool call loop con límite de iteraciones)
- [ ] Crear `src/ai/prompts/system.js` (system prompt con contexto del negocio)
- [ ] Crear `src/components/ai-assistant.js` (UI flotante + drawer + chat)
- [ ] Crear `src/components/ai-voice.js` (Web Speech API)
- [ ] Crear `styles/ai-assistant.css`
- [ ] Tools de escritura con confirmación
- [ ] Deploy de la Edge Function `ai-chat`

### Fase 2 — Agente WhatsApp

- [ ] Migraciones: `whatsapp_conversations` + `whatsapp_config`
- [ ] Crear `supabase/functions/whatsapp-webhook/index.ts`
- [ ] Verificación HMAC del webhook
- [ ] Tools del agente de clientes (check_availability, create_appointment, etc.)
- [ ] Tools outbound (recordatorios, reactivación, marketing)
- [ ] UI de configuración en el panel (5 tabs)
- [ ] Sistema de automatizaciones
- [ ] Analytics de conversaciones

---

*Documento de arquitectura interna — Citum. No distribuir.*
