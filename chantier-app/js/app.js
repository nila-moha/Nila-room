// ============================================================
// BN CORE GROUP — App de suivi chantier
// Firebase Auth (email/mot de passe) + Firestore (données) + Firestore
// Security Rules (contrôle d'accès réel, voir firestore.rules).
//
// Comptes : l'admin génère un lien d'invitation (onglet "Comptes"),
// la personne l'ouvre et crée elle-même son compte (nom/email/mot de
// passe) — auto-inscription encadrée par un code à usage unique.
// L'admin peut retirer l'accès de n'importe qui à tout moment
// ("revoked"), sans supprimer son historique.
// ============================================================

const app = document.getElementById('app');

// ---- Vérification de la configuration ----
const CONFIG_MISSING = !firebaseConfig || Object.values(firebaseConfig).some(v => String(v).startsWith('REMPLACER_'));

if (CONFIG_MISSING) {
  app.innerHTML = `
    <div class="center-wrap">
      <div class="card">
        <h2>Configuration manquante</h2>
        <p class="mt-16" style="margin-top:12px;color:var(--text-dim)">
          Le fichier <code>js/firebase-config.js</code> n'a pas encore été rempli avec les
          informations de votre projet Firebase. Suivez le guide de mise en route avant
          d'utiliser cette application.
        </p>
      </div>
    </div>`;
  throw new Error('firebaseConfig not set');
}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Cache local des données + file d'attente des écritures hors connexion —
// l'app reste utilisable sans réseau et se resynchronise seule au retour.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  // 'failed-precondition' : plusieurs onglets ouverts, un seul peut tenir le cache.
  // 'unimplemented' : navigateur trop ancien. Dans les deux cas l'app marche,
  // juste sans le mode hors-ligne complet.
  console.warn('Persistance hors-ligne non activée :', err.code);
});

// ---- Langue de l'interface (FR/EN/RO) ----
// Choisie par chaque personne sur son propre appareil (bouton dans la barre
// du haut), mémorisée en local — n'affecte pas ce que voient les autres.
// Le français reste la valeur de repli si une traduction venait à manquer.
const LOCALE_MAP = { fr: 'fr-BE', en: 'en-GB', ro: 'ro-RO' };
function getLang() {
  try { return localStorage.getItem('bnLang') || 'fr'; } catch (e) { return 'fr'; }
}
function setLang(lang) {
  try { localStorage.setItem('bnLang', lang); } catch (e) { /* pas grave */ }
  routeByRole();
}
function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key] !== undefined) ? I18N[lang][key] : I18N.fr[key] !== undefined ? I18N.fr[key] : key;
}
function langSwitcherHtml() {
  // Fond plein sur chaque bouton (pas de transparence) pour rester lisible
  // aussi bien sur la barre du haut sombre que sur les écrans clairs
  // (connexion, inscription).
  const lang = getLang();
  return `<span style="display:inline-flex;gap:2px">${['fr', 'en', 'ro'].map(l =>
    `<button type="button" data-lang="${l}" style="padding:4px 8px;font-size:0.72rem;font-weight:700;border-radius:6px;border:1px solid var(--sand-500);background:${l === lang ? 'var(--gold-600)' : 'var(--gold-100)'};color:${l === lang ? '#fff' : 'var(--brown-900)'}">${l.toUpperCase()}</button>`
  ).join('')}</span>`;
}
function wireLangSwitcher(root) {
  (root || document).querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}

// ---- Gabarits de check-list par type de projet ----
// (repris du Manuel de contrôle interne — mêmes étapes, même logique de
// contrôle — traduites en EN/RO pour une équipe non francophone. Les
// documents Firestore ne stockent qu'un type + un index d'étape : le texte
// affiché se traduit à la volée selon la langue de la personne qui regarde.)
const CHECKLIST_TEMPLATES = {
  fr: {
    commissioning: [
      "Revue documentaire pré-commissioning (plans, fiches PCS/BMS/EMS, certificats fabricant)",
      "Inspection visuelle de sécurité (câblage, mise à la terre, protections, étiquetage)",
      "Tests fonctionnels (communication BMS-PCS-EMS)",
      "Tests de performance (charge/décharge, capacité mesurée)",
      "Tests de protection et de sécurité",
      "Levée de réserves (punch list)",
      "Émission du certificat de mise en service",
    ],
    om: [
      "Plan de maintenance préventive écrit",
      "Visite de maintenance préventive sur site",
      "Monitoring continu (disponibilité, alarmes, SOH, température)",
      "Intervention corrective si incident",
      "Reporting périodique au client",
    ],
    container: [
      "Évaluation de l'état du conteneur (photos avant travaux)",
      "Obtention du permis de travail à chaud",
      "Travaux de soudure et reprise structurelle",
      "Traitement anticorrosion et remise en peinture",
      "Contrôle final d'étanchéité et clôture du chantier",
    ],
    audit: [
      "Collecte documentaire",
      "Inspection technique sur site",
      "Analyse de performance (réel vs garanti)",
      "Recommandations priorisées",
      "Rédaction et envoi du rapport final",
    ],
    workforce: [
      "Qualification du besoin avec le client",
      "Sélection et mobilisation du personnel",
      "Intervention sur site sous supervision du client",
      "Reporting et clôture de mission",
    ],
  },
  en: {
    commissioning: [
      "Pre-commissioning document review (drawings, PCS/BMS/EMS data sheets, manufacturer certificates)",
      "Visual safety inspection (wiring, earthing, protections, labelling)",
      "Functional tests (BMS-PCS-EMS communication)",
      "Performance tests (charge/discharge, measured capacity)",
      "Protection and safety tests",
      "Punch list closeout",
      "Issuance of the commissioning certificate",
    ],
    om: [
      "Written preventive maintenance plan",
      "On-site preventive maintenance visit",
      "Continuous monitoring (availability, alarms, SOH, temperature)",
      "Corrective intervention in case of incident",
      "Periodic reporting to the client",
    ],
    container: [
      "Container condition assessment (before-work photos)",
      "Hot work permit obtained",
      "Welding and structural repair work",
      "Anti-corrosion treatment and repainting",
      "Final leak-tightness check and site closeout",
    ],
    audit: [
      "Document collection",
      "On-site technical inspection",
      "Performance analysis (actual vs. guaranteed)",
      "Prioritised recommendations",
      "Drafting and sending the final report",
    ],
    workforce: [
      "Needs qualification with the client",
      "Selection and mobilisation of personnel",
      "On-site intervention under client supervision",
      "Reporting and mission closeout",
    ],
  },
  ro: {
    commissioning: [
      "Verificarea documentației înainte de punere în funcțiune (planuri, fișe tehnice PCS/BMS/EMS, certificate producător)",
      "Inspecție vizuală de siguranță (cablaj, împământare, protecții, etichetare)",
      "Teste funcționale (comunicare BMS-PCS-EMS)",
      "Teste de performanță (încărcare/descărcare, capacitate măsurată)",
      "Teste de protecție și siguranță",
      "Rezolvarea neconformităților (punch list)",
      "Emiterea certificatului de punere în funcțiune",
    ],
    om: [
      "Plan scris de mentenanță preventivă",
      "Vizită de mentenanță preventivă la fața locului",
      "Monitorizare continuă (disponibilitate, alarme, SOH, temperatură)",
      "Intervenție corectivă în caz de incident",
      "Raportare periodică către client",
    ],
    container: [
      "Evaluarea stării containerului (fotografii înainte de lucrări)",
      "Obținerea permisului de lucru la cald",
      "Lucrări de sudură și reparații structurale",
      "Tratament anticoroziv și revopsire",
      "Verificare finală de etanșeitate și închiderea șantierului",
    ],
    audit: [
      "Colectarea documentației",
      "Inspecție tehnică la fața locului",
      "Analiza performanței (real vs. garantat)",
      "Recomandări prioritizate",
      "Redactarea și trimiterea raportului final",
    ],
    workforce: [
      "Calificarea nevoii împreună cu clientul",
      "Selecția și mobilizarea personalului",
      "Intervenție la fața locului sub supervizarea clientului",
      "Raportare și închiderea misiunii",
    ],
  },
};
// NOTE traduction : les étapes ci-dessus touchent à la sécurité électrique.
// Traduction standard, pas relue par un technicien natif roumain — faites
// vérifier la version RO par quelqu'un du métier avant un premier chantier
// réel avec une équipe roumaine.
function checklistStepLabel(type, index) {
  const lang = getLang();
  const arr = (CHECKLIST_TEMPLATES[lang] && CHECKLIST_TEMPLATES[lang][type]) || CHECKLIST_TEMPLATES.fr[type] || [];
  return arr[index] !== undefined ? arr[index] : (CHECKLIST_TEMPLATES.fr[type] || [])[index] || '';
}

const PROJECT_TYPE_LABELS_I18N = {
  fr: { commissioning: 'Commissioning', om: 'O&M', container: 'Réparation de conteneur', audit: 'Audit technique', workforce: 'Workforce Deployment' },
  en: { commissioning: 'Commissioning', om: 'O&M', container: 'Container repair', audit: 'Technical audit', workforce: 'Workforce Deployment' },
  ro: { commissioning: 'Punere în funcțiune', om: 'Mentenanță (O&M)', container: 'Reparație container', audit: 'Audit tehnic', workforce: 'Furnizare personal tehnic' },
};
function projectTypeLabel(type) {
  const lang = getLang();
  return (PROJECT_TYPE_LABELS_I18N[lang] && PROJECT_TYPE_LABELS_I18N[lang][type]) || PROJECT_TYPE_LABELS_I18N.fr[type] || type;
}
// Alias conservé pour les listes déroulantes admin (Object.entries(...)) —
// toujours en français, l'interface de gestion reste FR uniquement pour l'instant.
const PROJECT_TYPE_LABELS = PROJECT_TYPE_LABELS_I18N.fr;

const ROLE_LABELS_I18N = {
  fr: { admin: 'Administrateur', engineer: 'Ingénieur', electrician: 'Électricien', worker: 'Aide technique', client: 'Client' },
  en: { admin: 'Administrator', engineer: 'Engineer', electrician: 'Electrician', worker: 'Technical assistant', client: 'Client' },
  ro: { admin: 'Administrator', engineer: 'Inginer', electrician: 'Electrician', worker: 'Asistent tehnic', client: 'Client' },
};
function roleLabel(role) {
  const lang = getLang();
  return (ROLE_LABELS_I18N[lang] && ROLE_LABELS_I18N[lang][role]) || ROLE_LABELS_I18N.fr[role] || role;
}
const ROLE_LABELS = ROLE_LABELS_I18N.fr;

