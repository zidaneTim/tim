/* ============================================================
   claude-api.js — Wrapper Anthropic API
   Cours TIM / Lycée Xavier Grall · Loudéac
   La clé est stockée dans localStorage (jamais dans le code).
   ============================================================ */

const ClaudeAPI = (() => {
  const KEY_STORAGE = 'tim_anthropic_key';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

  return {
    /* ── Gestion de la clé ── */
    getKey() { return localStorage.getItem(KEY_STORAGE) || ''; },
    setKey(k) { localStorage.setItem(KEY_STORAGE, k.trim()); },
    clearKey() { localStorage.removeItem(KEY_STORAGE); },
    hasKey() { return !!localStorage.getItem(KEY_STORAGE); },

    /* ── Appel principal ── */
    async ask({ system, user, model = DEFAULT_MODEL, maxTokens = 1500 }) {
      const key = this.getKey();
      if (!key) throw new Error('NO_KEY');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }]
        })
      });

      if (response.status === 401) throw new Error('INVALID_KEY');
      if (response.status === 429) throw new Error('RATE_LIMIT');
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.content[0].text;
    },

    /* ── Affiche la modale de saisie de clé ── */
    showKeyModal(onSuccess) {
      const existing = document.getElementById('tim-key-modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'tim-key-modal';
      overlay.className = 'key-modal-overlay';
      overlay.innerHTML = `
        <div class="key-modal">
          <h2>🔑 Clé API requise</h2>
          <p>
            Cet outil utilise l'IA Anthropic (Claude). Pour l'activer,
            entre ta clé API ci-dessous. Elle sera sauvegardée uniquement
            dans ce navigateur.
          </p>
          <div class="form-group">
            <label class="form-label">Clé Anthropic (sk-ant-...)</label>
            <input type="password" id="tim-api-key-input" class="form-input"
              placeholder="sk-ant-api03-..." autocomplete="off" />
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="tim-save-key" class="btn btn-primary">Enregistrer</button>
            <button id="tim-cancel-key" class="btn btn-secondary">Annuler</button>
          </div>
          <p style="margin-top:16px;font-size:12px;color:var(--gris);">
            La clé n'est jamais envoyée à un serveur tiers ni stockée dans le code.
          </p>
        </div>`;

      document.body.appendChild(overlay);

      const input = document.getElementById('tim-api-key-input');
      input.focus();

      document.getElementById('tim-save-key').addEventListener('click', () => {
        const val = input.value.trim();
        if (!val.startsWith('sk-ant')) {
          input.style.borderColor = 'var(--terre)';
          input.placeholder = 'Format attendu : sk-ant-api03-...';
          return;
        }
        this.setKey(val);
        overlay.remove();
        if (onSuccess) onSuccess();
      });

      document.getElementById('tim-cancel-key').addEventListener('click', () => {
        overlay.remove();
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('tim-save-key').click();
      });
    },

    /* ── Helper : lance une requête avec gestion auto de la clé ── */
    async askWithKeyCheck(params, onSuccess) {
      if (!this.hasKey()) {
        this.showKeyModal(() => this.askWithKeyCheck(params, onSuccess));
        return;
      }
      try {
        const result = await this.ask(params);
        if (onSuccess) onSuccess(result);
        return result;
      } catch (e) {
        if (e.message === 'INVALID_KEY') {
          this.clearKey();
          this.showKeyModal(() => this.askWithKeyCheck(params, onSuccess));
        } else {
          throw e;
        }
      }
    }
  };
})();
