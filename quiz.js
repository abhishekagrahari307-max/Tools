// ToolKit Quiz engine — all local, no network calls. The question bank lives in
// quiz-data.js (window.QUIZ_BANK); attempts are kept in localStorage only.

(() => {
  const BANK = window.QUIZ_BANK;
  const STORE_KEY = 'toolkit-quiz-v1';
  const HISTORY_LIMIT = 30;
  const TEST_SECONDS = 15 * 60;

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
      if (parsed && Array.isArray(parsed.attempts)) return parsed;
    } catch {
      /* private mode or corrupted value — start fresh */
    }
    return { attempts: [] };
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
      count.textContent = subject.questions.length + ' questions';
      meta.append(count);
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
  function startQuiz(subjectKey, questions) {
    const subject = BANK[subjectKey];
    if (!subject) return;
    session = {
      subject: subjectKey,
      name: subject.name,
      mode: chosenMode(),
      questions: questions || subject.questions,
      answers: [],
      marked: [],
      checked: [],
      index: 0,
      startedAt: Date.now(),
      secondsLeft: TEST_SECONDS,
      timerId: null,
      submitted: false,
      ranOut: false,
    };
    session.questions.forEach(() => {
      session.answers.push(null);
      session.marked.push(false);
      session.checked.push(false);
    });

    byId('quiz-title').textContent = session.name + (questions ? ' · retry' : '');
    byId('quiz-mode').textContent =
      session.mode === 'test' ? 'Timed test · 15 min' : 'Practice · explanations on';
    byId('quiz-timer').hidden = session.mode !== 'test';
    byId('check').hidden = session.mode === 'test';
    byId('submit').textContent = session.mode === 'test' ? 'Submit test' : 'Finish quiz';
    buildGrid();
    renderQuestion();
    startTimer();
    go('#quiz');
  }

  function buildGrid() {
    const grid = byId('grid');
    grid.replaceChildren();
    session.questions.forEach((_, index) => {
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
    });
  }

  function paintGrid() {
    $$('#grid button').forEach((button, index) => {
      const answered = session.answers[index] !== null;
      const marked = session.marked[index];
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
    const answered = session.answers.filter((value) => value !== null).length;
    const marked = session.marked.filter(Boolean).length;
    byId('side-answered').textContent = 'Answered ' + answered + ' of ' + session.questions.length;
    byId('side-marked').textContent = 'Marked ' + marked;
  }

  function renderQuestion() {
    if (!session) return;
    const index = session.index;
    const question = session.questions[index];
    const checked = session.checked[index];

    byId('q-topic').textContent =
      'Question ' + (index + 1) + ' of ' + session.questions.length + ' · ' + question.topic;
    byId('q-text').textContent = question.q;
    byId('quiz-position').textContent =
      'Question ' + (index + 1) + ' of ' + session.questions.length;
    byId('quiz-progress').style.width =
      ((index + (session.answers[index] !== null ? 1 : 0)) / session.questions.length) * 100 + '%';

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
        byId('quiz-progress').style.width = ((index + 1) / session.questions.length) * 100 + '%';
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
    byId('next').hidden = index === session.questions.length - 1;
    byId('submit').hidden = !(session.mode === 'test' || index === session.questions.length - 1);
    byId('mark').textContent = session.marked[index] ? 'Unmark' : 'Mark';
    pendingSubmit = 0;
    byId('submit-note').hidden = true;
    paintGrid();
  }

  function move(delta) {
    const next = session.index + delta;
    if (next < 0 || next >= session.questions.length) return;
    session.index = next;
    renderQuestion();
  }

  function checkAnswer() {
    const index = session.index;
    if (session.answers[index] === null) {
      toast('Pick an option first.');
      return;
    }
    session.checked[index] = true;
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
    const total = session.questions.length;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    session.questions.forEach((question, index) => {
      const answer = session.answers[index];
      if (answer === null) skipped += 1;
      else if (answer === question.answer) correct += 1;
      else wrong += 1;
    });
    const percent = Math.round((correct / total) * 100);
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
      total,
      correct,
      wrong,
      skipped,
      percent,
      seconds,
      at: new Date().toISOString(),
    });
    store.attempts = store.attempts.slice(0, HISTORY_LIMIT);
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
    const bits = [
      session.mode === 'test' ? 'Timed test' : 'Practice',
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

      item.append(tag, q, yours, right, why);
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
      '<tr><th scope="col">When</th><th scope="col">Subject</th><th scope="col">Mode</th><th scope="col">Score</th></tr>';
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
      mode.textContent = attempt.mode === 'test' ? 'Timed' : 'Practice';
      const score = document.createElement('td');
      score.className = 'score';
      score.textContent = attempt.correct + '/' + attempt.total + ' · ' + attempt.percent + '%';
      row.append(when, subject, mode, score);
      body.append(row);
    });
    table.append(head, body);
    card.append(table);
  }

  /* ---------------------------------------------------------------- listeners */
  byId('prev').addEventListener('click', () => move(-1));
  byId('next').addEventListener('click', () => move(1));
  byId('check').addEventListener('click', checkAnswer);
  byId('mark').addEventListener('click', () => {
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
      if (
        option < session.questions[session.index].options.length &&
        !session.checked[session.index]
      ) {
        session.answers[session.index] = option;
        renderQuestion();
      }
    }
    if (event.key === 'ArrowRight') move(1);
    if (event.key === 'ArrowLeft') move(-1);
  });
  window.addEventListener('hashchange', route);

  /* -------------------------------------------------------------------- boot */
  renderSubjects();
  route();
})();
