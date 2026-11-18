// Guards the quiz bank and page: six subjects, twenty four-option questions each,
// valid answer keys, unique wording, and no network dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const sandbox = {};
vm.runInNewContext(read('quiz-data.js'), { window: sandbox });
const BANK = sandbox.QUIZ_BANK;
const page = read('quiz.html');
const engine = read('quiz.js');
const redirect = read('web-quiz.html');

const EXPECTED = ['physics', 'chemistry', 'maths', 'biology', 'gk', 'computer'];

test('the bank has the six promised subjects with twenty questions each', () => {
  assert.deepEqual(Object.keys(BANK), EXPECTED);
  EXPECTED.forEach((key) => {
    assert.equal(BANK[key].questions.length, 20, key + ' should have 20 questions');
    assert.ok(BANK[key].name && BANK[key].tagline, key + ' needs a name and tagline');
  });
  const total = EXPECTED.reduce((sum, key) => sum + BANK[key].questions.length, 0);
  assert.equal(total, 120);
});

test('every question is well formed', () => {
  const seen = new Set();
  EXPECTED.forEach((key) => {
    BANK[key].questions.forEach((question, index) => {
      const where = key + ' #' + (index + 1);
      assert.equal(typeof question.q, 'string', where + ' needs a question');
      assert.ok(question.q.trim().length > 8, where + ' question is too short');
      assert.ok(!seen.has(question.q), where + ' repeats another question');
      seen.add(question.q);
      assert.equal(question.options.length, 4, where + ' needs exactly four options');
      question.options.forEach((option) =>
        assert.ok(
          typeof option === 'string' && option.trim().length > 0,
          where + ' has an empty option',
        ),
      );
      assert.equal(new Set(question.options).size, 4, where + ' has duplicate options');
      assert.ok(Number.isInteger(question.answer), where + ' answer must be an integer');
      assert.ok(question.answer >= 0 && question.answer <= 3, where + ' answer must be 0-3');
      assert.ok(question.why && question.why.length > 15, where + ' needs an explanation');
      assert.ok(question.topic, where + ' needs a topic');
      assert.ok(['easy', 'medium', 'hard'].includes(question.level), where + ' needs a level');
    });
  });
});

test('answer keys are spread across all four positions', () => {
  const counts = [0, 0, 0, 0];
  EXPECTED.forEach((key) =>
    BANK[key].questions.forEach((question) => {
      counts[question.answer] += 1;
    }),
  );
  counts.forEach((count, position) => {
    assert.ok(count > 10, 'answer ' + position + ' is used only ' + count + ' times');
  });
});

test('the page loads the bank and engine locally', () => {
  assert.match(page, /<script src="\.\/quiz-data\.js"><\/script>/);
  assert.match(page, /<script src="\.\/quiz\.js"><\/script>/);
  assert.doesNotMatch(page, /<script[^>]+src="https?:/);
  assert.doesNotMatch(page, /<link[^>]+href="https?:/);
  assert.doesNotMatch(page, /font-awesome|cdnjs|jsdelivr|googleapis/);
  assert.match(page, /<title>[^<]*Quiz/i);
  assert.match(page, /name="description"/);
});

test('the engine keeps data local and handles every promised mode', () => {
  assert.doesNotMatch(engine, /fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(engine, /localStorage/);
  assert.match(engine, /PRACTICE|practice/);
  assert.match(engine, /timed test|Timed test/i);
  assert.match(engine, /retry/i);
  assert.match(engine, /15 \* 60/);
});

test('the old quiz page redirects to the new one', () => {
  assert.match(redirect, /url=\.\/quiz\.html/);
  assert.match(redirect, /location\.replace\('\.\/quiz\.html'/);
  assert.match(redirect, /noindex/);
});

test('the quiz is linked from the homepage and the tools page', () => {
  const home = read('index.html');
  const tools = read('file-tools.html');
  assert.match(home, /href="\.\/quiz\.html"/);
  assert.match(home, /ToolKit Quiz/);
  assert.match(tools, /href="\.\/quiz\.html"/);
});

/* ------------------------------------------------------------------ generator */
const genSandbox = {};
vm.runInNewContext(read('quiz-gen.js'), { window: genSandbox, Math });
const GEN = genSandbox.QUIZ_GEN;

test('the page loads the generator before the engine', () => {
  assert.match(page, /<script src="\.\/quiz-gen\.js"><\/script>/);
  assert.ok(
    page.indexOf('quiz-gen.js') < page.indexOf('quiz.js'),
    'quiz-gen.js must load before quiz.js',
  );
});

test('the generator covers all six subjects and all three levels', () => {
  assert.deepEqual([...GEN.subjects].sort(), [...EXPECTED].sort());
  assert.deepEqual([...GEN.LEVELS], ['easy', 'medium', 'hard']);
});

test('generated questions are complete, solvable and explained', () => {
  EXPECTED.forEach((subject) => {
    GEN.LEVELS.forEach((level) => {
      for (let i = 0; i < 40; i += 1) {
        const question = GEN.generate(subject, level);
        const where = subject + '/' + level + ' #' + i;
        assert.ok(question, where + ' produced nothing');
        assert.equal(typeof question.q, 'string', where + ' needs a question');
        assert.ok(question.q.trim().length > 8, where + ' question is too short: ' + question.q);
        assert.equal(question.options.length, 4, where + ' needs four options');
        question.options.forEach((option) =>
          assert.ok(String(option).trim().length > 0, where + ' has an empty option'),
        );
        assert.equal(new Set(question.options.map(String)).size, 4, where + ' options repeat');
        assert.ok(Number.isInteger(question.answer), where + ' answer must be an index');
        assert.ok(question.answer >= 0 && question.answer < 4, where + ' answer out of range');
        assert.equal(typeof question.options[question.answer], 'string', where + ' key misses');
        assert.ok(question.why && question.why.length > 8, where + ' needs an explanation');
        assert.ok(question.topic, where + ' needs a topic');
        assert.ok(GEN.LEVELS.includes(question.level), where + ' has a bad level');
        assert.equal(question.source, 'generated', where + ' should be marked generated');
        assert.doesNotMatch(
          question.q + ' ' + question.why + ' ' + question.options.join(' '),
          /\{[a-z]+\}|undefined|NaN/,
          where + ' left a template placeholder: ' + question.q,
        );
      }
    });
  });
});

test('the generator has depth: far more than a paper of unique questions per level', () => {
  EXPECTED.forEach((subject) => {
    GEN.LEVELS.forEach((level) => {
      const seen = new Set();
      for (let i = 0; i < 1200; i += 1) {
        const question = GEN.generate(subject, level);
        if (question) seen.add(question.q);
      }
      assert.ok(
        seen.size >= 25,
        subject + '/' + level + ' only produced ' + seen.size + ' distinct questions',
      );
    });
  });
});

test('the engine adapts difficulty using the generator', () => {
  assert.match(engine, /QUIZ_GEN/);
  assert.match(engine, /LEVELS = \['easy', 'medium', 'hard'\]/);
  assert.match(engine, /function adaptAfterAnswer/);
  assert.match(engine, /function levelForNextSlot/);
  assert.match(engine, /store\.levels/);
  assert.match(page, /id="quiz-level"/);
});
