// ============================================================
// Notice d'information RGPD — pointage, géolocalisation et photos
// ============================================================
// Version courte de la section 2 du document BNC-RGPD-2026-01
// (bn-core-docs/). Affichée à chaque membre du personnel avant son
// premier accès ; l'acceptation (date + version) est enregistrée sur son
// profil, ce qui sert de preuve de remise de l'information.
//
// Toute modification importante du texte => incrémenter NOTICE_VERSION :
// chacun devra relire et reconfirmer à sa prochaine ouverture de l'app.
//
// FR = texte de référence. EN / RO / ZH = traductions non relues par un
// juriste ni (pour le RO) par un technicien natif — à faire relire.
// ============================================================

const NOTICE_VERSION = '1.0';

const NOTICE_CONTROLLER = 'BN CORE GROUP, Ll.Graffplein 15, 1780 Wemmel, Belgique — TVA BE1027.648.484 — info@bncoregroup.com — +32 471 99 08 25';
const NOTICE_APD = 'Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles — contact@apd-gba.be';

const NOTICE_TEXT = {
  fr: {
    title: 'Vos données dans cette application',
    intro: "Avant de commencer, lisez comment BN CORE GROUP utilise vos données. Vous pourrez relire ce texte à tout moment via le lien « Mes données » en haut de l'écran.",
    sections: [
      ['Qui est responsable ?', NOTICE_CONTROLLER],
      ['Quelles données ?', "Votre nom, e-mail et rôle ; l'heure de vos arrivées et départs et le chantier ; une remarque et une photo si vous en ajoutez ; <strong>la position GPS de votre téléphone uniquement au moment précis où vous pointez</strong> (jamais en continu, jamais en dehors de l'application) ; vos kilomètres domicile–chantier et type de véhicule ; les rapports, photos, problèmes et achats que vous publiez ; si vous activez les notifications, un identifiant technique de votre téléphone (servant uniquement à vous les envoyer, supprimé à la déconnexion)."],
      ['Pourquoi ?', "Enregistrer votre temps de travail et vos déplacements (exécution du contrat ; obligation légale pour les salariés) ; facturer au client les heures et frais réellement prestés, prouver votre présence en cas de contestation et documenter le chantier (intérêt légitime de BN CORE GROUP — RGPD art. 6.1.b, c et f)."],
      ['GPS et photo : obligatoires ?', "<strong>Non.</strong> Vous pouvez refuser la position dans votre téléphone : le pointage est enregistré normalement, sans position. La photo est facultative. N'écrivez aucune information sur votre santé ou votre vie privée et ne photographiez pas de personnes sans nécessité."],
      ['Qui voit vos données ?', "L'administrateur de BN CORE GROUP. Votre équipe voit les pointages, kilomètres et rapports du chantier commun. Le client ne voit <strong>jamais</strong> vos pointages, positions ni kilomètres — seulement les rapports que BN CORE GROUP choisit de lui montrer. Hébergement : Google Firebase (certaines données peuvent être traitées aux États-Unis, cadre « EU-US Data Privacy Framework »). Aucune vente, aucune publicité."],
      ['Combien de temps ?', "Position GPS et photos de pointage : 12 mois. Heures et kilomètres : 5 ans. Rapports de chantier : durée du projet + 5 ans. Compte : durée de la collaboration, puis suppression après 12 mois. Factures : 10 ans (obligation comptable)."],
      ['Vos droits', "Accès, rectification, effacement, limitation, portabilité et <strong>opposition</strong> (notamment à la géolocalisation) — RGPD art. 15 à 21. Écrivez à info@bncoregroup.com (réponse sous un mois). Réclamation possible auprès de l'" + NOTICE_APD + '.'],
    ],
    accept: "J'ai lu et compris cette information",
    acceptNote: "Cette confirmation prouve seulement que vous avez reçu l'information. Ce n'est pas un consentement.",
    link: 'Mes données',
    close: 'Fermer',
    acceptedOn: 'Information confirmée le',
  },
  en: {
    title: 'Your data in this application',
    intro: 'Before you start, please read how BN CORE GROUP uses your data. You can read this text again at any time via the "My data" link at the top of the screen.',
    sections: [
      ['Who is responsible?', NOTICE_CONTROLLER],
      ['What data?', 'Your name, email and role; the time of your arrivals and departures and the site; a note and a photo if you add them; <strong>the GPS position of your phone only at the exact moment you clock in or out</strong> (never continuously, never outside the app); your home-to-site mileage and vehicle type; the reports, photos, problems and purchases you post; if you turn on notifications, a technical identifier of your phone (used only to send them, deleted when you log out).'],
      ['Why?', 'To record your working time and travel (performance of the contract; legal obligation for employees); to invoice the client for the hours and costs actually worked, prove your presence in case of dispute and document the site (legitimate interest of BN CORE GROUP — GDPR Art. 6(1)(b), (c) and (f)).'],
      ['Are GPS and photo mandatory?', '<strong>No.</strong> You can refuse location access on your phone: your clock-in is recorded normally, without a position. The photo is optional. Do not write any information about your health or private life, and do not photograph people unless necessary.'],
      ['Who sees your data?', 'The BN CORE GROUP administrator. Your team sees the clock-ins, mileage and reports of your shared site. The client <strong>never</strong> sees your clock-ins, positions or mileage — only the reports BN CORE GROUP chooses to share. Hosting: Google Firebase (some data may be processed in the United States under the EU-US Data Privacy Framework). No sale, no advertising.'],
      ['How long?', 'GPS position and clock-in photos: 12 months. Hours and mileage: 5 years. Site reports: project duration + 5 years. Account: duration of the collaboration, then deleted after 12 months. Invoices: 10 years (accounting obligation).'],
      ['Your rights', 'Access, rectification, erasure, restriction, portability and <strong>objection</strong> (in particular to location tracking) — GDPR Art. 15 to 21. Write to info@bncoregroup.com (reply within one month). You may lodge a complaint with the Belgian Data Protection Authority (' + NOTICE_APD + ').'],
    ],
    accept: 'I have read and understood this information',
    acceptNote: 'This confirmation only proves that you received the information. It is not consent.',
    link: 'My data',
    close: 'Close',
    acceptedOn: 'Information confirmed on',
  },
  ro: {
    title: 'Datele dvs. în această aplicație',
    intro: 'Înainte de a începe, citiți cum folosește BN CORE GROUP datele dvs. Puteți reciti acest text oricând prin linkul „Datele mele” din partea de sus a ecranului.',
    sections: [
      ['Cine este responsabil?', NOTICE_CONTROLLER],
      ['Ce date?', 'Numele, e-mailul și rolul dvs.; ora sosirilor și plecărilor și șantierul; o observație și o fotografie, dacă le adăugați; <strong>poziția GPS a telefonului doar în momentul exact al pontajului</strong> (niciodată continuu, niciodată în afara aplicației); kilometrii de acasă până la șantier și tipul vehiculului; rapoartele, fotografiile, problemele și achizițiile pe care le publicați; dacă activați notificările, un identificator tehnic al telefonului (folosit doar pentru a vi le trimite, șters la deconectare).'],
      ['De ce?', 'Pentru a înregistra timpul de lucru și deplasările (executarea contractului; obligație legală pentru angajați); pentru a factura clientului orele și costurile efectiv prestate, a dovedi prezența dvs. în caz de litigiu și a documenta șantierul (interesul legitim al BN CORE GROUP — RGPD art. 6 alin. (1) lit. b, c și f).'],
      ['GPS și fotografie: obligatorii?', '<strong>Nu.</strong> Puteți refuza accesul la localizare pe telefon: pontajul se înregistrează normal, fără poziție. Fotografia este opțională. Nu scrieți informații despre sănătatea sau viața dvs. privată și nu fotografiați persoane fără necesitate.'],
      ['Cine vede datele dvs.?', 'Administratorul BN CORE GROUP. Echipa dvs. vede pontajele, kilometrii și rapoartele șantierului comun. Clientul nu vede <strong>niciodată</strong> pontajele, pozițiile sau kilometrii dvs. — doar rapoartele pe care BN CORE GROUP alege să i le arate. Găzduire: Google Firebase (unele date pot fi prelucrate în Statele Unite, în cadrul „EU-US Data Privacy Framework”). Fără vânzare, fără publicitate.'],
      ['Cât timp?', 'Poziția GPS și fotografiile de pontaj: 12 luni. Ore și kilometri: 5 ani. Rapoarte de șantier: durata proiectului + 5 ani. Contul: durata colaborării, apoi ștergere după 12 luni. Facturi: 10 ani (obligație contabilă).'],
      ['Drepturile dvs.', 'Acces, rectificare, ștergere, restricționare, portabilitate și <strong>opoziție</strong> (în special la localizare) — RGPD art. 15–21. Scrieți la info@bncoregroup.com (răspuns în cel mult o lună). Puteți depune o plângere la Autoritatea belgiană pentru protecția datelor (' + NOTICE_APD + ').'],
    ],
    accept: 'Am citit și am înțeles aceste informații',
    acceptNote: 'Această confirmare dovedește doar că ați primit informațiile. Nu reprezintă un consimțământ.',
    link: 'Datele mele',
    close: 'Închide',
    acceptedOn: 'Informare confirmată la',
  },
  zh: {
    title: '您在本应用中的数据',
    intro: '开始之前，请阅读 BN CORE GROUP 如何使用您的数据。您可以随时通过屏幕顶部的“我的数据”链接重新阅读本说明。',
    sections: [
      ['谁是负责人？', NOTICE_CONTROLLER],
      ['哪些数据？', '您的姓名、电子邮件和角色；您到达和离开的时间及工地；您添加的备注和照片；<strong>仅在您打卡的那一刻记录手机的 GPS 位置</strong>（绝不持续定位，绝不在应用之外定位）；您从家到工地的公里数和车辆类型；您发布的报告、照片、问题和采购记录；如您开启通知，还包括手机的技术标识（仅用于向您发送通知，退出登录时删除）。'],
      ['为什么？', '记录您的工作时间和出行（履行合同；对雇员而言为法定义务）；向客户开具实际工时和费用的发票、在发生争议时证明您在场并记录工地情况（BN CORE GROUP 的正当利益 — GDPR 第 6(1)(b)、(c)、(f) 条）。'],
      ['GPS 和照片是必须的吗？', '<strong>不是。</strong>您可以在手机上拒绝位置权限：打卡仍会正常记录，只是没有位置。照片是可选的。请勿填写任何有关您健康或私生活的信息，如非必要请勿拍摄他人。'],
      ['谁能看到您的数据？', 'BN CORE GROUP 管理员。您的团队可以看到共同工地的打卡、公里数和报告。客户<strong>永远看不到</strong>您的打卡、位置或公里数，只能看到 BN CORE GROUP 选择向其展示的报告。托管：Google Firebase（部分数据可能在美国处理，适用“欧盟-美国数据隐私框架”）。不出售，不用于广告。'],
      ['保存多久？', 'GPS 位置和打卡照片：12 个月。工时和公里数：5 年。工地报告：项目期间 + 5 年。账户：合作期间，结束后 12 个月删除。发票：10 年（会计义务）。'],
      ['您的权利', '访问、更正、删除、限制处理、可携带以及<strong>反对</strong>（特别是反对定位）的权利 — GDPR 第 15 至 21 条。请写信至 info@bncoregroup.com（一个月内答复）。您也可以向比利时数据保护机构投诉（' + NOTICE_APD + '）。'],
    ],
    accept: '我已阅读并理解上述信息',
    acceptNote: '此确认仅证明您已收到上述信息，并不构成同意。',
    link: '我的数据',
    close: '关闭',
    acceptedOn: '信息确认日期',
  },
};

