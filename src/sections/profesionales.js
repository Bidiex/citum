// profesionales.js — Módulo de Profesionales del Panel (conectado a Supabase)
import { openProfessionalDrawer } from '../components/professional-drawer.js';
import { supabase } from '../core/supabase.js';
import { getActiveBusinessId } from '../utils/businessState.js';
import { showToast } from '../utils/toast.js';

// ============================================================
// Helpers de datos — CRUD de profesionales en Supabase
// ============================================================

async function fetchProfessionals(businessId) {
  const { data, error } = await supabase
    .from('professionals')
    .select(`
      *,
      professional_schedules (*),
      professional_breaks (*)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[fetchProfessionals]', error.message);
    return [];
  }

  // Normalizar para el drawer (compatible con su esquema de datos)
  return (data || []).map(p => ({
    ...p,
    active: p.is_active,
    schedules: (p.professional_schedules || []).map(s => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_available: s.is_available,
    })),
    breaks: (p.professional_breaks || []).map(b => ({
      id: b.id,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      label: b.label,
    })),
  }));
}

async function createProfessional(businessId, payload) {
  // 1. Crear profesional
  const { data: prof, error: profError } = await supabase
    .from('professionals')
    .insert({
      business_id: businessId,
      name: payload.name,
      role: payload.role,
      phone: payload.phone || null,
      is_active: payload.active !== false,
    })
    .select()
    .single();

  if (profError) throw profError;

  // 2. Insertar horarios (upsert por si existen)
  if (payload.schedules && payload.schedules.length > 0) {
    const schedules = payload.schedules.map(s => ({
      professional_id: prof.id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_available: s.is_available,
    }));

    const { error: schedErr } = await supabase
      .from('professional_schedules')
      .upsert(schedules, { onConflict: 'professional_id,day_of_week' });

    if (schedErr) console.error('[createProfessional - schedules]', schedErr.message);
  }

  // 3. Insertar descansos
  if (payload.breaks && payload.breaks.length > 0) {
    const breaks = payload.breaks.map(b => ({
      professional_id: prof.id,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      label: b.label || 'Descanso',
    }));

    const { error: brErr } = await supabase
      .from('professional_breaks')
      .insert(breaks);

    if (brErr) console.error('[createProfessional - breaks]', brErr.message);
  }

  return prof;
}

async function updateProfessional(profId, payload) {
  // 1. Actualizar datos básicos
  const { error: profError } = await supabase
    .from('professionals')
    .update({
      name: payload.name,
      role: payload.role,
      phone: payload.phone || null,
      is_active: payload.active !== false,
    })
    .eq('id', profId);

  if (profError) throw profError;

  // 2. Reemplazar horarios (delete + insert para simplicidad)
  await supabase
    .from('professional_schedules')
    .delete()
    .eq('professional_id', profId);

  if (payload.schedules && payload.schedules.length > 0) {
    const schedules = payload.schedules.map(s => ({
      professional_id: profId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_available: s.is_available,
    }));

    await supabase.from('professional_schedules').insert(schedules);
  }

  // 3. Reemplazar descansos
  await supabase
    .from('professional_breaks')
    .delete()
    .eq('professional_id', profId);

  if (payload.breaks && payload.breaks.length > 0) {
    const breaks = payload.breaks.map(b => ({
      professional_id: profId,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      label: b.label || 'Descanso',
    }));

    await supabase.from('professional_breaks').insert(breaks);
  }
}

async function deleteProfessional(profId) {
  const { error } = await supabase
    .from('professionals')
    .delete()
    .eq('id', profId);

  if (error) throw error;
}

// ============================================================
// Módulo de sección
// ============================================================

export async function init(container) {
  const businessId = getActiveBusinessId();

  if (!businessId) {
    container.innerHTML = `
      <div class="view-container">
        <div class="crm-empty-state">
          <i data-lucide="store" size="48" style="stroke-width:1.5; color:var(--accent-neon);"></i>
          <h3>Sin negocio activo</h3>
          <p>Selecciona o crea un negocio primero desde la sección "Negocios".</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Loading state
  container.innerHTML = `
    <div class="view-container">
      <div style="display:flex; align-items:center; justify-content:center; padding: var(--space-12);">
        <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  let professionals = await fetchProfessionals(businessId);

  if (container.getAttribute('data-active-section') !== 'profesionales') return;

  const render = () => {
    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div>
            <p class="flow-subtitle" style="margin-bottom: 0;">Administra los profesionales de tu negocio y sus horarios.</p>
          </div>
          <div class="view-actions">
            <button class="btn btn-primary" id="btn-add-prof" style="height: 40px; padding-inline: var(--space-4);">
              <i data-lucide="user-plus" size="16" style="margin-right: var(--space-2);"></i>
              Registrar Profesional
            </button>
          </div>
        </div>

        ${professionals.length === 0 ? `
          <div class="crm-empty-state" style="margin-top: var(--space-8);">
            <i data-lucide="users" size="48" style="stroke-width: 1.5; color: var(--accent-neon); margin-bottom: var(--space-2);"></i>
            <h3>Sin profesionales registrados</h3>
            <p>Registra el primer profesional de tu negocio.</p>
          </div>
        ` : `
          <div class="grid-panel" id="prof-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
            ${professionals.map(prof => {
              const avatarLetters = prof.name
                ? prof.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : '?';
              return `
                <div class="card" style="padding: var(--space-6); display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-4);">
                      <div style="
                        width: 48px; 
                        height: 48px; 
                        border-radius: 50%; 
                        background: rgba(139, 92, 255, 0.12); 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        color: var(--accent-neon);
                        font-weight: 700;
                        border: 1px solid rgba(139, 92, 255, 0.2);
                        flex-shrink: 0;
                      ">
                        ${prof.avatar_url 
                          ? `<img src="${prof.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`
                          : avatarLetters}
                      </div>
                      <div>
                        <h4 style="font-size: var(--text-base); font-weight: 700;">${prof.name}</h4>
                        <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">${prof.role}</p>
                      </div>
                    </div>
                    <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
                      <i data-lucide="phone" style="width: 14px; height: 14px; flex-shrink: 0; color: var(--text-muted);"></i>
                      ${prof.phone || 'Sin teléfono'}
                    </p>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-muted); border-top: 1px solid var(--border-soft); padding-top: var(--space-3); margin-top: auto;">
                    <span>Estado: <strong style="color: ${prof.is_active ? 'var(--accent-neon)' : '#ef4444'};">${prof.is_active ? 'Activo' : 'Inactivo'}</strong></span>
                    <a href="#" class="btn-config-hours" data-id="${prof.id}" style="color: var(--accent-purple); font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                      Editar
                    </a>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Botón nuevo profesional
    const btnAdd = container.querySelector('#btn-add-prof');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        openProfessionalDrawer({
          mode: 'create',
          onSave: async (newProf) => {
            try {
              btnAdd.disabled = true;
              await createProfessional(businessId, newProf);
              professionals = await fetchProfessionals(businessId);
              render();
            } catch (err) {
              showToast({ title: 'Error al guardar', subtitle: err.message, type: 'error' });
            }
          }
        });
      });
    }

    // Botones editar profesional
    container.querySelectorAll('.btn-config-hours').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const profId = e.currentTarget.dataset.id;
        const profObj = professionals.find(p => p.id === profId);
        if (!profObj) return;

        openProfessionalDrawer({
          mode: 'edit',
          professional: profObj,
          onSave: async (updatedProf) => {
            try {
              await updateProfessional(profId, updatedProf);
              professionals = await fetchProfessionals(businessId);
              render();
            } catch (err) {
              showToast({ title: 'Error al actualizar', subtitle: err.message, type: 'error' });
            }
          },
          onDelete: async (deletedProfId) => {
            try {
              await deleteProfessional(deletedProfId);
              professionals = professionals.filter(p => p.id !== deletedProfId);
              render();
            } catch (err) {
              showToast({ title: 'Error al eliminar', subtitle: err.message, type: 'error' });
            }
          }
        });
      });
    });
  };

  render();
}
