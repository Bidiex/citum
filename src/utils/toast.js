/**
 * Sistema Global de Notificaciones (Toast)
 */

export function showToast(optionsOrTitle, subtitle = '', type = 'info', duration = 3500) {
  let title = '';
  let sub = subtitle;
  let t = type;
  let dur = duration;

  // Si se pasa un objeto
  if (typeof optionsOrTitle === 'object' && optionsOrTitle !== null) {
    title = optionsOrTitle.title || '';
    sub = optionsOrTitle.subtitle || '';
    t = optionsOrTitle.type || 'info';
    dur = optionsOrTitle.duration !== undefined ? optionsOrTitle.duration : 3500;
  } else {
    title = optionsOrTitle || '';
  }

  // Asegurar que exista el contenedor
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Limitar el número de toasts a 3
  const activeToasts = container.querySelectorAll('.toast-item');
  if (activeToasts.length >= 3) {
    // Eliminar el más antiguo (el primero)
    const oldest = activeToasts[0];
    oldest.classList.remove('show');
    setTimeout(() => oldest.remove(), 300);
  }

  // Crear el elemento toast
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${t}`;

  // Determinar icono según tipo
  let iconName = 'info';
  if (t === 'success') iconName = 'check-circle';
  if (t === 'error') iconName = 'x-circle';
  if (t === 'warning') iconName = 'alert-triangle';

  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-content">
      <h4 class="toast-title">${title}</h4>
      ${sub ? `<p class="toast-subtitle">${sub}</p>` : ''}
    </div>
    <button class="toast-close-btn" aria-label="Cerrar">
      <i data-lucide="x"></i>
    </button>
  `;

  // Insertar en el contenedor
  container.appendChild(toast);

  // Inicializar iconos de Lucide en este toast
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ node: toast });
  }

  // Animación de entrada
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Evento para cerrar al hacer clic en el botón de cerrar
  const closeBtn = toast.querySelector('.toast-close-btn');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissToast(toast);
  });

  // También se puede cerrar haciendo clic en cualquier parte del toast
  toast.addEventListener('click', () => {
    dismissToast(toast);
  });

  // Temporizador para auto-dismiss
  let dismissTimeout = null;
  if (dur > 0) {
    dismissTimeout = setTimeout(() => {
      dismissToast(toast);
    }, dur);
  }

  function dismissToast(el) {
    if (dismissTimeout) clearTimeout(dismissTimeout);
    el.classList.remove('show');
    // Esperar a que termine la transición CSS de salida
    el.addEventListener('transitionend', () => {
      el.remove();
    });
    // Fallback por si transitionend no dispara
    setTimeout(() => {
      el.remove();
    }, 400);
  }
}
