// ============================================================
// Durées de conservation (RGPD art. 5.1.e) — purge automatique
// ============================================================
// Applique les durées annoncées dans la notice (js/notice.js) :
//   - position GPS et photos de pointage : 12 mois
//   - pointages et kilométrage : 5 ans
//   - journal et problèmes (texte + photos) : 5 ans après la clôture du projet
//   - compte révoqué : profil supprimé 12 mois après la révocation
// Les achats (reçus) et les frais facturés ne sont PAS purgés ici : ce sont
// des pièces liées à la facturation (10 ans, Code de droit économique
// art. III.88).
//
// Pas de serveur (forfait Firebase gratuit) : la purge tourne dans le
// navigateur de l'administrateur, au plus une fois par 24 h, à l'ouverture
// de l'app — plus un bouton « Lancer maintenant » dans l'onglet Comptes.
// Si l'admin n'ouvre pas l'app, rien n'est purgé : ouvrir l'app au moins
// une fois par mois suffit à respecter les durées à quelques jours près.
// ============================================================

const RETENTION = {
  geoPhotoMonths: 12,
  timesheetYears: 5,
  reportYearsAfterClose: 5,
  revokedAccountMonths: 12,
};
const RETENTION_DOC = () => db.collection('settings').doc('retention');

function monthsAgo(n) { const d = new Date(); d.setMonth(d.getMonth() - n); return d; }
function tsToDate(v) { return v && v.toDate ? v.toDate() : (v instanceof Date ? v : null); }

async function deletePhotoUrls(urls) {
  for (const url of urls || []) {
    try { await storage.refFromURL(url).delete(); }
    catch (err) { if (err.code !== 'storage/object-not-found') throw err; }
  }
}

async function runRetentionPurge() {
  const cutGeo = monthsAgo(RETENTION.geoPhotoMonths);
  const cutSheets = monthsAgo(RETENTION.timesheetYears * 12);
  const cutReports = monthsAgo(RETENTION.reportYearsAfterClose * 12);
  const cutRevoked = monthsAgo(RETENTION.revokedAccountMonths);
  const report = { geoPhotoCleared: 0, timesheetsDeleted: 0, mileageDeleted: 0, reportsDeleted: 0, accountsDeleted: 0, revokedDated: 0 };
  const authToDelete = [];

  const projects = await db.collection('projects').get();
  for (const p of projects.docs) {
    const ref = p.ref;
    // Pointages : > 5 ans supprimés ; > 12 mois : position et photos retirées.
    const oldSheets = await ref.collection('timesheets').where('timestamp', '<', cutGeo).get();
    for (const d of oldSheets.docs) {
      const e = d.data();
      const when = tsToDate(e.timestamp);
      if (when && when < cutSheets) {
        await deletePhotoUrls(e.photoUrls);
        await d.ref.delete();
        report.timesheetsDeleted++;
      } else if (e.geo || (e.photoUrls && e.photoUrls.length)) {
        await deletePhotoUrls(e.photoUrls);
        await d.ref.update({ geo: null, photoUrls: [], purgedAt: firebase.firestore.FieldValue.serverTimestamp() });
        report.geoPhotoCleared++;
      }
    }
    const oldMileage = await ref.collection('mileage').where('createdAt', '<', cutSheets).get();
    for (const d of oldMileage.docs) { await d.ref.delete(); report.mileageDeleted++; }

    // Rapports de chantier : 5 ans après la clôture du projet.
    const closedAt = tsToDate(p.data().closedAt);
    if (p.data().status === 'closed' && closedAt && closedAt < cutReports) {
      for (const sub of ['journal', 'problems']) {
        const snap = await ref.collection(sub).get();
        for (const d of snap.docs) {
          await deletePhotoUrls(d.data().photoUrls);
          await d.ref.delete();
          report.reportsDeleted++;
        }
      }
    }
  }

  // Comptes révoqués : on date les anciennes révocations (qui n'avaient pas
  // de date) pour démarrer le délai, puis on supprime le profil au terme.
  const revoked = await db.collection('people').where('revoked', '==', true).get();
  for (const d of revoked.docs) {
    const p = d.data();
    const since = tsToDate(p.revokedAt);
    if (!since) {
      await d.ref.update({ revokedAt: firebase.firestore.FieldValue.serverTimestamp() });
      report.revokedDated++;
    } else if (since < cutRevoked) {
      await d.ref.delete();
      authToDelete.push({ uid: d.id, name: p.name || '' });
      report.accountsDeleted++;
    }
  }

  const prev = (await RETENTION_DOC().get()).data() || {};
  await RETENTION_DOC().set({
    lastRunAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastReport: report,
    // Profils supprimés dont l'identifiant de connexion (e-mail) existe encore
    // dans Firebase Authentication — seul l'admin peut l'effacer, depuis la
    // console (l'app n'a pas ce droit sans serveur).
    authToDelete: [...(prev.authToDelete || []), ...authToDelete],
  }, { merge: true });
  return report;
}

