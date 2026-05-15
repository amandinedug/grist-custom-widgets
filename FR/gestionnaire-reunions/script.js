'use strict';

// ── MARKDOWN ↔ HTML ──────────────────────────────────────────────────────────
function escapeHtmlChars(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyInline(s) {
  return s
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      if (!/^https?:\/\//i.test(url)) return m;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`;
    });
}

function mdToHtml(md) {
  if (!md) return '';
  const lines = String(md).split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(escapeHtmlChars(lines[i]));
        i++;
      }
      i++;
      out.push(`<pre><code>${buf.join('\n')}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${applyInline(escapeHtmlChars(h[2]))}</h${lvl}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(escapeHtmlChars(lines[i].replace(/^>\s?/, '')));
        i++;
      }
      out.push(`<blockquote>${applyInline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const txt = lines[i].replace(/^[-*]\s+/, '');
        items.push(`<li>${applyInline(escapeHtmlChars(txt))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (!line.trim()) { i++; continue; }

    const para = [];
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,3}\s|[-*]\s|>\s?|```)/.test(lines[i])) {
      para.push(escapeHtmlChars(lines[i]));
      i++;
    }
    out.push(`<p>${applyInline(para.join(' '))}</p>`);
  }

  return out.join('');
}

function htmlToMd(html) {
  if (!html || !html.trim()) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return nodeToMd(doc.body)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function nodeToMd(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return '';

  const tag = node.tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(nodeToMd).join('');

  switch (tag) {
    case 'h1': return `# ${inner.trim()}\n\n`;
    case 'h2': return `## ${inner.trim()}\n\n`;
    case 'h3': return `### ${inner.trim()}\n\n`;
    case 'b':
    case 'strong': return inner ? `**${inner}**` : '';
    case 'i':
    case 'em':     return inner ? `*${inner}*` : '';
    case 'a': {
      const href = node.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return inner;
      return `[${inner}](${href})`;
    }
    case 'code':
      if (node.parentElement && node.parentElement.tagName === 'PRE') return inner;
      return inner ? `\`${inner}\`` : '';
    case 'pre':
      return `\`\`\`\n${inner.replace(/^\n+|\n+$/g, '')}\n\`\`\`\n\n`;
    case 'blockquote':
      return `> ${inner.trim().replace(/\n/g, '\n> ')}\n\n`;
    case 'ul':
    case 'ol': {
      const items = Array.from(node.children)
        .filter(c => c.tagName === 'LI')
        .map(li => `- ${nodeToMd(li).trim()}`)
        .join('\n');
      return items + '\n\n';
    }
    case 'li': return inner;
    case 'p':
    case 'div': return inner.trim() ? `${inner}\n\n` : '';
    case 'br':  return '\n';
    default: return inner;
  }
}

// ── STATUTS ──────────────────────────────────────────────────────────────────
const STATUTS = [
  { v: 'Planifiée',   color: '#2383e2', bg: '#e8f1fb' },
  { v: 'Aujourd\'hui', color: '#d9730d', bg: '#fbecdd' },
  { v: 'Terminée',   color: '#0f7b6c', bg: '#e6f4f1' },
  { v: 'Annulée',    color: '#e03e3e', bg: '#fdecea' },
  { v: 'Reportée',   color: '#9b9b9b', bg: '#f1f1ef' },
];

const AV_COLORS = ['#2383e2','#0f7b6c','#d9730d','#9065b0','#e03e3e','#64473a','#1a8a77','#c14a4a'];

// ── STATE ────────────────────────────────────────────────────────────────────
const S = {
  reunions: [], contacts: [], projets: [], conges: [],
  contactMap: new Map(), // FIX: index pour éviter les .find() en O(n²)
  view: 'kanban',
  fProjet: '', fContacts: [], fDateFrom: '', fDateTo: '',
  mode: null, editId: null, selParts: [],
  cal: { view: 'week', ref: new Date(), weekDays: 5, countries: [] },
  holidays: {},
};

// ── GRIST INIT ───────────────────────────────────────────────────────────────
grist.ready({ requiredAccess: 'full' });

// ── SCHEMA VALIDATION ────────────────────────────────────────────────────────
const EXPECTED_SCHEMA = {
  REUNIONS: ['Titre','Date','Heure','Duree_min','Statut','Statut_override',
             'Type_lieu','Lieu','Projet','Ordre_du_jour','Compte_rendu','Participants'],
  CONTACTS: ['Nom','Prenom','Email','Membre_equipe','Couleur'],
  PROJETS:  ['Nom_projet','Statut'],
  CONGES:   ['Contact','Date_debut','Date_fin'],
};
// FIX: CONGES est optionnelle — pas d'alerte si elle est absente
const OPTIONAL_TABLES = ['CONGES'];

function validateSchema(loaded) {
  const issues = [];
  for (const [tableName, expectedCols] of Object.entries(EXPECTED_SCHEMA)) {
    const tbl = loaded[tableName];
    if (tbl === null || tbl === undefined) {
      if (!OPTIONAL_TABLES.includes(tableName)) {
        issues.push(`Table introuvable : ${tableName}`);
      }
      continue;
    }
    const actualCols = Object.keys(tbl);
    expectedCols.forEach(col => {
      if (!actualCols.includes(col)) {
        issues.push(`Colonne manquante : ${tableName}.${col}`);
      }
    });
  }
  if (issues.length) {
    console.group('[Réunions] ⚠ Anomalies de schéma détectées');
    issues.forEach(i => console.warn(i));
    console.groupEnd();
  } else {
    console.log('[Réunions] ✓ Schéma conforme');
  }
}

async function load() {
  try {
    const [r, c, p, cg] = await Promise.all([
      grist.docApi.fetchTable('REUNIONS'),
      grist.docApi.fetchTable('CONTACTS'),
      grist.docApi.fetchTable('PROJETS'),
      grist.docApi.fetchTable('CONGES').catch(() => null),
    ]);
    validateSchema({ REUNIONS: r, CONTACTS: c, PROJETS: p, CONGES: cg });
    S.reunions = toRecs(r);
    S.contacts = toRecs(c);
    S.projets  = toRecs(p);
    S.conges   = cg ? toRecs(cg) : [];
    // FIX: construction de l'index contacts pour les lookups O(1)
    S.contactMap = new Map(S.contacts.map(ct => [ct.id, ct]));
    document.getElementById('loader').classList.add('hidden');
    buildFilters();
    render();
  } catch(e) {
    document.getElementById('loader').textContent = 'Erreur : ' + e.message;
  }
}

grist.onRecords(async () => { await load(); });

// ── HELPERS ──────────────────────────────────────────────────────────────────
const toRecs = d => d.id.map((id, i) => {
  const o = { id };
  for (const k of Object.keys(d)) o[k] = d[k][i];
  return o;
});

const tsToInput = ts => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())}`;
};

const inputToTs = s => s ? Math.floor(new Date(s + 'T00:00:00Z').getTime() / 1000) : null;
const p2 = n => String(n).padStart(2,'0');

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
};

const parseRL = v => Array.isArray(v) ? v.filter(x => x !== 'L' && typeof x === 'number') : [];

const isUrl = s => {
  if (!s || typeof s !== 'string') return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const initials = (nom, prenom) => ((prenom?.[0]||'') + (nom?.[0]||'')).toUpperCase() || '?';
const avColor = (c) => normalizeColor(c?.Couleur) || AV_COLORS[c?.id % AV_COLORS.length] || AV_COLORS[0];

// FIX: escapeHTML échappe maintenant aussi " et ' (injection dans les attributs HTML)
const escapeHTML = s => String(s||'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const esc = escapeHTML;
const trunc = (s, n=32) => s && s.length > n ? s.slice(0, n) + '…' : (s||'');

function validateNumber(val, min, max, def) {
  const n = Number(val);
  if (!isFinite(n) || isNaN(n)) return def;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '';

// ── VIEW ─────────────────────────────────────────────────────────────────────
function setView(v) {
  S.view = v;
  document.getElementById('btn-kanban').classList.toggle('active', v==='kanban');
  document.getElementById('btn-calendar').classList.toggle('active', v==='calendar');
  document.getElementById('v-kanban').classList.toggle('hidden', v!=='kanban');
  document.getElementById('v-calendar').classList.toggle('hidden', v!=='calendar');
  if (v === 'calendar') renderCalendar();
}

// ── FILTERS ──────────────────────────────────────────────────────────────────
function buildFilters() {
  const sel = document.getElementById('flt-projet');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Tous les projets</option>';
  S.projets.filter(p => p.Statut !== 'Archivé').forEach(p => {
    sel.innerHTML += `<option value="${p.id}" title="${esc(p.Nom_projet)}">${esc(trunc(p.Nom_projet))}</option>`;
  });
  sel.value = prev;

  const tags = document.getElementById('team-tags');
  tags.innerHTML = '';
  S.contacts.filter(c => c.Membre_equipe == 1).forEach(c => {
    const color   = normalizeColor(c.Couleur);
    const active  = S.fContacts.includes(c.id);
    const b = document.createElement('button');
    b.className = 'tag' + (active ? ' active' : '');
    b.textContent = (c.Prenom ? c.Prenom[0]+'. ' : '') + c.Nom;
    if (color) {
      if (active) {
        b.style.cssText = `background:${color}22;color:${color};border-color:${color}`;
      } else {
        b.style.cssText = `border-color:${color}66;color:${color}`;
      }
    }
    b.onclick = () => toggleCF(c.id);
    tags.appendChild(b);
  });

  const other = document.getElementById('flt-other');
  const others = S.contacts.filter(c => c.Membre_equipe != 1);
  other.innerHTML = '<option value="">Autre contact…</option>';
  others.forEach(c => {
    other.innerHTML += `<option value="${c.id}">${esc((c.Prenom?c.Prenom+' ':'')+c.Nom)}</option>`;
  });
  other.classList.toggle('hidden', others.length === 0);
}

function toggleCF(id) {
  const i = S.fContacts.indexOf(id);
  i === -1 ? S.fContacts.push(id) : S.fContacts.splice(i,1);
  buildFilters(); render();
}

function applyFilters() {
  S.fProjet   = document.getElementById('flt-projet').value;
  S.fDateFrom = document.getElementById('flt-date-from').value;
  S.fDateTo   = document.getElementById('flt-date-to').value;
  render();
}

function addContactFilterFromDd() {
  const v = Number(document.getElementById('flt-other').value);
  if (v && !S.fContacts.includes(v)) S.fContacts.push(v);
  document.getElementById('flt-other').value = '';
  buildFilters(); render();
}

function clearFilters() {
  S.fProjet = ''; S.fContacts = []; S.fDateFrom = ''; S.fDateTo = '';
  document.getElementById('flt-projet').value = '';
  document.getElementById('flt-date-from').value = '';
  document.getElementById('flt-date-to').value = '';
  buildFilters(); render();
}

function filtered() {
  return S.reunions.filter(r => {
    if (S.fProjet && String(r.Projet) !== S.fProjet) return false;
    if (S.fContacts.length) {
      const pp = parseRL(r.Participants);
      if (!S.fContacts.some(id => pp.includes(id))) return false;
    }
    if (S.fDateFrom && r.Date) {
      if (r.Date < inputToTs(S.fDateFrom)) return false;
    }
    if (S.fDateTo && r.Date) {
      if (r.Date > inputToTs(S.fDateTo) + 86399) return false;
    }
    return true;
  });
}

// ── KANBAN ───────────────────────────────────────────────────────────────────
function render() {
  if (S.view === 'kanban') renderKanban();
  else renderCalendar();
}

function renderKanban() {
  const board = document.getElementById('v-kanban');
  board.innerHTML = '';
  const list = filtered();

  STATUTS.forEach(st => {
    const closed = st.v === 'Terminée' || st.v === 'Annulée';
    const cards = list
      .filter(r => r.Statut === st.v)
      .sort((a, b) => {
        const da = a.Date || 0;
        const db = b.Date || 0;
        return closed ? db - da : da - db;
      });
    const col = document.createElement('div');
    col.className = 'kanban-col';
    col.innerHTML = `
      <div class="col-header">
        <span class="col-pill" style="background:${st.bg};color:${st.color}">
          <span class="status-dot" style="background:${st.color}"></span>
          ${esc(st.v)}
        </span>
        <span class="col-count">${cards.length}</span>
      </div>
      <div class="col-body" id="col-${st.v.replace(/\s/g,'_')}">
        ${cards.length === 0 ? '<div style="font-size:12px;color:var(--text-muted);padding:6px 2px">Aucune réunion</div>' : ''}
      </div>
      <button class="col-add" onclick="openModal('create','${st.v}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New page
      </button>
    `;
    const body = col.querySelector('.col-body');
    cards.forEach(r => body.appendChild(buildCard(r)));
    board.appendChild(col);
  });
}

function buildCard(r) {
  const card = document.createElement('div');
  card.className = 'card';
  card.onclick = () => openModal('edit', null, r);

  const proj = r.Projet ? S.projets.find(p => p.id === r.Projet) : null;
  const parts = parseRL(r.Participants);
  const dateStr = r.Date ? tsToInput(r.Date) : '';
  const closed = r.Statut === 'Terminée' || r.Statut === 'Annulée';
  const lieuIsUrl = isUrl(r.Lieu);
  const missingOdj = !closed && (r.Statut === 'Planifiée' || r.Statut === "Aujourd'hui") && !r.Ordre_du_jour?.trim();
  const missingCr  = r.Statut === 'Terminée' && !r.Compte_rendu?.trim();

  const max = 4;
  const shown = parts.slice(0, max);
  const more  = parts.length - max;
  let avsHtml = '';
  shown.forEach(id => {
    // FIX: S.contactMap.get() au lieu de S.contacts.find()
    const c = S.contactMap.get(id);
    if (c) avsHtml += `<div class="av" style="background:${avColor(c)}" title="${esc((c.Prenom?c.Prenom+' ':'')+c.Nom)}">${initials(c.Nom,c.Prenom)}</div>`;
  });
  if (more > 0) avsHtml += `<div class="av av-more">+${more}</div>`;

  card.innerHTML = `
    <div class="card-title">${esc(r.Titre || '(Sans titre)')}</div>
    ${(dateStr || r.Heure) ? `
    <div class="card-dt">
      ${dateStr ? `<span class="card-date">${fmtDate(dateStr)}</span>` : ''}
      ${r.Heure ? `<span class="card-time">${esc(r.Heure)}</span>` : ''}
    </div>` : ''}
    <div class="card-footer">
      ${proj ? `<span class="card-projet">${esc(proj.Nom_projet)}</span>` : ''}
      ${lieuIsUrl && !closed ? `<a class="btn-visio" href="${esc(r.Lieu)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        Rejoindre
      </a>` : ''}
      ${missingOdj ? `<span class="card-alert">⚠ OdJ manquant</span>` : ''}
      ${missingCr  ? `<span class="card-alert">⚠ CR manquant</span>`  : ''}
      ${avsHtml ? `<div class="avatars">${avsHtml}</div>` : ''}
    </div>
  `;
  return card;
}

// ── MODAL ────────────────────────────────────────────────────────────────────
let _lastFocusedBeforeModal = null;

function openModal(mode, statut, rec) {
  _lastFocusedBeforeModal = document.activeElement;

  S.mode   = mode;
  S.editId = rec ? rec.id : null;
  S.selParts = rec ? parseRL(rec.Participants) : [];

  document.getElementById('modal-root').setAttribute(
    'aria-label',
    mode === 'create' ? 'Création d\'une réunion' : 'Édition d\'une réunion'
  );

  document.getElementById('m-titre').value    = rec?.Titre || '';
  document.getElementById('m-date').value     = rec?.Date ? tsToInput(rec.Date) : '';
  document.getElementById('m-heure').value    = rec?.Heure || '';
  document.getElementById('m-duree').value    = rec?.Duree_min || '';
  const overrideVal = rec?.Statut_override || '';
  const isManualStatut = statut === 'Annulée' || statut === 'Reportée';
  document.getElementById('m-statut-override').value = overrideVal || (mode === 'create' && isManualStatut ? statut : '');

  updateStatutBadge();
  document.getElementById('m-type-lieu').value = rec?.Type_lieu || 'Présentiel';
  document.getElementById('m-lieu').value     = rec?.Lieu || '';
  rtSet('odj', rec?.Ordre_du_jour || '');
  rtSet('cr',  rec?.Compte_rendu  || '');

  resetNewContactInputs();

  const ps = document.getElementById('m-projet');
  ps.innerHTML = '<option value="">— Aucun —</option>';
  S.projets.filter(p => p.Statut !== 'Archivé').forEach(p => {
    ps.innerHTML += `<option value="${p.id}" title="${esc(p.Nom_projet)}">${esc(trunc(p.Nom_projet, 55))}</option>`;
  });
  ps.value = rec?.Projet || '';

  updateLieuPh();
  renderPartTags();

  document.getElementById('btn-del').classList.toggle('hidden', mode !== 'edit');
  document.getElementById('btn-dup').classList.toggle('hidden', mode !== 'edit');
  document.getElementById('btn-email').classList.toggle('hidden', mode !== 'edit');

  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('m-titre').focus();
}

function closeModal() {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('parts-dd').classList.add('hidden');
  // FIX: effacer la bannière d'erreur à la fermeture de la modale
  hideError();
  if (_lastFocusedBeforeModal && typeof _lastFocusedBeforeModal.focus === 'function') {
    _lastFocusedBeforeModal.focus();
  }
  _lastFocusedBeforeModal = null;
}

function updateStatutBadge() {
  const dateStr = document.getElementById('m-date').value;
  const override = document.getElementById('m-statut-override').value;
  const today = todayISO();

  let computed;
  if (override) {
    computed = override;
  } else if (!dateStr) {
    computed = 'Planifiée';
  } else if (dateStr === today) {
    computed = "Aujourd'hui";
  } else if (dateStr > today) {
    computed = 'Planifiée';
  } else {
    computed = 'Terminée';
  }

  const st = STATUTS.find(s => s.v === computed) || STATUTS[0];
  const badge = document.getElementById('m-statut-badge');
  badge.textContent = computed;
  badge.style.cssText = `padding:7px 10px;border-radius:var(--r-sm);font-size:13px;font-weight:500;background:${st.bg};color:${st.color};border:1px solid ${st.bg}`;
}

function overlayClick(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

function updateLieuPh() {
  const t = document.getElementById('m-type-lieu').value;
  document.getElementById('m-lieu').placeholder =
    (t === 'Visio' || t === 'Hybride') ? 'https://meet.example.com/…' : 'Salle de réunion A';
}

// ── PARTICIPANTS ──────────────────────────────────────────────────────────────
function renderPartTags() {
  const box = document.getElementById('parts-box');
  box.querySelectorAll('.ptag').forEach(t => t.remove());
  const srch = document.getElementById('parts-srch');
  S.selParts.forEach(id => {
    // FIX: S.contactMap.get()
    const c = S.contactMap.get(id);
    if (!c) return;
    const tag = document.createElement('span');
    tag.className = 'ptag';
    tag.dataset.id = id;
    tag.innerHTML = `${esc((c.Prenom?c.Prenom+' ':'')+c.Nom)}<button class="ptag-rm" onclick="rmPart(${id})">×</button>`;
    box.insertBefore(tag, srch);
  });
}

function showPartsDd() {
  filterPartsDd();
  document.getElementById('parts-dd').classList.remove('hidden');
}

function filterPartsDd() {
  const q = document.getElementById('parts-srch').value.toLowerCase();
  const dd = document.getElementById('parts-dd');
  const list = document.getElementById('parts-list');

  const items = S.contacts.filter(c => !S.selParts.includes(c.id))
    .filter(c => ((c.Prenom||'')+' '+(c.Nom||'')).toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.Membre_equipe == 1 && b.Membre_equipe != 1) return -1;
      if (a.Membre_equipe != 1 && b.Membre_equipe == 1) return 1;
      return (a.Prenom||a.Nom||'').localeCompare(b.Prenom||b.Nom||'', 'fr');
    });

  list.innerHTML = '';
  if (!items.length && q) {
    list.innerHTML = '<div class="parts-item" style="color:var(--text-muted)">Aucun résultat</div>';
  }
  items.slice(0, 12).forEach(c => {
    const item = document.createElement('div');
    item.className = 'parts-item';
    item.innerHTML = `
      <div class="parts-item-av" style="background:${avColor(c)}">${initials(c.Nom, c.Prenom)}</div>
      <span>${esc((c.Prenom?c.Prenom+' ':'')+c.Nom)}</span>
      ${c.Membre_equipe == 1 ? '<span class="badge-team">équipe</span>' : ''}
    `;
    item.onclick = () => addPart(c.id);
    list.appendChild(item);
  });

  dd.classList.remove('hidden');
}

function resetNewContactInputs() {
  ['nc-prenom', 'nc-nom', 'nc-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.style.borderColor = ''; }
  });
}

function resetNewContact() {
  resetNewContactInputs();
  document.getElementById('parts-dd').classList.add('hidden');
}

async function saveNewContact() {
  const nom    = (document.getElementById('nc-nom').value || '').trim();
  const prenom = (document.getElementById('nc-prenom').value || '').trim();
  const email  = (document.getElementById('nc-email').value || '').trim();
  if (!nom) {
    document.getElementById('nc-nom').style.borderColor = 'var(--danger)';
    return;
  }

  const btn = document.getElementById('btn-nc-save');

  try {
    setButtonBusy(btn, true, 'Création…');
    const result = await grist.docApi.applyUserActions([['AddRecord', 'CONTACTS', null, {
      Nom: nom, Prenom: prenom, Email: email, Membre_equipe: false,
    }]]);
    const cData = await grist.docApi.fetchTable('CONTACTS');
    S.contacts = toRecs(cData);
    // FIX: reconstruire la Map après rechargement des contacts
    S.contactMap = new Map(S.contacts.map(ct => [ct.id, ct]));
    const newId = result.rowIds ? result.rowIds[0] : null;
    if (newId) addPart(newId);
    else {
      const found = S.contacts.find(c => c.Nom === nom && c.Prenom === prenom);
      if (found) addPart(found.id);
    }
    buildFilters();
    resetNewContactInputs();
    document.getElementById('parts-dd').classList.add('hidden');
  } catch(e) {
    showError('Erreur lors de la création du contact.');
  } finally {
    setButtonBusy(btn, false);
  }
}

function addPart(id) {
  if (!S.selParts.includes(id)) S.selParts.push(id);
  renderPartTags();
  document.getElementById('parts-srch').value = '';
  document.getElementById('parts-dd').classList.add('hidden');
}

function rmPart(id) {
  S.selParts = S.selParts.filter(i => i !== id);
  renderPartTags();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.parts-wrap'))
    document.getElementById('parts-dd').classList.add('hidden');
});

function emailParticipants() {
  // FIX: S.contactMap.get()
  const emails = S.selParts
    .map(id => S.contactMap.get(id))
    .filter(c => c && c.Email && c.Email.trim())
    .map(c => c.Email.trim());

  if (!emails.length) {
    showError('Aucun participant avec une adresse email.');
    return;
  }

  const titre  = document.getElementById('m-titre').value.trim() || '(Réunion sans titre)';
  const date   = document.getElementById('m-date').value;
  const heure  = document.getElementById('m-heure').value;
  const dateFr = date ? new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) : '';
  const subject = `${titre}${dateFr ? ' — ' + dateFr : ''}${heure ? ' à ' + heure : ''}`;

  const mailto = `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}`;
  const a = document.createElement('a');
  a.href = mailto;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

function rtCmd(f, cmd) {
  document.getElementById(f+'-body').focus();
  document.execCommand(cmd, false, null);
}

function rtBlock(f, tag) {
  const body = document.getElementById(f+'-body');
  body.focus();
  const cur = document.queryCommandValue('formatBlock').toLowerCase();
  document.execCommand('formatBlock', false, cur === tag ? 'p' : tag);
}

function rtSet(f, md) {
  document.getElementById(f+'-body').innerHTML = mdToHtml(md);
}

function rtGet(f) {
  return htmlToMd(document.getElementById(f+'-body').innerHTML);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
function confirmDialog({ title = '', message = '', confirmLabel = 'Confirmer', danger = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box" role="dialog" aria-modal="true" aria-label="${escapeHtmlChars(title || 'Confirmation')}">
        ${title ? `<div class="confirm-title">${escapeHtmlChars(title)}</div>` : ''}
        <div class="confirm-msg">${escapeHtmlChars(message)}</div>
        <div class="confirm-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">Annuler</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtmlChars(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    function close(result) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    }
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { close(false); return; }
      const action = e.target.dataset?.action;
      if (action === 'cancel') close(false);
      else if (action === 'confirm') close(true);
    });
    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-action="cancel"]').focus();
  });
}

function setModalBusy(busy, label) {
  const foot = document.querySelector('.modal-foot');
  if (!foot) return;
  const buttons = foot.querySelectorAll('button');
  const saveBtn = foot.querySelector('.btn-primary');
  if (busy) {
    buttons.forEach(b => b.disabled = true);
    if (label && saveBtn) {
      saveBtn.dataset.originalText = saveBtn.textContent;
      saveBtn.textContent = label;
    }
  } else {
    buttons.forEach(b => b.disabled = false);
    if (saveBtn && saveBtn.dataset.originalText) {
      saveBtn.textContent = saveBtn.dataset.originalText;
      delete saveBtn.dataset.originalText;
    }
  }
}

function setButtonBusy(btn, busy, label) {
  if (!btn) return;
  btn.disabled = busy;
  if (label) {
    if (busy) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = label;
    } else if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }
}

async function saveReu() {
  const titre = document.getElementById('m-titre').value.trim();
  if (!titre) { document.getElementById('m-titre').style.outline = '2px solid var(--danger)'; document.getElementById('m-titre').focus(); return; }
  document.getElementById('m-titre').style.outline = '';

  // FIX: Duree_min stocké null quand le champ est vide, évite l'incohérence 0 ≠ fallback 60
  const dureeRaw = document.getElementById('m-duree').value;
  const fields = {
    Titre:            titre,
    Date:             inputToTs(document.getElementById('m-date').value),
    Heure:            document.getElementById('m-heure').value,
    Duree_min:        dureeRaw ? validateNumber(dureeRaw, 0, 9999, 0) : null,
    Statut_override:  document.getElementById('m-statut-override').value,
    Type_lieu:        document.getElementById('m-type-lieu').value,
    Lieu:             document.getElementById('m-lieu').value.trim(),
    Projet:           validateNumber(document.getElementById('m-projet').value, 0, Infinity, 0),
    Ordre_du_jour:    rtGet('odj'),
    Compte_rendu:     rtGet('cr'),
    Participants:     ['L', ...S.selParts],
  };

  try {
    setModalBusy(true, 'Enregistrement…');
    hideError();
    if (S.mode === 'create') {
      await grist.docApi.applyUserActions([['AddRecord', 'REUNIONS', null, fields]]);
    } else {
      await grist.docApi.applyUserActions([['UpdateRecord', 'REUNIONS', S.editId, fields]]);
    }
    closeModal();
    await load();
  } catch(e) {
    showError('Erreur lors de l\'enregistrement. Veuillez réessayer.');
  } finally {
    setModalBusy(false);
  }
}

async function deleteReu() {
  const ok = await confirmDialog({
    title: 'Supprimer la réunion',
    message: 'Cette action est définitive et ne peut pas être annulée. Continuer ?',
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    setModalBusy(true);
    await grist.docApi.applyUserActions([['RemoveRecord', 'REUNIONS', S.editId]]);
    closeModal();
    await load();
  } catch(e) {
    showError('Erreur lors de la suppression.');
  } finally {
    setModalBusy(false);
  }
}

async function duplicateReu() {
  const o = S.reunions.find(r => r.id === S.editId);
  if (!o) return;
  const fields = {
    Titre: (o.Titre||'') + ' (copie)',
    Date: o.Date, Heure: o.Heure, Duree_min: o.Duree_min,
    Statut_override: '', Type_lieu: o.Type_lieu, Lieu: o.Lieu,
    Projet: o.Projet, Ordre_du_jour: o.Ordre_du_jour,
    Compte_rendu: '', Participants: Array.isArray(o.Participants) ? o.Participants : ['L'],
  };
  try {
    setModalBusy(true, 'Duplication…');
    const result = await grist.docApi.applyUserActions([['AddRecord', 'REUNIONS', null, fields]]);
    // FIX: retValues supprimé — l'API Grist ne le retourne pas pour AddRecord
    const newId = result?.rowIds?.[0] ?? result?.[0];
    closeModal();
    await load();
    const newRec = newId
      ? S.reunions.find(r => r.id === newId)
      : S.reunions.reduce((max, r) => r.id > (max?.id || 0) ? r : max, null);
    if (newRec) openModal('edit', null, newRec);
  } catch(e) {
    showError('Erreur lors de la duplication.');
  } finally {
    setModalBusy(false);
  }
}

function getAbsents(dateStr) {
  return S.conges.filter(cg => {
    if (!cg.Date_debut) return false;
    const from = tsToInput(cg.Date_debut);
    const to   = cg.Date_fin ? tsToInput(cg.Date_fin) : from;
    return dateStr >= from && dateStr <= to;
  // FIX: S.contactMap.get()
  }).map(cg => S.contactMap.get(cg.Contact))
    .filter(ct => ct && ct.Membre_equipe == 1)
    .filter((ct, i, arr) => arr.findIndex(x => x.id === ct.id) === i);
}

// ── JOURS FÉRIÉS ──────────────────────────────────────────────────────────────
const COUNTRIES = [
  ['AT','🇦🇹 Autriche'],['BE','🇧🇪 Belgique'],['BR','🇧🇷 Brésil'],
  ['CA','🇨🇦 Canada'],['CL','🇨🇱 Chili'],['CN','🇨🇳 Chine'],
  ['CO','🇨🇴 Colombie'],['HR','🇭🇷 Croatie'],['CZ','🇨🇿 Rép. tchèque'],
  ['DK','🇩🇰 Danemark'],['EG','🇪🇬 Égypte'],['FI','🇫🇮 Finlande'],
  ['FR','🇫🇷 France'],['DE','🇩🇪 Allemagne'],['GR','🇬🇷 Grèce'],
  ['HU','🇭🇺 Hongrie'],['IN','🇮🇳 Inde'],['IE','🇮🇪 Irlande'],
  ['IL','🇮🇱 Israël'],['IT','🇮🇹 Italie'],['JP','🇯🇵 Japon'],
  ['LU','🇱🇺 Luxembourg'],['MA','🇲🇦 Maroc'],['MX','🇲🇽 Mexique'],
  ['NL','🇳🇱 Pays-Bas'],['NZ','🇳🇿 Nouvelle-Zélande'],['NG','🇳🇬 Nigeria'],
  ['NO','🇳🇴 Norvège'],['PL','🇵🇱 Pologne'],['PT','🇵🇹 Portugal'],
  ['RO','🇷🇴 Roumanie'],['RU','🇷🇺 Russie'],['SA','🇸🇦 Arabie Saoudite'],
  ['ZA','🇿🇦 Afrique du Sud'],['KR','🇰🇷 Corée du Sud'],['ES','🇪🇸 Espagne'],
  ['SE','🇸🇪 Suède'],['CH','🇨🇭 Suisse'],['TH','🇹🇭 Thaïlande'],
  ['TN','🇹🇳 Tunisie'],['TR','🇹🇷 Turquie'],['UA','🇺🇦 Ukraine'],
  ['GB','🇬🇧 Royaume-Uni'],['US','🇺🇸 États-Unis'],['VN','🇻🇳 Vietnam'],
];

// FIX: AbortController timeout 5 s + garde Array.isArray sur la réponse
async function fetchHolidays(country, year) {
  const key = `${country}-${year}`;
  if (S.holidays[key] !== undefined) return S.holidays[key];
  S.holidays[key] = {};
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return {};
    const list = await res.json();
    if (!Array.isArray(list)) return {};
    list.forEach(h => {
      if (!S.holidays[key][h.date]) S.holidays[key][h.date] = [];
      S.holidays[key][h.date].push(h.localName || h.name);
    });
  } catch {}
  return S.holidays[key];
}

function getHolidays(dateStr) {
  const year = dateStr.slice(0, 4);
  const names = [];
  for (const code of S.cal.countries) {
    const map = S.holidays[`${code}-${year}`];
    if (map && map[dateStr]) names.push(...map[dateStr]);
  }
  return [...new Set(names)];
}

async function initHolidays() {
  try {
    const saved = await grist.getOption('holidayCountries');
    if (Array.isArray(saved) && saved.length) S.cal.countries = saved;
  } catch {}
  const year = S.cal.ref.getFullYear();
  await Promise.all(S.cal.countries.map(c => fetchHolidays(c, year)));
  if (S.cal.ref.getMonth() >= 10)
    S.cal.countries.forEach(c => fetchHolidays(c, year + 1));
}

// ── HOLIDAY POPOVER ───────────────────────────────────────────────────────────
function updateHolidayBtn() {
  const btn = document.getElementById('holiday-btn');
  if (!btn) return;
  const n = S.cal.countries.length;
  btn.classList.toggle('has-selection', n > 0);
  const badge = btn.querySelector('.cal-holiday-badge');
  if (badge) badge.textContent = n > 0 ? n : '';
  badge && (badge.style.display = n > 0 ? 'flex' : 'none');
}

function toggleHolidayPopover(btnEl) {
  const pop = document.getElementById('holiday-popover');
  if (!pop.classList.contains('hidden')) {
    pop.classList.add('hidden');
    return;
  }
  const rect = btnEl.getBoundingClientRect();
  pop.style.top  = (rect.bottom + 6) + 'px';
  pop.style.right = (window.innerWidth - rect.right) + 'px';
  pop.style.left = 'auto';
  pop.classList.remove('hidden');
  document.getElementById('holiday-search').value = '';
  filterHolidayList();
  document.getElementById('holiday-search').focus();
}

function filterHolidayList() {
  const q    = (document.getElementById('holiday-search').value || '').toLowerCase();
  const list = document.getElementById('holiday-pop-list');
  list.innerHTML = '';
  const filtered = COUNTRIES.filter(([, label]) => label.toLowerCase().includes(q));
  filtered.forEach(([code, label]) => {
    const checked = S.cal.countries.includes(code);
    const item = document.createElement('label');
    item.className = 'holiday-pop-item';
    item.innerHTML = `<input type="checkbox" autocomplete="off" ${checked ? 'checked' : ''} onchange="toggleCountry('${code}')"> ${escapeHTML(label)}`;
    list.appendChild(item);
  });
  const sel = document.getElementById('holiday-sel-count');
  if (sel) sel.textContent = S.cal.countries.length
    ? `${S.cal.countries.length} sélectionné${S.cal.countries.length > 1 ? 's' : ''}`
    : '';
}

async function toggleCountry(code) {
  const idx = S.cal.countries.indexOf(code);
  if (idx === -1) S.cal.countries.push(code);
  else S.cal.countries.splice(idx, 1);
  const year = S.cal.ref.getFullYear();
  if (idx === -1) await fetchHolidays(code, year);
  filterHolidayList();
  updateHolidayBtn();
  try { await grist.setOption('holidayCountries', [...S.cal.countries]); } catch {}
  _renderCalendarDOM();
}

async function clearHolidayCountries() {
  S.cal.countries = [];
  try { await grist.setOption('holidayCountries', []); } catch {}
  filterHolidayList();
  updateHolidayBtn();
  _renderCalendarDOM();
}

document.addEventListener('click', e => {
  const pop = document.getElementById('holiday-popover');
  const btn = document.getElementById('holiday-btn');
  if (pop && !pop.classList.contains('hidden') && btn && !btn.contains(e.target) && !pop.contains(e.target))
    pop.classList.add('hidden');
});

function holidayBtnHTML() {
  const n = S.cal.countries.length;
  return `<button class="cal-holiday-btn ${n > 0 ? 'has-selection' : ''}" id="holiday-btn"
    onclick="toggleHolidayPopover(this)" title="Jours fériés">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
    </svg>
    <span class="cal-holiday-badge" style="display:${n > 0 ? 'flex' : 'none'}">${n > 0 ? n : ''}</span>
  </button>`;
}

function normalizeColor(c) {
  if (!c || typeof c !== 'string') return null;
  c = c.trim();
  return c ? (c.startsWith('#') ? c : '#' + c) : null;
}

function getEventColor(r) {
  const st = STATUTS.find(s => s.v === r.Statut) || STATUTS[0];

  // FIX: S.contactMap.get()
  const teamColors = parseRL(r.Participants)
    .map(id => S.contactMap.get(id))
    .filter(c => c && c.Membre_equipe == 1)
    .map(c => normalizeColor(c.Couleur))
    .filter(Boolean);

  if (!teamColors.length) return { bg: st.bg, color: st.color, border: st.color };

  const OP = '44';

  if (teamColors.length === 1) {
    return { bg: teamColors[0] + OP, color: teamColors[0], border: teamColors[0] };
  }

  const n = teamColors.length;
  const bandW = 100 / n;
  const blend = 16;
  const stops = [];
  teamColors.forEach((c, i) => {
    const s = i * bandW;
    const e = (i + 1) * bandW;
    stops.push(`${c+OP} ${i === 0 ? 0 : s + blend/2}%`);
    stops.push(`${c+OP} ${i === n-1 ? 100 : e - blend/2}%`);
  });

  return {
    bg: `linear-gradient(110deg, ${stops.join(', ')})`,
    color: teamColors[0],
    border: teamColors[0],
  };
}

const HOUR_H    = 56;
const CAL_START = 7;
const CAL_END   = 21;
const DAYS_FR   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MONTHS_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

function calNavTitle() {
  const d = S.cal.ref;
  if (S.cal.view === 'month') return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  const mon = calWeekStart(d);
  const sun = new Date(mon); sun.setDate(sun.getDate() + (S.cal.weekDays - 1));
  const sameMo = mon.getMonth() === sun.getMonth();
  return sameMo
    ? `${mon.getDate()} – ${sun.getDate()} ${MONTHS_SHORT[mon.getMonth()]} ${mon.getFullYear()}`
    : `${mon.getDate()} ${MONTHS_SHORT[mon.getMonth()]} – ${sun.getDate()} ${MONTHS_SHORT[sun.getMonth()]} ${sun.getFullYear()}`;
}

function calWeekStart(d) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0,0,0,0);
  return r;
}

function calNav(dir) {
  const d = S.cal.ref;
  if (S.cal.view === 'month') d.setMonth(d.getMonth() + dir);
  else d.setDate(d.getDate() + dir * 7);
  S.cal.ref = new Date(d);
  renderCalendar();
}

function calSetSubView(v) {
  S.cal.view = v;
  renderCalendar();
}

function calGoToday() {
  S.cal.ref = new Date();
  renderCalendar();
}

function calToggleWeekDays() {
  S.cal.weekDays = S.cal.weekDays === 5 ? 7 : 5;
  renderCalendar();
}

function renderCalendar() {
  const year = S.cal.ref.getFullYear();
  const missing = S.cal.countries.filter(c => S.holidays[`${c}-${year}`] === undefined);
  if (missing.length) {
    Promise.all(missing.map(c => fetchHolidays(c, year))).then(() => _renderCalendarDOM());
  }
  _renderCalendarDOM();
}

function _renderCalendarDOM() {
  const nav = document.getElementById('cal-nav');
  nav.innerHTML = `
    <span class="cal-title">${calNavTitle()}</span>
    <button class="cal-nav-btn" onclick="calNav(-1)">‹</button>
    <button class="cal-nav-btn" onclick="calNav(1)">›</button>
    <button class="cal-today-btn" onclick="calGoToday()">Aujourd'hui</button>
    <div class="cal-view-toggle" style="margin-left:auto">
      <button class="cal-vbtn ${S.cal.view==='month'?'active':''}" onclick="calSetSubView('month')">Mois</button>
      <button class="cal-vbtn ${S.cal.view==='week'?'active':''}" onclick="calSetSubView('week')">Semaine</button>
    </div>
    ${S.cal.view === 'week' ? `
    <div class="cal-view-toggle">
      <button class="cal-vbtn ${S.cal.weekDays===5?'active':''}" onclick="calToggleWeekDays()">5j</button>
      <button class="cal-vbtn ${S.cal.weekDays===7?'active':''}" onclick="calToggleWeekDays()">7j</button>
    </div>` : ''}
    ${holidayBtnHTML()}
  `;
  const body = document.getElementById('cal-body');
  body.innerHTML = '';
  if (S.cal.view === 'month') renderCalMonth(body);
  else renderCalWeek(body);
}

// ── MONTH VIEW ────────────────────────────────────────────────────────────────
function renderCalMonth(container) {
  const today = new Date(); today.setHours(0,0,0,0);
  const ref   = S.cal.ref;
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);

  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const gridStart = new Date(first); gridStart.setDate(1 - startDay);

  const wrap = document.createElement('div');
  wrap.className = 'cal-month';

  const dows = document.createElement('div');
  dows.className = 'cal-dow-row';
  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(d => {
    dows.innerHTML += `<div class="cal-dow">${d}</div>`;
  });
  wrap.appendChild(dows);

  const grid = document.createElement('div');
  grid.className = 'cal-month-grid';
  grid.style.gridTemplateRows = `repeat(6, 1fr)`;

  const allReu = filtered();

  for (let w = 0; w < 6; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w*7 + d);
      date.setHours(0,0,0,0);

      const isToday = date.getTime() === today.getTime();
      const isOther = date.getMonth() !== ref.getMonth();
      const dateStr = `${date.getFullYear()}-${p2(date.getMonth()+1)}-${p2(date.getDate())}`;
      const dateTs  = date.getTime() / 1000;

      const dayEvents = allReu
        .filter(r => r.Date && tsToInput(r.Date) === dateStr)
        .sort((a,b) => (a.Heure||'').localeCompare(b.Heure||''));

      const cell = document.createElement('div');
      const holidays = getHolidays(dateStr);
      const holiday  = holidays.length > 0;
      cell.className = 'cal-cell'
        + (isOther  ? ' other-month' : '')
        + (isToday  ? ' today'       : '')
        + (holiday  ? ' holiday'     : '');

      const numEl = document.createElement('div');
      numEl.className = 'cal-day-num';
      numEl.textContent = date.getDate();
      numEl.onclick = () => openModal('create', null, { Date: dateTs, Statut:'Planifiée' });
      cell.appendChild(numEl);

      if (holiday) {
        const hpill = document.createElement('div');
        hpill.className = 'cal-holiday-pill';
        hpill.textContent = holidays.join(' · ');
        hpill.title = holidays.join(', ');
        cell.appendChild(hpill);
      }

      const maxShow = 3;
      dayEvents.slice(0, maxShow).forEach(r => {
        const evColor = getEventColor(r);
        const pill = document.createElement('div');
        pill.className = 'cal-event-pill';
        pill.style.background = evColor.bg;
        pill.style.color = evColor.color;
        pill.textContent = (r.Heure ? r.Heure+' ' : '') + (r.Titre||'(Sans titre)');
        pill.title = r.Titre || '';
        pill.onclick = e => { e.stopPropagation(); openModal('edit', null, r); };
        cell.appendChild(pill);
      });
      if (dayEvents.length > maxShow) {
        const more = document.createElement('div');
        more.className = 'cal-more';
        more.textContent = `+ ${dayEvents.length - maxShow} de plus`;
        cell.appendChild(more);
      }
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  container.appendChild(wrap);
}

// ── WEEK VIEW ─────────────────────────────────────────────────────────────────
function renderCalWeek(container) {
  const today     = new Date(); today.setHours(0,0,0,0);
  const weekStart = calWeekStart(S.cal.ref);
  const days = Array.from({length: S.cal.weekDays}, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d; });
  const hours     = CAL_END - CAL_START;
  const totalH    = hours * HOUR_H;
  const TIME_COL  = 52;

  const wrap = document.createElement('div');
  wrap.className = 'cal-week';

  const body = document.createElement('div');
  body.className = 'cal-week-body';

  const head = document.createElement('div');
  head.className = 'cal-week-head';
  head.style.gridTemplateColumns = `${TIME_COL}px repeat(${S.cal.weekDays},1fr)`;
  head.innerHTML = `<div></div>`;
  days.forEach(d => {
    const isToday  = d.getTime() === today.getTime();
    const dStr     = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
    const holidays = getHolidays(dStr);
    const isHoliday = holidays.length > 0;
    head.innerHTML += `
      <div class="cal-week-day-head" style="${isHoliday ? 'background:color-mix(in srgb,#fef3c7 40%,var(--bg))' : ''}">
        <div class="cal-week-day-name">${DAYS_FR[d.getDay()]}</div>
        <div class="cal-week-day-num ${isToday?'today':''}">${d.getDate()}</div>
        ${isHoliday ? `<div class="cal-week-holiday-band" title="${escapeHTML(holidays.join(', '))}">${escapeHTML(holidays.join(' · '))}</div>` : ''}
      </div>`;
  });
  body.appendChild(head);

  const absRow = document.createElement('div');
  absRow.className = 'cal-absence-row';
  absRow.style.gridTemplateColumns = `${TIME_COL}px repeat(${S.cal.weekDays},1fr)`;
  const absLabel = document.createElement('div');
  absLabel.className = 'cal-absence-label';
  absLabel.textContent = 'Abs.';
  absRow.appendChild(absLabel);
  let hasAnyAbsence = false;
  days.forEach(d => {
    const dStr    = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
    const absents = getAbsents(dStr);
    if (absents.length) hasAnyAbsence = true;
    const cell = document.createElement('div');
    cell.className = 'cal-absence-cell';
    absents.forEach(ct => {
      const tag = document.createElement('span');
      tag.className = 'absence-tag';
      tag.textContent = (ct.Prenom ? ct.Prenom[0] + '. ' : '') + ct.Nom;
      tag.title = (ct.Prenom ? ct.Prenom + ' ' : '') + ct.Nom;
      cell.appendChild(tag);
    });
    absRow.appendChild(cell);
  });
  if (hasAnyAbsence) body.appendChild(absRow);

  const inner = document.createElement('div');
  inner.className = 'cal-week-inner';
  inner.style.gridTemplateColumns = `${TIME_COL}px repeat(${S.cal.weekDays},1fr)`;
  inner.style.gridTemplateRows = `repeat(${hours},${HOUR_H}px)`;
  inner.style.minHeight = `${totalH}px`;
  inner.style.position = 'relative';

  for (let h = 0; h < hours; h++) {
    const hr = CAL_START + h;
    const label = document.createElement('div');
    label.className = 'cal-hour-label';
    label.style.gridRow = h + 1;
    label.style.gridColumn = '1';
    label.textContent = `${hr}:00`;
    inner.appendChild(label);

    for (let c = 0; c < S.cal.weekDays; c++) {
      const bg = document.createElement('div');
      bg.className = 'cal-hour-bg cal-week-col';
      bg.style.gridRow = h + 1;
      bg.style.gridColumn = c + 2;
      if (h === 0) bg.style.borderTop = 'none';
      inner.appendChild(bg);
    }
  }

  const allReu  = filtered();
  const numDays = days.length;
  days.forEach((d, ci) => {
    const dStr     = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
    const dayEvents = allReu.filter(r => r.Date && tsToInput(r.Date) === dStr);
    const laid = layoutEvents(dayEvents);

    laid.forEach(({ r, col: evCol, cols: evCols }) => {
      const heure = r.Heure || `${CAL_START}:00`;
      const [hh, mm] = heure.split(':').map(Number);
      const startMin = hh * 60 + (mm||0);
      // FIX: fallback 60 min seulement si Duree_min est null/0/undefined
      const dur = r.Duree_min || 60;
      const top  = Math.max(0, (startMin - CAL_START*60) / 60 * HOUR_H);
      const height = Math.max(18, dur / 60 * HOUR_H - 2);

      if (top > totalH) return;

      const evColor = getEventColor(r);
      const ev = document.createElement('div');
      ev.className = 'cal-week-event';

      ev.style.cssText = `
        top:${top}px; height:${height}px;
        left:calc(${TIME_COL}px + (100% - ${TIME_COL}px) * ${(ci + evCol/evCols) / numDays} + 2px);
        width:calc((100% - ${TIME_COL}px) / ${numDays} * ${1/evCols} - 4px);
        background:${evColor.bg}; color:${evColor.color};
        border-left: 3px solid ${evColor.border};
      `;
      ev.innerHTML = `
        <div class="cal-week-event-title">${esc(r.Titre||'(Sans titre)')}</div>
        ${height > 30 ? `<div class="cal-week-event-time">${esc(r.Heure||'')}${r.Duree_min?' · '+r.Duree_min+'min':''}</div>` : ''}
      `;
      ev.onclick = () => openModal('edit', null, r);
      inner.appendChild(ev);
    });
  });

  const now = new Date();
  const todayIdx = days.findIndex(d => d.getTime() === today.getTime());
  if (todayIdx >= 0) {
    const nowMin = now.getHours()*60 + now.getMinutes();
    const nowTop = (nowMin - CAL_START*60) / 60 * HOUR_H;
    if (nowTop >= 0 && nowTop <= totalH) {
      const line = document.createElement('div');
      line.className = 'cal-now-line';
      line.style.cssText = `
        top:${nowTop}px; position:absolute;
        left:calc(${TIME_COL}px + (100% - ${TIME_COL}px) * ${todayIdx/numDays});
        width:calc((100% - ${TIME_COL}px) / ${numDays});
      `;
      line.innerHTML = '<div class="cal-now-dot"></div>';
      inner.appendChild(line);
    }
  }

  body.appendChild(inner);
  wrap.appendChild(body);
  container.appendChild(wrap);

  // FIX: requestAnimationFrame pour lire offsetHeight après layout complet
  // et regrouper les deux opérations post-rendu
  requestAnimationFrame(() => {
    if (hasAnyAbsence) absRow.style.top = head.offsetHeight + 'px';
    body.scrollTop = (8 - CAL_START) * HOUR_H;
  });
}

function layoutEvents(events) {
  const sorted = [...events].sort((a,b) => (a.Heure||'').localeCompare(b.Heure||''));
  const result = [];
  const cols   = [];

  sorted.forEach(r => {
    const [hh,mm] = (r.Heure||`${CAL_START}:00`).split(':').map(Number);
    const start = hh*60 + (mm||0);
    const end   = start + (r.Duree_min || 60);
    let placed  = false;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c].end <= start) {
        cols[c].end = end;
        result.push({ r, col: c, cols: 0 });
        placed = true; break;
      }
    }
    if (!placed) { cols.push({ end }); result.push({ r, col: cols.length-1, cols: 0 }); }
  });
  const numCols = cols.length || 1;
  result.forEach(ev => ev.cols = numCols);
  return result;
}

// ── ACCESSIBILITÉ CLAVIER ────────────────────────────────────────────────────
const FOCUSABLE_SELECTOR = [
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled]):not(.hidden)',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getVisibleFocusables(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => {
      if (el.classList.contains('hidden')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
}

function handleModalTab(e) {
  const overlay = document.getElementById('overlay');
  if (overlay.classList.contains('hidden')) return;
  const focusables = getVisibleFocusables(document.getElementById('modal-root'));
  if (!focusables.length) return;
  const first = focusables[0];
  const last  = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !overlay.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('overlay');
    if (!overlay.classList.contains('hidden')) {
      e.preventDefault();
      closeModal();
      return;
    }
    const pop = document.getElementById('holiday-popover');
    if (pop && !pop.classList.contains('hidden')) {
      e.preventDefault();
      pop.classList.add('hidden');
    }
  } else if (e.key === 'Tab') {
    handleModalTab(e);
  }
});

// ── START ─────────────────────────────────────────────────────────────────────
initHolidays();
load();
