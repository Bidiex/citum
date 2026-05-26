# DESIGN.md — Crypto Neon UI System

> **Regla Suprema:** Todo agente que necesite tomar decisiones de diseño visual DEBE consultar este documento antes de escribir cualquier CSS, HTML estructural o componente UI. Este archivo es la fuente única de verdad de diseño para el proyecto.

---

## 1. Filosofía Visual

El diseño pertenece a una estética:

* **Dark Futuristic SaaS**
* **Crypto / Fintech Premium**
* **Glassmorphism suave**
* **Neon gradients**
* **Minimalismo geométrico**
* **High contrast UI**
* **Rounded modern interfaces**
* **Luxury digital dashboard**

La identidad transmite:

* Tecnología avanzada
* Seguridad financiera
* Plataforma premium
* Sofisticación
* Escalabilidad
* Ecosistema Web3 moderno

---

## 2. ADN Visual del Sistema

### Core Visual Keywords

* Neon Purple
* Deep Space Background
* Soft Glow
* Rounded Cards
* Floating UI
* Smooth Shadows
* Thin Typography
* Minimal Borders
* Glass Surfaces
* Purple Accent Gradients
* Premium SaaS Layout
* Symmetry
* Strong Hierarchy

---

## 3. Sistema de Color

### Primary Purple (Compartida)

```css
--primary-50:  #F4EEFF;
--primary-100: #E6D9FF;
--primary-200: #C7AFFF;
--primary-300: #A477FF;
--primary-400: #8C52FF;
--primary-500: #7B3FF2;
--primary-600: #6A2DE2;
--primary-700: #5620BF;
--primary-800: #431A92;
--primary-900: #2B1166;
```

### Tema Oscuro (Dark Theme Surfaces)

```css
--bg-primary:    #0B0820;
--bg-secondary:  #131033;
--bg-card:       #211A4B;
--bg-card-hover: #2A2160;
--bg-elevated:   #31256E;

--accent-purple: #8B5CFF;
--accent-violet: #A855F7;
--accent-blue:   #6D5DFE;
--accent-neon:   #B388FF;

--text-primary:   #F5F3FF;
--text-secondary: #B7B4D2;
--text-muted:     #8E8AAE;
--border-soft:    rgba(255, 255, 255, 0.08);
```

### Tema Claro (Light Theme Surfaces)

```css
--bg-primary:    #F8F6FC;
--bg-secondary:  #F1EDFA;
--bg-card:       #FFFFFF;
--bg-card-hover: #FAF8FF;
--bg-elevated:   #EAE3F7;

--accent-purple: #7B3FF2;
--accent-violet: #9333EA;
--accent-blue:   #4F46E5;
--accent-neon:   #6366F1;

--text-primary:   #181135;
--text-secondary: #5E5587;
--text-muted:     #8B82B5;
--border-soft:    rgba(24, 17, 53, 0.08);
```

---

## 4. Gradientes Oficiales

### Main Brand Gradient

```css
background: linear-gradient(
  135deg,
  #6D3BFF 0%,
  #8C52FF 45%,
  #A855F7 100%
);
```

### Card Glow Gradient

```css
background: linear-gradient(
  180deg,
  rgba(140, 82, 255, 0.18),
  rgba(140, 82, 255, 0.05)
);
```

### CTA Gradient

```css
background: linear-gradient(
  90deg,
  #6D3BFF,
  #8C52FF
);
```

---

## 5. Tipografía

### Estilo Tipográfico

* Sans serif geométrica
* Moderna
* Alta legibilidad
* Peso semibold dominante
* Tracking ligeramente expandido

### Fuente Oficial Obligatoria

> ⚠️ **REGLA ABSOLUTA E IRREFUTABLE:** La única fuente permitida en todo el proyecto es **DM Sans**. Ninguna otra tipografía, alternativa o secundaria está permitida bajo ningún concepto.

### Escala Tipográfica

