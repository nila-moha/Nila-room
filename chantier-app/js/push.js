// ============================================================
// Notifications push (Firebase Cloud Messaging) — côté téléphone
// ============================================================
// Chaque personne active les notifications une fois (bouton « Activer les
// notifications » en haut de l'écran) : le téléphone reçoit un jeton,
// enregistré dans pushTokens/{jeton} ; le serveur (functions/index.js)
// s'en sert pour prévenir des demandes de personnel.
//
// iPhone : uniquement si l'app est AJOUTÉE À L'ÉCRAN D'ACCUEIL (iOS 16.4+)
// — dans Safari seul, Apple ne permet pas les notifications web.
// ============================================================

const PUSH_I18N = {
  fr: { failed: "Impossible d'activer les notifications sur cet appareil. Réessayez avec Chrome (Android) ou l'app ajoutée à l'écran d'accueil (iPhone).",
    enable: '🔔 Activer les notifications', intro: 'Recevez une alerte sur ce téléphone pour les nouvelles demandes et missions.',
    later: 'Plus tard', enabled: 'Notifications activées sur ce téléphone.', denied: 'Notifications bloquées : autorisez-les dans les réglages du navigateur / du téléphone pour cette app.',
    iosHint: "iPhone : pour recevoir les notifications, ajoutez d'abord l'app à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »), puis ouvrez-la depuis l'icône.",
    unsupported: 'Ce navigateur ne permet pas les notifications. Utilisez Chrome (Android) ou l’app ajoutée à l’écran d’accueil (iPhone).' },
  en: { failed: 'Could not turn on notifications on this device. Try Chrome (Android) or the app added to the Home Screen (iPhone).',
    enable: '🔔 Turn on notifications', intro: 'Get an alert on this phone for new requests and missions.',
    later: 'Later', enabled: 'Notifications are on for this phone.', denied: 'Notifications are blocked: allow them for this app in your browser / phone settings.',
    iosHint: 'iPhone: to get notifications, first add the app to your Home Screen (Share → "Add to Home Screen"), then open it from the icon.',
    unsupported: 'This browser does not support notifications. Use Chrome (Android) or the app added to the Home Screen (iPhone).' },
  ro: { failed: 'Notificările nu au putut fi activate pe acest dispozitiv. Încercați Chrome (Android) sau aplicația adăugată pe ecranul principal (iPhone).',
    enable: '🔔 Activează notificările', intro: 'Primiți o alertă pe acest telefon pentru cereri și misiuni noi.',
    later: 'Mai târziu', enabled: 'Notificările sunt activate pe acest telefon.', denied: 'Notificările sunt blocate: permiteți-le pentru această aplicație în setările browserului / telefonului.',
    iosHint: 'iPhone: pentru notificări, adăugați mai întâi aplicația pe ecranul principal (Partajare → „Adaugă pe ecranul principal”), apoi deschideți-o din pictogramă.',
    unsupported: 'Acest browser nu permite notificări. Folosiți Chrome (Android) sau aplicația adăugată pe ecranul principal (iPhone).' },
  zh: { failed: '无法在此设备上开启通知。请使用 Chrome（安卓）或添加到主屏幕的应用（iPhone）。',
    enable: '🔔 开启通知', intro: '在此手机上接收新需求和新任务的提醒。',
    later: '稍后', enabled: '此手机已开启通知。', denied: '通知已被阻止：请在浏览器/手机设置中允许此应用发送通知。',
    iosHint: 'iPhone：要接收通知，请先将应用添加到主屏幕（分享 →“添加到主屏幕”），然后从图标打开。',
    unsupported: '此浏览器不支持通知。请使用 Chrome（安卓）或添加到主屏幕的应用（iPhone）。' },
};
function pt(key) { const d = PUSH_I18N[getLang()] || PUSH_I18N.fr; return d[key] || PUSH_I18N.fr[key]; }

function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window &&
    typeof firebase.messaging === 'function' && firebase.messaging.isSupported();
}
function pushDismissed() { try { return localStorage.getItem('bnPushLater') === '1'; } catch (e) { return false; } }

let pushForegroundWired = false;
let currentPushToken = null;
let pushRefreshed = false; // jeton rafraîchi au plus une fois par ouverture de l'app

