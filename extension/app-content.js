(() => {
  const send = assignments => {
    window.postMessage({ type: 'HAC_CLASSWORK_IMPORT', assignments }, window.location.origin);
  };

  chrome.storage.local.get(['homework-hub-hac-imports'], result => {
    const assignments = result['homework-hub-hac-imports'];
    if (Array.isArray(assignments) && assignments.length) send(assignments);
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'HAC_CLASSWORK_IMPORT' && Array.isArray(message.assignments)) send(message.assignments);
  });
})();
