# Citum — Documento Maestro del Producto
**Versión:** 1.0 — MVP  
**Stack:** HTML · CSS Vanilla · JS Vanilla · Vite · Supabase · Vercel

---

## 1. Visión del Producto

Citum es un SaaS de gestión y agendamiento para profesionales independientes y negocios que prestan servicios de cualquier tipo (salud, bienestar, belleza, asesoría, educación, reparaciones, y más). Permite a propietarios gestionar sus negocios desde un panel centralizado: agendamiento, profesionales, servicios, facturación y más. A los clientes finales les ofrece una interfaz pública de agendamiento por negocio.

**Modelo de negocio:** 1 usuario → N negocios. Un mismo propietario puede tener un consultorio y un salón de belleza bajo la misma cuenta.

---

## 2. Identidad Visual

### Nombre
**Citum** — sin logo ni ícono en esta fase.

> ⚠️ **Para agentes — Sistema de Diseño:**
> Toda decisión visual (colores, tipografía, espaciado, radius, sombras, gradientes, componentes, animaciones) debe consultarse en **[DESIGN.md](./DESIGN.md)**.
> Ese archivo es la fuente única de verdad de diseño del proyecto. No uses valores de color, fuentes o sombras que no estén definidos ahí.

### Íconos
- **Lucide Icons** (vanilla JS, sin framework).
- CDN: `https://unpkg.com/lucide@latest`
- Uso: `lucide.createIcons()` tras cargar el DOM.
- Estilo: stroke, line-weight consistente, tamaño base 20px en UI.

---

## 3. Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS Vanilla + JS Vanilla |
| Build tool | Vite |
| Deploy | Vercel |
| Backend / DB | Supabase (Auth, DB, RLS, RPC, Realtime, Storage) |
| PDF / Tickets | jsPDF (cliente) o html2canvas + jsPDF |
| Íconos | Lucide Icons |
| Tipografía | DM Sans (Google Fonts) |

---

## 4. Arquitectura del Proyecto

### Problema aprendido de TraeGo
El `dashboard.js` monolítico se convierte en un archivo inmanejable. Citum nace con una arquitectura modular desde el día 1.

### Estructura de archivos
```
citum/
├── index.html              → Landing page
├── login.html              → Auth
├── panel.html              → Shell del dashboard (SPA)
├── booking.html            → Shell de la UI pública de agendamiento
│
├── src/
│   ├── main.js             → Entry Vite (landing)
│   ├── panel.js            → Router del panel (SPA orchestrator)
│   ├── booking.js          → Router del agendamiento público
│   │
│   ├── core/
│   │   ├── supabase.js     → Cliente Supabase singleton
│   │   ├── auth.js         → Sesión, login, logout
│   │   ├── router.js       → Lógica de sección activa (SPA)
│   │   └── permissions.js  → PermissionManager (plan-gating)
│   │
│   ├── sections/           → Módulos del panel (carga dinámica)
│   │   ├── agenda.js
│   │   ├── profesionales.js
│   │   ├── servicios.js
│   │   ├── negocios.js
│   │   └── facturacion.js
│   │
│   ├── booking/            → Módulos del flujo público
│   │   ├── catalogo.js
│   │   ├── seleccion.js
│   │   └── confirmacion.js
│   │
│   ├── components/         → UI reutilizable
│   │   ├── sidebar.js
│   │   ├── header.js
│   │   ├── modal.js
│   │   ├── toast.js
│   │   └── calendar.js
│   │
│   └── utils/
│       ├── pdf.js          → Generación de tickets PDF
│       ├── format.js       → Fechas, moneda, etc.
│       └── availability.js → Lógica de disponibilidad de citas
│
└── styles/
    ├── tokens.css          → Variables (sección 2)
    ├── base.css            → Reset + tipografía global
    ├── panel.css           → Estilos del dashboard
    ├── booking.css         → Estilos UI pública
    └── landing.css         → Estilos landing page
```

### Patrón SPA del panel
```js
// panel.js — orchestrator liviano
async function navigate(section) {
  const mod = await import(`./sections/${section}.js`);
  mod.init(document.getElementById('main-content'));
  setActiveNav(section);
}
```
Cada módulo exporta `init(container)` y maneja su propio estado interno. Vite hace code-splitting automático.

### Rutas del proyecto
| URL | Destino |
|---|---|
| `citum.app/` | Landing page |
| `citum.app/login` | Auth (login / registro) |
| `citum.app/panel` | Panel del propietario |
| `citum.app/b/{slug}` | UI pública del negocio (cliente final) |

