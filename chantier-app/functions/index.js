// ============================================================
// Notifications push — App chantier BN CORE GROUP
// ============================================================
// Envoie une notification sur le téléphone (Firebase Cloud Messaging) à
// chaque étape d'une demande de personnel (js/staffing.js) :
//   - le client envoie une demande          -> admin(s)
//   - le client annule                       -> admin(s)
//   - l'admin ouvre aux volontaires          -> ouvriers concernés (équipe ou tous)
//   - un ouvrier se propose / se retire      -> admin(s)
//   - l'admin confirme l'équipe              -> client + ouvriers retenus
//   - l'admin refuse                         -> client
//
// Les téléphones s'abonnent via js/push.js (collection pushTokens).
// Nécessite le forfait Firebase « Blaze » (Cloud Functions). Région Europe.
// ============================================================

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });
const db = admin.firestore();

const APP_URL = 'https://app.bncoregroup.com/';
const STAFF_ROLES = ['engineer', 'electrician', 'worker'];

// ---- Textes (langue de la personne = celle de sa notice, sinon FR) ----
const TXT = {
  fr: {
    missionTitle: 'Nouvelle mission disponible',
    missionBody: (r) => `${site(r)} — ${dates(r)} à ${r.startTime || '?'} · ${r.peopleNeeded} pers. Ouvrez l'app, onglet Missions.`,
    plannedTitle: 'Vous êtes planifié(e)',
    plannedBody: (r) => `${site(r)} — ${dates(r)} à ${r.startTime || '?'}. Détails dans votre planning.`,
    confirmedTitle: 'Demande confirmée',
    confirmedBody: (r) => `${site(r)} — ${dates(r)} : ${(r.assignedNames || []).length} personne(s) confirmée(s).`,
    refusedTitle: 'Demande refusée',
    refusedBody: (r) => `${site(r)} — ${dates(r)}${r.adminNote ? ' · ' + r.adminNote : ''}`,
  },
  en: {
    missionTitle: 'New mission available',
    missionBody: (r) => `${site(r)} — ${dates(r)} at ${r.startTime || '?'} · ${r.peopleNeeded} people. Open the app, Missions tab.`,
    plannedTitle: 'You are scheduled',
    plannedBody: (r) => `${site(r)} — ${dates(r)} at ${r.startTime || '?'}. Details in your planning.`,
    confirmedTitle: 'Request confirmed',
    confirmedBody: (r) => `${site(r)} — ${dates(r)}: ${(r.assignedNames || []).length} person(s) confirmed.`,
    refusedTitle: 'Request declined',
    refusedBody: (r) => `${site(r)} — ${dates(r)}${r.adminNote ? ' · ' + r.adminNote : ''}`,
  },
  ro: {
    missionTitle: 'Misiune nouă disponibilă',
    missionBody: (r) => `${site(r)} — ${dates(r)} la ${r.startTime || '?'} · ${r.peopleNeeded} pers. Deschideți aplicația, fila Misiuni.`,
    plannedTitle: 'Sunteți planificat(ă)',
    plannedBody: (r) => `${site(r)} — ${dates(r)} la ${r.startTime || '?'}. Detalii în planificarea dvs.`,
    confirmedTitle: 'Cerere confirmată',
    confirmedBody: (r) => `${site(r)} — ${dates(r)}: ${(r.assignedNames || []).length} persoană(e) confirmată(e).`,
    refusedTitle: 'Cerere refuzată',
    refusedBody: (r) => `${site(r)} — ${dates(r)}${r.adminNote ? ' · ' + r.adminNote : ''}`,
  },
  zh: {
    missionTitle: '有新任务',
    missionBody: (r) => `${site(r)} — ${dates(r)} ${r.startTime || '?'} · ${r.peopleNeeded} 人。请打开应用的“任务”页。`,
    plannedTitle: '您已被安排',
    plannedBody: (r) => `${site(r)} — ${dates(r)} ${r.startTime || '?'}。详情见您的排班。`,
    confirmedTitle: '需求已确认',
    confirmedBody: (r) => `${site(r)} — ${dates(r)}：已确认 ${(r.assignedNames || []).length} 人。`,
    refusedTitle: '需求被拒绝',
    refusedBody: (r) => `${site(r)} — ${dates(r)}${r.adminNote ? ' · ' + r.adminNote : ''}`,
  },
};
function site(r) { return r.projectName || r.siteName || r.address || 'Chantier'; }
function fmt(d) { const [y, m, day] = String(d || '').split('-'); return day ? `${day}/${m}` : '?'; }
function dates(r) { return r.startDate === r.endDate ? fmt(r.startDate) : `${fmt(r.startDate)} → ${fmt(r.endDate)}`; }
function tx(lang) { return TXT[lang] || TXT.fr; }