// Appelé à l'ouverture de l'espace admin : au plus une fois par 24 h,
// silencieux (une erreur ne bloque jamais l'app, elle est seulement notée).
async function maybeRunRetentionPurge() {
  try {
    const snap = await RETENTION_DOC().get();
    const last = tsToDate(snap.exists ? snap.data().lastRunAt : null);
    if (last && Date.now() - last.getTime() < 24 * 3600 * 1000) return;
    await runRetentionPurge();
  } catch (err) {
    console.warn('Purge de conservation non effectuée :', err.message);
    try { await RETENTION_DOC().set({ lastError: err.message, lastErrorAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch (e) { /* hors ligne */ }
  }
}

// Carte « Conservation des données » dans l'onglet Comptes.
function renderRetentionCard(target) {
  const unsub = RETENTION_DOC().onSnapshot(snap => {
    const d = snap.exists ? snap.data() : {};
    const last = tsToDate(d.lastRunAt);
    const r = d.lastReport;
    const pending = d.authToDelete || [];
    target.innerHTML = `
      <p class="empty" style="font-style:normal;margin:4px 0 10px">
        Appliquée automatiquement (au plus une fois par jour) quand vous ouvrez l'app :
        position GPS et photos de pointage effacées après ${RETENTION.geoPhotoMonths} mois ; pointages et kilométrage
        supprimés après ${RETENTION.timesheetYears} ans ; journal et problèmes supprimés ${RETENTION.reportYearsAfterClose} ans après la clôture
        du projet ; profil d'une personne révoquée supprimé ${RETENTION.revokedAccountMonths} mois après la révocation.
        Achats et frais facturés conservés (pièces comptables, 10 ans).
      </p>
      <p><b>Dernière exécution :</b> ${last ? esc(last.toLocaleString('fr-BE')) : 'jamais'}</p>
      ${r ? `<p class="empty" style="font-style:normal">GPS/photos effacés : ${r.geoPhotoCleared} · pointages supprimés : ${r.timesheetsDeleted} · kilométrages supprimés : ${r.mileageDeleted} · rapports supprimés : ${r.reportsDeleted} · profils supprimés : ${r.accountsDeleted}</p>` : ''}
      ${d.lastError ? `<p class="error-box" style="margin-top:6px">Dernière erreur : ${esc(d.lastError)}</p>` : ''}
      ${pending.length ? `<div class="error-box" style="margin-top:8px"><b>À faire dans la console Firebase → Authentication</b> (supprimer ces identifiants de connexion) :
        <ul style="margin:6px 0 0 18px">${pending.map(p => `<li>${esc(p.name)} — <code>${esc(p.uid)}</code></li>`).join('')}</ul>
        <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px" id="retention-auth-done">C'est fait, vider la liste</button></div>` : ''}
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:10px" id="retention-run">Lancer maintenant</button>`;
    document.getElementById('retention-run').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Purge en cours…';
      try { await runRetentionPurge(); }
      catch (err) { showError(target, 'Erreur : ' + err.message); e.target.disabled = false; e.target.textContent = 'Lancer maintenant'; }
    });
    const done = document.getElementById('retention-auth-done');
    if (done) done.addEventListener('click', () => RETENTION_DOC().update({ authToDelete: [] }));
  }, err => showError(target, 'Erreur : ' + err.message));
  unsubscribers.push(unsub);
}
