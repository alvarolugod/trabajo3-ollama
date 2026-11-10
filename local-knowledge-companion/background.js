importScripts('vectorStore.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-rag",
    title: "Guardar texto en Memoria RAG",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "add-to-rag" && info.selectionText) {
    const sourceTitle = tab?.title || 'Web';
    await storeKnowledgeBit(info.selectionText, sourceTitle);
    
    // Notificación visual opcional en la extensión
    console.log("Texto indexado correctamente en RAG local.");
  }
});