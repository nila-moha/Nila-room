# App de suivi chantier — BN CORE GROUP

Application web interne pour suivre l'avancement des chantiers, les
problèmes signalés, les heures de travail et les demandes clients —
avec un accès séparé par rôle (administrateur, personnel technique,
client).

## Ce que ça fait

- **Administrateur (vous)** : crée les équipes, les clients, les
  projets ; associe chaque compte (créé dans Firebase) à un rôle, une
  équipe ou un client ; valide les problèmes avant qu'ils ne soient
  visibles côté client ; répond aux demandes clients.
- **Personnel (ingénieur / électricien / aide technique)** : voit les
  projets de son équipe, coche les étapes d'avancement (reprises du
  Manuel de contrôle interne), publie des mises à jour, signale des
  problèmes, pointe ses heures (arrivée/départ).
- **Client** : voit l'avancement et les mises à jour marquées comme
  visibles, voit les problèmes qui lui ont été communiqués, envoie des
  demandes et voit vos réponses.

## Ce que ce n'est PAS (pour l'instant)

- Pas d'application mobile téléchargeable (App Store / Google Play) —
  c'est un accès web qui fonctionne bien sur téléphone, tablette et
  ordinateur, sans rien installer.
- Pas de photos jointes aux problèmes ou aux mises à jour (à ajouter
  dans une version future si besoin).
- L'auto-inscription n'existe pas : vous créez chaque compte vous-même
  (voir plus bas).

## Ce qu'il faut pour la mettre en ligne

1. Un projet **Firebase** (gratuit pour ce volume d'usage) — Firebase
   est un service Google, ce qui s'intègre bien avec votre Google
   Workspace existant.
2. Remplir `js/firebase-config.js` avec les identifiants de ce projet.
3. Copier le contenu de `firestore.rules` dans la console Firebase
   (Firestore Database → Règles) — ce sont ces règles qui empêchent un
   client de voir les données d'un autre client, ou une équipe de voir
   les projets d'une autre équipe.
4. Héberger les fichiers (`index.html`, `js/`) sur un service comme
   Netlify — la même méthode que pour le site vitrine.
5. Créer les comptes de connexion (email + mot de passe) dans Firebase
   Authentication, puis leur associer un profil dans l'onglet
   "Comptes" de l'application (rôle, équipe ou client).

Le guide détaillé, étape par étape, est à faire ensemble en conversation
plutôt que lu seule dans ce fichier.

## Limite de sécurité à connaître

Les mots de passe sont gérés par Firebase Authentication (sécurisé,
standard de l'industrie). En revanche, il n'y a pas de vérification
d'identité (carte d'identité, etc.) à la création d'un compte — la
sécurité repose sur le fait que **vous seule créez les comptes** et
partagez les identifiants de façon sûre (pas par SMS non chiffré à un
inconnu, par exemple).