// ---- Textes d'interface FR/EN/RO ----
// Portée volontaire : tout ce qu'un ouvrier ou un client voit (connexion,
// inscription, vue équipe, vue client, détail d'un chantier) est traduit.
// L'interface de gestion de l'admin (équipes, clients, comptes) reste en
// français uniquement — c'est votre propre outil.
const I18N = {
  fr: {
    appTitle: 'BN CORE GROUP', appSubtitle: 'Suivi de chantier',
    emailLabel: 'Email', passwordLabel: 'Mot de passe',
    loginBtn: 'Se connecter', loggingIn: 'Connexion…',
    noAccount: 'Pas encore de compte ? Contactez votre administrateur.',
    verifyingInvite: "Vérification de l'invitation…",
    loadingProfile: 'Chargement de votre profil…',
    loadingGeneric: 'Chargement…',
    inviteInvalid: "Ce lien d'invitation n'est plus valide ou a déjà été utilisé. Contactez BN CORE GROUP pour en obtenir un nouveau.",
    createAccessFor: 'Créer votre accès',
    fullNameLabel: 'Nom complet', createAccountBtn: 'Créer mon compte', creatingAccount: 'Création…',
    notConfiguredTitle: 'Compte non configuré',
    notConfiguredBody: "Votre compte existe mais n'a pas encore de profil (rôle, équipe ou client) associé. Contactez votre administrateur.",
    revokedTitle: 'Accès révoqué',
    revokedBody: "Votre accès à cette application a été retiré. Contactez BN CORE GROUP si vous pensez qu'il s'agit d'une erreur.",
    disconnect: 'Se déconnecter',
    authErrInvalidEmail: 'Adresse email invalide.',
    authErrUserDisabled: 'Ce compte a été désactivé.',
    authErrUserNotFound: 'Aucun compte avec cet email.',
    authErrWrongPassword: 'Mot de passe incorrect.',
    authErrInvalidCredential: 'Email ou mot de passe incorrect.',
    authErrTooManyRequests: 'Trop de tentatives — réessayez dans quelques minutes.',
    authErrPrefix: 'Erreur de connexion : ',
    signupErrEmailInUse: 'Cet email est déjà utilisé par un autre compte.',
    signupErrInvalidEmail: 'Adresse email invalide.',
    signupErrWeakPassword: 'Le mot de passe doit contenir au moins 6 caractères.',
    errorPrefix: 'Erreur : ',
    yourProjects: 'Vos projets', yourPlanning: 'Votre planning',
    noTeamAssigned: "Aucune équipe ne vous est associée pour le moment. Contactez votre administrateur.",
    activeProjectsTitle: 'Vos projets en cours',
    noActiveProjects: 'Aucun projet actif assigné à votre équipe.',
    loadError: 'Erreur de chargement : ',
    clientNoProject: 'Aucun projet ne vous est associé pour le moment. Contactez BN CORE GROUP.',
    clientYourProjects: 'Vos projets',
    noProjectsYet: 'Aucun projet pour le moment.',
    statusActive: 'Actif', statusActiveClient: 'En cours', statusClosed: 'Clôturé',
    exportBtn: 'Exporter / Imprimer',
    closeProjectBtn: 'Clôturer le projet',
    closeProjectConfirm: 'Clôturer ce projet ? Le client pourra alors laisser un avis de satisfaction.',
    tabProgress: 'Avancement', tabJournal: 'Journal', tabProblems: 'Problèmes',
    tabHours: 'Heures', tabMyRequests: 'Mes demandes', tabRequests: 'Demandes',
    projectNotFound: 'Projet introuvable.',
    closedOnClientThanks: (date) => `Projet clôturé le ${date}. Merci pour votre avis : `,
    closedOnAdmin: (date) => `Projet clôturé le ${date} par `,
    awaitingClientFeedback: "En attente de l'avis client.",
    clientFeedback: 'Avis client : ',
    feedbackPromptTitle: 'Projet clôturé — votre avis nous intéresse',
    ratingLabel: 'Note',
    rating5: '★★★★★ Excellent', rating4: '★★★★☆ Très bien', rating3: '★★★☆☆ Correct',
    rating2: '★★☆☆☆ Insuffisant', rating1: '★☆☆☆☆ Mauvais',
    commentLabelOptional: 'Commentaire (optionnel)',
    sendFeedbackBtn: 'Envoyer mon avis',
    stepsCompleted: (done, total) => `${done} / ${total} étapes complétées`,
    noStepsDefined: 'Aucune étape définie.',
    completedByOn: (by, date) => `Complété par ${by} le ${date}`,
    stepNotePrompt: 'Note pour cette étape (optionnel) :',
    journalPlaceholder: 'Mise à jour du chantier…',
    photosOptionalLabel: 'Photos (optionnel)',
    visibleToClientLabel: 'Visible par le client',
    publishBtn: 'Publier', publishing: 'Publication…', sendingPhotos: 'Envoi des photos…',
    noEntriesYet: 'Aucune entrée pour le moment.',
    internalBadge: 'Interne',
    sendErrorPrefix: "Erreur d'envoi : ",
    problemTitleLabel: 'Titre',
    stepConcernedLabel: 'Étape concernée (optionnel)',
    noSpecificStep: 'Aucune étape spécifique',
    descriptionLabel: 'Description',
    reportBtn: 'Signaler', reporting: 'Signalement…',
    noProblemsReported: 'Aucun problème signalé.',
    stepConcernedInline: (label) => ` · Étape concernée : ${label}`,
    problemStatusReported: 'Signalé', problemStatusPublished: 'Communiqué', problemStatusResolved: 'Résolu',
    clockInBtn: "Pointer l'arrivée", clockOutBtn: 'Pointer le départ',
    ongoingSince: (date) => `En cours depuis ${date}`,
    ongoingBadge: 'en cours', onSiteBadge: 'Sur site',
    lastClockOut: (date) => `Dernier départ : ${date}`,
    noClockYet: 'Aucun pointage encore',
    today: "Aujourd'hui", last7days: '7 derniers jours',
    colArrival: 'Arrivée', colDeparture: 'Départ', colDuration: 'Durée',
    noTimesheetRows: 'Aucun pointage.',
    clockNoteLabel: 'Remarque (optionnel)',
    clockNotePlaceholder: 'Ex : retard dû à la circulation, matériel manquant…',
    confirmBtn: 'Confirmer', cancelBtn: 'Annuler',
    noOneAssignedDay: "Personne d'assigné ce jour-là.",
    youMarker: '(vous)',
    containerSerialLabel: 'N° de série du conteneur (optionnel)',
    containerSerialPlaceholder: 'Ex : MSKU1234567',
    containerBadge: (serial) => `Conteneur ${serial}`,
    mileageTitle: 'Kilométrage',
    mileageKmLabel: 'Distance aujourd\'hui, aller-retour depuis le domicile (km)',
    mileageVehicleLabel: 'Véhicule',
    mileageVehicleCar: 'Voiture', mileageVehicleTruck: 'Camion',
    mileageSaveBtn: 'Enregistrer', mileageSaving: 'Enregistrement…',
    mileageColDate: 'Date', mileageColKm: 'Km', mileageColVehicle: 'Véhicule',
    mileageNoRows: 'Aucun trajet enregistré.',
    mileageMonthTotal: (km) => `Total ce mois-ci : ${km} km`,
    mileageColPerson: 'Personne', mileageColTotal: 'Total km',
    backToCalendar: 'Retour au calendrier',
    withTeammate: (name) => `avec ${name}`,
    yourRequestLabel: 'Votre demande', sendBtn: 'Envoyer',
    noRequests: 'Aucune demande.',
    requestOpen: 'Ouverte', requestAnswered: 'Répondu',
    responseLabel: 'Réponse : ',
    popupBlocked: "Votre navigateur a bloqué l'ouverture du rapport. Autorisez les pop-ups pour ce site puis réessayez.",
    reportTitlePrefix: 'Rapport — ',
    reportHeadingPrefix: 'Rapport de chantier — ',
    printSaveBtn: 'Imprimer / Enregistrer en PDF',
    documentGeneratedOn: (date) => `Document généré le ${date}`,
    reportCompletedOn: (date) => ` — complété le ${date}`,
    feedbackHeading: 'Avis client',
  },
  en: {
    appTitle: 'BN CORE GROUP', appSubtitle: 'Site tracking',
    emailLabel: 'Email', passwordLabel: 'Password',
    loginBtn: 'Log in', loggingIn: 'Signing in…',
    noAccount: 'No account yet? Contact your administrator.',
    verifyingInvite: 'Checking your invitation…',
    loadingProfile: 'Loading your profile…',
    loadingGeneric: 'Loading…',
    inviteInvalid: 'This invitation link is no longer valid or has already been used. Contact BN CORE GROUP for a new one.',
    createAccessFor: 'Create your access',
    fullNameLabel: 'Full name', createAccountBtn: 'Create my account', creatingAccount: 'Creating…',
    notConfiguredTitle: 'Account not set up',
    notConfiguredBody: 'Your account exists but has no profile (role, team or client) attached yet. Contact your administrator.',
    revokedTitle: 'Access revoked',
    revokedBody: 'Your access to this application has been removed. Contact BN CORE GROUP if you believe this is a mistake.',
    disconnect: 'Log out',
    authErrInvalidEmail: 'Invalid email address.',
    authErrUserDisabled: 'This account has been disabled.',
    authErrUserNotFound: 'No account with this email.',
    authErrWrongPassword: 'Incorrect password.',
    authErrInvalidCredential: 'Incorrect email or password.',
    authErrTooManyRequests: 'Too many attempts — try again in a few minutes.',
    authErrPrefix: 'Login error: ',
    signupErrEmailInUse: 'This email is already used by another account.',
    signupErrInvalidEmail: 'Invalid email address.',
    signupErrWeakPassword: 'The password must be at least 6 characters long.',
    errorPrefix: 'Error: ',
    yourProjects: 'Your projects', yourPlanning: 'Your schedule',
    noTeamAssigned: 'No team is assigned to you yet. Contact your administrator.',
    activeProjectsTitle: 'Your ongoing projects',
    noActiveProjects: 'No active project assigned to your team.',
    loadError: 'Loading error: ',
    clientNoProject: 'No project is linked to you yet. Contact BN CORE GROUP.',
    clientYourProjects: 'Your projects',
    noProjectsYet: 'No project yet.',
    statusActive: 'Active', statusActiveClient: 'In progress', statusClosed: 'Closed',
    exportBtn: 'Export / Print',
    closeProjectBtn: 'Close project',
    closeProjectConfirm: 'Close this project? The client will then be able to leave a satisfaction rating.',
    tabProgress: 'Progress', tabJournal: 'Journal', tabProblems: 'Issues',
    tabHours: 'Hours', tabMyRequests: 'My requests', tabRequests: 'Requests',
    projectNotFound: 'Project not found.',
    closedOnClientThanks: (date) => `Project closed on ${date}. Thank you for your feedback: `,
    closedOnAdmin: (date) => `Project closed on ${date} by `,
    awaitingClientFeedback: 'Awaiting client feedback.',
    clientFeedback: 'Client feedback: ',
    feedbackPromptTitle: 'Project closed — we would like your feedback',
    ratingLabel: 'Rating',
    rating5: '★★★★★ Excellent', rating4: '★★★★☆ Very good', rating3: '★★★☆☆ Fair',
    rating2: '★★☆☆☆ Poor', rating1: '★☆☆☆☆ Bad',
    commentLabelOptional: 'Comment (optional)',
    sendFeedbackBtn: 'Send my feedback',
    stepsCompleted: (done, total) => `${done} / ${total} steps completed`,
    noStepsDefined: 'No step defined.',
    completedByOn: (by, date) => `Completed by ${by} on ${date}`,
    stepNotePrompt: 'Note for this step (optional):',
    journalPlaceholder: 'Site update…',
    photosOptionalLabel: 'Photos (optional)',
    visibleToClientLabel: 'Visible to the client',
    publishBtn: 'Publish', publishing: 'Publishing…', sendingPhotos: 'Sending photos…',
    noEntriesYet: 'No entry yet.',
    internalBadge: 'Internal',
    sendErrorPrefix: 'Sending error: ',
    problemTitleLabel: 'Title',
    stepConcernedLabel: 'Related step (optional)',
    noSpecificStep: 'No specific step',
    descriptionLabel: 'Description',
    reportBtn: 'Report', reporting: 'Reporting…',
    noProblemsReported: 'No issue reported.',
    stepConcernedInline: (label) => ` · Related step: ${label}`,
    problemStatusReported: 'Reported', problemStatusPublished: 'Shared', problemStatusResolved: 'Resolved',
    clockInBtn: 'Clock in', clockOutBtn: 'Clock out',
    ongoingSince: (date) => `In progress since ${date}`,
    ongoingBadge: 'in progress', onSiteBadge: 'On site',
    lastClockOut: (date) => `Last clock-out: ${date}`,
    noClockYet: 'No clock entry yet',
    today: 'Today', last7days: 'Last 7 days',
    colArrival: 'Arrival', colDeparture: 'Departure', colDuration: 'Duration',
    noTimesheetRows: 'No clock entry.',
    clockNoteLabel: 'Note (optional)',
    clockNotePlaceholder: 'E.g.: late due to traffic, missing equipment…',
    confirmBtn: 'Confirm', cancelBtn: 'Cancel',
    noOneAssignedDay: 'No one assigned that day.',
    youMarker: '(you)',
    containerSerialLabel: 'Container serial number (optional)',
    containerSerialPlaceholder: 'E.g.: MSKU1234567',
    containerBadge: (serial) => `Container ${serial}`,
    mileageTitle: 'Mileage',
    mileageKmLabel: "Today's distance, round trip from home (km)",
    mileageVehicleLabel: 'Vehicle',
    mileageVehicleCar: 'Car', mileageVehicleTruck: 'Truck',
    mileageSaveBtn: 'Save', mileageSaving: 'Saving…',
    mileageColDate: 'Date', mileageColKm: 'Km', mileageColVehicle: 'Vehicle',
    mileageNoRows: 'No trip logged.',
    mileageMonthTotal: (km) => `Total this month: ${km} km`,
    mileageColPerson: 'Person', mileageColTotal: 'Total km',
    backToCalendar: 'Back to calendar',
    withTeammate: (name) => `with ${name}`,
    yourRequestLabel: 'Your request', sendBtn: 'Send',
    noRequests: 'No request.',
    requestOpen: 'Open', requestAnswered: 'Answered',
    responseLabel: 'Response: ',
    popupBlocked: 'Your browser blocked the report window. Allow pop-ups for this site and try again.',
    reportTitlePrefix: 'Report — ',
    reportHeadingPrefix: 'Site report — ',
    printSaveBtn: 'Print / Save as PDF',
    documentGeneratedOn: (date) => `Document generated on ${date}`,
    reportCompletedOn: (date) => ` — completed on ${date}`,
    feedbackHeading: 'Client feedback',
  },
  ro: {
    appTitle: 'BN CORE GROUP', appSubtitle: 'Urmărire șantier',
    emailLabel: 'Email', passwordLabel: 'Parolă',
    loginBtn: 'Conectare', loggingIn: 'Se conectează…',
    noAccount: 'Nu aveți încă un cont? Contactați administratorul.',
    verifyingInvite: 'Se verifică invitația…',
    loadingProfile: 'Se încarcă profilul dvs.…',
    loadingGeneric: 'Se încarcă…',
    inviteInvalid: 'Acest link de invitație nu mai este valabil sau a fost deja folosit. Contactați BN CORE GROUP pentru unul nou.',
    createAccessFor: 'Creați-vă accesul',
    fullNameLabel: 'Nume complet', createAccountBtn: 'Creează contul', creatingAccount: 'Se creează…',
    notConfiguredTitle: 'Cont neconfigurat',
    notConfiguredBody: 'Contul dvs. există, dar nu are încă un profil (rol, echipă sau client) asociat. Contactați administratorul.',
    revokedTitle: 'Acces revocat',
    revokedBody: 'Accesul dvs. la această aplicație a fost retras. Contactați BN CORE GROUP dacă credeți că este o eroare.',
    disconnect: 'Deconectare',
    authErrInvalidEmail: 'Adresă de email invalidă.',
    authErrUserDisabled: 'Acest cont a fost dezactivat.',
    authErrUserNotFound: 'Niciun cont cu acest email.',
    authErrWrongPassword: 'Parolă incorectă.',
    authErrInvalidCredential: 'Email sau parolă incorectă.',
    authErrTooManyRequests: 'Prea multe încercări — reîncercați peste câteva minute.',
    authErrPrefix: 'Eroare de conectare: ',
    signupErrEmailInUse: 'Acest email este deja folosit de alt cont.',
    signupErrInvalidEmail: 'Adresă de email invalidă.',
    signupErrWeakPassword: 'Parola trebuie să aibă cel puțin 6 caractere.',
    errorPrefix: 'Eroare: ',
    yourProjects: 'Proiectele dvs.', yourPlanning: 'Programul dvs.',
    noTeamAssigned: 'Nu vă este asociată nicio echipă momentan. Contactați administratorul.',
    activeProjectsTitle: 'Proiectele dvs. în curs',
    noActiveProjects: 'Niciun proiect activ alocat echipei dvs.',
    loadError: 'Eroare de încărcare: ',
    clientNoProject: 'Niciun proiect nu vă este asociat momentan. Contactați BN CORE GROUP.',
    clientYourProjects: 'Proiectele dvs.',
    noProjectsYet: 'Niciun proiect momentan.',
    statusActive: 'Activ', statusActiveClient: 'În curs', statusClosed: 'Închis',
    exportBtn: 'Export / Printare',
    closeProjectBtn: 'Închide proiectul',
    closeProjectConfirm: 'Închideți acest proiect? Clientul va putea apoi lăsa o evaluare de satisfacție.',
    tabProgress: 'Progres', tabJournal: 'Jurnal', tabProblems: 'Probleme',
    tabHours: 'Ore', tabMyRequests: 'Cererile mele', tabRequests: 'Cereri',
    projectNotFound: 'Proiect negăsit.',
    closedOnClientThanks: (date) => `Proiect închis pe ${date}. Vă mulțumim pentru evaluare: `,
    closedOnAdmin: (date) => `Proiect închis pe ${date} de `,
    awaitingClientFeedback: 'În așteptarea evaluării clientului.',
    clientFeedback: 'Evaluare client: ',
    feedbackPromptTitle: 'Proiect închis — părerea dvs. ne interesează',
    ratingLabel: 'Notă',
    rating5: '★★★★★ Excelent', rating4: '★★★★☆ Foarte bine', rating3: '★★★☆☆ Satisfăcător',
    rating2: '★★☆☆☆ Nesatisfăcător', rating1: '★☆☆☆☆ Slab',
    commentLabelOptional: 'Comentariu (opțional)',
    sendFeedbackBtn: 'Trimite evaluarea',
    stepsCompleted: (done, total) => `${done} / ${total} etape finalizate`,
    noStepsDefined: 'Nicio etapă definită.',
    completedByOn: (by, date) => `Finalizat de ${by} pe ${date}`,
    stepNotePrompt: 'Notă pentru această etapă (opțional):',
    journalPlaceholder: 'Actualizare șantier…',
    photosOptionalLabel: 'Fotografii (opțional)',
    visibleToClientLabel: 'Vizibil pentru client',
    publishBtn: 'Publică', publishing: 'Se publică…', sendingPhotos: 'Se trimit fotografiile…',
    noEntriesYet: 'Nicio intrare momentan.',
    internalBadge: 'Intern',
    sendErrorPrefix: 'Eroare la trimitere: ',
    problemTitleLabel: 'Titlu',
    stepConcernedLabel: 'Etapă vizată (opțional)',
    noSpecificStep: 'Nicio etapă specifică',
    descriptionLabel: 'Descriere',
    reportBtn: 'Semnalează', reporting: 'Se semnalează…',
    noProblemsReported: 'Nicio problemă semnalată.',
    stepConcernedInline: (label) => ` · Etapă vizată: ${label}`,
    problemStatusReported: 'Semnalat', problemStatusPublished: 'Comunicat', problemStatusResolved: 'Rezolvat',
    clockInBtn: 'Pontaj sosire', clockOutBtn: 'Pontaj plecare',
    ongoingSince: (date) => `În desfășurare din ${date}`,
    ongoingBadge: 'în desfășurare', onSiteBadge: 'La fața locului',
    lastClockOut: (date) => `Ultima plecare: ${date}`,
    noClockYet: 'Niciun pontaj încă',
    today: 'Astăzi', last7days: 'Ultimele 7 zile',
    colArrival: 'Sosire', colDeparture: 'Plecare', colDuration: 'Durată',
    noTimesheetRows: 'Niciun pontaj.',
    clockNoteLabel: 'Observație (opțional)',
    clockNotePlaceholder: 'Ex: întârziere din cauza traficului, echipament lipsă…',
    confirmBtn: 'Confirmă', cancelBtn: 'Anulează',
    noOneAssignedDay: 'Nimeni alocat în această zi.',
    youMarker: '(dvs.)',
    containerSerialLabel: 'Număr de serie container (opțional)',
    containerSerialPlaceholder: 'Ex: MSKU1234567',
    containerBadge: (serial) => `Container ${serial}`,
    mileageTitle: 'Kilometraj',
    mileageKmLabel: 'Distanța de azi, dus-întors de acasă (km)',
    mileageVehicleLabel: 'Vehicul',
    mileageVehicleCar: 'Mașină', mileageVehicleTruck: 'Camion',
    mileageSaveBtn: 'Salvează', mileageSaving: 'Se salvează…',
    mileageColDate: 'Data', mileageColKm: 'Km', mileageColVehicle: 'Vehicul',
    mileageNoRows: 'Nicio deplasare înregistrată.',
    mileageMonthTotal: (km) => `Total luna aceasta: ${km} km`,
    mileageColPerson: 'Persoană', mileageColTotal: 'Total km',
    backToCalendar: 'Înapoi la calendar',
    withTeammate: (name) => `cu ${name}`,
    yourRequestLabel: 'Cererea dvs.', sendBtn: 'Trimite',
    noRequests: 'Nicio cerere.',
    requestOpen: 'Deschisă', requestAnswered: 'Răspuns',
    responseLabel: 'Răspuns: ',
    popupBlocked: 'Browserul dvs. a blocat deschiderea raportului. Permiteți ferestrele pop-up pentru acest site și încercați din nou.',
    reportTitlePrefix: 'Raport — ',
    reportHeadingPrefix: 'Raport de șantier — ',
    printSaveBtn: 'Printare / Salvare ca PDF',
    documentGeneratedOn: (date) => `Document generat pe ${date}`,
    reportCompletedOn: (date) => ` — finalizat pe ${date}`,
    feedbackHeading: 'Evaluare client',
  },
};

