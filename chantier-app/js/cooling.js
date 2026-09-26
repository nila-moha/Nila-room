// ============================================================
// Maintenance du refroidissement BESS (LCU) et ventilateurs PCS
// ============================================================
// Sources :
//  - BN CORE « Dossier pilote intervention BESS / PCS » v0.2 (ventilateurs :
//    torque marks, 6 Nm, jeu > 2 mm, une fiche par unité, codes OK/NC/NA) ;
//  - BN CORE « Dossier interne LCU » v1.0 (hydraulique ≠ frigorifique ;
//    circuit frigorifique = technicien certifié F-gas, règlement UE 2024/573
//    et règlement d'exécution 2024/2215) ;
//  - Sungrow PowerTitan 1.0 Service & Preventative Maintenance Manual
//    (tous les 6 mois : ventilateurs, entrée d'air encrassée ≤ 5 %, fuites
//    pompe/raccords hors condensat, HP ≤ 2,8 bar, BP ≥ 0,2 bar, liquide sans
//    impuretés ni noircissement, pH ≥ 7,3).
// Les seuils sont ceux du PowerTitan 1.0 : À CONFIRMER pour chaque modèle
// (manuel OEM de l'unité). Une valeur hors seuil n'est pas bloquée, mais
// exige une remarque (action prise) et apparaît en rouge dans le rapport.
// ============================================================

