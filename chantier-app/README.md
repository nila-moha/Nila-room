# App de suivi chantier — BN CORE GROUP

Application web interne pour suivre l'avancement des chantiers, les
problèmes signalés, les heures de travail et les demandes clients —
avec un accès séparé par rôle (administrateur, personnel technique,
client).

## Ce que ça fait

- **Administrateur (vous)** : crée les équipes, les clients, les
  projets ; génère un lien d'invitation par personne (rôle + équipe ou
  client déjà attaché au lien) ; valide les problèmes avant qu'ils ne
  soient visibles côté client ; répond aux demandes clients ; peut
  retirer l'accès de n'importe qui à tout moment.
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
5. Depuis l'onglet "Comptes" de l'application, générer un lien
   d'invitation par personne (rôle + équipe ou client) et le lui
   envoyer — elle crée elle-même son compte en l'ouvrant.

Le guide détaillé, étape par étape, est à faire ensemble en conversation
plutôt que lu seule dans ce fichier.

## Comment fonctionnent les accès

- Vous générez un **lien d'invitation** (rôle + équipe ou client déjà
  choisis) et l'envoyez par WhatsApp ou email.
- La personne l'ouvre, choisit son email et son mot de passe : son
  compte est créé, avec exactement le rôle et l'équipe/client que vous
  aviez fixés — elle ne peut pas se donner elle-même un accès plus
  large.
- Chaque lien ne sert qu'une fois.
- Vous pouvez **retirer l'accès** de n'importe qui à tout moment
  (onglet "Comptes" → "Retirer l'accès") : la personne ne peut plus se
  connecter ni voir aucune donnée, mais son historique (heures,
  problèmes signalés, etc.) reste conservé. Vous pouvez réactiver
  l'accès plus tard si besoin.

## Limite de sécurité à connaître

Les mots de passe sont gérés par Firebase Authentication (sécurisé,
standard de l'industrie), et les règles Firestore empêchent réellement
un client de voir les données d'un autre client, ou une personne
révoquée d'accéder à quoi que ce soit — ce n'est pas juste caché à
l'écran. Le seul maillon qui dépend de vous : ne partagez un lien
d'invitation qu'avec la bonne personne, puisque quiconque l'ouvre en
premier obtient l'accès qui lui est attaché.
