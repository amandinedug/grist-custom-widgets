// ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
// ■ NOM DU WIDGET   : FAQ DSFR
// ■ VERSION         : 1.1.0
// ■ DESCRIPTION     : Widget de foire aux questions conforme DSFR pour Grist.
// ■                   Affiche les questions/réponses organisées par catégorie
// ■                   avec un système d'accordéon et support du Markdown.
// ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

'use strict';

// ============= SECTION : SECURITE =============

const SecurityModule = {
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },
  validateNumber(value) { const n = Number(value); return isFinite(n) ? n : null; },
  // Neutralise les balises HTML brutes avant conversion Markdown
  sanitizeMarkdown(str) { return str ? String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }
};

// ============= SECTION : INITIALISATION =============

const UIFeedback = {
  showError(message) { const b = document.getElementById('error-banner'); b.textContent = message; b.style.display = 'block'; },
  hideError() { const b = document.getElementById('error-banner'); b.style.display = 'none'; b.textContent = ''; },
  showLoader() { document.getElementById('loader').style.display = 'block'; },
  hideLoader() { document.getElementById('loader').style.display = 'none'; }
};

// ============= SECTION : FONCTIONS UTILITAIRES =============

function generateId(text, index) {
  const safe = String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safe}-${index}`;
}

function convertInline(text) {
  if (!text) return '';
  let r = text;
  r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  r = r.replace(/__(.+?)__/g, '<strong>$1</strong>');
  r = r.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  r = r.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
  r = r.replace(/\n/g, '<br>');
  return r;
}

function markdownToHtml(markdown) {
  if (!markdown) return '';
  return SecurityModule.sanitizeMarkdown(markdown).split('\n\n').map(para => {
    if (!para.trim()) return '';
    const p = para.trim();
    if (/^\d+\.\s/.test(p)) return '<ol>' + p.split('\n').filter(l => /^\d+\.\s/.test(l)).map(l => '<li>' + convertInline(l.replace(/^\d+\.\s/, '')) + '</li>').join('') + '</ol>';
    if (/^[-*+]\s/.test(p)) return '<ul>' + p.split('\n').filter(l => /^[-*+]\s/.test(l)).map(l => '<li>' + convertInline(l.replace(/^[-*+]\s/, '')) + '</li>').join('') + '</ul>';
    return '<p>' + convertInline(p) + '</p>';
  }).join('\n');
}

// ============= SECTION : GESTION DES DONNEES =============

function applyConfiguration(record, mappings) {
  const mapped = grist.mapColumnNames(record, mappings);
  if (mapped.Intitule_Ministere) {
    const text = SecurityModule.escapeHTML(mapped.Intitule_Ministere).replace(/\\n/g, '<br>');
    const el = document.getElementById('ministry-name');
    const elF = document.getElementById('ministry-name-footer');
    if (el) el.innerHTML = text;
    if (elF) elF.innerHTML = text;
  }
  if (mapped.Description_Footer) {
    const el = document.getElementById('footer-description');
    if (el) el.innerHTML = SecurityModule.escapeHTML(mapped.Description_Footer).replace(/\\n/g, '<br>');
  }
}

function renderFAQ(records, mappings) {
  const content = document.getElementById('faq-content');
  const footer = document.getElementById('footer');
  try {
    if (records.length > 0) applyConfiguration(records[0], mappings);
    const activeRecords = records.filter(r => { const m = grist.mapColumnNames(r, mappings); return m && (m.Actif === true || m.Actif === undefined); });
    if (activeRecords.length === 0) throw new Error('Aucune question active trouvée.');
    const categories = {};
    activeRecords.forEach(record => {
      const mapped = grist.mapColumnNames(record, mappings);
      if (!mapped || !mapped.Question) return;
      const cat = mapped.Categorie || 'Autre';
      if (!categories[cat]) categories[cat] = { name: cat, order: mapped.Ordre_Categorie || 999, questions: [] };
      categories[cat].questions.push({ question: mapped.Question || '', reponse: mapped.Reponse || '', order: mapped.Ordre_Question || 999 });
    });
    let html = '';
    Object.values(categories).sort((a, b) => a.order - b.order).forEach((category, catIndex) => {
      category.questions.sort((a, b) => a.order - b.order);
      const categoryId = generateId(category.name, catIndex);
      html += `<div class="faq-category" data-category="${SecurityModule.escapeHTML(categoryId)}">
        <div class="category-title"><h2 class="fr-h4 fr-mb-0">${SecurityModule.escapeHTML(category.name)}</h2></div>
        <div class="fr-accordions-group">`;
      category.questions.forEach((q, qIndex) => {
        const accordionId = `${categoryId}-${generateId(q.question, qIndex)}`;
        html += `<section class="fr-accordion">
          <h3 class="fr-accordion__title"><button class="fr-accordion__btn" aria-expanded="false" aria-controls="${accordionId}">${SecurityModule.escapeHTML(q.question)}</button></h3>
          <div class="fr-collapse" id="${accordionId}">${markdownToHtml(q.reponse)}</div>
        </section>`;
      });
      html += `</div></div>`;
    });
    content.innerHTML = html;
    content.style.display = 'block';
    footer.style.display = 'block';
    if (window.dsfr) window.dsfr.start();
  } catch (err) {
    UIFeedback.showError(err.message || 'Erreur lors du chargement de la FAQ.');
    console.error('FAQ DSFR - renderFAQ :', err);
  } finally {
    UIFeedback.hideLoader();
  }
}

// ============= SECTION : GESTION DES EVENEMENTS =============

grist.ready({
  requiredAccess: 'read table',
  columns: [
    { name: 'Intitule_Ministere', title: '📝 Intitulé officiel', type: 'Text', optional: true, description: 'Texte affiché dans le header' },
    { name: 'Description_Footer', title: '📝 Description footer', type: 'Text', optional: true, description: 'Texte affiché dans le pied de page' },
    { name: 'Categorie', title: '📋 Catégorie', type: 'Choice', optional: true },
    { name: 'Ordre_Categorie', title: '🔢 Ordre catégorie', type: 'Int', optional: true },
    { name: 'Question', title: '❓ Question', type: 'Text', optional: false },
    { name: 'Reponse', title: '✅ Réponse', type: 'Text', optional: false },
    { name: 'Ordre_Question', title: '🔢 Ordre question', type: 'Int', optional: true },
    { name: 'Actif', title: '✓ Actif', type: 'Bool', optional: true }
  ]
});

grist.onRecords((records, mappings) => {
  UIFeedback.showLoader();
  UIFeedback.hideError();
  renderFAQ(records, mappings);
});

console.log('Module de sécurité chargé - FAQ DSFR v1.1.0');