// ============================================================
// Preuve de commissioning BESS (et autres types de projet)
// ============================================================
// Point faible n°1 du commissioning BESS : rapports de test incomplets,
// numéros de série et certificats d'étalonnage manquants, photos absentes,
// réserves (punch list) traitées « après coup ». Ce module impose la preuve
// au moment où l'étape est cochée :
//   - photos minimales par étape, numéros de série, mesures (couple de
//     serrage, isolement, capacité…) avec l'OUTIL utilisé et sa date
//     d'étalonnage — un outil à l'étalonnage expiré est refusé ;
//   - une étape validée ne peut plus être modifiée que par l'admin ;
//   - réserves classées A (bloquante) / B / C, levées par BN CORE puis
//     ACCEPTÉES par le client ;
//   - procès-verbal de réception signé par le client sur son téléphone ;
//   - tout est repris dans le dossier PDF (exportProjectReport).
// ============================================================

const EV_I18N = {
  fr: {
    evidenceTitle: 'Preuves requises pour valider cette étape',
    resultLabel: 'Résultat du contrôle', resOK: 'OK — conforme', resNC: 'NC — non conforme', resNA: 'NA — non applicable',
    expected: 'attendu', outOfRangeBadge: 'hors seuil', refOem: 'Seuil de référence OEM — à confirmer pour le modèle',
    errOutOfRange: (l) => `Valeur hors seuil pour « ${l} » : décrivez dans la remarque l'action prise (ou la décision demandée).`,
    errNcNote: 'Résultat NC : décrivez l’écart constaté dans la remarque (et signalez une réserve si nécessaire).',
    fgasOnly: 'Étape réservée à un technicien certifié F-gas (règlement UE 2024/573). Votre passeport ne contient pas de certificat F-gas valide : demandez à l’administrateur.',
    photosReq: (n) => `Photos (minimum ${n})`, photosOpt: 'Photos (facultatif)',
    serials: 'Numéro(s) de série (conteneur, module, onduleur…) — séparés par des virgules',
    tool: 'Outil utilisé', toolNone: '— choisir l’outil —', toolExpired: 'étalonnage expiré', toolValid: 'étalonné jusqu’au',
    noToolOfType: 'Aucun outil étalonné de ce type : demandez à l’administrateur de l’ajouter (onglet Outillage).',
    note: 'Remarque', validate: 'Valider l’étape', cancel: 'Annuler',
    errPhotos: (n) => `Au moins ${n} photo(s) requise(s) pour cette étape.`,
    errSerials: 'Indiquez au moins un numéro de série.',
    errMeasure: (l) => `Mesure obligatoire : ${l}.`,
    errTool: (l) => `Choisissez l’outil étalonné utilisé pour : ${l}.`,
    errToolExpired: 'L’étalonnage de cet outil est expiré : utilisez un autre outil.',
    errNote: 'Une remarque est obligatoire pour cette étape.',
    errOpenReserves: (n) => `Impossible : ${n} réserve(s) de catégorie A (bloquante) non levée(s).`,
    lockedInfo: 'Étape validée — seule l’administration peut la rouvrir.',
    photosPending: (n) => `${n} photo(s) en attente de réseau`,
    serialsShort: 'N° de série', measuredWith: 'mesuré avec',
    severity: 'Catégorie de réserve',
    sevA: 'A — bloquante (empêche la réception)', sevB: 'B — à lever rapidement', sevC: 'C — mineure / esthétique',
    sevShortA: 'Réserve A', sevShortB: 'Réserve B', sevShortC: 'Réserve C',
    acceptLift: 'Accepter la levée', rejectLift: 'Refuser la levée', rejectReason: 'Pourquoi la levée est-elle refusée ?',
    accepted: 'Levée acceptée par le client', lifted: 'Levée — en attente d’acceptation du client',
    fixLabel: 'Correction',
    liftBtn: 'Marquer la réserve levée', liftNote: 'Comment la réserve a-t-elle été levée ?',
    pvTitle: 'Procès-verbal de réception',
    pvIntro: 'En signant, vous confirmez la réception des travaux dans l’état décrit dans le dossier, avec les réserves encore ouvertes listées ci-dessous.',
    pvOpenReserves: (n) => n ? `${n} réserve(s) encore ouverte(s) — elles seront jointes au PV.` : 'Aucune réserve ouverte.',
    pvName: 'Nom et fonction du signataire', pvSign: 'Signez dans le cadre', pvClear: 'Effacer', pvSubmit: 'Signer le procès-verbal',
    pvErrSign: 'Signature manquante.', pvErrName: 'Nom et fonction obligatoires.',
    pvSigned: (who, when) => `Réception signée par ${who} le ${when}.`,
    pvNotReady: (d, n) => `Le PV pourra être signé quand toutes les étapes seront validées (${d}/${n}).`,
  },
  en: {
    evidenceTitle: 'Evidence required to validate this step',
    resultLabel: 'Check result', resOK: 'OK — compliant', resNC: 'NC — non-compliant', resNA: 'NA — not applicable',
    expected: 'expected', outOfRangeBadge: 'out of range', refOem: 'OEM reference threshold — to be confirmed for the model',
    errOutOfRange: (l) => `Value out of range for "${l}": describe the action taken (or decision requested) in the note.`,
    errNcNote: 'NC result: describe the deviation in the note (and report a punch item if needed).',
    fgasOnly: 'Step reserved for an F-gas certified technician (EU Regulation 2024/573). Your passport has no valid F-gas certificate: ask the administrator.',
    photosReq: (n) => `Photos (minimum ${n})`, photosOpt: 'Photos (optional)',
    serials: 'Serial number(s) (container, module, inverter…) — comma-separated',
    tool: 'Tool used', toolNone: '— choose the tool —', toolExpired: 'calibration expired', toolValid: 'calibrated until',
    noToolOfType: 'No calibrated tool of this type: ask the administrator to add one (Tools tab).',
    note: 'Note', validate: 'Validate step', cancel: 'Cancel',
    errPhotos: (n) => `At least ${n} photo(s) required for this step.`,
    errSerials: 'Enter at least one serial number.',
    errMeasure: (l) => `Required measurement: ${l}.`,
    errTool: (l) => `Choose the calibrated tool used for: ${l}.`,
    errToolExpired: 'This tool’s calibration has expired: use another tool.',
    errNote: 'A note is required for this step.',
    errOpenReserves: (n) => `Not possible: ${n} category A (blocking) punch item(s) still open.`,
    lockedInfo: 'Step validated — only the administrator can reopen it.',
    photosPending: (n) => `${n} photo(s) waiting for network`,
    serialsShort: 'Serial no.', measuredWith: 'measured with',
    severity: 'Punch item category',
    sevA: 'A — blocking (prevents acceptance)', sevB: 'B — to fix quickly', sevC: 'C — minor / cosmetic',
    sevShortA: 'Punch A', sevShortB: 'Punch B', sevShortC: 'Punch C',
    acceptLift: 'Accept fix', rejectLift: 'Reject fix', rejectReason: 'Why is the fix rejected?',
    accepted: 'Fix accepted by the client', lifted: 'Fixed — awaiting client acceptance',
    fixLabel: 'Fix',
    liftBtn: 'Mark as fixed', liftNote: 'How was it fixed?',
    pvTitle: 'Acceptance certificate',
    pvIntro: 'By signing, you confirm acceptance of the works as described in the file, with the open punch items listed below.',
    pvOpenReserves: (n) => n ? `${n} punch item(s) still open — they will be attached to the certificate.` : 'No open punch items.',
    pvName: 'Signatory name and position', pvSign: 'Sign in the box', pvClear: 'Clear', pvSubmit: 'Sign the certificate',
    pvErrSign: 'Signature missing.', pvErrName: 'Name and position are required.',
    pvSigned: (who, when) => `Acceptance signed by ${who} on ${when}.`,
    pvNotReady: (d, n) => `The certificate can be signed once all steps are validated (${d}/${n}).`,
  },
  ro: {
    evidenceTitle: 'Dovezi necesare pentru validarea acestei etape',
    resultLabel: 'Rezultatul verificării', resOK: 'OK — conform', resNC: 'NC — neconform', resNA: 'NA — nu se aplică',
    expected: 'așteptat', outOfRangeBadge: 'în afara pragului', refOem: 'Prag de referință OEM — de confirmat pentru model',
    errOutOfRange: (l) => `Valoare în afara pragului pentru „${l}”: descrieți în observație acțiunea luată (sau decizia cerută).`,
    errNcNote: 'Rezultat NC: descrieți abaterea în observație (și semnalați o rezervă dacă e cazul).',
    fgasOnly: 'Etapă rezervată unui tehnician certificat F-gas (Regulamentul UE 2024/573). Pașaportul dvs. nu conține un certificat F-gas valabil: întrebați administratorul.',
    photosReq: (n) => `Fotografii (minimum ${n})`, photosOpt: 'Fotografii (opțional)',
    serials: 'Număr(e) de serie (container, modul, invertor…) — separate prin virgulă',
    tool: 'Sculă folosită', toolNone: '— alegeți scula —', toolExpired: 'etalonare expirată', toolValid: 'etalonată până la',
    noToolOfType: 'Nicio sculă etalonată de acest tip: cereți administratorului să o adauge (fila Scule).',
    note: 'Observație', validate: 'Validează etapa', cancel: 'Renunță',
    errPhotos: (n) => `Sunt necesare cel puțin ${n} fotografii pentru această etapă.`,
    errSerials: 'Introduceți cel puțin un număr de serie.',
    errMeasure: (l) => `Măsurătoare obligatorie: ${l}.`,
    errTool: (l) => `Alegeți scula etalonată folosită pentru: ${l}.`,
    errToolExpired: 'Etalonarea acestei scule a expirat: folosiți altă sculă.',
    errNote: 'Pentru această etapă este obligatorie o observație.',
    errOpenReserves: (n) => `Imposibil: ${n} rezervă(e) de categoria A (blocante) încă deschise.`,
    lockedInfo: 'Etapă validată — doar administratorul o poate redeschide.',
    photosPending: (n) => `${n} fotografie(i) așteaptă rețeaua`,
    serialsShort: 'Nr. serie', measuredWith: 'măsurat cu',
    severity: 'Categoria rezervei',
    sevA: 'A — blocantă (împiedică recepția)', sevB: 'B — de rezolvat rapid', sevC: 'C — minoră / estetică',
    sevShortA: 'Rezervă A', sevShortB: 'Rezervă B', sevShortC: 'Rezervă C',
    acceptLift: 'Acceptă remedierea', rejectLift: 'Refuză remedierea', rejectReason: 'De ce este refuzată remedierea?',
    accepted: 'Remediere acceptată de client', lifted: 'Remediată — așteaptă acceptarea clientului',
    fixLabel: 'Remediere',
    liftBtn: 'Marchează ca remediată', liftNote: 'Cum a fost remediată?',
    pvTitle: 'Proces-verbal de recepție',
    pvIntro: 'Prin semnare, confirmați recepția lucrărilor în starea descrisă în dosar, cu rezervele încă deschise enumerate mai jos.',
    pvOpenReserves: (n) => n ? `${n} rezervă(e) încă deschise — vor fi anexate la PV.` : 'Nicio rezervă deschisă.',
    pvName: 'Numele și funcția semnatarului', pvSign: 'Semnați în chenar', pvClear: 'Șterge', pvSubmit: 'Semnează procesul-verbal',
    pvErrSign: 'Lipsește semnătura.', pvErrName: 'Numele și funcția sunt obligatorii.',
    pvSigned: (who, when) => `Recepție semnată de ${who} la ${when}.`,
    pvNotReady: (d, n) => `PV-ul poate fi semnat după validarea tuturor etapelor (${d}/${n}).`,
  },
  zh: {
    evidenceTitle: '验证此步骤所需的证据',
    resultLabel: '检查结果', resOK: 'OK — 合格', resNC: 'NC — 不合格', resNA: 'NA — 不适用',
    expected: '应为', outOfRangeBadge: '超出阈值', refOem: 'OEM 参考阈值 — 需按型号确认',
    errOutOfRange: (l) => `“${l}”超出阈值：请在备注中说明已采取的措施（或所需决定）。`,
    errNcNote: '结果为 NC：请在备注中说明偏差（必要时登记整改项）。',
    fgasOnly: '此步骤仅限持 F-gas 证书的技术员（欧盟法规 2024/573）。您的证件中没有有效的 F-gas 证书：请联系管理员。',
    photosReq: (n) => `照片（至少 ${n} 张）`, photosOpt: '照片（可选）',
    serials: '序列号（集装箱、模块、逆变器等）— 用逗号分隔',
    tool: '所用工具', toolNone: '— 选择工具 —', toolExpired: '校准已过期', toolValid: '校准有效期至',
    noToolOfType: '没有此类已校准的工具：请管理员添加（工具页）。',
    note: '备注', validate: '确认此步骤', cancel: '取消',
    errPhotos: (n) => `此步骤至少需要 ${n} 张照片。`,
    errSerials: '请至少填写一个序列号。',
    errMeasure: (l) => `必填测量值：${l}。`,
    errTool: (l) => `请选择用于以下测量的已校准工具：${l}。`,
    errToolExpired: '该工具校准已过期：请使用其他工具。',
    errNote: '此步骤必须填写备注。',
    errOpenReserves: (n) => `无法确认：仍有 ${n} 项 A 类（阻断性）整改项未关闭。`,
    lockedInfo: '步骤已确认 — 仅管理员可重新打开。',
    photosPending: (n) => `${n} 张照片等待网络`,
    serialsShort: '序列号', measuredWith: '测量工具',
    severity: '整改项类别',
    sevA: 'A — 阻断性（影响验收）', sevB: 'B — 需尽快处理', sevC: 'C — 轻微 / 外观',
    sevShortA: 'A 类整改', sevShortB: 'B 类整改', sevShortC: 'C 类整改',
    acceptLift: '接受整改', rejectLift: '拒绝整改', rejectReason: '为什么拒绝此整改？',
    accepted: '客户已接受整改', lifted: '已整改 — 等待客户确认',
    fixLabel: '整改',
    liftBtn: '标记为已整改', liftNote: '如何整改的？',
    pvTitle: '验收记录',
    pvIntro: '签署即表示您确认按档案所述状态验收工程，下方列出的未关闭整改项一并附上。',
    pvOpenReserves: (n) => n ? `仍有 ${n} 项未关闭的整改项 — 将附在验收记录中。` : '没有未关闭的整改项。',
    pvName: '签署人姓名及职务', pvSign: '请在框内签名', pvClear: '清除', pvSubmit: '签署验收记录',
    pvErrSign: '缺少签名。', pvErrName: '必须填写姓名和职务。',
    pvSigned: (who, when) => `验收由 ${who} 于 ${when} 签署。`,
    pvNotReady: (d, n) => `所有步骤确认后方可签署验收记录（${d}/${n}）。`,
  },
};
function ev(key, ...args) {
  const d = EV_I18N[getLang()] || EV_I18N.fr;
  const v = d[key] !== undefined ? d[key] : EV_I18N.fr[key];
  return typeof v === 'function' ? v(...args) : v;
}