const PROJECT_COLORS = [
  { name: 'Or', value: '#a8763a' },
  { name: 'Bleu ardoise', value: '#3d5a80' },
  { name: 'Sauge', value: '#5f7a52' },
  { name: 'Terracotta', value: '#b5533c' },
  { name: 'Prune', value: '#6b4c6b' },
  { name: 'Bleu canard', value: '#2f6f6f' },
  { name: 'Rouille', value: '#8a5a2b' },
  { name: 'Bleu nuit', value: '#2e3d5c' },
];
const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].value;

// ---- Utilitaires ----
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function tsMillis(ts) {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}
function fmtDuration(ms) {
  if (ms == null) return '—';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// ---- Pointage : reconstitue les créneaux (arrivée→départ) et leur durée ----
function computeShifts(entries) {
  const sorted = entries.slice().sort((a, b) => tsMillis(a.timestamp) - tsMillis(b.timestamp));
  const shifts = [];
  let openIn = null;
  for (const e of sorted) {
    if (e.type === 'in') {
      if (openIn) shifts.push({ in: openIn, out: null, ms: null, ongoing: false, incomplete: true });
      openIn = e;
    } else if (e.type === 'out') {
      if (openIn) {
        shifts.push({ in: openIn, out: e, ms: tsMillis(e.timestamp) - tsMillis(openIn.timestamp) });
        openIn = null;
      } else {
        shifts.push({ in: null, out: e, ms: null, incomplete: true });
      }
    }
  }
  if (openIn) shifts.push({ in: openIn, out: null, ms: null, ongoing: true });
  return shifts.reverse(); // le plus récent en premier
}
function sumShiftMs(shifts, sinceMs) {
  return shifts.filter(s => s.ms != null && (!sinceMs || tsMillis(s.in.timestamp) >= sinceMs))
    .reduce((sum, s) => sum + s.ms, 0);
}

// ---- Photos : redimensionnement côté client puis envoi vers Firebase Storage ----
function resizeImageFile(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Échec de conversion de l\'image')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}
// Position GPS au pointage — best-effort : ne bloque jamais l'enregistrement
// si le navigateur refuse ou n'a pas de position (retourne simplement null).
function getGeoLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
function geoLinkHtml(geo) {
  if (!geo) return '';
  return ` <a href="https://www.google.com/maps?q=${geo.lat},${geo.lng}" target="_blank" rel="noopener" title="Position au pointage">📍</a>`;
}
async function uploadPhotos(basePath, files) {
  const urls = [];
  for (const file of files) {
    const blob = await resizeImageFile(file);
    const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    const ref = storage.ref(basePath + '/' + filename);
    await ref.put(blob, { contentType: 'image/jpeg' });
    urls.push(await ref.getDownloadURL());
  }
  return urls;
}
function photoGalleryHtml(urls) {
  if (!urls || urls.length === 0) return '';
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
    ${urls.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--border)"></a>`).join('')}
  </div>`;
}
// ---- Calendrier de planning ----
function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || fullName;
}
function dateStrOf(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function fmtDateStr(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
function fmtDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(LOCALE_MAP[getLang()], { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function monthGridHtml(year, month, assignmentsByDate) {
  const locale = LOCALE_MAP[getLang()];
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  // Lundi 2024-01-01 comme point de repère pour générer les 7 noms de jour
  // courts dans la bonne langue, plutôt que de les traduire à la main.
  const weekdayLabels = [1, 2, 3, 4, 5, 6, 7].map(d => new Date(2024, 0, d).toLocaleDateString(locale, { weekday: 'short' }));
  let cells = '';
  for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell cal-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = dateStrOf(year, month, d);
    const items = assignmentsByDate[dateStr] || [];
    cells += `<div class="cal-cell" data-date="${dateStr}">
      <div class="cal-daynum">${d}</div>
      ${items.map(a => `<div class="cal-chip" style="background:${esc(a.projectColor || DEFAULT_PROJECT_COLOR)}" title="${esc(a.personName)} — ${esc(a.projectName)}">${esc(firstName(a.personName))}</div>`).join('')}
    </div>`;
  }
  return `
    <div class="cal-header">
      <button type="button" class="btn btn-outline btn-sm" id="cal-prev">←</button>
      <h3 style="text-transform:capitalize">${esc(monthLabel)}</h3>
      <button type="button" class="btn btn-outline btn-sm" id="cal-next">→</button>
    </div>
    <div class="cal-grid cal-weekdays">${weekdayLabels.map(w => `<div class="cal-cell cal-weekday">${w}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>`;
}
function colorSwatchesHtml(inputId, selected) {
  const sel = selected || DEFAULT_PROJECT_COLOR;
  return `<div id="${inputId}-swatches" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      ${PROJECT_COLORS.map(c => `<span class="color-swatch ${c.value === sel ? 'selected' : ''}" data-color="${c.value}" title="${esc(c.name)}" style="background:${c.value}"></span>`).join('')}
    </div>
    <input type="hidden" id="${inputId}" value="${sel}">`;
}
function wireColorSwatches(inputId) {
  const wrap = document.getElementById(inputId + '-swatches');
  const input = document.getElementById(inputId);
  wrap.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      wrap.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      input.value = sw.dataset.color;
    });
  });
}

function showError(container, message) {
  const box = document.createElement('div');
  box.className = 'error-box';
  box.textContent = message;
  container.prepend(box);
}

// ---- État global ----
let currentUser = null;   // Firebase Auth user
let currentPerson = null; // Firestore doc: { name, role, teamId, clientId }
let unsubscribers = [];   // onSnapshot cleanups for the active view

function clearSubscriptions() {
  unsubscribers.forEach(u => u());
  unsubscribers = [];
}

// ============================================================
// AUTHENTIFICATION
// ============================================================

function renderLogin(errorMsg) {
  clearSubscriptions();
  app.innerHTML = `
    <div class="center-wrap">
      <div style="text-align:center;margin-bottom:24px">
        <div style="margin-bottom:10px">${langSwitcherHtml()}</div>
        <h1 style="font-size:1.6rem">${esc(t('appTitle'))}</h1>
        <p style="color:var(--text-dim);font-size:0.9rem">${esc(t('appSubtitle'))}</p>
      </div>
      <div class="card">
        ${errorMsg ? `<div class="error-box">${esc(errorMsg)}</div>` : ''}
        <form id="login-form">
          <div class="field">
            <label for="login-email">${esc(t('emailLabel'))}</label>
            <input type="email" id="login-email" required autocomplete="username">
          </div>
          <div class="field">
            <label for="login-password">${esc(t('passwordLabel'))}</label>
            <input type="password" id="login-password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary btn-block">${esc(t('loginBtn'))}</button>
        </form>
        <p style="margin-top:16px;font-size:0.82rem;color:var(--text-mute);text-align:center">
          ${esc(t('noAccount'))}
        </p>
      </div>
    </div>`;
  wireLangSwitcher();

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = t('loggingIn');
    try {
      await auth.signInWithEmailAndPassword(email, password);
      // onAuthStateChanged takes over from here
    } catch (err) {
      renderLogin(translateAuthError(err));
    }
  });
}

function renderSignup(code) {
  clearSubscriptions();
  app.innerHTML = `<div class="center-wrap"><div class="loading">${esc(t('verifyingInvite'))}</div></div>`;
  db.collection('invites').doc(code).get().then(snap => {
    if (!snap.exists || snap.data().used) {
      app.innerHTML = `<div class="center-wrap"><div class="card error-box">
        ${esc(t('inviteInvalid'))}
      </div></div>`;
      return;
    }
    const invite = snap.data();
    app.innerHTML = `
      <div class="center-wrap">
        <div style="text-align:center;margin-bottom:24px">
          <div style="margin-bottom:10px">${langSwitcherHtml()}</div>
          <h1 style="font-size:1.6rem">${esc(t('appTitle'))}</h1>
          <p style="color:var(--text-dim);font-size:0.9rem">${esc(t('createAccessFor'))} — ${esc(roleLabel(invite.role))}</p>
        </div>
        <div class="card">
          <form id="signup-form">
            <div class="field"><label>${esc(t('fullNameLabel'))}</label><input type="text" id="su-name" required value="${esc(invite.suggestedName || '')}"></div>
            <div class="field"><label>${esc(t('emailLabel'))}</label><input type="email" id="su-email" required autocomplete="username"></div>
            <div class="field"><label>${esc(t('passwordLabel'))}</label><input type="password" id="su-password" required minlength="6" autocomplete="new-password"></div>
            <button type="submit" class="btn btn-primary btn-block">${esc(t('createAccountBtn'))}</button>
          </form>
        </div>
      </div>`;
    wireLangSwitcher();

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('su-name').value.trim();
      const email = document.getElementById('su-email').value.trim();
      const password = document.getElementById('su-password').value;
      const form = e.target;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = t('creatingAccount');
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('people').doc(cred.user.uid).set({
          name, role: invite.role, teamId: invite.teamId || null, clientId: invite.clientId || null,
          revoked: false, inviteCode: code,
        });
        await db.collection('invites').doc(code).update({
          used: true, usedBy: cred.user.uid, usedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        history.replaceState(null, '', location.pathname + location.search);
        await loadPersonAndRoute(cred.user);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = t('createAccountBtn');
        showError(form, translateSignupError(err));
      }
    });
  }).catch(err => {
    app.innerHTML = `<div class="center-wrap"><div class="card error-box">${esc(t('errorPrefix'))}${esc(err.message)}</div></div>`;
  });
}

