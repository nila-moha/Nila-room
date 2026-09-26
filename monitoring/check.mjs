// Vérification quotidienne du site BN CORE GROUP (www.bncoregroup.com).
// Lancé une fois par jour par .github/workflows/site-monitor.yml (cron),
// jamais par un humain. Écrit public/data/latest.json et
// public/data/history.json (7 derniers jours), puis envoie une alerte par
// email via Resend si un point est rouge.

const SITE = 'https://www.bncoregroup.com';
const LANG_PAGES = { en: '/', fr: '/fr/', zh: '/zh/', ar: '/ar/' };
// "Industries" n'existe pas comme page séparée sur le site actuel — la page
// la plus proche est "réalisations" (zones d'intervention). Adapter cette
// liste si une page Industries est créée un jour.
const MAIN_PAGES = ['/index.html', '/a-propos.html', '/services.html', '/realisations.html', '/contact.html'];
const HISTORY_DAYS = 7;

// App de suivi chantier (chantier-app/) — Firebase Hosting + Firestore/Storage.
const APP_URL = 'https://app.bncoregroup.com/';
const FIREBASE_PROJECT = 'bn-core-chantier';
const FIREBASE_BUCKET = 'bn-core-chantier.firebasestorage.app';
const LOAD_TIME_LIMIT_MS = 3000;

const FORMSPREE_ENDPOINT = process.env.FORMSPREE_ENDPOINT || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ALERT_TO = 'info@bncoregroup.com';

function nowIso() {
  return new Date().toISOString();
}

async function timedFetch(url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', ...options });
    return { ok: res.ok, status: res.status, ms: Date.now() - start, body: res };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - start, error: String(err) };
  }
}

async function checkLangPages() {
  const results = {};
  for (const [lang, path] of Object.entries(LANG_PAGES)) {
    const r = await timedFetch(SITE + path);
    results[lang] = { status: r.ok ? 'green' : 'red', httpStatus: r.status, error: r.error || null };
  }
  return results;
}

async function checkLoadTime() {
  const r = await timedFetch(SITE + '/');
  if (!r.ok) return { status: 'red', ms: r.ms, error: r.error || `HTTP ${r.status}` };
  if (r.ms > LOAD_TIME_LIMIT_MS) return { status: 'orange', ms: r.ms };
  return { status: 'green', ms: r.ms };
}

async function checkBrokenLinks() {
  const brokenFound = [];
  let pagesChecked = 0;
  for (const page of MAIN_PAGES) {
    const r = await timedFetch(SITE + page);
    if (!r.ok) { brokenFound.push({ page, link: page, reason: `page elle-même: HTTP ${r.status}` }); continue; }
    pagesChecked++;
    const html = await r.body.text();
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const internal = hrefs.filter((h) =>
      h.startsWith('/') || h.startsWith(SITE) || (!h.includes('://') && !h.startsWith('mailto:') && !h.startsWith('tel:') && !h.startsWith('#'))
    );
    const seen = new Set();
    for (const href of internal) {
      const clean = href.split('#')[0];
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      const url = clean.startsWith('http') ? clean : new URL(clean, SITE + page).toString();
      const linkRes = await timedFetch(url, { method: 'HEAD' });
      // Certaines pages refusent HEAD (405) sans être cassées : on retente en GET.
      const finalRes = (!linkRes.ok && linkRes.status === 405) ? await timedFetch(url) : linkRes;
      if (!finalRes.ok) brokenFound.push({ page, link: clean, httpStatus: finalRes.status });
    }
  }
  return { status: brokenFound.length === 0 ? 'green' : 'red', pagesChecked, broken: brokenFound };
}

async function checkContactForm() {
  if (!FORMSPREE_ENDPOINT) {
    return { status: 'orange', note: "Formspree pas encore configuré (FORMSPREE_ENDPOINT manquant)." };
  }
  // On ne soumet PAS un vrai message chaque jour : le forfait gratuit
  // Formspree est limité en nombre d'envois par mois, à réserver aux
  // vrais visiteurs. On vérifie juste que le point de terminaison existe
  // et répond (une requête GET ne compte pas comme une soumission).
  const r = await timedFetch(FORMSPREE_ENDPOINT, { method: 'GET' });
  const reachable = r.status > 0 && r.status < 500;
  return { status: reachable ? 'green' : 'red', httpStatus: r.status, error: r.error || null };
}