// ---- Outils de mesure (registre d'étalonnage) ----
const TOOL_TYPES = {
  torque: { fr: 'Clé dynamométrique', en: 'Torque wrench', ro: 'Cheie dinamometrică', zh: '扭力扳手' },
  insulation: { fr: 'Mégohmmètre (isolement)', en: 'Insulation tester', ro: 'Megohmmetru (izolație)', zh: '绝缘电阻测试仪' },
  multimeter: { fr: 'Multimètre', en: 'Multimeter', ro: 'Multimetru', zh: '万用表' },
  earth: { fr: 'Telluromètre (terre)', en: 'Earth tester', ro: 'Telurometru (priză de pământ)', zh: '接地电阻测试仪' },
  thermal: { fr: 'Caméra thermique', en: 'Thermal camera', ro: 'Cameră termică', zh: '热像仪' },
  other: { fr: 'Autre instrument', en: 'Other instrument', ro: 'Alt instrument', zh: '其他仪器' },
};
function toolTypeLabel(k) { const x = TOOL_TYPES[k] || TOOL_TYPES.other; return x[getLang()] || x.fr; }

// ---- Mesures possibles ----
const MEASURES = {
  torque: { unit: 'Nm', tool: 'torque', fr: 'Couple de serrage contrôlé', en: 'Checked tightening torque', ro: 'Cuplu de strângere verificat', zh: '紧固扭矩检查值' },
  insulation: { unit: 'MΩ', tool: 'insulation', fr: 'Résistance d’isolement', en: 'Insulation resistance', ro: 'Rezistența de izolație', zh: '绝缘电阻' },
  earth: { unit: 'Ω', tool: 'earth', fr: 'Résistance de terre', en: 'Earth resistance', ro: 'Rezistența prizei de pământ', zh: '接地电阻' },
  capacity: { unit: 'kWh', tool: null, fr: 'Capacité mesurée', en: 'Measured capacity', ro: 'Capacitate măsurată', zh: '实测容量' },
  rte: { unit: '%', tool: null, fr: 'Rendement aller-retour (RTE)', en: 'Round-trip efficiency (RTE)', ro: 'Randament dus-întors (RTE)', zh: '往返效率 (RTE)' },
  maxTemp: { unit: '°C', tool: 'thermal', fr: 'Température max. relevée', en: 'Max. temperature recorded', ro: 'Temperatura max. înregistrată', zh: '记录的最高温度' },
};
function measureLabel(k) { const m = MEASURES[k]; return (m && (m[getLang()] || m.fr)) || k; }

