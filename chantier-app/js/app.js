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

// ---- Gabarits de check-list par type de projet ----
// (repris du Manuel de contrôle interne — mêmes étapes, même logique de contrôle)
const CHECKLIST_TEMPLATES = {
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
};

const PROJECT_TYPE_LABELS = {
  commissioning: 'Commissioning',
  om: 'O&M',
  container: 'Réparation de conteneur',
  audit: 'Audit technique',
  workforce: 'Workforce Deployment',
};

const ROLE_LABELS = {
  admin: 'Administrateur',
  engineer: 'Ingénieur',
  electrician: 'Électricien',
  worker: 'Aide technique',
  client: 'Client',
};

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
        <h1 style="font-size:1.6rem">BN CORE GROUP</h1>
        <p style="color:var(--text-dim);font-size:0.9rem">Suivi de chantier</p>
      </div>
      <div class="card">
        ${errorMsg ? `<div class="error-box">${esc(errorMsg)}</div>` : ''}
        <form id="login-form">
          <div class="field">
            <label for="login-email">Email</label>
            <input type="email" id="login-email" required autocomplete="username">
          </div>
          <div class="field">
            <label for="login-password">Mot de passe</label>
            <input type="password" id="login-password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary btn-block">Se connecter</button>
        </form>
        <p style="margin-top:16px;font-size:0.82rem;color:var(--text-mute);text-align:center">
          Pas encore de compte ? Contactez votre administrateur.
        </p>
      </div>
    </div>`;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Connexion…';
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
  app.innerHTML = `<div class="center-wrap"><div class="loading">Vérification de l'invitation…</div></div>`;
  db.collection('invites').doc(code).get().then(snap => {
    if (!snap.exists || snap.data().used) {
      app.innerHTML = `<div class="center-wrap"><div class="card error-box">
        Ce lien d'invitation n'est plus valide ou a déjà été utilisé. Contactez BN CORE GROUP pour en obtenir un nouveau.
      </div></div>`;
      return;
    }
    const invite = snap.data();
    app.innerHTML = `
      <div class="center-wrap">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="font-size:1.6rem">BN CORE GROUP</h1>
          <p style="color:var(--text-dim);font-size:0.9rem">Créer votre accès — ${esc(ROLE_LABELS[invite.role] || invite.role)}</p>
        </div>
        <div class="card">
          <form id="signup-form">
            <div class="field"><label>Nom complet</label><input type="text" id="su-name" required value="${esc(invite.suggestedName || '')}"></div>
            <div class="field"><label>Email</label><input type="email" id="su-email" required autocomplete="username"></div>
            <div class="field"><label>Mot de passe</label><input type="password" id="su-password" required minlength="6" autocomplete="new-password"></div>
            <button type="submit" class="btn btn-primary btn-block">Créer mon compte</button>
          </form>
        </div>
      </div>`;

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('su-name').value.trim();
      const email = document.getElementById('su-email').value.trim();
      const password = document.getElementById('su-password').value;
      const form = e.target;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Création…';
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
        btn.textContent = 'Créer mon compte';
        showError(form, translateSignupError(err));
      }
    });
  }).catch(err => {
    app.innerHTML = `<div class="center-wrap"><div class="card error-box">Erreur : ${esc(err.message)}</div></div>`;
  });
}

