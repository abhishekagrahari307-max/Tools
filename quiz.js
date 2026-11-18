// ToolKit Quiz engine — all local, no network calls. The question bank lives in
// quiz-data.js (window.QUIZ_BANK); attempts are kept in localStorage only.

(() => {
  const BANK = window.QUIZ_BANK;
  const GEN = window.QUIZ_GEN || null;
  const STORE_KEY = 'toolkit-quiz-v1';
  const HISTORY_LIMIT = 30;
  const TEST_SECONDS = 15 * 60;
  const TEST_LENGTH = 20;
  const LEVELS = ['easy', 'medium', 'hard'];
  const LEVEL_TITLE = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const shiftLevel = (level, delta) =>
    LEVELS[Math.min(LEVELS.length - 1, Math.max(0, LEVELS.indexOf(level) + delta))];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const byId = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (seconds) => Math.floor(seconds / 60) + ':' + pad(Math.max(0, seconds) % 60);
  const LETTER = ['A', 'B', 'C', 'D'];

  const ICONS = {
    physics:
      '<path d="M12 12h.01"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/>',
    chemistry:
      '<path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 17l-5-9V3"/><path d="M7.5 14h9"/>',
    maths: '<path d="M4 5h6l-6 14h6"/><path d="M14 9h6M14 15h6M17 9v6"/>',
    biology:
      '<path d="M20 4C10 5 5 10 5 17c0 1 .2 2 .5 3C13 20 19 14 20 4z"/><path d="M5 20c2-6 6-9 11-12"/>',
    gk: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    computer: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  };

  /* ------------------------------------------------------------------ storage */
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.attempts)) {
        return {
          attempts: parsed.attempts,
          levels: parsed.levels && typeof parsed.levels === 'object' ? parsed.levels : {},
        };
      }
    } catch {
      /* private mode or corrupted value — start fresh */
    }
    return { attempts: [], levels: {} };
  }
  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      /* quota or private mode — the quiz still works without history */
    }
  }
  const store = loadStore();
  const bestFor = (subject) => {
    const scores = store.attempts.filter((a) => a.subject === subject).map((a) => a.percent);
    return scores.length ? Math.max(...scores) : null;
  };
  // Where a subject starts: the level saved when the last attempt ended,
  // otherwise a level inferred from the recent scores.
  function startLevelFor(subject) {
    const saved = store.levels[subject];
    if (LEVELS.includes(saved)) return saved;
    const recent = store.attempts.filter((a) => a.subject === subject).slice(0, 3);
    if (!recent.length) return 'easy';
    const average = recent.reduce((sum, attempt) => sum + attempt.percent, 0) / recent.length;
    return average >= 80 ? 'hard' : average >= 50 ? 'medium' : 'easy';
  }

  /* -------------------------------------------------------------------- toast */
  let toastTimer;
  function toast(message) {
    const el = byId('toast');
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
  }

  /* ----------------------------------------------------------------- routing */
  const SCREENS = ['home', 'quiz', 'result', 'history'];
  let session = null;
  let pendingSubmit = 0;

  function showScreen(name) {
    SCREENS.forEach((screen) => {
      const section = byId(screen);
      if (section) section.hidden = screen !== name;
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }
  function route() {
    const page = (location.hash || '#home').slice(1).split('/')[0];
    if (page === 'quiz' && !session) return go('#home');
    if (page === 'result' && !session?.submitted) return go('#home');
    if (page === 'history') renderHistory();
    if (!SCREENS.includes(page)) return go('#home');
    showScreen(page);
  }

  /* -------------------------------------------------------------------- home */
  function renderSubjects() {
    const holder = byId('subjects');
    holder.replaceChildren();
    Object.entries(BANK).forEach(([key, subject]) => {
      const best = bestFor(key);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'subject';
      card.dataset.subject = key;

      const icon = document.createElement('span');
      icon.className = 'ic';
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        (ICONS[key] || '') +
        '</svg>';

      const name = document.createElement('b');
      name.textContent = subject.name;
      const tagline = document.createElement('small');
      tagline.textContent = subject.tagline;

      const meta = document.createElement('span');
      meta.className = 'meta';
      const count = document.createElement('span');
      count.textContent = subject.questions.length + ' curated + auto';
      meta.append(count);
      const startingLevel = startLevelFor(key);
      const level = document.createElement('span');
      level.className = 'lvl';
      level.dataset.level = startingLevel;
      level.textContent = LEVEL_TITLE[startingLevel] || 'Easy';
      meta.append(level);
      if (best !== null) {
        const bestEl = document.createElement('span');
        bestEl.className = 'best';
        bestEl.textContent = 'Best ' + best + '%';
        meta.append(bestEl);
      }

      card.append(icon, name, tagline, meta);
      card.addEventListener('click', () => startQuiz(key));
      holder.append(card);
    });
  }

  const chosenMode = () => $('input[name="mode"]:checked')?.value || 'practice';

  /* -------------------------------------------------------------------- quiz */
  // Build the next question for a level: curated bank first, then the
  // generator, and never the same wording twice in one attempt.
  function makeQuestion(level) {
    const subject = BANK[session.subject];
    const bank = (subject.questions || []).filter(
      (question) => question.level === level && !session.seen.has(question.q),
    );
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const useBank = bank.length > 0 && (Math.random() < 0.55 || !GEN);
      const candidate = useBank
        ? bank.splice(Math.floor(Math.random() * bank.length), 1)[0]
        : GEN
          ? GEN.generate(session.subject, level)
          : null;
      if (!candidate || !Array.isArray(candidate.options) || candidate.options.length < 4) continue;
      if (typeof candidate.answer !== 'number' || session.seen.has(candidate.q)) continue;
      return candidate;
    }
    const spare = (subject.questions || []).filter((question) => !session.seen.has(question.q));
    if (spare.length) return spare[Math.floor(Math.random() * spare.length)];
    return GEN ? GEN.generate(session.subject, level) : null;
  }

  function pushQuestion(question) {
    session.questions.push(question);
    session.answers.push(null);
    session.marked.push(false);
    session.checked.push(false);
    if (question && question.q) session.seen.add(question.q);
  }

  function placeQuestion(index, question) {
    session.questions[index] = question;
    session.answers[index] = null;
    session.marked[index] = false;
    session.checked[index] = false;
    if (question && question.q) session.seen.add(question.q);
  }

  // 20 slots in a timed test, the fixed list for a retry, unlimited in practice.
  const slotCount = () => session.planned || session.questions.length;
  const isPlanned = () => session.mode === 'test' || session.fixed;

  // In a timed test the difficulty of each new slot follows the accuracy of the
  // answers given so far, starting from the level saved for this subject.
  function levelForNextSlot() {
    const answered = session.questions
      .map((question, index) => (question ? session.answers[index] : null))
      .filter((answer) => answer !== null && answer !== undefined);
    if (answered.length < 3) return session.level;
    const right = session.questions.reduce((sum, question, index) => {
      const answer = session.answers[index];
      const gave = question && answer !== null && answer !== undefined;
      return sum + (gave && answer === question.answer ? 1 : 0);
    }, 0);
    const accuracy = right / answered.length;
    if (accuracy >= 0.75) return shiftLevel(session.level, 1);
    if (accuracy <= 0.4) return shiftLevel(session.level, -1);
    return session.level;
  }

  // Builds only the slot that was asked for, so a timed test can be generated
  // one question at a time and the paper still follows the running accuracy.
  function ensureQuestion(index) {
    if (session.questions[index]) return true;
    const count = session.questions.filter(Boolean).length;
    if (!isPlanned()) {
      if (index !== count) return false;
    } else if (index < 0 || index >= session.planned) {
      return false;
    }
    if (session.mode === 'test' && !session.fixed && count > 0) {
      session.level = levelForNextSlot();
    }
    const question = makeQuestion(session.level);
    if (!question) return false;
    placeQuestion(index, question);
    return true;
  }

  // Practice mode: a four-answer rolling window moves the level up or down, so
  // the quiz gets harder while you are doing well and easier when you struggle.
  function adaptAfterAnswer(question, answer) {
    if (session.mode !== 'practice' || session.fixed) return;
    session.recent.push(answer === question.answer ? 1 : 0);
    session.recent = session.recent.slice(-4);
    const recent = session.recent;
    if (recent.length < 2) return;
    const accuracy = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const before = session.level;
    if (accuracy >= 0.75) session.level = shiftLevel(session.level, 1);
    else if (accuracy <= 0.4) session.level = shiftLevel(session.level, -1);
    if (session.level !== before) toast('Difficulty is now ' + LEVEL_TITLE[session.level] + '.');
  }

  function startQuiz(subjectKey, fixedQuestions) {
    const subject = BANK[subjectKey];
    if (!subject) return;
    const mode = chosenMode();
    const level = startLevelFor(subjectKey);
    session = {
      subject: subjectKey,
      name: subject.name,
      mode,
      fixed: Boolean(fixedQuestions),
      planned: fixedQuestions ? fixedQuestions.length : mode === 'test' ? TEST_LENGTH : null,
      questions: [],
      answers: [],
      marked: [],
      checked: [],
      seen: new Set(),
      recent: [],
      level,
      startLevel: level,
      index: 0,
      startedAt: Date.now(),
      secondsLeft: TEST_SECONDS,
      timerId: null,
      submitted: false,
      ranOut: false,
    };
    if (fixedQuestions) fixedQuestions.forEach((question) => pushQuestion(question));
    else ensureQuestion(0);

    byId('quiz-title').textContent = session.name + (fixedQuestions ? ' · retry' : '');
    byId('quiz-mode').textContent =
      session.mode === 'test' ? 'Timed test · adaptive' : 'Practice · endless';
    byId('quiz-level').textContent = 'Level: ' + LEVEL_TITLE[session.level];
    byId('quiz-level').dataset.level = session.level;
    byId('quiz-timer').hidden = session.mode !== 'test';
    byId('check').hidden = session.mode === 'test';
    byId('submit').textContent = session.mode === 'test' ? 'Submit test' : 'Finish & see score';
    $('.progress').hidden = session.mode !== 'test';
    byId('next').textContent = session.mode === 'test' ? 'Next' : 'Next question';
    const side = byId('side-card');
    if (side) side.hidden = session.mode !== 'test';
    buildGrid();
    renderQuestion();
    startTimer();
    go('#quiz');
  }

  function buildGrid() {
    const grid = byId('grid');
    grid.replaceChildren();
    for (let index = 0; index < slotCount(); index += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(index + 1);
      button.dataset.index = String(index);
      button.setAttribute('aria-label', 'Question ' + (index + 1));
      button.addEventListener('click', () => {
        session.index = index;
        renderQuestion();
      });
      grid.append(button);
    }
  }

  function paintGrid() {
    $$('#grid button').forEach((button, index) => {
      const answered = session.answers[index] !== null && session.answers[index] !== undefined;
      const marked = Boolean(session.marked[index]);
      let value = 'idle';
      if (index === session.index) value = 'current';
      else if (answered) value = 'answered';
      button.dataset.state = value;
      if (marked) button.dataset.state = value === 'current' ? 'current' : 'answered';
      button.style.setProperty('--marked', marked ? '1' : '0');
      const dot = button.querySelector('span');
      if (dot) dot.remove();
      if (marked) {
        const flag = document.createElement('span');
        flag.textContent = '•';
        flag.style.cssText =
          'position:absolute;top:1px;right:4px;font-size:14px;line-height:1;color:#e08a00';
        button.append(flag);
      }
      button.setAttribute(
        'aria-label',
        'Question ' + (index + 1) + (marked ? ', marked' : '') + (answered ? ', answered' : ''),
      );
    });
    const answered = session.answers.filter(
      (value) => value !== null && value !== undefined,
    ).length;
    const marked = session.marked.filter(Boolean).length;
    byId('side-answered').textContent = 'Answered ' + answered + ' of ' + slotCount();
    byId('side-marked').textContent = 'Marked ' + marked;
  }

  function renderQuestion() {
    if (!session) return;
    const index = session.index;
    ensureQuestion(index);
    const question = session.questions[index];
    if (!question) {
      toast('No more questions for this subject.');
      return;
    }
    const checked = session.checked[index];
    const planned = isPlanned();
    const level = question.level || session.level;

    byId('q-topic').textContent =
      (planned ? 'Question ' + (index + 1) + ' of ' + slotCount() : 'Question ' + (index + 1)) +
      ' · ' +
      question.topic +
      ' · ' +
      LEVEL_TITLE[level];
    byId('q-text').textContent = question.q;
    byId('quiz-position').textContent = planned
      ? 'Question ' + (index + 1) + ' of ' + slotCount()
      : 'Question ' + (index + 1) + ' · adaptive';
    const chipLevel = session.mode === 'test' ? level : session.level;
    byId('quiz-level').textContent = 'Level: ' + LEVEL_TITLE[chipLevel];
    byId('quiz-level').dataset.level = chipLevel;
    if (planned) {
      byId('quiz-progress').style.width =
        ((index + (session.answers[index] !== null ? 1 : 0)) / slotCount()) * 100 + '%';
    }

    const options = byId('options');
    options.replaceChildren();
    question.options.forEach((text, optionIndex) => {
      const label = document.createElement('label');
      label.className = 'opt';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'answer';
      input.value = String(optionIndex);
      input.checked = session.answers[index] === optionIndex;
      input.disabled = checked;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = LETTER[optionIndex];
      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.textContent = text;
      label.append(input, key, txt);

      if (checked) {
        label.dataset.disabled = 'true';
        if (optionIndex === question.answer) label.classList.add('correct');
        else if (optionIndex === session.answers[index]) label.classList.add('wrong');
      }
      input.addEventListener('change', () => {
        session.answers[index] = optionIndex;
        paintGrid();
        if (planned) {
          byId('quiz-progress').style.width = ((index + 1) / slotCount()) * 100 + '%';
        }
      });
      options.append(label);
    });

    const feedback = byId('feedback');
    if (checked) {
      const right = session.answers[index] === question.answer;
      feedback.className = 'feedback on ' + (right ? 'good' : 'bad');
      feedback.replaceChildren();
      const head = document.createElement('b');
      head.textContent = right
        ? 'Correct.'
        : 'Not quite — the answer is ' +
          LETTER[question.answer] +
          '. ' +
          question.options[question.answer];
      const why = document.createElement('span');
      why.className = 'why';
      why.textContent = question.why;
      feedback.append(head, why);
    } else {
      feedback.className = 'feedback';
      feedback.replaceChildren();
    }

    byId('prev').disabled = index === 0;
    byId('next').disabled = false;
    byId('check').hidden = session.mode === 'test' || checked;
    const last = planned && index === slotCount() - 1;
    byId('next').hidden = Boolean(last);
    byId('submit').hidden = planned ? !(session.mode === 'test' || last) : false;
    byId('mark').textContent = session.marked[index] ? 'Unmark' : 'Mark';
    pendingSubmit = 0;
    byId('submit-note').hidden = true;
    paintGrid();
  }

  function move(delta) {
    const next = session.index + delta;
    if (next < 0 || next >= slotCount()) return;
    session.index = next;
    renderQuestion();
  }

  // Practice is endless: stepping past the newest question adds a fresh one at
  // the current difficulty, so the quiz never runs out of questions.
  function goNext() {
    if (!session) return;
    if (!isPlanned() && session.index === session.questions.length - 1) {
      if (session.answers[session.index] === null) {
        toast('Answer this question first, or press Finish to stop.');
        return;
      }
      ensureQuestion(session.questions.length);
      session.index += 1;
      renderQuestion();
      return;
    }
    move(1);
  }

  function checkAnswer() {
    const index = session.index;
    const question = session.questions[index];
    if (!question) return;
    if (session.answers[index] === null) {
      toast('Pick an option first.');
      return;
    }
    if (session.checked[index]) return;
    session.checked[index] = true;
    adaptAfterAnswer(question, session.answers[index]);
    renderQuestion();
  }

  /* ------------------------------------------------------------------- timer */
  function paintTimer() {
    const el = byId('quiz-timer');
    el.hidden = session.mode !== 'test';
    if (session.mode !== 'test') return;
    el.textContent = clock(session.secondsLeft);
    el.classList.toggle('low', session.secondsLeft <= 60);
  }
  function startTimer() {
    stopTimer();
    paintTimer();
    if (session.mode !== 'test') return;
    session.timerId = setInterval(() => {
      session.secondsLeft -= 1;
      if (session.secondsLeft <= 0) {
        session.secondsLeft = 0;
        session.ranOut = true;
        stopTimer();
        finish();
        return;
      }
      paintTimer();
    }, 1000);
  }
  function stopTimer() {
    if (session?.timerId) clearInterval(session.timerId);
    if (session) session.timerId = null;
  }

  /* ----------------------------------------------------------------- results */
  function finish() {
    if (!session || session.submitted) return;
    stopTimer();
    session.submitted = true;
    // Fill a timed test's empty slots so every planned question has text in the review.
    if (session.planned) {
      for (let index = 0; index < session.planned; index += 1) {
        if (!session.questions[index]) ensureQuestion(index);
      }
    }
    const total = session.questions.length;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    session.questions.forEach((question, index) => {
      const answer = session.answers[index];
      if (answer === null || answer === undefined) skipped += 1;
      else if (answer === question.answer) correct += 1;
      else wrong += 1;
    });
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const seconds =
      session.mode === 'test'
        ? TEST_SECONDS - session.secondsLeft
        : Math.round((Date.now() - session.startedAt) / 1000);
    session.result = { total, correct, wrong, skipped, percent, seconds };

    store.attempts.unshift({
      id: Date.now(),
      subject: session.subject,
      name: session.name,
      mode: session.mode,
      level: session.level,
      startLevel: session.startLevel,
      total,
      correct,
      wrong,
      skipped,
      percent,
      seconds,
      at: new Date().toISOString(),
    });
    store.attempts = store.attempts.slice(0, HISTORY_LIMIT);
    store.levels[session.subject] = session.level;
    saveStore();
    renderSubjects();
    paintResult();
    go('#result');
  }

  function paintResult() {
    const { total, correct, wrong, skipped, percent, seconds } = session.result;
    byId('score-pct').textContent = percent + '%';
    byId('ring').style.setProperty('--pct', String(percent));
    byId('ring').setAttribute('aria-label', percent + ' percent score');
    byId('result-h').textContent = session.name + ' — ' + correct + ' of ' + total + ' correct';
    const difficulty =
      session.level === session.startLevel
        ? 'Difficulty: ' + LEVEL_TITLE[session.level]
        : 'Difficulty: ' + LEVEL_TITLE[session.startLevel] + ' → ' + LEVEL_TITLE[session.level];
    const bits = [
      session.mode === 'test' ? 'Timed test' : 'Adaptive practice',
      difficulty,
      session.ranOut ? 'time ran out' : null,
      percent >= 80 ? 'strong result' : percent >= 50 ? 'solid effort' : 'worth another try',
    ].filter(Boolean);
    byId('result-sub').textContent = bits.join(' · ');
    byId('stat-correct').textContent = String(correct);
    byId('stat-wrong').textContent = String(wrong);
    byId('stat-skipped').textContent = String(skipped);
    byId('stat-time').textContent = clock(seconds);
    byId('retry-wrong').hidden = wrong === 0;
    byId('retry-wrong').dataset.count = String(wrong);

    paintReview('all');
    $$('.filter').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === 'all'));
      if (button.dataset.filter === 'wrong') button.textContent = 'Wrong ' + wrong;
      if (button.dataset.filter === 'skipped') button.textContent = 'Skipped ' + skipped;
      if (button.dataset.filter === 'all') button.textContent = 'All ' + total;
    });
  }

  function paintReview(filter) {
    const holder = byId('review');
    holder.replaceChildren();
    let shown = 0;
    session.questions.forEach((question, index) => {
      const answer = session.answers[index];
      const state = answer === null ? 'skipped' : answer === question.answer ? 'right' : 'wrong';
      if (filter === 'wrong' && state !== 'wrong') return;
      if (filter === 'skipped' && state !== 'skipped') return;
      shown += 1;

      const item = document.createElement('article');
      item.className =
        'review-item ' + (state === 'right' ? 'good' : state === 'wrong' ? 'bad' : 'skip');

      const tag = document.createElement('span');
      tag.className = 'tag ' + (state === 'right' ? 'ok' : state === 'wrong' ? 'no' : 'miss');
      tag.textContent = state === 'right' ? 'Correct' : state === 'wrong' ? 'Wrong' : 'Skipped';

      const levelTag = document.createElement('span');
      levelTag.className = 'tag lvl';
      levelTag.dataset.level = question.level || 'medium';
      levelTag.textContent = LEVEL_TITLE[question.level] || LEVEL_TITLE.medium;

      const q = document.createElement('p');
      q.className = 'q';
      q.textContent = index + 1 + '. ' + question.q;

      const yours = document.createElement('p');
      yours.className = 'ans';
      yours.textContent =
        'Your answer: ' +
        (answer === null ? 'not answered' : LETTER[answer] + '. ' + question.options[answer]);

      const right = document.createElement('p');
      right.className = 'ans';
      right.innerHTML = '';
      const strong = document.createElement('b');
      strong.textContent = 'Answer: ' + LETTER[question.answer] + '. ';
      right.append(strong, document.createTextNode(question.options[question.answer]));

      const why = document.createElement('p');
      why.className = 'why';
      why.textContent = question.why;

      item.append(tag, levelTag, q, yours, right, why);
      holder.append(item);
    });
    if (!shown) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Nothing here — try a different filter.';
      holder.append(empty);
    }
  }

  /* ----------------------------------------------------------------- history */
  function renderHistory() {
    const card = byId('history-card');
    card.replaceChildren();
    if (!store.attempts.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent =
        'No attempts yet. Pick a subject and finish a quiz — results show up here.';
      card.append(empty);
      return;
    }
    const table = document.createElement('table');
    table.className = 'history-table';
    const head = document.createElement('thead');
    head.innerHTML =
      '<tr><th scope="col">When</th><th scope="col">Subject</th><th scope="col">Mode</th><th scope="col">Level</th><th scope="col">Score</th></tr>';
    const body = document.createElement('tbody');
    store.attempts.forEach((attempt) => {
      const row = document.createElement('tr');
      const when = document.createElement('td');
      when.textContent = new Date(attempt.at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      const subject = document.createElement('td');
      subject.textContent = attempt.name;
      const mode = document.createElement('td');
      mode.textContent = attempt.mode === 'test' ? 'Timed' : 'Adaptive';
      const levelCell = document.createElement('td');
      const levelName = LEVEL_TITLE[attempt.level] || '—';
      levelCell.textContent =
        attempt.startLevel && attempt.startLevel !== attempt.level
          ? LEVEL_TITLE[attempt.startLevel] + ' → ' + levelName
          : levelName;
      const score = document.createElement('td');
      score.className = 'score';
      score.textContent = attempt.correct + '/' + attempt.total + ' · ' + attempt.percent + '%';
      row.append(when, subject, mode, levelCell, score);
      body.append(row);
    });
    table.append(head, body);
    card.append(table);
  }

  /* ---------------------------------------------------------------- listeners */
  byId('prev').addEventListener('click', () => move(-1));
  byId('next').addEventListener('click', goNext);
  byId('check').addEventListener('click', checkAnswer);
  byId('mark').addEventListener('click', () => {
    if (!session || !session.questions[session.index]) return;
    session.marked[session.index] = !session.marked[session.index];
    renderQuestion();
  });
  byId('quit').addEventListener('click', () => {
    if (session && !session.submitted && session.answers.some((answer) => answer !== null)) {
      if (!confirm('Leave this quiz? Your answers will not be saved.')) return;
    }
    stopTimer();
    session = null;
    go('#home');
  });
  byId('submit').addEventListener('click', () => {
    if (session.mode === 'test') {
      const unanswered = session.answers.filter((answer) => answer === null).length;
      if (unanswered && !pendingSubmit) {
        pendingSubmit = Date.now();
        const note = byId('submit-note');
        note.hidden = false;
        note.textContent =
          unanswered +
          ' question' +
          (unanswered === 1 ? '' : 's') +
          ' unanswered. Tap “Submit test” again to finish.';
        setTimeout(() => {
          if (Date.now() - pendingSubmit > 5000) {
            pendingSubmit = 0;
            note.hidden = true;
          }
        }, 5200);
        return;
      }
    }
    finish();
  });
  byId('again').addEventListener('click', () => startQuiz(session.subject));
  byId('retry-wrong').addEventListener('click', () => {
    const wrong = session.questions.filter((question, index) => {
      const answer = session.answers[index];
      return answer !== null && answer !== question.answer;
    });
    if (!wrong.length) return toast('No wrong answers to retry.');
    startQuiz(session.subject, wrong);
  });
  byId('print').addEventListener('click', () => window.print());
  byId('share').addEventListener('click', async () => {
    const { correct, total, percent } = session.result;
    const text =
      'I scored ' +
      correct +
      '/' +
      total +
      ' (' +
      percent +
      '%) in ' +
      session.name +
      ' on the ToolKit Quiz — ' +
      location.origin +
      location.pathname;
    try {
      await navigator.clipboard.writeText(text);
      toast('Result copied — paste it anywhere.');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      try {
        document.execCommand('copy');
        toast('Result copied — paste it anywhere.');
      } catch {
        toast(text);
      }
      area.remove();
    }
  });
  byId('home-btn').addEventListener('click', () => {
    session = null;
  });
  byId('history-link').addEventListener('click', () => {
    renderHistory();
  });
  byId('clear-history').addEventListener('click', (event) => {
    const button = event.currentTarget;
    if (button.dataset.armed !== '1') {
      button.dataset.armed = '1';
      button.textContent = 'Tap again to clear';
      setTimeout(() => {
        button.dataset.armed = '';
        button.textContent = 'Clear history';
      }, 4000);
      return;
    }
    store.attempts = [];
    saveStore();
    renderSubjects();
    renderHistory();
    button.dataset.armed = '';
    button.textContent = 'Clear history';
    toast('History cleared on this device.');
  });
  $$('.filter').forEach((button) =>
    button.addEventListener('click', () => {
      $$('.filter').forEach((other) => other.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      paintReview(button.dataset.filter);
    }),
  );
  document.addEventListener('keydown', (event) => {
    if (byId('quiz').hidden || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (/^[1-4]$/.test(event.key) && session) {
      const option = Number(event.key) - 1;
      const question = session.questions[session.index];
      if (question && option < question.options.length && !session.checked[session.index]) {
        session.answers[session.index] = option;
        renderQuestion();
      }
    }
    if (event.key === 'ArrowRight') goNext();
    if (event.key === 'ArrowLeft') move(-1);
  });
  window.addEventListener('hashchange', route);

  /* -------------------------------------------------------------------- boot */
  renderSubjects();
  route();
})();
