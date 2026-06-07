/**
 * Sistema Global de Diálogo de Confirmación
 */

export function showConfirm({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger', // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel
}) {
  return new Promise((resolve) => {
    // Crear el overlay del diálogo
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';

    // Determinar icono por variante
    let iconName = 'alert-triangle';
    if (confirmVariant === 'danger') iconName = 'trash-2';
    if (confirmVariant === 'primary') iconName = 'help-circle';

    // Determinar clase de botón confirmación por variante
    let btnClass = 'btn-danger';
    if (confirmVariant === 'warning') btnClass = 'btn-warning';
    if (confirmVariant === 'primary') btnClass = 'btn-primary';

    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog-header">
          <div class="confirm-icon-box confirm-icon-${confirmVariant}">
            <i data-lucide="${iconName}"></i>
          </div>
          <h3>${title}</h3>
        </div>
        <div class="confirm-dialog-body">
          <p>${message}</p>
        </div>
        <div class="confirm-dialog-footer">
          <button class="btn btn-secondary confirm-cancel-btn" type="button">${cancelLabel}</button>
          <button class="btn ${btnClass} confirm-ok-btn" type="button">${confirmLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Inicializar iconos de Lucide
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: overlay });
    }

    // Animación de entrada
    requestAnimationFrame(() => {
      overlay.classList.add('show');
    });

    const cancelBtn = overlay.querySelector('.confirm-cancel-btn');
    const okBtn = overlay.querySelector('.confirm-ok-btn');
    const dialog = overlay.querySelector('.confirm-dialog');

    // Función de cierre con transición
    let hasResolved = false;
    const closeDialog = (result) => {
      overlay.classList.remove('show');
      
      // Limpiar listeners
      document.removeEventListener('keydown', handleKeyDown);
      
      const triggerCallback = () => {
        if (hasResolved) return;
        hasResolved = true;

        overlay.remove();
        resolve(result);
        if (result && typeof onConfirm === 'function') {
          onConfirm();
        } else if (!result && typeof onCancel === 'function') {
          onCancel();
        }
      };

      overlay.addEventListener('transitionend', triggerCallback);
      
      // Fallback
      setTimeout(triggerCallback, 300);
    };

    // Listeners para botones
    cancelBtn.addEventListener('click', () => closeDialog(false));
    okBtn.addEventListener('click', () => closeDialog(true));

    // Cerrar al hacer clic en el overlay (pero no en el diálogo)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(false);
      }
    });

    // Accesibilidad por teclado (Escape y Enter)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeDialog(false);
      } else if (e.key === 'Enter') {
        // Enfocar el botón de confirmación si no hay elemento enfocado
        if (document.activeElement !== cancelBtn) {
          closeDialog(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Autofocus en el botón de cancelar para evitar clicks destructivos accidentales
    cancelBtn.focus();
  });
}
