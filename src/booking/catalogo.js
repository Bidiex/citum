// catalogo.js — Módulo del paso 1: Catálogo de Servicios

export function init(container, state, actions) {
  // Lista de servicios de prueba
  const mockServices = [
    { id: 'srv-1', name: 'Corte de Cabello Premium', desc: 'Lavado, corte personalizado, asesoría de estilo y peinado con cera.', price: 35000, duration: 40 },
    { id: 'srv-2', name: 'Afeitado de Barba Ritual', desc: 'Afeitado tradicional con toalla caliente, aceites esenciales y masaje facial.', price: 25000, duration: 30 },
    { id: 'srv-3', name: 'Perfilado de Cejas', desc: 'Diseño y limpieza de cejas con cera e hilo.', price: 12000, duration: 15 },
    { id: 'srv-4', name: 'Combo Imperial', desc: 'Corte de cabello + afeitado ritual + mascarilla facial hidratante.', price: 55000, duration: 75 }
  ];

  // Renderizar la vista
  container.innerHTML = `
    <div class="flow-view">
      <div>
        <h2 class="flow-title">Elige tus servicios</h2>
        <p class="flow-subtitle">Selecciona uno o más servicios para agendar tu cita.</p>
      </div>

      <div class="booking-services-list" id="services-list">
        ${mockServices.map(srv => {
          const isSelected = state.selectedServices.some(s => s.id === srv.id);
          return `
            <div class="booking-service-card ${isSelected ? 'selected' : ''}" data-id="${srv.id}">
              <div class="service-card-info">
                <span class="service-card-name">${srv.name}</span>
                <span class="service-card-desc">${srv.desc}</span>
                <div class="service-card-meta">
                  <span class="meta-pill price">COP $${srv.price.toLocaleString('es-CO')}</span>
                  <span class="meta-pill">${srv.duration} min</span>
                </div>
              </div>
              <div class="service-card-action">
                <i data-lucide="${isSelected ? 'check' : 'plus'}" size="14"></i>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Barra Flotante de Compra -->
    <div class="booking-float-bar" id="booking-total-bar" style="display: ${state.selectedServices.length > 0 ? 'block' : 'none'};">
      <div class="booking-float-container">
        <div class="float-bar-info">
          <span class="float-bar-count" id="float-selected-count">${state.selectedServices.length} servicio(s) seleccionado(s)</span>
          <span class="float-bar-total" id="float-total-price">Total: COP $0</span>
        </div>
        <button class="btn btn-primary" id="btn-next-step-1">Siguiente</button>
      </div>
    </div>
  `;

  // Inicializar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Actualizar totales mostrados en la barra flotante
  const updateFloatBar = () => {
    const totalBar = document.getElementById('booking-total-bar');
    const selectedCount = document.getElementById('float-selected-count');
    const totalPrice = document.getElementById('float-total-price');
    const nextBtn = document.getElementById('btn-next-step-1');

    const total = state.selectedServices.reduce((sum, s) => sum + s.price, 0);
    
    if (state.selectedServices.length > 0) {
      totalBar.style.display = 'block';
      selectedCount.textContent = `${state.selectedServices.length} servicio(s) seleccionado(s)`;
      totalPrice.textContent = `Total: COP $${total.toLocaleString('es-CO')}`;
      nextBtn.removeAttribute('disabled');
    } else {
      totalBar.style.display = 'none';
    }
  };

  // Inicializar barra si hay datos previos
  updateFloatBar();

  // Enlazar clics de las tarjetas de servicio
  const cards = container.querySelectorAll('.booking-service-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const srvId = card.getAttribute('data-id');
      const service = mockServices.find(s => s.id === srvId);
      
      const index = state.selectedServices.findIndex(s => s.id === srvId);
      const actionIcon = card.querySelector('.service-card-action i');

      if (index === -1) {
        // Seleccionar
        state.selectedServices.push(service);
        card.classList.add('selected');
        if (actionIcon && typeof lucide !== 'undefined') {
          actionIcon.outerHTML = '<i data-lucide="check" size="14"></i>';
        }
      } else {
        // Deseleccionar
        state.selectedServices.splice(index, 1);
        card.classList.remove('selected');
        if (actionIcon && typeof lucide !== 'undefined') {
          actionIcon.outerHTML = '<i data-lucide="plus" size="14"></i>';
        }
      }

      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      updateFloatBar();
    });
  });

  // Botón Siguiente
  const nextBtn = container.querySelector('#btn-next-step-1');
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.next();
    });
  }
}
