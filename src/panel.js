// panel.js — SPA Router y Coordinador del Panel de Propietario

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Iconos Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // 1. Selector de Negocios (Dropdown)
  const bizBtn = document.getElementById('current-business-btn');
  const bizOptions = document.getElementById('selector-options');
  const bizNameSpan = document.getElementById('current-business-name');

  if (bizBtn && bizOptions) {
    bizBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bizOptions.classList.toggle('open');
    });

    // Cerrar dropdown al hacer clic por fuera
    document.addEventListener('click', () => {
      bizOptions.classList.remove('open');
    });

    // Cambiar negocio activo
    bizOptions.querySelectorAll('.selector-option:not(.add-new-business)').forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Quitar active del resto
        bizOptions.querySelectorAll('.selector-option').forEach(opt => opt.classList.remove('active'));
        
        // Agregar active a la opción seleccionada
        option.classList.add('active');
        
        // Cambiar texto en el botón principal
        bizNameSpan.textContent = option.textContent;
        bizOptions.classList.remove('open');
        
        // Opcional: Recargar sección activa con los datos del nuevo negocio
        const activeNav = document.querySelector('.sidebar-item.active');
        if (activeNav) {
          const section = activeNav.getAttribute('data-section');
          navigate(section);
        }
      });
    });
  }

  // 2. Menú de Navegación Lateral (Sidebar SPA)
  const navItems = document.querySelectorAll('.sidebar-item:not(.logout-btn)');
  const mobileSidebar = document.getElementById('panel-sidebar');
  const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
  const sectionTitle = document.getElementById('active-section-title');

  // Toggle del Sidebar móvil
  if (mobileSidebarToggle && mobileSidebar) {
    mobileSidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileSidebar.classList.toggle('open');
    });

    // Cerrar sidebar al hacer clic por fuera
    document.addEventListener('click', (e) => {
      if (mobileSidebar.classList.contains('open') && !mobileSidebar.contains(e.target)) {
        mobileSidebar.classList.remove('open');
      }
    });
  }

  // Lógica de ruteo
  const navigate = async (section) => {
    const container = document.getElementById('main-content');
    if (!container) return;

    // Mostrar estado de carga
    container.innerHTML = `
      <div class="dashboard-welcome">
        <div class="welcome-box">
          <i data-lucide="loader" class="loader-icon anim-spin"></i>
          <h2>Cargando ${section}...</h2>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    try {
      // Intentar importar dinámicamente el módulo correspondiente a la sección
      const modulePath = `./sections/${section}.js`;
      const mod = await import(modulePath);
      
      // Limpiar contenedor e inicializar vista
      container.innerHTML = '';
      mod.init(container);
      
      // Actualizar título de sección en Header
      if (sectionTitle) {
        // Capitalizar primera letra
        sectionTitle.textContent = section.charAt(0).toUpperCase() + section.slice(1);
      }
    } catch (error) {
      console.error(`Error cargando el módulo ${section}:`, error);
      container.innerHTML = `
        <div class="dashboard-welcome">
          <div class="welcome-box" style="border-color: rgba(255, 90, 122, 0.2);">
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: #ff5a7a;"></i>
            <h2 style="color: #ff5a7a;">Error al cargar la sección</h2>
            <p>No se pudo inicializar la sección "${section}". Es posible que el archivo aún no exista o esté en desarrollo.</p>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  };

  // Enlazar clics de navegación
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Cambiar clase activa
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Cerrar sidebar en móvil tras navegar
      if (mobileSidebar) {
        mobileSidebar.classList.remove('open');
      }

      // Navegar
      const section = item.getAttribute('data-section');
      navigate(section);
    });
  });

  // Cargar sección por defecto (agenda)
  navigate('agenda');
});