function translateSignupError(err) {
  const map = {
    'auth/email-already-in-use': "Cet email est déjà utilisé par un autre compte.",
    'auth/invalid-email': "Adresse email invalide.",
    'auth/weak-password': "Le mot de passe doit contenir au moins 6 caractères.",
  };
  return map[err.code] || ("Erreur : " + err.message);
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
    'auth/invalid-email': "Adresse email invalide.",
    'auth/user-disabled': "Ce compte a été désactivé.",
    'auth/user-not-found': "Aucun compte avec cet email.",
    'auth/wrong-password': "Mot de passe incorrect.",
    'auth/invalid-credential': "Email ou mot de passe incorrect.",
    'auth/too-many-requests': "Trop de tentatives — réessayez dans quelques minutes.",
  };
  return map[err.code] || ("Erreur de connexion : " + err.message);
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
  app.innerHTML = '<div class="loading">Chargement de votre profil…</div>';
  try {
    const snap = await db.collection('people').doc(user.uid).get();
    if (!snap.exists) {
      app.innerHTML = `<div class="center-wrap"><div class="card">
        <h2>Compte non configuré</h2>
        <p style="margin-top:12px;color:var(--text-dim)">Votre compte existe mais n'a pas encore de profil (rôle, équipe ou client) associé. Contactez votre administrateur.</p>
        <button class="btn btn-outline" style="margin-top:16px" onclick="logout()">Se déconnecter</button>
      </div></div>`;
      return;
    }
    const person = { id: user.uid, ...snap.data() };
    if (person.revoked) {
      app.innerHTML = `<div class="center-wrap"><div class="card">
        <h2>Accès révoqué</h2>
        <p style="margin-top:12px;color:var(--text-dim)">Votre accès à cette application a été retiré. Contactez BN CORE GROUP si vous pensez qu'il s'agit d'une erreur.</p>
        <button class="btn btn-outline" style="margin-top:16px" onclick="logout()">Se déconnecter</button>
      </div></div>`;
      return;
    }
    currentPerson = person;
    routeByRole();
  } catch (err) {
    app.innerHTML = `<div class="center-wrap"><div class="card error-box">Erreur de chargement du profil : ${esc(err.message)}</div></div>`;
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
        <span>${esc(currentPerson.name)} · ${esc(ROLE_LABELS[currentPerson.role] || currentPerson.role)}</span>
        ${extra || ''}
        <button onclick="logout()">Se déconnecter</button>
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
  renderAdminTabs();
}

