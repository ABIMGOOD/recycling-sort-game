(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    play: $('play'),
    item: $('item'),
    img: $('item-img'),
    name: $('item-name'),
    hint: $('hint'),
    feedback: $('feedback'),
    fbTitle: $('fb-title'),
    fbBin: $('fb-bin'),
    fbReason: $('fb-reason'),
    fbSource: $('fb-source'),
    next: $('next'),
    end: $('end'),
    endScore: $('end-score'),
    again: $('again'),
    loading: $('loading'),
    loadError: $('load-error'),
    score: $('score'),
    streak: $('streak'),
  };

  const bins = Array.from(document.querySelectorAll('.bin'));

  // Human-readable names, matching the bin buttons in index.html.
  const BIN_NAMES = {
    general: 'General waste (green lid)',
    recycling: 'Recycling (blue lid)',
    food: 'Food waste (caddy / brown bin)',
    drop_off: 'Drop-off point (tip or shop)',
  };

  let deck = [];
  let index = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let selected = false;
  let answered = false;
  let drag = null;
  let suppressClick = false;

  // ---------- Helpers ----------

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function updateStats() {
    els.score.textContent = score;
    els.streak.textContent = streak;
  }

  function binAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.bin') : null;
  }

  function setHint(text) {
    els.hint.textContent = text;
  }

  // ---------- Game flow ----------

  function showItem() {
    const item = deck[index];
    answered = false;
    selected = false;

    els.item.classList.remove('selected');
    els.item.setAttribute('aria-pressed', 'false');
    els.item.style.transform = '';

    els.img.hidden = false;
    els.img.src = 'assets/items/' + item.id + '.svg';
    els.img.onerror = () => { els.img.hidden = true; };
    els.name.textContent = item.name;

    bins.forEach((b) => {
      b.disabled = false;
      b.classList.remove('target', 'correct', 'wrong-pick');
    });

    els.feedback.hidden = true;
    setHint('Drag the item into a bin, or tap it and then tap a bin.');
  }

  function answer(binId) {
    if (answered) return;
    answered = true;

    const item = deck[index];
    const correct = binId === item.bin;

    if (correct) {
      score += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
    updateStats();

    bins.forEach((b) => {
      b.disabled = true;
      b.classList.remove('target');
      if (b.dataset.bin === item.bin) b.classList.add('correct');
      else if (b.dataset.bin === binId) b.classList.add('wrong-pick');
    });

    els.feedback.dataset.result = correct ? 'correct' : 'wrong';
    els.fbTitle.textContent = correct ? 'Correct!' : 'Not quite';
    els.fbBin.textContent = correct
      ? item.name + ' goes in the ' + BIN_NAMES[item.bin] + '.'
      : 'You picked ' + BIN_NAMES[binId] + '. ' + item.name + ' goes in the ' + BIN_NAMES[item.bin] + '.';
    els.fbReason.textContent = item.reason;
    els.fbSource.href = item.source;
    els.feedback.hidden = false;
    els.next.focus();
  }

  function nextItem() {
    index += 1;
    if (index >= deck.length) {
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
      'You scored ' + score + ' out of ' + deck.length + '. Best streak: ' + bestStreak + '.';
    els.again.focus();
  }

  function start() {
    deck = shuffle(deck);
    index = 0;
    score = 0;
    streak = 0;
    bestStreak = 0;
    updateStats();
    els.end.hidden = true;
    els.play.hidden = false;
    showItem();
  }

  // ---------- Drag and tap on the item ----------

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
    bins.forEach((b) => b.classList.toggle('target', b === hover));
  });

  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const wasMoved = drag.moved;
    drag = null;

    els.item.classList.remove('dragging');
    els.item.style.transform = '';
    bins.forEach((b) => b.classList.remove('target'));

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
    bins.forEach((b) => b.classList.remove('target'));
  });

  // Tap (or keyboard Enter/Space) selects the item.
  els.item.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (answered) return;
    selected = !selected;
    els.item.classList.toggle('selected', selected);
    els.item.setAttribute('aria-pressed', String(selected));
    setHint(selected ? 'Now tap the bin it goes in.' : 'Drag the item into a bin, or tap it and then tap a bin.');
  });

  // ---------- Bins ----------

  bins.forEach((b) => {
    b.addEventListener('click', () => {
      if (answered) return;
      answer(b.dataset.bin);
    });
  });

  // ---------- Buttons ----------

  els.next.addEventListener('click', nextItem);
  els.again.addEventListener('click', start);

  // ---------- Load data ----------

  async function load() {
    try {
      const res = await fetch('data/items.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      // Only show items that are verified and have a known bin.
      const usable = data.items.filter((i) => i.status === 'verified' && BIN_NAMES[i.bin]);
      if (usable.length === 0) throw new Error('no verified items yet');

      deck = usable;
      els.loading.hidden = true;
      start();
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