// ---- Exigences par type de projet et par étape (index du modèle) ----
// photos: minimum ; serials: numéros obligatoires ; measures: [{k, optional}] ;
// note: remarque obligatoire ; noOpenA: aucune réserve A ouverte.
const EVIDENCE_RULES = {
  commissioning: {
    0: { note: true },
    1: { photos: 2, serials: true, measures: [{ k: 'torque', optional: true }, { k: 'earth', optional: true }] },
    2: { photos: 1, note: true },
    3: { photos: 1, measures: [{ k: 'capacity' }, { k: 'rte', optional: true }, { k: 'maxTemp', optional: true }] },
    4: { photos: 1, measures: [{ k: 'insulation' }] },
    5: { noOpenA: true },
    6: { photos: 1 },
  },
  om: { 1: { photos: 1, measures: [{ k: 'maxTemp', optional: true }, { k: 'torque', optional: true }] }, 3: { photos: 1, note: true } },
  container: { 0: { photos: 2, serials: true }, 1: { photos: 1 }, 2: { photos: 2 }, 3: { photos: 2 }, 4: { photos: 2 } },
  audit: { 1: { photos: 2 }, 2: { note: true } },
  workforce: {},
  delivery: { 0: { photos: 1 }, 1: { photos: 2 }, 2: { photos: 3 }, 3: { photos: 1, serials: true }, 4: { note: true } },
};
function evidenceRulesFor(type, stepIndex) {
  return (EVIDENCE_RULES[type] && EVIDENCE_RULES[type][stepIndex]) || {};
}

