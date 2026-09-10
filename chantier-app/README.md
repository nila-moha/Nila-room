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
  Manuel de contrôle interne), publie des mises à jour avec photos,
  signale des problèmes avec photos, pointe ses heures (arrivée/départ)
  — avec une photo et une remarque optionnelles à chaque pointage (ex. :
  retard, matériel manquant) — les heures travaillées se calculent
  automatiquement (aujourd'hui, 7 derniers jours, détail par créneau).
  Le calendrier de planning montre aussi les créneaux du reste de son
  équipe (pas seulement les siens) : en cliquant sur un jour, on voit
  qui d'autre est sur quel chantier ce jour-là.
- **Client** : voit l'avancement et les mises à jour marquées comme
  visibles (avec leurs photos), voit les problèmes qui lui ont été
  communiqués, envoie des demandes et voit vos réponses.
- **Photos** : datées et horodatées automatiquement (date de l'envoi),
  redimensionnées automatiquement avant l'envoi pour ne pas consommer
  trop de données mobiles.
- **Problèmes liés à une étape** : en signalant un problème, le
  personnel peut le rattacher à l'étape du Manuel de contrôle interne
  concernée — utile pour retrouver rapidement quelle partie du chantier
  a posé souci.
- **Clôture de projet + avis client** : vous clôturez un projet en un
  clic ; le client voit alors une petite fiche pour noter sa
  satisfaction (1 à 5 étoiles + commentaire libre), visible ensuite
  côté admin sur ce projet.
- **Export / impression en PDF** : depuis n'importe quel projet
  (admin, personnel ou client), un bouton "Exporter / Imprimer" ouvre
  un rapport propre à l'en-tête BN CORE GROUP (avancement, journal,
  problèmes communiqués, avis client) — le client peut l'enregistrer
  en PDF via la fonction "Imprimer" de son navigateur, sans rien
  installer.
- **Installable et utilisable hors connexion** : ouverte depuis un
  téléphone, l'app propose de s'ajouter à l'écran d'accueil (comme une
  vraie application, sans passer par un App Store) ; les données déjà
  chargées restent consultables sans réseau, et les actions faites hors
  connexion (pointage, coche d'étape, message) partent automatiquement
  dès que la connexion revient.
- **Français / English / Română** : chaque personne choisit sa langue
  avec les boutons FR/EN/RO en haut de l'écran — mémorisé sur son propre
  appareil, sans rien changer pour les autres. Couvre tout ce qu'un
  ouvrier ou un client voit : connexion, création de compte, projets,
  avancement (étapes du Manuel de contrôle interne), journal, problèmes,
  heures, demandes, et le rapport exporté en PDF. Votre interface de
  gestion (équipes, clients, comptes, calendrier) reste en français
  uniquement, puisque c'est votre outil à vous.
  **À faire avant un premier chantier réel avec une équipe roumaine :**
  la traduction roumaine des étapes techniques (sécurité électrique,
  procédures) est une traduction standard, pas relue par un technicien
  roumain natif du métier — faites-la vérifier une fois par quelqu'un
  du terrain pour éviter une mauvaise compréhension sur un point de
  sécurité.

## Ce que ce n'est PAS (pour l'instant)

- Pas de vraie application native (App Store / Google Play) — c'est un
  site "installable" (PWA), qui s'ajoute à l'écran d'accueil et
  fonctionne hors connexion, mais sans passer par les stores.
- Le hors-ligne couvre le TEXTE et les coches d'étapes (mis en file
  d'attente et envoyés automatiquement au retour du réseau). L'envoi
  d'une **photo**, lui, a réellement besoin d'une connexion au moment
  où on appuie sur "Publier" ou "Signaler" — hors connexion, l'envoi
  échouera avec un message d'erreur, et il faudra réessayer une fois le
  réseau revenu (rien n'est perdu : le texte saisi reste affiché pour
  réessayer, il suffit de renvoyer).

## Ce qu'il faut pour la mettre en ligne

1. Un projet **Firebase** (gratuit pour ce volume d'usage) — Firebase
   est un service Google, ce qui s'intègre bien avec votre Google
   Workspace existant.
2. Remplir `js/firebase-config.js` avec les identifiants de ce projet.
3. Copier le contenu de `firestore.rules` dans la console Firebase
   (Firestore Database → Règles) — ce sont ces règles qui empêchent un
   client de voir les données d'un autre client, ou une équipe de voir
   les projets d'une autre équipe.
3bis. Activer **Storage** dans la console Firebase (pour les photos) et
   copier le contenu de `storage.rules` dans Storage → Règles.
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