async function checkGoogleIndex() {
  // Best-effort seulement : Google peut bloquer/limiter les requêtes
  // automatisées, ce point peut donc occasionnellement remonter orange
  // sans que ce soit un vrai problème d'indexation. À prendre comme
  // indicateur approximatif, pas comme une preuve définitive.
  try {
    const r = await fetch(`https://www.google.com/search?q=${encodeURIComponent('site:bncoregroup.com')}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BNCoreMonitor/1.0)' },
    });
    if (!r.ok) return { status: 'orange', note: `Requête Google non concluante (HTTP ${r.status}) — vérification manuelle recommandée.` };
    const html = await r.text();
    const indexed = html.includes('bncoregroup.com');
    return { status: indexed ? 'green' : 'orange', note: indexed ? null : "Aucun résultat détecté — peut aussi être un blocage de la requête automatique, pas forcément une désindexation." };
  } catch (err) {
    return { status: 'orange', note: `Vérification impossible : ${String(err)}` };
  }
}

async function checkApp() {
  const r = await timedFetch(APP_URL);
  if (!r.ok) return { status: 'red', httpStatus: r.status, error: r.error || null };
  const html = await r.body.text();
  const looksRight = html.includes('Suivi chantier');
  return { status: looksRight ? 'green' : 'red', httpStatus: r.status, ms: r.ms, note: looksRight ? null : 'Page servie mais ce n\'est pas l\'app chantier.' };
}

// Sans connexion, les données de l'app doivent être INACCESSIBLES : chaque
// sonde doit répondre 401/403. Un 200 = les règles de sécurité ont sauté
// (ex. règles de test « allow read: if true » déployées par erreur) → rouge.
async function checkAppSecurity() {
  const fsBase = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
  const probes = {
    projects: `${fsBase}/projects?pageSize=1`,
    people: `${fsBase}/people?pageSize=1`,
    invites: `${fsBase}/invites?pageSize=1`,
    storage: `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o?prefix=projects/&maxResults=1`,
  };
  const results = {};
  let status = 'green';
  for (const [name, url] of Object.entries(probes)) {
    const r = await timedFetch(url);
    const denied = r.status === 401 || r.status === 403;
    results[name] = r.status;
    if (r.ok) status = 'red';
    else if (!denied && status === 'green') status = 'orange'; // réponse inattendue (réseau, 5xx) : à regarder, pas une fuite avérée
  }
  return { status, httpStatus: results };
}

async function sendAlertEmail(reasons) {
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY manquant — alerte non envoyée. Raisons:', reasons);
    return;
  }
  const body = {
    from: 'BN CORE Monitoring <onboarding@resend.dev>',
    to: [ALERT_TO],
    subject: '🔴 Alerte — bncoregroup.com / app chantier',
    text: `Le tableau de bord de surveillance a détecté un problème :\n\n${reasons.join('\n')}\n\nVoir le détail : https://dashboard.bncoregroup.com/`,
  };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('Échec envoi alerte Resend:', res.status, await res.text());
}

async function main() {
  const langPages = await checkLangPages();
  const loadTime = await checkLoadTime();
  const brokenLinks = await checkBrokenLinks();
  const contactForm = await checkContactForm();
  const googleIndex = await checkGoogleIndex();
  const app = await checkApp();
  const appSecurity = await checkAppSecurity();

  const entry = {
    date: nowIso().slice(0, 10),
    time: nowIso(),
    checks: {
      http_en: langPages.en.status,
      http_fr: langPages.fr.status,
      http_zh: langPages.zh.status,
      http_ar: langPages.ar.status,
      google_index: googleIndex.status,
      contact_form: contactForm.status,
      broken_links: brokenLinks.status,
      load_time: loadTime.status,
      app_up: app.status,
      app_security: appSecurity.status,
    },
    details: { langPages, loadTime, brokenLinks, contactForm, googleIndex, app, appSecurity },
  };

  const fs = await import('node:fs/promises');
  const dataDir = new URL('./public/data/', import.meta.url);
  await fs.mkdir(dataDir, { recursive: true });

  let history = [];
  try {
    const raw = await fs.readFile(new URL('history.json', dataDir), 'utf8');
    history = JSON.parse(raw);
  } catch { /* premier run : pas encore d'historique */ }

  history = history.filter((h) => h.date !== entry.date);
  history.push(entry);
  history.sort((a, b) => a.date.localeCompare(b.date));
  history = history.slice(-HISTORY_DAYS);

  await fs.writeFile(new URL('history.json', dataDir), JSON.stringify(history, null, 2));
  await fs.writeFile(new URL('latest.json', dataDir), JSON.stringify(entry, null, 2));

  const redReasons = Object.entries(entry.checks)
    .filter(([, v]) => v === 'red')
    .map(([k]) => `- ${k}`);
  if (redReasons.length > 0) {
    await sendAlertEmail(redReasons);
  }

  console.log(JSON.stringify(entry, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