function tsToDay(ts) { const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null); return d; }
function toolIsValid(tool) { const d = tsToDay(tool.calibrationValidUntil); return !!d && d.getTime() >= Date.now(); }

// Charge les outils une fois par ouverture d'étape (petite collection).
async function loadTools() {
  const snap = await db.collection('tools').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.retired);
}

// ---- Formulaire de preuve à la validation d'une étape ----
async function openStepEvidenceForm(holder, { projectId, stepId, stepRef, projectType, stepIndex, onDone }) {
  const rules = evidenceRulesFor(projectType, stepIndex);
  const tools = (rules.measures || []).some(m => MEASURES[m.k].tool) ? await loadTools() : [];
  const measuresHtml = (rules.measures || []).map(m => {
    const def = MEASURES[m.k];
    const list = def.tool ? tools.filter(t => t.type === def.tool) : [];
    return `<div class="card" style="padding:10px;margin:8px 0">
      <div class="field"><label>${esc(measureLabel(m.k))} (${esc(def.unit)})${m.optional ? '' : ' *'}${def.range ? ` — ${esc(ev('expected'))} ${esc(rangeText(m.k))}` : ''}</label>
        <input type="number" step="any" inputmode="decimal" data-measure="${m.k}">
        ${def.range ? `<div class="meta">${esc(ev('refOem'))}</div>` : ''}</div>
      ${def.tool ? `<div class="field"><label>${esc(ev('tool'))} — ${esc(toolTypeLabel(def.tool))}</label>
        ${list.length ? `<select data-tool-for="${m.k}"><option value="">${esc(ev('toolNone'))}</option>${list.map(t => {
          const ok = toolIsValid(t);
          return `<option value="${esc(t.id)}" ${ok ? '' : 'disabled'}>${esc(t.name)} · ${esc(t.serial || '')} — ${ok ? esc(ev('toolValid')) + ' ' + esc(fmtDate(t.calibrationValidUntil)) : '⛔ ' + esc(ev('toolExpired'))}</option>`;
        }).join('')}</select>` : `<p class="empty" style="font-style:normal">${esc(ev('noToolOfType'))}</p>`}</div>` : ''}
    </div>`;
  }).join('');
  holder.innerHTML = `
    <div class="card" style="margin:8px 0 4px;background:var(--gold-100)">
      <b>${esc(ev('evidenceTitle'))}</b>
      <div class="field" style="margin-top:8px"><label>${rules.photos ? esc(ev('photosReq', rules.photos)) + ' *' : esc(ev('photosOpt'))}</label>
        <input type="file" data-ev="photos" accept="image/*" capture="environment" multiple></div>
      ${rules.serials ? `<div class="field"><label>${esc(ev('serials'))} *</label><input type="text" data-ev="serials"></div>` : ''}
      ${measuresHtml}
      <div class="field"><label>${esc(ev('resultLabel'))}</label><select data-ev="result">
        <option value="OK">${esc(ev('resOK'))}</option><option value="NC">${esc(ev('resNC'))}</option><option value="NA">${esc(ev('resNA'))}</option></select></div>
      <div class="field"><label>${esc(ev('note'))}${rules.note ? ' *' : ''}</label><textarea data-ev="note" rows="2"></textarea></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary btn-sm" data-ev="go">${esc(ev('validate'))}</button>
        <button type="button" class="btn btn-outline btn-sm" data-ev="cancel">${esc(ev('cancel'))}</button>
      </div>
    </div>`;
  const q = (sel) => holder.querySelector(sel);
  q('[data-ev="cancel"]').addEventListener('click', () => { holder.innerHTML = ''; onDone && onDone(false); });
  q('[data-ev="go"]').addEventListener('click', async (e) => {
    const btn = e.target;
    const files = Array.from(q('[data-ev="photos"]').files || []);
    const note = q('[data-ev="note"]').value.trim();
    const serials = rules.serials ? q('[data-ev="serials"]').value.split(',').map(s => s.trim()).filter(Boolean) : [];
    const box = holder.firstElementChild;
    const result = q('[data-ev="result"]').value;
    // Circuit frigorifique : technicien certifié F-gas uniquement (js/compliance.js).
    if (rules.fgas && currentPerson.role !== 'admin') {
      let comp = null;
      try { comp = await loadMyCompliance(); } catch (e) { /* hors ligne */ }
      if (!hasValidFgas(comp)) return showError(box, ev('fgasOnly'));
    }
    if (rules.photos && files.length < rules.photos && result !== 'NA') return showError(box, ev('errPhotos', rules.photos));
    if (rules.serials && !serials.length && result !== 'NA') return showError(box, ev('errSerials'));
    if (rules.note && !note) return showError(box, ev('errNote'));
    if (result !== 'OK' && !note) return showError(box, ev('errNcNote'));
    const measures = {};
    for (const m of rules.measures || []) {
      const raw = q(`[data-measure="${m.k}"]`).value;
      const def = MEASURES[m.k];
      if (raw === '') { if (m.optional || result === 'NA') continue; return showError(box, ev('errMeasure', measureLabel(m.k))); }
      const entry = { value: Number(raw), unit: def.unit };
      if (typeof measureOutOfRange === 'function' && measureOutOfRange(m.k, raw)) {
        entry.outOfRange = true; entry.expected = rangeText(m.k);
        if (!note) return showError(box, ev('errOutOfRange', measureLabel(m.k)));
      }
      if (def.tool) {
        const sel = q(`[data-tool-for="${m.k}"]`);
        const tool = sel && tools.find(t => t.id === sel.value);
        if (!tool) return showError(box, ev('errTool', measureLabel(m.k)));
        if (!toolIsValid(tool)) return showError(box, ev('errToolExpired'));
        Object.assign(entry, { toolId: tool.id, toolName: tool.name, toolSerial: tool.serial || null, toolCalibrationValidUntil: tool.calibrationValidUntil });
      }
      measures[m.k] = entry;
    }
    if (rules.noOpenA) {
      const open = await db.collection('projects').doc(projectId).collection('problems').where('severity', '==', 'A').get();
      const n = open.docs.filter(d => !['resolved', 'accepted'].includes(d.data().status)).length;
      if (n) return showError(box, ev('errOpenReserves', n));
    }
    btn.disabled = true;
    try {
      const { urls, pending } = await uploadPhotosOrQueue(`projects/${projectId}/checklist/${stepId}`, files, stepRef.path, 'evidencePhotos');
      await saveDoc(stepRef.update({
        done: true, doneBy: currentPerson.name, doneByUid: currentUser.uid, doneAt: firebase.firestore.FieldValue.serverTimestamp(), note,
        evidencePhotos: urls, pendingPhotos: pending, evidence: { serials, measures, result },
      }));
      holder.innerHTML = '';
      onDone && onDone(true);
    } catch (err) {
      btn.disabled = false;
      showError(box, t('errorPrefix') + err.message);
    }
  });
}

