// ============================================================
// Demandes de personnel (client -> BN CORE -> ouvriers)
// ============================================================
// 1. Le CLIENT demande du personnel : chantier (existant ou nouveau site),
//    travail à faire, du … au …, heure d'arrivée, nombre de personnes,
//    qualification souhaitée.
// 2. L'ADMIN décide, pour chaque demande :
//    - « Je choisis » : il coche les personnes -> créneaux de planning créés
//      directement (visibles dans le calendrier de chacun) ;
//    - « Ouvrir aux volontaires » : la mission apparaît dans l'onglet
//      « Missions » des ouvriers (d'une équipe ou de tous) ; chacun décide
//      s'il vient. Les N premiers sont « retenus », les suivants en liste
//      d'attente. L'admin valide ensuite l'équipe -> créneaux créés.
//    - « Refuser ».
// 3. Le client suit l'état de sa demande (reçue / recherche en cours /
//    confirmée / refusée) sans voir les pointages ni les coordonnées de
//    personne.
// Pas de notification téléphone : les ouvriers voient les missions en
// ouvrant l'app — prévenir par WhatsApp si c'est urgent.
// ============================================================

const STAFFING_I18N = {
  fr: {
    clientTitle: 'Demandes de personnel',
    clientNewBtn: '+ Demander du personnel',
    formTitle: 'Nouvelle demande de personnel',
    fProject: 'Chantier',
    fNewSite: 'Autre site / nouveau chantier',
    fSite: 'Nom et adresse du site',
    fWork: 'Travail à faire',
    fWorkPh: 'Ex. : remplacement de 4 modules, contrôle des serrages, container C-12',
    fStart: 'Du',
    fEnd: 'Au (inclus)',
    fTime: "Heure d'arrivée",
    fPeople: 'Nombre de personnes',
    fRole: 'Qualification souhaitée',
    fRoleAny: 'Indifférent',
    fNotes: 'Remarques (accès, EPI, contact sur place…)',
    send: 'Envoyer la demande',
    cancel: 'Annuler',
    cancelRequest: 'Annuler la demande',
    confirmCancel: 'Annuler cette demande ?',
    errDates: 'La date de fin doit être égale ou postérieure à la date de début.',
    errSite: 'Indiquez le nom et l\'adresse du site.',
    noRequests: 'Aucune demande pour le moment.',
    people: (n) => `${n} personne${n > 1 ? 's' : ''}`,
    from: 'du', to: 'au', at: 'à',
    stPending: 'Reçue — en cours de traitement',
    stOpen: 'Recherche de personnel en cours',
    stAssigned: 'Confirmée',
    stFilled: 'Confirmée',
    stRefused: 'Refusée',
    stCancelled: 'Annulée',
    staffTab: 'Missions',
    staffIntro: 'Missions proposées par BN CORE GROUP. Vous êtes libre de venir ou non : indiquez-le ici.',
    noMissions: 'Aucune mission ouverte pour le moment.',
    iCome: 'Je viens',
    iWithdraw: 'Je me retire',
    youConfirmed: 'Vous êtes retenu(e)',
    youWaitlist: 'Liste d\'attente',
    spots: (taken, needed) => `${Math.min(taken, needed)}/${needed} place${needed > 1 ? 's' : ''} prise${needed > 1 ? 's' : ''}`,
    full: 'Complet — liste d\'attente',
    reason: 'Motif',
  },
  en: {
    clientTitle: 'Staffing requests',
    clientNewBtn: '+ Request staff',
    formTitle: 'New staffing request',
    fProject: 'Site',
    fNewSite: 'Other site / new site',
    fSite: 'Site name and address',
    fWork: 'Work to be done',
    fWorkPh: 'E.g. replace 4 modules, torque checks, container C-12',
    fStart: 'From',
    fEnd: 'To (inclusive)',
    fTime: 'Arrival time',
    fPeople: 'Number of people',
    fRole: 'Required qualification',
    fRoleAny: 'Any',
    fNotes: 'Notes (access, PPE, on-site contact…)',
    send: 'Send request',
    cancel: 'Cancel',
    cancelRequest: 'Cancel request',
    confirmCancel: 'Cancel this request?',
    errDates: 'The end date must be the same as or after the start date.',
    errSite: 'Please enter the site name and address.',
    noRequests: 'No requests yet.',
    people: (n) => `${n} ${n > 1 ? 'people' : 'person'}`,
    from: 'from', to: 'to', at: 'at',
    stPending: 'Received — being processed',
    stOpen: 'Looking for staff',
    stAssigned: 'Confirmed',
    stFilled: 'Confirmed',
    stRefused: 'Declined',
    stCancelled: 'Cancelled',
    staffTab: 'Missions',
    staffIntro: 'Missions offered by BN CORE GROUP. You are free to come or not: let us know here.',
    noMissions: 'No open missions at the moment.',
    iCome: "I'm in",
    iWithdraw: 'Withdraw',
    youConfirmed: 'You are selected',
    youWaitlist: 'Waiting list',
    spots: (taken, needed) => `${Math.min(taken, needed)}/${needed} spot${needed > 1 ? 's' : ''} taken`,
    full: 'Full — waiting list',
    reason: 'Reason',
  },
  ro: {
    clientTitle: 'Cereri de personal',
    clientNewBtn: '+ Solicită personal',
    formTitle: 'Cerere nouă de personal',
    fProject: 'Șantier',
    fNewSite: 'Alt amplasament / șantier nou',
    fSite: 'Numele și adresa amplasamentului',
    fWork: 'Lucrări de efectuat',
    fWorkPh: 'Ex.: înlocuirea a 4 module, verificarea strângerilor, container C-12',
    fStart: 'De la',
    fEnd: 'Până la (inclusiv)',
    fTime: 'Ora sosirii',
    fPeople: 'Număr de persoane',
    fRole: 'Calificare dorită',
    fRoleAny: 'Oricare',
    fNotes: 'Observații (acces, EIP, persoană de contact…)',
    send: 'Trimite cererea',
    cancel: 'Renunță',
    cancelRequest: 'Anulează cererea',
    confirmCancel: 'Anulați această cerere?',
    errDates: 'Data de sfârșit trebuie să fie aceeași sau după data de început.',
    errSite: 'Introduceți numele și adresa amplasamentului.',
    noRequests: 'Nicio cerere deocamdată.',
    people: (n) => `${n} ${n > 1 ? 'persoane' : 'persoană'}`,
    from: 'de la', to: 'până la', at: 'la',
    stPending: 'Primită — în curs de procesare',
    stOpen: 'Căutăm personal',
    stAssigned: 'Confirmată',
    stFilled: 'Confirmată',
    stRefused: 'Refuzată',
    stCancelled: 'Anulată',
    staffTab: 'Misiuni',
    staffIntro: 'Misiuni propuse de BN CORE GROUP. Sunteți liber(ă) să veniți sau nu: indicați aici.',
    noMissions: 'Nicio misiune deschisă deocamdată.',
    iCome: 'Vin',
    iWithdraw: 'Mă retrag',
    youConfirmed: 'Sunteți selectat(ă)',
    youWaitlist: 'Listă de așteptare',
    spots: (taken, needed) => `${Math.min(taken, needed)}/${needed} locuri ocupate`,
    full: 'Complet — listă de așteptare',
    reason: 'Motiv',
  },
  zh: {
    clientTitle: '人员需求',
    clientNewBtn: '+ 申请人员',
    formTitle: '新的人员需求',
    fProject: '工地',
    fNewSite: '其他地点 / 新工地',
    fSite: '工地名称和地址',
    fWork: '工作内容',
    fWorkPh: '例如：更换 4 个模块、检查紧固扭矩、集装箱 C-12',
    fStart: '开始日期',
    fEnd: '结束日期（含）',
    fTime: '到达时间',
    fPeople: '人数',
    fRole: '所需资质',
    fRoleAny: '不限',
    fNotes: '备注（出入、劳保用品、现场联系人等）',
    send: '发送需求',
    cancel: '取消',
    cancelRequest: '撤销需求',
    confirmCancel: '确定撤销此需求吗？',
    errDates: '结束日期必须等于或晚于开始日期。',
    errSite: '请填写工地名称和地址。',
    noRequests: '暂无需求。',
    people: (n) => `${n} 人`,
    from: '从', to: '至', at: '时间',
    stPending: '已收到 — 处理中',
    stOpen: '正在寻找人员',
    stAssigned: '已确认',
    stFilled: '已确认',
    stRefused: '已拒绝',
    stCancelled: '已撤销',
    staffTab: '任务',
    staffIntro: 'BN CORE GROUP 发布的任务。是否参加由您自己决定，请在此告知。',
    noMissions: '目前没有开放的任务。',
    iCome: '我参加',
    iWithdraw: '我退出',
    youConfirmed: '您已入选',
    youWaitlist: '候补名单',
    spots: (taken, needed) => `已占 ${Math.min(taken, needed)}/${needed} 个名额`,
    full: '已满 — 候补名单',
    reason: '原因',
  },
};

