  // ========================================
  // Fonction de conversion Markdown → HTML
  // ========================================
  function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    html = html.split('\n\n').map(para => {
      if (!para.trim()) return '';
      
      let p = para.trim();
      
      if (/^\d+\.\s/.test(p)) {
        const items = p.split('\n').filter(line => /^\d+\.\s/.test(line));
        const listItems = items.map(item => {
          const text = item.replace(/^\d+\.\s/, '');
          return '<li>' + convertInline(text) + '</li>';
        }).join('');
        return '<ol>' + listItems + '</ol>';
      }
      
      if (/^[-*+]\s/.test(p)) {
        const items = p.split('\n').filter(line => /^[-*+]\s/.test(line));
        const listItems = items.map(item => {
          const text = item.replace(/^[-*+]\s/, '');
          return '<li>' + convertInline(text) + '</li>';
        }).join('');
        return '<ul>' + listItems + '</ul>';
      }
      
      return '<p>' + convertInline(p) + '</p>';
    }).join('\n');
    
    return html;
  }
  
  function convertInline(text) {
    if (!text) return '';
    
    let result = text;
    
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    result = result.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
    result = result.replace(/\n/g, '<br>');
    
    return result;
  }
  
  // ========================================
  // Configuration du widget Grist
  // ========================================
  grist.ready({
    requiredAccess: 'read table',
    columns: [
      // CONFIGURATION (optionnel)
      { name: 'Intitule_Ministere', title: '📝 Intitulé officiel', type: 'Text', optional: true, description: 'Texte affiché dans le header' },
      { name: 'Description_Footer', title: '📝 Description footer', type: 'Text', optional: true, description: 'Texte affiché dans le pied de page' },
      
      // DONNÉES FAQ (obligatoire)
      { name: 'Categorie', title: '📋 Catégorie', type: 'Choice', optional: true },
      { name: 'Ordre_Categorie', title: '🔢 Ordre catégorie', type: 'Int', optional: true },
      { name: 'Question', title: '❓ Question', type: 'Text', optional: false },
      { name: 'Reponse', title: '✅ Réponse', type: 'Text', optional: false},
      { name: 'Ordre_Question', title: '🔢 Ordre question', type: 'Int', optional: true },
      { name: 'Actif', title: '✓ Actif', type: 'Bool', optional: true}
    ]
  });
  
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  
  function generateId(text, index) {
    const safe = text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${safe}-${index}`;
  }
  
  function applyConfiguration(record, mappings) {
  const mapped = grist.mapColumnNames(record, mappings);
  
  // Appliquer l'intitulé du ministère
  if (mapped.Intitule_Ministere) {
    const ministryText = mapped.Intitule_Ministere.replace(/\\n/g, '<br>');
    const ministryName = document.getElementById('ministry-name');
    const ministryNameFooter = document.getElementById('ministry-name-footer');
    
    if (ministryName) {
      ministryName.innerHTML = ministryText;
    }
    if (ministryNameFooter) {
      ministryNameFooter.innerHTML = ministryText;
    }
  } else {
    console.log('❌ Pas d\'intitulé ministère dans mapped');
  }

  // Appliquer la description du footer
    if (mapped.Description_Footer) {
      
      // ✅ Convertir les sauts de ligne en <br>
      const footerText = mapped.Description_Footer.replace(/\\n/g, '<br>');
      
      const footerDesc = document.getElementById('footer-description');
      if (footerDesc) {
        footerDesc.innerHTML = footerText;  // ⚠️ innerHTML au lieu de textContent
      }
    } else {
      console.log('❌ Pas de description footer dans mapped');
    }
}
  
  function renderFAQ(records, mappings) {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const content = document.getElementById('faq-content');
    const footer = document.getElementById('footer');
    
    try {
      // Appliquer la configuration depuis le premier enregistrement
      if (records.length > 0) {
        applyConfiguration(records[0], mappings);
      }
      
      // Filter active questions only
      const activeRecords = records.filter(record => {
        const mapped = grist.mapColumnNames(record, mappings);
        return mapped && (mapped.Actif === true || mapped.Actif === undefined);
      });
      
      if (activeRecords.length === 0) {
        throw new Error('Aucune question active trouvée');
      }
      
      // Group by category and sort
      const categories = {};
      
      activeRecords.forEach(record => {
        const mapped = grist.mapColumnNames(record, mappings);
        if (!mapped || !mapped.Question) return;
        
        const categorie = mapped.Categorie || 'Autre';
        
        if (!categories[categorie]) {
        categories[categorie] = {
            name: categorie,  // ✅ Contient déjà l'emoji
            order: mapped.Ordre_Categorie || 999,
            questions: []
        };
        }
        
        categories[categorie].questions.push({
          question: mapped.Question || '',
          reponse: mapped.Reponse || '',
          order: mapped.Ordre_Question || 999
        });
      });
      
      // Sort categories by order
      const sortedCategories = Object.values(categories).sort((a, b) => a.order - b.order);
      
      // Generate HTML
      let html = '';
      
      sortedCategories.forEach((category, catIndex) => {
        category.questions.sort((a, b) => a.order - b.order);
        
        const categoryId = generateId(category.name, catIndex);
        
        html += `
        <div class="faq-category" data-category="${escapeHtml(categoryId)}">
            <div class="category-title">
            <h2 class="fr-h4 fr-mb-0">${escapeHtml(category.name)}</h2>
            </div>
            
            <div class="fr-accordions-group">
        `;
        
        category.questions.forEach((q, qIndex) => {
          const questionId = generateId(q.question, qIndex);
          const accordionId = `${categoryId}-${questionId}`;
          const reponseHtml = markdownToHtml(q.reponse);
          
          html += `
            <section class="fr-accordion">
              <h3 class="fr-accordion__title">
                <button class="fr-accordion__btn" aria-expanded="false" aria-controls="${accordionId}">
                  ${escapeHtml(q.question)}
                </button>
              </h3>
              <div class="fr-collapse" id="${accordionId}">
                ${reponseHtml}
              </div>
            </section>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
      });
      
      content.innerHTML = html;
      
      loading.style.display = 'none';
      error.style.display = 'none';
      content.style.display = 'block';
      footer.style.display = 'block';
      
      if (window.dsfr) {
        window.dsfr.start();
      }
      
    } catch (err) {
      console.error('Error rendering FAQ:', err);
      loading.style.display = 'none';
      error.style.display = 'block';
      const errorMessage = error.querySelector('p');
      if (errorMessage) {
        errorMessage.textContent = err.message || 'Erreur inconnue';
      }
    }
  }
  
  grist.onRecords((records, mappings) => {
    renderFAQ(records, mappings);
  });