// Résumé des preuves sous une étape validée (écran et rapport).
function evidenceSummaryHtml(s, forReport) {
  const e = s.evidence || {};
  const parts = [];
  if (e.result && e.result !== 'OK') parts.push(`<b style="color:${e.result === 'NC' ? 'var(--red,#b3261e)' : 'inherit'}">${esc(ev(e.result === 'NC' ? 'resNC' : 'resNA'))}</b>`);
  if (e.serials && e.serials.length) parts.push(`${esc(ev('serialsShort'))} : ${e.serials.map(esc).join(', ')}`);
  for (const [k, m] of Object.entries(e.measures || {})) {
    parts.push(`${esc(measureLabel(k))} : <b${m.outOfRange ? ' style="color:var(--red,#b3261e)"' : ''}>${esc(m.value)} ${esc(m.unit)}${m.outOfRange ? ` ⚠ ${esc(ev('outOfRangeBadge'))} (${esc(ev('expected'))} ${esc(m.expected || '')})` : ''}</b>${m.toolName ? ` — ${esc(ev('measuredWith'))} ${esc(m.toolName)}${m.toolSerial ? ' (' + esc(m.toolSerial) + ')' : ''}, ${esc(ev('toolValid'))} ${esc(fmtDate(m.toolCalibrationValidUntil))}` : ''}`);
  }
  if (s.pendingPhotos > 0) parts.push(`📷 ${esc(ev('photosPending', s.pendingPhotos))}`);
  const photos = (s.evidencePhotos || []).map(u => forReport ? `<img src="${esc(u)}">` : '').join('');
  return (parts.length ? `<div class="meta" style="margin-top:2px">${parts.join('<br>')}</div>` : '') +
    (forReport ? photos : photoGalleryHtml(s.evidencePhotos || []));
}