```css
/* Display */
font-size: 64px;
font-weight: 700;
line-height: 1.1;

/* H1 */
font-size: 48px;
font-weight: 700;

/* H2 */
font-size: 36px;
font-weight: 700;

/* H3 */
font-size: 28px;
font-weight: 600;

/* Body */
font-size: 16px;
font-weight: 400;
line-height: 1.7;

/* Caption */
font-size: 13px;
letter-spacing: 0.08em;
text-transform: uppercase;
```

---

## 6. Sistema de Espaciado

### Base Grid: `4px`

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-6:  24px;
--space-8:  32px;
--space-12: 48px;
--space-16: 64px;
--space-24: 96px;
--space-32: 128px;
```

---

## 7. Border Radius System

```css
--radius-xs:   8px;
--radius-sm:   12px;
--radius-md:   18px;
--radius-lg:   24px;
--radius-xl:   32px;
--radius-pill: 999px;
```

---

## 8. Sombras y Glow System

### Soft Card Shadow

```css
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
```

### Purple Glow

```css
box-shadow:
  0 0 0   rgba(139, 92, 255, 0),
  0 0 20px rgba(139, 92, 255, 0.35),
  0 0 60px rgba(139, 92, 255, 0.15);
```

### Elevated Hover

```css
box-shadow:
  0 15px 45px rgba(0, 0, 0, 0.45),
  0 0 30px   rgba(139, 92, 255, 0.25);
```

---

## 9. Layout System

### Container Width

```css
max-width: 1280px;
padding-inline: 32px;
```

### Grid System

```css
/* Desktop */
display: grid;
grid-template-columns: repeat(12, 1fr);
gap: 24px;

/* Tablet */
grid-template-columns: repeat(8, 1fr);
gap: 20px;

/* Mobile */
grid-template-columns: repeat(4, 1fr);
gap: 16px;
```

---

## 10. Cards System

### Card DNA

Todas las cards deben tener:

* Fondo púrpura oscuro
* Bordes suaves
* Glow ligero
* Mucho padding interno
* Jerarquía tipográfica clara
* Elevación sutil

### Card Structure

```
Card
 ├── Badge
 ├── Title
 ├── Price / Metric
 ├── Description
 ├── Features
 ├── CTA Primary
 └── CTA Secondary
