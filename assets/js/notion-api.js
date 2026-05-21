/**
 * Notion API — Intégration pour "📖 Ressources pédagogiques"
 * Data Source ID : 60825863-d24e-4803-bc2d-74c56a1f97b5
 *
 * Deux modes de push :
 *  1. Via Cloudflare Worker (proxy CORS) — si tim_notion_proxy_url configuré
 *  2. Via Claude Code MCP — génère un fichier JSON à traiter manuellement
 *
 * Token Notion stocké dans localStorage sous "tim_notion_token"
 * URL Proxy stockée dans localStorage sous "tim_notion_proxy_url"
 */
const NotionAPI = (() => {
  const DB_SOURCE_ID = '60825863-d24e-4803-bc2d-74c56a1f97b5';
  const NOTION_VERSION = '2022-06-28';
  const KEY_TOKEN  = 'tim_notion_token';
  const KEY_PROXY  = 'tim_notion_proxy_url';

  // ─── Config management ───────────────────────────────────────────────────────
  function getToken()    { return localStorage.getItem(KEY_TOKEN); }
  function setToken(t)   { localStorage.setItem(KEY_TOKEN, t.trim()); }
  function getProxy()    { return localStorage.getItem(KEY_PROXY); }
  function setProxy(u)   { localStorage.setItem(KEY_PROXY, u.trim().replace(/\/$/, '')); }
  function hasToken()    { return !!localStorage.getItem(KEY_TOKEN); }
  function hasProxy()    { return !!localStorage.getItem(KEY_PROXY); }

  // ─── Mapping classe → Niveau Notion ─────────────────────────────────────────
  const NIVEAU_MAP = {
    'terminale': 'Tle',
    'premiere':  '1ère',
    'seconde':   '2nde',
    'capa2':     'CAP',
    'capa1':     'CAP',
    '3a':        '3e',
    '3b':        '3e',
    '4eme':      '4e'
  };

  // ─── Mapping capacité → Thématique Notion ───────────────────────────────────
  const THEMATIQUE_MAP = {
    'c1-2': 'Données & RGPD',
    'c1-1': 'Information & médias',
    'c1-3': 'Données & RGPD',
    'c8-1': 'Environnement numérique',
    'c8-2': 'Communication & collaboration',
    'eg1-data': 'Données & RGPD',
    'eg1-crcn': 'Citoyenneté numérique',
    'eg4-numerique': 'Citoyenneté numérique',
    'comm-numerique': 'Communication & collaboration',
    'numerique-decouverte': 'Environnement numérique',
    'crcn-3e': 'Citoyenneté numérique'
  };

  // ─── Crée une page dans "Ressources pédagogiques" ───────────────────────────
  async function createPage({ titre, classe, capacite, theme, contenuMarkdown, dureeMin, motsCles }) {
    if (!hasToken()) throw new Error('Token Notion manquant');
    if (!hasProxy()) throw new Error('Proxy Notion non configuré');

    const proxy = getProxy();
    const token = getToken();

    const niveau = NIVEAU_MAP[classe] || 'Tous';
    const thematique = THEMATIQUE_MAP[capacite] || 'Environnement numérique';

    const payload = {
      parent: { type: 'data_source_id', data_source_id: DB_SOURCE_ID },
      properties: {
        'Titre':              { title: [{ text: { content: titre } }] },
        'Niveaux conseillés': { multi_select: [{ name: niveau }] },
        'Type':               { select: { name: 'Activité' } },
        'Thématique':         { select: { name: thematique } },
        'Statut':             { select: { name: 'Brouillon' } },
        'Mots-clés':          { rich_text: [{ text: { content: motsCles || `${classe} ${capacite} ${theme}` } }] },
        'Année de création':  { rich_text: [{ text: { content: new Date().getFullYear().toString() } }] }
      },
      children: markdownToNotionBlocks(contenuMarkdown)
    };

    if (dureeMin) {
      payload.properties['Durée (min)'] = { number: parseInt(dureeMin) || null };
    }

    const res = await fetch(`${proxy}/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erreur Notion ${res.status}`);
    }

    const data = await res.json();
    return { url: data.url, id: data.id };
  }

  // ─── Convertit le markdown généré en blocs Notion simplifiés ───────────────
  function markdownToNotionBlocks(text) {
    if (!text) return [];
    const blocks = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (!line.trim()) {
        blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } });
        continue;
      }

      if (line.startsWith('# ')) {
        blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ text: { content: line.replace('# ', '') } }] } });
      } else if (line.startsWith('## ')) {
        blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ text: { content: line.replace('## ', '') } }] } });
      } else if (line.startsWith('### ')) {
        blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ text: { content: line.replace('### ', '') } }] } });
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ text: { content: line.replace(/^[-•] /, '') } }] } });
      } else if (/^\d+\./.test(line)) {
        blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ text: { content: line.replace(/^\d+\. /, '') } }] } });
      } else if (line.startsWith('> ')) {
        blocks.push({ object: 'block', type: 'quote', quote: { rich_text: [{ text: { content: line.replace('> ', '') } }] } });
      } else {
        // Parse bold text
        const richText = parseInlineMarkdown(line);
        blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: richText } });
      }

      // Notion limit: 100 blocks max per request
      if (blocks.length >= 95) break;
    }

    return blocks;
  }

  function parseInlineMarkdown(text) {
    const parts = [];
    const regex = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`/g;
    let last = 0;
    let m;

    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) {
        parts.push({ type: 'text', text: { content: text.slice(last, m.index) } });
      }
      const content = m[1] || m[2] || m[3] || m[4] || m[5];
      const annotations = {};
      if (m[1] || m[2]) annotations.bold = true;
      if (m[3] || m[4]) annotations.italic = true;
      if (m[5]) annotations.code = true;
      parts.push({ type: 'text', text: { content }, annotations });
      last = regex.lastIndex;
    }

    if (last < text.length) {
      parts.push({ type: 'text', text: { content: text.slice(last) } });
    }

    return parts.length ? parts : [{ type: 'text', text: { content: text } }];
  }

  // ─── Modal de configuration Notion ──────────────────────────────────────────
  function showConfigModal(onSuccess) {
    const existing = document.getElementById('notion-config-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'notion-config-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;max-width:560px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <h2 style="font-family:'Syne',sans-serif;margin:0 0 4px;font-size:1.2rem">📝 Configuration Notion</h2>
        <p style="font-size:0.82rem;color:#6b7280;margin:0 0 24px;line-height:1.5">
          Pour envoyer automatiquement les activités dans <strong>📖 Ressources pédagogiques</strong>, configurez votre intégration Notion.<br>
          <a href="https://www.notion.so/my-integrations" target="_blank" style="color:#2D6A4F">Créer une intégration Notion →</a> (permission "Insérer le contenu")
        </p>

        <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px">Token Notion (secret_...)</label>
        <input id="notion-token-input" type="password" placeholder="secret_xxxxxxxxxxxx" value="${getToken()||''}"
          style="width:100%;box-sizing:border-box;padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:0.9rem;margin-bottom:16px;outline:none">

        <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px">URL du proxy Cloudflare Worker</label>
        <input id="notion-proxy-input" type="url" placeholder="https://notion-proxy.VOTRE-DOMAINE.workers.dev" value="${getProxy()||''}"
          style="width:100%;box-sizing:border-box;padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:0.9rem;margin-bottom:8px;outline:none">

        <details style="margin-bottom:20px">
          <summary style="font-size:0.82rem;color:#6b7280;cursor:pointer;margin-bottom:8px">📦 Pas encore de proxy Cloudflare ? Cliquez ici</summary>
          <div style="background:#f9fafb;border-radius:8px;padding:16px;font-size:0.8rem;line-height:1.8;color:#374151">
            <strong>Déploiement en 3 minutes :</strong><br>
            1. Allez sur <a href="https://workers.cloudflare.com/" target="_blank" style="color:#2D6A4F">workers.cloudflare.com</a> (compte gratuit)<br>
            2. Créez un nouveau Worker et collez le code du fichier <code>formateurs/notion-worker.js</code><br>
            3. Déployez et copiez l'URL ici<br>
            4. Dans Notion : Paramètres → Intégrations → autorisez l'intégration sur la base "Ressources pédagogiques"
          </div>
        </details>

        <div style="display:flex;gap:12px;justify-content:flex-end">
          <button id="notion-cancel" style="padding:10px 20px;border:2px solid #e5e7eb;background:transparent;border-radius:8px;cursor:pointer;font-size:0.85rem">Annuler</button>
          <button id="notion-save" style="padding:10px 20px;background:#2D6A4F;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600">Enregistrer</button>
        </div>
        <p id="notion-error" style="color:#dc2626;font-size:0.8rem;margin:8px 0 0;display:none"></p>
      </div>`;

    document.body.appendChild(modal);
    document.getElementById('notion-cancel').onclick = () => modal.remove();
    document.getElementById('notion-save').onclick = () => {
      const t = document.getElementById('notion-token-input').value.trim();
      const p = document.getElementById('notion-proxy-input').value.trim();
      if (!t) {
        const e = document.getElementById('notion-error');
        e.textContent = 'Le token Notion est requis.';
        e.style.display = 'block';
        return;
      }
      if (t) setToken(t);
      if (p) setProxy(p);
      modal.remove();
      if (onSuccess) onSuccess();
    };
  }

  // ─── Push avec vérification de config ───────────────────────────────────────
  async function pushWithCheck(params, onSuccess) {
    if (!hasToken() || !hasProxy()) {
      showConfigModal(async () => {
        try {
          const result = await createPage(params);
          if (onSuccess) onSuccess(result);
        } catch (e) { alert('Erreur Notion : ' + e.message); }
      });
    } else {
      try {
        const result = await createPage(params);
        if (onSuccess) onSuccess(result);
      } catch (e) {
        alert('Erreur Notion : ' + e.message);
      }
    }
  }

  return { createPage, pushWithCheck, showConfigModal, getToken, setToken, getProxy, setProxy, hasToken, hasProxy, NIVEAU_MAP, THEMATIQUE_MAP };
})();