// ---- Réserves (punch list) ----
function severitySelectHtml() {
  return `<div class="field"><label>${esc(ev('severity'))}</label><select id="problem-severity">
    <option value="B">${esc(ev('sevB'))}</option><option value="A">${esc(ev('sevA'))}</option><option value="C">${esc(ev('sevC'))}</option></select></div>`;
}
function severityBadgeHtml(p) {
  if (!p.severity) return '';
  const color = p.severity === 'A' ? 'badge-open' : p.severity === 'B' ? 'badge-reported' : 'badge-closed';
  return `<span class="badge ${color}" style="margin-right:6px">${esc(ev('sevShort' + p.severity))}</span>`;
}
function punchStatusHtml(p) {
  if (p.status === 'accepted') return `<div class="meta" style="color:var(--green)">✔ ${esc(ev('accepted'))} — ${esc(p.acceptedByName || '')} · ${fmtDateTime(p.acceptedAt)}</div>`;
  if (p.status === 'resolved') return `<div class="meta">${esc(ev('lifted'))}${p.resolvedNote ? ' — ' + esc(p.resolvedNote) : ''}</div>`;
  if (p.clientRejectReason) return `<div class="meta" style="color:var(--red)">✖ ${esc(p.clientRejectReason)}</div>`;
  return '';
}
function punchActionsHtml(id, p, mode) {
  if (mode === 'admin' && !['resolved', 'accepted'].includes(p.status)) {
    return `<button type="button" class="btn btn-outline btn-sm" data-lift="${id}">${esc(ev('liftBtn'))}</button>`;
  }
  if (mode === 'client' && p.status === 'resolved' && p.visibleToClient) {
    return `<button type="button" class="btn btn-primary btn-sm" data-accept="${id}">${esc(ev('acceptLift'))}</button>
            <button type="button" class="btn btn-outline btn-sm" data-reject="${id}">${esc(ev('rejectLift'))}</button>`;
  }
  return '';
}
function wirePunchActions(target, projectId) {
  const col = db.collection('projects').doc(projectId).collection('problems');
  target.querySelectorAll('[data-lift]').forEach(b => b.addEventListener('click', async () => {
    const note = prompt(ev('liftNote'), '');
    if (note === null) return;
    await col.doc(b.dataset.lift).update({ status: 'resolved', visibleToClient: true, resolvedNote: note.trim() || null, resolvedAt: firebase.firestore.FieldValue.serverTimestamp(), clientRejectReason: null });
  }));
  target.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', async () => {
    await col.doc(b.dataset.accept).update({ status: 'accepted', acceptedByName: currentPerson.name, acceptedByUid: currentUser.uid, acceptedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }));
  target.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', async () => {
    const reason = prompt(ev('rejectReason'), '');
    if (!reason) return;
    await col.doc(b.dataset.reject).update({ status: 'published', clientRejectReason: reason.trim() });
  }));
}