---

## 5. Base de Datos (Supabase)

### Tablas principales

#### `users` (gestionada por Supabase Auth)
Se extiende con `user_profiles`:

```sql
user_profiles
  id          uuid  PK → auth.users.id
  full_name   text
  plan_id     text  → 'esencial' | 'pro' | 'max'
  created_at  timestamptz
```

#### `businesses`
```sql
businesses
  id            uuid  PK
  user_id       uuid  → user_profiles.id
  name          text
  slug          text  UNIQUE  ← nunca editable post-creación
  address       text
  phone         text
  email         text
  description   text
  city          text
  plan_id       text  (hereda del user pero puede override futuro)
  created_at    timestamptz
```

#### `professionals`
```sql
professionals
  id            uuid  PK
  business_id   uuid  → businesses.id
  name          text
  role          text  (ej: "Odontólogo", "Estilista", "Asesor")
  phone         text
  avatar_url    text
  is_active     bool
  created_at    timestamptz
```

#### `professional_schedules`
```sql
professional_schedules
  id               uuid  PK
  professional_id  uuid  → professionals.id
  day_of_week      int   (0=Dom, 1=Lun ... 6=Sáb)
  start_time       time
  end_time         time
  is_available     bool  (false = día libre)
```

#### `professional_breaks`
```sql
professional_breaks
  id               uuid  PK
  professional_id  uuid  → professionals.id
  day_of_week      int
  start_time       time
  end_time         time
  label            text  (ej: "Almuerzo")
```

#### `services`
```sql
services
  id            uuid  PK
  business_id   uuid  → businesses.id
  name          text
  description   text
  price         numeric(10,2)
  duration_min  int   ← en minutos, crítico para disponibilidad
  is_active     bool
  created_at    timestamptz
```

#### `appointments`
```sql
appointments
  id                uuid  PK
  business_id       uuid  → businesses.id
  professional_id   uuid  → professionals.id
  client_name       text
  client_phone      text
  client_email      text  (nullable)
  starts_at         timestamptz
  ends_at           timestamptz  ← calculado: starts_at + SUM(durations)
  status            text  → 'pendiente' | 'confirmada' | 'completada' | 'cancelada' | 'no_asistio'
  notes             text
  source            text  → 'panel' | 'publica'
  created_at        timestamptz
```

#### `appointment_services`
```sql
appointment_services
  id              uuid  PK
  appointment_id  uuid  → appointments.id
  service_id      uuid  → services.id
  price_at_time   numeric(10,2)  ← precio capturado al momento
  duration_at_time int           ← duración capturada al momento
```

#### `invoices`
```sql
invoices
  id              uuid  PK
  business_id     uuid  → businesses.id
  appointment_id  uuid  → appointments.id (nullable — puede ser venta directa)
  client_name     text
  client_phone    text
  client_email    text
  subtotal        numeric(10,2)
  discount        numeric(10,2)  default 0
  total           numeric(10,2)
  payment_method  text  → 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'
  payment_notes   text
  status          text  → 'pagada' | 'pendiente' | 'anulada'
  invoice_number  text  (generado: CITA-0001, VCTA-0001)
  created_at      timestamptz
  created_by      uuid  → user_profiles.id
```

#### `invoice_items`
```sql
invoice_items
  id          uuid  PK
  invoice_id  uuid  → invoices.id
  service_id  uuid  → services.id (nullable)
  description text
  qty         int
  unit_price  numeric(10,2)
  total       numeric(10,2)
```

#### `plans`
```sql
plans
  id           text  PK  ('esencial' | 'pro' | 'max')
  name         text
  price_cop    int
  max_businesses  int
  max_professionals int
  features     jsonb   ← flags de funcionalidades
```

---

## 6. Sistema de Planes (desde el MVP)

### Plan IDs
- `esencial`
- `pro`
- `max`

### PermissionManager
```js
// core/permissions.js
export class PermissionManager {
  constructor(plan) {
    this.plan = plan;
    this.rules = {
      esencial: {
        max_businesses: 1,
        max_professionals: 3,
        invoicing: true,
        public_booking: true,
        advanced_reports: false,
        inventory: false,
      },
      pro: {
        max_businesses: 3,
        max_professionals: 10,
        invoicing: true,
        public_booking: true,
        advanced_reports: true,
        inventory: false,
      },
      max: {
        max_businesses: Infinity,
        max_professionals: Infinity,
        invoicing: true,
        public_booking: true,
        advanced_reports: true,
        inventory: true,  ← futuro
      }
    };
  }

  can(feature) {
    return this.rules[this.plan]?.[feature] ?? false;
  }

  limit(resource) {
    return this.rules[this.plan]?.[resource] ?? 0;
  }
}
```