function noticeText() {
  return NOTICE_TEXT[getLang()] || NOTICE_TEXT.fr;
}

function noticeBodyHtml() {
  const n = noticeText();
  return `<p style="color:var(--text-dim);margin-top:8px">${esc(n.intro)}</p>` +
    n.sections.map(([h, body]) => `<h4 style="margin-top:14px">${esc(h)}</h4><p style="color:var(--text-dim);margin-top:4px">${body}</p>`).join('') +
    `<p style="margin-top:14px;font-size:0.78rem;color:var(--text-dim)">Version ${NOTICE_VERSION} — BNC-RGPD-2026-01</p>`;
}

// Membre du personnel qui n'a pas encore confirmé la version en vigueur.
function needsNotice(person) {
  return ['engineer', 'electrician', 'worker'].includes(person.role) && person.noticeVersion !== NOTICE_VERSION;
}

function renderNoticeGate() {
  clearSubscriptions();
  const n = noticeText();
  app.innerHTML = `
    <div class="center-wrap">
      <div class="card" style="max-width:640px">
        <div style="display:flex;justify-content:flex-end">${langSwitcherHtml()}</div>
        <h2 style="font-size:1.15rem;margin-top:8px">${esc(n.title)}</h2>
        ${noticeBodyHtml()}
        <button type="button" id="notice-accept-btn" class="btn btn-primary btn-block" style="margin-top:20px">${esc(n.accept)}</button>
        <p style="margin-top:8px;font-size:0.78rem;color:var(--text-dim)">${esc(n.acceptNote)}</p>
        <button type="button" class="btn btn-outline btn-block" style="margin-top:12px" onclick="logout()">${esc(t('disconnect'))}</button>
      </div>
    </div>`;
  wireLangSwitcher();
  document.getElementById('notice-accept-btn').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    try {
      const fields = {
        noticeVersion: NOTICE_VERSION,
        noticeLang: getLang(),
        noticeAcceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('people').doc(currentUser.uid).update(fields);
      Object.assign(currentPerson, fields, { noticeAcceptedAt: new Date() });
      routeByRole();
    } catch (err) {
      btn.disabled = false;
      showError(btn.parentElement, t('errorPrefix') + err.message);
    }
  });
}

// Relecture à tout moment (lien « Mes données » dans la barre du haut).
function showNoticeOverlay() {
  const n = noticeText();
  const accepted = currentPerson && currentPerson.noticeAcceptedAt;
  const when = accepted ? (accepted.toDate ? accepted.toDate() : accepted).toLocaleDateString() : null;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;overflow:auto;padding:16px';
  overlay.innerHTML = `
    <div class="card" style="max-width:640px;margin:0 auto">
      <h2 style="font-size:1.15rem">${esc(n.title)}</h2>
      ${noticeBodyHtml()}
      ${when ? `<p style="margin-top:10px;font-size:0.8rem">${esc(n.acceptedOn)} ${esc(when)} (v${esc(currentPerson.noticeVersion || '')})</p>` : ''}
      <button type="button" class="btn btn-primary btn-block" style="margin-top:16px">${esc(n.close)}</button>
    </div>`;
  overlay.querySelector('button').addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
