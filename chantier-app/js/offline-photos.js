// ============================================================
// Photos hors connexion — file d'attente sur le téléphone
// ============================================================
// Sans réseau (chantier isolé), une photo ne peut pas partir tout de suite.
// Au lieu d'échouer, elle est rangée sur le téléphone (IndexedDB) et le
// document (journal, problème, pointage, achat, étape de check-list) est
// enregistré avec « pendingPhotos: n ». Dès que le réseau revient, chaque
// photo est envoyée puis ajoutée au document (photoUrls / evidencePhotos).
//
// Les règles Firestore n'autorisent l'auteur qu'à ajouter ces photos à SON
// document — rien d'autre (voir firestore.rules).
// ============================================================

const PHOTO_QUEUE_DB = 'bn-photo-queue';
const PHOTO_QUEUE_STORE = 'photos';

// Envoi rapide ou échec rapide : par défaut le SDK réessaie pendant 10 min.
try { storage.setMaxUploadRetryTime(20000); } catch (e) { /* ancienne version du SDK */ }

function openPhotoQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_QUEUE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(PHOTO_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function photoQueueOp(mode, fn) {
  const idb = await openPhotoQueue();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(PHOTO_QUEUE_STORE, mode);
    const out = fn(tx.objectStore(PHOTO_QUEUE_STORE));
    tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    tx.onerror = () => reject(tx.error);
  });
}
const queuePhoto = (item) => photoQueueOp('readwrite', s => s.add(item));
const queuedPhotos = () => photoQueueOp('readonly', s => s.getAll());
const unqueuePhoto = (id) => photoQueueOp('readwrite', s => s.delete(id));

function isNetworkError(err) {
  const code = (err && err.code) || '';
  return !navigator.onLine || code === 'storage/retry-limit-exceeded' || code === 'storage/unknown' || /network|offline|fetch/i.test(String(err && err.message));
}

// Envoie les photos ; celles qui ne partent pas faute de réseau sont mises
// en file d'attente pour le document docPath (champ field).
// Retourne { urls, pending }.
async function uploadPhotosOrQueue(basePath, files, docPath, field = 'photoUrls') {
  const urls = [];
  let pending = 0;
  for (const file of files) {
    const blob = await resizeImageFile(file);
    const path = basePath + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    if (navigator.onLine) {
      try {
        const ref = storage.ref(path);
        await ref.put(blob, { contentType: 'image/jpeg' });
        urls.push(await ref.getDownloadURL());
        continue;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }
    await queuePhoto({ path, blob, docPath, field, uid: currentUser.uid, createdAt: Date.now() });
    pending++;
  }
  if (pending) updatePhotoQueueBadge();
  return { urls, pending };
}

// Hors ligne, Firestore garde l'écriture en attente et ne « termine » la
// promesse qu'au retour du réseau : on n'attend pas, sinon le bouton reste
// bloqué sur « Publication… ». L'écriture partira seule.
async function saveDoc(promise) {
  if (navigator.onLine) return promise;
  promise.catch(err => console.warn('Écriture différée échouée :', err));
  return undefined;
}

let photoFlushRunning = false;
async function flushPhotoQueue() {
  if (photoFlushRunning || !navigator.onLine || !currentUser) return;
  photoFlushRunning = true;
  try {
    const items = (await queuedPhotos()).filter(i => i.uid === currentUser.uid);
    if (!items.length) return;
    // D'abord laisser partir les rapports écrits hors ligne : sinon la photo
    // arriverait avant son rapport (« document introuvable »).
    await Promise.race([db.waitForPendingWrites(), new Promise(r => setTimeout(r, 20000))]);
    for (const item of items) {
      try {
        const ref = storage.ref(item.path);
        await ref.put(item.blob, { contentType: 'image/jpeg' });
        const url = await ref.getDownloadURL();
        await db.doc(item.docPath).update({
          [item.field]: firebase.firestore.FieldValue.arrayUnion(url),
          pendingPhotos: firebase.firestore.FieldValue.increment(-1),
        });
        await unqueuePhoto(item.id);
      } catch (err) {
        if (isNetworkError(err)) break; // réseau reparti : on réessaiera plus tard
        // Rapport pas encore arrivé au serveur, ou refus passager : on GARDE
        // la photo et on réessaie. Abandon seulement après 7 jours (ex.
        // rapport supprimé entre-temps) — jamais de perte silencieuse avant.
        if (Date.now() - item.createdAt < 7 * 86400000) { console.warn('Photo en attente, nouvel essai plus tard :', err.code || err); continue; }
        console.warn('Photo en attente abandonnée après 7 jours :', err);
        await unqueuePhoto(item.id);
      }
    }
  } finally {
    photoFlushRunning = false;
    updatePhotoQueueBadge();
  }
}

const PHOTO_QUEUE_I18N = {
  fr: (n) => `📷 ${n} photo(s) en attente de réseau — envoi automatique`,
  en: (n) => `📷 ${n} photo(s) waiting for network — will send automatically`,
  ro: (n) => `📷 ${n} fotografie(i) așteaptă rețeaua — trimitere automată`,
  zh: (n) => `📷 ${n} 张照片等待网络 — 将自动发送`,
};
async function updatePhotoQueueBadge() {
  let n = 0;
  try { n = currentUser ? (await queuedPhotos()).filter(i => i.uid === currentUser.uid).length : 0; } catch (e) { /* IndexedDB indisponible */ }
  let el = document.getElementById('photo-queue-badge');
  if (!n) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'photo-queue-badge';
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:1500;background:#7a5300;color:#fff;padding:10px 14px;border-radius:10px;font-size:0.85rem;text-align:center';
    document.body.appendChild(el);
  }
  el.textContent = (PHOTO_QUEUE_I18N[getLang()] || PHOTO_QUEUE_I18N.fr)(n);
}

window.addEventListener('online', () => flushPhotoQueue());
setInterval(() => flushPhotoQueue(), 60000);
