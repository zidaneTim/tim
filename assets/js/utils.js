/* ============================================================
   utils.js — Fonctions communes
   Cours TIM / Lycée Xavier Grall · Loudéac
   ============================================================ */

const TIM = {

  /* ── Affiche un état de chargement dans un élément ── */
  setLoading(el, label = 'En cours…') {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:20px;color:var(--gris);">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <span style="font-size:14px;">${label}</span>
      </div>`;
  },

  /* ── Affiche une erreur ── */
  setError(el, msg) {
    el.innerHTML = `
      <div style="padding:20px;background:#FEF2F2;border-radius:12px;border:1px solid #FCA5A5;">
        <p style="color:#DC2626;font-size:14px;font-weight:500;">⚠ ${msg}</p>
      </div>`;
  },

  /* ── Formate un texte markdown basique en HTML ── */
  md(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*)/gm, '<h3 style="font-family:Syne,sans-serif;font-weight:700;margin:16px 0 6px;">$1</h3>')
      .replace(/^## (.*)/gm, '<h2 style="font-family:Syne,sans-serif;font-weight:800;margin:20px 0 8px;">$1</h2>')
      .replace(/^- (.*)/gm, '<li style="margin-left:20px;margin-bottom:4px;">$1</li>')
      .replace(/\n\n/g, '</p><p style="margin-top:12px;">')
      .replace(/^(?!<[hli])(.+)/gm, '<p>$1</p>');
  },

  /* ── Copie du texte dans le presse-papier ── */
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },

  /* ── Télécharge un texte en fichier .txt ── */
  download(content, filename = 'export.txt') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = filename;
    a.click();
  },

  /* ── Compte les mots d'un texte ── */
  wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  },

  /* ── Date formatée en français ── */
  dateStr(date = new Date()) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
};
