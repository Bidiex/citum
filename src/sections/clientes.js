// clientes.js — Módulo de Clientes CRM (conectado a Supabase)
import { getClients, getActiveBusinessId, getActiveBusiness } from '../utils/businessState.js';
import { formatCurrency } from '../utils/format.js';
import { paginate, totalPages, renderPaginationHTML, bindPagination } from '../utils/pagination.js';
import { getTemplates, addTemplate, updateTemplate, deleteTemplate } from '../utils/whatsappState.js';
import { formatWhatsAppMessage, replaceTemplateVariables, wrapSelection } from '../utils/whatsappFormatter.js';
import { openWhatsAppModal } from '../components/whatsapp-modal.js';
import { supabase } from '../core/supabase.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';

export async function init(container) {
  const businessId = getActiveBusinessId();
  const activeBusiness = getActiveBusiness();

  if (!businessId) {
    container.innerHTML = `
      <div class="view-container">
        <div class="crm-empty-state">
          <i data-lucide="store" size="48" style="stroke-width:1.5; color:var(--accent-neon);"></i>
          <h3>Sin negocio activo</h3>
          <p>Selecciona un negocio desde el selector del header para ver sus clientes.</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Carga inicial (Loader)
  container.innerHTML = `
    <div class="view-container">
      <div style="display:flex; align-items:center; justify-content:center; padding: var(--space-12);">
        <i data-lucide="loader" class="anim-spin" style="color:var(--accent-neon);"></i>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Variables de Estado
  let activeTab = 'clientes'; // 'clientes' | 'plantillas'
  let allClients = [];
  let templates = [];
  let currentPage = 1;
  let searchQuery = '';

  // Variables del editor de plantillas
  let selectedTemplateId = null; // null significa creación de nueva plantilla
  let isSavingTemplate = false;

  // Carga paralela de datos iniciales
  try {
    const [clientsData, templatesData] = await Promise.all([
      getClients(businessId),
      getTemplates(businessId)
    ]);
    allClients = clientsData;
    templates = templatesData;
  } catch (err) {
    console.error('[Clientes init] Error cargando datos:', err);
  }

  // --- RENDERIZADO DE TAB 1: CLIENTES ---
  const renderTabClients = () => {
    return `
      <div class="crm-table-wrapper">
        <div class="crm-table-header-row">
          <div class="crm-search-input-wrapper">
            <i data-lucide="search" size="16"></i>
            <input type="text" id="crm-client-search" class="crm-search-input" placeholder="Buscar por nombre o teléfono..." value="${searchQuery}" />
          </div>
        </div>
        <div id="crm-table-results-area">
          ${renderTableResults()}
        </div>
      </div>
    `;
  };

  const renderTableResults = () => {
    const lowerQuery = searchQuery.toLowerCase().trim();
    const filteredClients = lowerQuery
      ? allClients.filter(c =>
          c.name.toLowerCase().includes(lowerQuery) ||
          (c.phone || '').includes(lowerQuery)
        )
      : allClients;

    if (filteredClients.length === 0) {
      return `
        <div class="crm-empty-state" style="padding: var(--space-12) 0;">
          <i data-lucide="users" size="48" style="stroke-width: 1.5; color: var(--accent-neon); margin-bottom: var(--space-2);"></i>
          <h3>No se encontraron clientes</h3>
          <p>${searchQuery ? 'Intenta buscar con otros términos.' : 'Los clientes se crean automáticamente al agendar una cita.'}</p>
        </div>
      `;
    }

    const pages = totalPages(filteredClients);
    const pageItems = paginate(filteredClients, currentPage);

    return `
      <div class="crm-table-container">
        <table class="crm-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Email</th>
              <th>Último Servicio</th>
              <th style="width: 150px; min-width: 150px;">Total Servicios</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map(c => {
              let dateFormatted = '';
              if (c.last_service_date) {
                try {
                  const dateObj = new Date(c.last_service_date + 'T00:00:00');
                  dateFormatted = dateObj.toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });
                } catch (_) {
                  dateFormatted = c.last_service_date;
                }
              }

              return `
                <tr>
                  <td>
                    <span class="crm-client-name">${c.name}</span>
                  </td>
                  <td>
                    <div class="crm-client-contact">
                      <span class="crm-contact-item">
                        <i data-lucide="phone" size="12"></i>
                        ${c.phone || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class="crm-client-email">${c.email || '<span style="color: var(--text-muted); font-style: italic;">Sin correo</span>'}</span>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <span class="crm-client-service-pill">${c.last_service || 'Ninguno'}</span>
                      <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${dateFormatted}</span>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center;">
                      <span class="crm-client-visits-badge">${c.total_visits || 0} ${(c.total_visits || 0) === 1 ? 'visita' : 'visitas'}</span>
                      <span class="crm-client-total-spent">${formatCurrency(c.total_spent || 0)}</span>
                    </div>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn-send-whatsapp" data-id="${c.id}" style="background: none; border: none; color: var(--color-success, #10b981); font-weight: 600; cursor: pointer; font-size: var(--text-xs); display: inline-flex; align-items: center; gap: 4px;">
                      <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
                      Notificar
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${renderPaginationHTML(currentPage, pages, filteredClients.length)}
    `;
  };

  // --- RENDERIZADO DE TAB 2: PLANTILLAS ---
  const renderTabTemplates = () => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

    // Contenido de la lista lateral de plantillas
    const listContent = templates.length === 0
      ? `<div style="text-align: center; color: var(--text-muted); font-size: var(--text-xs); margin-top: var(--space-4);">No hay plantillas creadas</div>`
      : templates.map(t => {
          const isActive = t.id === selectedTemplateId;
          return `
            <button class="template-item-btn" data-id="${t.id}" style="
              text-align: left;
              padding: var(--space-3);
              background: ${isActive ? 'rgba(139, 92, 255, 0.08)' : 'transparent'};
              border: 1px solid ${isActive ? 'var(--accent-purple)' : 'var(--border-soft)'};
              border-radius: var(--radius-sm);
              color: ${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};
              cursor: pointer;
              font-size: var(--text-xs);
              font-weight: 600;
              width: 100%;
              transition: border-color 0.15s, background 0.15s;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            ">
              ${t.name}
            </button>
          `;
        }).join('');

    // Estructura común del editor de texto con botones de formato y variables
    const getFormFieldsHTML = (nameValue = '', contentValue = '') => `
      <div class="form-group">
        <label class="form-label" for="template-name">Nombre de la Plantilla</label>
        <input type="text" id="template-name" class="form-input" placeholder="Ej. Recordatorio de Cita, Agradecimiento" style="width: 100%;" value="${nameValue}" />
      </div>

      <div class="form-group">
        <label class="form-label" style="margin-bottom: var(--space-2);">Mensaje de la Plantilla</label>
        <div class="editor-container">
          <!-- Barra de Formato (Estilo Editor de Texto) -->
          <div class="editor-toolbar">
            <div class="editor-format-group">
              <button type="button" class="editor-btn btn-editor-format" data-prefix="*" data-suffix="*" title="Negrita">
                <i data-lucide="bold" style="width: 14px; height: 14px;"></i>
              </button>
              <button type="button" class="editor-btn btn-editor-format" data-prefix="_" data-suffix="_" title="Cursiva">
                <i data-lucide="italic" style="width: 14px; height: 14px;"></i>
              </button>
              <button type="button" class="editor-btn btn-editor-format" data-prefix="~" data-suffix="~" title="Tachado">
                <i data-lucide="strikethrough" style="width: 14px; height: 14px;"></i>
              </button>
              <button type="button" class="editor-btn btn-editor-format" data-prefix="\`\`\`" data-suffix="\`\`\`" title="Monoespaciado">
                <i data-lucide="code" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
            
            <!-- Botones de Variables -->
            <div class="editor-variables-group">
              <span class="editor-toolbar-label">Insertar:</span>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{cliente}" title="Nombre del Cliente">
                <i data-lucide="user" style="width: 11px; height: 11px; color: var(--accent-neon);"></i> Cliente
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{telefono}" title="Teléfono del Cliente">
                <i data-lucide="phone" style="width: 11px; height: 11px; color: var(--accent-neon);"></i> Teléfono
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{negocio}" title="Nombre del Negocio">
                <i data-lucide="store" style="width: 11px; height: 11px; color: var(--accent-neon);"></i> Negocio
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{direccion}" title="Dirección de tu Negocio">
                <i data-lucide="map-pin" style="width: 11px; height: 11px; color: var(--accent-neon);"></i> Dirección
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{servicio}" title="Servicios de la Cita">
                <i data-lucide="scissors" style="width: 11px; height: 11px; color: var(--accent-purple);"></i> Servicio
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{profesional}" title="Profesional Asignado">
                <i data-lucide="award" style="width: 11px; height: 11px; color: var(--accent-purple);"></i> Profesional
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{precio}" title="Precio de la Cita">
                <i data-lucide="dollar-sign" style="width: 11px; height: 11px; color: var(--accent-purple);"></i> Precio
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{fecha}" title="Fecha de la Cita">
                <i data-lucide="calendar" style="width: 11px; height: 11px; color: var(--accent-purple);"></i> Fecha
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{hora}" title="Hora de la Cita">
                <i data-lucide="clock" style="width: 11px; height: 11px; color: var(--accent-purple);"></i> Hora
              </button>
              <button type="button" class="editor-var-btn btn-editor-insert" data-var="{link_reserva}" title="Link para Reservar Online">
                <i data-lucide="link" style="width: 11px; height: 11px; color: var(--accent-purple);"></i> Link Reserva
              </button>
            </div>
          </div>
          
          <textarea id="template-content" class="editor-textarea" placeholder="Escribe tu mensaje... Usa los botones de formato de arriba y las variables para automatizar textos.">${contentValue}</textarea>
        </div>
      </div>

      <!-- Vista Previa de WhatsApp -->
      <div class="form-group">
        <label class="form-label">Previsualización (WhatsApp)</label>
        <div class="whatsapp-preview-container">
          <div class="whatsapp-preview-bubble" id="editor-preview-bubble">
            <span style="font-style: italic; color: rgba(255,255,255,0.5);">Escribe mensaje para previsualizar.</span>
          </div>
          <span class="whatsapp-preview-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    `;

    // Contenido del formulario del editor
    let editorHTML = '';

    if (selectedTemplateId === null) {
      // Modo: Creación de nueva plantilla
      editorHTML = `
        <h4 style="margin: 0; font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">Nueva Plantilla de WhatsApp</h4>
        <div style="border-bottom: 1px solid var(--border-soft); margin-bottom: var(--space-2);"></div>
        
        ${getFormFieldsHTML()}

        <div style="display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: auto; border-top: 1px solid var(--border-soft); padding-top: var(--space-4);">
          <button class="btn btn-primary" id="btn-save-template" style="height: 38px; width: 180px; justify-content: center;">Guardar Plantilla</button>
        </div>
      `;
    } else if (selectedTemplate) {
      // Modo: Edición de plantilla seleccionada
      editorHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h4 style="margin: 0; font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">Editar Plantilla</h4>
          <button class="btn btn-secondary" id="btn-delete-template" style="height: 32px; font-size: 11px; border-color: rgba(255, 90, 122, 0.2); color: #ff5a7a;">
            <i data-lucide="trash-2" style="width: 12px; height: 12px; margin-right: 4px;"></i> Eliminar
          </button>
        </div>
        <div style="border-bottom: 1px solid var(--border-soft); margin-bottom: var(--space-2);"></div>

        ${getFormFieldsHTML(selectedTemplate.name, selectedTemplate.content)}

        <div style="display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: auto; border-top: 1px solid var(--border-soft); padding-top: var(--space-4);">
          <button class="btn btn-primary" id="btn-save-template" style="height: 38px; width: 180px; justify-content: center;">Guardar Cambios</button>
        </div>
      `;
    }

    return `
      <div class="crm-table-wrapper" style="display: grid; grid-template-columns: 240px 1fr; gap: var(--space-6); background: transparent; border: none; padding: 0; box-shadow: none;">
        
        <!-- Sidebar -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4);">
          <button class="btn btn-primary" id="btn-new-template" style="width: 100%; height: 38px; justify-content: center; font-size: var(--text-xs); font-weight: 700;">
            <i data-lucide="plus" style="width: 14px; height: 14px; margin-right: 4px;"></i> Nueva Plantilla
          </button>
          <div style="border-top: 1px solid var(--border-soft); margin-top: var(--space-1);"></div>
          <div id="templates-list-area" style="display: flex; flex-direction: column; gap: var(--space-2); overflow-y: auto; flex-grow: 1; max-height: 420px; padding-right: 4px;">
            ${listContent}
          </div>
        </div>

        <!-- Editor Form -->
        <div id="template-editor-area" style="background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); min-height: 520px; box-sizing: border-box;">
          ${editorHTML}
        </div>

      </div>
    `;
  };

  // --- COORDINADOR GENERAL DE RENDERIZADO ---
  const render = () => {
    container.innerHTML = `
      <div class="view-container">
        <div class="view-header">
          <div>
            <p class="flow-subtitle" style="margin-bottom: 0;">Administra la base de datos de tus clientes y las notificaciones por WhatsApp.</p>
          </div>
        </div>

        <!-- Subnavegación de Pestañas (Tabs) -->
        <div class="tabs-navigation" style="display:flex; gap: var(--space-4); border-bottom: 1px solid var(--border-soft); padding-bottom: var(--space-2); margin-top: var(--space-2); margin-bottom: var(--space-4);">
          <button class="tab-btn ${activeTab === 'clientes' ? 'active' : ''}" data-tab="clientes" style="background:none; border:none; color:${activeTab === 'clientes' ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'clientes' ? '700' : '600'}; padding-bottom:var(--space-2); border-bottom: 2px solid ${activeTab === 'clientes' ? 'var(--accent-neon)' : 'transparent'}; cursor:pointer; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
            <i data-lucide="users" style="width: 15px; height: 15px;"></i> Clientes
          </button>
          <button class="tab-btn ${activeTab === 'plantillas' ? 'active' : ''}" data-tab="plantillas" style="background:none; border:none; color:${activeTab === 'plantillas' ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${activeTab === 'plantillas' ? '700' : '600'}; padding-bottom:var(--space-2); border-bottom: 2px solid ${activeTab === 'plantillas' ? 'var(--accent-neon)' : 'transparent'}; cursor:pointer; font-size:var(--text-sm); display:flex; align-items:center; gap:6px;">
            <i data-lucide="message-square" style="width: 15px; height: 15px;"></i> Plantillas WhatsApp
          </button>
        </div>

        <div id="clients-tab-content-area">
          ${activeTab === 'clientes' ? renderTabClients() : renderTabTemplates()}
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ node: container });
    }

    // --- ENLACE DE EVENTOS DE TABS ---
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // --- ACCIONES TAB 1: CLIENTES ---
    if (activeTab === 'clientes') {
      const searchInput = container.querySelector('#crm-client-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value;
          currentPage = 1;
          const resultsArea = container.querySelector('#crm-table-results-area');
          if (resultsArea) {
            resultsArea.innerHTML = renderTableResults();
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: resultsArea });
            bindClientsEvents(resultsArea);
          }
        });
      }

      const resultsArea = container.querySelector('#crm-table-results-area');
      bindClientsEvents(resultsArea);
    }

    // --- ACCIONES TAB 2: PLANTILLAS ---
    if (activeTab === 'plantillas') {
      // 1. Botón Nueva Plantilla
      const newTemplateBtn = container.querySelector('#btn-new-template');
      if (newTemplateBtn) {
        newTemplateBtn.addEventListener('click', () => {
          selectedTemplateId = null;
          render();
        });
      }

      // 2. Selección de plantilla de la lista lateral
      container.querySelectorAll('.template-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedTemplateId = btn.getAttribute('data-id');
          render();
        });
      });

      // 3. Manejadores del Formulario del Editor
      const textarea = container.querySelector('#template-content');
      const nameInput = container.querySelector('#template-name');
      const previewBubble = container.querySelector('#editor-preview-bubble');

      // Función para actualizar previsualización en el editor
      const updateEditorPreview = () => {
        if (!textarea || !previewBubble) return;
        const rawText = textarea.value;
        if (!rawText.trim()) {
          previewBubble.innerHTML = `<span style="font-style: italic; color: rgba(255,255,255,0.5);">Escribe mensaje para previsualizar.</span>`;
          return;
        }

        const mockClient = { name: 'Juan Pérez', phone: '3001234567', last_service: 'Corte de Cabello + Barba', last_service_date: '2026-06-05' };
        const mockBiz = {
          name: activeBusiness?.name || 'Mi Negocio',
          address: activeBusiness?.address || 'Calle 123 # 45-67, Bogotá',
          slug: activeBusiness?.slug || 'mi-negocio'
        };
        const mockApt = {
          service: 'Corte de Cabello + Barba',
          prof: 'Carlos Gómez (Barbero)',
          totalPrice: 50000,
          date: 'Dom, 7 Jun',
          time: '10:30 AM'
        };

        const resolvedText = replaceTemplateVariables(rawText, mockClient, mockBiz, mockApt);
        const formattedHTML = formatWhatsAppMessage(resolvedText);
        previewBubble.innerHTML = formattedHTML;
      };

      if (textarea) {
        textarea.addEventListener('input', updateEditorPreview);
        updateEditorPreview(); // Carga inicial de la preview
      }

      // Botones de formato (Negrita, Cursiva, etc.) en el editor
      container.querySelectorAll('.btn-editor-format').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!textarea) return;
          const prefix = btn.getAttribute('data-prefix');
          const suffix = btn.getAttribute('data-suffix');
          wrapSelection(textarea, prefix, suffix);
          updateEditorPreview();
        });
      });

      // Botones para insertar variables en el editor
      container.querySelectorAll('.btn-editor-insert').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!textarea) return;
          const varTag = btn.getAttribute('data-var');
          const startPos = textarea.selectionStart;
          const endPos = textarea.selectionEnd;
          const originalText = textarea.value;

          textarea.value = originalText.substring(0, startPos) + varTag + originalText.substring(endPos);
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = startPos + varTag.length;
          updateEditorPreview();
        });
      });

      // 4. Botón Guardar Plantilla / Cambios
      const saveBtn = container.querySelector('#btn-save-template');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          if (isSavingTemplate) return;
          const name = nameInput?.value.trim();
          const content = textarea?.value.trim();

          if (!name) {
            showToast({ title: 'Nombre obligatorio', subtitle: 'Por favor, ingresa el nombre de la plantilla.', type: 'error' });
            return;
          }
          if (!content) {
            showToast({ title: 'Contenido obligatorio', subtitle: 'Por favor, escribe el mensaje de la plantilla.', type: 'error' });
            return;
          }

          isSavingTemplate = true;
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            if (selectedTemplateId === null) {
              // Crear plantilla
              const newTpl = await addTemplate(businessId, { name, content });
              showToast({ title: 'Plantilla guardada', subtitle: `La plantilla "${name}" se creó con éxito.`, type: 'success' });
              selectedTemplateId = newTpl.id; // Cambiar a modo edición de la plantilla recién creada
            } else {
              // Modificar plantilla
              await updateTemplate(selectedTemplateId, { name, content });
              showToast({ title: 'Plantilla actualizada', subtitle: `Los cambios en "${name}" se guardaron correctamente.`, type: 'success' });
            }
            templates = await getTemplates(businessId);
            render();
          } catch (err) {
            showToast({ title: 'Error al guardar', subtitle: err.message, type: 'error' });
          } finally {
            isSavingTemplate = false;
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.textContent = selectedTemplateId === null ? 'Guardar Plantilla' : 'Guardar Cambios';
            }
          }
        });
      }

      // 5. Botón Eliminar Plantilla
      const deleteBtn = container.querySelector('#btn-delete-template');
      if (deleteBtn && selectedTemplateId !== null) {
        deleteBtn.addEventListener('click', () => {
          const activeTplObj = templates.find(t => t.id === selectedTemplateId);
          if (!activeTplObj) return;

          showConfirm({
            title: 'Eliminar Plantilla',
            message: `¿Estás seguro de que deseas eliminar la plantilla <strong>${activeTplObj.name}</strong>? Esta acción no se puede deshacer.`,
            confirmLabel: 'Sí, Eliminar',
            cancelLabel: 'Cancelar',
            confirmVariant: 'danger',
            onConfirm: async () => {
              try {
                await deleteTemplate(selectedTemplateId);
                showToast({ title: 'Plantilla eliminada', subtitle: `Se eliminó la plantilla "${activeTplObj.name}".`, type: 'success' });
                selectedTemplateId = null;
                templates = await getTemplates(businessId);
                render();
              } catch (err) {
                showToast({ title: 'Error al eliminar', subtitle: err.message, type: 'error' });
              }
            }
          });
        });
      }
    }
  };

  // Función para enlazar eventos específicos del listado de clientes (notificaciones y paginación)
  function bindClientsEvents(targetArea) {
    if (!targetArea) return;

    // Enlazar paginación de la lista
    bindPagination(targetArea, (p) => {
      currentPage = p;
      const resultsArea = container.querySelector('#crm-table-results-area');
      if (resultsArea) {
        resultsArea.innerHTML = renderTableResults();
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: resultsArea });
        bindClientsEvents(resultsArea);
      } else {
        targetArea.innerHTML = renderTabClients();
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: targetArea });
        bindClientsEvents(targetArea);
      }
    });

    // Enlazar botón "Notificar"
    targetArea.querySelectorAll('.btn-send-whatsapp').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const client = allClients.find(c => c.id === id);
        if (client) {
          if (!client.phone) {
            showToast({
              title: 'Sin teléfono',
              subtitle: 'Este cliente no tiene registrado ningún número de contacto.',
              type: 'error'
            });
            return;
          }
          await openWhatsAppModal({
            client,
            onClose: () => {}
          });
        }
      });
    });
  }

  // --- SUSCRIPCIONES EN TIEMPO REAL (Supabase Postgres Changes) ---
  const clientsChannelName = `db-clients-sync-${businessId}`;
  const templatesChannelName = `db-templates-sync-${businessId}`;

  // Limpiar canales previos si ya existían en Supabase para evitar duplicación
  supabase.removeChannel(supabase.channel(clientsChannelName));
  supabase.removeChannel(supabase.channel(templatesChannelName));

  const clientsChannel = supabase
    .channel(clientsChannelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `business_id=eq.${businessId}` }, async () => {
      allClients = await getClients(businessId);
      if (activeTab === 'clientes') {
        const resultsArea = container.querySelector('#crm-table-results-area');
        if (resultsArea) {
          resultsArea.innerHTML = renderTableResults();
          if (typeof lucide !== 'undefined') lucide.createIcons({ node: resultsArea });
          bindClientsEvents(resultsArea);
        } else {
          const tableArea = container.querySelector('#clients-tab-content-area');
          if (tableArea) {
            tableArea.innerHTML = renderTabClients();
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: tableArea });
            bindClientsEvents(tableArea);
          }
        }
      }
    })
    .subscribe();

  const templatesChannel = supabase
    .channel(templatesChannelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_templates', filter: `business_id=eq.${businessId}` }, async () => {
      templates = await getTemplates(businessId);
      if (activeTab === 'plantillas') {
        render();
      }
    })
    .subscribe();

  // Escucha del evento custom interno para clientes
  const handleClientsChanged = async (e) => {
    if (!e.detail || e.detail.businessId === businessId) {
      allClients = await getClients(businessId);
      if (activeTab === 'clientes') {
        const resultsArea = container.querySelector('#crm-table-results-area');
        if (resultsArea) {
          resultsArea.innerHTML = renderTableResults();
          if (typeof lucide !== 'undefined') lucide.createIcons({ node: resultsArea });
          bindClientsEvents(resultsArea);
        } else {
          const tableArea = container.querySelector('#clients-tab-content-area');
          if (tableArea) {
            tableArea.innerHTML = renderTabClients();
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: tableArea });
            bindClientsEvents(tableArea);
          }
        }
      }
    }
  };
  window.addEventListener('citum_clients_changed', handleClientsChanged);

  // Registrar cleanup para remover canales y eventos de navegación SPA al desmontar
  container.cleanup = () => {
    supabase.removeChannel(clientsChannel);
    supabase.removeChannel(templatesChannel);
    window.removeEventListener('citum_clients_changed', handleClientsChanged);
  };

  // Render inicial
  render();
}