function st(key, ...args) {
  const dict = STAFFING_I18N[getLang()] || STAFFING_I18N.fr;
  const v = dict[key] !== undefined ? dict[key] : STAFFING_I18N.fr[key];
  return typeof v === 'function' ? v(...args) : v;
}

const STAFF_ROLES = ['engineer', 'electrician', 'worker'];
const REQ_STATUS_KEY = { pending: 'stPending', open: 'stOpen', assigned: 'stAssigned', filled: 'stFilled', refused: 'stRefused', cancelled: 'stCancelled' };
const REQ_BADGE = { pending: 'reported', open: 'open', assigned: 'active', filled: 'active', refused: 'closed', cancelled: 'closed' };

function todayStr() { const d = new Date(); return dateStrOf(d.getFullYear(), d.getMonth(), d.getDate()); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return dateStrOf(d.getFullYear(), d.getMonth(), d.getDate()); }

// Jours du … au … inclus ; option : sans samedi ni dimanche.
function datesBetween(start, end, weekdaysOnly) {
  const out = [];
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  const cur = new Date(y1, m1 - 1, d1), last = new Date(y2, m2 - 1, d2);
  while (cur <= last && out.length < 366) {
    const wd = cur.getDay();
    if (!weekdaysOnly || (wd !== 0 && wd !== 6)) out.push(dateStrOf(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function requestSummaryHtml(r) {
  const site = r.projectName || r.siteName || '—';
  return `
    <div class="name" style="font-weight:600">${esc(site)}</div>
    <div class="sub">${esc(st('from'))} ${esc(fmtDateStr(r.startDate))} ${esc(st('to'))} ${esc(fmtDateStr(r.endDate))}${r.startTime ? ` · ${esc(st('at'))} ${esc(r.startTime)}` : ''} · ${esc(st('people', r.peopleNeeded))}${r.roleWanted ? ` · ${esc(roleLabel(r.roleWanted))}` : ''}</div>
    <p style="margin:6px 0 0;white-space:pre-wrap">${esc(r.work)}</p>
    ${r.notes ? `<p class="empty" style="font-style:normal;margin:4px 0 0;white-space:pre-wrap">${esc(r.notes)}</p>` : ''}`;
}

// Ordre d'inscription des volontaires ; une inscription pas encore
// confirmée par le serveur (hors ligne) passe en dernier.
function byArrival(a, b) {
  const ka = tsMillis(a.createdAt) || Number.MAX_SAFE_INTEGER, kb = tsMillis(b.createdAt) || Number.MAX_SAFE_INTEGER;
  return ka - kb;
}

function sortByStart(docs) {
  return docs.slice().sort((a, b) => (a.data().startDate || '').localeCompare(b.data().startDate || ''));
}

// ============================================================
// CLIENT
// ============================================================

// getProjects() : projets du client, tenus à jour par renderClient().
function renderClientStaffingSection(target, getProjects) {
  const unsub = db.collection('staffRequests').where('clientId', '==', currentPerson.clientId).onSnapshot(snap => {
    const docs = snap.docs.slice().sort((a, b) => tsMillis(b.data().createdAt) - tsMillis(a.data().createdAt));
    target.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <h2 class="section-title" style="margin:0">${esc(st('clientTitle'))}</h2>
        <button type="button" class="btn btn-primary btn-sm" id="staffing-new-btn">${esc(st('clientNewBtn'))}</button>
      </div>
      <div id="staffing-form-wrap"></div>
      <div class="card" style="margin-top:12px">
        ${docs.length ? docs.map(d => {
          const r = d.data();
          // Statut et bouton SOUS la demande (pas à côté) : lisible sur téléphone.
          return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">${requestSummaryHtml(r)}
            ${r.status === 'refused' && r.adminNote ? `<p class="empty" style="font-style:normal;margin:4px 0 0">${esc(st('reason'))} : ${esc(r.adminNote)}</p>` : ''}
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
              <span class="badge badge-${REQ_BADGE[r.status] || 'closed'}">${esc(st(REQ_STATUS_KEY[r.status] || 'stPending'))}</span>
              ${r.status === 'pending' ? `<button type="button" class="btn btn-outline btn-sm" data-cancel-req="${d.id}">${esc(st('cancelRequest'))}</button>` : ''}
            </div></div>`;
        }).join('') : `<p class="empty">${esc(st('noRequests'))}</p>`}
      </div>`;
    document.getElementById('staffing-new-btn').addEventListener('click', () => renderClientStaffingForm(document.getElementById('staffing-form-wrap'), getProjects()));
    target.querySelectorAll('[data-cancel-req]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm(st('confirmCancel'))) return;
      try { await db.collection('staffRequests').doc(btn.dataset.cancelReq).update({ status: 'cancelled' }); }
      catch (err) { showError(target, t('errorPrefix') + err.message); }
    }));
  }, err => showError(target, t('loadError') + err.message));
  unsubscribers.push(unsub);
}

function renderClientStaffingForm(wrap, projects) {
  const active = projects.filter(p => p.status !== 'closed');
  wrap.innerHTML = `
    <div class="card" style="margin-top:12px">
      <h3>${esc(st('formTitle'))}</h3>
      <form id="staffing-form" style="margin-top:10px">
        <div class="field"><label>${esc(st('fProject'))}</label>
          <select id="sr-project">
            ${active.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
            <option value="">${esc(st('fNewSite'))}</option>
          </select>
        </div>
        <div class="field" id="sr-site-field" style="${active.length ? 'display:none' : ''}"><label>${esc(st('fSite'))}</label><input type="text" id="sr-site" maxlength="200"></div>
        <div class="field"><label>${esc(st('fWork'))}</label><textarea id="sr-work" rows="3" required maxlength="2000" placeholder="${esc(st('fWorkPh'))}"></textarea></div>
        <div class="row">
          <div class="field"><label>${esc(st('fStart'))}</label><input type="date" id="sr-start" required value="${tomorrowStr()}" min="${todayStr()}"></div>
          <div class="field"><label>${esc(st('fEnd'))}</label><input type="date" id="sr-end" required value="${tomorrowStr()}" min="${todayStr()}"></div>
          <div class="field"><label>${esc(st('fTime'))}</label><input type="time" id="sr-time" value="07:30"></div>
        </div>
        <div class="row">
          <div class="field"><label>${esc(st('fPeople'))}</label><input type="number" id="sr-people" required min="1" max="50" value="2"></div>
          <div class="field"><label>${esc(st('fRole'))}</label>
            <select id="sr-role"><option value="">${esc(st('fRoleAny'))}</option>${STAFF_ROLES.map(r => `<option value="${r}">${esc(roleLabel(r))}</option>`).join('')}</select>
          </div>
        </div>
        <div class="field"><label>${esc(st('fNotes'))}</label><textarea id="sr-notes" rows="2" maxlength="1000"></textarea></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="submit" class="btn btn-primary">${esc(st('send'))}</button>
          <button type="button" class="btn btn-outline" id="sr-cancel">${esc(st('cancel'))}</button>
        </div>
      </form>
    </div>`;
  const projSel = document.getElementById('sr-project');
  const siteField = document.getElementById('sr-site-field');
  projSel.addEventListener('change', () => { siteField.style.display = projSel.value ? 'none' : ''; });
  const startIn = document.getElementById('sr-start'), endIn = document.getElementById('sr-end');
  startIn.addEventListener('change', () => { if (endIn.value < startIn.value) endIn.value = startIn.value; endIn.min = startIn.value; });
  document.getElementById('sr-cancel').addEventListener('click', () => { wrap.innerHTML = ''; });
  document.getElementById('staffing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const projectId = projSel.value || null;
    const project = projectId ? active.find(p => p.id === projectId) : null;
    const siteName = document.getElementById('sr-site').value.trim();
    if (startIn.value > endIn.value) return showError(form, st('errDates'));
    if (!projectId && !siteName) return showError(form, st('errSite'));
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await db.collection('staffRequests').add({
        clientId: currentPerson.clientId,
        projectId, projectName: project ? project.name : null, siteName: projectId ? null : siteName,
        work: document.getElementById('sr-work').value.trim(),
        startDate: startIn.value, endDate: endIn.value,
        startTime: document.getElementById('sr-time').value || null,
        peopleNeeded: Math.max(1, Math.min(50, parseInt(document.getElementById('sr-people').value, 10) || 1)),
        roleWanted: document.getElementById('sr-role').value || null,
        notes: document.getElementById('sr-notes').value.trim() || null,
        status: 'pending',
        createdByUid: currentUser.uid, createdByName: currentPerson.name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      wrap.innerHTML = '';
    } catch (err) {
      btn.disabled = false;
      showError(form, t('errorPrefix') + err.message);
    }
  });
}

// ============================================================
// PERSONNEL : onglet « Missions »
// ============================================================

function renderStaffMissions(wrap) {
  wrap.innerHTML = `<p class="empty" style="font-style:normal;margin-bottom:10px">${esc(st('staffIntro'))}</p><div id="missions-list"><div class="loading">${esc(t('loadingGeneric'))}</div></div>`;
  const list = document.getElementById('missions-list');
  const byId = new Map();
  const volunteersByReq = new Map();
  const volUnsubs = new Map();

  const draw = () => {
    const docs = sortByStart([...byId.values()]).filter(d => d.data().endDate >= todayStr());
    if (!docs.length) { list.innerHTML = `<p class="empty">${esc(st('noMissions'))}</p>`; return; }
    list.innerHTML = docs.map(d => {
      const r = d.data();
      const vols = volunteersByReq.get(d.id) || [];
      const idx = vols.findIndex(v => v.id === currentUser.uid);
      const mine = idx >= 0;
      const status = mine ? (idx < r.peopleNeeded ? st('youConfirmed') : st('youWaitlist')) : null;
      return `<div class="card"><div class="list-row" style="border:none;padding:0"><div class="main">${requestSummaryHtml(r)}
          <p class="empty" style="font-style:normal;margin:6px 0 0">${esc(vols.length >= r.peopleNeeded ? st('full') : st('spots', vols.length, r.peopleNeeded))}</p>
        </div></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
          ${mine ? `<span class="badge badge-${idx < r.peopleNeeded ? 'active' : 'reported'}">${esc(status)}</span>
                    <button type="button" class="btn btn-outline btn-sm" data-withdraw="${d.id}">${esc(st('iWithdraw'))}</button>`
                 : `<button type="button" class="btn btn-primary btn-sm" data-come="${d.id}">${esc(st('iCome'))}</button>`}
        </div></div>`;
    }).join('');
    list.querySelectorAll('[data-come]').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await db.collection('staffRequests').doc(btn.dataset.come).collection('volunteers').doc(currentUser.uid).set({
          uid: currentUser.uid, name: currentPerson.name, role: currentPerson.role, teamId: currentPerson.teamId || null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) { btn.disabled = false; showError(list, t('errorPrefix') + err.message); }
    }));
    list.querySelectorAll('[data-withdraw]').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await db.collection('staffRequests').doc(btn.dataset.withdraw).collection('volunteers').doc(currentUser.uid).delete(); }
      catch (err) { btn.disabled = false; showError(list, t('errorPrefix') + err.message); }
    }));
  };

  const watchVolunteers = (reqId) => {
    if (volUnsubs.has(reqId)) return;
    const u = db.collection('staffRequests').doc(reqId).collection('volunteers').onSnapshot(vs => {
      volunteersByReq.set(reqId, vs.docs.map(v => ({ id: v.id, ...v.data() })).sort(byArrival));
      draw();
    }, () => { /* mission fermée entre-temps : plus lisible, on l'ignore */ });
    volUnsubs.set(reqId, u);
    unsubscribers.push(u);
  };

  // Deux requêtes (missions ouvertes à tous + missions de mon équipe) :
  // les règles Firestore n'autorisent que ces formes de requête.
  const sources = { all: new Set(), team: new Set() };
  const onSnap = (key) => (snap) => {
    sources[key] = new Set(snap.docs.map(d => d.id));
    snap.docs.forEach(d => { byId.set(d.id, d); watchVolunteers(d.id); });
    for (const id of [...byId.keys()]) if (!sources.all.has(id) && !sources.team.has(id)) byId.delete(id);
    draw();
  };
  const base = db.collection('staffRequests').where('status', '==', 'open');
  unsubscribers.push(base.where('audience', '==', 'all').onSnapshot(onSnap('all'), err => showError(list, t('loadError') + err.message)));
  if (currentPerson.teamId) {
    unsubscribers.push(base.where('teamId', '==', currentPerson.teamId).onSnapshot(onSnap('team'), err => showError(list, t('loadError') + err.message)));
  }
}

