const OLLAMA_HOST = 'http://localhost:11434';

// Convierte texto en vectores usando nomic-embed-text
async function getEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text
      })
    });
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Error al generar embedding:', error);
    return null;
  }
}

// Producto escalar entre dos vectores
function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

// Magnitud de un vector
function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

// Cálculo de Similitud del Coseno
function cosineSimilarity(vecA, vecB) {
  const dot = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Fragmentación simple de texto
function chunkText(text, chunkSize = 300) {
  const words = text.split(' ');
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

// Guarda un nuevo bloque de texto en el Vector Store local
async function storeKnowledgeBit(text, source = 'Nota manual') {
  const chunks = chunkText(text);
  const data = await chrome.storage.local.get(['vectorDB']);
  const db = data.vectorDB || [];

  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk);
    if (embedding) {
      db.push({
        id: Date.now() + Math.random(),
        text: chunk,
        embedding: embedding,
        source: source,
        timestamp: new Date().toISOString()
      });
    }
  }

  await chrome.storage.local.set({ vectorDB: db });
}

// Búsqueda de fragmentos más relevantes CON FILTRO DE SIMILITUD MÍNIMA
async function searchRelevantContext(query, topK = 2, minScore = 0.45) {
  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) return [];

  const data = await chrome.storage.local.get(['vectorDB']);
  const db = data.vectorDB || [];

  const scored = db.map(item => ({
    text: item.text,
    source: item.source,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  // Ordenamos de mayor a menor similitud
  scored.sort((a, b) => b.score - a.score);

  // Descartamos todo lo que no alcance el umbral de relevancia
  const filtered = scored.filter(item => item.score >= minScore);

  return filtered.slice(0, topK);
}