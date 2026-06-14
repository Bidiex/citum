// src/core/plans.js
// Fuente de verdad de planes, permisos y estado de suscripción de Citum

import { getActiveBusiness } from '../utils/businessState.js';

// ─── Definición de planes ────────────────────────────────────────────────────

export const PLAN_DEFINITIONS = {
  esencial: {
    id: 'esencial',
    name: 'Esencial',
    price_cop: 59000,
    badge_color: '#6b7280',
    features: {
      inventory: false,
      service_products: false,
      multiple_businesses: false,
      ai_agent: false,
    },
    limits: {
      max_businesses: 1,
      max_professionals: 3,
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price_cop: 89000,
    badge_color: '#8b5cf6',
    features: {
      inventory: true,
      service_products: true,
      multiple_businesses: true,
      ai_agent: false,
    },
    limits: {
      max_businesses: 3,
      max_professionals: 10,
    }
  },
  max: {
    id: 'max',
    name: 'Max',
    price_cop: 129000,
    badge_color: '#f59e0b',
    features: {
      inventory: true,
      service_products: true,
      multiple_businesses: true,
      ai_agent: true,
    },
    limits: {
      max_businesses: Infinity,
      max_professionals: Infinity,
    }
  }
};

// ─── Plan mínimo requerido por feature ───────────────────────────────────────
// Usado por el upgrade modal para saber qué plan mostrar

export const FEATURE_PLAN_MAP = {
  inventory: 'pro',
  service_products: 'pro',
  multiple_businesses: 'pro',
  ai_agent: 'max',
};

// ─── Estado del plan activo ──────────────────────────────────────────────────

export function getActivePlan() {
  const biz = getActiveBusiness();
  return biz?.plan || 'esencial';
}

export function getPlanDefinition(planId = null) {
  const plan = planId || getActivePlan();
  return PLAN_DEFINITIONS[plan] || PLAN_DEFINITIONS.esencial;
}

export function isPlanExpired() {
  const biz = getActiveBusiness();
  if (!biz) return true;
  const expires = biz.plan_expires_at;
  const trial = biz.trial_ends_at;
  const now = new Date();
  const hasActiveSubscription = expires && new Date(expires) > now;
  const hasActiveTrial = trial && new Date(trial) > now;
  return !hasActiveSubscription && !hasActiveTrial;
}

export function isInTrial() {
  const biz = getActiveBusiness();
  if (!biz) return false;
  const trial = biz.trial_ends_at;
  const expires = biz.plan_expires_at;
  const now = new Date();
  const hasActiveSub = expires && new Date(expires) > now;
  return !hasActiveSub && trial && new Date(trial) > now;
}

export function trialDaysLeft() {
  const biz = getActiveBusiness();
  if (!biz?.trial_ends_at) return 0;
  const diff = new Date(biz.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function daysUntilExpiry() {
  const biz = getActiveBusiness();
  if (!biz?.plan_expires_at) return 0;
  const diff = new Date(biz.plan_expires_at) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Verificación de permisos ────────────────────────────────────────────────

export function can(feature) {
  const plan = getActivePlan();
  const def = PLAN_DEFINITIONS[plan];
  if (!def) return false;
  return def.features[feature] ?? true; // si no está definido, asumir true
}

export function limit(resource) {
  const plan = getActivePlan();
  const def = PLAN_DEFINITIONS[plan];
  if (!def) return 0;
  return def.limits[resource] ?? Infinity;
}

export function canUseFeature(feature) {
  // Combina verificación de plan + verificación de que no esté vencido
  if (isPlanExpired()) return false;
  return can(feature);
}

// ─── Helper para el badge de plan en la UI ───────────────────────────────────

export function getRequiredPlanForFeature(feature) {
  const requiredPlanId = FEATURE_PLAN_MAP[feature];
  if (!requiredPlanId) return null;
  return PLAN_DEFINITIONS[requiredPlanId];
}

export function formatPrice(price_cop) {
  return `$${Number(price_cop).toLocaleString('es-CO')}`;
}