// ---- Destinataires ----
async function activePeople(filterFn) {
  const snap = await db.collection('people').get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => !p.revoked && filterFn(p));
}
const admins = () => activePeople((p) => p.role === 'admin');
const clientUsers = (clientId) => activePeople((p) => p.role === 'client' && p.clientId === clientId);
const staffFor = (r) => activePeople((p) => STAFF_ROLES.includes(p.role) &&
  (r.audience === 'all' || (r.teamId && p.teamId === r.teamId)));
const byUids = (uids) => activePeople((p) => (uids || []).includes(p.uid));

// ---- Envoi ----
// people: [{uid, noticeLang}], build: (texts) => {title, body}
async function notify(people, build, tag) {
  if (!people.length) return 0;
  const uids = people.map((p) => p.uid);
  const tokensByUid = new Map();
  for (let i = 0; i < uids.length; i += 30) {
    const snap = await db.collection('pushTokens').where('uid', 'in', uids.slice(i, i + 30)).get();
    snap.docs.forEach((d) => {
      const uid = d.data().uid;
      if (!tokensByUid.has(uid)) tokensByUid.set(uid, []);
      tokensByUid.get(uid).push(d.id);
    });
  }
  let sent = 0;
  for (const p of people) {
    const tokens = tokensByUid.get(p.uid) || [];
    if (!tokens.length) continue;
    const { title, body } = build(tx(p.noticeLang));
    const message = {
      tokens,
      notification: { title, body },
      webpush: {
        notification: { icon: `${APP_URL}icons/icon-192.png`, badge: `${APP_URL}icons/icon-192.png`, tag },
        fcmOptions: { link: APP_URL },
      },
    };
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      // Tests locaux : on journalise au lieu d'envoyer vraiment.
      await db.collection('_pushLog').add({ uid: p.uid, title, body, tag, tokens: tokens.length, at: FieldValue.serverTimestamp() });
      sent += tokens.length;
      continue;
    }
    const res = await admin.messaging().sendEachForMulticast(message);
    sent += res.successCount;
    // Jetons morts (app désinstallée, notifications coupées) : on les retire.
    await Promise.all(res.responses.map((resp, i) => {
      const code = resp.error && resp.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        return db.collection('pushTokens').doc(tokens[i]).delete().catch(() => {});
      }
      return null;
    }));
  }
  return sent;
}

// ---- Déclencheurs ----
exports.onStaffRequestCreated = onDocumentCreated('staffRequests/{reqId}', async (event) => {
  const r = event.data.data();
  if (r.status !== 'pending') return;
  await notify(await admins(), () => ({
    title: 'Nouvelle demande de personnel',
    body: `${site(r)} — ${dates(r)} à ${r.startTime || '?'} · ${r.peopleNeeded} pers. (${r.createdByName || 'client'})`,
  }), `req-${event.params.reqId}`);
});

exports.onStaffRequestUpdated = onDocumentUpdated('staffRequests/{reqId}', async (event) => {
  const before = event.data.before.data();
  const r = event.data.after.data();
  const tag = `req-${event.params.reqId}`;
  if (before.status === r.status) return;

  if (r.status === 'open') {
    await notify(await staffFor(r), (t) => ({ title: t.missionTitle, body: t.missionBody(r) }), tag);
  } else if (r.status === 'assigned' || r.status === 'filled') {
    await notify(await clientUsers(r.clientId), (t) => ({ title: t.confirmedTitle, body: t.confirmedBody(r) }), tag);
    await notify(await byUids(r.assignedUids), (t) => ({ title: t.plannedTitle, body: t.plannedBody(r) }), tag);
  } else if (r.status === 'refused') {
    await notify(await clientUsers(r.clientId), (t) => ({ title: t.refusedTitle, body: t.refusedBody(r) }), tag);
  } else if (r.status === 'cancelled') {
    await notify(await admins(), () => ({ title: 'Demande annulée par le client', body: `${site(r)} — ${dates(r)}` }), tag);
  }
});

async function volunteerChange(event, verb) {
  const reqSnap = await db.collection('staffRequests').doc(event.params.reqId).get();
  if (!reqSnap.exists) return;
  const r = reqSnap.data();
  if (r.status !== 'open') return;
  const count = (await reqSnap.ref.collection('volunteers').count().get()).data().count;
  const v = event.data.data();
  await notify(await admins(), () => ({
    title: `${v.name || 'Un ouvrier'} ${verb}`,
    body: `${site(r)} — ${dates(r)} · ${count}/${r.peopleNeeded} volontaire(s)`,
  }), `vol-${event.params.reqId}`);
}
exports.onVolunteerAdded = onDocumentCreated('staffRequests/{reqId}/volunteers/{uid}', (e) => volunteerChange(e, 'se propose'));
exports.onVolunteerRemoved = onDocumentDeleted('staffRequests/{reqId}/volunteers/{uid}', (e) => volunteerChange(e, 'se retire'));