En MVP todas las features están activas. El sistema queda listo para restringir cuando se active la monetización.

---

## 7. Lógica de Disponibilidad de Citas

Este es el núcleo más crítico del sistema.

### Reglas de negocio
1. Un profesional no puede tener dos citas que se solapen.
2. Las citas deben respetar el horario del profesional (`professional_schedules`).
3. Las citas no pueden caer en bloques de descanso (`professional_breaks`).
4. Si el cliente solicita N servicios con el mismo profesional, se encadenan en un solo bloque continuo.
5. Si el cliente solicita servicios con distintos profesionales, se busca que queden en el mismo bloque de tiempo (misma visita).
6. Los servicios tienen duración en minutos. `ends_at = starts_at + SUM(duration_min)`.

### Función clave en `utils/availability.js`
```js
// Retorna slots disponibles dado un profesional, fecha y duración total requerida
async function getAvailableSlots(professionalId, date, totalDurationMin) {
  // 1. Obtener horario del profesional para ese día de semana
  // 2. Obtener breaks del profesional para ese día
  // 3. Obtener citas confirmadas/pendientes de ese profesional en esa fecha
  // 4. Calcular slots libres de `totalDurationMin` minutos dentro del horario
  //    evitando solapamientos con citas existentes y breaks
  // 5. Retornar array de { startsAt, endsAt }
}
```

Esta función la llamará tanto el panel (crear cita manual) como la UI pública (booking del cliente).

---

## 8. Entornos del SaaS

### A. Panel del Propietario (`/panel`)

**Layout:** Sidebar fijo izquierda + Header superior + Área de contenido principal.

**Sidebar — secciones:**
- 📅 Agenda
- 👥 Profesionales
- 💼 Servicios
- 🏠 Negocios
- 🧾 Facturación
- ⚙️ Configuración (futura)

**Header:** Título de sección activa + Nombre del usuario + Botón Log out (+ futuras acciones contextuales).

**Comportamiento multi-negocio:** En secciones como Agenda, el panel muestra un selector de negocio (tabs o dropdown) si el usuario tiene más de uno.

### B. UI Pública de Agendamiento (`/b/{slug}`)

Una URL por negocio. Diseño limpio orientado al cliente final.

**Flujo del cliente:**
1. **Catálogo:** Ve los servicios del negocio con nombre, descripción, precio y duración.
2. **Selección de servicios:** Elige 1 o varios servicios. El sistema acumula la duración total.
3. **Selección de profesional(es):** Por cada servicio (o grupo de servicios), elige el profesional disponible. El sistema filtra quiénes están disponibles según la duración requerida.
4. **Selección de horario:** Muestra slots disponibles en un calendario/selector de fecha+hora. El sistema calcula disponibilidad real en tiempo real.
5. **Datos del cliente:** Nombre (req), teléfono (req), email (opcional).
6. **Confirmación:** Resumen + botón confirmar. La cita llega en tiempo real al panel del propietario vía Supabase Realtime.

**No hay Whatsapp en el flujo.** El propietario contacta directamente si lo necesita.

---

## 9. Facturación y POS

### Dos orígenes de una factura
1. **Desde cita agendada:** El propietario va a Agenda → selecciona una cita → "Facturar". Los servicios, profesional y datos del cliente se pre-llenan.
2. **Venta directa (sin cita):** El propietario crea una venta nueva, selecciona servicios, profesional disponible (respetando disponibilidad), ingresa datos del cliente.

### Datos de la factura
- Cabecera: Nombre del negocio, dirección, teléfono, email.
- Datos del cliente: nombre, teléfono, email.
- Listado de servicios: nombre, duración, precio unitario, subtotal.
- Descuento (opcional).
- Total.
- Método de pago: Efectivo / Transferencia / Tarjeta / Otro.
- Número de factura (correlativo por negocio).
- Fecha y hora.
- Profesional(es) que prestaron el servicio.

### Documentos imprimibles

**Ticket de cobro (cliente):** Formato vertical tipo thermal/ticket. B&N. Cabecera con info del negocio, servicios + precios, total, método de pago, pie con agradecimiento.

**Ticket de servicios (profesional):** Sin precios. Solo nombre del cliente, servicio(s) a realizar, hora de la cita. Para que el profesional sepa qué hacer y cuándo.

Ambos generados en PDF desde el cliente con **jsPDF**.

---

## 10. Diseño Responsivo