async function registerPushToken() {
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  const messaging = firebase.messaging();
  const token = await messaging.getToken({ serviceWorkerRegistration: reg });
  if (!token) throw new Error('no token');
  currentPushToken = token;
  await db.collection('pushTokens').doc(token).set({
    uid: currentUser.uid, role: currentPerson.role, lang: getLang(),
    ua: navigator.userAgent.slice(0, 200), updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  if (!pushForegroundWired) {
    pushForegroundWired = true;
    // App ouverte au premier plan : le système n'affiche rien, on montre
    // un bandeau dans l'app.
    messaging.onMessage((payload) => {
      const n = payload.notification || {};
      showPushToast(`${n.title || ''}${n.body ? ' — ' + n.body : ''}`);
    });
  }
  return token;
}

// À la déconnexion : on retire le jeton de ce téléphone, sinon la
// personne suivante qui se connecte dessus recevrait les alertes du
// compte précédent. Sans effet si les notifications n'étaient pas actives.
async function unregisterPushToken() {
  if (!currentPushToken) return;
  try {
    await db.collection('pushTokens').doc(currentPushToken).delete();
    await firebase.messaging().deleteToken();
  } catch (e) { /* hors ligne : le serveur nettoiera les jetons morts */ }
  currentPushToken = null;
  pushRefreshed = false;
}

function showPushToast(text) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:2000;background:var(--brown-900,#2b2118);color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:0.9rem';
  el.textContent = '🔔 ' + text;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

// Bandeau affiché en haut de l'espace de chaque rôle tant que les
// notifications ne sont pas actives sur ce téléphone. Si elles le sont
// déjà, on rafraîchit le jeton en silence (il peut changer).
function pushBannerHtml() {
  if (!pushSupported()) {
    if (isIos() && !isStandalone()) return `<div class="card" id="push-banner" style="background:var(--gold-100)"><p style="margin:0">${esc(pt('iosHint'))}</p></div>`;
    return '';
  }
  if (Notification.permission === 'granted') {
    if (!pushRefreshed) { pushRefreshed = true; registerPushToken().catch(() => { pushRefreshed = false; }); }
    return '';
  }
  if (Notification.permission === 'denied') return `<div class="card" id="push-banner" style="background:var(--gold-100)"><p style="margin:0">${esc(pt('denied'))}</p></div>`;
  if (pushDismissed()) return '';
  return `<div class="card" id="push-banner" style="background:var(--gold-100)">
    <p style="margin:0 0 8px">${esc(pt('intro'))}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn btn-primary btn-sm" id="push-enable">${esc(pt('enable'))}</button>
      <button type="button" class="btn btn-outline btn-sm" id="push-later">${esc(pt('later'))}</button>
    </div></div>`;
}

function wirePushBanner() {
  const banner = document.getElementById('push-banner');
  if (!banner) return;
  const enable = document.getElementById('push-enable');
  if (enable) enable.addEventListener('click', async () => {
    enable.disabled = true;
    try {
      const perm = await Notification.requestPermission(); // doit suivre un clic (iPhone)
      if (perm !== 'granted') { banner.innerHTML = `<p style="margin:0">${esc(pt('denied'))}</p>`; return; }
      await registerPushToken();
      banner.innerHTML = `<p style="margin:0">✅ ${esc(pt('enabled'))}</p>`;
      setTimeout(() => banner.remove(), 4000);
    } catch (err) {
      enable.disabled = false;
      console.warn('Notifications :', err);
      showError(banner, pt('failed'));
    }
  });
  const later = document.getElementById('push-later');
  if (later) later.addEventListener('click', () => { try { localStorage.setItem('bnPushLater', '1'); } catch (e) { /* pas grave */ } banner.remove(); });
}

// Insère le bandeau juste sous la barre du haut de l'écran courant.
function mountPushBanner() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || document.getElementById('push-banner')) return;
  const html = pushBannerHtml();
  if (!html) return;
  const holder = document.createElement('div');
  holder.className = 'wrap';
  holder.style.paddingBottom = '0';
  holder.innerHTML = html;
  topbar.insertAdjacentElement('afterend', holder);
  wirePushBanner();
}