// ============================================================
// ADMIN : onglet « Personnel demandé »
// ============================================================

function renderAdminStaffing(content) {
  content.innerHTML = '<div class="loading">Chargement…</div>';
  Promise.all([
    db.collection('people').get(), db.collection('teams').get(), db.collection('clients').get(), db.collection('projects').get(),
  ]).then(([peopleSnap, teamsSnap, clientsSnap, projectsSnap]) => {
    const staff = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(p => STAFF_ROLES.includes(p.role) && !p.revoked).sort((a, b) => a.name.localeCompare(b.name));
    const teams = Object.fromEntries(teamsSnap.docs.map(d => [d.id, d.data()]));
    const clients = Object.fromEntries(clientsSnap.docs.map(d => [d.id, d.data()]));
    const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const unsub = db.collection('staffRequests').onSnapshot(snap => {
      const rank = { pending: 0, open: 1, assigned: 2, filled: 2, refused: 3, cancelled: 3 };
      const docs = snap.docs.slice().sort((a, b) =>
        (rank[a.data().status] ?? 9) - (rank[b.data().status] ?? 9) || (a.data().startDate || '').localeCompare(b.data().startDate || ''));
      content.innerHTML = `
        <div class="card">
          <h3>Demandes de personnel des clients</h3>
          <p class="empty" style="font-style:normal;margin:4px 0 0">
            Pour chaque demande : <b>Je choisis</b> les personnes (créneaux créés directement dans le calendrier), ou
            <b>Ouvrir aux volontaires</b> — les ouvriers la voient dans leur onglet « Missions » et décident eux-mêmes s'ils viennent ;
            les premiers inscrits sont retenus, les suivants en liste d'attente. Vous validez ensuite l'équipe.
            Pas de notification téléphone : prévenez par WhatsApp si c'est urgent.
          </p>
        </div>
        ${docs.length ? docs.map(d => adminRequestCardHtml(d.id, d.data(), clients, teams)).join('') : '<p class="empty">Aucune demande.</p>'}`;
      docs.forEach(d => wireAdminRequestCard(d.id, d.data(), { staff, teams, projects }));
    }, err => showError(content, 'Erreur : ' + err.message));
    unsubscribers.push(unsub);
  }).catch(err => showError(content, 'Erreur : ' + err.message));
}

