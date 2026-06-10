// panel.js — SPA Router y Coordinador del Panel de Propietario
import { 
  getBusinesses, 
  getActiveBusinessId, 
  setActiveBusinessId, 
  getActiveBusiness 
} from './utils/businessState.js';
import { auth } from './core/auth.js';
import { supabase } from './core/supabase.js';
import { initAiAssistant } from './components/ai-assistant.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar Iconos Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Cargar negocios antes de inicializar la vista para evitar condiciones de carrera
  const businesses = await getBusinesses();
  if (businesses.length === 0) {
    window.location.replace('/onboarding.html');
    return;
  }

  // 1. Selector de Negocios (Dropdown)
  const bizBtn = document.getElementById('current-business-btn');
  const bizOptions = document.getElementById('selector-options');
  const bizNameSpan = document.getElementById('current-business-name');

  const renderBusinessSelector = async () => {
    if (!bizOptions) return;
    
    const activeId = getActiveBusinessId();
    const activeBiz = getActiveBusiness();
    
    if (bizNameSpan && activeBiz) {
      bizNameSpan.textContent = activeBiz.name;
    } else if (bizNameSpan && businesses.length === 0) {
      bizNameSpan.textContent = 'Sin negocio';
    }
    
    let html = '';
    businesses.forEach(biz => {
      const isActive = biz.id === activeId;
      html += `
        <a href="#" class="selector-option ${isActive ? 'active' : ''}" data-id="${biz.id}">
          ${biz.name}
        </a>
      `;
    });
    
    html += `
      <hr style="border:0; border-top: 1px solid var(--border-soft); margin-block: var(--space-2);">
      <a href="#" class="selector-option add-new-business" style="color: var(--accent-neon); display: flex; align-items: center; gap: var(--space-2);">
        <i data-lucide="plus" size="14"></i>
        Agregar Negocio
      </a>
    `;
    
    bizOptions.innerHTML = html;
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({
        attrs: { 'stroke-width': 2, 'size': 14 },
        nameAttr: 'data-lucide',
        node: bizOptions
      });
    }
    
    // Bind click events to options
    bizOptions.querySelectorAll('.selector-option:not(.add-new-business)').forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        const id = option.getAttribute('data-id');
        setActiveBusinessId(id);
        bizOptions.classList.remove('open');
      });
    });
    
    // Bind click to Add Business
    const addBtn = bizOptions.querySelector('.add-new-business');
    if (addBtn) {
      addBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        bizOptions.classList.remove('open');
        const { openBusinessModal } = await import('./components/business-modal.js');
        openBusinessModal({
          mode: 'create',
          onSave: async () => {
            await renderBusinessSelector();
            // Refrescar sección activa
            const activeNav = document.querySelector('.sidebar-item.active');
            if (activeNav) {
              const section = activeNav.getAttribute('data-section');
              navigate(section);
            }
          }
        });
      });
    }

    checkBusinessHoursConfig();
  };

  const checkBusinessHoursConfig = () => {
    const activeBiz = getActiveBusiness();
    const banner = document.getElementById('business-hours-banner');
    if (!banner) return;

    if (activeBiz && !activeBiz.has_configured_hours) {
      banner.style.display = 'flex';
      
      const btn = document.getElementById('btn-configure-hours-banner');
      if (btn) {
        btn.onclick = async (e) => {
          e.preventDefault();
          const { openBusinessModal } = await import('./components/business-modal.js');
          openBusinessModal({
            mode: 'edit',
            businessData: activeBiz,
            onSave: async () => {
              window.location.reload();
            }
          });
        };
      }
    } else {
      banner.style.display = 'none';
    }
  };

  if (bizBtn && bizOptions) {
    bizBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bizOptions.classList.toggle('open');
    });

    // Cerrar dropdown al hacer clic por fuera
    document.addEventListener('click', () => {
      bizOptions.classList.remove('open');
    });

    // Renderizar selector por primera vez
    renderBusinessSelector();
  }

  // Escuchar cambios globales de negocios
  window.addEventListener('citum_businesses_changed', () => {
    renderBusinessSelector();
  });

  window.addEventListener('citum_active_business_changed', async () => {
    await renderBusinessSelector();
    // Recargar sección activa al cambiar negocio
    const activeNav = document.querySelector('.sidebar-item.active');
    if (activeNav) {
      const section = activeNav.getAttribute('data-section');
      navigate(section);
    }
  });


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
  let navToken = 0;

  const navigate = async (section) => {
    const container = document.getElementById('main-content');
    if (!container) return;

    // Limpiar suscripciones previas
    if (typeof container.cleanup === 'function') {
      try { container.cleanup(); } catch (err) { console.error('[navigate cleanup]', err); }
      container.cleanup = null;
    }

    // Incrementar token — cualquier navegación anterior queda invalidada
    const currentToken = ++navToken;
    container.setAttribute('data-active-section', section);

    // Mostrar loading
    container.innerHTML = `
      <div class="dashboard-welcome">
        <div class="welcome-box">
          <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
          <h2>Cargando ${section}...</h2>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
      const mod = await import(`./sections/${section}.js`);

      // Si el token cambió, el usuario ya navegó a otra sección — descartar
      if (currentToken !== navToken) return;

      container.innerHTML = '';
      await mod.init(container);

      // Verificar de nuevo después del init async
      if (currentToken !== navToken) {
        if (typeof container.cleanup === 'function') {
          try { container.cleanup(); } catch (e) {}
          container.cleanup = null;
        }
        return;
      }

      if (sectionTitle) {
        sectionTitle.textContent = section.charAt(0).toUpperCase() + section.slice(1);
      }
    } catch (error) {
      console.error(`Error cargando módulo ${section}:`, error);
      if (currentToken !== navToken) return;
      container.innerHTML = `
        <div class="dashboard-welcome">
          <div class="welcome-box" style="border-color: rgba(255, 90, 122, 0.2);">
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: #ff5a7a;"></i>
            <h2 style="color: #ff5a7a;">Error al cargar la sección</h2>
            <p>No se pudo inicializar "${section}".</p>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
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

  // Función para cargar los datos del perfil del usuario autenticado
  const loadProfileInfo = async () => {
    try {
      const { session } = await auth.getSession();
      if (!session || !session.user) return;

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('[loadProfileInfo] Error:', error.message);
        return;
      }

      if (profile) {
        const nameEl = document.getElementById('header-profile-name');
        const badgeEl = document.getElementById('header-profile-badge');

        if (nameEl) nameEl.textContent = profile.full_name || 'Usuario';
        if (badgeEl) {
          const plan = profile.plan_id || 'esencial';
          badgeEl.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
        }
      }
    } catch (err) {
      console.error('[loadProfileInfo] Exception:', err);
    }
  };

  // Cargar sección por defecto (agenda)
  navigate('agenda');

  // Cargar información de perfil
  loadProfileInfo();

  // Inicializar Asistente de IA
  initAiAssistant(document.body);
});
