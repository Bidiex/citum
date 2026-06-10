// src/components/ai-assistant.js
// Componente de UI para el Asistente de IA (Botón flotante + Drawer de chat)

import { callAgent } from '../ai/llm.js';
import { getActiveBusinessId, getActiveBusiness } from '../utils/businessState.js';
import { initVoiceRecognition } from './ai-voice.js';

export function initAiAssistant(container) {
  // Evitar inicializar dos veces
  if (document.getElementById('ai-assistant-container')) return;

  // Insertar el botón en el header (al lado de profile info)
  const headerRight = document.querySelector('.header-right');
  const profileInfo = document.getElementById('header-profile-info');
  
  const triggerBtn = document.createElement('button');
  triggerBtn.className = 'ai-trigger-btn';
  triggerBtn.id = 'ai-fab-btn'; // Mantener el mismo ID para compatibilidad con event listeners
  triggerBtn.setAttribute('aria-label', 'Abrir asistente de IA');
  triggerBtn.innerHTML = `<i data-lucide="sparkles"></i>`;

  if (profileInfo && headerRight) {
    headerRight.insertBefore(triggerBtn, profileInfo);
  } else {
    // Fallback si no se encuentra el perfil en el header
    container.appendChild(triggerBtn);
    triggerBtn.classList.add('ai-fab-fallback');
  }

  // Crear el drawer lateral
  const wrapper = document.createElement('div');
  wrapper.id = 'ai-assistant-container';
  wrapper.innerHTML = `
    <!-- Drawer Lateral -->
    <div class="ai-drawer" id="ai-drawer">
      <div class="ai-header">
        <div class="ai-header-title">
          <i data-lucide="sparkles"></i>
          <span>Asistente Citum</span>
        </div>
        <button class="ai-close-btn" id="ai-close-btn" aria-label="Cerrar asistente">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="ai-chat-area" id="ai-chat-area">
        <div class="ai-message assistant">
          ¡Hola! Soy tu asistente de Citum. Estoy aquí para ayudarte a gestionar tu negocio. ¿En qué puedo ayudarte hoy?
        </div>
      </div>

      <div class="ai-input-area">
        <div class="ai-input-wrapper">
          <textarea class="ai-input" id="ai-chat-input" placeholder="Escribe tu mensaje..." rows="1"></textarea>
          <button class="ai-mic-btn" id="ai-mic-btn" aria-label="Hablar">
            <i data-lucide="mic"></i>
          </button>
          <button class="ai-send-btn" id="ai-send-btn" aria-label="Enviar mensaje">
            <i data-lucide="send"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // ── Elementos del DOM ────────────────────────────────────────────────────────
  const fabBtn = document.getElementById('ai-fab-btn');
  const drawer = document.getElementById('ai-drawer');
  const closeBtn = document.getElementById('ai-close-btn');
  const chatArea = document.getElementById('ai-chat-area');
  const chatInput = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-send-btn');
  const micBtn = document.getElementById('ai-mic-btn');

  // Estado del chat
  let messages = [];
  let isWaitingForResponse = false;
  let voiceRecognition = null;
  let isRecording = false;

  // ── Funciones de UI ─────────────────────────────────────────────────────────

  const toggleDrawer = () => {
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open')) {
      chatInput.focus();
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    chatArea.scrollTop = chatArea.scrollHeight;
  };

  const formatMessage = (text) => {
    if (!text) return '';
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Lists (lines starting with - or *)
    html = html.replace(/^(?:-|\*)\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>(?:\n|$)+)+/g, '<ul class="ai-message-list">$&</ul>');
    
    // Cleanup newlines around lists to avoid extra spacing
    html = html.replace(/<\/li>\n*<li>/g, '</li><li>');
    html = html.replace(/<ul class="ai-message-list">\n*/g, '<ul class="ai-message-list">');
    html = html.replace(/\n*<\/ul>/g, '</ul>');

    // Remaining newlines
    html = html.replace(/\n/g, '<br/>');

    return html;
  };

  const appendMessage = (role, text) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${role}`;
    msgDiv.innerHTML = formatMessage(text);
    chatArea.appendChild(msgDiv);
    scrollToBottom();
  };

  const showTypingIndicator = () => {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-typing';
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.innerHTML = `
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    `;
    chatArea.appendChild(typingDiv);
    scrollToBottom();
  };

  const hideTypingIndicator = () => {
    const indicator = document.getElementById('ai-typing-indicator');
    if (indicator) indicator.remove();
  };

  // ── Manejo de mensajes ──────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = chatInput.value.trim();
    if (!text || isWaitingForResponse) return;

    const bizId = getActiveBusinessId();
    if (!bizId) {
      appendMessage('assistant', 'Por favor, selecciona un negocio activo primero.');
      return;
    }

    // 1. Mostrar mensaje del usuario
    appendMessage('user', text);
    chatInput.value = '';
    chatInput.style.height = 'auto'; // Resetear altura
    sendBtn.classList.remove('active');
    
    // Guardar en historial
    messages.push({ role: 'user', content: text });
    
    // 2. Llamar al agente
    isWaitingForResponse = true;
    showTypingIndicator();

    try {
      const responseText = await callAgent(messages, bizId);
      
      hideTypingIndicator();
      appendMessage('assistant', responseText);
      messages.push({ role: 'assistant', content: responseText });
    } catch (err) {
      hideTypingIndicator();
      appendMessage('assistant', `Error: ${err.message}`);
      // Si falla, sacamos el mensaje del historial para no corromper la conversación
      messages.pop();
    } finally {
      isWaitingForResponse = false;
      chatInput.focus();
    }
  };

  // ── Event Listeners ─────────────────────────────────────────────────────────

  fabBtn.addEventListener('click', toggleDrawer);
  closeBtn.addEventListener('click', () => drawer.classList.remove('open'));

  chatInput.addEventListener('input', () => {
    // Auto-resize
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    
    if (chatInput.value.trim()) {
      sendBtn.classList.add('active');
    } else {
      sendBtn.classList.remove('active');
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', handleSend);

  // Voz
  micBtn.addEventListener('click', () => {
    if (isRecording) {
      voiceRecognition.stop();
      return;
    }

    if (!voiceRecognition) {
      voiceRecognition = initVoiceRecognition(
        (final, interim) => {
          chatInput.value = final || interim;
          chatInput.dispatchEvent(new Event('input'));
        },
        (errorMsg) => {
          appendMessage('assistant', `Error de voz: ${errorMsg}`);
          isRecording = false;
          micBtn.classList.remove('recording');
        }
      );
      
      if (!voiceRecognition) return;

      voiceRecognition.onend = () => {
        isRecording = false;
        micBtn.classList.remove('recording');
        if (chatInput.value.trim() && !isWaitingForResponse) {
          handleSend();
        }
      };
    }

    voiceRecognition.start();
    isRecording = true;
    micBtn.classList.add('recording');
  });
}