function adminRequestCardHtml(id, r, clients, teams) {
  const audience = r.status === 'open' ? (r.audience === 'all' ? 'tous les ouvriers' : `équipe ${teams[r.teamId]?.name || '—'}`) : null;
  return `<div class="card" id="req-${id}">
    <div class="list-row" style="border:none;padding:0">
      <div class="main">
        <div class="sub">${esc(clients[r.clientId]?.name || '—')} · demandé par ${esc(r.createdByName || '—')} le ${fmtDateTime(r.createdAt)}</div>
        ${requestSummaryHtml(r)}
        ${audience ? `<div class="sub" style="margin-top:4px">Ouvert à : ${esc(audience)}</div>` : ''}
        ${r.assignedNames && r.assignedNames.length ? `<div class="sub" style="margin-top:4px">Équipe : ${r.assignedNames.map(esc).join(', ')}</div>` : ''}
        ${r.adminNote ? `<div class="sub" style="margin-top:4px">Motif : ${esc(r.adminNote)}</div>` : ''}
      </div>
      <div class="actions"><span class="badge badge-${REQ_BADGE[r.status] || 'closed'}">${esc(STAFFING_I18N.fr[REQ_STATUS_KEY[r.status]] || r.status)}</span></div>
    </div>
    <div id="req-actions-${id}" style="margin-top:10px"></div>
  </div>`;
}