Object.assign(CHECKLIST_TEMPLATES.fr, {
  lcu: [
    "Identification de l'unité (modèle LCU, n° de série, réfrigérant et charge — photo de la plaque)",
    "Permis de travail, consignation (LOTO) et vérification d'absence de tension",
    "Inspection externe : fuites (hors condensat), fixations, étiquetage, état de la carrosserie",
    "Ventilateurs du condenseur : rotation, état des pales, encrassement de l'entrée d'air",
    "Circuit eau/glycol : pressions haute et basse relevées à l'écran",
    "Qualité du liquide : échantillon, couleur/impuretés, pH, concentration en glycol",
    "Filtre du circuit d'eau : contrôle et nettoyage",
    "Pompe et raccords : absence de goutte, bruit et vibrations",
    "Circuit frigorifique (technicien certifié F-gas uniquement) : contrôle d'étanchéité et registre du fluide",
    "Alarmes et communication avec le contrôleur / BMS : historique relevé",
    "Remise en service, essai et restitution de l'unité",
  ],
  fan: [
    "Revue de l'instruction OEM et du périmètre autorisé (valeur de couple, critère de jeu)",
    "Identification de l'unité, du PCS et du ventilateur (photos des plaques)",
    "Permis de travail, consignation (LOTO), neutralisation du redémarrage",
    "Photos de l'état initial et des marques de serrage (torque marks) du carter",
    "Contrôle du serrage à la valeur OEM (ex. 6 Nm, à confirmer)",
    "Marques de serrage PCS – compartiment MV (unité défectueuse)",
    "Démontage du ventilateur selon la procédure OEM, avec repérage",
    "Mesure du jeu pales – anneau guide d'air (valeur minimale)",
    "Recherche de traces de frottement ou d'usure (pales, rotor, anneau)",
    "Décision : maintien, réglage, remplacement ou expertise — remontage",
    "Revue croisée, capots remis, essai autorisé et restitution",
  ],
});
Object.assign(CHECKLIST_TEMPLATES.en, {
  lcu: [
    'Unit identification (LCU model, serial number, refrigerant and charge — nameplate photo)',
    'Work permit, lockout/tagout (LOTO) and absence-of-voltage check',
    'External inspection: leaks (excluding condensate), fixings, labelling, housing condition',
    'Condenser fans: rotation, blade condition, air inlet fouling',
    'Water/glycol circuit: high and low pressure read on the display',
    'Coolant quality: sample, colour/impurities, pH, glycol concentration',
    'Water circuit filter: check and cleaning',
    'Pump and fittings: no dripping, noise and vibration',
    'Refrigerant circuit (F-gas certified technician only): leak check and refrigerant log',
    'Alarms and communication with controller / BMS: history recorded',
    'Return to service, test and hand-back of the unit',
  ],
  fan: [
    'Review of OEM instruction and authorised scope (torque value, gap criterion)',
    'Identification of the unit, PCS and fan (nameplate photos)',
    'Work permit, LOTO, restart prevention',
    'Photos of initial condition and torque marks of the fan housing',
    'Tightening check at OEM value (e.g. 6 Nm, to be confirmed)',
    'Torque marks PCS – MV compartment (faulty unit)',
    'Fan removal according to OEM procedure, with marking',
    'Blade – air guide ring gap measurement (minimum value)',
    'Search for rubbing or wear marks (blades, rotor, ring)',
    'Decision: keep, adjust, replace or expert assessment — reassembly',
    'Cross-check, covers refitted, authorised test and hand-back',
  ],
});
Object.assign(CHECKLIST_TEMPLATES.ro, {
  lcu: [
    'Identificarea unității (model LCU, număr de serie, agent frigorific și încărcătură — fotografia plăcuței)',
    'Permis de lucru, consemnare (LOTO) și verificarea lipsei tensiunii',
    'Inspecție exterioară: scurgeri (fără condens), fixări, etichetare, starea carcasei',
    'Ventilatoarele condensatorului: rotație, starea paletelor, murdărirea admisiei de aer',
    'Circuitul apă/glicol: presiunile înaltă și joasă citite pe afișaj',
    'Calitatea lichidului: probă, culoare/impurități, pH, concentrația de glicol',
    'Filtrul circuitului de apă: verificare și curățare',
    'Pompa și racordurile: fără picurare, zgomot și vibrații',
    'Circuitul frigorific (doar tehnician certificat F-gas): verificarea etanșeității și registrul agentului',
    'Alarme și comunicarea cu controlerul / BMS: istoric înregistrat',
    'Repunere în funcțiune, test și predarea unității',
  ],
  fan: [
    'Verificarea instrucțiunii OEM și a perimetrului autorizat (cuplu, criteriul jocului)',
    'Identificarea unității, a PCS și a ventilatorului (fotografii ale plăcuțelor)',
    'Permis de lucru, LOTO, blocarea repornirii',
    'Fotografii ale stării inițiale și ale marcajelor de strângere ale carcasei',
    'Verificarea strângerii la valoarea OEM (ex. 6 Nm, de confirmat)',
    'Marcaje de strângere PCS – compartiment MV (unitatea defectă)',
    'Demontarea ventilatorului conform procedurii OEM, cu marcare',
    'Măsurarea jocului palete – inel de ghidare a aerului (valoarea minimă)',
    'Căutarea urmelor de frecare sau uzură (palete, rotor, inel)',
    'Decizie: menținere, reglaj, înlocuire sau expertiză — remontare',
    'Verificare încrucișată, capace montate, test autorizat și predare',
  ],
});
Object.assign(CHECKLIST_TEMPLATES.zh, {
  lcu: [
    '识别机组（液冷机组型号、序列号、制冷剂及充注量 — 铭牌照片）',
    '工作许可、上锁挂牌（LOTO）并验电',
    '外部检查：泄漏（不含冷凝水）、紧固件、标签、外壳状况',
    '冷凝器风扇：转动、叶片状况、进风口堵塞',
    '水/乙二醇回路：在屏幕上读取高压和低压',
    '冷却液质量：取样、颜色/杂质、pH 值、乙二醇浓度',
    '水路过滤器：检查与清洁',
    '水泵和接头：无滴漏、噪音和振动',
    '制冷剂回路（仅限持 F-gas 证书的技术员）：检漏及制冷剂记录',
    '报警及与控制器 / BMS 的通讯：记录历史',
    '恢复运行、测试并交还机组',
  ],
  fan: [
    '审阅 OEM 指导书及授权范围（扭矩值、间隙标准）',
    '识别机组、PCS 和风扇（铭牌照片）',
    '工作许可、上锁挂牌、防止重启',
    '拍摄初始状态及风扇外壳的扭矩标记',
    '按 OEM 数值检查紧固（例如 6 Nm，待确认）',
    'PCS – 中压舱扭矩标记（故障机组）',
    '按 OEM 程序拆卸风扇并做标记',
    '测量叶片与导风圈间隙（最小值）',
    '检查摩擦或磨损痕迹（叶片、转子、导风圈）',
    '决定：保持、调整、更换或专家评估 — 重新装配',
    '交叉复核、装回盖板、授权测试并交还',
  ],
});
Object.assign(PROJECT_TYPE_LABELS_I18N.fr, { lcu: 'Maintenance refroidissement (LCU)', fan: 'Inspection ventilateurs PCS' });
Object.assign(PROJECT_TYPE_LABELS_I18N.en, { lcu: 'Cooling maintenance (LCU)', fan: 'PCS fan inspection' });
Object.assign(PROJECT_TYPE_LABELS_I18N.ro, { lcu: 'Mentenanță răcire (LCU)', fan: 'Inspecție ventilatoare PCS' });
Object.assign(PROJECT_TYPE_LABELS_I18N.zh, { lcu: '液冷机组维护（LCU）', fan: 'PCS 风扇检查' });