// ---- Procès-verbal de réception (signature du client) ----
function renderHandoverCard(target, projectId, mode) {
  const pRef = db.collection('projects').doc(projectId);
  Promise.all([pRef.collection('handover').doc('pv').get(), pRef.collection('checklist').get(), clientSafeQuery(projectId, 'problems', mode).get()]).then(([pvSnap, cl, pb]) => {
    const done = cl.docs.filter(d => d.data().done).length, total = cl.size;
    const open = pb.docs.map(d => d.data()).filter(p => p.visibleToClient && !['resolved', 'accepted'].includes(p.status));
    if (pvSnap.exists) {
      const pv = pvSnap.data();
      target.innerHTML = `<div class="note-box">✍️ ${esc(ev('pvSigned', pv.signedByName, fmtDateTime(pv.signedAt)))}${pv.openReserves && pv.openReserves.length ? ' — ' + esc(ev('pvOpenReserves', pv.openReserves.length)) : ''}</div>`;
      return;
    }
    if (mode !== 'client') { target.innerHTML = total && done === total ? `<div class="note-box">⏳ ${esc(ev('pvTitle'))} — en attente de la signature du client.</div>` : ''; return; }
    if (!total || done < total) { target.innerHTML = `<div class="note-box">${esc(ev('pvNotReady', done, total))}</div>`; return; }
    target.innerHTML = `
      <div class="card">
        <h3 style="font-size:1rem">✍️ ${esc(ev('pvTitle'))}</h3>
        <p class="empty" style="font-style:normal">${esc(ev('pvIntro'))}</p>
        <p><b>${esc(ev('pvOpenReserves', open.length))}</b></p>
        ${open.map(p => `<div class="meta">• ${esc(p.severity || '')} ${esc(p.title)}</div>`).join('')}
        <div class="field" style="margin-top:10px"><label>${esc(ev('pvName'))} *</label><input type="text" id="pv-name" value="${esc(currentPerson.name || '')}"></div>
        <label>${esc(ev('pvSign'))} *</label>
        <canvas id="pv-canvas" width="600" height="180" style="width:100%;height:160px;border:1px solid var(--border);border-radius:8px;background:#fff;touch-action:none"></canvas>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-outline btn-sm" id="pv-clear">${esc(ev('pvClear'))}</button>
          <button type="button" class="btn btn-primary btn-sm" id="pv-submit">${esc(ev('pvSubmit'))}</button>
        </div>
      </div>`;
    const canvas = document.getElementById('pv-canvas');
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1d1d1f';
    let drawing = false, strokes = 0;
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
    canvas.addEventListener('pointerdown', (e) => { drawing = true; strokes++; ctx.beginPath(); ctx.moveTo(...pos(e)); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); });
    canvas.addEventListener('pointerup', () => { drawing = false; });
    document.getElementById('pv-clear').addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; });
    document.getElementById('pv-submit').addEventListener('click', async (e) => {
      const name = document.getElementById('pv-name').value.trim();
      const card = target.firstElementChild;
      if (!name) return showError(card, ev('pvErrName'));
      if (!strokes) return showError(card, ev('pvErrSign'));
      e.target.disabled = true;
      try {
        await pRef.collection('handover').doc('pv').set({
          signedByName: name, signedByUid: currentUser.uid,
          signedAt: firebase.firestore.FieldValue.serverTimestamp(),
          signaturePng: canvas.toDataURL('image/png'),
          openReserves: open.map(p => ({ title: p.title, severity: p.severity || null, status: p.status })),
          stepsDone: done, stepsTotal: total,
        });
        renderHandoverCard(target, projectId, mode);
      } catch (err) { e.target.disabled = false; showError(card, t('errorPrefix') + err.message); }
    });
  }).catch(() => { target.innerHTML = ''; });
}

