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

// ============= SECTION : CONFIGURATION =============

// Aucune configuration statique requise pour ce widget.

// ============= SECTION : SECURITE =============

/**
 * SecurityModule : regroupe les fonctions de protection du widget.
 *
 * Note XSS : les options du dropdown sont insérées via .textContent
 * (natif JS), ce qui est safe par construction — aucune donnée Grist
 * n'est injectée via .innerHTML. escapeHTML est fourni par conformité
 * CSNC et pour tout usage futur éventuel.
 */
const SecurityModule = {
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  validateNumber(value) {
    const n = Number(value);
    return isFinite(n) ? n : null;
  }
};

// ============= SECTION : INITIALISATION =============

const UIFeedback = {
  showError(message) {
    const banner = document.getElementById('error-banner');
    banner.textContent = message;
    banner.style.display = 'block';
  },

  hideError() {
    const banner = document.getElementById('error-banner');
    banner.style.display = 'none';
    banner.textContent = '';
  },

  showLoader() {
    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
  },

  hideLoader() {
    const loader = document.getElementById('loader');
    loader.style.display = 'none';
  }
};

// ============= SECTION : FONCTIONS UTILITAIRES =============

function updateDropdown(options) {
  const dropdown = document.getElementById('dropdown');
  dropdown.innerHTML = '';
  if (options.length === 0) {
    const optionElement = document.createElement('option');
    optionElement.textContent = 'Aucune option disponible';
    dropdown.appendChild(optionElement);
  } else {
    options.forEach((option, index) => {
      const optionElement = document.createElement('option');
      optionElement.value = String(index);
      optionElement.textContent = String(option);
      dropdown.appendChild(optionElement);
    });
  }
}

function saveOption() {
  const sid = document.getElementById('sessionid').value;
  grist.widgetApi.setOption('sessionid', sid);
}

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
      if (!records || records.length === 0) {
        updateDropdown([]);
        return;
      }

      allRecords = records;
      const mapped = grist.mapColumnNames(records);
      const options = mapped
        .map(record => record.OptionsToSelect)
        .filter(option => option !== null && option !== undefined);

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
    const mapped = grist.mapColumnNames(record);
    const dropdown = document.getElementById('dropdown');
    const index = allRecords.findIndex(r => r.id === record.id);
    if (index !== -1) {
      dropdown.value = String(index);
    }
  });

  document.getElementById('dropdown').addEventListener('change', function (event) {
    const selectedIndex = parseInt(event.target.value);
    const selectedRecord = allRecords[selectedIndex];
    if (selectedRecord) {
      grist.setCursorPos({ rowId: selectedRecord.id });
      if (sessionID.length > 0) {
        sessionStorage.setItem(sessionID + '_Dropdown_Item', selectedIndex);
      }
    }
  });

  document.getElementById('save-btn').addEventListener('click', saveOption);
}

document.addEventListener('DOMContentLoaded', initGrist);

console.log('Module de sécurité chargé - Dropdown DSFR v1.1.0');