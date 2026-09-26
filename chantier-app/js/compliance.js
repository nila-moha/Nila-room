// ============================================================
// Passeport de conformité par ouvrier
// ============================================================
// Limosa-1 et A1 (ouvrier détaché), VCA, habilitation électrique BA4/BA5
// (désignée par l'employeur — RGIE), aptitude médicale et carte d'identité :
// date de validité + document justificatif. Alerte 30 jours avant
// l'expiration (serveur, functions/index.js). Une mission qui exige une
// habilitation n'est ouverte qu'aux ouvriers habilités (vérifié aussi par
// les règles Firestore). Le client voit un résumé « équipe conforme »,
// jamais les documents eux-mêmes.
//
// Minimisation RGPD : pour la carte d'identité et l'aptitude médicale, on
// ne garde QUE la date de validité — aucune copie, aucune donnée médicale.
// ============================================================

const COMP_TYPES = ['limosa', 'a1', 'vca', 'ba', 'medical', 'idcard'];
const COMP_LABELS = {
  limosa: { fr: 'Déclaration Limosa-1', en: 'Limosa-1 declaration', ro: 'Declarație Limosa-1', zh: 'Limosa-1 申报' },
  a1: { fr: 'Certificat A1 (sécurité sociale)', en: 'A1 certificate (social security)', ro: 'Certificat A1 (asigurări sociale)', zh: 'A1 证明（社会保险）' },
  vca: { fr: 'Certificat VCA', en: 'VCA certificate', ro: 'Certificat VCA', zh: 'VCA 安全证书' },
  ba: { fr: 'Habilitation électrique', en: 'Electrical authorisation', ro: 'Autorizare electrică', zh: '电工资质' },
  medical: { fr: 'Aptitude médicale (date uniquement)', en: 'Medical fitness (date only)', ro: 'Aviz medical (doar data)', zh: '体检合格（仅日期）' },
  idcard: { fr: "Pièce d'identité (date uniquement)", en: 'ID document (date only)', ro: 'Act de identitate (doar data)', zh: '身份证件（仅日期）' },
};
const COMP_I18N = {
  fr: { myDocs: 'Mes documents', ok: 'Valide', soon: 'Expire bientôt', expired: 'Expiré', missing: 'Manquant', until: "jusqu'au", none: 'Aucun document enregistré. Contactez BN CORE GROUP.',
    baRequired: (l) => `Habilitation ${l} requise`, notQualified: (l) => `Vous n'avez pas d'habilitation ${l} valide : mission réservée.`,
    teamCompliance: 'Conformité de l’équipe', checkedOn: (d) => `vérifiée le ${d}`, allOk: 'Tous les documents requis sont valides.' },
  en: { myDocs: 'My documents', ok: 'Valid', soon: 'Expires soon', expired: 'Expired', missing: 'Missing', until: 'until', none: 'No document recorded. Contact BN CORE GROUP.',
    baRequired: (l) => `${l} authorisation required`, notQualified: (l) => `You have no valid ${l} authorisation: mission restricted.`,
    teamCompliance: 'Team compliance', checkedOn: (d) => `checked on ${d}`, allOk: 'All required documents are valid.' },
  ro: { myDocs: 'Documentele mele', ok: 'Valabil', soon: 'Expiră curând', expired: 'Expirat', missing: 'Lipsă', until: 'până la', none: 'Niciun document înregistrat. Contactați BN CORE GROUP.',
    baRequired: (l) => `Autorizare ${l} necesară`, notQualified: (l) => `Nu aveți o autorizare ${l} valabilă: misiune rezervată.`,
    teamCompliance: 'Conformitatea echipei', checkedOn: (d) => `verificată la ${d}`, allOk: 'Toate documentele necesare sunt valabile.' },
  zh: { myDocs: '我的证件', ok: '有效', soon: '即将到期', expired: '已过期', missing: '缺失', until: '有效期至', none: '尚无证件记录。请联系 BN CORE GROUP。',
    baRequired: (l) => `需要 ${l} 资质`, notQualified: (l) => `您没有有效的 ${l} 资质：此任务受限。`,
    teamCompliance: '团队合规情况', checkedOn: (d) => `核查于 ${d}`, allOk: '所有必需证件均有效。' },
};
function cp(key, ...a) { const d = COMP_I18N[getLang()] || COMP_I18N.fr; const v = d[key] ?? COMP_I18N.fr[key]; return typeof v === 'function' ? v(...a) : v; }
function compLabel(k) { const x = COMP_LABELS[k]; return x[getLang()] || x.fr; }

const SOON_MS = 30 * 86400000;
function compDate(v) { return v && v.toDate ? v.toDate() : (v ? new Date(v) : null); }

