let currentScreenshotBase64 = null;

document.addEventListener('DOMContentLoaded', async () => {
  updateStatus();

  // 1. Lectura y subida de archivos (.txt / .md)
  document.getElementById('file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      document.getElementById('chat-output').textContent = `Indexando archivo: ${file.name}...`;
      await storeKnowledgeBit(content, `Archivo: ${file.name}`);
      document.getElementById('chat-output').textContent = `✅ ¡Archivo "${file.name}" indexado con éxito!`;
      updateStatus();
    };
    reader.readAsText(file);
  });

  // 2. Captura de pantalla activa
  document.getElementById('btn-screenshot').addEventListener('click', async () => {
    const outputDiv = document.getElementById('chat-output');
    outputDiv.textContent = 'Capturando pantalla...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (!dataUrl) {
          outputDiv.textContent = 'Error al capturar la pantalla.';
          return;
        }

        currentScreenshotBase64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
        document.getElementById('model-select').value = 'llava';
        outputDiv.textContent = '📸 Captura lista. Modelo "llava" seleccionado. Escribe tu pregunta sobre la imagen y pulsa Preguntar.';
      });
    });
  });

  // 3. Indexar nota manual
  document.getElementById('btn-save').addEventListener('click', async () => {
    const text = document.getElementById('note-input').value.trim();
    if (!text) return;

    document.getElementById('btn-save').textContent = 'Indexando...';
    await storeKnowledgeBit(text, 'Nota manual');
    document.getElementById('note-input').value = '';
    document.getElementById('btn-save').textContent = 'Indexar Texto';
    updateStatus();
  });

  // 4. Procesar consulta (Visión o RAG)
  document.getElementById('btn-ask').addEventListener('click', async () => {
    const query = document.getElementById('query-input').value.trim();
    const model = document.getElementById('model-select').value;
    const outputDiv = document.getElementById('chat-output');
    const contextDiv = document.getElementById('rag-context');

    if (!query) return;

    // CASO A: Análisis de imagen con LLaVA
    if (currentScreenshotBase64 && model === 'llava') {
      outputDiv.textContent = 'Analizando imagen con modelo multimodal...';
      contextDiv.classList.add('hidden');

      try {
        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            prompt: query,
            images: [currentScreenshotBase64],
            stream: false
          })
        });

        const data = await response.json();
        outputDiv.textContent = data.response;
        currentScreenshotBase64 = null;
      } catch (err) {
        outputDiv.textContent = 'Error al conectar con Ollama para el análisis visual.';
        console.error(err);
      }
      return;
    }

    // CASO B: Consulta RAG estricta
    outputDiv.textContent = 'Buscando contexto relevante...';
    contextDiv.classList.add('hidden');

    const relevantChunks = await searchRelevantContext(query, 2, 0.45);

    let contextText = "";
    let prompt = "";

    if (relevantChunks.length > 0) {
      contextText = relevantChunks.map(c => `[Fuente: ${c.source}]\n${c.text}`).join('\n\n');
      contextDiv.textContent = `Contexto relevante usado:\n${contextText}`;
      contextDiv.classList.remove('hidden');

      prompt = `Eres un asistente RAG estricto. Responde a la pregunta del usuario basándote ÚNICAMENTE en el siguiente contexto recuperado. No añadas información del contexto que no se pida en la pregunta.

Contexto:
${contextText}

Pregunta: ${query}

Respuesta directa:`;

    } else {
      contextDiv.textContent = 'No se encontró información relevante en tus notas o archivos.';
      contextDiv.classList.remove('hidden');

      prompt = `Responde a la siguiente pregunta de forma breve y precisa usando tu conocimiento general:

Pregunta: ${query}

Respuesta:`;
    }

    outputDiv.textContent = 'Generando respuesta con LLM local...';

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false
        })
      });

      const data = await response.json();
      outputDiv.textContent = data.response;
    } catch (err) {
      outputDiv.textContent = 'Error al conectar con Ollama. Verifica que el servidor está activo.';
      console.error(err);
    }
  });
});

async function updateStatus() {
  const data = await chrome.storage.local.get(['vectorDB']);
  const count = data.vectorDB ? data.vectorDB.length : 0;
  document.getElementById('db-status').textContent = `${count} fragmento(s) en memoria`;
}