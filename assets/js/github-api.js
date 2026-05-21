/**
 * GitHub API — Auto-commit & Push
 * Permet d'enregistrer un fichier directement dans le dépôt GitHub
 * depuis le navigateur. Nécessite un Personal Access Token (PAT)
 * avec permission "repo", stocké dans localStorage.
 *
 * Dépôt : zidaneTim/tim
 */
const GitHubAPI = (() => {
  const REPO  = 'zidaneTim/tim';
  const BASE  = 'https://api.github.com';
  const BRANCH = 'main';
  const KEY_TOKEN = 'tim_github_token';

  // ─── Token management ───────────────────────────────────────────────────────
  function getToken()    { return localStorage.getItem(KEY_TOKEN); }
  function setToken(t)   { localStorage.setItem(KEY_TOKEN, t.trim()); }
  function clearToken()  { localStorage.removeItem(KEY_TOKEN); }
  function hasToken()    { return !!localStorage.getItem(KEY_TOKEN); }

  // ─── Push a file (create or update) ─────────────────────────────────────────
  async function pushFile(path, content, commitMessage) {
    const token = getToken();
    if (!token) throw new Error('Token GitHub manquant. Configurez-le d\'abord.');

    // UTF-8 → base64
    const base64 = btoa(unescape(encodeURIComponent(content)));

    // Vérifie si le fichier existe (pour récupérer son SHA)
    let sha = null;
    try {
      const check = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (check.ok) {
        const existing = await check.json();
        sha = existing.sha;
      }
    } catch (e) { /* fichier inexistant, c'est ok */ }

    // Crée ou met à jour le fichier
    const body = {
      message: commitMessage || `Activité générée — ${path}`,
      content: base64,
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erreur GitHub ${res.status}`);
    }

    const data = await res.json();
    return {
      url: data.content?.html_url || `https://zidanetim.github.io/tim/${path}`,
      sha: data.content?.sha
    };
  }

  // ─── Modal de configuration du token ────────────────────────────────────────
  function showTokenModal(onSuccess) {
    const existing = document.getElementById('gh-token-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'gh-token-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <h2 style="font-family:'Syne',sans-serif;margin:0 0 8px;font-size:1.2rem">🐙 Token GitHub</h2>
        <p style="font-size:0.85rem;color:#6b7280;margin:0 0 20px;line-height:1.5">
          Pour enregistrer automatiquement vos activités sur GitHub, entrez un <strong>Personal Access Token</strong> avec permission <code>repo</code>.<br>
          <a href="https://github.com/settings/tokens/new?description=TIM+Activites&scopes=repo" target="_blank" style="color:#2D6A4F">Créer un token →</a>
        </p>
        <input id="gh-token-input" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          style="width:100%;box-sizing:border-box;padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:0.9rem;margin-bottom:16px;outline:none">
        <div style="display:flex;gap:12px;justify-content:flex-end">
          <button id="gh-token-cancel" style="padding:10px 20px;border:2px solid #e5e7eb;background:transparent;border-radius:8px;cursor:pointer;font-size:0.85rem">Annuler</button>
          <button id="gh-token-save" style="padding:10px 20px;background:#2D6A4F;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600">Enregistrer</button>
        </div>
        <p id="gh-token-error" style="color:#dc2626;font-size:0.8rem;margin:8px 0 0;display:none"></p>
      </div>`;

    document.body.appendChild(modal);

    document.getElementById('gh-token-cancel').onclick = () => modal.remove();
    document.getElementById('gh-token-save').onclick = async () => {
      const val = document.getElementById('gh-token-input').value.trim();
      if (!val) return;
      // Validation rapide
      try {
        const test = await fetch(`${BASE}/repos/${REPO}`, {
          headers: { 'Authorization': `token ${val}`, 'Accept': 'application/vnd.github+json' }
        });
        if (!test.ok) throw new Error('Token invalide ou permissions insuffisantes');
        setToken(val);
        modal.remove();
        if (onSuccess) onSuccess();
      } catch(e) {
        const errEl = document.getElementById('gh-token-error');
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    };
  }

  // ─── Push avec vérification du token ────────────────────────────────────────
  async function pushWithCheck(path, content, message, onSuccess) {
    if (!hasToken()) {
      showTokenModal(async () => {
        try {
          const result = await pushFile(path, content, message);
          if (onSuccess) onSuccess(result);
        } catch(e) { alert('Erreur GitHub : ' + e.message); }
      });
    } else {
      try {
        const result = await pushFile(path, content, message);
        if (onSuccess) onSuccess(result);
      } catch(e) {
        if (e.message.includes('401') || e.message.includes('403')) {
          clearToken();
          showTokenModal(async () => {
            const result = await pushFile(path, content, message);
            if (onSuccess) onSuccess(result);
          });
        } else {
          throw e;
        }
      }
    }
  }

  // ─── Utilitaire : slugify ────────────────────────────────────────────────────
  function slugify(str) {
    return str.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
  }

  // ─── Construit le chemin de destination ─────────────────────────────────────
  function buildPath(classe, capacite, theme) {
    const date = new Date().toISOString().slice(0,7); // YYYY-MM
    const slug = slugify(theme);
    return `${classe}/activites/${capacite}-${slug}-${date}.html`;
  }

  return { getToken, setToken, clearToken, hasToken, pushFile, pushWithCheck, showTokenModal, buildPath, slugify };
})();