// Documents exigés : Limosa + A1 si détaché ; habilitation pour électricien
// et ingénieur ; VCA pour tous (exigence courante des EPC sur site BESS).
function requiredCompTypes(person, comp) {
  const req = ['vca'];
  if (comp && comp.posted) req.push('limosa', 'a1');
  if (['electrician', 'engineer'].includes(person.role)) req.push('ba');
  return req;
}
function compItemStatus(comp, type, required) {
  const it = comp && comp.items && comp.items[type];
  const until = it && compDate(it.validUntil);
  if (!until) return required ? 'missing' : null;
  const ms = until.getTime() - Date.now();
  return ms < 0 ? 'expired' : ms < SOON_MS ? 'soon' : 'ok';
}
const COMP_RANK = { ok: 0, soon: 1, missing: 2, expired: 3 };
function compOverall(person, comp) {
  const req = requiredCompTypes(person, comp);
  let worst = 'ok';
  const problems = [];
  for (const type of COMP_TYPES) {
    const st = compItemStatus(comp, type, req.includes(type));
    if (!st) continue;
    if (COMP_RANK[st] > COMP_RANK[worst]) worst = st;
    if (st !== 'ok') problems.push({ type, st });
  }
  return { status: worst, problems };
}
function compBadgeHtml(status, text) {
  const cls = { ok: 'badge-active', soon: 'badge-reported', missing: 'badge-open', expired: 'badge-open' }[status] || 'badge-closed';
  const icon = { ok: '✅', soon: '⚠', missing: '⛔', expired: '⛔' }[status] || '';
  return `<span class="badge ${cls}">${icon} ${esc(text || cp(status))}</span>`;
}
// Résumé court pour les listes admin (choix des personnes).
function compShortHtml(person, comp) {
  const o = compOverall(person, comp);
  if (o.status === 'ok') return ' ' + compBadgeHtml('ok', 'Conforme');
  return ' ' + compBadgeHtml(o.status, o.problems.map(p => `${compLabel(p.type).split(' (')[0]} : ${cp(p.st).toLowerCase()}`).join(', '));
}
// L'ouvrier a-t-il l'habilitation demandée (BA4 : BA4 ou BA5 ; BA5 : BA5) ?
function hasValidBa(comp, required) {
  if (!required) return true;
  const it = comp && comp.items && comp.items.ba;
  const until = it && compDate(it.validUntil);
  if (!until || until.getTime() < Date.now()) return false;
  return required === 'BA4' ? ['BA4', 'BA5'].includes(it.level) : it.level === 'BA5';
}

async function loadAllCompliance() {
  const snap = await db.collection('compliance').get();
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}
async function loadMyCompliance() {
  const snap = await db.collection('compliance').doc(currentUser.uid).get();
  return snap.exists ? snap.data() : null;
}

// ---- Ouvrier : onglet « Mes documents » ----
async function renderMyCompliance(wrap) {
  wrap.innerHTML = `<div class="loading">${esc(t('loadingGeneric'))}</div>`;
  let comp = null;
  try { comp = await loadMyCompliance(); } catch (e) { /* hors ligne */ }
  if (!wrap.isConnected) return;
  const req = requiredCompTypes(currentPerson, comp);
  const rows = COMP_TYPES.map(type => {
    const st = compItemStatus(comp, type, req.includes(type));
    if (!st) return '';
    const it = (comp && comp.items && comp.items[type]) || {};
    return `<div class="list-row"><div class="main"><div class="name">${esc(compLabel(type))}${type === 'ba' && it.level ? ' — ' + esc(it.level) : ''}</div>
      <div class="sub">${it.validUntil ? esc(cp('until')) + ' ' + esc(fmtDate(it.validUntil)) : ''}${it.fileUrl ? ` · <a href="${esc(it.fileUrl)}" target="_blank" rel="noopener">📄</a>` : ''}</div></div>
      <div class="actions">${compBadgeHtml(st)}</div></div>`;
  }).join('');
  wrap.innerHTML = `<div class="card"><h3 style="font-size:1rem">${esc(cp('myDocs'))}</h3>${rows || `<p class="empty">${esc(cp('none'))}</p>`}</div>`;
}

