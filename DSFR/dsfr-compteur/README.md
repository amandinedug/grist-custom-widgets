# Compteur de lignes — Widget Grist

Un widget minimaliste qui affiche le nombre de lignes de la table liée, avec un label personnalisable et 11 variantes de couleur issues du système de design de l'État (DSFR).

---

## Fonctionnalités

- 🔢 **Comptage en temps réel** — Se met à jour automatiquement à chaque modification de la table liée.
- 🏷️ **Label configurable** — Ajoutez un intitulé pour contextualiser le chiffre affiché (ex : "Projets actifs", "Contacts").
- 🎨 **11 couleurs DSFR** — Palette complète avec prévisualisation en direct dans le panneau de configuration.
- 🔗 **Filtres Grist natifs** — Les filtres appliqués sur la vue liée sont pris en compte : le compteur affiche uniquement les lignes correspondantes, pour un résultat aussi précis que nécessaire.

---

## ⚠️ Restriction d'usage
 
Ce widget utilise le Système de Design de l'État (DSFR). [Conformément à la circulaire n°6411-SG du 7 juillet 2023](https://www.systeme-de-design.gouv.fr/version-courante/fr/premiers-pas/perimetre-d-application), son usage est **réservé aux sites et services numériques de l'État français**.
 
---

## Installation

### Option 1 : URL directe (recommandée)

1. Dans votre document Grist, ajoutez un widget personnalisé (⊕ → Custom)
2. Collez l'URL : `https://amandinedug.github.io/grist-custom-widgets/DSFR/dsfr-compteur`
3. Définissez le niveau d'accès sur **Read table**
4. Liez le widget à la table dont vous souhaitez compter les lignes

### Option 2 : Installation manuelle

1. Créez un widget via le Custom Widget Builder de Grist
2. Copiez le contenu de [`index.html`](./index.html) et collez-le dans l'éditeur

---

## Configuration

Cliquez sur l'icône ⚙️ du widget pour ouvrir le panneau de configuration :

- **Label** — Texte affiché sous le chiffre (optionnel)
- **Couleur** — Sélectionnez parmi les 11 variantes DSFR disponibles, avec prévisualisation instantanée

Cliquez sur **Enregistrer** pour appliquer, ou **Annuler** pour revenir à l'état précédent.

---

## Qualité & sécurité

- 🔒 **Protection XSS** — Toutes les valeurs dynamiques sont insérées via `textContent`, jamais via `innerHTML`.
- 📖 **Accès en lecture seule** — Le widget ne lit que le nombre de lignes, sans accéder au contenu ni écrire dans le document.
- 🛡️ **Erreurs génériques** — Les messages d'erreur affichés à l'utilisateur ne contiennent aucun détail technique.
- ↩️ **Annulation fiable** — Le panneau de configuration sauvegarde un snapshot à l'ouverture et le restaure en cas d'annulation.

---

## Contribuer

Les PR et issues sont les bienvenues ! Si vous trouvez un bug ou avez une idée d'amélioration, ouvrez une issue.

## Crédits

- Conçu pour la communauté Grist
- Design : [Système de Design de l'État (DSFR)](https://www.systeme-de-design.gouv.fr/) v1.14.4
- Construit avec le [Custom Widget Builder](https://support.getgrist.com/widget-custom/) de Grist

## Licence

MIT — libre d'utilisation et de modification.

---