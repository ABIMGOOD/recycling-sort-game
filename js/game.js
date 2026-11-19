(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ROUND_SIZE = 5;
  const STORE_KEY = 'recyclingSort.system';

  const els = {
    systemLabel: $('system-label'),
    stats: $('stats'),
    score: $('score'),
    streak: $('streak'),
    loading: $('loading'),
    loadError: $('load-error'),
    setup: $('setup'),
    play: $('play'),
    progress: $('progress'),
    hint: $('hint'),
    item: $('item'),
    img: $('item-img'),
    name: $('item-name'),
    bins: $('bins'),
    feedback: $('feedback'),
    fbTitle: $('fb-title'),
    fbBin: $('fb-bin'),
    fbReason: $('fb-reason'),
    fbSource: $('fb-source'),
    next: $('next'),
    end: $('end'),
    endScore: $('end-score'),
    endNote: $('end-note'),
    again: $('again'),
    switch: $('switch'),
    switchEnd: $('switch-end'),
  };

  let data = null;
  let system = null;      // 'home' or 'halls'
  let queue = [];         // this round's items
  let index = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let selected = false;
  let answered = false;
  let drag = null;
  let suppressClick = false;

  // ---------- Storage (per device, optional) ----------

  function readSaved() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function saveSystem(value) {
    try { localStorage.setItem(STORE_KEY, value); } catch (e) { /* private mode: ignore */ }
  }

  // ---------- Helpers ----------

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function usableItems() {
    return data.items.filter((i) => i.rules[system] && i.rules[system].status === 'verified');
  }

  function binConfig(binId) {
    return data.systems[system].bins.find((b) => b.id === binId);
  }

  function binName(binId) {
    const b = binConfig(binId);
    return b ? b.name + ' (' + b.sub.toLowerCase() + ')' : binId;
  }

  function binAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.bin') : null;
  }

  function allBins() {
    return Array.from(els.bins.querySelectorAll('.bin'));
  }

  function setHint(text) { els.hint.textContent = text; }

  function updateStats() {
    els.score.textContent = score;
    els.streak.textContent = streak;
  }

  // ---------- Screens ----------

  function showSetup() {
    els.setup.hidden = false;
    els.play.hidden = true;
    els.feedback.hidden = true;
    els.end.hidden = true;
    els.stats.hidden = true;
    els.systemLabel.textContent = 'Choose where you live';
  }

  function renderBins() {
    els.bins.innerHTML = '';
    els.bins.dataset.count = String(data.systems[system].bins.length);
    data.systems[system].bins.forEach((b) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bin';
      btn.dataset.bin = b.id;
      btn.style.setProperty('--lid', b.color);
      btn.style.setProperty('--lid-text', b.text || '#ffffff');

      const lid = document.createElement('span');
      lid.className = 'lid';
      lid.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'bin-name';
      name.textContent = b.name;

      const sub = document.createElement('span');
      sub.className = 'bin-sub';
      sub.textContent = b.sub;

      btn.append(lid, name, sub);
      btn.addEventListener('click', () => {
        if (answered) return;
        answer(b.id);
      });
      els.bins.appendChild(btn);
    });
  }

  function startRound() {
    queue = shuffle(usableItems()).slice(0, ROUND_SIZE);
    index = 0;
    score = 0;
    streak = 0;
    bestStreak = 0;
    updateStats();

    els.setup.hidden = true;
    els.end.hidden = true;
    els.stats.hidden = false;
    els.play.hidden = false;
    els.systemLabel.textContent = data.systems[system].name;

    renderBins();
    showItem();
  }

  function showItem() {
    const item = queue[index];
    answered = false;
    selected = false;

    els.item.classList.remove('selected');
    els.item.setAttribute('aria-pressed', 'false');
    els.item.style.transform = '';

    els.img.hidden = false;
    els.img.src = 'assets/items/' + item.id + '.svg';
    els.img.onerror = () => { els.img.hidden = true; };
    els.name.textContent = item.name;

    els.progress.textContent = 'Question ' + (index + 1) + ' of ' + queue.length;

    allBins().forEach((b) => {
      b.disabled = false;
      b.classList.remove('target', 'correct', 'wrong-pick');
    });

    els.feedback.hidden = true;
    setHint('Drag the item into a bin, or tap it and then tap a bin.');
  }

  function answer(binId) {
    if (answered) return;
    answered = true;

    const item = queue[index];
    const rule = item.rules[system];
    const correct = binId === rule.bin;

    if (correct) {
      score += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
    updateStats();

    allBins().forEach((b) => {
      b.disabled = true;
      b.classList.remove('target');
      if (b.dataset.bin === rule.bin) b.classList.add('correct');
      else if (b.dataset.bin === binId) b.classList.add('wrong-pick');
    });

    els.feedback.dataset.result = correct ? 'correct' : 'wrong';
    els.fbTitle.textContent = correct ? 'Correct!' : 'Not quite';
    els.fbBin.textContent = correct
      ? item.name + ' goes in: ' + binName(rule.bin) + '.'
      : 'You picked ' + binName(binId) + '. ' + item.name + ' goes in: ' + binName(rule.bin) + '.';
    els.fbReason.textContent = rule.reason;
    els.fbSource.href = rule.source;
    els.next.textContent = index + 1 < queue.length ? 'Next' : 'See results';
    els.feedback.hidden = false;
    els.next.focus();
  }

  function nextItem() {
    index += 1;
    if (index >= queue.length) {
      showEnd();
    } else {
      showItem();
    }
  }

  function showEnd() {
    els.play.hidden = true;
    els.feedback.hidden = true;
    els.end.hidden = false;
    els.endScore.textContent =
      'You scored ' + score + ' out of ' + queue.length + '. Best streak: ' + bestStreak + '.';
    const pool = usableItems().length;
    els.endNote.textContent = 'This round used ' + queue.length + ' of ' + pool + ' items for your setting.';
    els.again.focus();
  }

  // ---------- Drag and tap on the item card ----------

  els.item.addEventListener('pointerdown', (e) => {
    if (answered) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    els.item.setPointerCapture(e.pointerId);
    els.item.classList.add('dragging');
  });

  els.item.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (!drag.moved) return;

    els.item.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + (dx / 20) + 'deg)';
    const hover = binAt(e.clientX, e.clientY);
    allBins().forEach((b) => b.classList.toggle('target', b === hover));
  });

  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const wasMoved = drag.moved;
    drag = null;

    els.item.classList.remove('dragging');
    els.item.style.transform = '';
    allBins().forEach((b) => b.classList.remove('target'));

    if (wasMoved) {
      suppressClick = true; // a drag should not also count as a tap
      const bin = binAt(e.clientX, e.clientY);
      if (bin && !bin.disabled) answer(bin.dataset.bin);
    }
  }

  els.item.addEventListener('pointerup', endDrag);
  els.item.addEventListener('pointercancel', () => {
    drag = null;
    els.item.classList.remove('dragging');
    els.item.style.transform = '';
    allBins().forEach((b) => b.classList.remove('target'));
  });

  // Tap or keyboard Enter/Space selects the item.
  els.item.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (answered) return;
    selected = !selected;
    els.item.classList.toggle('selected', selected);
    els.item.setAttribute('aria-pressed', String(selected));
    setHint(selected ? 'Now tap the bin it goes in.' : 'Drag the item into a bin, or tap it and then tap a bin.');
  });

  // ---------- Buttons ----------

  function chooseSystem(value) {
    system = value;
    saveSystem(value);
    startRound();
  }

  document.querySelectorAll('.choice').forEach((btn) => {
    btn.addEventListener('click', () => chooseSystem(btn.dataset.system));
  });

  els.next.addEventListener('click', nextItem);
  els.again.addEventListener('click', startRound);
  els.switch.addEventListener('click', showSetup);
  els.switchEnd.addEventListener('click', showSetup);

  // ---------- Load data ----------

  async function load() {
    try {
      const res = await fetch('data/items.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();

      els.loading.hidden = true;

      const saved = readSaved();
      if (saved && data.systems[saved]) {
        system = saved;
        if (usableItems().length) {
          startRound();
          return;
        }
      }
      showSetup();
    } catch (err) {
      els.loading.hidden = true;
      els.loadError.hidden = false;
      els.loadError.textContent =
        'Could not load the game data (' + err.message + '). ' +
        'If you opened index.html directly from a file, run a local server (see README) or use GitHub Pages.';
    }
  }

  load();
})();
