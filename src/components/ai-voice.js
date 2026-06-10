// src/components/ai-voice.js
// Manejo de la Web Speech API para entrada de voz

export function initVoiceRecognition(onResult, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    if (onError) onError('Tu navegador no soporta el reconocimiento de voz.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'es-CO'; // Español Colombia
  recognition.interimResults = true; // Resultados parciales mientras habla
  recognition.maxAlternatives = 1;

  let finalTranscript = '';

  recognition.onstart = () => {
    finalTranscript = '';
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (onResult) {
      onResult(finalTranscript, interimTranscript);
    }
  };

  recognition.onerror = (event) => {
    if (onError) onError(`Error de voz: ${event.error}`);
  };

  return recognition;
}