// ---- Admin : onglet « Outillage » (registre d'étalonnage) ----
function renderAdminTools(content) {
  const unsub = db.collection('tools').onSnapshot(snap => {
    const tools = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.retired)
      .sort((a, b) => (tsToDay(a.calibrationValidUntil) || 0) - (tsToDay(b.calibrationValidUntil) || 0));
    const soon = Date.now() + 30 * 86400000;
    content.innerHTML = `
      <div class="card">
        <h3>Outillage et étalonnage</h3>
        <p class="empty" style="font-style:normal;margin:4px 0 10px">Les mesures de commissioning (couple de serrage, isolement, terre…) exigent un outil de cette liste dont l'étalonnage est en cours de validité. Un outil expiré ne peut pas être choisi sur le terrain.</p>
        <form id="tool-form">
          <div class="row">
            <div class="field"><label>Nom / modèle</label><input type="text" id="tl-name" required placeholder="Ex. Facom S.306-200"></div>
            <div class="field"><label>Type</label><select id="tl-type">${Object.keys(TOOL_TYPES).map(k => `<option value="${k}">${esc(TOOL_TYPES[k].fr)}</option>`).join('')}</select></div>
          </div>
          <div class="row">
            <div class="field"><label>N° de série</label><input type="text" id="tl-serial" required></div>
            <div class="field"><label>Étalonné le</label><input type="date" id="tl-cal" required></div>
            <div class="field"><label>Valable jusqu'au</label><input type="date" id="tl-valid" required></div>
          </div>
          <div class="field"><label>Certificat d'étalonnage (photo, facultatif)</label><input type="file" id="tl-cert" accept="image/*" capture="environment"></div>
          <button type="submit" class="btn btn-primary btn-sm">Ajouter l'outil</button>
        </form>
      </div>
      <div class="card">
        ${tools.length ? tools.map(tl => {
          const until = tsToDay(tl.calibrationValidUntil);
          const state = !until || until.getTime() < Date.now() ? '<span class="badge badge-open">⛔ Expiré</span>' : until.getTime() < soon ? '<span class="badge badge-reported">⚠ Expire bientôt</span>' : '<span class="badge badge-active">✔ Valide</span>';
          return `<div class="list-row"><div class="main"><div class="name">${esc(tl.name)} ${state}</div>
            <div class="sub">${esc(TOOL_TYPES[tl.type] ? TOOL_TYPES[tl.type].fr : tl.type)} · n° ${esc(tl.serial || '—')} · étalonné le ${fmtDate(tl.calibratedAt)} · valable jusqu'au ${fmtDate(tl.calibrationValidUntil)}${tl.certificateUrl ? ` · <a href="${esc(tl.certificateUrl)}" target="_blank" rel="noopener">certificat</a>` : ''}</div></div>
            <div class="actions"><button class="btn btn-outline btn-sm" data-recal="${tl.id}">Nouvel étalonnage</button><button class="btn btn-danger btn-sm" data-retire="${tl.id}">Retirer</button></div></div>`;
        }).join('') : '<p class="empty">Aucun outil enregistré.</p>'}
      </div>`;
    const dateTs = (v) => firebase.firestore.Timestamp.fromDate(new Date(v + 'T23:59:59'));
    document.getElementById('tool-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector('button[type=submit]');
      const cal = document.getElementById('tl-cal').value, valid = document.getElementById('tl-valid').value;
      if (valid < cal) return showError(f, 'La date de validité doit suivre la date d’étalonnage.');
      btn.disabled = true;
      try {
        const ref = db.collection('tools').doc();
        const certFiles = Array.from(document.getElementById('tl-cert').files || []);
        const certUrls = certFiles.length ? await uploadPhotos(`tools/${ref.id}`, certFiles) : [];
        await ref.set({
          name: document.getElementById('tl-name').value.trim(), type: document.getElementById('tl-type').value,
          serial: document.getElementById('tl-serial').value.trim(),
          calibratedAt: dateTs(cal), calibrationValidUntil: dateTs(valid), certificateUrl: certUrls[0] || null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) { btn.disabled = false; showError(f, 'Erreur : ' + err.message); }
    });
    content.querySelectorAll('[data-recal]').forEach(b => b.addEventListener('click', async () => {
      const cal = prompt('Date du nouvel étalonnage (AAAA-MM-JJ) :', new Date().toISOString().slice(0, 10));
      if (!cal) return;
      const valid = prompt('Valable jusqu’au (AAAA-MM-JJ) :', '');
      if (!valid || valid < cal) return alert('Date de validité invalide.');
      await db.collection('tools').doc(b.dataset.recal).update({ calibratedAt: dateTs(cal), calibrationValidUntil: dateTs(valid) });
    }));
    content.querySelectorAll('[data-retire]').forEach(b => b.addEventListener('click', async () => {
      if (confirm('Retirer cet outil ? Les mesures déjà faites avec lui restent dans les rapports.')) await db.collection('tools').doc(b.dataset.retire).update({ retired: true });
    }));
  }, err => showError(content, 'Erreur : ' + err.message));
  unsubscribers.push(unsub);
}
