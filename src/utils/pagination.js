// src/utils/pagination.js
// Utilidad de paginación reutilizable para tablas del panel

export const PAGE_SIZE = 20;

/**
 * Retorna los elementos de la página actual
 */
export function paginate(items, page) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

/**
 * Retorna el total de páginas
 */
export function totalPages(items) {
  return Math.max(1, Math.ceil(items.length / PAGE_SIZE));
}

/**
 * Genera el HTML del componente de paginación
 * @param {number} currentPage - página actual (1-indexed)
 * @param {number} total - total de páginas
 * @param {number} totalItems - total de elementos
 * @returns {string} HTML string
 */
export function renderPaginationHTML(currentPage, total, totalItems) {
  if (total <= 1) return '';

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalItems);

  const prevDisabled = currentPage === 1 ? 'disabled' : '';
  const nextDisabled = currentPage === total ? 'disabled' : '';

  return `
    <div class="pagination-bar">
      <span class="pagination-info">${start}–${end} de ${totalItems}</span>
      <div class="pagination-controls">
        <button class="pagination-btn" data-page="${currentPage - 1}" ${prevDisabled}>
          <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>
        </button>
        <span class="pagination-current">${currentPage} / ${total}</span>
        <button class="pagination-btn" data-page="${currentPage + 1}" ${nextDisabled}>
          <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Enlaza los botones de paginación a un callback
 * @param {HTMLElement} container - contenedor donde buscar botones
 * @param {function} onPageChange - callback(newPage)
 */
export function bindPagination(container, onPageChange) {
  container.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      if (page > 0) onPageChange(page);
    });
  });
}