function renderAdminTabs() {
  clearSubscriptions();
  const wrap = document.getElementById('admin-wrap');
  const tabs = [
    ['projects', 'Projets'],
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
              <h3>${esc(p.name)}</h3>
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
      <button type="submit" class="btn btn-primary">Créer le projet</button>
      <button type="button" class="btn btn-outline" id="np-cancel">Annuler</button>
    </form>`;
  document.getElementById('project-list').before(overlay);

  document.getElementById('np-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('new-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('np-name').value.trim();
    const type = document.getElementById('np-type').value;
    const teamId = document.getElementById('np-team').value;
    const clientId = document.getElementById('np-client').value;
    if (!teamId || !clientId) { showError(overlay, "Créez d'abord au moins une équipe et un client."); return; }
    try {
      const projectRef = await db.collection('projects').add({
        name, type, teamId, clientId, status: 'active', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      const steps = CHECKLIST_TEMPLATES[type] || [];
      const batch = db.batch();
      steps.forEach((label, i) => {
        const stepRef = projectRef.collection('checklist').doc();
        batch.set(stepRef, { label, order: i, done: false, doneBy: null, doneAt: null, note: '' });
      });
      await batch.commit();
      overlay.remove();
    } catch (err) {
      showError(overlay, "Erreur : " + err.message);
    }
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

async function renderStaff() {
  clearSubscriptions();
  app.innerHTML = topbarHtml() + `<div class="wrap" id="staff-wrap"><div class="loading">Chargement de vos projets…</div></div>`;
  const wrap = document.getElementById('staff-wrap');
  if (!currentPerson.teamId) {
    wrap.innerHTML = '<p class="empty">Aucune équipe ne vous est associée pour le moment. Contactez votre administrateur.</p>';
    return;
  }
  const unsub = db.collection('projects').where('teamId', '==', currentPerson.teamId).where('status', '==', 'active')
    .onSnapshot(snap => {
      wrap.innerHTML = `
        <h2 class="section-title">Vos projets en cours</h2>
        ${snap.empty ? '<p class="empty">Aucun projet actif assigné à votre équipe.</p>' : snap.docs.map(d => `
          <div class="card project-card" data-project="${d.id}">
            <h3>${esc(d.data().name)}</h3>
            <p class="empty" style="font-style:normal">${PROJECT_TYPE_LABELS[d.data().type] || d.data().type}</p>
          </div>`).join('')}`;
      wrap.querySelectorAll('[data-project]').forEach(el => {
        el.addEventListener('click', () => renderStaffProjectDetail(el.dataset.project));
      });
    }, err => showError(wrap, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderStaffProjectDetail(projectId) {
  clearSubscriptions();
  const wrap = document.getElementById('staff-wrap');
  wrap.innerHTML = `<a href="#" class="back-link" id="back-to-staff">← Retour à vos projets</a><div id="project-detail"><div class="loading">Chargement…</div></div>`;
  document.getElementById('back-to-staff').addEventListener('click', (e) => { e.preventDefault(); renderStaff(); });
  renderProjectDetailShared(document.getElementById('project-detail'), projectId, 'staff');
}

// ============================================================
// VUE CLIENT
// ============================================================

async function renderClient() {
  clearSubscriptions();
  app.innerHTML = topbarHtml() + `<div class="wrap" id="client-wrap"><div class="loading">Chargement de vos projets…</div></div>`;
  const wrap = document.getElementById('client-wrap');
  if (!currentPerson.clientId) {
    wrap.innerHTML = '<p class="empty">Aucun projet ne vous est associé pour le moment. Contactez BN CORE GROUP.</p>';
    return;
  }
  const unsub = db.collection('projects').where('clientId', '==', currentPerson.clientId)
    .onSnapshot(snap => {
      wrap.innerHTML = `
        <h2 class="section-title">Vos projets</h2>
        ${snap.empty ? '<p class="empty">Aucun projet pour le moment.</p>' : snap.docs.map(d => `
          <div class="card project-card" data-project="${d.id}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3>${esc(d.data().name)}</h3>
              <span class="badge badge-${d.data().status}">${d.data().status === 'active' ? 'En cours' : 'Clôturé'}</span>
            </div>
            <p class="empty" style="font-style:normal">${PROJECT_TYPE_LABELS[d.data().type] || d.data().type}</p>
          </div>`).join('')}`;
      wrap.querySelectorAll('[data-project]').forEach(el => {
        el.addEventListener('click', () => renderClientProjectDetail(el.dataset.project));
      });
    }, err => showError(wrap, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderClientProjectDetail(projectId) {
  clearSubscriptions();
  const wrap = document.getElementById('client-wrap');
  wrap.innerHTML = `<a href="#" class="back-link" id="back-to-client">← Retour à vos projets</a><div id="project-detail"><div class="loading">Chargement…</div></div>`;
  document.getElementById('back-to-client').addEventListener('click', (e) => { e.preventDefault(); renderClient(); });
  renderProjectDetailShared(document.getElementById('project-detail'), projectId, 'client');
}

// ============================================================
// DÉTAIL PROJET — partagé entre les 3 rôles (affichage adapté)
// ============================================================

function renderProjectDetailShared(container, projectId, mode) {
  // mode: 'admin' | 'staff' | 'client'
  db.collection('projects').doc(projectId).get().then(projSnap => {
    if (!projSnap.exists) { container.innerHTML = '<p class="empty">Projet introuvable.</p>'; return; }
    const project = projSnap.data();

    container.innerHTML = `
      <h2 class="section-title">${esc(project.name)}</h2>
      <div class="tabs">
        <button class="tab active" data-ptab="checklist">Avancement</button>
        <button class="tab" data-ptab="journal">Journal</button>
        <button class="tab" data-ptab="problems">Problèmes</button>
        ${mode !== 'client' ? '<button class="tab" data-ptab="timesheet">Heures</button>' : ''}
        ${mode === 'client' ? '<button class="tab" data-ptab="requests">Mes demandes</button>' : ''}
        ${mode === 'admin' ? '<button class="tab" data-ptab="requests">Demandes</button>' : ''}
      </div>
      <div id="ptab-content"><div class="loading">Chargement…</div></div>`;

    let activeTab = 'checklist';
    const renderTab = () => {
      clearSubscriptions();
      container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.ptab === activeTab));
      const target = document.getElementById('ptab-content');
      if (activeTab === 'checklist') renderChecklistTab(target, projectId, mode);
      else if (activeTab === 'journal') renderJournalTab(target, projectId, mode);
      else if (activeTab === 'problems') renderProblemsTab(target, projectId, mode);
      else if (activeTab === 'timesheet') renderTimesheetTab(target, projectId, mode);
      else if (activeTab === 'requests') renderRequestsTab(target, projectId, mode);
    };
    container.querySelectorAll('[data-ptab]').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.ptab; renderTab(); });
    });
    renderTab();
  });
}

function renderChecklistTab(target, projectId, mode) {
  const unsub = db.collection('projects').doc(projectId).collection('checklist').orderBy('order').onSnapshot(snap => {
    const total = snap.size;
    const done = snap.docs.filter(d => d.data().done).length;
    const canEdit = mode !== 'client';
    target.innerHTML = `
      <div class="card">
        <p style="font-weight:600;margin-bottom:12px">${done} / ${total} étapes complétées</p>
        ${snap.empty ? '<p class="empty">Aucune étape définie.</p>' : snap.docs.map(d => {
          const s = d.data();
          return `<div class="checklist-item">
            <input type="checkbox" data-step="${d.id}" ${s.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
            <div style="flex:1">
              <div class="label ${s.done ? 'done' : ''}">${esc(s.label)}</div>
              ${s.done ? `<div class="meta">Complété par ${esc(s.doneBy || '—')} le ${fmtDateTime(s.doneAt)}${s.note ? ' — ' + esc(s.note) : ''}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    if (canEdit) {
      target.querySelectorAll('[data-step]').forEach(cb => {
        cb.addEventListener('change', async () => {
          const stepRef = db.collection('projects').doc(projectId).collection('checklist').doc(cb.dataset.step);
          if (cb.checked) {
            let note = prompt("Note pour cette étape (optionnel) :", "") || '';
            await stepRef.update({ done: true, doneBy: currentPerson.name, doneAt: firebase.firestore.FieldValue.serverTimestamp(), note });
          } else {
            await stepRef.update({ done: false, doneBy: null, doneAt: null, note: '' });
          }
        });
      });
    }
  }, err => showError(target, "Erreur : " + err.message));
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
            <div class="field"><textarea id="journal-text" placeholder="Mise à jour du chantier…" required></textarea></div>
            <div class="field"><label>Photos (optionnel)</label><input type="file" id="journal-photos" accept="image/*" capture="environment" multiple></div>
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:0.86rem;color:var(--text-dim)">
              <input type="checkbox" id="journal-visible" checked style="width:auto"> Visible par le client
            </label>
            <button type="submit" class="btn btn-primary btn-sm">Publier</button>
          </form>
        </div>` : ''}
      <div class="card">
        ${entries.length === 0 ? '<p class="empty">Aucune entrée pour le moment.</p>' : entries.map(d => {
          const e = d.data();
          return `<div class="journal-entry">
            <div class="meta">${esc(e.authorName)} · ${fmtDateTime(e.createdAt)} ${e.visibleToClient ? '' : '<span class="badge badge-reported" style="margin-left:6px">Interne</span>'}</div>
            <div>${esc(e.text)}</div>
            ${photoGalleryHtml(e.photoUrls)}
          </div>`;
        }).join('')}
      </div>`;
    if (canPost) {
      document.getElementById('journal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('journal-text').value.trim();
        const visibleToClient = document.getElementById('journal-visible').checked;
        const files = Array.from(document.getElementById('journal-photos').files || []);
        if (!text) return;
        const form = e.target;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        const docRef = db.collection('projects').doc(projectId).collection('journal').doc();
        try {
          btn.textContent = files.length ? 'Envoi des photos…' : 'Publication…';
          const photoUrls = files.length ? await uploadPhotos(`projects/${projectId}/journal/${docRef.id}`, files) : [];
          await docRef.set({
            text, visibleToClient, photoUrls, authorName: currentPerson.name, authorRole: currentPerson.role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          showError(form, "Erreur d'envoi : " + err.message);
          btn.disabled = false;
          btn.textContent = 'Publier';
        }
      });
    }
  }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderProblemsTab(target, projectId, mode) {
  const canReport = mode === 'staff';
  const unsub = db.collection('projects').doc(projectId).collection('problems').orderBy('createdAt', 'desc').onSnapshot(snap => {
    const items = mode === 'client' ? snap.docs.filter(d => d.data().visibleToClient) : snap.docs;
    target.innerHTML = `
      ${canReport ? `
        <div class="card">
          <form id="problem-form">
            <div class="field"><label>Titre</label><input type="text" id="problem-title" required></div>
            <div class="field"><label>Description</label><textarea id="problem-desc" required></textarea></div>
            <div class="field"><label>Photos (optionnel)</label><input type="file" id="problem-photos" accept="image/*" capture="environment" multiple></div>
            <button type="submit" class="btn btn-primary btn-sm">Signaler</button>
          </form>
        </div>` : ''}
      <div class="card">
        ${items.length === 0 ? '<p class="empty">Aucun problème signalé.</p>' : items.map(d => {
          const p = d.data();
          return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <h3 style="font-size:1rem">${esc(p.title)}</h3>
              <span class="badge badge-${p.status}">${p.status === 'reported' ? 'Signalé' : p.status === 'published' ? 'Communiqué' : 'Résolu'}</span>
            </div>
            <p class="empty" style="font-style:normal;margin:4px 0">${esc(p.reportedByName)} · ${fmtDateTime(p.createdAt)}</p>
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
        const files = Array.from(document.getElementById('problem-photos').files || []);
        if (!title || !description) return;
        const form = e.target;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        const docRef = db.collection('projects').doc(projectId).collection('problems').doc();
        try {
          btn.textContent = files.length ? 'Envoi des photos…' : 'Signalement…';
          const photoUrls = files.length ? await uploadPhotos(`projects/${projectId}/problems/${docRef.id}`, files) : [];
          await docRef.set({
            title, description, photoUrls, status: 'reported', visibleToClient: false,
            reportedByName: currentPerson.name, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          showError(form, "Erreur d'envoi : " + err.message);
          btn.disabled = false;
          btn.textContent = 'Signaler';
        }
      });
    }
  }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderTimesheetTab(target, projectId, mode) {
  if (mode === 'admin') return renderTimesheetTabAdmin(target, projectId);

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

      target.innerHTML = `
        <div class="card">
          <div class="timesheet-clock">
            <button class="btn btn-primary" id="clock-btn">${isIn ? 'Pointer le départ' : "Pointer l'arrivée"}</button>
            <span class="status">${last ? (isIn ? `En cours depuis ${fmtDateTime(last.in.timestamp)}` : `Dernier départ : ${fmtDateTime(last.out.timestamp)}`) : 'Aucun pointage encore'}</span>
          </div>
          <div class="row" style="margin-top:14px">
            <div class="card" style="background:var(--gold-100);border:none;text-align:center;padding:14px">
              <div style="font-size:1.4rem;font-weight:700;color:var(--brown-900)">${fmtDuration(todayMs)}</div>
              <div class="empty" style="font-style:normal">Aujourd'hui</div>
            </div>
            <div class="card" style="background:var(--gold-100);border:none;text-align:center;padding:14px">
              <div style="font-size:1.4rem;font-weight:700;color:var(--brown-900)">${fmtDuration(weekMs)}</div>
              <div class="empty" style="font-style:normal">7 derniers jours</div>
            </div>
          </div>
        </div>
        <div class="card">
          <table>
            <thead><tr><th>Arrivée</th><th>Départ</th><th>Durée</th></tr></thead>
            <tbody>${shifts.map(s => `<tr>
              <td>${s.in ? fmtDateTime(s.in.timestamp) : '—'}</td>
              <td>${s.out ? fmtDateTime(s.out.timestamp) : (s.ongoing ? '<span class="badge badge-active">en cours</span>' : '—')}</td>
              <td>${s.ongoing ? '—' : fmtDuration(s.ms)}</td>
            </tr>`).join('') || '<tr><td colspan="3" class="empty">Aucun pointage.</td></tr>'}</tbody>
          </table>
        </div>`;
      document.getElementById('clock-btn').addEventListener('click', async () => {
        await db.collection('projects').doc(projectId).collection('timesheets').add({
          personUid: currentUser.uid, personName: currentPerson.name, type: isIn ? 'out' : 'in',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderTimesheetTabAdmin(target, projectId) {
  const unsub = db.collection('projects').doc(projectId).collection('timesheets').onSnapshot(snap => {
    const byPerson = {};
    snap.docs.forEach(d => {
      const e = d.data();
      (byPerson[e.personUid] ||= { name: e.personName, entries: [] }).entries.push(e);
    });
    const now = Date.now();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    target.innerHTML = `
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
  }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderRequestsTab(target, projectId, mode) {
  const canSubmit = mode === 'client';
  const unsub = db.collection('projects').doc(projectId).collection('requests').orderBy('createdAt', 'desc').onSnapshot(snap => {
    target.innerHTML = `
      ${canSubmit ? `
        <div class="card">
          <form id="request-form">
            <div class="field"><label>Votre demande</label><textarea id="request-text" required></textarea></div>
            <button type="submit" class="btn btn-primary btn-sm">Envoyer</button>
          </form>
        </div>` : ''}
      <div class="card">
        ${snap.empty ? '<p class="empty">Aucune demande.</p>' : snap.docs.map(d => {
          const r = d.data();
          return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <p class="empty" style="font-style:normal">${esc(r.fromName)} · ${fmtDateTime(r.createdAt)}</p>
              <span class="badge badge-${r.status}">${r.status === 'open' ? 'Ouverte' : 'Répondu'}</span>
            </div>
            <p style="margin-top:6px">${esc(r.text)}</p>
            ${r.response ? `<div class="note-box" style="margin-top:8px"><b>Réponse :</b> ${esc(r.response)}</div>` : ''}
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
  }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}