// ---- Admin : édition du passeport (depuis l'onglet Comptes) ----
function openComplianceEditor(person) {
  const ref = db.collection('compliance').doc(person.id);
  ref.get().then(snap => {
    const comp = snap.exists ? snap.data() : { posted: false, items: {} };
    const items = comp.items || {};
    const d = (v) => { const x = compDate(v); return x ? x.toISOString().slice(0, 10) : ''; };
    const withFile = ['limosa', 'a1', 'vca', 'ba'];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;overflow:auto;padding:16px';
    overlay.innerHTML = `<div class="card" style="max-width:640px;margin:0 auto">
      <h3>Passeport de conformité — ${esc(person.name)}</h3>
      <p class="empty" style="font-style:normal">Pièce d'identité et aptitude médicale : <b>date de validité uniquement</b> (pas de copie — minimisation RGPD). L'habilitation BA4/BA5 est <b>désignée par l'employeur</b> (RGIE) : un certificat de formation seul ne suffit pas.</p>
      <label style="display:block;font-weight:normal;margin:8px 0"><input type="checkbox" id="cp-posted" ${comp.posted ? 'checked' : ''} style="width:auto"> Ouvrier détaché de l'étranger (Limosa-1 + A1 exigés)</label>
      ${COMP_TYPES.map(type => `<div class="card" style="padding:10px;margin:8px 0">
        <b>${esc(COMP_LABELS[type].fr)}</b>
        <div class="row" style="margin-top:6px">
          ${type === 'ba' ? `<div class="field"><label>Niveau</label><select data-cp-level><option value="">—</option><option ${items.ba?.level === 'BA4' ? 'selected' : ''}>BA4</option><option ${items.ba?.level === 'BA5' ? 'selected' : ''}>BA5</option></select></div>` : ''}
          ${['limosa', 'a1'].includes(type) ? `<div class="field"><label>Référence</label><input type="text" data-cp-ref="${type}" value="${esc(items[type]?.ref || '')}"></div>` : ''}
          <div class="field"><label>Valable jusqu'au</label><input type="date" data-cp-until="${type}" value="${d(items[type]?.validUntil)}"></div>
        </div>
        ${withFile.includes(type) ? `<div class="field"><label>Document (photo ou PDF)${items[type]?.fileUrl ? ` — <a href="${esc(items[type].fileUrl)}" target="_blank" rel="noopener">voir l'actuel</a>` : ''}</label><input type="file" data-cp-file="${type}" accept="image/*,application/pdf"></div>` : ''}
      </div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-primary" id="cp-save">Enregistrer</button><button type="button" class="btn btn-outline" id="cp-close">Fermer</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cp-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cp-save').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const next = {};
        for (const type of COMP_TYPES) {
          const until = overlay.querySelector(`[data-cp-until="${type}"]`).value;
          const it = { ...(items[type] || {}) };
          it.validUntil = until ? firebase.firestore.Timestamp.fromDate(new Date(until + 'T23:59:59')) : null;
          const refIn = overlay.querySelector(`[data-cp-ref="${type}"]`);
          if (refIn) it.ref = refIn.value.trim() || null;
          if (type === 'ba') it.level = overlay.querySelector('[data-cp-level]').value || null;
          const fileIn = overlay.querySelector(`[data-cp-file="${type}"]`);
          const file = fileIn && fileIn.files && fileIn.files[0];
          if (file) {
            const sref = storage.ref(`compliance/${person.id}/${type}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`);
            await sref.put(file, { contentType: file.type || 'application/octet-stream' });
            it.fileUrl = await sref.getDownloadURL();
          }
          next[type] = it;
        }
        await ref.set({
          posted: overlay.querySelector('#cp-posted').checked, items: next,
          // Champs à plat lus par les règles Firestore (inscription aux missions).
          baLevel: next.ba.level || null, baValidUntil: next.ba.validUntil || null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: currentPerson.name,
        });
        overlay.remove();
      } catch (err) { e.target.disabled = false; showError(overlay.firstElementChild, 'Erreur : ' + err.message); }
    });
  });
}

// Résumé enregistré sur la demande au moment de la confirmation : le
// client voit l'état (valide / expire bientôt…), jamais les documents.
function complianceSummaryFor(people, compliance, staffById) {
  return people.map(p => {
    const person = staffById[p.id] || p;
    const comp = compliance[p.id] || null;
    const o = compOverall(person, comp);
    return { name: p.name, status: o.status, problems: o.problems.map(x => ({ type: x.type, st: x.st })) };
  });
}
function complianceSummaryClientHtml(r) {
  if (!r.complianceSummary || !r.complianceSummary.length) return '';
  const allOk = r.complianceSummary.every(x => x.status === 'ok');
  return `<div class="sub" style="margin-top:6px"><b>${esc(cp('teamCompliance'))}</b> (${esc(cp('checkedOn', fmtDate(r.confirmedAt)))}) :
    ${allOk ? '✅ ' + esc(cp('allOk')) : r.complianceSummary.map(x => `<br>${x.status === 'ok' ? '✅' : x.status === 'soon' ? '⚠' : '⛔'} ${esc(x.name)}${x.problems.length ? ' — ' + x.problems.map(p => `${esc(compLabel(p.type).split(' (')[0])} : ${esc(cp(p.st).toLowerCase())}`).join(', ') : ''}`).join('')}</div>`;
}
