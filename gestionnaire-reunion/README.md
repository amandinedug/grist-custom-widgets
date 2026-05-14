# Gestionnaire de réunions — Widget Grist

Un widget pour gérer vos réunions directement dans Grist, sans quitter votre base de données. Vue Kanban par statut, calendrier mensuel et hebdomadaire, gestion des participants, éditeur de texte enrichi pour l'ordre du jour et le compte rendu.

[🔗 Découvrir un exemple](https://docs.getgrist.com/ccUN1fok3a6Z/Widget-Reunions/)

---

## Fonctionnalités

- 📋 **Vue Kanban** — Réunions organisées par statut (Planifiée, Aujourd'hui, Terminée, Annulée, Reportée), triées par date dans chaque colonne.
- 📅 **Vue Calendrier** — Affichage mensuel ou hebdomadaire (5j ou 7j), avec ligne "maintenant" en temps réel et détection des chevauchements.
- 👥 **Gestion des participants** — Recherche dans les contacts existants, création à la volée, envoi groupé par e-mail en un clic.
- 🌍 **Jours fériés** — Affichage des jours fériés de 45 pays via l'API publique [date.nager.at](https://date.nager.at), sélection persistée par document.
- 🏖️ **Absences équipe** — Si une table `CONGES` est renseignée, les absences apparaissent en vue semaine sous les en-têtes de jours.


<img width="1140" height="775" alt="Capture d’écran 2026-05-15 à 00 19 34" src="https://github.com/user-attachments/assets/106b5f9f-b158-4f6d-9c5e-1a57cae033c0" />
<img width="1142" height="781" alt="Capture d’écran 2026-05-15 à 00 19 42" src="https://github.com/user-attachments/assets/5392af8b-269e-4389-a699-97c2e10aeec9" />
<img width="1121" height="664" alt="Capture d’écran 2026-05-15 à 00 20 02" src="https://github.com/user-attachments/assets/19f0a7eb-3a86-47e7-9073-b518598dd207" />


---

## Installation

### Option 1 : URL directe (recommandée)

1. Dans votre document Grist, ajoutez un widget personnalisé (⊕ → Custom)
2. Collez l'URL : `https://amandinedug.github.io/grist-custom-widgets/reunions/index.html`
3. Définissez le niveau d'accès sur **Full document access**

### Option 2 : Installation manuelle

1. Créez un widget via le Custom Widget Builder de Grist
2. Copiez le contenu de [`full.html`](./full.html) et collez-le dans l'éditeur
3. Aucune dépendance externe à installer — tout est embarqué dans le fichier

---

## Structure des tables

Le widget lit et écrit dans 3 tables (+ 1 optionnelle). Les noms de colonnes doivent être respectés exactement.

Un fichier Excel est fourni (Widget_Reunions_import.xlsx) pour créer la structure en quelques clics : importez-le dans Grist, configurez les types de colonnes à partir de la ligne 2, puis supprimez cette ligne d'instructions avant utilisation.


## Qualité & sécurité

- 🔒 **Échappement systématique** — Toutes les données issues de Grist sont échappées avant injection dans le DOM (y compris dans les attributs HTML), ce qui protège contre les injections XSS.
- ⏱️ **Timeout sur l'API externe** — Les appels vers `date.nager.at` (jours fériés) sont limités à 5 secondes via `AbortController`. En cas de timeout ou d'erreur, le widget continue de fonctionner normalement.
- 🗂️ **Validation du schéma** — Au chargement, le widget vérifie silencieusement que toutes les colonnes attendues sont présentes et logue les éventuels écarts dans la console, sans bloquer l'interface.

---

## Contribuer

Les PR et issues sont les bienvenues ! Si vous trouvez un bug ou avez une idée d'amélioration, ouvrez une issue.

## Crédits

- Conçu pour la communauté Grist
- Données jours fériés : [Nager.Date API](https://date.nager.at)

## Licence

MIT — libre d'utilisation et de modification.

---
