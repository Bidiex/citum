// src/core/payments.js
// Integración con Wompi Widget y manejo de estados de pago de suscripciones

import { getActiveBusiness, refreshBusinessCache } from '../utils/businessState.js';
import { getPlanDefinition } from './plans.js';
import { supabase } from './supabase.js';

export async function initWompiPayment(planId) {
  const plan = getPlanDefinition(planId);
  const biz = getActiveBusiness();

  if (!biz) {
    console.error('No hay un negocio activo para iniciar el pago');
    return;
  }

  // 1. Crear referencia única de pago
  const reference = `citum_${biz.id}_${planId}_${Date.now()}`;

  // 2. Guardar pago pendiente en subscription_payments
  const { error: insertError } = await supabase.from('subscription_payments').insert({
    business_id: biz.id,
    plan_id: planId,
    amount_cop: plan.price_cop,
    wompi_ref: reference,
    status: 'pending'
  });

  if (insertError) {
    console.error('Error al registrar intento de pago:', insertError);
    return;
  }

  // 3. Calcular firma de integridad (SHA256)
  const { data: signatureData, error: signatureError } = await supabase.functions.invoke('wompi-signature', {
    body: { reference, amount_cents: plan.price_cop * 100 }
  });

  if (signatureError || !signatureData?.signature) {
    console.error('Error obteniendo firma de Wompi:', signatureError);
    return;
  }

  // 4. Inyectar y abrir el widget de Wompi
  const script = document.createElement('script');
  script.src = 'https://checkout.wompi.co/widget.js';
  script.setAttribute('data-render', 'button');
  script.setAttribute('data-public-key', import.meta.env.VITE_WOMPI_PUBLIC_KEY);
  script.setAttribute('data-currency', 'COP');
  script.setAttribute('data-amount-in-cents', String(plan.price_cop * 100));
  script.setAttribute('data-reference', reference);
  script.setAttribute('data-signature:integrity', signatureData.signature);
  script.setAttribute('data-redirect-url', `${window.location.origin}/panel.html?payment=success&plan=${planId}`);
  
  const widgetContainer = document.createElement('div');
  widgetContainer.style.display = 'none';
  widgetContainer.appendChild(script);
  document.body.appendChild(widgetContainer);

  setTimeout(() => {
    const btn = widgetContainer.querySelector('button');
    if (btn) btn.click();
  }, 500);
}

export async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') !== 'success') return;

  const planId = params.get('plan');

  await refreshBusinessCache(); 

  window.history.replaceState({}, '', '/panel.html');

  try {
    const { showToast } = await import('../utils/toast.js');
    showToast({
      title: '🎉 ¡Plan activado!',
      subtitle: `Tu plan ${planId} está activo. Tienes 30 días de acceso.`,
      type: 'success'
    });
  } catch (e) {
    console.log(`🎉 ¡Plan ${planId} activado con éxito!`);
  }
}