// Mesures supplémentaires, avec seuils de référence (PowerTitan 1.0 —
// à confirmer par modèle). range : valeur attendue ; hors plage => remarque.
Object.assign(MEASURES, {
  pressureHp: { unit: 'bar', tool: null, range: { max: 2.8 }, fr: 'Pression haute du circuit', en: 'Circuit high pressure', ro: 'Presiunea înaltă a circuitului', zh: '回路高压' },
  pressureLp: { unit: 'bar', tool: null, range: { min: 0.2 }, fr: 'Pression basse du circuit', en: 'Circuit low pressure', ro: 'Presiunea joasă a circuitului', zh: '回路低压' },
  coolantPh: { unit: 'pH', tool: null, range: { min: 7.3 }, fr: 'pH du liquide de refroidissement', en: 'Coolant pH', ro: 'pH-ul lichidului de răcire', zh: '冷却液 pH 值' },
  glycol: { unit: '%', tool: 'refractometer', fr: 'Concentration en glycol', en: 'Glycol concentration', ro: 'Concentrația de glicol', zh: '乙二醇浓度' },
  airInletFouling: { unit: '%', tool: null, range: { max: 5 }, fr: "Encrassement de l'entrée d'air", en: 'Air inlet fouling', ro: 'Murdărirea admisiei de aer', zh: '进风口堵塞比例' },
  fanGap: { unit: 'mm', tool: 'gauge', range: { min: 2 }, fr: 'Jeu minimal pales – anneau', en: 'Minimum blade – ring gap', ro: 'Joc minim palete – inel', zh: '叶片与导风圈最小间隙' },
});
Object.assign(TOOL_TYPES, {
  refractometer: { fr: 'Réfractomètre (glycol)', en: 'Refractometer (glycol)', ro: 'Refractometru (glicol)', zh: '折射仪（乙二醇）' },
  gauge: { fr: 'Jauge / cale d’épaisseur', en: 'Feeler gauge', ro: 'Lere de grosime', zh: '塞尺' },
});

// Preuves exigées par étape. fgas: étape réservée à un technicien certifié F-gas.
EVIDENCE_RULES.lcu = {
  0: { photos: 1, serials: true, note: true },
  1: { photos: 1, note: true },
  2: { photos: 2 },
  3: { photos: 1, measures: [{ k: 'airInletFouling' }] },
  4: { photos: 1, measures: [{ k: 'pressureHp' }, { k: 'pressureLp' }] },
  5: { photos: 1, measures: [{ k: 'coolantPh' }, { k: 'glycol', optional: true }], note: true },
  6: { photos: 1 },
  7: { photos: 1 },
  8: { fgas: true, note: true },
  9: { photos: 1, note: true },
  10: { photos: 1, note: true },
};
EVIDENCE_RULES.fan = {
  0: { note: true },
  1: { photos: 2, serials: true },
  2: { photos: 1, note: true },
  3: { photos: 2 },
  4: { photos: 1, measures: [{ k: 'torque' }] },
  5: { photos: 1 },
  6: { photos: 1 },
  7: { photos: 1, measures: [{ k: 'fanGap' }] },
  8: { photos: 2, note: true },
  9: { photos: 1, note: true },
  10: { photos: 1, note: true },
};

// Hors plage ? (null si pas de seuil)
function measureOutOfRange(k, value) {
  const r = MEASURES[k] && MEASURES[k].range;
  if (!r || value === '' || value == null || isNaN(value)) return false;
  return (r.min != null && Number(value) < r.min) || (r.max != null && Number(value) > r.max);
}
function rangeText(k) {
  const r = MEASURES[k] && MEASURES[k].range;
  if (!r) return '';
  const u = MEASURES[k].unit;
  return r.min != null && r.max != null ? `${r.min}–${r.max} ${u}` : r.min != null ? `≥ ${r.min} ${u}` : `≤ ${r.max} ${u}`;
}
