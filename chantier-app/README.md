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
  retirer l'accès de n'importe qui à tout moment. Onglet Heures de
  chaque projet : saisit aussi, par personne, les nuits d'hébergement
  et jours de repas à facturer au client (100€/nuit, 30€/jour dans
  votre grille actuelle) — c'est ce que VOUS facturez, pas ce que vous
  payez à l'ouvrier, donc une case volontairement invisible et non
  modifiable côté équipe ou client.
- **Personnel (ingénieur / électricien / aide technique)** : voit les
  projets de son équipe, coche les étapes d'avancement (reprises du
  Manuel de contrôle interne), publie des mises à jour avec photos,
  signale des problèmes avec photos, pointe ses heures (arrivée/départ)
  — avec une photo, une remarque et la position GPS optionnelles à
  chaque pointage (ex. : retard, matériel manquant — la position sert de
  preuve de présence) — les heures travaillées se calculent
  automatiquement (aujourd'hui, 7 derniers jours, détail par créneau).
  Le calendrier de planning montre aussi les créneaux du reste de son
  équipe (pas seulement les siens) : en cliquant sur un jour, on voit
  qui d'autre est sur quel chantier ce jour-là. Chaque jour, la personne
  peut aussi enregistrer le kilométrage effectué depuis son domicile
  (avec le type de véhicule), pour la facturation des frais de
  déplacement — visible en cumul par personne côté admin.
- **Journal = rapport journalier** : les mises à jour du journal (texte
  + photos, avec le numéro de série du conteneur concerné en option)
  sont le rapport quotidien de ce qui a été fait sur le chantier — un
  point séparé du pointage, qui ne sert qu'aux heures/déplacements.
- **Achats de matériel** : chaque projet a un compte de facturation
  associé (ex. BN CORE GROUP ou un compte client comme Sungrow Benelux
  B.V. — gérés dans l'onglet admin "Facturation matériel" : nom,
  adresse, TVA, contact). L'équipe consulte cet onglet "Achats" pour
  avoir les informations exactes à donner à la caisse d'un magasin
  (ex. Brico), et peut signaler l'achat (magasin, montant, photo du
  reçu) pour que vous sachiez quelle facture attendre.
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

## Protection des données (RGPD) — ajouté le 26/09/2026

- **Notice obligatoire** (`js/notice.js`) : chaque membre du personnel la lit
  et la confirme avant tout accès (FR / EN / RO / ZH). La confirmation
  (version, langue, heure serveur) est enregistrée sur son profil et
  visible dans l'onglet Comptes. Modifier le texte de façon importante =>
  augmenter `NOTICE_VERSION` : tout le monde reconfirme. Dossier complet :
  `bn-core-docs/BNC-RGPD-2026-01_Notice-pointage-GPS.pdf`.
- **Durées de conservation** (`js/retention.js`) : purge automatique à
  l'ouverture de l'espace admin (au plus une fois par jour) — GPS et
  photos de pointage 12 mois, pointages et kilométrage 5 ans, journal et
  problèmes 5 ans après clôture, profil révoqué 12 mois. Ouvrez l'app en
  admin au moins une fois par mois. Les identifiants de connexion des
  profils supprimés sont listés dans Comptes → « Conservation des
  données » : à effacer à la main dans Console Firebase → Authentication.
- **Photos** : le client n'a aucun accès direct au stockage ; l'équipe
  ajoute des photos mais ne peut ni les écraser ni les supprimer.

## Demandes de personnel (client -> ouvriers) — ajouté le 26/09/2026

- **Client** : « + Demander du personnel ». « Nouveau chantier » est proposé
  par défaut (ou un chantier existant). Obligatoire : adresse, travail à
  faire, du … au …, heure d'arrivée, nombre de personnes. Facultatif : nom
  du chantier, qualification, remarques. **Jamais le week-end** : une date
  de début ou de fin un samedi/dimanche est refusée ; les week-ends compris
  dans une période plus longue ne sont jamais planifiés. Il suit l'état :
  reçue / recherche en cours / confirmée / refusée.
- **Admin** (onglet « Personnel demandé ») : pour un nouveau chantier,
  « Créer ce chantier » en un clic (nom, adresse, client repris de la
  demande ; vous choisissez l'équipe). Puis « Je choisis les personnes »
  ou « Ouvrir aux volontaires » (une équipe ou tous), ou « Refuser ».
- **Ouvriers** (onglet « Missions ») : « Je viens » / « Je me retire ». Les
  premiers inscrits sont retenus, les suivants en liste d'attente ; l'admin
  valide l'équipe -> un créneau par personne et par jour ouvrable.
- **Notifications sur le téléphone** (voir ci-dessous) + bouton « 📲 Prévenir par
  WhatsApp » (message tout prêt) quand une mission est ouverte.

## Notifications push — ajouté le 26/09/2026

- Chacun active les notifications une fois (bandeau « 🔔 Activer les
  notifications » en haut de l'écran). iPhone : seulement avec l'app ajoutée
  à l'écran d'accueil (iOS 16.4+).
- Envoyées par `functions/index.js` (Cloud Functions, région europe-west1) :
  nouvelle demande / annulation / volontaire -> admin ; mission ouverte ->
  ouvriers concernés (dans leur langue) ; équipe confirmée -> client +
  ouvriers retenus ; refus -> client.
- **Nécessite le forfait Firebase Blaze** (paiement à l'usage ; à ce volume,
  très probablement 0 € : quota gratuit Cloud Functions, FCM gratuit).
- Déploiement : `firebase deploy --only functions` (installe les dépendances
  automatiquement).

## Preuve de commissioning, conformité, confirmation — ajouté le 26/09/2026

- **Preuve par étape** (`js/evidence.js`) : photos minimales, n° de série,
  mesures (couple, isolement, terre, capacité, RTE, température) avec
  l'outil utilisé et sa date d'étalonnage. Étape validée = verrouillée pour
  l'équipe (seul l'admin rouvre). Onglet admin **Outillage** : registre des
  outils et de leur étalonnage (outil expiré = refusé sur le terrain).
- **Réserves A/B/C** : levée par BN CORE, **acceptée par le client** ; l'étape
  « levée de réserves » est bloquée tant qu'une réserve A est ouverte.
- **PV de réception** signé par le client sur son téléphone ; tout est repris
  dans le rapport « Exporter / Imprimer ».
- **Photos hors connexion** (`js/offline-photos.js`) : en attente sur le
  téléphone, envoyées automatiquement au retour du réseau.
- **Passeport de conformité** (`js/compliance.js`, bouton « Passeport » dans
  Comptes) : Limosa-1, A1, VCA, BA4/BA5 (+ dates pièce d'identité / aptitude
  médicale, sans copie). Une mission peut exiger BA4/BA5 : seuls les
  ouvriers habilités peuvent se proposer. Le client voit un résumé.
- **Confirmation la veille** (`js/confirm.js`) : l'ouvrier confirme ; rappel
  à 14 h, liste des non-confirmés à l'admin à 18 h (functions, jours ouvrables).
- **Alerte d'expiration** des documents : 30 j, 7 j, jour J (functions, 7 h).

## Mettre à jour l'app en ligne

Depuis ce dossier `chantier-app/`, dans cet ordre (l'app d'abord, les
règles ensuite — sinon les téléphones encore sur l'ancienne version ne
peuvent plus s'inscrire) :

```
firebase deploy --only hosting
firebase deploy --only firestore:rules,storage
firebase deploy --only functions
```
