/**
 * Cloudflare Worker — Proxy CORS pour l'API Notion
 * Déployez ce fichier sur workers.cloudflare.com (gratuit, 100k req/jour)
 *
 * Instructions :
 *  1. Allez sur https://workers.cloudflare.com/ et créez un compte (gratuit)
 *  2. Créez un nouveau Worker nommé "notion-proxy"
 *  3. Collez ce code dans l'éditeur
 *  4. Cliquez "Deploy"
 *  5. Copiez l'URL du Worker (ex: https://notion-proxy.VOTRE-SOUS-DOMAINE.workers.dev)
 *  6. Collez cette URL dans le générateur TIM (Configuration Notion)
 *
 * Sécurité : ce worker ne stocke aucun secret. Le token Notion
 * transite dans les headers Authorization depuis le navigateur.
 * Il est recommandé d'ajouter une vérification d'origine :
 *   if (request.headers.get('Origin') !== 'https://zidanetim.github.io') return forbidden
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ─── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Notion-Version',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // ─── Forward vers Notion API ─────────────────────────────────────────────
    // L'URL attendue : https://notion-proxy.xxx.workers.dev/v1/pages
    // On relaie vers  : https://api.notion.com/v1/pages
    const notionUrl = 'https://api.notion.com' + url.pathname + url.search;

    const headers = {
      'Authorization':   request.headers.get('Authorization') || '',
      'Content-Type':    'application/json',
      'Notion-Version':  request.headers.get('Notion-Version') || '2022-06-28',
    };

    const body = (request.method !== 'GET' && request.method !== 'HEAD')
      ? await request.text()
      : undefined;

    const notionResponse = await fetch(notionUrl, {
      method:  request.method,
      headers: headers,
      body:    body,
    });

    const responseText = await notionResponse.text();

    return new Response(responseText, {
      status:  notionResponse.status,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
