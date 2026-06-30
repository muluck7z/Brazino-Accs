// ══════════════════════════════════════════════════════════
//  BRAZINO v5.1 — Popup Script
// ══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async function () {

    // ── Navegação ──
    document.querySelectorAll('.nav-btn').forEach(btn =>
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab'))));

    function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabName + 'Tab').classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        if (tabName === 'secret') initSecretTab();
        if (tabName === 'contas') { renderAccounts(); checkAndShowAlerts(); }
        if (tabName !== 'login') {
            document.getElementById('profileView').style.display = 'none';
            document.getElementById('loginCard').style.display = 'block';
        }
    }

    // ── Utilitários ──
    function showAlert(message, type, alertId) {
        const el = document.getElementById(alertId);
        if (!el) return;
        const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
        // Cria os elementos via DOM — nunca coloca strings de rede direto em innerHTML
        const wrapper = document.createElement('div');
        wrapper.className = `alert alert-${type}`;
        const inner = document.createElement('div');
        inner.className = 'alert-main';
        const ico = document.createElement('i');
        ico.className = `fas fa-${icon}`;
        inner.appendChild(ico);
        inner.append(' ' + String(message)); // textContent implícito via append()
        wrapper.appendChild(inner);
        el.innerHTML = '';
        el.appendChild(wrapper);
    }
    function showStatus(msg, type) {
        const el = document.getElementById('status-msg');
        el.className = type === 'success' ? 'msg-success' : 'msg-error';
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 2500);
    }
    function copyText(text) {
        if (!text) return;
        navigator.clipboard.writeText(String(text)).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = String(text); document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        });
    }
    function escapeHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function isValidTotpSecret(s) {
        return typeof s === 'string' && s.length >= 8 && s.length <= 64 && /^[A-Z2-7=]+$/i.test(s.replace(/\s/g,''));
    }
    function formatTime(ts) {
        if (!ts) return 'Nunca';
        const d = new Date(ts);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // ── Limpeza de storage legado ──
    async function cleanupLegacyStorage() {
        const data = await chrome.storage.local.get(['robloxSecret','brazinoTotpSecret']);
        const toRemove = [];
        if (data.robloxSecret && isValidTotpSecret(data.robloxSecret) && !data.brazinoTotpSecret)
            await chrome.storage.local.set({ brazinoTotpSecret: data.robloxSecret });
        if (data.robloxSecret) toRemove.push('robloxSecret');
        if (data.brazinoTotpSecret && !isValidTotpSecret(data.brazinoTotpSecret)) toRemove.push('brazinoTotpSecret');
        if (toRemove.length) await chrome.storage.local.remove(toRemove);
    }
    await cleanupLegacyStorage();

    // ── Remove alertas falsos ──
    async function cleanupFalseAlerts() {
        const d = await chrome.storage.local.get(['brazinoAlerts']);
        const alerts = d.brazinoAlerts || [];
        const clean = alerts.filter(a => {
            if (a.type !== 'newAuthKey') return true;
            const s = (a.secret || '').replace(/\s/g,'').toUpperCase();
            if (![16,24,32].includes(s.length)) return false;
            if (!/^[A-Z2-7]+$/.test(s)) return false;
            const digits = (s.match(/[2-7]/g)||[]).length;
            return digits >= 2 && digits / s.length >= 0.10;
        });
        if (clean.length !== alerts.length)
            await chrome.storage.local.set({ brazinoAlerts: clean });
    }
    await cleanupFalseAlerts();

    // ══════════════════════════════
    //  CONTAS — armazenamento
    // ══════════════════════════════
    let savedAccounts = [];
    let contasTotpIntervals  = {};
    let accountInboxIntervals = {};
    let editingUserId  = null;
    let deletingUserId = null;
    const accountDataMap = new Map();

    async function loadAccounts() {
        const d = await chrome.storage.local.get(['brazinoAccounts']);
        savedAccounts = d.brazinoAccounts || [];
        accountDataMap.clear();
        savedAccounts.forEach(a => accountDataMap.set(String(a.userId), a));
        return savedAccounts;
    }
    async function persistAccounts() {
        await chrome.storage.local.set({ brazinoAccounts: savedAccounts });
        accountDataMap.clear();
        savedAccounts.forEach(a => accountDataMap.set(String(a.userId), a));
    }
    function findAccount(uid) { return savedAccounts.find(a => String(a.userId) === String(uid)); }

    async function upsertAccount(fields) {
        await loadAccounts();
        const uid = String(fields.userId);
        const clean = {};
        Object.entries(fields).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') clean[k] = v; });
        clean.userId = uid;
        const idx = savedAccounts.findIndex(a => String(a.userId) === uid);
        if (idx >= 0) savedAccounts[idx] = { ...savedAccounts[idx], ...clean, updatedAt: Date.now() };
        else savedAccounts.push({ ...clean, createdAt: Date.now(), updatedAt: Date.now() });
        await persistAccounts();
        // Sync automático com Brazino Vault (site) — fire-and-forget
        const _syncAcc = savedAccounts.find(a => String(a.userId) === uid);
        if (_syncAcc) chrome.runtime.sendMessage({ action: 'syncVault', account: _syncAcc }).catch(() => {});
    }
    async function deleteAccount(uid) {
        await loadAccounts();
        savedAccounts = savedAccounts.filter(a => String(a.userId) !== String(uid));
        await persistAccounts();
    }
    async function getCurrentLoggedUserId() {
        try {
            const r = await fetch('https://users.roblox.com/v1/users/authenticated', { credentials: 'include' });
            if (!r.ok) return null;
            const d = await r.json();
            return d.id ? String(d.id) : null;
        } catch { return null; }
    }

    // ── Delegação global de cópia ──
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-copy-uid][data-copy-field]');
        if (!btn) return;
        e.stopPropagation();
        const uid   = btn.dataset.copyUid;
        const field = btn.dataset.copyField;
        if (field === 'totp') {
            const el = document.getElementById(`totp-code-${uid}`);
            if (el) { copyText(el.textContent); showStatus('Código copiado!', 'success'); }
            return;
        }
        if (field === 'tempEmail') {
            const acc = accountDataMap.get(uid);
            if (acc?.tempEmail) { copyText(acc.tempEmail); showStatus('E-mail copiado!', 'success'); }
            return;
        }
        const acc = accountDataMap.get(uid);
        if (acc?.[field]) { copyText(acc[field]); showStatus('Copiado!', 'success'); }
    });

    // ══════════════════════════════
    //  ALERTAS de Auth Key
    // ══════════════════════════════
    document.getElementById('clearAlertsBtn').addEventListener('click', async () => {
        await chrome.storage.local.set({ brazinoAlerts: [] });
        checkAndShowAlerts();
        showStatus('Alertas limpos.', 'success');
    });

    async function checkAndShowAlerts() {
        const area = document.getElementById('contasAlertArea');
        if (!area) return;
        const d = await chrome.storage.local.get(['brazinoAlerts']);
        const alerts = d.brazinoAlerts || [];
        const clearBtn = document.getElementById('clearAlertsBtn');
        if (clearBtn) clearBtn.style.display = alerts.length ? 'inline-flex' : 'none';
        if (!alerts.length) { area.innerHTML = ''; return; }
        area.innerHTML = '';
        alerts.forEach((alert, idx) => {
            const div = document.createElement('div');
            if (alert.type === 'authRemoved') {
                div.className = 'auth-alert-banner danger';
                div.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <div class="auth-alert-body">
                        <strong>Autenticador Removido</strong>
                        <span>A chave 2FA da conta <b>${escapeHtml(alert.username || alert.userId)}</b> foi removida do Roblox. Auth Key limpa dos dados salvos.</span>
                        <div class="auth-alert-actions">
                            <button class="auth-alert-dismiss" data-dismiss="${idx}"><i class="fas fa-times"></i> Fechar</button>
                        </div>
                    </div>`;
            } else if (alert.type === 'newAuthKey') {
                div.className = 'auth-alert-banner';
                div.innerHTML = `
                    <i class="fas fa-shield-alt"></i>
                    <div class="auth-alert-body">
                        <strong>Nova Chave Autenticador Detectada</strong>
                        <span>Conta <b>${escapeHtml(alert.username || alert.userId)}</b> — nova chave: <code style="font-size:10px;color:var(--primary);">${escapeHtml(alert.secret)}</code></span>
                        <div class="auth-alert-actions">
                            <button class="auth-alert-accept" data-accept="${idx}" data-uid="${alert.userId}" data-secret="${escapeHtml(alert.secret)}">
                                <i class="fas fa-save"></i> Salvar nova chave
                            </button>
                            <button class="auth-alert-dismiss" data-dismiss="${idx}"><i class="fas fa-times"></i> Ignorar</button>
                        </div>
                    </div>`;
            }
            area.appendChild(div);
        });

        area.querySelectorAll('[data-accept]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx  = parseInt(btn.dataset.accept);
                const uid  = btn.dataset.uid;
                const secret = btn.dataset.secret;
                await upsertAccount({ userId: uid, authKey: secret });
                await chrome.storage.local.set({ brazinoTotpSecret: secret });
                await dismissAlert(idx);
                showStatus('Nova chave salva!', 'success');
                renderAccounts();
            });
        });
        area.querySelectorAll('[data-dismiss]').forEach(btn => {
            btn.addEventListener('click', async () => { await dismissAlert(parseInt(btn.dataset.dismiss)); });
        });
    }
    async function dismissAlert(idx) {
        const d = await chrome.storage.local.get(['brazinoAlerts']);
        const alerts = (d.brazinoAlerts || []).filter((_, i) => i !== idx);
        await chrome.storage.local.set({ brazinoAlerts: alerts });
        checkAndShowAlerts();
    }

    // ══════════════════════════════
    //  RENDERIZAÇÃO — Contas
    // ══════════════════════════════
    function renderAccounts() {
        loadAccounts().then(() => {
            const list  = document.getElementById('accountList');
            const empty = document.getElementById('contasEmpty');
            Object.values(contasTotpIntervals).forEach(clearInterval);
            contasTotpIntervals = {};
            if (!savedAccounts.length) { empty.style.display = 'block'; list.style.display = 'none'; list.innerHTML = ''; return; }
            empty.style.display = 'none';
            list.style.display = 'flex';
            list.innerHTML = '';
            savedAccounts.forEach(acc => list.appendChild(buildAccountCard(acc)));
        });
    }

    function buildAccountCard(account) {
        const card = document.createElement('div');
        card.className = 'account-card';
        const uid = String(account.userId);
        card.dataset.uid = uid;

        const badges = [
            account.authKey ? '<span class="account-badge badge-auth"><i class="fas fa-shield-alt"></i> 2FA</span>' : '',
            account.password ? '<span class="account-badge badge-pass"><i class="fas fa-lock"></i> Senha</span>' : '',
            account.email    ? '<span class="account-badge" style="background:rgba(59,130,246,.15);color:#93c5fd;"><i class="fas fa-envelope"></i> Email</span>' : ''
        ].filter(Boolean).join('');

        const lastLogin = account.lastLogin ? new Date(account.lastLogin).toLocaleDateString('pt-BR') : 'nunca';

        card.innerHTML = `
            <div class="account-card-header">
                ${account.avatarUrl
                    ? `<img src="${escapeHtml(account.avatarUrl)}" class="account-avatar" alt="${escapeHtml(account.username||'')}">` 
                    : `<div class="account-avatar-placeholder"><i class="fas fa-user"></i></div>`}
                <div class="account-info">
                    <div class="account-name">${escapeHtml(account.username || 'Desconhecido')}</div>
                    <div class="account-meta"><span>ID: ${uid}</span>${badges}</div>
                    <div class="account-meta" style="margin-top:2px;"><span style="font-size:10px;">Último login: ${lastLogin}</span></div>
                </div>
                <i class="fas fa-chevron-down account-chevron"></i>
            </div>
            <div class="account-details">
                <div class="detail-grid">
                    ${detailRow('fas fa-id-badge','Username', account.username, uid,'username')}
                    ${detailRow('fas fa-lock',    'Senha',    account.password, uid,'password',true)}
                    ${detailRow('fas fa-envelope','E-mail',   account.email,    uid,'email')}
                    ${detailRow('fas fa-key',     'Auth Key', account.authKey,  uid,'authKey',false,true)}
                    ${totpRow(uid, account.authKey)}
                </div>
                ${buildTempEmailSection(uid, account)}
                <div class="account-actions" style="margin-top:10px;">
                    <button class="btn-primary login-btn" data-uid="${uid}" style="font-size:12px;padding:8px 10px;">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                    <button class="btn-ghost edit-btn" data-uid="${uid}"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-ghost download-btn" data-uid="${uid}"><i class="fas fa-download"></i> Baixar</button>
                    <button class="btn-danger delete-btn" data-uid="${uid}"
                        style="flex:0;width:34px;height:34px;padding:0;border-radius:8px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;

        card.querySelector('.account-card-header').addEventListener('click', () => {
            const wasExpanded = card.classList.contains('expanded');
            document.querySelectorAll('.account-card.expanded').forEach(c => c.classList.remove('expanded'));
            if (!wasExpanded) {
                card.classList.add('expanded');
                if (account.authKey) startContaTotp(uid, account.authKey);
                if (account.tempToken) startAccountInboxMonitoring(uid, account.tempToken);
            } else {
                if (contasTotpIntervals[uid]) { clearInterval(contasTotpIntervals[uid]); delete contasTotpIntervals[uid]; }
            }
        });

        card.querySelector('.login-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await chrome.storage.local.set({ pendingLogin: { username: account.username, password: account.password }, lastLoggedUserId: uid });
            chrome.tabs.create({ url: 'https://www.roblox.com/login' });
            showStatus('Abrindo login...', 'success');
        });

        card.querySelector('.edit-btn').addEventListener('click',    (e) => { e.stopPropagation(); openEditModal(uid); });
        card.querySelector('.download-btn').addEventListener('click',(e) => { e.stopPropagation(); downloadSingleAccount(uid); });
        card.querySelector('.delete-btn').addEventListener('click',  (e) => { e.stopPropagation(); openDeleteModal(uid); });

        const genBtn = card.querySelector('.btn-gen-temp');
        if (genBtn) genBtn.addEventListener('click', (e) => { e.stopPropagation(); genAccountEmail(uid, card); });

        return card;
    }

    function buildTempEmailSection(uid, account) {
        if (account.tempEmail) {
            const lastNotif = account.tempLastNotif;
            const isVerified = lastNotif?.type === 'verify';
            const dotClass   = isVerified ? '' : 'active';
            const statusText = isVerified ? 'Verificado!' : 'Monitorando...';
            let notifHtml = '';
            if (lastNotif) {
                if (lastNotif.type === 'verify' && lastNotif.link) {
                    notifHtml = `<div class="temp-inbox-notif verify" data-link="${escapeHtml(lastNotif.link)}">
                        <i class="fas fa-check-circle"></i><span>${escapeHtml(lastNotif.content)}</span>
                        <i class="fas fa-external-link-alt" style="margin-left:auto;opacity:.7;"></i></div>`;
                } else if (lastNotif.type === 'revert' && lastNotif.link) {
                    notifHtml = `<div class="temp-inbox-notif revert" data-link="${escapeHtml(lastNotif.link)}">
                        <i class="fas fa-undo"></i><span>${escapeHtml(lastNotif.content)}</span>
                        <i class="fas fa-external-link-alt" style="margin-left:auto;opacity:.7;"></i></div>`;
                } else if (lastNotif.type === 'code') {
                    notifHtml = `<div class="temp-inbox-notif code">
                        <i class="fas fa-key"></i><span>${escapeHtml(lastNotif.content)}</span></div>`;
                }
            }
            return `<div class="account-temp-email">
                <div class="temp-email-header">
                    <span class="temp-email-label"><i class="fas fa-inbox"></i> Email Temporário</span>
                    <div class="temp-inbox-status">
                        <div class="temp-inbox-dot ${dotClass}" id="temp-dot-${uid}"></div>
                        <span id="temp-status-${uid}">${statusText}</span>
                    </div>
                </div>
                <div class="temp-email-row">
                    <span title="${escapeHtml(account.tempEmail)}">${escapeHtml(account.tempEmail)}</span>
                    <div class="temp-email-actions">
                        <button class="btn-temp-sm" data-copy-uid="${uid}" data-copy-field="tempEmail" title="Copiar email"><i class="fas fa-copy"></i></button>
                        <button class="btn-temp-sm btn-gen-temp-replace" data-uid="${uid}" title="Gerar novo email"><i class="fas fa-sync-alt"></i></button>
                    </div>
                </div>
                ${notifHtml}
            </div>`;
        }
        return `<div class="account-temp-email">
            <button class="btn-gen-temp" data-uid="${uid}"><i class="fas fa-plus"></i> Gerar Email Temporário</button>
        </div>`;
    }

    async function genAccountEmail(uid, cardEl) {
        const btn = cardEl?.querySelector(`.btn-gen-temp[data-uid="${uid}"], .btn-gen-temp-replace[data-uid="${uid}"]`);
        if (btn) btn.disabled = true;
        showStatus('Gerando e-mail...', 'success');
        try {
            const domains = await fetch('https://api.mail.tm/domains').then(r => r.json());
            const domain  = domains['hydra:member'][0].domain;
            const user    = Math.random().toString(36).substring(2, 12);
            const address = `${user}@${domain}`;
            const password = Math.random().toString(36).substring(2, 15);
            await fetch('https://api.mail.tm/accounts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, password })
            });
            const { token } = await fetch('https://api.mail.tm/token', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, password })
            }).then(r => r.json());

            await upsertAccount({ userId: uid, tempEmail: address, tempToken: token, tempLastNotif: null, tempLastMsgId: null, tempVerifyDone: false });
            if (accountInboxIntervals[uid]) { clearInterval(accountInboxIntervals[uid]); delete accountInboxIntervals[uid]; }
            copyText(address);
            showStatus('E-mail gerado e copiado!', 'success');
            renderAccounts();
            setTimeout(() => startAccountInboxMonitoring(uid, token), 400);
            chrome.runtime.sendMessage({ action: 'bgStartAccMonitor', uid }).catch(() => {});
        } catch {
            showStatus('Erro ao gerar e-mail.', 'error');
            if (btn) btn.disabled = false;
        }
    }

    function startAccountInboxMonitoring(uid, token) {
        if (!token) return;
        if (accountInboxIntervals[uid]) return;
        const dotEl    = () => document.getElementById(`temp-dot-${uid}`);
        const statusEl = () => document.getElementById(`temp-status-${uid}`);
        let lastMsgId  = null;
        let verifyDone = false;
        const initAcc = findAccount(uid);
        if (initAcc?.tempVerifyDone) verifyDone = true;
        if (initAcc?.tempLastMsgId)  lastMsgId  = initAcc.tempLastMsgId;

        accountInboxIntervals[uid] = setInterval(async () => {
            try {
                const freshAcc = findAccount(uid);
                if (!freshAcc?.tempToken) { clearInterval(accountInboxIntervals[uid]); delete accountInboxIntervals[uid]; return; }
                const liveToken = freshAcc.tempToken;
                const messages = (await fetch('https://api.mail.tm/messages', {
                    headers: { 'Authorization': `Bearer ${liveToken}` }
                }).then(r => r.json()))['hydra:member'];
                if (!messages?.length) return;
                if (messages[0].id === lastMsgId) return;
                const msgData = await fetch(`https://api.mail.tm/messages/${messages[0].id}`, {
                    headers: { 'Authorization': `Bearer ${liveToken}` }
                }).then(r => r.json());
                const txt         = msgData.text || '';
                const full        = txt + (msgData.html ? msgData.html.join('') : '');
                const verifyMatch = full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+verify[^\s"'>]*/i);
                const revertMatch = full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+revert[^\s"'>]*/i);
                const codeMatch   = txt.match(/\b\d{6}\b/);
                if (verifyMatch && !verifyDone) {
                    const link  = verifyMatch[0].replace(/&amp;/g, '&');
                    const notif = { type: 'verify', content: 'Clique para verificar conta Roblox', link };
                    verifyDone = true; lastMsgId = messages[0].id;
                    const acc = findAccount(uid);
                    const update = { userId: uid, tempLastNotif: notif, tempLastMsgId: lastMsgId, tempVerifyDone: true };
                    if (acc?.tempEmail) update.email = acc.tempEmail;
                    await upsertAccount(update);
                    if (dotEl()) dotEl().classList.remove('active');
                    if (statusEl()) statusEl().textContent = 'Verificação recebida!';
                    showStatus('Link de verificação recebido! Abrindo...', 'success');
                    chrome.tabs.create({ url: link });
                    renderAccounts();
                } else if (revertMatch) {
                    const link  = revertMatch[0].replace(/&amp;/g, '&');
                    const notif = { type: 'revert', content: 'Clique para reverter alterações', link };
                    lastMsgId = messages[0].id;
                    await upsertAccount({ userId: uid, tempLastNotif: notif, tempLastMsgId: lastMsgId });
                    if (statusEl()) statusEl().textContent = 'Reversão recebida!';
                    showStatus('Link de reversão recebido!', 'success');
                    renderAccounts();
                } else if (codeMatch) {
                    const code  = codeMatch[0];
                    const notif = { type: 'code', content: `Código: ${code}` };
                    lastMsgId = messages[0].id;
                    await upsertAccount({ userId: uid, tempLastNotif: notif, tempLastMsgId: lastMsgId });
                    await chrome.storage.local.set({ lastTempCode: code, lastTempCodeTime: Date.now() });
                    chrome.tabs.query({ url: '*://*.roblox.com/*' }, (tabs) =>
                        tabs.forEach(t => chrome.tabs.sendMessage(t.id, { action: 'codeCaptured', code }).catch(() => {})));
                    if (statusEl()) statusEl().textContent = `Código: ${code}`;
                    showStatus('Código capturado!', 'success');
                    renderAccounts();
                }
            } catch { }
        }, 4000);
    }

    function detailRow(icon, label, value, uid, field, isPassword=false, isMono=false) {
        const has = !!value;
        const display = isPassword && has ? '••••••••' : (has ? escapeHtml(value) : '');
        const content = has ? display : 'não definido';
        const copyBtn = has
            ? `<button class="detail-copy-btn" data-copy-uid="${uid}" data-copy-field="${field}" title="Copiar"><i class="fas fa-copy"></i></button>`
            : '';
        return `<div class="detail-row">
            <i class="${icon} detail-icon"></i>
            <span class="detail-label">${label}</span>
            <span class="detail-value${has ? '' : ' empty'}" style="${isMono ? 'font-size:10px;font-family:monospace;' : ''}">${content}</span>
            ${copyBtn}
        </div>`;
    }

    function totpRow(uid, authKey) {
        if (!authKey) return `<div class="detail-row"><i class="fas fa-clock detail-icon"></i>
            <span class="detail-label">Cód. 2FA</span><span class="detail-value empty">sem auth key</span></div>`;
        return `<div class="detail-row">
            <i class="fas fa-clock detail-icon"></i>
            <span class="detail-label">Cód. 2FA</span>
            <div style="flex:1;display:flex;align-items:center;gap:8px;">
                <span class="totp-inline" id="totp-code-${uid}">------</span>
                <span class="totp-timer" id="totp-timer-${uid}"></span>
            </div>
            <button class="detail-copy-btn" data-copy-uid="${uid}" data-copy-field="totp" title="Copiar"><i class="fas fa-copy"></i></button>
        </div>`;
    }

    function startContaTotp(uid, authKey) {
        if (contasTotpIntervals[uid]) clearInterval(contasTotpIntervals[uid]);
        async function tick() {
            const code  = await TOTP.generate(authKey);
            const cEl   = document.getElementById(`totp-code-${uid}`);
            const tEl   = document.getElementById(`totp-timer-${uid}`);
            if (!cEl) { clearInterval(contasTotpIntervals[uid]); return; }
            if (code) cEl.textContent = code;
            const secs = 30 - (Math.floor(Date.now() / 1000) % 30);
            if (tEl) tEl.textContent = `${secs}s`;
        }
        tick();
        contasTotpIntervals[uid] = setInterval(tick, 1000);
    }

    document.addEventListener('click', e => {
        const notif = e.target.closest('.temp-inbox-notif[data-link]');
        if (notif?.dataset.link) chrome.tabs.create({ url: notif.dataset.link });
        const replaceBtn = e.target.closest('.btn-gen-temp-replace');
        if (replaceBtn) {
            e.stopPropagation();
            const uid  = replaceBtn.dataset.uid;
            const card = replaceBtn.closest('.account-card');
            if (uid) genAccountEmail(uid, card);
        }
    });

    // ── Edit Modal ──
    function openEditModal(uid) {
        editingUserId = uid;
        const acc = findAccount(uid);
        if (!acc) return;
        document.getElementById('edit-password').value = acc.password || '';
        document.getElementById('edit-authKey').value  = acc.authKey  || '';
        document.getElementById('edit-email').value    = acc.email    || '';
        document.getElementById('editModal').classList.add('active');
    }
    ['editModalClose','editModalCancel'].forEach(id =>
        document.getElementById(id).addEventListener('click', () => {
            document.getElementById('editModal').classList.remove('active');
            editingUserId = null;
        }));
    document.getElementById('editModalSave').addEventListener('click', async () => {
        if (!editingUserId) return;
        const authKey = document.getElementById('edit-authKey').value.trim().replace(/\s/g,'');
        const fields = {
            userId: editingUserId,
            password: document.getElementById('edit-password').value,
            email: document.getElementById('edit-email').value.trim()
        };
        if (authKey && isValidTotpSecret(authKey)) {
            fields.authKey = authKey;
            await chrome.storage.local.set({ brazinoTotpSecret: authKey });
        } else if (!authKey) {
            await loadAccounts();
            const idx = savedAccounts.findIndex(a => String(a.userId) === editingUserId);
            if (idx >= 0) { delete savedAccounts[idx].authKey; await persistAccounts(); }
        }
        await upsertAccount(fields);
        document.getElementById('editModal').classList.remove('active');
        editingUserId = null;
        showStatus('Conta atualizada!', 'success');
        renderAccounts();
    });

    // ── Delete Modal ──
    function openDeleteModal(uid) { deletingUserId = uid; document.getElementById('deleteModal').classList.add('active'); }
    document.getElementById('deleteModalCancel').addEventListener('click', () => {
        document.getElementById('deleteModal').classList.remove('active'); deletingUserId = null;
    });
    document.getElementById('deleteModalConfirm').addEventListener('click', async () => {
        if (!deletingUserId) return;
        await deleteAccount(deletingUserId);
        if (accountInboxIntervals[deletingUserId]) { clearInterval(accountInboxIntervals[deletingUserId]); delete accountInboxIntervals[deletingUserId]; }
        document.getElementById('deleteModal').classList.remove('active');
        deletingUserId = null;
        showStatus('Conta removida.', 'success');
        renderAccounts();
    });

    // ── Download ──
    function downloadSingleAccount(uid) {
        const acc = savedAccounts.find(a => String(a.userId) === uid);
        if (!acc) return;
        const blob = new Blob([JSON.stringify(acc, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `brazino_${acc.username || uid}.json`; a.click(); URL.revokeObjectURL(url);
        showStatus('Download iniciado!', 'success');
    }
    document.getElementById('downloadAllBtn').addEventListener('click', async () => {
        await loadAccounts();
        if (!savedAccounts.length) { showStatus('Nenhuma conta para exportar.', 'error'); return; }
        const blob = new Blob([JSON.stringify(savedAccounts, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `brazino_contas_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
        showStatus(`${savedAccounts.length} conta(s) exportada(s)!`, 'success');
    });

    // ══════════════════════════════════════════════════
    //  TAB: SECRET — Refresher de Cookie
    // ══════════════════════════════════════════════════
    let secretTabInitialized = false;

    async function initSecretTab() {
        await updateRefresherStatus();
        if (secretTabInitialized) return;
        secretTabInitialized = true;

        // ── Botão: Refresh Manual ──
        document.getElementById('refreshNowBtn').addEventListener('click', async () => {
            const btn = document.getElementById('refreshNowBtn');
            const dot = document.getElementById('refresherDot');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
            dot.className = 'api-status-dot active';
            showAlert('Fazendo refresh do cookie...', 'info', 'refresher-alert');

            const result = await new Promise(r => chrome.runtime.sendMessage({ action: 'refreshCookieNow' }, r));

            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Manual Agora';

            if (result?.success) {
                if (result.changed) {
                    showAlert(`Cookie atualizado! Preview: ...${result.cookie.slice(-20)}`, 'success', 'refresher-alert');
                } else {
                    showAlert('Cookie verificado — sem mudanças (ainda válido).', 'success', 'refresher-alert');
                }
            } else {
                showAlert(result?.reason || 'Erro desconhecido', 'error', 'refresher-alert');
            }

            await updateRefresherStatus();
        });

        // ── Botão: Copiar cookie preview ──
        document.getElementById('copyCookiePreviewBtn').addEventListener('click', async () => {
            const d2 = await chrome.storage.local.get(['lastSavedCookie']);
            if (d2.lastSavedCookie) {
                copyText(d2.lastSavedCookie);
                showStatus('Cookie copiado!', 'success');
            }
        });
    }

    async function updateRefresherStatus() {
        const d = await chrome.storage.local.get(['lastCookieRefreshTime', 'lastCookieRefreshStatus', 'lastSavedCookie']);
        const dot       = document.getElementById('refresherDot');
        const timeEl    = document.getElementById('refresherLastTime');
        const cookieBox = document.getElementById('refresherCookieBox');
        const cookiePrev = document.getElementById('refresherCookiePreview');

        if (!dot || !timeEl) return;

        const status = d.lastCookieRefreshStatus;
        const time   = d.lastCookieRefreshTime;

        dot.className = 'api-status-dot';
        if (status === 'updated' || status === 'unchanged') dot.classList.add('ok');
        else if (status === 'auth_failed' || status === 'error' || status === 'cookie_lost') dot.classList.add('error');

        if (time) {
            const diff = Math.round((Date.now() - time) / 1000);
            const diffStr = diff < 60 ? `há ${diff}s` : diff < 3600 ? `há ${Math.round(diff/60)}min` : `às ${new Date(time).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`;
            const statusLabel = {
                updated:      '✅ Cookie atualizado',
                unchanged:    '✓ Verificado (sem mudanças)',
                auth_failed:  '❌ Não autenticado',
                cookie_lost:  '❌ Cookie perdido',
                error:        '❌ Erro',
                not_logged_in:'⚠️ Sem login'
            }[status] || status || '—';
            timeEl.textContent = `${statusLabel} — ${diffStr}`;
        } else {
            timeEl.textContent = 'Ainda não rodou (próximo: em até 15min)';
        }

        if (d.lastSavedCookie) {
            cookieBox.style.display = 'flex';
            cookiePrev.textContent = '...' + d.lastSavedCookie.slice(-32);
        }
    }

    // ══════════════════════════
    //  TAB: LOGIN
    // ══════════════════════════
    function getAvatarUrl(userId) {
        return fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`)
            .then(r => r.json()).then(j => j.data?.[0]?.imageUrl || '').catch(() => '');
    }
    async function getRobux(userId) {
        try { const d = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`,{credentials:'include'}).then(r=>r.json()); return d.robux !== undefined ? String(d.robux) : '0'; }
        catch { return '0'; }
    }
    async function showUserInfo(user) {
        const [avatarUrl, robux, profile] = await Promise.all([
            getAvatarUrl(user.id), getRobux(user.id),
            fetch(`https://users.roblox.com/v1/users/${user.id}`).then(r=>r.json()).catch(()=>({}))
        ]);
        const created = profile.created || '';
        document.getElementById('userAvatar').src          = avatarUrl;
        document.getElementById('userName').textContent    = user.name || '';
        document.getElementById('userId').textContent      = user.id   || '';
        document.getElementById('userCreated').textContent = created ? new Date(created).toLocaleDateString('pt-BR') : '-';
        document.getElementById('daysSince').textContent   = created ? Math.floor((Date.now()-new Date(created).getTime())/86400000) : 'N/A';
        document.getElementById('userRobux').textContent   = robux;
        document.getElementById('loginCard').style.display   = 'none';
        document.getElementById('profileView').style.display = 'block';
        const uid = String(user.id);
        await chrome.storage.local.set({ lastLoggedUserId: uid });
        await upsertAccount({ userId: uid, username: user.name||'', avatarUrl, lastLogin: Date.now() });
        setTimeout(() => chrome.tabs.create({ url: 'https://www.roblox.com/my/account#!/info' }), 2000);
    }
    function setRobloxCookie(cookieValue) {
        chrome.cookies.get({ url:'https://www.roblox.com/',name:'.ROBLOSECURITY'}, (old) => {
            chrome.cookies.set({ url:'https://www.roblox.com/',name:'.ROBLOSECURITY',value:cookieValue,domain:'.roblox.com',path:'/',secure:true,httpOnly:true,sameSite:'no_restriction' }, () => {
                fetch('https://users.roblox.com/v1/users/authenticated',{credentials:'include'})
                    .then(r=>{if(!r.ok)throw new Error('Cookie inválido');return r.json();})
                    .then(data=>{ showAlert('Sessão iniciada com sucesso!','success','login-alert'); showUserInfo(data); })
                    .catch(()=>{ if(old)chrome.cookies.set({url:'https://www.roblox.com/',name:'.ROBLOSECURITY',value:old.value,domain:'.roblox.com',path:'/',secure:true,httpOnly:true,sameSite:'no_restriction'}); showAlert('Cookie inválido ou expirado.','error','login-alert'); });
            });
        });
    }
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        let raw = document.getElementById('cookie').value;
        let cleaned = raw.replace(/[`"'\s\r\n\t*]/g,'');
        const wt = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
        let cv = cleaned.includes(wt) ? cleaned.split(wt)[1] : cleaned;
        const m = cv.match(/CAE[A-Z0-9._-]{100,}/i)||cv.match(/[A-Z0-9._-]{100,}/i);
        if(m) cv = m[0];
        cv = cv.replace(/[^A-Z0-9._-]+/i,'').replace(/_+$/,'');
        if(!cv||cv.length<50){showAlert('Cookie inválido ou muito curto.','error','login-alert');return;}
        setRobloxCookie(cv);
    });
    document.getElementById('backBtn').addEventListener('click',()=>{
        document.getElementById('loginCard').style.display='block';
        document.getElementById('profileView').style.display='none';
        document.getElementById('login-alert').innerHTML='';
        document.getElementById('cookie').value='';
    });

    // ══════════════════════════
    //  TAB: SECRET (Auth)
    // ══════════════════════════
    let authIntervalId=null, inboxIntervalId=null;
    const authSecretInput=document.getElementById('auth-secret');
    const authEmailInput =document.getElementById('auth-email');
    const authCurrPass   =document.getElementById('auth-current-pass');
    const authNewPass    =document.getElementById('auth-new-pass');
    const codeContainer  =document.getElementById('code-container');
    const codeDisplay    =document.getElementById('current-code');
    const timerBar       =document.getElementById('timer-bar');
    const timerText      =document.getElementById('timer-text');
    const displaySecret  =document.getElementById('display-secret');

    function startCodeGeneration(secret) {
        if(!isValidTotpSecret(secret)) return;
        if(authIntervalId)clearInterval(authIntervalId);
        async function tick(){
            const code=await TOTP.generate(secret);
            if(!code)return;
            codeDisplay.textContent=code; displaySecret.textContent=secret; codeContainer.style.display='block';
            const secs=30-(Math.floor(Date.now()/1000)%30);
            timerText.textContent=`Expira em ${secs}s`;
            timerBar.style.width=((secs/30)*100)+'%';
            timerBar.style.background=secs<=5?'var(--danger)':'var(--primary)';
        }
        tick(); authIntervalId=setInterval(tick,1000);
    }
    displaySecret.addEventListener('click',()=>{copyText(displaySecret.textContent);showStatus('Chave copiada!','success');});

    chrome.storage.local.get(['brazinoTotpSecret','email','currentPassword','newPassword','tempEmail','tempToken','lastNotif'],function(data){
        if(data.brazinoTotpSecret&&isValidTotpSecret(data.brazinoTotpSecret)){
            authSecretInput.value=data.brazinoTotpSecret;
            startCodeGeneration(data.brazinoTotpSecret);
        }
        if(data.email)           authEmailInput.value=data.email;
        if(data.currentPassword) authCurrPass.value=data.currentPassword;
        if(data.newPassword)     authNewPass.value=data.newPassword;
        if(data.tempEmail){
            document.getElementById('temp-email-addr').textContent=data.tempEmail;
            if(data.tempToken)startInboxMonitoring(data.tempToken);
        }
        if(data.lastNotif)updateEmailCard(data.lastNotif.type,data.lastNotif.content,data.lastNotif.link);
    });

    chrome.storage.onChanged.addListener(async(changes)=>{
        if(changes.currentPassword?.newValue!==undefined){
            authCurrPass.value=changes.currentPassword.newValue;
            const liveUid=await getCurrentLoggedUserId();
            const st=await chrome.storage.local.get(['lastLoggedUserId']);
            if(liveUid&&st.lastLoggedUserId&&liveUid===st.lastLoggedUserId){
                await upsertAccount({userId:liveUid,password:changes.currentPassword.newValue});
                renderAccounts();
            }
        }
        if(changes.newPassword?.newValue!==undefined) authNewPass.value=changes.newPassword.newValue;
        if(changes.brazinoAlerts) {
            const ct=document.querySelector('[data-tab="contas"].active');
            if(ct) checkAndShowAlerts();
        }
        if(changes.brazinoAccounts) { renderAccounts(); }
        if(changes.lastNotif?.newValue){
            const n=changes.lastNotif.newValue;
            updateEmailCard(n.type,n.content,n.link);
        }
        // Atualiza status do refresher se mudou
        if(changes.lastCookieRefreshStatus || changes.lastCookieRefreshTime) {
            const apiActive = document.getElementById('apiTab')?.classList.contains('active');
            if (apiActive) updateRefresherStatus();
        }
    });

    document.getElementById('auth-save').addEventListener('click',async()=>{
        const secret  =authSecretInput.value.trim().replace(/\s/g,'');
        const email   =authEmailInput.value.trim();
        const currPass=authCurrPass.value;
        const newPass =authNewPass.value;

        await chrome.storage.local.set({ brazinoTotpSecret:secret, email, currentPassword:currPass, newPassword:newPass });
        chrome.tabs.query({url:'*://*.roblox.com/*'},(tabs)=>tabs.forEach(t=>chrome.tabs.reload(t.id)));

        const liveUid=await getCurrentLoggedUserId();
        const st=await chrome.storage.local.get(['lastLoggedUserId']);
        if(liveUid&&st.lastLoggedUserId&&liveUid===st.lastLoggedUserId){
            const update={userId:liveUid};
            if(secret&&isValidTotpSecret(secret)) {
                update.authKey=secret;
            } else if(!secret) {
                await loadAccounts();
                const idx=savedAccounts.findIndex(a=>String(a.userId)===liveUid);
                if(idx>=0){ delete savedAccounts[idx].authKey; await persistAccounts(); }
            }
            if(currPass) update.password=currPass;
            if(Object.keys(update).length>1){await upsertAccount(update);renderAccounts();}
            showAlert('Configurações salvas e conta atualizada!','success','auth-alert');
        } else {
            showAlert('Configurações salvas.','success','auth-alert');
        }

        if(secret&&isValidTotpSecret(secret)) startCodeGeneration(secret);
        else { if(authIntervalId)clearInterval(authIntervalId); codeContainer.style.display='none'; }
    });

    // ── Temp Email (aba Auth) ──
    document.getElementById('gen-temp-email').addEventListener('click',async()=>{
        const btn=document.getElementById('gen-temp-email');
        const inboxText=document.getElementById('inbox-text');
        btn.disabled=true; inboxText.textContent='Gerando e-mail...';
        try{
            const domains=await fetch('https://api.mail.tm/domains').then(r=>r.json());
            const domain=domains['hydra:member'][0].domain;
            const user=Math.random().toString(36).substring(2,12);
            const address=`${user}@${domain}`;
            const password=Math.random().toString(36).substring(2,15);
            await fetch('https://api.mail.tm/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,password})});
            const{token}=await fetch('https://api.mail.tm/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,password})}).then(r=>r.json());
            authEmailInput.value=address;
            await chrome.storage.local.set({tempEmail:address,tempToken:token,email:address,tempLastMsgId:null,tempVerifyDone:false,lastNotif:null});
            document.getElementById('temp-email-addr').textContent=address;
            const liveUid=await getCurrentLoggedUserId();
            if(liveUid){
                await loadAccounts();
                const existingAcc=findAccount(liveUid);
                if(!existingAcc?.tempEmail){
                    await upsertAccount({userId:liveUid,tempEmail:address,tempToken:token,tempLastNotif:null,tempLastMsgId:null,tempVerifyDone:false});
                    renderAccounts();
                }
            }
            copyText(address); showStatus('E-mail gerado e copiado!','success');
            startInboxMonitoring(token);
            chrome.runtime.sendMessage({action:'bgStartGlobalMonitor'}).catch(()=>{});
        }catch{inboxText.textContent='Erro ao gerar e-mail.';}
        finally{btn.disabled=false;}
    });

    async function startInboxMonitoring(token){
        if(!token)return;
        if(inboxIntervalId)clearInterval(inboxIntervalId);
        const is=document.getElementById('inbox-status');
        const it=document.getElementById('inbox-text');
        is.classList.add('status-active'); it.textContent='Monitorando...';
        const initSt=await chrome.storage.local.get(['tempLastMsgId','tempVerifyDone']);
        let lastMsgId =initSt.tempLastMsgId||null;
        let verifyDone=initSt.tempVerifyDone||false;
        inboxIntervalId=setInterval(async()=>{
            try{
                const tkSt=await chrome.storage.local.get(['tempToken']);
                if(!tkSt.tempToken){clearInterval(inboxIntervalId);is.classList.remove('status-active');it.textContent='Monitoramento parado.';return;}
                const liveToken=tkSt.tempToken;
                const messages=(await fetch('https://api.mail.tm/messages',{headers:{'Authorization':`Bearer ${liveToken}`}}).then(r=>r.json()))['hydra:member'];
                if(!messages?.length)return;
                if(messages[0].id===lastMsgId)return;
                const md=await fetch(`https://api.mail.tm/messages/${messages[0].id}`,{headers:{'Authorization':`Bearer ${liveToken}`}}).then(r=>r.json());
                const txt=md.text||'';
                const full=txt+(md.html?md.html.join(''):'');
                const vm=full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+verify[^\s"'>]*/i);
                const rm=full.match(/https?:\/\/(www\.)?roblox\.com\/[^\s"'>]+revert[^\s"'>]*/i);
                const cm=txt.match(/\b\d{6}\b/);
                if(vm&&!verifyDone){
                    const link=vm[0].replace(/&amp;/g,'&');
                    verifyDone=true; lastMsgId=messages[0].id;
                    updateEmailCard('verify','Clique para verificar a conta Roblox',link);
                    await chrome.storage.local.set({lastNotif:{type:'verify',content:'Clique para verificar a conta Roblox',link},tempLastMsgId:lastMsgId,tempVerifyDone:true});
                    is.classList.remove('status-active'); it.textContent='Verificado — monitorando códigos...';
                    showStatus('Link de verificação recebido! Abrindo...','success');
                    const liveUid=await getCurrentLoggedUserId();
                    const stData=await chrome.storage.local.get(['lastLoggedUserId','email']);
                    if(liveUid&&stData.lastLoggedUserId&&liveUid===stData.lastLoggedUserId&&stData.email){
                        await upsertAccount({userId:liveUid,email:stData.email});
                        renderAccounts();
                    }
                    chrome.tabs.create({url:link});
                }else if(rm){
                    const link=rm[0].replace(/&amp;/g,'&');
                    lastMsgId=messages[0].id;
                    updateEmailCard('revert','Clique para reverter alterações',link);
                    await chrome.storage.local.set({lastNotif:{type:'revert',content:'Clique para reverter',link},tempLastMsgId:lastMsgId});
                    showStatus('Link de reversão recebido!','success');
                }else if(cm){
                    const code=cm[0];
                    lastMsgId=messages[0].id;
                    updateEmailCard('code',`Código recebido: ${code}`,null);
                    await chrome.storage.local.set({lastNotif:{type:'code',content:`Código: ${code}`,link:null},lastTempCode:code,lastTempCodeTime:Date.now(),tempLastMsgId:lastMsgId});
                    chrome.tabs.query({url:'*://*.roblox.com/*'},(tabs)=>tabs.forEach(t=>chrome.tabs.sendMessage(t.id,{action:'codeCaptured',code}).catch(()=>{})));
                    it.textContent=`Código: ${code}`;
                    showStatus('Código capturado!','success');
                }
            }catch{}
        },4000);
    }
    function updateEmailCard(type,content,link){
        const icons={verify:'fas fa-check-circle',revert:'fas fa-undo',code:'fas fa-key'};
        const labels={verify:'Verificação de E-mail',revert:'Reversão de Conta',code:'Código Capturado'};
        document.getElementById('notif-type').innerHTML=`<i class="${icons[type]||'fas fa-envelope'}"></i> ${labels[type]||'Mensagem'}`;
        document.getElementById('notif-content').textContent=content;
        const en=document.getElementById('email-notification');
        en.classList.add('active'); en.style.cursor=link?'pointer':'default';
        en.onclick=link?()=>chrome.tabs.create({url:link}):null;
    }

    // ══════════════════════════
    //  TAB: ROBUX
    // ══════════════════════════
    chrome.storage.local.get(['robuxData'],(data)=>{
        if(data.robuxData){
            document.getElementById('robux-cookie').value =data.robuxData.cookie||'';
            document.getElementById('robux-value').value  =data.robuxData.value||'';
            const rawGameId = String(data.robuxData.gameId||'').trim();
            const rawPassId = String(data.robuxData.passId||'').trim();
            document.getElementById('robux-game-id').value = /^\d+$/.test(rawGameId) ? rawGameId : '';
            document.getElementById('robux-pass-id').value = /^\d+$/.test(rawPassId) ? rawPassId : '';
        }
    });
    document.getElementById('btn-update-robux').addEventListener('click',async()=>{
        const rawGameId = document.getElementById('robux-game-id').value.trim();
        const rawPassId = document.getElementById('robux-pass-id').value.trim();
        const rb={cookie:document.getElementById('robux-cookie').value.trim(),value:document.getElementById('robux-value').value.trim(),gameId:rawGameId.replace(/\D/g,''),passId:rawPassId.replace(/\D/g,'')};
        if(!rb.cookie||!rb.value||!rb.gameId||!rb.passId){showAlert('Preencha todos os campos!','error','robux-alert');return;}
        await chrome.storage.local.set({robuxData:rb});
        showAlert('Iniciando automação...','info','robux-alert');
        chrome.runtime.sendMessage({action:'updateGamePass',data:rb},(res)=>{
            if(res?.success)showAlert('Automação concluída!','success','robux-alert');
            else showAlert('Erro: '+(res?.error||'Falha'),'error','robux-alert');
        });
    });

    // ── Init ──
    await loadAccounts();

    (async () => {
        const syncData = await chrome.storage.local.get(['currentPassword','lastLoggedUserId']);
        if (syncData.currentPassword && syncData.lastLoggedUserId) {
            const acc = findAccount(syncData.lastLoggedUserId);
            if (acc && acc.password !== syncData.currentPassword) {
                await upsertAccount({ userId: syncData.lastLoggedUserId, password: syncData.currentPassword });
                renderAccounts();
            }
        }
    })();

    savedAccounts.forEach(acc => {
        if (acc.tempToken && (!acc.tempLastNotif || acc.tempLastNotif.type !== 'verify')) {
            const uid = String(acc.userId);
            if (!accountInboxIntervals[uid]) {
                setTimeout(() => startAccountInboxMonitoring(uid, acc.tempToken), 500);
            }
        }
    });
});
