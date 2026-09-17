const HAC_KEY = 'homework-hub-hac-imports';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'HAC_PARSED') return;
  const assignments = Array.isArray(message.assignments) ? message.assignments : [];
  chrome.storage.local.set({ [HAC_KEY]: assignments, hacImportedAt: new Date().toISOString() });

  chrome.tabs.query({ url: ['https://*.vercel.app/*', 'http://localhost:3000/*'] }, tabs => {
    for (const tab of tabs) {
      if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'HAC_CLASSWORK_IMPORT', assignments }).catch(() => {});
    }
  });

  sendResponse({ ok: true, count: assignments.length });
});