```

### Card Styling

```css
.card {
  background: var(--bg-card);
  border-radius: 24px;
  border: 1px solid var(--border-soft);
  padding: 32px;
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
              background 250ms cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  transform: translateY(-4px);
  background: var(--bg-card-hover);
  box-shadow: var(--shadow-hover);
}
```

---

## 11. Botones

### Primary Button

```css
.btn-primary {
  height: 56px;
  padding: 0 32px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: linear-gradient(90deg, #6D3BFF, #8C52FF);
  border: none;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 0 20px rgba(139, 92, 255, 0.35);
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
              filter  250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
}
```

### Secondary Button

```css
.btn-secondary {
  height: 56px;
  padding: 0 32px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: #ffffff;
  color: #0B0820;
  border: none;
  cursor: pointer;
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
              filter  250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-secondary:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
}
```

---

## 12. Iconografía

### Estilo

* Icons filled
* Rounded containers
* Minimal detail
* Monochromatic
* Neon purple accents

### Tamaños

```css
16px | 20px | 24px | 32px
```

### Icon Containers

```css
.icon-container {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: rgba(139, 92, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 13. Navbar System

### Estructura

```
Logo — Navigation Links — Action Area — CTA Button
```

### Características

* Transparente sobre dark background
* Mucho spacing horizontal
* Links minimalistas
* CTA dominante

### Navbar Height

```css
height: 88px;
```

---

## 14. Footer System

### Layout

```
Logo — Navigation Columns — Social Icons — Download CTA — Copyright
```

### Footer Visual Rules

* Fondo ligeramente más claro que el background principal
* Separadores sutiles
* Mucho espacio negativo
* Tipografía pequeña y elegante

---

## 15. Inputs & Forms

### Input Style

```css
.input {
  height: 56px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 0 20px;
  color: var(--text-primary);
  font-size: 16px;
  transition: border-color 250ms ease, box-shadow 250ms ease;
  outline: none;
}
```

### Focus State

```css
.input:focus {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 4px rgba(140, 82, 255, 0.15);
}
```

---

## 16. Dropdowns

### Estilo

* Dark floating panel
* Rounded XL (`border-radius: 24px`)
* `backdrop-filter: blur(18px)`
* Smooth fade-in animation (`opacity 0→1, translateY -8px→0`)

---

## 17. Modal System

### Modal Backdrop

```css
.modal-backdrop {
  background: rgba(5, 5, 15, 0.7);
  backdrop-filter: blur(12px);
}
```

### Modal Surface

```css
.modal {
  background: var(--bg-elevated);
  border-radius: 28px;
  padding: 40px;
  border: 1px solid var(--border-soft);
}
```

---

## 18. Animaciones

### Motion Philosophy

Todo movimiento debe sentirse: fluido, premium, ligero, no agresivo, cinemático.

### Timing Estándar

```css
transition: 250ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Hover Lift

```css
transform: translateY(-3px);
```

### Glow Pulse

```css
@keyframes glowPulse {
  0%   { box-shadow: 0 0 0   rgba(139, 92, 255, 0); }
  50%  { box-shadow: 0 0 25px rgba(139, 92, 255, 0.35); }
  100% { box-shadow: 0 0 0   rgba(139, 92, 255, 0); }
}
```

---

## 19. Glassmorphism Rules

```css
/* Blur layer */
backdrop-filter: blur(18px);

/* Surface transparency */
background: rgba(33, 26, 75, 0.72);

/* Combined glass surface */
.glass {
  background: rgba(33, 26, 75, 0.72);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
}
```

---

## 20. Responsive Behavior

### Mobile Principles

* Stack vertical
* Cards full width
* Reduce padding
* Simplify navigation
* Preserve glow hierarchy

### Mobile Card Padding

```css
@media (max-width: 768px) {
  .card {
    padding: 24px;
  }
}
```

---

## 21. Design Tokens — CSS Custom Properties

El sistema soporta Light/Dark themes declarando las variables correspondientes según el atributo `data-theme`.

```css
/* Base tokens que no cambian entre temas */
:root {
  /* Spacing */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --space-32: 128px;

  /* Border Radius */
  --radius-xs:   8px;
  --radius-sm:   12px;
  --radius-md:   18px;
  --radius-lg:   24px;
  --radius-xl:   32px;
  --radius-pill: 999px;

  /* Typography */
  --font-primary: 'DM Sans', sans-serif;
  --text-xs:   13px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-lg:   18px;
  --text-xl:   22px;
  --text-2xl:  28px;
  --text-3xl:  36px;
  --text-4xl:  48px;
  --text-5xl:  64px;

  /* Motion */
  --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Tema Oscuro (Por defecto o data-theme="dark") */
:root, [data-theme="dark"] {
  /* Backgrounds */
  --bg-primary:    #0B0820;
  --bg-secondary:  #131033;
  --bg-card:       #211A4B;
  --bg-card-hover: #2A2160;
  --bg-elevated:   #31256E;

  /* Accents */
  --accent-purple: #8B5CFF;
  --accent-violet: #A855F7;
  --accent-blue:   #6D5DFE;
  --accent-neon:   #B388FF;

  /* Text */
  --text-primary:   #F5F3FF;
  --text-secondary: #B7B4D2;
  --text-muted:     #8E8AAE;
  --border-soft:    rgba(255, 255, 255, 0.08);

  /* Shadows & Glow */
  --shadow-card:    0 10px 30px rgba(0, 0, 0, 0.35);
  --shadow-glow:    0 0 20px rgba(139, 92, 255, 0.35),
                    0 0 60px rgba(139, 92, 255, 0.15);
  --shadow-hover:   0 15px 45px rgba(0, 0, 0, 0.45),
                    0 0 30px rgba(139, 92, 255, 0.25);
}

/* Tema Claro (data-theme="light") */
[data-theme="light"] {
  /* Backgrounds */
  --bg-primary:    #F8F6FC;
  --bg-secondary:  #F1EDFA;
  --bg-card:       #FFFFFF;
  --bg-card-hover: #FAF8FF;
  --bg-elevated:   #EAE3F7;

  /* Accents */
  --accent-purple: #7B3FF2;
  --accent-violet: #9333EA;
  --accent-blue:   #4F46E5;
  --accent-neon:   #6366F1;

  /* Text */
  --text-primary:   #181135;
  --text-secondary: #5E5587;
  --text-muted:     #8B82B5;
  --border-soft:    rgba(24, 17, 53, 0.08);

  /* Shadows & Glow */
  --shadow-card:    0 10px 30px rgba(24, 17, 53, 0.06);
  --shadow-glow:    0 0 20px rgba(139, 92, 255, 0.15),
                    0 0 40px rgba(139, 92, 255, 0.08);
  --shadow-hover:   0 15px 45px rgba(24, 17, 53, 0.12),
                    0 0 30px rgba(139, 92, 255, 0.18);
}
```

---

## 22. Component Inventory

### Core Components

* Navbar
* Hero
* Pricing Cards
* Feature Cards
* Token Widgets
* Crypto Stats
* Dashboard Panels
* Wallet Cards
* CTA Sections
* Footer
* Forms
* Dropdowns
* Modals
* Toasts
* Sidebars
* Tabs
* Accordions
* Data Tables
* Charts
* Authentication Screens

---

## 23. Charts & Data Visualization

### Chart Style Rules

* Fondo transparente
* Líneas neon
* Grid extremadamente sutil
* Rounded tooltips
* Glow en líneas activas

### Data Colors

```css
--chart-profit:  #8C52FF;
--chart-loss:    #FF5A7A;
--chart-neutral: #B7B4D2;
```

---

## 24. Estado de Componentes

```css
/* Hover */
filter: brightness(1.05);
transform: translateY(-2px);

/* Active */
transform: scale(0.98);

/* Disabled */
opacity: 0.4;
pointer-events: none;
```

---

## 25. Accesibilidad

* Contraste AA mínimo en todo texto
* Touch targets mínimo `44px`
* Focus visible siempre (`outline` o `box-shadow` visible)
* Tipografía nunca menor a `13px`
* `@media (prefers-reduced-motion: reduce)` para desactivar animaciones

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 26. Principios de Consistencia

Todo componente DEBE:

* Usar radius grandes (`--radius-lg` o mayor)
* Mantener padding generoso
* Tener glow sutil en hover
* Mantener tonos oscuros premium
* Respetar jerarquía tipográfica
* Utilizar spacing consistente con la escala de `4px`
* Tener animaciones suaves (`--transition-base`)
* Evitar bordes duros
* Mantener apariencia "floating"

---

## 27. Anti-Patterns (Prohibidos)

❌ Colores saturados fuera de la paleta definida  
❌ Bordes cuadrados (`border-radius: 0`)  
❌ Sombras negras agresivas sin blur  
❌ Tipografía serif  
❌ Gradientes multicolor incoherentes  
❌ Animaciones bruscas o sin `ease`  
❌ Espaciado inconsistente (fuera de la escala de 4px)  
❌ Elementos flat sin profundidad ni glow  
❌ UI extremadamente compacta (padding < 16px en cards)  

---

## 28. Brand Personality

La UI debe sentirse:

* Premium
* Tecnológica
* Futurista
* Segura
* Minimalista
* Elegante
* Sofisticada
* Moderna
* Escalable
* Web3-native

---

## 29. Regla Suprema del Sistema

> Todo elemento visual debe parecer parte de un mismo ecosistema futurista premium basado en **superficies oscuras**, **glow púrpura**, **geometría suave**, **profundidad elegante** y **minimalismo tecnológico**.

> **Para cualquier agente:** Si tienes una duda de diseño — color, espaciado, tipografía, radio, sombra, animación o componente — la respuesta está en este archivo. No improvises valores fuera de este sistema.