function projectOptionsFor(r, projects) {
  const mine = projects.filter(p => p.clientId === r.clientId && p.status !== 'closed');
  return mine.map(p => `<option value="${esc(p.id)}" ${p.id === r.projectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

function wireAdminRequestCard(id, r, ctx) {
  const box = document.getElementById(`req-actions-${id}`);
  if (!box) return;
  const ref = db.collection('staffRequests').doc(id);
  const noProjectHint = r.projectId ? '' : `<p class="empty" style="font-style:normal">Nouveau site demandé : « ${esc(r.siteName || '')} ». Créez d'abord le projet (onglet Projets) pour ce client, puis choisissez-le ici.</p>`;

  if (r.status === 'pending') {
    box.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary btn-sm" data-mode="assign">Je choisis les personnes</button>
        <button type="button" class="btn btn-outline btn-sm" data-mode="open">Ouvrir aux volontaires</button>
        <button type="button" class="btn btn-danger btn-sm" data-mode="refuse">Refuser</button>
      </div><div class="panel" style="margin-top:10px"></div>`;
    const panel = box.querySelector('.panel');
    box.querySelector('[data-mode="assign"]').addEventListener('click', () => {
      panel.innerHTML = `${noProjectHint}
        <div class="field"><label>Projet</label><select class="p-project">${projectOptionsFor(r, ctx.projects) || '<option value="">Aucun projet actif pour ce client</option>'}</select></div>
        <div class="field"><label>Personnes (${r.peopleNeeded} demandée${r.peopleNeeded > 1 ? 's' : ''}${r.roleWanted ? ', ' + esc(roleLabel(r.roleWanted)) : ''})</label>
          <div>${ctx.staff.map(p => `<label style="display:block;font-weight:normal"><input type="checkbox" value="${esc(p.id)}"> ${esc(p.name)} — ${esc(roleLabel(p.role))} · ${esc(ctx.teams[p.teamId]?.name || '—')}</label>`).join('') || '<p class="empty">Aucun membre du personnel.</p>'}</div></div>
        <label style="display:block;font-weight:normal;margin:6px 0"><input type="checkbox" class="p-weekdays"> Exclure samedi et dimanche de la période</label>
        <button type="button" class="btn btn-primary btn-sm p-go">Créer les créneaux et confirmer au client</button>`;
      panel.querySelector('.p-go').addEventListener('click', async (e) => {
        const projectId = panel.querySelector('.p-project').value;
        const chosen = [...panel.querySelectorAll('input[type=checkbox][value]:checked')].map(i => ctx.staff.find(p => p.id === i.value));
        if (!projectId) return showError(panel, 'Choisissez un projet.');
        if (!chosen.length) return showError(panel, 'Cochez au moins une personne.');
        if (chosen.length !== r.peopleNeeded && !confirm(`${chosen.length} personne(s) choisie(s) pour ${r.peopleNeeded} demandée(s). Continuer ?`)) return;
        e.target.disabled = true;
        try { await confirmStaffingTeam(ref, r, projectId, chosen, panel.querySelector('.p-weekdays').checked, 'assigned', ctx); }
        catch (err) { e.target.disabled = false; showError(panel, 'Erreur : ' + err.message); }
      });
    });
    box.querySelector('[data-mode="open"]').addEventListener('click', () => {
      const projectTeam = r.projectId ? ctx.projects.find(p => p.id === r.projectId)?.teamId : null;
      panel.innerHTML = `
        <div class="field"><label>Qui peut voir cette mission et se proposer ?</label>
          <select class="p-audience">
            <option value="all">Tous les ouvriers (toutes équipes)</option>
            ${Object.entries(ctx.teams).map(([tid, tm]) => `<option value="${esc(tid)}" ${tid === projectTeam ? 'selected' : ''}>Seulement l'équipe ${esc(tm.name)}</option>`).join('')}
          </select></div>
        <button type="button" class="btn btn-primary btn-sm p-go">Publier la mission</button>`;
      panel.querySelector('.p-go').addEventListener('click', async (e) => {
        const aud = panel.querySelector('.p-audience').value;
        e.target.disabled = true;
        try { await ref.update({ status: 'open', audience: aud === 'all' ? 'all' : 'team', teamId: aud === 'all' ? null : aud, openedAt: firebase.firestore.FieldValue.serverTimestamp() }); }
        catch (err) { e.target.disabled = false; showError(panel, 'Erreur : ' + err.message); }
      });
    });
    box.querySelector('[data-mode="refuse"]').addEventListener('click', async () => {
      const note = prompt('Motif (visible par le client) :', '');
      if (note === null) return;
      await ref.update({ status: 'refused', adminNote: note.trim() || null });
    });
    return;
  }

  if (r.status === 'open') {
    box.innerHTML = '<div class="loading">Chargement des volontaires…</div>';
    const u = ref.collection('volunteers').onSnapshot(vs => {
      const vols = vs.docs.map(v => ({ id: v.id, ...v.data() })).sort(byArrival);
      box.innerHTML = `${noProjectHint}
        <div class="sub"><b>Volontaires : ${vols.length}</b> pour ${r.peopleNeeded} place${r.peopleNeeded > 1 ? 's' : ''} (les premiers inscrits sont cochés)</div>
        <div>${vols.map((v, i) => `<label style="display:block;font-weight:normal"><input type="checkbox" value="${esc(v.id)}" ${i < r.peopleNeeded ? 'checked' : ''}>
            ${esc(v.name)} — ${esc(roleLabel(v.role))} · ${esc(ctx.teams[v.teamId]?.name || '—')} · inscrit le ${fmtDateTime(v.createdAt)}${i >= r.peopleNeeded ? ' <span class="badge badge-reported">liste d\'attente</span>' : ''}</label>`).join('') || '<p class="empty">Personne pour l\'instant.</p>'}</div>
        <div class="field" style="margin-top:8px"><label>Projet</label><select class="p-project">${projectOptionsFor(r, ctx.projects) || '<option value="">Aucun projet actif pour ce client</option>'}</select></div>
        <label style="display:block;font-weight:normal;margin:6px 0"><input type="checkbox" class="p-weekdays"> Exclure samedi et dimanche de la période</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-primary btn-sm p-go">Valider l'équipe cochée</button>
          <button type="button" class="btn btn-outline btn-sm p-close">Retirer la mission (repasser en attente)</button>
        </div>`;
      box.querySelector('.p-go').addEventListener('click', async (e) => {
        const projectId = box.querySelector('.p-project').value;
        const chosenIds = [...box.querySelectorAll('input[type=checkbox][value]:checked')].map(i => i.value);
        const chosen = chosenIds.map(cid => ctx.staff.find(p => p.id === cid) || vols.find(v => v.id === cid)).filter(Boolean)
          .map(p => ({ id: p.id, name: p.name, teamId: p.teamId || null }));
        if (!projectId) return showError(box, 'Choisissez un projet.');
        if (!chosen.length) return showError(box, 'Cochez au moins une personne.');
        e.target.disabled = true;
        try { await confirmStaffingTeam(ref, r, projectId, chosen, box.querySelector('.p-weekdays').checked, 'filled', ctx); }
        catch (err) { e.target.disabled = false; showError(box, 'Erreur : ' + err.message); }
      });
      box.querySelector('.p-close').addEventListener('click', () => ref.update({ status: 'pending', audience: null, teamId: null }));
    }, err => showError(box, 'Erreur : ' + err.message));
    unsubscribers.push(u);
    return;
  }
  box.innerHTML = '';
}

// Crée un créneau de planning par personne et par jour, puis confirme la
// demande (le client la voit « Confirmée »).
async function confirmStaffingTeam(ref, r, projectId, people, weekdaysOnly, finalStatus, ctx) {
  const project = ctx.projects.find(p => p.id === projectId);
  const dates = datesBetween(r.startDate, r.endDate, weekdaysOnly);
  if (!dates.length) throw new Error('Aucun jour dans la période (week-end uniquement ?) — décochez « Exclure samedi et dimanche ».');
  let batch = db.batch(), n = 0;
  for (const p of people) {
    for (const date of dates) {
      batch.set(db.collection('assignments').doc(), {
        personUid: p.id, personName: p.name, teamId: p.teamId || null,
        projectId, projectName: project.name, projectColor: project.color || DEFAULT_PROJECT_COLOR,
        date, staffRequestId: ref.id, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
  }
  batch.update(ref, {
    status: finalStatus, projectId, projectName: project.name,
    assignedUids: people.map(p => p.id), assignedNames: people.map(p => p.name),
    confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}
