// ============================================================
// Confirmation de présence la veille (anti « no-show »)
// ============================================================
// Chaque ouvrier planifié confirme « je serai là » pour le prochain jour
// ouvrable. Le serveur (functions/index.js) lui envoie un rappel à 14 h
// s'il n'a pas confirmé, puis prévient l'admin à 18 h avec la liste des
// personnes non confirmées — il reste la soirée pour remplacer.
// ============================================================

const CONF_I18N = {
  fr: { title: 'Vos prochains jours de chantier', confirm: 'Je confirme ma présence', confirmed: 'Présence confirmée', today: "Aujourd'hui", next: 'Prochain jour', none: 'Aucun chantier planifié aujourd’hui ni au prochain jour ouvrable.', at: 'à' },
  en: { title: 'Your next site days', confirm: 'I confirm I will be there', confirmed: 'Attendance confirmed', today: 'Today', next: 'Next day', none: 'No site planned today or on the next working day.', at: 'at' },
  ro: { title: 'Următoarele zile pe șantier', confirm: 'Confirm prezența', confirmed: 'Prezență confirmată', today: 'Azi', next: 'Ziua următoare', none: 'Niciun șantier planificat azi sau în următoarea zi lucrătoare.', at: 'la' },
  zh: { title: '您接下来的工地日程', confirm: '我确认到场', confirmed: '已确认到场', today: '今天', next: '下一个工作日', none: '今天和下一个工作日都没有安排工地。', at: '时间' },
};
function cf(key) { const d = CONF_I18N[getLang()] || CONF_I18N.fr; return d[key] || CONF_I18N.fr[key]; }

function dayStr(d) { return dateStrOf(d.getFullYear(), d.getMonth(), d.getDate()); }
function nextWorkdayFrom(d) {
  const x = new Date(d); x.setDate(x.getDate() + 1);
  while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
  return dayStr(x);
}

function renderUpcomingConfirmCard(target) {
  if (!target) return;
  const today = dayStr(new Date()), next = nextWorkdayFrom(new Date());
  const unsub = db.collection('assignments').where('personUid', '==', currentUser.uid).onSnapshot(snap => {
    if (!target.isConnected) return;
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.date === today || a.date === next)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!items.length) { target.innerHTML = ''; return; }
    target.innerHTML = `<div class="card">
      <h3 style="font-size:1rem">${esc(cf('title'))}</h3>
      ${items.map(a => `<div class="list-row" style="flex-wrap:wrap">
        <div class="main">
          <div class="name">${esc(a.date === today ? cf('today') : cf('next'))} — ${esc(fmtDateLabel(a.date))}</div>
          <div class="sub"><span class="badge" style="background:${esc(a.projectColor || DEFAULT_PROJECT_COLOR)};color:#fff">${esc(a.projectName)}</span>${a.startTime ? ` ${esc(cf('at'))} ${esc(a.startTime)}` : ''}${a.address ? ` · 📍 ${esc(a.address)}` : ''}</div>
        </div>
        <div class="actions">${a.confirmedAt ? `<span class="badge badge-active">✅ ${esc(cf('confirmed'))}</span>`
          : `<button type="button" class="btn btn-primary btn-sm" data-confirm-assign="${a.id}">${esc(cf('confirm'))}</button>`}</div>
      </div>`).join('')}
    </div>`;
    target.querySelectorAll('[data-confirm-assign]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await saveDoc(db.collection('assignments').doc(b.dataset.confirmAssign).update({ confirmedAt: firebase.firestore.FieldValue.serverTimestamp() })); }
      catch (err) { b.disabled = false; showError(target, t('errorPrefix') + err.message); }
    }));
  }, () => { target.innerHTML = ''; });
  unsubscribers.push(unsub);
}

// Pastille pour l'admin (calendrier) : confirmé / pas encore.
function confirmMarkHtml(a) {
  const today = dayStr(new Date());
  if (a.date < today) return '';
  return a.confirmedAt ? ' <span class="badge badge-active" title="Présence confirmée">✅ confirmé</span>'
    : ' <span class="badge badge-reported" title="Pas encore confirmé">⏳ non confirmé</span>';
}
