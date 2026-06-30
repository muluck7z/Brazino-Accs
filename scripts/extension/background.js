const DEFAULT_API_URL = "https://16e2259d-8435-43e3-8614-2005ecb7c929-00-1rpux82y99s6w.picard.replit.dev/api/accounts";
const DEFAULT_API_KEY = "muluck";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["apiUrl", "apiKey"], (data) => {
    if (!data.apiUrl) chrome.storage.sync.set({ apiUrl: DEFAULT_API_URL });
    if (!data.apiKey) chrome.storage.sync.set({ apiKey: DEFAULT_API_KEY });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SAVE_ACCOUNT") {
    chrome.storage.sync.get(["apiUrl", "apiKey"], async (config) => {
      const url = config.apiUrl || DEFAULT_API_URL;
      const key = config.apiKey || DEFAULT_API_KEY;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": key,
          },
          body: JSON.stringify(message.data),
        });

        if (res.ok) {
          const account = await res.json();
          sendResponse({ success: true, account });
        } else {
          const err = await res.text();
          sendResponse({ success: false, error: `Erro ${res.status}: ${err}` });
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    });

    return true;
  }
});
