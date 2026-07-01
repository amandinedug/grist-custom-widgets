// ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
// ■ NOM DU WIDGET   : Dropdown DSFR
// ■ VERSION         : 1.1.0
// ■ DESCRIPTION     : Menu déroulant conforme DSFR permettant de sélectionner
// ■                   une valeur parmi les enregistrements d'une table Grist.
// ■                   La sélection pilote le curseur Grist (et donc les widgets
// ■                   liés) et peut être synchronisée entre plusieurs pages
// ■                   via un identifiant de session.
// ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

'use strict';

// ============= SECTION : SECURITE =============

const SecurityModule = {
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },
  validateNumber(value) { const n = Number(value); return isFinite(n) ? n : null; }
};

// ============= SECTION : INITIALISATION =============

const UIFeedback = {
  showError(message) { const b = document.getElementById('error-banner'); b.textContent = message; b.style.display = 'block'; },
  hideError() { const b = document.getElementById('error-banner'); b.style.display = 'none'; b.textContent = ''; },
  showLoader() { document.getElementById('loader').style.display = 'flex'; },
  hideLoader() { document.getElementById('loader').style.display = 'none'; }
};

// ============= SECTION : FONCTIONS UTILITAIRES =============

function updateDropdown(options) {
  const dropdown = document.getElementById('dropdown');
  dropdown.innerHTML = '';
  if (options.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'Aucune option disponible';
    dropdown.appendChild(opt);
  } else {
    options.forEach((option, index) => {
      const opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = String(option);
      dropdown.appendChild(opt);
    });
  }
}

function saveOption() { grist.widgetApi.setOption('sessionid', document.getElementById('sessionid').value); }

// ============= SECTION : GESTION DES EVENEMENTS =============

function initGrist() {
  let allRecords = [];
  let sessionID = '';

  grist.ready({
    columns: [{ name: 'OptionsToSelect', title: 'Options à sélectionner', type: 'Any' }],
    requiredAccess: 'read table',
    allowSelectBy: true,
    onEditOptions() {
      document.getElementById('container').style.display = 'none';
      document.getElementById('config').style.display = '';
      document.getElementById('sessionid').value = sessionID;
    },
  });

  grist.onOptions((customOptions, _) => {
    customOptions = customOptions || {};
    sessionID = customOptions.sessionid || '';
    document.getElementById('container').style.display = '';
    document.getElementById('config').style.display = 'none';
  });

  grist.onRecords(function (records, mappings) {
    UIFeedback.showLoader();
    UIFeedback.hideError();
    try {
      if (!records || records.length === 0) { updateDropdown([]); return; }
      allRecords = records;
      const options = grist.mapColumnNames(records)
        .map(r => r.OptionsToSelect)
        .filter(o => o !== null && o !== undefined);
      updateDropdown(options);
      if (sessionID.length > 0) {
        const selection = sessionStorage.getItem(sessionID + '_Dropdown_Item');
        if (selection) {
          const dropdown = document.getElementById('dropdown');
          dropdown.value = selection;
          dropdown.dispatchEvent(new Event('change'));
        }
      }
    } catch (err) {
      UIFeedback.showError('Erreur lors du chargement des options.');
      console.error('Dropdown DSFR - onRecords :', err);
    } finally {
      UIFeedback.hideLoader();
    }
  });

  grist.onRecord(function (record) {
    const index = allRecords.findIndex(r => r.id === record.id);
    if (index !== -1) document.getElementById('dropdown').value = String(index);
  });

  document.getElementById('dropdown').addEventListener('change', function (event) {
    const selectedRecord = allRecords[parseInt(event.target.value)];
    if (selectedRecord) {
      grist.setCursorPos({ rowId: selectedRecord.id });
      if (sessionID.length > 0) sessionStorage.setItem(sessionID + '_Dropdown_Item', event.target.value);
    }
  });

  document.getElementById('save-btn').addEventListener('click', saveOption);
}

document.addEventListener('DOMContentLoaded', initGrist);

console.log('Module de sécurité chargé - Dropdown DSFR v1.1.0');