function translateSignupError(err) {
  const map = {
    'auth/email-already-in-use': t('signupErrEmailInUse'),
    'auth/invalid-email': t('signupErrInvalidEmail'),
    'auth/weak-password': t('signupErrWeakPassword'),
  };
  return map[err.code] || (t('errorPrefix') + err.message);
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function inviteLinkFor(code) {
  return location.origin + location.pathname + '#invite/' + code;
}

function translateAuthError(err) {
  const map = {
    'auth/invalid-email': t('authErrInvalidEmail'),
    'auth/user-disabled': t('authErrUserDisabled'),
    'auth/user-not-found': t('authErrUserNotFound'),
    'auth/wrong-password': t('authErrWrongPassword'),
    'auth/invalid-credential': t('authErrInvalidCredential'),
    'auth/too-many-requests': t('authErrTooManyRequests'),
  };
  return map[err.code] || (t('authErrPrefix') + err.message);
}

async function logout() {
  clearSubscriptions();
  await auth.signOut();
}

function checkInviteHash() {
  const m = location.hash.match(/^#invite\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function loadPersonAndRoute(user) {
  clearSubscriptions();
  currentUser = user;
  app.innerHTML = `<div class="loading">${esc(t('loadingProfile'))}</div>`;
  try {
    const snap = await db.collection('people').doc(user.uid).get();
    if (!snap.exists) {
      app.innerHTML = `<div class="center-wrap"><div class="card">
        <h2>${esc(t('notConfiguredTitle'))}</h2>
        <p style="margin-top:12px;color:var(--text-dim)">${esc(t('notConfiguredBody'))}</p>
        <button class="btn btn-outline" style="margin-top:16px" onclick="logout()">${esc(t('disconnect'))}</button>
      </div></div>`;
      return;
    }
    const person = { id: user.uid, ...snap.data() };
    if (person.revoked) {
      app.innerHTML = `<div class="center-wrap"><div class="card">
        <h2>${esc(t('revokedTitle'))}</h2>
        <p style="margin-top:12px;color:var(--text-dim)">${esc(t('revokedBody'))}</p>
        <button class="btn btn-outline" style="margin-top:16px" onclick="logout()">${esc(t('disconnect'))}</button>
      </div></div>`;
      return;
    }
    currentPerson = person;
    routeByRole();
  } catch (err) {
    app.innerHTML = `<div class="center-wrap"><div class="card error-box">${esc(t('loadError'))}${esc(err.message)}</div></div>`;
  }
}

auth.onAuthStateChanged((user) => {
  clearSubscriptions();
  const inviteCode = checkInviteHash();
  if (!user) {
    currentUser = null;
    currentPerson = null;
    if (inviteCode) renderSignup(inviteCode);
    else renderLogin();
    return;
  }
  if (inviteCode) history.replaceState(null, '', location.pathname + location.search);
  loadPersonAndRoute(user);
});

window.addEventListener('hashchange', () => {
  if (auth.currentUser) return; // an existing session ignores stray invite links in the address bar
  const inviteCode = checkInviteHash();
  if (inviteCode) renderSignup(inviteCode);
  else renderLogin();
});

function routeByRole() {
  if (!currentPerson) return renderLogin();
  if (currentPerson.role === 'admin') return renderAdmin();
  if (['engineer', 'electrician', 'worker'].includes(currentPerson.role)) return renderStaff();
  if (currentPerson.role === 'client') return renderClient();
  app.innerHTML = `<div class="center-wrap"><div class="card error-box">Rôle inconnu : ${esc(currentPerson.role)}</div></div>`;
}

function topbarHtml(extra) {
  return `
    <div class="topbar">
      <div class="brand">BN CORE GROUP — Chantier</div>
      <div class="who">
        <span>${esc(currentPerson.name)} · ${esc(roleLabel(currentPerson.role))}</span>
        ${langSwitcherHtml()}
        ${extra || ''}
        <button onclick="logout()">${esc(t('disconnect'))}</button>
      </div>
    </div>`;
}

// ============================================================
// VUE ADMIN
// ============================================================

let adminTab = 'projects';

async function renderAdmin() {
  clearSubscriptions();
  app.innerHTML = topbarHtml() + `<div class="wrap" id="admin-wrap"></div>`;
  wireLangSwitcher();
  renderAdminTabs();
}

function renderAdminTabs() {
  clearSubscriptions();
  const wrap = document.getElementById('admin-wrap');
  const tabs = [
    ['projects', 'Projets'],
    ['calendar', 'Calendrier'],
    ['problems', 'Problèmes à valider'],
    ['requests', 'Demandes clients'],
    ['teams', 'Équipes'],
    ['clients', 'Clients'],
    ['people', 'Comptes'],
  ];
  wrap.innerHTML = `
    <div class="tabs">
      ${tabs.map(([key, label]) => `<button class="tab ${adminTab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`).join('')}
    </div>
    <div id="admin-tab-content"><div class="loading">Chargement…</div></div>`;

  wrap.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      adminTab = btn.dataset.tab;
      renderAdminTabs();
    });
  });

  const content = document.getElementById('admin-tab-content');
  if (adminTab === 'projects') renderAdminProjects(content);
  else if (adminTab === 'calendar') renderAdminCalendar(content);
  else if (adminTab === 'problems') renderAdminProblems(content);
  else if (adminTab === 'requests') renderAdminRequests(content);
  else if (adminTab === 'teams') renderAdminTeams(content);
  else if (adminTab === 'clients') renderAdminClients(content);
  else if (adminTab === 'people') renderAdminPeople(content);
}

// ---- Admin: Projets ----
function renderAdminProjects(content) {
  const unsub = db.collection('projects').orderBy('createdAt', 'desc').onSnapshot(async (snap) => {
    const [teamsSnap, clientsSnap] = await Promise.all([db.collection('teams').get(), db.collection('clients').get()]);
    const teams = Object.fromEntries(teamsSnap.docs.map(d => [d.id, d.data()]));
    const clients = Object.fromEntries(clientsSnap.docs.map(d => [d.id, d.data()]));

    content.innerHTML = `
      <button class="btn btn-primary" id="new-project-btn" style="margin-bottom:18px">+ Nouveau projet</button>
      <div id="project-list">
        ${snap.empty ? '<p class="empty">Aucun projet pour le moment.</p>' : snap.docs.map(d => {
          const p = d.data();
          return `<div class="card project-card" data-project="${d.id}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3><span class="color-swatch" style="width:14px;height:14px;border-radius:4px;vertical-align:middle;margin-right:8px;background:${esc(p.color || DEFAULT_PROJECT_COLOR)}"></span>${esc(p.name)}</h3>
              <span class="badge badge-${p.status}">${p.status === 'active' ? 'Actif' : 'Clôturé'}</span>
            </div>
            <p class="empty" style="margin-top:4px;font-style:normal">
              ${PROJECT_TYPE_LABELS[p.type] || p.type} · Équipe : ${esc(teams[p.teamId]?.name || '—')} · Client : ${esc(clients[p.clientId]?.name || '—')}
            </p>
          </div>`;
        }).join('')}
      </div>`;

    document.getElementById('new-project-btn').addEventListener('click', () => openNewProjectForm(teams, clients));
    content.querySelectorAll('[data-project]').forEach(el => {
      el.addEventListener('click', () => renderAdminProjectDetail(el.dataset.project));
    });
  }, err => showError(content, "Erreur de chargement des projets : " + err.message));
  unsubscribers.push(unsub);
}

function openNewProjectForm(teams, clients) {
  const teamOptions = Object.entries(teams).map(([id, t]) => `<option value="${id}">${esc(t.name)}</option>`).join('');
  const clientOptions = Object.entries(clients).map(([id, c]) => `<option value="${id}">${esc(c.name)}</option>`).join('');
  const overlay = document.createElement('div');
  overlay.className = 'card';
  overlay.style.marginBottom = '18px';
  overlay.innerHTML = `
    <h3>Nouveau projet</h3>
    <form id="new-project-form" style="margin-top:12px">
      <div class="field"><label>Nom du projet</label><input type="text" id="np-name" required placeholder="Ex. : Commissioning BESS — Site Wemmel"></div>
      <div class="row">
        <div class="field"><label>Type</label>
          <select id="np-type">
            ${Object.entries(PROJECT_TYPE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Équipe</label><select id="np-team" required>${teamOptions || '<option value="">Aucune équipe créée</option>'}</select></div>
        <div class="field"><label>Client</label><select id="np-client" required>${clientOptions || '<option value="">Aucun client créé</option>'}</select></div>
      </div>
      <div class="field"><label>Couleur (pour le calendrier)</label>${colorSwatchesHtml('np-color')}</div>
      <button type="submit" class="btn btn-primary">Créer le projet</button>
      <button type="button" class="btn btn-outline" id="np-cancel">Annuler</button>
    </form>`;
  document.getElementById('project-list').before(overlay);
  wireColorSwatches('np-color');

  document.getElementById('np-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('new-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('np-name').value.trim();
    const type = document.getElementById('np-type').value;
    const teamId = document.getElementById('np-team').value;
    const clientId = document.getElementById('np-client').value;
    const color = document.getElementById('np-color').value;
    if (!teamId || !clientId) { showError(overlay, "Créez d'abord au moins une équipe et un client."); return; }
    try {
      const projectRef = await db.collection('projects').add({
        name, type, teamId, clientId, color, status: 'active', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      // Les étapes ne stockent qu'un index — le texte se traduit à l'affichage
      // (checklistStepLabel) selon la langue de la personne qui regarde.
      const stepCount = (CHECKLIST_TEMPLATES.fr[type] || []).length;
      const batch = db.batch();
      for (let i = 0; i < stepCount; i++) {
        const stepRef = projectRef.collection('checklist').doc();
        batch.set(stepRef, { stepIndex: i, order: i, done: false, doneBy: null, doneAt: null, note: '' });
      }
      await batch.commit();
      overlay.remove();
    } catch (err) {
      showError(overlay, "Erreur : " + err.message);
    }
  });
}

// ---- Admin: Calendrier (planning) ----
let calRefDate = new Date();

function renderAdminCalendar(content) {
  const year = calRefDate.getFullYear(), month = calRefDate.getMonth();
  const startStr = dateStrOf(year, month, 1);
  const endStr = dateStrOf(year, month, new Date(year, month + 1, 0).getDate());

  content.innerHTML = '<div class="loading">Chargement…</div>';
  Promise.all([
    db.collection('assignments').where('date', '>=', startStr).where('date', '<=', endStr).get(),
    db.collection('people').where('role', 'in', ['engineer', 'electrician', 'worker']).get(),
    db.collection('projects').where('status', '==', 'active').get(),
  ]).then(([assignSnap, peopleSnap, projectsSnap]) => {
    const byDate = {};
    assignSnap.docs.forEach(d => {
      const a = d.data();
      (byDate[a.date] ||= []).push({ id: d.id, ...a });
    });
    const people = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    content.innerHTML = `<div class="card">${monthGridHtml(year, month, byDate)}</div><div id="cal-day-detail"></div>`;

    document.getElementById('cal-prev').addEventListener('click', () => {
      calRefDate = new Date(year, month - 1, 1);
      renderAdminCalendar(content);
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      calRefDate = new Date(year, month + 1, 1);
      renderAdminCalendar(content);
    });
    content.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => renderCalDayDetail(cell.dataset.date, byDate[cell.dataset.date] || [], people, projects, content));
    });
  }).catch(err => showError(content, "Erreur : " + err.message));
}

function renderCalDayDetail(dateStr, items, people, projects, parentContent) {
  const detail = document.getElementById('cal-day-detail');
  const peopleOptions = people.map(p => `<option value="${p.id}" data-name="${esc(p.name)}" data-team="${esc(p.teamId || '')}">${esc(p.name)}</option>`).join('');
  const projectOptions = projects.map(p => `<option value="${p.id}" data-name="${esc(p.name)}" data-color="${esc(p.color || DEFAULT_PROJECT_COLOR)}">${esc(p.name)}</option>`).join('');
  detail.innerHTML = `
    <div class="card">
      <h3>${fmtDateLabel(dateStr)}</h3>
      <div style="margin-top:10px">
        ${items.length === 0 ? '<p class="empty">Personne d\'assigné ce jour-là.</p>' : items.map(a => `
          <div class="list-row">
            <div class="main"><span class="badge" style="background:${esc(a.projectColor || DEFAULT_PROJECT_COLOR)};color:#fff">${esc(a.projectName)}</span> ${esc(a.personName)}</div>
            <div class="actions"><button class="btn btn-danger btn-sm" data-del-assign="${a.id}">Retirer</button></div>
          </div>`).join('')}
      </div>
      <form id="assign-form" style="margin-top:14px">
        <div class="row">
          <div class="field"><label>Personne</label><select id="assign-person" required>${peopleOptions || '<option value="">Aucun compte actif</option>'}</select></div>
          <div class="field"><label>Chantier</label><select id="assign-project" required>${projectOptions || '<option value="">Aucun projet actif</option>'}</select></div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Assigner ce jour</button>
      </form>
    </div>`;

  detail.querySelectorAll('[data-del-assign]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.collection('assignments').doc(btn.dataset.delAssign).delete();
      renderAdminCalendar(parentContent);
    });
  });

  const form = document.getElementById('assign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const personSel = document.getElementById('assign-person');
    const projectSel = document.getElementById('assign-project');
    if (!personSel.value || !projectSel.value) return;
    await db.collection('assignments').add({
      personUid: personSel.value,
      personName: personSel.selectedOptions[0].dataset.name,
      teamId: personSel.selectedOptions[0].dataset.team || null,
      projectId: projectSel.value,
      projectName: projectSel.selectedOptions[0].dataset.name,
      projectColor: projectSel.selectedOptions[0].dataset.color,
      date: dateStr,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    renderAdminCalendar(parentContent);
  });
}

async function renderAdminProjectDetail(projectId) {
  clearSubscriptions();
  const wrap = document.getElementById('admin-wrap');
  wrap.innerHTML = `<a href="#" class="back-link" id="back-to-projects">← Retour aux projets</a><div id="project-detail"><div class="loading">Chargement…</div></div>`;
  document.getElementById('back-to-projects').addEventListener('click', (e) => { e.preventDefault(); renderAdminTabs(); });
  renderProjectDetailShared(document.getElementById('project-detail'), projectId, 'admin');
}

// ---- Admin: Équipes ----
function renderAdminTeams(content) {
  const unsub = db.collection('teams').orderBy('name').onSnapshot(snap => {
    content.innerHTML = `
      <div class="card">
        <h3>Ajouter une équipe</h3>
        <form id="new-team-form" class="row" style="margin-top:10px;align-items:flex-end">
          <div class="field"><label>Nom de l'équipe</label><input type="text" id="nt-name" required placeholder="Ex. : Équipe Wemmel"></div>
          <button type="submit" class="btn btn-primary" style="flex:0">Ajouter</button>
        </form>
      </div>
      <div class="card">
        ${snap.empty ? '<p class="empty">Aucune équipe créée.</p>' : snap.docs.map(d => `
          <div class="list-row">
            <div class="main"><div class="name">${esc(d.data().name)}</div></div>
            <div class="actions"><button class="btn btn-danger btn-sm" data-del-team="${d.id}">Supprimer</button></div>
          </div>`).join('')}
      </div>`;
    document.getElementById('new-team-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('nt-name').value.trim();
      if (!name) return;
      await db.collection('teams').add({ name });
      e.target.reset();
    });
    content.querySelectorAll('[data-del-team]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm("Supprimer cette équipe ? Les projets déjà liés garderont la référence.")) {
          await db.collection('teams').doc(btn.dataset.delTeam).delete();
        }
      });
    });
  }, err => showError(content, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

// ---- Admin: Clients ----
function renderAdminClients(content) {
  const unsub = db.collection('clients').orderBy('name').onSnapshot(snap => {
    content.innerHTML = `
      <div class="card">
        <h3>Ajouter un client</h3>
        <form id="new-client-form" class="row" style="margin-top:10px;align-items:flex-end">
          <div class="field"><label>Nom du contact</label><input type="text" id="nc-name" required placeholder="Ex. : Jean Dupont"></div>
          <div class="field"><label>Société</label><input type="text" id="nc-company" placeholder="Ex. : Nom de la société"></div>
          <button type="submit" class="btn btn-primary" style="flex:0">Ajouter</button>
        </form>
      </div>
      <div class="card">
        ${snap.empty ? '<p class="empty">Aucun client créé.</p>' : snap.docs.map(d => `
          <div class="list-row">
            <div class="main"><div class="name">${esc(d.data().name)}</div><div class="sub">${esc(d.data().company || '')}</div></div>
            <div class="actions"><button class="btn btn-danger btn-sm" data-del-client="${d.id}">Supprimer</button></div>
          </div>`).join('')}
      </div>`;
    document.getElementById('new-client-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('nc-name').value.trim();
      const company = document.getElementById('nc-company').value.trim();
      if (!name) return;
      await db.collection('clients').add({ name, company });
      e.target.reset();
    });
    content.querySelectorAll('[data-del-client]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm("Supprimer ce client ?")) await db.collection('clients').doc(btn.dataset.delClient).delete();
      });
    });
  }, err => showError(content, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

// ---- Admin: Comptes (people) ----
function renderAdminPeople(content) {
  content.innerHTML = '<div class="loading">Chargement…</div>';
  Promise.all([db.collection('teams').get(), db.collection('clients').get()]).then(([teamsSnap, clientsSnap]) => {
    const teams = Object.fromEntries(teamsSnap.docs.map(d => [d.id, d.data()]));
    const clients = Object.fromEntries(clientsSnap.docs.map(d => [d.id, d.data()]));
    const teamOptions = Object.entries(teams).map(([id, t]) => `<option value="${id}">${esc(t.name)}</option>`).join('');
    const clientOptions = Object.entries(clients).map(([id, c]) => `<option value="${id}">${esc(c.name)}</option>`).join('');
    const staffRoles = ['engineer', 'electrician', 'worker'];

    content.innerHTML = `
      <div class="card">
        <h3>Inviter une nouvelle personne</h3>
        <p class="empty" style="font-style:normal;margin:4px 0 12px">
          Générez un lien, envoyez-le par WhatsApp ou email — la personne crée elle-même son compte
          (nom, email, mot de passe) en l'ouvrant. Vous gardez le contrôle : vous pouvez retirer son
          accès à tout moment ci-dessous.
        </p>
        <form id="new-invite-form">
          <div class="row">
            <div class="field"><label>Rôle</label>
              <select id="inv-role">
                ${Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
              </select>
            </div>
            <div class="field" id="inv-team-field"><label>Équipe</label><select id="inv-team">${teamOptions || '<option value="">Créez d\'abord une équipe</option>'}</select></div>
            <div class="field" id="inv-client-field" style="display:none"><label>Client</label><select id="inv-client">${clientOptions || '<option value="">Créez d\'abord un client</option>'}</select></div>
          </div>
          <div class="field"><label>Nom suggéré (optionnel)</label><input type="text" id="inv-name" placeholder="Pré-remplit le formulaire de la personne"></div>
          <button type="submit" class="btn btn-primary">Générer le lien d'invitation</button>
        </form>
        <div id="invite-result"></div>
      </div>
      <div class="card">
        <h3>Invitations en attente</h3>
        <div id="pending-invites"><p class="empty">Chargement…</p></div>
      </div>
      <div class="card">
        <h3>Comptes actifs</h3>
        <div id="people-list"><p class="empty">Chargement…</p></div>
      </div>`;

    const roleSelect = document.getElementById('inv-role');
    const toggleFields = () => {
      const isClient = roleSelect.value === 'client';
      document.getElementById('inv-team-field').style.display = isClient ? 'none' : '';
      document.getElementById('inv-client-field').style.display = isClient ? '' : 'none';
    };
    roleSelect.addEventListener('change', toggleFields);
    toggleFields();

    document.getElementById('new-invite-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = roleSelect.value;
      const teamId = document.getElementById('inv-team').value || null;
      const clientId = document.getElementById('inv-client').value || null;
      const suggestedName = document.getElementById('inv-name').value.trim();
      if (role !== 'client' && !teamId) { showError(content, "Créez d'abord au moins une équipe."); return; }
      if (role === 'client' && !clientId) { showError(content, "Créez d'abord au moins un client."); return; }
      const code = generateInviteCode();
      await db.collection('invites').doc(code).set({
        role, teamId: role === 'client' ? null : teamId, clientId: role === 'client' ? clientId : null,
        suggestedName, used: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: currentPerson.name,
      });
      const link = inviteLinkFor(code);
      const resultBox = document.getElementById('invite-result');
      resultBox.innerHTML = `
        <div class="note-box" style="margin-top:14px">
          <b>Lien généré — envoyez-le à la personne :</b><br>
          <input type="text" readonly value="${esc(link)}" style="width:100%;margin-top:8px;padding:8px;border:1px solid var(--border);border-radius:6px" onclick="this.select()">
          <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px" id="copy-invite-link">Copier le lien</button>
        </div>`;
      document.getElementById('copy-invite-link').addEventListener('click', () => {
        navigator.clipboard.writeText(link).then(() => {
          document.getElementById('copy-invite-link').textContent = 'Copié !';
        });
      });
      e.target.reset();
      toggleFields();
    });

    renderPendingInvites(document.getElementById('pending-invites'), teams, clients);
    renderPeopleList(document.getElementById('people-list'), teams, clients);
  }).catch(err => showError(content, "Erreur : " + err.message));
}

function renderPendingInvites(target, teams, clients) {
  const unsub = db.collection('invites').where('used', '==', false).onSnapshot(snap => {
    target.innerHTML = snap.empty ? '<p class="empty">Aucune invitation en attente.</p>' : snap.docs.map(d => {
      const inv = d.data();
      const context = inv.role === 'client' ? (clients[inv.clientId]?.name || '—') : (teams[inv.teamId]?.name || '—');
      return `<div class="list-row">
        <div class="main">
          <div class="name">${esc(inv.suggestedName || '(sans nom)')} · ${ROLE_LABELS[inv.role] || inv.role}</div>
          <div class="sub">${esc(context)} · lien : <code>${esc(inviteLinkFor(d.id))}</code></div>
        </div>
        <div class="actions"><button class="btn btn-danger btn-sm" data-del-invite="${d.id}">Annuler</button></div>
      </div>`;
    }).join('');
    target.querySelectorAll('[data-del-invite]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await db.collection('invites').doc(btn.dataset.delInvite).delete();
      });
    });
  }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderPeopleList(target, teams, clients) {
  const unsub = db.collection('people').onSnapshot(snap => {
    target.innerHTML = snap.empty ? '<p class="empty">Aucun compte actif pour le moment.</p>' : snap.docs.map(d => {
      const p = d.data();
      const context = p.role === 'client' ? (clients[p.clientId]?.name || '—') : (teams[p.teamId]?.name || '—');
      return `<div class="list-row">
        <div class="main">
          <div class="name">${esc(p.name)} ${p.revoked ? '<span class="badge badge-closed">Accès révoqué</span>' : ''}</div>
          <div class="sub">${ROLE_LABELS[p.role] || p.role} · ${esc(context)}</div>
        </div>
        <div class="actions">
          ${p.revoked
            ? `<button class="btn btn-outline btn-sm" data-reactivate="${d.id}">Réactiver l'accès</button>`
            : `<button class="btn btn-danger btn-sm" data-revoke="${d.id}">Retirer l'accès</button>`}
        </div>
      </div>`;
    }).join('');
    target.querySelectorAll('[data-revoke]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm("Retirer l'accès de cette personne ? Elle ne pourra plus se connecter ni voir aucune donnée, mais son historique est conservé.")) {
          await db.collection('people').doc(btn.dataset.revoke).update({ revoked: true });
        }
      });
    });
    target.querySelectorAll('[data-reactivate]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await db.collection('people').doc(btn.dataset.reactivate).update({ revoked: false });
      });
    });
  }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

// ---- Admin: Problèmes à valider ----
function renderAdminProblems(content) {
  content.innerHTML = '<div class="loading">Chargement…</div>';
  db.collection('projects').get().then(projSnap => {
    const listeners = projSnap.docs.map(projDoc => {
      return db.collection('projects').doc(projDoc.id).collection('problems')
        .where('status', '==', 'reported').onSnapshot(snap => {
          renderProblemsAggregate(content, projSnap.docs);
        }, () => {});
    });
    unsubscribers.push(...listeners);
    renderProblemsAggregate(content, projSnap.docs);
  });
}

async function renderProblemsAggregate(content, projectDocs) {
  const results = await Promise.all(projectDocs.map(async pd => {
    const snap = await db.collection('projects').doc(pd.id).collection('problems').where('status', '==', 'reported').get();
    return snap.docs.map(d => ({ id: d.id, projectId: pd.id, projectName: pd.data().name, ...d.data() }));
  }));
  const problems = results.flat();
  content.innerHTML = problems.length === 0 ? '<p class="empty">Aucun problème en attente de validation.</p>' :
    problems.map(p => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <h3>${esc(p.title)}</h3>
            <p class="empty" style="font-style:normal">${esc(p.projectName)} · signalé par ${esc(p.reportedByName)} le ${fmtDateTime(p.createdAt)}</p>
          </div>
          <span class="badge badge-reported">Signalé</span>
        </div>
        <p style="margin-top:10px">${esc(p.description)}</p>
        ${photoGalleryHtml(p.photoUrls)}
        <div style="margin-top:14px;display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" data-publish="${p.projectId}|${p.id}">Publier au client</button>
          <button class="btn btn-outline btn-sm" data-internal="${p.projectId}|${p.id}">Garder en interne</button>
          <button class="btn btn-danger btn-sm" data-resolve="${p.projectId}|${p.id}">Marquer résolu</button>
        </div>
      </div>`).join('');

  content.querySelectorAll('[data-publish]').forEach(btn => btn.addEventListener('click', async () => {
    const [pid, id] = btn.dataset.publish.split('|');
    await db.collection('projects').doc(pid).collection('problems').doc(id).update({ status: 'published', visibleToClient: true });
  }));
  content.querySelectorAll('[data-internal]').forEach(btn => btn.addEventListener('click', async () => {
    const [pid, id] = btn.dataset.internal.split('|');
    await db.collection('projects').doc(pid).collection('problems').doc(id).update({ visibleToClient: false });
    renderAdminProblems(content);
  }));
  content.querySelectorAll('[data-resolve]').forEach(btn => btn.addEventListener('click', async () => {
    const [pid, id] = btn.dataset.resolve.split('|');
    await db.collection('projects').doc(pid).collection('problems').doc(id).update({ status: 'resolved' });
  }));
}

// ---- Admin: Demandes clients ----
function renderAdminRequests(content) {
  content.innerHTML = '<div class="loading">Chargement…</div>';
  db.collection('projects').get().then(async projSnap => {
    const results = await Promise.all(projSnap.docs.map(async pd => {
      const snap = await db.collection('projects').doc(pd.id).collection('requests').orderBy('createdAt', 'desc').get();
      return snap.docs.map(d => ({ id: d.id, projectId: pd.id, projectName: pd.data().name, ...d.data() }));
    }));
    const requests = results.flat();
    content.innerHTML = requests.length === 0 ? '<p class="empty">Aucune demande client.</p>' :
      requests.map(r => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div><h3>${esc(r.projectName)}</h3><p class="empty" style="font-style:normal">${esc(r.fromName)} · ${fmtDateTime(r.createdAt)}</p></div>
            <span class="badge badge-${r.status}">${r.status === 'open' ? 'Ouverte' : 'Répondu'}</span>
          </div>
          <p style="margin-top:10px">${esc(r.text)}</p>
          ${r.response ? `<div class="note-box" style="margin-top:10px"><b>Votre réponse :</b> ${esc(r.response)}</div>` : `
            <form data-respond="${r.projectId}|${r.id}" style="margin-top:12px">
              <div class="field"><textarea placeholder="Votre réponse…" required></textarea></div>
              <button type="submit" class="btn btn-primary btn-sm">Répondre</button>
            </form>`}
        </div>`).join('');

    content.querySelectorAll('[data-respond]').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const [pid, id] = form.dataset.respond.split('|');
        const response = form.querySelector('textarea').value.trim();
        await db.collection('projects').doc(pid).collection('requests').doc(id).update({
          response, status: 'answered', respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    });
  });
}

// ============================================================
// VUE PERSONNEL (ingénieur / électricien / aide technique)
// ============================================================

let staffTab = 'projects';
let staffCalRefDate = new Date();

async function renderStaff() {
  clearSubscriptions();
  app.innerHTML = topbarHtml() + `
    <div class="wrap">
      <div class="tabs">
        <button class="tab ${staffTab === 'projects' ? 'active' : ''}" data-stab="projects">${esc(t('yourProjects'))}</button>
        <button class="tab ${staffTab === 'calendar' ? 'active' : ''}" data-stab="calendar">${esc(t('yourPlanning'))}</button>
      </div>
      <div id="staff-wrap"><div class="loading">${esc(t('loadingGeneric'))}</div></div>
    </div>`;
  wireLangSwitcher();
  document.querySelectorAll('[data-stab]').forEach(btn => {
    btn.addEventListener('click', () => { staffTab = btn.dataset.stab; renderStaff(); });
  });
  const wrap = document.getElementById('staff-wrap');
  if (staffTab === 'calendar') renderStaffCalendar(wrap);
  else renderStaffProjectsList(wrap);
}

function renderStaffProjectsList(wrap) {
  if (!currentPerson.teamId) {
    wrap.innerHTML = `<p class="empty">${esc(t('noTeamAssigned'))}</p>`;
    return;
  }
  const unsub = db.collection('projects').where('teamId', '==', currentPerson.teamId).where('status', '==', 'active')
    .onSnapshot(snap => {
      wrap.innerHTML = `
        <h2 class="section-title">${esc(t('activeProjectsTitle'))}</h2>
        ${snap.empty ? `<p class="empty">${esc(t('noActiveProjects'))}</p>` : snap.docs.map(d => `
          <div class="card project-card" data-project="${d.id}">
            <h3>${esc(d.data().name)}</h3>
            <p class="empty" style="font-style:normal">${esc(projectTypeLabel(d.data().type))}</p>
          </div>`).join('')}`;
      wrap.querySelectorAll('[data-project]').forEach(el => {
        el.addEventListener('click', () => renderStaffProjectDetail(el.dataset.project));
      });
    }, err => showError(wrap, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

function renderStaffCalendar(wrap) {
  wrap.innerHTML = `<div class="loading">${esc(t('loadingGeneric'))}</div>`;
  // Toute l'équipe si on en a une (pour voir qui d'autre est sur quel
  // chantier ce jour-là), sinon repli sur ses propres créneaux seulement.
  const query = currentPerson.teamId
    ? db.collection('assignments').where('teamId', '==', currentPerson.teamId)
    : db.collection('assignments').where('personUid', '==', currentUser.uid);
  query.get().then(snap => {
    const all = snap.docs.map(d => d.data());
    const year = staffCalRefDate.getFullYear(), month = staffCalRefDate.getMonth();
    const startStr = dateStrOf(year, month, 1);
    const endStr = dateStrOf(year, month, new Date(year, month + 1, 0).getDate());
    const byDate = {};
    all.filter(a => a.date >= startStr && a.date <= endStr).forEach(a => { (byDate[a.date] ||= []).push(a); });
    wrap.innerHTML = `<div class="card">${monthGridHtml(year, month, byDate)}</div><div id="staff-cal-day-detail"></div>`;
    document.getElementById('cal-prev').addEventListener('click', () => {
      staffCalRefDate = new Date(year, month - 1, 1);
      renderStaffCalendar(wrap);
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      staffCalRefDate = new Date(year, month + 1, 1);
      renderStaffCalendar(wrap);
    });
    wrap.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => renderStaffCalDayDetail(cell.dataset.date, byDate[cell.dataset.date] || []));
    });
  }).catch(err => showError(wrap, t('loadError') + err.message));
}

// Détail d'un jour pour l'équipe — lecture seule (site + collègues présents),
// contrairement à la version admin qui permet d'assigner/retirer.
function renderStaffCalDayDetail(dateStr, items) {
  const detail = document.getElementById('staff-cal-day-detail');
  if (!detail) return;
  detail.innerHTML = `
    <div class="card">
      <h3>${fmtDateLabel(dateStr)}</h3>
      <div style="margin-top:10px">
        ${items.length === 0 ? `<p class="empty">${esc(t('noOneAssignedDay'))}</p>` : items.map(a => `
          <div class="list-row">
            <div class="main"><span class="badge" style="background:${esc(a.projectColor || DEFAULT_PROJECT_COLOR)};color:#fff">${esc(a.projectName)}</span> ${esc(a.personName)}${a.personUid === currentUser.uid ? ` <span class="empty" style="font-style:normal;display:inline">${esc(t('youMarker'))}</span>` : ''}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderStaffProjectDetail(projectId) {
  clearSubscriptions();
  const wrap = document.getElementById('staff-wrap');
  wrap.innerHTML = `<a href="#" class="back-link" id="back-to-staff">← ${esc(t('yourProjects'))}</a><div id="project-detail"><div class="loading">${esc(t('loadingGeneric'))}</div></div>`;
  document.getElementById('back-to-staff').addEventListener('click', (e) => { e.preventDefault(); renderStaff(); });
  renderProjectDetailShared(document.getElementById('project-detail'), projectId, 'staff');
}

// ============================================================
// VUE CLIENT
// ============================================================

async function renderClient() {
  clearSubscriptions();
  app.innerHTML = topbarHtml() + `<div class="wrap" id="client-wrap"><div class="loading">${esc(t('loadingGeneric'))}</div></div>`;
  wireLangSwitcher();
  const wrap = document.getElementById('client-wrap');
  if (!currentPerson.clientId) {
    wrap.innerHTML = `<p class="empty">${esc(t('clientNoProject'))}</p>`;
    return;
  }
  const unsub = db.collection('projects').where('clientId', '==', currentPerson.clientId)
    .onSnapshot(snap => {
      wrap.innerHTML = `
        <h2 class="section-title">${esc(t('clientYourProjects'))}</h2>
        ${snap.empty ? `<p class="empty">${esc(t('noProjectsYet'))}</p>` : snap.docs.map(d => `
          <div class="card project-card" data-project="${d.id}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3>${esc(d.data().name)}</h3>
              <span class="badge badge-${d.data().status}">${d.data().status === 'active' ? esc(t('statusActiveClient')) : esc(t('statusClosed'))}</span>
            </div>
            <p class="empty" style="font-style:normal">${esc(projectTypeLabel(d.data().type))}</p>
          </div>`).join('')}`;
      wrap.querySelectorAll('[data-project]').forEach(el => {
        el.addEventListener('click', () => renderClientProjectDetail(el.dataset.project));
      });
    }, err => showError(wrap, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

function renderClientProjectDetail(projectId) {
  clearSubscriptions();
  const wrap = document.getElementById('client-wrap');
  wrap.innerHTML = `<a href="#" class="back-link" id="back-to-client">← ${esc(t('clientYourProjects'))}</a><div id="project-detail"><div class="loading">${esc(t('loadingGeneric'))}</div></div>`;
  document.getElementById('back-to-client').addEventListener('click', (e) => { e.preventDefault(); renderClient(); });
  renderProjectDetailShared(document.getElementById('project-detail'), projectId, 'client');
}

// ============================================================
// DÉTAIL PROJET — partagé entre les 3 rôles (affichage adapté)
// ============================================================

function renderProjectDetailShared(container, projectId, mode) {
  // mode: 'admin' | 'staff' | 'client'
  db.collection('projects').doc(projectId).get().then(projSnap => {
    if (!projSnap.exists) { container.innerHTML = `<p class="empty">${esc(t('projectNotFound'))}</p>`; return; }
    const project = projSnap.data();

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <h2 class="section-title" style="margin-bottom:0">${esc(project.name)}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" id="export-report-btn">${esc(t('exportBtn'))}</button>
          ${mode === 'admin' && project.status === 'active' ? `<button class="btn btn-outline btn-sm" id="close-project-btn">${esc(t('closeProjectBtn'))}</button>` : ''}
        </div>
      </div>
      <div id="project-status-bar" style="margin:14px 0"></div>
      <div class="tabs">
        <button class="tab active" data-ptab="checklist">${esc(t('tabProgress'))}</button>
        <button class="tab" data-ptab="journal">${esc(t('tabJournal'))}</button>
        <button class="tab" data-ptab="problems">${esc(t('tabProblems'))}</button>
        ${mode !== 'client' ? `<button class="tab" data-ptab="timesheet">${esc(t('tabHours'))}</button>` : ''}
        ${mode === 'client' ? `<button class="tab" data-ptab="requests">${esc(t('tabMyRequests'))}</button>` : ''}
        ${mode === 'admin' ? `<button class="tab" data-ptab="requests">${esc(t('tabRequests'))}</button>` : ''}
      </div>
      <div id="ptab-content"><div class="loading">${esc(t('loadingGeneric'))}</div></div>`;

    document.getElementById('export-report-btn').addEventListener('click', () => exportProjectReport(projectId, mode));

    if (mode === 'admin' && project.status === 'active') {
      document.getElementById('close-project-btn').addEventListener('click', async () => {
        if (!confirm(t('closeProjectConfirm'))) return;
        await db.collection('projects').doc(projectId).update({
          status: 'closed',
          closedAt: firebase.firestore.FieldValue.serverTimestamp(),
          closedByName: currentPerson.name,
        });
        renderProjectDetailShared(container, projectId, mode);
      });
    }

    renderProjectStatusBar(document.getElementById('project-status-bar'), project, projectId, mode);

    let activeTab = 'checklist';
    const renderTab = () => {
      clearSubscriptions();
      container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.ptab === activeTab));
      const target = document.getElementById('ptab-content');
      if (activeTab === 'checklist') renderChecklistTab(target, projectId, mode, project.type);
      else if (activeTab === 'journal') renderJournalTab(target, projectId, mode);
      else if (activeTab === 'problems') renderProblemsTab(target, projectId, mode, project.type);
      else if (activeTab === 'timesheet') renderTimesheetTab(target, projectId, mode);
      else if (activeTab === 'requests') renderRequestsTab(target, projectId, mode);
    };
    container.querySelectorAll('[data-ptab]').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.ptab; renderTab(); });
    });
    renderTab();
  });
}

// Bandeau de clôture / avis client — indépendant des onglets (get() ponctuel,
// pas un onSnapshot, pour ne pas être coupé par le clearSubscriptions() qui
// tourne à chaque changement d'onglet juste en dessous).
function renderProjectStatusBar(target, project, projectId, mode) {
  if (project.status !== 'closed') { target.innerHTML = ''; return; }
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  db.collection('projects').doc(projectId).collection('feedback').doc('avis').get().then(snap => {
    const feedback = snap.exists ? snap.data() : null;
    if (mode === 'client') {
      if (feedback) {
        target.innerHTML = `<div class="note-box">${esc(t('closedOnClientThanks')(fmtDateTime(project.closedAt)))}<b>${stars(feedback.rating)}</b>${feedback.comment ? ' — ' + esc(feedback.comment) : ''}</div>`;
      } else {
        target.innerHTML = `
          <div class="card">
            <h3 style="font-size:1rem">${esc(t('feedbackPromptTitle'))}</h3>
            <form id="feedback-form" style="margin-top:10px">
              <div class="field"><label>${esc(t('ratingLabel'))}</label>
                <select id="fb-rating">
                  <option value="5">${esc(t('rating5'))}</option>
                  <option value="4">${esc(t('rating4'))}</option>
                  <option value="3">${esc(t('rating3'))}</option>
                  <option value="2">${esc(t('rating2'))}</option>
                  <option value="1">${esc(t('rating1'))}</option>
                </select>
              </div>
              <div class="field"><label>${esc(t('commentLabelOptional'))}</label><textarea id="fb-comment"></textarea></div>
              <button type="submit" class="btn btn-primary btn-sm">${esc(t('sendFeedbackBtn'))}</button>
            </form>
          </div>`;
        document.getElementById('feedback-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const rating = parseInt(document.getElementById('fb-rating').value, 10);
          const comment = document.getElementById('fb-comment').value.trim();
          const btn = e.target.querySelector('button[type=submit]');
          btn.disabled = true;
          try {
            await db.collection('projects').doc(projectId).collection('feedback').doc('avis').set({
              rating, comment, submittedByName: currentPerson.name,
              submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            renderProjectStatusBar(target, project, projectId, mode);
          } catch (err) {
            showError(e.target, t('errorPrefix') + err.message);
            btn.disabled = false;
          }
        });
      }
    } else {
      target.innerHTML = `<div class="note-box">${esc(t('closedOnAdmin')(fmtDateTime(project.closedAt)))}${esc(project.closedByName || '—')}.${feedback ? ` ${esc(t('clientFeedback'))}<b>${stars(feedback.rating)}</b>${feedback.comment ? ' — ' + esc(feedback.comment) : ''}` : ' ' + esc(t('awaitingClientFeedback'))}</div>`;
    }
  });
}

// Rapport imprimable / exportable en PDF (via l'impression du navigateur) —
// utilisable par l'admin, l'équipe ou le client depuis le détail d'un projet.
async function exportProjectReport(projectId, mode) {
  const projSnap = await db.collection('projects').doc(projectId).get();
  if (!projSnap.exists) return;
  const project = projSnap.data();

  const [checklistSnap, journalSnap, problemsSnap, feedbackSnap] = await Promise.all([
    db.collection('projects').doc(projectId).collection('checklist').orderBy('order').get(),
    db.collection('projects').doc(projectId).collection('journal').orderBy('createdAt', 'desc').get(),
    db.collection('projects').doc(projectId).collection('problems').orderBy('createdAt', 'desc').get(),
    db.collection('projects').doc(projectId).collection('feedback').doc('avis').get(),
  ]);

  const isClient = mode === 'client';
  const journalDocs = isClient ? journalSnap.docs.filter(d => d.data().visibleToClient) : journalSnap.docs;
  const problemDocs = isClient ? problemsSnap.docs.filter(d => d.data().visibleToClient) : problemsSnap.docs;
  const feedback = feedbackSnap.exists ? feedbackSnap.data() : null;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const doneCount = checklistSnap.docs.filter(d => d.data().done).length;
  const totalCount = checklistSnap.size;

  const win = window.open('', '_blank');
  if (!win) { alert(t('popupBlocked')); return; }
  const lang = getLang();

  win.document.write(`<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8">
<title>${esc(t('reportTitlePrefix'))}${esc(project.name)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#2a2016;max-width:800px;margin:0 auto;padding:30px 24px 60px}
  .letterhead{display:flex;align-items:center;gap:16px;border-bottom:3px solid #a8763a;padding-bottom:14px;margin-bottom:22px}
  .letterhead img{width:56px;height:56px;object-fit:contain}
  .letterhead .name{font-size:1.3rem;font-weight:700;color:#2e2114}
  .letterhead .tagline{font-size:0.82rem;color:#8a7154;font-style:italic}
  .letterhead .coords{font-size:0.74rem;color:#8c7c65;margin-top:2px}
  h1{font-size:1.3rem;color:#2e2114;margin:0 0 4px}
  h2{font-size:1.02rem;color:#2e2114;border-bottom:1px solid #e8ddc9;padding-bottom:4px;margin-top:28px}
  .meta{font-size:0.85rem;color:#5e5140;margin-bottom:18px}
  .step{padding:6px 0;border-bottom:1px solid #efe4d0;font-size:0.9rem}
  .step .done{color:#1f6b3a}
  .step .pending{color:#8c7c65}
  .entry{border-left:3px solid #c9974f;padding:8px 0 8px 12px;margin-bottom:10px;font-size:0.88rem}
  .entry .meta2{font-size:0.74rem;color:#8c7c65;margin-bottom:3px}
  .entry img{max-width:220px;margin:4px 6px 0 0;border-radius:6px}
  .footer{margin-top:40px;padding-top:12px;border-top:1px solid #e8ddc9;font-size:0.72rem;color:#8c7c65;text-align:center}
  .print-bar{text-align:right;margin-bottom:18px}
  .print-bar button{background:#a8763a;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:0.9rem;cursor:pointer}
  @media print { .print-bar{display:none} body{padding:0} }
</style></head>
<body>
  <div class="print-bar"><button onclick="window.print()">${esc(t('printSaveBtn'))}</button></div>
  <div class="letterhead">
    <img src="${BN_LOGO_DATA_URI}" alt="BN CORE GROUP">
    <div>
      <div class="name">BN CORE GROUP</div>
      <div class="tagline">Building from the Core</div>
      <div class="coords">Ll. Graffplein 15, 1780 Wemmel, Belgique — TVA BE1027.648.484 — +32 471 99 08 25 — info@bncoregroup.com</div>
    </div>
  </div>

  <h1>${esc(t('reportHeadingPrefix'))}${esc(project.name)}</h1>
  <div class="meta">${esc(projectTypeLabel(project.type))} · ${project.status === 'active' ? esc(t('statusActiveClient')) : esc(t('statusClosed'))}${project.status === 'closed' && project.closedAt ? ' ' + fmtDateTime(project.closedAt) : ''} · ${esc(t('documentGeneratedOn')(new Date().toLocaleDateString(LOCALE_MAP[lang])))}</div>

  <h2>${esc(t('tabProgress'))} (${t('stepsCompleted')(doneCount, totalCount)})</h2>
  ${checklistSnap.empty ? `<p>${esc(t('noStepsDefined'))}</p>` : checklistSnap.docs.map(d => {
    const s = d.data();
    const label = s.stepIndex != null ? checklistStepLabel(project.type, s.stepIndex) : (s.label || '');
    return `<div class="step"><span class="${s.done ? 'done' : 'pending'}">${s.done ? '✔' : '○'} ${esc(label)}</span>${s.done && s.doneAt ? esc(t('reportCompletedOn')(fmtDateTime(s.doneAt))) : ''}</div>`;
  }).join('')}

  <h2>${esc(t('tabJournal'))}</h2>
  ${journalDocs.length === 0 ? `<p>${esc(t('noEntriesYet'))}</p>` : journalDocs.map(d => {
    const e = d.data();
    return `<div class="entry"><div class="meta2">${esc(e.authorName)} · ${fmtDateTime(e.createdAt)}${e.containerSerial ? ' · ' + esc(t('containerBadge')(e.containerSerial)) : ''}</div><div>${esc(e.text)}</div>${(e.photoUrls || []).map(u => `<img src="${esc(u)}">`).join('')}</div>`;
  }).join('')}

  <h2>${esc(t('tabProblems'))}</h2>
  ${problemDocs.length === 0 ? `<p>${esc(t('noProblemsReported'))}</p>` : problemDocs.map(d => {
    const p = d.data();
    const statusLabel = p.status === 'resolved' ? t('problemStatusResolved') : p.status === 'published' ? t('problemStatusPublished') : t('problemStatusReported');
    const stepLabel = p.checklistStepIndex != null ? checklistStepLabel(project.type, p.checklistStepIndex) : null;
    return `<div class="entry"><div class="meta2">${esc(p.reportedByName)} · ${fmtDateTime(p.createdAt)} — ${esc(statusLabel)}${stepLabel ? esc(t('stepConcernedInline')(stepLabel)) : ''}</div><div><b>${esc(p.title)}</b> — ${esc(p.description)}</div>${(p.photoUrls || []).map(u => `<img src="${esc(u)}">`).join('')}</div>`;
  }).join('')}

  ${feedback ? `<h2>${esc(t('feedbackHeading'))}</h2><p>${stars(feedback.rating)}${feedback.comment ? ' — ' + esc(feedback.comment) : ''}</p>` : ''}

  <div class="footer">BN CORE GROUP — Building from the Core — TVA BE1027.648.484</div>
</body></html>`);
  win.document.close();
}

function renderChecklistTab(target, projectId, mode, projectType) {
  const unsub = db.collection('projects').doc(projectId).collection('checklist').orderBy('order').onSnapshot(snap => {
    const total = snap.size;
    const done = snap.docs.filter(d => d.data().done).length;
    const canEdit = mode !== 'client';
    target.innerHTML = `
      <div class="card">
        <p style="font-weight:600;margin-bottom:12px">${esc(t('stepsCompleted')(done, total))}</p>
        ${snap.empty ? `<p class="empty">${esc(t('noStepsDefined'))}</p>` : snap.docs.map(d => {
          const s = d.data();
          const label = s.stepIndex != null ? checklistStepLabel(projectType, s.stepIndex) : (s.label || '');
          return `<div class="checklist-item">
            <input type="checkbox" data-step="${d.id}" ${s.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
            <div style="flex:1">
              <div class="label ${s.done ? 'done' : ''}">${esc(label)}</div>
              ${s.done ? `<div class="meta">${esc(t('completedByOn')(s.doneBy || '—', fmtDateTime(s.doneAt)))}${s.note ? ' — ' + esc(s.note) : ''}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    if (canEdit) {
      target.querySelectorAll('[data-step]').forEach(cb => {
        cb.addEventListener('change', async () => {
          const stepRef = db.collection('projects').doc(projectId).collection('checklist').doc(cb.dataset.step);
          if (cb.checked) {
            let note = prompt(t('stepNotePrompt'), "") || '';
            await stepRef.update({ done: true, doneBy: currentPerson.name, doneAt: firebase.firestore.FieldValue.serverTimestamp(), note });
          } else {
            await stepRef.update({ done: false, doneBy: null, doneAt: null, note: '' });
          }
        });
      });
    }
  }, err => showError(target, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

function renderJournalTab(target, projectId, mode) {
  const canPost = mode !== 'client';
  let query = db.collection('projects').doc(projectId).collection('journal').orderBy('createdAt', 'desc');
  const unsub = query.onSnapshot(snap => {
    const entries = mode === 'client' ? snap.docs.filter(d => d.data().visibleToClient) : snap.docs;
    target.innerHTML = `
      ${canPost ? `
        <div class="card">
          <form id="journal-form">
            <div class="field"><textarea id="journal-text" placeholder="${esc(t('journalPlaceholder'))}" required></textarea></div>
            <div class="field"><label>${esc(t('containerSerialLabel'))}</label><input type="text" id="journal-container" placeholder="${esc(t('containerSerialPlaceholder'))}"></div>
            <div class="field"><label>${esc(t('photosOptionalLabel'))}</label><input type="file" id="journal-photos" accept="image/*" capture="environment" multiple></div>
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:0.86rem;color:var(--text-dim)">
              <input type="checkbox" id="journal-visible" checked style="width:auto"> ${esc(t('visibleToClientLabel'))}
            </label>
            <button type="submit" class="btn btn-primary btn-sm">${esc(t('publishBtn'))}</button>
          </form>
        </div>` : ''}
      <div class="card">
        ${entries.length === 0 ? `<p class="empty">${esc(t('noEntriesYet'))}</p>` : entries.map(d => {
          const e = d.data();
          return `<div class="journal-entry">
            <div class="meta">${esc(e.authorName)} · ${fmtDateTime(e.createdAt)} ${e.visibleToClient ? '' : `<span class="badge badge-reported" style="margin-left:6px">${esc(t('internalBadge'))}</span>`}</div>
            ${e.containerSerial ? `<div class="badge badge-published" style="margin-bottom:6px">${esc(t('containerBadge')(e.containerSerial))}</div>` : ''}
            <div>${esc(e.text)}</div>
            ${photoGalleryHtml(e.photoUrls)}
          </div>`;
        }).join('')}
      </div>`;
    if (canPost) {
      document.getElementById('journal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('journal-text').value.trim();
        const containerSerial = document.getElementById('journal-container').value.trim();
        const visibleToClient = document.getElementById('journal-visible').checked;
        const files = Array.from(document.getElementById('journal-photos').files || []);
        if (!text) return;
        const form = e.target;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        const docRef = db.collection('projects').doc(projectId).collection('journal').doc();
        try {
          btn.textContent = files.length ? t('sendingPhotos') : t('publishing');
          const photoUrls = files.length ? await uploadPhotos(`projects/${projectId}/journal/${docRef.id}`, files) : [];
          await docRef.set({
            text, containerSerial, visibleToClient, photoUrls, authorName: currentPerson.name, authorRole: currentPerson.role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          showError(form, t('sendErrorPrefix') + err.message);
          btn.disabled = false;
          btn.textContent = t('publishBtn');
        }
      });
    }
  }, err => showError(target, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

function renderProblemsTab(target, projectId, mode, projectType) {
  const canReport = mode === 'staff';
  const unsub = db.collection('projects').doc(projectId).collection('problems').orderBy('createdAt', 'desc').onSnapshot(async (snap) => {
    const items = mode === 'client' ? snap.docs.filter(d => d.data().visibleToClient) : snap.docs;

    let checklistOptions = '';
    if (canReport) {
      const checklistSnap = await db.collection('projects').doc(projectId).collection('checklist').orderBy('order').get();
      checklistOptions = checklistSnap.docs.map(d => {
        const stepIndex = d.data().stepIndex;
        const label = stepIndex != null ? checklistStepLabel(projectType, stepIndex) : (d.data().label || '');
        return `<option value="${stepIndex}" data-label="${esc(label)}">${esc(label)}</option>`;
      }).join('');
    }

    target.innerHTML = `
      ${canReport ? `
        <div class="card">
          <form id="problem-form">
            <div class="field"><label>${esc(t('problemTitleLabel'))}</label><input type="text" id="problem-title" required></div>
            <div class="field"><label>${esc(t('stepConcernedLabel'))}</label>
              <select id="problem-step"><option value="">${esc(t('noSpecificStep'))}</option>${checklistOptions}</select>
            </div>
            <div class="field"><label>${esc(t('descriptionLabel'))}</label><textarea id="problem-desc" required></textarea></div>
            <div class="field"><label>${esc(t('photosOptionalLabel'))}</label><input type="file" id="problem-photos" accept="image/*" capture="environment" multiple></div>
            <button type="submit" class="btn btn-primary btn-sm">${esc(t('reportBtn'))}</button>
          </form>
        </div>` : ''}
      <div class="card">
        ${items.length === 0 ? `<p class="empty">${esc(t('noProblemsReported'))}</p>` : items.map(d => {
          const p = d.data();
          const statusLabel = p.status === 'reported' ? t('problemStatusReported') : p.status === 'published' ? t('problemStatusPublished') : t('problemStatusResolved');
          const stepLabel = p.checklistStepIndex != null ? checklistStepLabel(projectType, p.checklistStepIndex) : null;
          return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <h3 style="font-size:1rem">${esc(p.title)}</h3>
              <span class="badge badge-${p.status}">${esc(statusLabel)}</span>
            </div>
            <p class="empty" style="font-style:normal;margin:4px 0">${esc(p.reportedByName)} · ${fmtDateTime(p.createdAt)}${stepLabel ? esc(t('stepConcernedInline')(stepLabel)) : ''}</p>
            <p>${esc(p.description)}</p>
            ${photoGalleryHtml(p.photoUrls)}
          </div>`;
        }).join('')}
      </div>`;
    if (canReport) {
      document.getElementById('problem-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('problem-title').value.trim();
        const description = document.getElementById('problem-desc').value.trim();
        const stepSel = document.getElementById('problem-step');
        const checklistStepIndex = stepSel.value !== '' ? parseInt(stepSel.value, 10) : null;
        const files = Array.from(document.getElementById('problem-photos').files || []);
        if (!title || !description) return;
        const form = e.target;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        const docRef = db.collection('projects').doc(projectId).collection('problems').doc();
        try {
          btn.textContent = files.length ? t('sendingPhotos') : t('reporting');
          const photoUrls = files.length ? await uploadPhotos(`projects/${projectId}/problems/${docRef.id}`, files) : [];
          await docRef.set({
            title, description, photoUrls, status: 'reported', visibleToClient: false,
            checklistStepIndex,
            reportedByName: currentPerson.name, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          showError(form, t('sendErrorPrefix') + err.message);
          btn.disabled = false;
          btn.textContent = t('reportBtn');
        }
      });
    }
  }, err => showError(target, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

function renderTimesheetTab(target, projectId, mode) {
  if (mode === 'admin') return renderTimesheetTabAdmin(target, projectId);

  target.innerHTML = `<div id="clock-wrap"><div class="loading">${esc(t('loadingGeneric'))}</div></div><div id="mileage-wrap" style="margin-top:16px"></div>`;
  const clockWrap = document.getElementById('clock-wrap');
  renderMileageSection(document.getElementById('mileage-wrap'), projectId);

  // Filtered by personUid only (no orderBy on a different field) so this never needs
  // a manually-created Firestore composite index — sorted client-side instead.
  const unsub = db.collection('projects').doc(projectId).collection('timesheets')
    .where('personUid', '==', currentUser.uid)
    .onSnapshot(snap => {
      const entries = snap.docs.map(d => d.data());
      const shifts = computeShifts(entries); // le plus récent en premier
      const last = shifts[0];
      const isIn = last && last.ongoing;
      const now = Date.now();
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const todayMs = sumShiftMs(shifts, startOfDay.getTime());
      const weekMs = sumShiftMs(shifts, now - 7 * 24 * 3600 * 1000);

      clockWrap.innerHTML = `
        <div class="card">
          <div class="timesheet-clock">
            <button class="btn btn-primary" id="clock-btn">${esc(isIn ? t('clockOutBtn') : t('clockInBtn'))}</button>
            <span class="status">${last ? esc(isIn ? t('ongoingSince')(fmtDateTime(last.in.timestamp)) : t('lastClockOut')(fmtDateTime(last.out.timestamp))) : esc(t('noClockYet'))}</span>
          </div>
          <div id="clock-extra" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
            <div class="field"><label>${esc(t('photosOptionalLabel'))}</label><input type="file" id="clock-photo" accept="image/*" capture="environment"></div>
            <div class="field"><label>${esc(t('clockNoteLabel'))}</label><textarea id="clock-note" placeholder="${esc(t('clockNotePlaceholder'))}"></textarea></div>
            <button type="button" class="btn btn-primary btn-sm" id="clock-confirm">${esc(t('confirmBtn'))}</button>
            <button type="button" class="btn btn-outline btn-sm" id="clock-cancel">${esc(t('cancelBtn'))}</button>
          </div>
          <div class="row" style="margin-top:14px">
            <div class="card" style="background:var(--gold-100);border:none;text-align:center;padding:14px">
              <div style="font-size:1.4rem;font-weight:700;color:var(--brown-900)">${fmtDuration(todayMs)}</div>
              <div class="empty" style="font-style:normal">${esc(t('today'))}</div>
            </div>
            <div class="card" style="background:var(--gold-100);border:none;text-align:center;padding:14px">
              <div style="font-size:1.4rem;font-weight:700;color:var(--brown-900)">${fmtDuration(weekMs)}</div>
              <div class="empty" style="font-style:normal">${esc(t('last7days'))}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <table>
            <thead><tr><th>${esc(t('colArrival'))}</th><th>${esc(t('colDeparture'))}</th><th>${esc(t('colDuration'))}</th><th></th></tr></thead>
            <tbody>${shifts.map(s => {
              const note = [s.in && s.in.note, s.out && s.out.note].filter(Boolean).map(esc).join(' · ');
              const photos = [...((s.in && s.in.photoUrls) || []), ...((s.out && s.out.photoUrls) || [])];
              return `<tr>
              <td>${s.in ? fmtDateTime(s.in.timestamp) : '—'}${s.in ? geoLinkHtml(s.in.geo) : ''}</td>
              <td>${s.out ? fmtDateTime(s.out.timestamp) : (s.ongoing ? `<span class="badge badge-active">${esc(t('ongoingBadge'))}</span>` : '—')}${s.out ? geoLinkHtml(s.out.geo) : ''}</td>
              <td>${s.ongoing ? '—' : fmtDuration(s.ms)}</td>
              <td>${note}${photoGalleryHtml(photos)}</td>
            </tr>`;
            }).join('') || `<tr><td colspan="4" class="empty">${esc(t('noTimesheetRows'))}</td></tr>`}</tbody>
          </table>
        </div>`;

      const clockExtra = document.getElementById('clock-extra');
      document.getElementById('clock-btn').addEventListener('click', () => {
        clockExtra.style.display = clockExtra.style.display === 'none' ? 'block' : 'none';
      });
      document.getElementById('clock-cancel').addEventListener('click', () => {
        clockExtra.style.display = 'none';
      });
      document.getElementById('clock-confirm').addEventListener('click', async () => {
        const note = document.getElementById('clock-note').value.trim();
        const files = Array.from(document.getElementById('clock-photo').files || []);
        const confirmBtn = document.getElementById('clock-confirm');
        confirmBtn.disabled = true;
        const docRef = db.collection('projects').doc(projectId).collection('timesheets').doc();
        try {
          const geo = await getGeoLocation();
          confirmBtn.textContent = files.length ? t('sendingPhotos') : t('confirmBtn');
          const photoUrls = files.length ? await uploadPhotos(`projects/${projectId}/timesheets/${docRef.id}`, files) : [];
          await docRef.set({
            personUid: currentUser.uid, personName: currentPerson.name, type: isIn ? 'out' : 'in',
            note, photoUrls, geo, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          showError(clockWrap, t('sendErrorPrefix') + err.message);
          confirmBtn.disabled = false;
          confirmBtn.textContent = t('confirmBtn');
        }
      });
    }, err => showError(clockWrap, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

// Saisie + historique du kilométrage personnel sur ce projet (domicile ↔
// chantier). Indépendant du pointage : sa propre carte, son propre listener.
function renderMileageSection(target, projectId) {
  const unsub = db.collection('projects').doc(projectId).collection('mileage')
    .where('personUid', '==', currentUser.uid)
    .onSnapshot(snap => {
      const entries = snap.docs.map(d => d.data()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const now = new Date();
      const monthPrefix = dateStrOf(now.getFullYear(), now.getMonth(), 1).slice(0, 7);
      const monthTotal = entries.filter(e => (e.date || '').startsWith(monthPrefix)).reduce((sum, e) => sum + (e.km || 0), 0);

      target.innerHTML = `
        <div class="card">
          <h3>${esc(t('mileageTitle'))}</h3>
          <form id="mileage-form" class="row" style="align-items:flex-end;margin-top:10px">
            <div class="field"><label>${esc(t('mileageKmLabel'))}</label><input type="number" id="mileage-km" min="0" step="1" required></div>
            <div class="field"><label>${esc(t('mileageVehicleLabel'))}</label>
              <select id="mileage-vehicle">
                <option value="car">${esc(t('mileageVehicleCar'))}</option>
                <option value="truck">${esc(t('mileageVehicleTruck'))}</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">${esc(t('mileageSaveBtn'))}</button>
          </form>
          <p style="margin-top:10px;font-weight:600;color:var(--brown-900)">${esc(t('mileageMonthTotal')(monthTotal))}</p>
          <table style="margin-top:8px">
            <thead><tr><th>${esc(t('mileageColDate'))}</th><th>${esc(t('mileageColKm'))}</th><th>${esc(t('mileageColVehicle'))}</th></tr></thead>
            <tbody>${entries.map(e => `<tr>
              <td>${fmtDateStr(e.date)}</td>
              <td>${e.km}</td>
              <td>${e.vehicleType === 'truck' ? esc(t('mileageVehicleTruck')) : esc(t('mileageVehicleCar'))}</td>
            </tr>`).join('') || `<tr><td colspan="3" class="empty">${esc(t('mileageNoRows'))}</td></tr>`}</tbody>
          </table>
        </div>`;

      document.getElementById('mileage-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const km = parseFloat(document.getElementById('mileage-km').value);
        const vehicleType = document.getElementById('mileage-vehicle').value;
        if (!km || km <= 0) return;
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.textContent = t('mileageSaving');
        try {
          await db.collection('projects').doc(projectId).collection('mileage').add({
            personUid: currentUser.uid, personName: currentPerson.name, km, vehicleType,
            date: dateStrOf(now.getFullYear(), now.getMonth(), now.getDate()),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          showError(target, t('sendErrorPrefix') + err.message);
          btn.disabled = false;
          btn.textContent = t('mileageSaveBtn');
        }
      });
    }, err => showError(target, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

function renderTimesheetTabAdmin(target, projectId) {
  target.innerHTML = `<div id="admin-hours-section"><div class="loading">Chargement…</div></div><div id="admin-mileage-section" style="margin-top:16px"></div>`;
  const hoursSection = document.getElementById('admin-hours-section');
  const mileageSection = document.getElementById('admin-mileage-section');

  const unsub = db.collection('projects').doc(projectId).collection('timesheets').onSnapshot(snap => {
    const byPerson = {};
    snap.docs.forEach(d => {
      const e = d.data();
      (byPerson[e.personUid] ||= { name: e.personName, entries: [] }).entries.push(e);
    });
    const now = Date.now();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    hoursSection.innerHTML = `
      <div class="card">
        <table>
          <thead><tr><th>Personne</th><th>Aujourd'hui</th><th>7 derniers jours</th><th>Statut</th></tr></thead>
          <tbody>
          ${Object.values(byPerson).map(p => {
            const shifts = computeShifts(p.entries);
            const todayMs = sumShiftMs(shifts, startOfDay.getTime());
            const weekMs = sumShiftMs(shifts, now - 7 * 24 * 3600 * 1000);
            const ongoing = shifts[0]?.ongoing;
            return `<tr>
              <td>${esc(p.name)}</td>
              <td>${fmtDuration(todayMs)}</td>
              <td>${fmtDuration(weekMs)}</td>
              <td>${ongoing ? '<span class="badge badge-active">Sur site</span>' : '—'}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" class="empty">Aucun pointage sur ce projet.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }, err => showError(hoursSection, "Erreur : " + err.message));
  unsubscribers.push(unsub);

  const unsub2 = db.collection('projects').doc(projectId).collection('mileage').onSnapshot(snap => {
    const byPerson = {};
    snap.docs.forEach(d => {
      const e = d.data();
      const entry = (byPerson[e.personUid] ||= { name: e.personName, total: 0 });
      entry.total += (e.km || 0);
    });
    mileageSection.innerHTML = `
      <div class="card">
        <h3>Kilométrage</h3>
        <table style="margin-top:8px">
          <thead><tr><th>Personne</th><th>Total km</th></tr></thead>
          <tbody>${Object.values(byPerson).map(p => `<tr><td>${esc(p.name)}</td><td>${p.total}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">Aucun trajet enregistré.</td></tr>'}</tbody>
        </table>
      </div>`;
  }, err => showError(mileageSection, "Erreur : " + err.message));
  unsubscribers.push(unsub2);
}

function renderRequestsTab(target, projectId, mode) {
  const canSubmit = mode === 'client';
  const unsub = db.collection('projects').doc(projectId).collection('requests').orderBy('createdAt', 'desc').onSnapshot(snap => {
    target.innerHTML = `
      ${canSubmit ? `
        <div class="card">
          <form id="request-form">
            <div class="field"><label>${esc(t('yourRequestLabel'))}</label><textarea id="request-text" required></textarea></div>
            <button type="submit" class="btn btn-primary btn-sm">${esc(t('sendBtn'))}</button>
          </form>
        </div>` : ''}
      <div class="card">
        ${snap.empty ? `<p class="empty">${esc(t('noRequests'))}</p>` : snap.docs.map(d => {
          const r = d.data();
          return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <p class="empty" style="font-style:normal">${esc(r.fromName)} · ${fmtDateTime(r.createdAt)}</p>
              <span class="badge badge-${r.status}">${r.status === 'open' ? esc(t('requestOpen')) : esc(t('requestAnswered'))}</span>
            </div>
            <p style="margin-top:6px">${esc(r.text)}</p>
            ${r.response ? `<div class="note-box" style="margin-top:8px"><b>${esc(t('responseLabel'))}</b>${esc(r.response)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    if (canSubmit) {
      document.getElementById('request-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('request-text').value.trim();
        if (!text) return;
        await db.collection('projects').doc(projectId).collection('requests').add({
          text, status: 'open', fromUid: currentUser.uid, fromName: currentPerson.name,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        e.target.reset();
      });
    }
  }, err => showError(target, t('loadError') + err.message));
  unsubscribers.push(unsub);
}