> ⚠️ **Para agentes — Reglas visuales de responsive:**
> Los principios de diseño responsivo (mobile principles, card padding, glassmorphism en móvil, etc.) están definidos en la sección **"Responsive Behavior"** de **[DESIGN.md](./DESIGN.md)**.

### Panel del propietario → Desktop First
El propietario gestiona su negocio desde un computador. El diseño se construye pensando en pantallas de 1280px en adelante y se adapta hacia abajo.

| Breakpoint | Comportamiento |
|---|---|
| ≥ 1280px | Layout completo: sidebar fijo + header + contenido |
| 1024px – 1279px | Sidebar se estrecha (solo íconos + tooltips) |
| 768px – 1023px | Sidebar colapsa a un drawer (hamburger en header) |
| < 768px | Drawer + layout de una columna. Funcional pero no optimizado |

**Regla:** el panel debe ser 100% usable en tablet (768px+). En móvil debe funcionar para consultas rápidas, no es el caso de uso principal.

### Catálogo público → Mobile First
El cliente final llega desde su teléfono. El flujo de agendamiento se diseña primero para 375px y se expande hacia pantallas más grandes.

| Breakpoint | Comportamiento |
|---|---|
| 375px – 767px | Layout de una columna, cards grandes, botones full-width, fácil de tocar |
| 768px – 1023px | Grid de 2 columnas para servicios, flujo más amplio |
| ≥ 1024px | Contenedor centrado con max-width, se ve como microsite elegante |

**Regla:** cada paso del flujo de agendamiento debe ser completable con una mano en móvil. Sin scroll horizontal, sin elementos demasiado pequeños para tocar (mínimo 44px de touch target).

### Landing page → Mobile First
La landing también es mobile first. El visitante puede llegar desde redes sociales o búsqueda en móvil.

### Breakpoints estándar del proyecto
```css
/* tokens.css */
/* Mobile first: estilos base = móvil, luego se expande */
--bp-sm:  576px;
--bp-md:  768px;
--bp-lg:  1024px;
--bp-xl:  1280px;
--bp-2xl: 1536px;
```

```css
/* Uso en media queries */
@media (min-width: 768px)  { /* tablet+ */ }
@media (min-width: 1024px) { /* desktop+ */ }
@media (min-width: 1280px) { /* desktop wide */ }
```

---

## 11. Landing Page

> ⚠️ **Para agentes — Diseño de la landing:**
> Los estilos visuales de la landing (navbar, hero, cards, CTA, footer, tipografía, colores, botones) deben seguir el sistema definido en **[DESIGN.md](./DESIGN.md)**.

**Secciones:**
1. Navbar (logo/nombre + links + CTA "Empezar gratis")
2. Hero (headline, subheadline, CTA principal)
3. Benefits (3-4 beneficios clave con ícono)
4. Pricing (cards de los 3 planes)
5. FAQs (acordeón)
6. Footer (links, redes, contacto)

---

## 12. Roadmap Post-MVP

En orden de prioridad lógica:

1. **Inventario:** Control de productos/insumos. Descuento automático al facturar. Alertas de stock mínimo.
2. **Reportes avanzados:** Ingresos por período, por profesional, por servicio.
3. **Notificaciones:** Email/SMS al cliente al confirmar cita, recordatorio 24h antes.
4. **Clientes recurrentes:** Historial de visitas, preferencias, fidelización.
5. **App móvil:** Panel para propietario en React Native.
6. **Facturación electrónica (DIAN):** Integración con MATIAS API o Plemsi para emisión de FE.

---

## 13. Checklist de Inicio (Day 1)

- [ ] Crear proyecto en Supabase (prod + dev)
- [ ] Crear proyecto en Vite con estructura de carpetas definida
- [ ] Configurar variables de entorno (.env)
- [ ] Crear tablas en Supabase según sección 5
- [ ] Configurar RLS básico (cada user solo ve sus datos)
- [ ] Importar DM Sans + Lucide Icons
- [ ] Crear `tokens.css` con Design Token System completo
- [ ] Crear `base.css` con reset y estilos tipográficos
- [ ] Crear shell de `panel.html` con sidebar + header + contenedor
- [ ] Implementar `core/auth.js` (login, sesión, guard de ruta)
- [ ] Implementar `core/router.js` (navegación SPA)
- [ ] Implementar `core/permissions.js` (PermissionManager)
- [ ] Crear la tabla `plans` y seedear los 3 planes
- [ ] Conectar Vercel con el repo

---

*Documento generado para uso interno del proyecto Citum.*
