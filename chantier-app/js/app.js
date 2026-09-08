// ============================================================
// BN CORE GROUP — App de suivi chantier
// Firebase Auth (email/mot de passe, comptes créés par l'admin dans la
// console Firebase) + Firestore (données) + Firestore Security Rules
// (contrôle d'accès réel, voir firestore.rules).
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

auth.onAuthStateChanged(async (user) => {
  clearSubscriptions();
  if (!user) {
    currentUser = null;
    currentPerson = null;
    renderLogin();
    return;
  }
  currentUser = user;
  app.innerHTML = '<div class="loading">Chargement de votre profil…</div>';
  try {
    const snap = await db.collection('people').doc(user.uid).get();
    if (!snap.exists) {
      app.innerHTML = `<div class="center-wrap"><div class="card">
        <h2>Compte non configuré</h2>
        <p style="margin-top:12px;color:var(--text-dim)">Votre compte existe mais n'a pas encore de profil (rôle, équipe ou client) associé. Contactez votre administrateur.</p>
        <button class="btn btn-outline mt-16" style="margin-top:16px" onclick="logout()">Se déconnecter</button>
      </div></div>`;
      return;
    }
    currentPerson = { id: user.uid, ...snap.data() };
    routeByRole();
  } catch (err) {
    app.innerHTML = `<div class="center-wrap"><div class="card error-box">Erreur de chargement du profil : ${esc(err.message)}</div></div>`;
  }
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
  const unsub = db.collection('people').onSnapshot(async (snap) => {
    const [teamsSnap, clientsSnap] = await Promise.all([db.collection('teams').get(), db.collection('clients').get()]);
    const teams = Object.fromEntries(teamsSnap.docs.map(d => [d.id, d.data()]));
    const clients = Object.fromEntries(clientsSnap.docs.map(d => [d.id, d.data()]));
    const teamOptions = Object.entries(teams).map(([id, t]) => `<option value="${id}">${esc(t.name)}</option>`).join('');
    const clientOptions = Object.entries(clients).map(([id, c]) => `<option value="${id}">${esc(c.name)}</option>`).join('');

    content.innerHTML = `
      <div class="note-box">
        <b>Comment ça marche :</b> créez d'abord le compte de connexion (email + mot de passe) dans la
        <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console Firebase</a> →
        Authentication → Add user. Copiez ensuite l'identifiant (UID) généré et complétez le profil ci-dessous
        avec ce même identifiant.
      </div>
      <div class="card">
        <h3>Associer un profil à un compte existant</h3>
        <form id="new-person-form" style="margin-top:10px">
          <div class="row">
            <div class="field"><label>UID du compte (Firebase Authentication)</label><input type="text" id="np2-uid" required placeholder="Copié depuis la console Firebase"></div>
            <div class="field"><label>Nom complet</label><input type="text" id="np2-name" required placeholder="Ex. : Ahmed B."></div>
          </div>
          <div class="row">
            <div class="field"><label>Rôle</label>
              <select id="np2-role">
                ${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
              </select>
            </div>
            <div class="field" id="np2-team-field"><label>Équipe (si personnel)</label><select id="np2-team"><option value="">—</option>${teamOptions}</select></div>
            <div class="field" id="np2-client-field" style="display:none"><label>Client (si compte client)</label><select id="np2-client"><option value="">—</option>${clientOptions}</select></div>
          </div>
          <button type="submit" class="btn btn-primary">Enregistrer le profil</button>
        </form>
      </div>
      <div class="card">
        ${snap.empty ? '<p class="empty">Aucun profil enregistré.</p>' : snap.docs.map(d => {
          const p = d.data();
          const context = p.role === 'client' ? (clients[p.clientId]?.name || '—') : (teams[p.teamId]?.name || '—');
          return `<div class="list-row">
            <div class="main"><div class="name">${esc(p.name)}</div><div class="sub">${ROLE_LABELS[p.role] || p.role} · ${esc(context)}</div></div>
            <div class="actions"><button class="btn btn-danger btn-sm" data-del-person="${d.id}">Retirer l'accès</button></div>
          </div>`;
        }).join('')}
      </div>`;

    const roleSelect = document.getElementById('np2-role');
    const toggleFields = () => {
      const isClient = roleSelect.value === 'client';
      document.getElementById('np2-team-field').style.display = isClient ? 'none' : '';
      document.getElementById('np2-client-field').style.display = isClient ? '' : 'none';
    };
    roleSelect.addEventListener('change', toggleFields);
    toggleFields();

    document.getElementById('new-person-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const uid = document.getElementById('np2-uid').value.trim();
      const name = document.getElementById('np2-name').value.trim();
      const role = roleSelect.value;
      const teamId = document.getElementById('np2-team').value || null;
      const clientId = document.getElementById('np2-client').value || null;
      if (!uid) return;
      try {
        await db.collection('people').doc(uid).set({ name, role, teamId: role === 'client' ? null : teamId, clientId: role === 'client' ? clientId : null });
        e.target.reset();
        toggleFields();
      } catch (err) {
        showError(content, "Erreur : " + err.message);
      }
    });

    content.querySelectorAll('[data-del-person]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm("Retirer l'accès de cette personne ? Son compte de connexion restera dans Firebase Authentication — désactivez-le là-bas si besoin.")) {
          await db.collection('people').doc(btn.dataset.delPerson).delete();
        }
      });
    });
  }, err => showError(content, "Erreur : " + err.message));
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
      else if (activeTab === 'timesheet') renderTimesheetTab(target, projectId);
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
          </div>`;
        }).join('')}
      </div>`;
    if (canPost) {
      document.getElementById('journal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('journal-text').value.trim();
        const visibleToClient = document.getElementById('journal-visible').checked;
        if (!text) return;
        await db.collection('projects').doc(projectId).collection('journal').add({
          text, visibleToClient, authorName: currentPerson.name, authorRole: currentPerson.role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
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
          </div>`;
        }).join('')}
      </div>`;
    if (canReport) {
      document.getElementById('problem-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('problem-title').value.trim();
        const description = document.getElementById('problem-desc').value.trim();
        if (!title || !description) return;
        await db.collection('projects').doc(projectId).collection('problems').add({
          title, description, status: 'reported', visibleToClient: false,
          reportedByName: currentPerson.name, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        e.target.reset();
      });
    }
  }, err => showError(target, "Erreur : " + err.message));
  unsubscribers.push(unsub);
}

function renderTimesheetTab(target, projectId) {
  // Filtered by personUid only (no orderBy on a different field) so this never needs
  // a manually-created Firestore composite index — sorted client-side instead.
  const unsub = db.collection('projects').doc(projectId).collection('timesheets')
    .where('personUid', '==', currentUser.uid)
    .onSnapshot(snap => {
      const docs = snap.docs.slice().sort((a, b) => {
        const ta = a.data().timestamp?.toMillis ? a.data().timestamp.toMillis() : 0;
        const tb = b.data().timestamp?.toMillis ? b.data().timestamp.toMillis() : 0;
        return tb - ta;
      }).slice(0, 30);
      const last = docs[0]?.data();
      const isIn = last && last.type === 'in';
      target.innerHTML = `
        <div class="card">
          <div class="timesheet-clock">
            <button class="btn btn-primary" id="clock-btn">${isIn ? 'Pointer le départ' : "Pointer l'arrivée"}</button>
            <span class="status">${last ? `Dernier pointage : ${last.type === 'in' ? 'arrivée' : 'départ'} à ${fmtDateTime(last.timestamp)}` : 'Aucun pointage encore'}</span>
          </div>
        </div>
        <div class="card">
          <table>
            <thead><tr><th>Type</th><th>Date et heure</th></tr></thead>
            <tbody>${docs.map(d => `<tr><td>${d.data().type === 'in' ? 'Arrivée' : 'Départ'}</td><td>${fmtDateTime(d.data().timestamp)}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">Aucun pointage.</td></tr>'}</tbody>
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
