// main.js — Script para la Landing Page de Citum

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Íconos Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // 2. Navbar Efecto Scroll (Sticky Glassmorphism)
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 3. Menú Móvil Hamburger
  const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
  const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
  
  if (mobileMenuBtn && mobileNavOverlay) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mobileNavOverlay.classList.toggle('open');
      mobileMenuBtn.setAttribute('aria-expanded', isOpen);
      
      // Cambiar ícono Lucide entre menú y cerrar (x)
      const icon = mobileMenuBtn.querySelector('i');
      if (icon) {
        if (isOpen) {
          icon.setAttribute('data-lucide', 'x');
        } else {
          icon.setAttribute('data-lucide', 'menu');
        }
        if (typeof lucide !== 'undefined') {
          lucide.createIcons({ node: mobileMenuBtn });
        }
      }
    });

    // Cerrar menú al hacer clic en un enlace móvil
    mobileNavOverlay.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavOverlay.classList.remove('open');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', 'menu');
          if (typeof lucide !== 'undefined') {
            lucide.createIcons({ node: mobileMenuBtn });
          }
        }
      });
    });
  }

  // 4. Toggle de Precios Mensual / Anual
  const billingSwitch = document.getElementById('billing-switch');
  const billingContainer = document.getElementById('pricing-billing-toggle');
  const labelMonthly = document.getElementById('label-monthly');
  const labelYearly = document.getElementById('label-yearly');
  
  // Elementos de precio
  const pricePro = document.getElementById('price-pro');
  const priceMax = document.getElementById('price-max');
  const periodPro = document.getElementById('period-pro');
  const periodMax = document.getElementById('period-max');

  if (billingSwitch && billingContainer) {
    const toggleBilling = () => {
      const isYearly = billingContainer.classList.toggle('yearly');
      
      if (isYearly) {
        labelYearly.classList.add('active');
        labelMonthly.classList.remove('active');
        
        // Asignar precios anuales
        if (pricePro) pricePro.textContent = pricePro.getAttribute('data-yearly');
        if (priceMax) priceMax.textContent = priceMax.getAttribute('data-yearly');
        if (periodPro) periodPro.textContent = '/ mes (facturado anual)';
        if (periodMax) periodMax.textContent = '/ mes (facturado anual)';
      } else {
        labelMonthly.classList.add('active');
        labelYearly.classList.remove('active');
        
        // Asignar precios mensuales
        if (pricePro) pricePro.textContent = pricePro.getAttribute('data-monthly');
        if (priceMax) priceMax.textContent = priceMax.getAttribute('data-monthly');
        if (periodPro) periodPro.textContent = '/ mes';
        if (periodMax) periodMax.textContent = '/ mes';
      }
    };

    billingSwitch.addEventListener('click', toggleBilling);
    labelMonthly.addEventListener('click', () => {
      if (billingContainer.classList.contains('yearly')) toggleBilling();
    });
    labelYearly.addEventListener('click', () => {
      if (!billingContainer.classList.contains('yearly')) toggleBilling();
    });
  }

  // 5. Acordeón de Preguntas Frecuentes (FAQs)
  const faqItems = document.querySelectorAll('.faq-item');
  
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question-btn');
    const answer = item.querySelector('.faq-answer');
    
    if (btn && answer) {
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        
        // Cerrar otros acordeones abiertos (opcional, para comportamiento exclusivo)
        faqItems.forEach(otherItem => {
          if (otherItem !== item && otherItem.classList.contains('open')) {
            otherItem.classList.remove('open');
            otherItem.querySelector('.faq-answer').style.maxHeight = null;
            const otherIcon = otherItem.querySelector('.faq-question-btn i');
            if (otherIcon) otherIcon.setAttribute('data-lucide', 'plus');
          }
        });

        // Alternar el acordeón seleccionado
        item.classList.toggle('open');
        const icon = btn.querySelector('i');

        if (item.classList.contains('open')) {
          answer.style.maxHeight = answer.scrollHeight + 'px';
          if (icon && typeof lucide !== 'undefined') {
            icon.setAttribute('data-lucide', 'minus');
            lucide.createIcons();
          }
        } else {
          answer.style.maxHeight = null;
          if (icon && typeof lucide !== 'undefined') {
            icon.setAttribute('data-lucide', 'plus');
            lucide.createIcons();
          }
        }
      });
    }
  });
});
