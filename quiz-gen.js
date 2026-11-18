// Question generators for the ToolKit Quiz. Every generator returns a fresh
// question in the same shape as quiz-data.js:
//   { q, options[4], answer (0-3), why, topic, level, source: 'generated' }
//
// Numbers are calculated at run time, so the maths and physics pools never run
// out. Fact-based subjects use curated tables and are asked in both directions,
// so each fact yields at least two different questions.
window.QUIZ_GEN = (() => {
  'use strict';

  const LEVELS = ['easy', 'medium', 'hard'];
  const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const pick = (list) => list[randInt(0, list.length - 1)];
  const round2 = (value) => Math.round(value * 100) / 100;
  const unique = (list) => list.filter((value, index) => list.indexOf(value) === index);

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = randInt(0, i);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function question(q, correct, wrong, meta) {
    const options = unique([correct, ...wrong]).slice(0, 4);
    if (options.length < 4) return null;
    shuffle(options);
    const answer = options.indexOf(correct);
    if (answer === -1) return null;
    return {
      q,
      options,
      answer,
      why: meta.why,
      topic: meta.topic,
      level: meta.level,
      source: 'generated',
    };
  }
  const q = question;

  // Believable numeric distractors, always rounded and never negative.
  function wrongNumbers(value, spread) {
    const v = round2(value);
    const isInt = Number.isInteger(v);
    const factor = spread || 1;
    const rawStep = Math.max(isInt ? 1 : 0.25, Math.abs(v) * 0.1) * factor;
    const step = isInt ? Math.max(1, Math.round(rawStep)) : round2(rawStep);
    const out = [];
    const add = (number) => {
      const r = round2(number);
      if (!Number.isFinite(r) || r < 0 || r === v || out.includes(r)) return;
      if (isInt && !Number.isInteger(r)) return;
      out.push(r);
    };
    [v + step, v - step, v + 2 * step, v - 2 * step, v * 2, v / 2].forEach(add);
    let k = 1;
    while (out.length < 3 && k <= 80) {
      add(v + k * step);
      add(v - k * step);
      k += 1;
    }
    return out.slice(0, 3).map(String);
  }

  function numeric(text, value, why, meta, spread) {
    const clean = round2(value);
    const wrong = wrongNumbers(clean, spread);
    if (wrong.length < 3) return null;
    return question(text, String(clean), wrong, { why, topic: meta.topic, level: meta.level });
  }

  // ------------------------------------------------------------- fact helpers
  const fill = (template, left, right) =>
    template.replace(/\{left\}/g, left).replace(/\{right\}/g, right);

  // A table of [thing, value] pairs, asked in both directions.
  // meta.flip means the "prompt" template asks with {right} and answers {left}.
  function table(table, meta) {
    const [left, right] = pick(table);
    const flip = Boolean(meta.flip);
    const reversed = Math.random() < 0.5;
    const answerIsLeft = flip ? !reversed : reversed;
    const answerValue = String(answerIsLeft ? left : right);
    const pool = unique(table.map((pair) => String(pair[answerIsLeft ? 0 : 1]))).filter(
      (value) => value !== answerValue,
    );
    if (pool.length < 3) return null;
    const text = fill(reversed ? meta.reverse : meta.prompt, left, right);
    return q(text, answerValue, shuffle(pool).slice(0, 3), {
      why: fill(meta.why, left, right),
      topic: meta.topic,
      level: meta.level,
    });
  }

  // A list of [question, answer] pairs with distractors from the same list.
  function facts(list, meta) {
    const row = pick(list);
    const [text, answer] = row;
    const fixed = Array.isArray(row[2]) ? row[2] : null;
    const pool = fixed || unique(list.map((pair) => pair[1]).filter((value) => value !== answer));
    if (pool.length < 3) return null;
    return q(text, answer, shuffle(pool.slice()).slice(0, 3), meta);
  }

  /* ------------------------------------------------------------- physics */
  const physics = {
    easy: [
      () => {
        const m = randInt(2, 40);
        return numeric(
          'What is the weight of a ' + m + ' kg object? (take g = 10 m/s²)',
          m * 10,
          'Weight = mass × g = ' + m + ' × 10 = ' + m * 10 + ' N.',
          { topic: 'Gravitation', level: 'easy' },
        );
      },
      () => {
        const time = randInt(2, 10);
        const speed = randInt(3, 20);
        return numeric(
          'A cyclist moves at ' + speed + ' m/s for ' + time + ' s. What distance is covered?',
          speed * time,
          'Distance = speed × time = ' + speed + ' × ' + time + ' = ' + speed * time + ' m.',
          { topic: 'Motion', level: 'easy' },
        );
      },
      () => {
        const power = randInt(2, 20) * 50;
        const hours = randInt(2, 6);
        return numeric(
          'A ' + power + ' W bulb runs for ' + hours + ' hours. How much energy does it use?',
          (power * hours) / 1000,
          'Energy = power × time = ' +
            power +
            ' W × ' +
            hours +
            ' h = ' +
            round2((power * hours) / 1000) +
            ' kWh.',
          { topic: 'Energy', level: 'easy' },
        );
      },
      () => {
        const m = randInt(2, 20);
        const a = randInt(2, 9);
        return numeric(
          'What force gives a ' + m + ' kg body an acceleration of ' + a + ' m/s²?',
          m * a,
          'F = m × a = ' + m + ' × ' + a + ' = ' + m * a + ' N.',
          { topic: 'Force', level: 'easy' },
        );
      },
      () => {
        const area = randInt(2, 10);
        const pressure = randInt(2, 20) * 5;
        return numeric(
          'A force of ' + area * pressure + ' N acts on ' + area + ' m². What is the pressure?',
          pressure,
          'Pressure = force ÷ area = ' + area * pressure + ' ÷ ' + area + ' = ' + pressure + ' Pa.',
          { topic: 'Pressure', level: 'easy' },
        );
      },
    ],
    medium: [
      () => {
        const force = randInt(5, 40);
        const distance = randInt(2, 9);
        return numeric(
          'A force of ' + force + ' N moves a box ' + distance + ' m in its direction. Work done?',
          force * distance,
          'Work = force × distance = ' +
            force +
            ' × ' +
            distance +
            ' = ' +
            force * distance +
            ' J.',
          { topic: 'Work', level: 'medium' },
        );
      },
      () => {
        const time = randInt(2, 10);
        const power = randInt(10, 90);
        return numeric(
          'A machine does ' + time * power + ' J of work in ' + time + ' s. What is its power?',
          power,
          'Power = work ÷ time = ' + time * power + ' ÷ ' + time + ' = ' + power + ' W.',
          { topic: 'Power', level: 'medium' },
        );
      },
      () => {
        const volume = pick([100, 200, 250, 500]);
        const mass = volume * randInt(1, 8);
        return numeric(
          'A block of mass ' + mass + ' g has volume ' + volume + ' cm³. What is its density?',
          mass / volume,
          'Density = mass ÷ volume = ' +
            mass +
            ' ÷ ' +
            volume +
            ' = ' +
            round2(mass / volume) +
            ' g/cm³.',
          { topic: 'Density', level: 'medium' },
        );
      },
      () => {
        const current = randInt(1, 9);
        const resistance = randInt(2, 20);
        return numeric(
          'A current of ' + current + ' A flows through ' + resistance + ' Ω. What is the voltage?',
          current * resistance,
          'V = I × R = ' + current + ' × ' + resistance + ' = ' + current * resistance + ' V.',
          { topic: 'Electricity', level: 'medium' },
        );
      },
      () => {
        const time = randInt(2, 8);
        const speed = randInt(5, 25);
        return numeric(
          'A bus covers ' + speed * time + ' km in ' + time + ' hours. What is its average speed?',
          speed,
          'Average speed = distance ÷ time = ' +
            speed * time +
            ' ÷ ' +
            time +
            ' = ' +
            speed +
            ' km/h.',
          { topic: 'Motion', level: 'medium' },
        );
      },
      () => {
        const m = randInt(2, 10) * 2;
        const v = randInt(2, 10);
        return numeric(
          'What is the kinetic energy of a ' + m + ' kg body moving at ' + v + ' m/s?',
          0.5 * m * v * v,
          'KE = ½mv² = ½ × ' + m + ' × ' + v + '² = ' + 0.5 * m * v * v + ' J.',
          { topic: 'Energy', level: 'medium' },
        );
      },
    ],
    hard: [
      () => {
        const m = randInt(2, 20);
        const v = randInt(2, 12);
        return numeric(
          'What is the momentum of a ' + m + ' kg body moving at ' + v + ' m/s?',
          m * v,
          'Momentum = mass × velocity = ' + m + ' × ' + v + ' = ' + m * v + ' kg·m/s.',
          { topic: 'Momentum', level: 'hard' },
        );
      },
      () => {
        const u = randInt(1, 15);
        const a = randInt(1, 9);
        const t = randInt(2, 9);
        return numeric(
          'A body starts at ' +
            u +
            ' m/s and accelerates at ' +
            a +
            ' m/s² for ' +
            t +
            ' s. Final velocity?',
          u + a * t,
          'v = u + at = ' + u + ' + ' + a + ' × ' + t + ' = ' + (u + a * t) + ' m/s.',
          { topic: 'Motion', level: 'hard' },
        );
      },
      () => {
        const u = randInt(2, 10) * 2;
        const a = randInt(1, 3) * 2;
        const t = randInt(1, 5) * 2;
        const s = u * t + 0.5 * a * t * t;
        return numeric(
          'A body starts at ' +
            u +
            ' m/s with acceleration ' +
            a +
            ' m/s². How far does it travel in ' +
            t +
            ' s?',
          s,
          's = ut + ½at² = ' + u + '×' + t + ' + ½×' + a + '×' + t + '² = ' + s + ' m.',
          { topic: 'Motion', level: 'hard' },
        );
      },
      () => {
        const [r1, r2] = pick([
          [2, 2],
          [3, 6],
          [4, 4],
          [6, 12],
          [10, 10],
          [5, 20],
          [6, 3],
          [8, 8],
          [12, 4],
          [2, 6],
          [9, 18],
          [4, 12],
        ]);
        const rp = round2((r1 * r2) / (r1 + r2));
        return numeric(
          'Two resistors of ' +
            r1 +
            ' Ω and ' +
            r2 +
            ' Ω are joined in parallel. What is the equivalent resistance?',
          rp,
          '1/R = 1/' + r1 + ' + 1/' + r2 + ', so R = ' + rp + ' Ω.',
          { topic: 'Electricity', level: 'hard' },
        );
      },
      () => {
        const [r1, r2] = pick([
          [4, 6],
          [3, 9],
          [12, 8],
          [5, 15],
          [10, 20],
          [7, 3],
          [6, 14],
          [2, 18],
          [11, 9],
          [8, 22],
        ]);
        return numeric(
          'Resistors of ' +
            r1 +
            ' Ω and ' +
            r2 +
            ' Ω are joined in series. What is the total resistance?',
          r1 + r2,
          'In series R = R₁ + R₂ = ' + r1 + ' + ' + r2 + ' = ' + (r1 + r2) + ' Ω.',
          { topic: 'Electricity', level: 'hard' },
        );
      },
      () => {
        const v = randInt(2, 12) * 2;
        const i = randInt(2, 6);
        return numeric(
          'A ' + v + ' V supply drives ' + i + ' A. What power is delivered?',
          v * i,
          'P = V × I = ' + v + ' × ' + i + ' = ' + v * i + ' W.',
          { topic: 'Electricity', level: 'hard' },
        );
      },
      () => {
        const m = randInt(2, 8);
        const v = randInt(2, 10) * 2;
        return numeric(
          'Find the kinetic energy of a ' + m + ' kg object moving at ' + v + ' m/s.',
          0.5 * m * v * v,
          'KE = ½mv² = ½ × ' + m + ' × ' + v + '² = ' + 0.5 * m * v * v + ' J.',
          { topic: 'Energy', level: 'hard' },
        );
      },
    ],
  };

  /* --------------------------------------------------------------- maths */
  const maths = {
    easy: [
      () => {
        const percent = pick([5, 10, 20, 25, 40, 50, 60, 75]);
        const total = randInt(2, 20) * 20;
        return numeric(
          'What is ' + percent + '% of ' + total + '?',
          (total * percent) / 100,
          percent +
            '% of ' +
            total +
            ' is ' +
            total +
            ' × ' +
            percent +
            ' ÷ 100 = ' +
            (total * percent) / 100 +
            '.',
          { topic: 'Percentage', level: 'easy' },
        );
      },
      () => {
        const a = randInt(2, 15);
        const b = randInt(2, 15);
        return numeric(
          'What is the LCM of ' + a + ' and ' + b + '?',
          (a * b) / gcd(a, b),
          'The LCM is the smallest number both divide into — ' + (a * b) / gcd(a, b) + '.',
          { topic: 'Number theory', level: 'easy' },
        );
      },
      () => {
        const side = randInt(3, 20);
        return numeric(
          'What is the perimeter of a square of side ' + side + ' cm?',
          side * 4,
          'Perimeter = 4 × side = 4 × ' + side + ' = ' + side * 4 + ' cm.',
          { topic: 'Geometry', level: 'easy' },
        );
      },
      () => {
        const l = randInt(4, 18);
        const b = randInt(3, 15);
        return numeric(
          'What is the area of a rectangle ' + l + ' cm by ' + b + ' cm?',
          l * b,
          'Area = length × breadth = ' + l + ' × ' + b + ' = ' + l * b + ' cm².',
          { topic: 'Geometry', level: 'easy' },
        );
      },
      () => {
        const price = randInt(4, 30) * 10;
        const qty = randInt(2, 9);
        return numeric(
          'A pen costs ₹' + price + '. What do ' + qty + ' pens cost?',
          price * qty,
          price + ' × ' + qty + ' = ' + price * qty + ' rupees.',
          { topic: 'Everyday maths', level: 'easy' },
        );
      },
    ],
    medium: [
      () => {
        const a = randInt(12, 90);
        const b = randInt(12, 90);
        return numeric(
          'What is the HCF of ' + a + ' and ' + b + '?',
          gcd(a, b),
          'The HCF is the largest number that divides both ' +
            a +
            ' and ' +
            b +
            ' — ' +
            gcd(a, b) +
            '.',
          { topic: 'Number theory', level: 'medium' },
        );
      },
      () => {
        const time = randInt(2, 8);
        const speed = randInt(20, 60);
        return numeric(
          'A car travels at ' + speed + ' km/h for ' + time + ' hours. How far does it go?',
          speed * time,
          'Distance = speed × time = ' + speed + ' × ' + time + ' = ' + speed * time + ' km.',
          { topic: 'Speed', level: 'medium' },
        );
      },
      () => {
        const p = randInt(2, 20) * 500;
        const r = randInt(2, 12);
        const t = randInt(2, 6);
        return numeric(
          'Find the simple interest on ₹' + p + ' at ' + r + '% per year for ' + t + ' years.',
          (p * r * t) / 100,
          'SI = P×R×T ÷ 100 = ' + p + '×' + r + '×' + t + ' ÷ 100 = ' + (p * r * t) / 100 + '.',
          { topic: 'Interest', level: 'medium' },
        );
      },
      () => {
        const a = randInt(2, 9);
        const b = randInt(2, 9);
        const c = randInt(3, 40);
        const x = randInt(2, 12);
        return numeric(
          'If ' + a + 'x + ' + b + ' = ' + a * x + b + ', what is x?',
          x,
          'Subtract ' + b + ': ' + a + 'x = ' + a * x + '. Divide by ' + a + ': x = ' + x + '.',
          { topic: 'Algebra', level: 'medium' },
        );
      },
      () => {
        const mean = randInt(5, 40);
        return numeric(
          'What is the average of ' + [mean - 3, mean + 1, mean + 5, mean - 3].join(', ') + '?',
          mean,
          'The total is ' + mean * 4 + ' and there are 4 values, so the average is ' + mean + '.',
          { topic: 'Averages', level: 'medium' },
        );
      },
      () => {
        const a = randInt(2, 9);
        const b = randInt(2, 9);
        const k = randInt(2, 9);
        return numeric(
          'If ' + a + ' : ' + b + ' = ' + a * k + ' : x, what is x?',
          b * k,
          'The ratio is scaled by ' + k + ', so x = ' + b + ' × ' + k + ' = ' + b * k + '.',
          { topic: 'Ratio', level: 'medium' },
        );
      },
    ],
    hard: [
      () => {
        const p = randInt(2, 10) * 1000;
        const r = pick([5, 10, 20]);
        const t = randInt(2, 3);
        const amount = round2(p * Math.pow(1 + r / 100, t));
        return numeric(
          'Find the amount after ' +
            t +
            ' years on ₹' +
            p +
            ' at ' +
            r +
            '% per year compound interest.',
          amount,
          'A = P(1 + R/100)ᵗ = ' + p + ' × (1 + ' + r / 100 + ') ^ ' + t + ' = ' + amount + '.',
          { topic: 'Interest', level: 'hard' },
        );
      },
      () => {
        const base = randInt(2, 12);
        const exp = randInt(2, 3);
        return numeric(
          'What is ' + base + '^' + exp + '?',
          Math.pow(base, exp),
          base + ' multiplied by itself ' + exp + ' times is ' + Math.pow(base, exp) + '.',
          { topic: 'Powers', level: 'hard' },
        );
      },
      () => {
        const r = randInt(1, 6) * 7;
        return numeric(
          'What is the area of a circle of radius ' + r + ' cm? (take π = 22/7)',
          round2((22 / 7) * r * r),
          'Area = πr² = 22/7 × ' + r + '² = ' + round2((22 / 7) * r * r) + ' cm².',
          { topic: 'Geometry', level: 'hard' },
        );
      },
      () => {
        const p = randInt(2, 12) * 200;
        const rate = pick([10, 20, 25]);
        const discount = (p * rate) / 100;
        return numeric(
          'A shirt marked ₹' + p + ' sells at a ' + rate + '% discount. What is the selling price?',
          p - discount,
          'Discount = ' +
            rate +
            '% of ' +
            p +
            ' = ' +
            discount +
            ', so the price is ' +
            (p - discount) +
            '.',
          { topic: 'Percentage', level: 'hard' },
        );
      },
      () => {
        const cp = randInt(2, 20) * 50;
        const profit = randInt(1, 10) * 5;
        return numeric(
          'An item bought for ₹' +
            cp +
            ' is sold at a ' +
            profit +
            '% profit. What is the selling price?',
          cp + (cp * profit) / 100,
          'Profit = ' +
            profit +
            '% of ' +
            cp +
            ' = ' +
            (cp * profit) / 100 +
            ', so SP = ' +
            (cp + (cp * profit) / 100) +
            '.',
          { topic: 'Percentage', level: 'hard' },
        );
      },
      () => {
        const a = randInt(2, 9);
        const b = randInt(2, 12);
        const total = (a + b) * randInt(2, 12);
        return numeric(
          '₹' + total + ' is shared in the ratio ' + a + ' : ' + b + '. What is the smaller share?',
          (total / (a + b)) * Math.min(a, b),
          'Each part is ' +
            total / (a + b) +
            ', so the smaller share is ' +
            (total / (a + b)) * Math.min(a, b) +
            '.',
          { topic: 'Ratio', level: 'hard' },
        );
      },
    ],
  };

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  /* ----------------------------------------------------------- chemistry */
  const elements = [
    ['Hydrogen', 'H'],
    ['Helium', 'He'],
    ['Lithium', 'Li'],
    ['Carbon', 'C'],
    ['Nitrogen', 'N'],
    ['Oxygen', 'O'],
    ['Fluorine', 'F'],
    ['Sodium', 'Na'],
    ['Magnesium', 'Mg'],
    ['Aluminium', 'Al'],
    ['Silicon', 'Si'],
    ['Phosphorus', 'P'],
    ['Sulphur', 'S'],
    ['Chlorine', 'Cl'],
    ['Argon', 'Ar'],
    ['Potassium', 'K'],
    ['Calcium', 'Ca'],
    ['Iron', 'Fe'],
    ['Copper', 'Cu'],
    ['Zinc', 'Zn'],
    ['Silver', 'Ag'],
    ['Gold', 'Au'],
    ['Lead', 'Pb'],
    ['Mercury', 'Hg'],
  ];
  const compounds = [
    ['water', 'H₂O'],
    ['carbon dioxide', 'CO₂'],
    ['sodium chloride', 'NaCl'],
    ['calcium carbonate', 'CaCO₃'],
    ['sulphuric acid', 'H₂SO₄'],
    ['hydrochloric acid', 'HCl'],
    ['sodium hydroxide', 'NaOH'],
    ['ammonia', 'NH₃'],
    ['methane', 'CH₄'],
    ['hydrogen peroxide', 'H₂O₂'],
    ['potassium hydroxide', 'KOH'],
    ['sodium bicarbonate', 'NaHCO₃'],
    ['calcium oxide', 'CaO'],
    ['sulphur dioxide', 'SO₂'],
    ['glucose', 'C₆H₁₂O₆'],
    ['acetic acid', 'CH₃COOH'],
    ['copper sulphate', 'CuSO₄'],
    ['magnesium oxide', 'MgO'],
    ['nitric acid', 'HNO₃'],
    ['zinc oxide', 'ZnO'],
  ];
  const acidBase = [
    ['Lemon juice', 'acidic'],
    ['Vinegar', 'acidic'],
    ['Soap solution', 'basic'],
    ['Baking soda solution', 'basic'],
    ['Pure water', 'neutral'],
    ['Milk of magnesia', 'basic'],
    ['Curd', 'acidic'],
    ['Common salt solution', 'neutral'],
    ['Toothpaste', 'basic'],
    ['Orange juice', 'acidic'],
    ['Lime water', 'basic'],
    ['Black coffee', 'acidic'],
  ];
  const atomicNumbers = [
    ['Hydrogen', 1],
    ['Helium', 2],
    ['Carbon', 6],
    ['Nitrogen', 7],
    ['Oxygen', 8],
    ['Sodium', 11],
    ['Magnesium', 12],
    ['Aluminium', 13],
    ['Silicon', 14],
    ['Phosphorus', 15],
    ['Sulphur', 16],
    ['Chlorine', 17],
    ['Potassium', 19],
    ['Calcium', 20],
    ['Iron', 26],
    ['Copper', 29],
    ['Zinc', 30],
    ['Silver', 47],
    ['Gold', 79],
    ['Lead', 82],
  ];
  const reactions = [
    ['Acid + metal', 'Hydrogen gas'],
    ['Acid + carbonate', 'Carbon dioxide'],
    ['Acid + base', 'Salt and water'],
    ['Burning carbon in oxygen', 'Carbon dioxide'],
    ['Heating limestone', 'Calcium oxide'],
    ['Zinc + dilute sulphuric acid', 'Zinc sulphate and hydrogen'],
    ['Burning magnesium in air', 'Magnesium oxide'],
    ['Iron + copper sulphate solution', 'Iron sulphate and copper'],
    ['Burning hydrogen in oxygen', 'Water'],
    ['Photosynthesis in sunlight', 'Glucose and oxygen'],
  ];
  const commonNames = [
    ['Quicklime', 'CaO'],
    ['Slaked lime', 'Ca(OH)₂'],
    ['Baking soda', 'NaHCO₃'],
    ['Washing soda', 'Na₂CO₃'],
    ['Caustic soda', 'NaOH'],
    ['Blue vitriol', 'CuSO₄·5H₂O'],
    ['Green vitriol', 'FeSO₄·7H₂O'],
    ['Plaster of Paris', 'CaSO₄·½H₂O'],
    ['Chalk', 'CaCO₃'],
    ['Muriatic acid', 'HCl'],
    ['Laughing gas', 'N₂O'],
    ['Dry ice', 'CO₂'],
  ];
  const valencies = [
    ['Sodium', 1],
    ['Potassium', 1],
    ['Hydrogen', 1],
    ['Silver', 1],
    ['Calcium', 2],
    ['Magnesium', 2],
    ['Zinc', 2],
    ['Oxygen', 2],
    ['Aluminium', 3],
    ['Iron (ferric)', 3],
  ];

  const chemistry = {
    easy: [
      () =>
        table(elements.slice(0, 16), {
          prompt: 'What is the chemical symbol for {left}?',
          reverse: '{right} is the chemical symbol for which element?',
          why: 'The element {left} is written as {right}.',
          topic: 'Elements',
          level: 'easy',
        }),
      () =>
        table(compounds.slice(0, 12), {
          prompt: 'What is the chemical formula of {left}?',
          reverse: 'Which compound has the formula {right}?',
          why: '{left} is written as {right}.',
          topic: 'Formulae',
          level: 'easy',
        }),
      () =>
        table(acidBase, {
          prompt: 'Is {left} acidic, basic or neutral?',
          reverse: 'Which of these is {right}?',
          why: '{left} is {right} on the pH scale.',
          topic: 'Acids and bases',
          level: 'easy',
        }),
    ],
    medium: [
      () => {
        const [name, number] = pick(atomicNumbers);
        const pool = unique(atomicNumbers.map((pair) => String(pair[1]))).filter(
          (value) => value !== String(number),
        );
        return q(
          'What is the atomic number of ' + name + '?',
          String(number),
          shuffle(pool).slice(0, 3),
          {
            why: name + ' has ' + number + ' protons, so its atomic number is ' + number + '.',
            topic: 'Atoms',
            level: 'medium',
          },
        );
      },
      () =>
        table(elements, {
          prompt: 'Which element has the chemical symbol {right}?',
          reverse: 'What is the chemical symbol for {left}?',
          why: '{left} is written as {right}.',
          topic: 'Elements',
          level: 'medium',
          flip: true,
        }),
      () =>
        table(compounds.slice(5), {
          prompt: 'What is the chemical formula of {left}?',
          reverse: 'Which compound has the formula {right}?',
          why: '{left} is written as {right}.',
          topic: 'Formulae',
          level: 'medium',
        }),
      () =>
        table(reactions, {
          prompt: 'What is produced when {left}?',
          reverse: 'Which reaction gives {right}?',
          why: '{left} gives {right}.',
          topic: 'Reactions',
          level: 'medium',
        }),
    ],
    hard: [
      () => {
        const [name, formula] = pick(compounds);
        const pool = unique(compounds.map((pair) => pair[1])).filter((value) => value !== formula);
        return q('What is the formula of ' + name + '?', formula, shuffle(pool).slice(0, 3), {
          why: name + ' is written as ' + formula + '.',
          topic: 'Formulae',
          level: 'hard',
        });
      },
      () =>
        table(commonNames, {
          prompt: 'What is the chemical formula of {left}?',
          reverse: '{right} is the chemical formula of which common substance?',
          why: '{left} is {right}.',
          topic: 'Common chemicals',
          level: 'hard',
        }),
      () => {
        const [element, value] = pick(valencies);
        const wrong = ['1', '2', '3', '4'].filter((option) => option !== String(value)).slice(0, 3);
        return q('What is the valency of ' + element + '?', String(value), wrong, {
          why: element + ' forms ' + value + ' bond(s), so its valency is ' + value + '.',
          topic: 'Atoms',
          level: 'hard',
        });
      },
      () =>
        table(elements.slice(10), {
          prompt: 'Which element has the chemical symbol {right}?',
          reverse: 'What is the chemical symbol for {left}?',
          why: '{left} is written as {right}.',
          topic: 'Elements',
          level: 'hard',
          flip: true,
        }),
    ],
  };

  /* ------------------------------------------------------------- biology */
  const organs = [
    ['Heart', 'pumps blood around the body'],
    ['Lungs', 'exchange oxygen and carbon dioxide'],
    ['Kidneys', 'filter waste from the blood'],
    ['Liver', 'produces bile and breaks down toxins'],
    ['Brain', 'controls the nervous system'],
    ['Stomach', 'digests food with acid and enzymes'],
    ['Pancreas', 'makes insulin and digestive enzymes'],
    ['Small intestine', 'absorbs nutrients from food'],
    ['Skin', 'protects the body and controls temperature'],
    ['Bones', 'support the body and protect organs'],
  ];
  const systems = [
    ['Heart', 'Circulatory system'],
    ['Lungs', 'Respiratory system'],
    ['Stomach', 'Digestive system'],
    ['Kidneys', 'Excretory system'],
    ['Brain', 'Nervous system'],
    ['Bones', 'Skeletal system'],
    ['Muscles', 'Muscular system'],
    ['Skin', 'Integumentary system'],
    ['Ovaries', 'Reproductive system'],
    ['Thyroid', 'Endocrine system'],
  ];
  const blood = [
    ['Which blood group is called the universal donor?', 'O negative'],
    ['Which blood group is called the universal recipient?', 'AB positive'],
    ['Which blood group has both A and Rh antigens?', 'A positive'],
    ['Which blood group has the B antigen but no Rh factor?', 'B negative'],
    ['Which blood group can safely be given to almost any patient?', 'O negative'],
    ['Which blood group is called the universal plasma donor?', 'AB positive'],
  ];
  const vitamins = [
    ['Vitamin A', 'night blindness'],
    ['Vitamin B1', 'beriberi'],
    ['Vitamin B12', 'anaemia'],
    ['Vitamin C', 'scurvy'],
    ['Vitamin D', 'rickets'],
    ['Vitamin K', 'slow blood clotting'],
    ['Vitamin B2', 'cracked lips'],
    ['Vitamin B3', 'pellagra'],
    ['Vitamin B9', 'birth defects'],
    ['Vitamin E', 'weak immunity'],
  ];
  const diseases = [
    ['Malaria', 'a mosquito bite'],
    ['Dengue', 'the Aedes mosquito'],
    ['Cholera', 'contaminated water'],
    ['Tuberculosis', 'bacteria in the air'],
    ['Typhoid', 'contaminated food and water'],
    ['Common cold', 'a virus'],
    ['Rabies', 'a bite from an infected animal'],
    ['Amoebic dysentery', 'contaminated food'],
    ['Ringworm', 'a fungal infection of the skin'],
    ['Jaundice', 'a damaged liver'],
  ];
  const glands = [
    ['Thyroid', 'thyroxine'],
    ['Pancreas', 'insulin'],
    ['Adrenal gland', 'adrenaline'],
    ['Pituitary gland', 'growth hormone'],
    ['Salivary gland', 'saliva'],
    ['Tear gland', 'tears'],
    ['Sweat gland', 'sweat'],
    ['Liver', 'bile'],
  ];
  const biology = {
    easy: [
      () =>
        table(organs, {
          prompt: 'What is the main job of the {left}?',
          reverse: 'Which organ does this: {right}?',
          why: 'The {left} {right}.',
          topic: 'Human body',
          level: 'easy',
        }),
      () =>
        facts(blood, {
          why: 'That is the accepted blood-group fact.',
          topic: 'Human body',
          level: 'easy',
        }),
      () =>
        facts(
          [
            ['Which cell part is the powerhouse of the cell?', 'Mitochondria'],
            ['What is the basic unit of life?', 'Cell'],
            ['Which pigment makes leaves green?', 'Chlorophyll'],
            ['Which organ pumps blood?', 'Heart'],
            ['Which is the largest organ of the body?', 'Skin'],
            ['Which cell part is the control centre?', 'Nucleus'],
            ['Which gas do plants take in during photosynthesis?', 'Carbon dioxide'],
            ['Which gas do humans breathe in to survive?', 'Oxygen'],
            ['Which liquid carries oxygen around the body?', 'Blood'],
            ['Which cell part gives a plant cell its shape?', 'Cell wall'],
          ],
          { why: 'That is the standard school-science fact.', topic: 'Cells', level: 'easy' },
        ),
      () =>
        table(systems, {
          prompt: 'Which body system does the {left} belong to?',
          reverse: 'Which organ is part of the {right}?',
          why: 'The {left} is part of the {right}.',
          topic: 'Body systems',
          level: 'easy',
        }),
    ],
    medium: [
      () =>
        table(vitamins, {
          prompt: 'Deficiency of {left} causes which problem?',
          reverse: 'Which vitamin prevents {right}?',
          why: 'Lack of {left} leads to {right}.',
          topic: 'Nutrition',
          level: 'medium',
        }),
      () =>
        table(diseases, {
          prompt: 'How does {left} spread?',
          reverse: 'Which disease spreads through {right}?',
          why: '{left} spreads through {right}.',
          topic: 'Health',
          level: 'medium',
        }),
      () =>
        table(organs.slice(3), {
          prompt: 'Which organ does this: {right}?',
          reverse: 'What does the {left} do?',
          why: 'The {left} {right}.',
          topic: 'Human body',
          level: 'medium',
          flip: true,
        }),
      () =>
        facts(
          [
            ['How many chromosomes does a human body cell have?', '46', ['23', '44', '48']],
            ['How many chambers does the human heart have?', '4', ['2', '3', '6']],
            ['How many bones does an adult human have?', '206', ['106', '186', '306']],
            ['How many teeth does an adult usually have?', '32', ['28', '34', '36']],
            ['How many pairs of ribs does a human have?', '12', ['10', '14', '16']],
            ['How many bones does a newborn baby have?', '300', ['206', '250', '400']],
          ],
          {
            why: 'This is the standard figure taught in biology.',
            topic: 'Human body',
            level: 'medium',
          },
        ),
    ],
    hard: [
      () =>
        facts(
          [
            ['Which part of the brain controls balance?', 'Cerebellum'],
            ['Which blood cells fight infection?', 'White blood cells'],
            ['Which part of the blood helps it to clot?', 'Platelets'],
            ['Which vessel carries blood away from the heart?', 'Artery'],
            ['Which vessel carries blood back to the heart?', 'Vein'],
            ['Which tiny air sacs exchange gases in the lungs?', 'Alveoli'],
            ['Which pigment carries oxygen in red blood cells?', 'Haemoglobin'],
            ['Which organ stores bile?', 'Gall bladder'],
          ],
          { why: 'This is a standard anatomy fact.', topic: 'Advanced biology', level: 'hard' },
        ),
      () =>
        facts(
          [
            ['Which enzyme in saliva starts starch digestion?', 'Amylase'],
            ['Which process do plants use to lose water vapour?', 'Transpiration'],
            ['Which molecule carries genetic information?', 'DNA'],
            ['Which process divides a cell into two identical cells?', 'Mitosis'],
            ['Which process lets plants make food using sunlight?', 'Photosynthesis'],
            ['Which process moves water through a cell membrane?', 'Osmosis'],
            ['Which process do cells use to release energy from food?', 'Respiration'],
          ],
          { why: 'This is a standard life-process fact.', topic: 'Life processes', level: 'hard' },
        ),
      () =>
        table(glands, {
          prompt: 'Which hormone or secretion does the {left} produce?',
          reverse: 'Which gland produces {right}?',
          why: 'The {left} produces {right}.',
          topic: 'Glands',
          level: 'hard',
        }),
      () =>
        table(vitamins.slice(3), {
          prompt: 'Lack of {left} leads to which condition?',
          reverse: 'Which vitamin is missing in {right}?',
          why: '{left} deficiency causes {right}.',
          topic: 'Nutrition',
          level: 'hard',
        }),
    ],
  };

  /* ------------------------------------------------------------------ GK */
  const capitals = [
    ['India', 'New Delhi'],
    ['France', 'Paris'],
    ['Japan', 'Tokyo'],
    ['Russia', 'Moscow'],
    ['China', 'Beijing'],
    ['Italy', 'Rome'],
    ['United Kingdom', 'London'],
    ['United States', 'Washington DC'],
    ['Germany', 'Berlin'],
    ['Australia', 'Canberra'],
    ['Canada', 'Ottawa'],
    ['Brazil', 'Brasília'],
    ['Egypt', 'Cairo'],
    ['Nepal', 'Kathmandu'],
    ['Bhutan', 'Thimphu'],
    ['Bangladesh', 'Dhaka'],
    ['Pakistan', 'Islamabad'],
    ['Iran', 'Tehran'],
    ['Spain', 'Madrid'],
    ['South Africa', 'Pretoria'],
  ];
  const currencies = [
    ['India', 'Rupee'],
    ['Japan', 'Yen'],
    ['United Kingdom', 'Pound sterling'],
    ['United States', 'Dollar'],
    ['China', 'Yuan'],
    ['Russia', 'Rouble'],
    ['South Korea', 'Won'],
    ['Bangladesh', 'Taka'],
    ['Saudi Arabia', 'Riyal'],
    ['United Arab Emirates', 'Dirham'],
    ['Thailand', 'Baht'],
    ['Malaysia', 'Ringgit'],
    ['Indonesia', 'Rupiah'],
    ['Kuwait', 'Dinar'],
    ['Switzerland', 'Franc'],
  ];
  const stateCapitals = [
    ['Maharashtra', 'Mumbai'],
    ['Karnataka', 'Bengaluru'],
    ['Tamil Nadu', 'Chennai'],
    ['Kerala', 'Thiruvananthapuram'],
    ['West Bengal', 'Kolkata'],
    ['Uttar Pradesh', 'Lucknow'],
    ['Bihar', 'Patna'],
    ['Rajasthan', 'Jaipur'],
    ['Gujarat', 'Gandhinagar'],
    ['Punjab', 'Chandigarh'],
    ['Odisha', 'Bhubaneswar'],
    ['Assam', 'Dispur'],
    ['Goa', 'Panaji'],
    ['Madhya Pradesh', 'Bhopal'],
    ['Telangana', 'Hyderabad'],
    ['Andhra Pradesh', 'Amaravati'],
    ['Himachal Pradesh', 'Shimla'],
    ['Jharkhand', 'Ranchi'],
  ];
  const gk = {
    easy: [
      () =>
        table(capitals.slice(0, 12), {
          prompt: 'What is the capital of {left}?',
          reverse: '{right} is the capital of which country?',
          why: 'The capital of {left} is {right}.',
          topic: 'World capitals',
          level: 'easy',
        }),
      () =>
        table(currencies.slice(0, 10), {
          prompt: 'What is the currency of {left}?',
          reverse: 'The {right} is the currency of which country?',
          why: 'The currency of {left} is the {right}.',
          topic: 'Currencies',
          level: 'easy',
        }),
      () =>
        facts(
          [
            [
              'What is the national animal of India?',
              'Bengal tiger',
              ['Lion', 'Elephant', 'Peacock'],
            ],
            ['What is the national bird of India?', 'Peacock', ['Parrot', 'Swan', 'Eagle']],
            ['What is the national flower of India?', 'Lotus', ['Rose', 'Sunflower', 'Marigold']],
            ['What is the national fruit of India?', 'Mango', ['Banana', 'Apple', 'Guava']],
            ['What is the national tree of India?', 'Banyan', ['Neem', 'Peepal', 'Deodar']],
            ['What is the national sport of India?', 'Hockey', ['Cricket', 'Kabaddi', 'Football']],
            [
              'Which is the largest planet in the solar system?',
              'Jupiter',
              ['Saturn', 'Neptune', 'Earth'],
            ],
            ['Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Mars', 'Earth']],
            ['Which planet is known as the Red Planet?', 'Mars', ['Venus', 'Jupiter', 'Mercury']],
            ['Which is the largest ocean on Earth?', 'Pacific', ['Atlantic', 'Indian', 'Arctic']],
            [
              'Which is the highest mountain in the world?',
              'Mount Everest',
              ['K2', 'Kanchenjunga', 'Nanga Parbat'],
            ],
            ['Which is the longest river in the world?', 'Nile', ['Amazon', 'Ganga', 'Yangtze']],
            ['How many continents are there on Earth?', '7', ['5', '6', '8']],
          ],
          {
            why: 'This is the standard general-knowledge fact.',
            topic: 'India and the world',
            level: 'easy',
          },
        ),
      () =>
        table(stateCapitals.slice(0, 10), {
          prompt: 'What is the capital of {left}?',
          reverse: 'Which state has the capital {right}?',
          why: 'The capital of {left} is {right}.',
          topic: 'Indian states',
          level: 'easy',
        }),
    ],
    medium: [
      () =>
        table(stateCapitals, {
          prompt: 'What is the capital of {left}?',
          reverse: 'Which state has the capital {right}?',
          why: 'The capital of {left} is {right}.',
          topic: 'Indian states',
          level: 'medium',
        }),
      () =>
        table(capitals, {
          prompt: 'What is the capital of {left}?',
          reverse: '{right} is the capital of which country?',
          why: 'The capital of {left} is {right}.',
          topic: 'World capitals',
          level: 'medium',
        }),
      () =>
        table(currencies, {
          prompt: 'What is the currency of {left}?',
          reverse: 'The {right} is the currency of which country?',
          why: 'The currency of {left} is the {right}.',
          topic: 'Currencies',
          level: 'medium',
        }),
      () =>
        facts(
          [
            [
              'Which is the smallest planet in the solar system?',
              'Mercury',
              ['Mars', 'Venus', 'Earth'],
            ],
            ['Which planet has the most moons?', 'Saturn', ['Jupiter', 'Uranus', 'Neptune']],
            ['Which planet is famous for its rings?', 'Saturn', ['Jupiter', 'Mars', 'Venus']],
            ['Which is the hottest planet?', 'Venus', ['Mercury', 'Mars', 'Jupiter']],
            ['Which planet is farthest from the Sun?', 'Neptune', ['Uranus', 'Saturn', 'Jupiter']],
            ['Which is the deepest ocean?', 'Pacific', ['Atlantic', 'Indian', 'Arctic']],
            [
              'Which is the largest hot desert in the world?',
              'Sahara',
              ['Gobi', 'Thar', 'Kalahari'],
            ],
            ['Which is the largest continent?', 'Asia', ['Africa', 'Europe', 'North America']],
            [
              'Which is the smallest continent?',
              'Australia',
              ['Europe', 'Antarctica', 'South America'],
            ],
            [
              'Which country has the largest population?',
              'India',
              ['China', 'United States', 'Indonesia'],
            ],
            [
              'Which is the largest country by area?',
              'Russia',
              ['Canada', 'China', 'United States'],
            ],
            [
              'Which river is the longest in India?',
              'Ganga',
              ['Godavari', 'Brahmaputra', 'Narmada'],
            ],
          ],
          {
            why: 'This is verified by current geography texts.',
            topic: 'Geography',
            level: 'medium',
          },
        ),
    ],
    hard: [
      () =>
        table(capitals.slice(8), {
          prompt: 'Which country has the capital {right}?',
          reverse: 'What is the capital of {left}?',
          why: 'The capital of {left} is {right}.',
          topic: 'World capitals',
          level: 'hard',
          flip: true,
        }),
      () =>
        table(stateCapitals.slice(8), {
          prompt: 'Which state has the capital {right}?',
          reverse: 'What is the capital of {left}?',
          why: 'The capital of {left} is {right}.',
          topic: 'Indian states',
          level: 'hard',
          flip: true,
        }),
      () =>
        facts(
          [
            ['Who wrote “The Discovery of India”?', 'Jawaharlal Nehru'],
            ['Who wrote the national anthem of India?', 'Rabindranath Tagore'],
            ['Who wrote “Gitanjali”?', 'Rabindranath Tagore'],
            ['Who wrote “Wings of Fire”?', 'A. P. J. Abdul Kalam'],
            ['Who wrote “Arthashastra”?', 'Chanakya'],
            ['Who is called the Father of the Indian Constitution?', 'B. R. Ambedkar'],
            ['Who was the first Prime Minister of India?', 'Jawaharlal Nehru'],
            ['Who was the first President of India?', 'Rajendra Prasad'],
            ['Who wrote “Godan”?', 'Munshi Premchand'],
            ['Who wrote “Meghaduta”?', 'Kalidasa'],
            ['Who wrote “Malgudi Days”?', 'R. K. Narayan'],
            ['Who wrote “A Brief History of Time”?', 'Stephen Hawking'],
          ],
          {
            why: 'This is a standard books-and-authors fact.',
            topic: 'Books and people',
            level: 'hard',
          },
        ),
      () =>
        facts(
          [
            [
              'Which is the deepest ocean trench?',
              'Mariana Trench',
              ['Java Trench', 'Tonga Trench', 'Puerto Rico Trench'],
            ],
            [
              'Which is the highest waterfall in the world?',
              'Angel Falls',
              ['Niagara Falls', 'Victoria Falls', 'Jog Falls'],
            ],
            [
              'Which is the largest freshwater lake by area?',
              'Lake Superior',
              ['Lake Victoria', 'Lake Baikal', 'Lake Titicaca'],
            ],
            [
              'Which is the largest island in the world?',
              'Greenland',
              ['Madagascar', 'Borneo', 'New Guinea'],
            ],
            [
              'Which strait separates India and Sri Lanka?',
              'Palk Strait',
              ['Strait of Malacca', 'Bering Strait', 'Strait of Hormuz'],
            ],
            [
              'Which city is known as the Silicon Valley of India?',
              'Bengaluru',
              ['Hyderabad', 'Pune', 'Chennai'],
            ],
            [
              'Which country is called the Land of the Rising Sun?',
              'Japan',
              ['China', 'Thailand', 'South Korea'],
            ],
            ['Which is the largest desert in Asia?', 'Gobi', ['Thar', 'Karakum', 'Dasht-e Lut']],
            [
              'Which is the deepest lake in the world?',
              'Lake Baikal',
              ['Caspian Sea', 'Lake Tanganyika', 'Lake Superior'],
            ],
            ['Which is the longest river in Asia?', 'Yangtze', ['Ganga', 'Mekong', 'Indus']],
          ],
          {
            why: 'This is a verified world-records fact.',
            topic: 'Geography records',
            level: 'hard',
          },
        ),
      () =>
        table(currencies.slice(5), {
          prompt: 'The {right} is the currency of which country?',
          reverse: 'What is the currency of {left}?',
          why: 'The currency of {left} is the {right}.',
          topic: 'Currencies',
          level: 'hard',
          flip: true,
        }),
    ],
  };

  /* ------------------------------------------------------------ computer */
  const shortcuts = [
    ['Ctrl + C', 'copy'],
    ['Ctrl + V', 'paste'],
    ['Ctrl + X', 'cut'],
    ['Ctrl + Z', 'undo'],
    ['Ctrl + Y', 'redo'],
    ['Ctrl + S', 'save'],
    ['Ctrl + P', 'print'],
    ['Ctrl + F', 'find'],
    ['Ctrl + A', 'select all'],
    ['Ctrl + N', 'open a new window'],
    ['Ctrl + B', 'bold text'],
    ['F5', 'refresh the page'],
    ['Ctrl + W', 'close the tab'],
    ['Ctrl + T', 'open a new tab'],
  ];
  const tags = [
    ['<a>', 'a link'],
    ['<img>', 'an image'],
    ['<ul>', 'an unordered list'],
    ['<ol>', 'an ordered list'],
    ['<li>', 'a list item'],
    ['<h1>', 'the main heading'],
    ['<p>', 'a paragraph'],
    ['<br>', 'a line break'],
    ['<table>', 'a table'],
    ['<input>', 'a form input'],
    ['<button>', 'a button'],
    ['<div>', 'a block container'],
    ['<span>', 'an inline container'],
    ['<form>', 'a form'],
  ];
  const extensions = [
    ['.html', 'a web page'],
    ['.css', 'a stylesheet'],
    ['.js', 'a script'],
    ['.jpg', 'an image'],
    ['.mp3', 'audio'],
    ['.mp4', 'video'],
    ['.pdf', 'a printable document'],
    ['.zip', 'a compressed folder'],
    ['.csv', 'spreadsheet data'],
    ['.json', 'a data file'],
  ];
  const statusCodes = [
    [200, 'OK'],
    [301, 'Moved permanently'],
    [400, 'Bad request'],
    [401, 'Unauthorised'],
    [403, 'Forbidden'],
    [404, 'Not found'],
    [405, 'Method not allowed'],
    [429, 'Too many requests'],
    [500, 'Internal server error'],
    [503, 'Service unavailable'],
    [502, 'Bad gateway'],
    [204, 'No content'],
  ];
  const concepts = [
    ['HTML', 'the structure of a web page'],
    ['CSS', 'the styling of a web page'],
    ['JavaScript', 'the behaviour of a web page'],
    ['HTTP', 'the protocol for web pages'],
    ['DNS', 'the service that turns names into IP addresses'],
    ['URL', 'the address of a page'],
    ['Cookie', 'a small file a site stores in your browser'],
    ['Cache', 'stored copies that speed up loading'],
    ['API', 'an interface that lets programs talk'],
    ['JSON', 'a common data format'],
    ['Git', 'a version control system'],
    ['RAM', 'fast temporary memory'],
    ['CPU', 'the part that executes instructions'],
    ['SSD', 'storage with no moving parts'],
  ];
  const computer = {
    easy: [
      () =>
        table(shortcuts.slice(0, 8), {
          prompt: 'What does {left} do?',
          reverse: 'Which shortcut is used to {right}?',
          why: '{left} is used to {right}.',
          topic: 'Shortcuts',
          level: 'easy',
        }),
      () =>
        table(tags.slice(0, 8), {
          prompt: 'What does the HTML tag {left} create?',
          reverse: 'Which HTML tag creates {right}?',
          why: '{left} creates {right}.',
          topic: 'HTML',
          level: 'easy',
        }),
      () =>
        table(extensions, {
          prompt: 'What kind of file is {left}?',
          reverse: 'Which extension is used for {right}?',
          why: '{left} usually holds {right}.',
          topic: 'Files',
          level: 'easy',
        }),
    ],
    medium: [
      () =>
        table(shortcuts, {
          prompt: 'Which shortcut is used to {right}?',
          reverse: 'What does {left} do?',
          why: '{left} is used to {right}.',
          topic: 'Shortcuts',
          level: 'medium',
          flip: true,
        }),
      () =>
        table(tags, {
          prompt: 'Which HTML tag creates {right}?',
          reverse: 'What does the HTML tag {left} create?',
          why: '{left} creates {right}.',
          topic: 'HTML',
          level: 'medium',
          flip: true,
        }),
      () => {
        const bits = pick([8, 16, 32, 64, 128, 256, 512]);
        return numeric(
          'How many bytes are there in ' + bits + ' bits?',
          bits / 8,
          'There are 8 bits in a byte, so ' + bits + ' ÷ 8 = ' + bits / 8 + ' bytes.',
          { topic: 'Units', level: 'medium' },
        );
      },
      () => {
        const mb = pick([1, 2, 4, 5, 8, 10, 16, 20]);
        return numeric(
          'How many kilobytes are there in ' + mb + ' MB?',
          mb * 1024,
          '1 MB = 1024 KB, so ' + mb + ' × 1024 = ' + mb * 1024 + ' KB.',
          { topic: 'Units', level: 'medium' },
        );
      },
      () =>
        table(statusCodes, {
          prompt: 'What does HTTP status {left} mean?',
          reverse: 'Which status code means “{right}”?',
          why: '{left} means “{right}”.',
          topic: 'HTTP',
          level: 'medium',
        }),
    ],
    hard: [
      () => {
        const value = randInt(10, 255);
        return numeric(
          'What is the binary number ' + value.toString(2) + ' in decimal?',
          value,
          'Binary ' + value.toString(2) + ' equals ' + value + ' in decimal.',
          { topic: 'Number systems', level: 'hard' },
        );
      },
      () => {
        const value = randInt(5, 200);
        const correct = value.toString(2);
        const wrong = [value + 1, value + 2, value + 3]
          .map((number) => number.toString(2))
          .filter((text) => text !== correct)
          .slice(0, 3);
        if (wrong.length < 3) return null;
        return q('How is the decimal number ' + value + ' written in binary?', correct, wrong, {
          why: value + ' = ' + correct + ' in binary.',
          topic: 'Number systems',
          level: 'hard',
        });
      },
      () =>
        table(statusCodes, {
          prompt: 'Which status code means “{right}”?',
          reverse: 'What does HTTP status {left} mean?',
          why: '{left} means “{right}”.',
          topic: 'HTTP',
          level: 'hard',
          flip: true,
        }),
      () =>
        table(concepts, {
          prompt: 'What is {left}?',
          reverse: 'Which term means {right}?',
          why: '{left} is {right}.',
          topic: 'Concepts',
          level: 'hard',
        }),
      () =>
        table(extensions.slice(4), {
          prompt: 'What kind of content does a {left} file hold?',
          reverse: 'Which extension is used for {right}?',
          why: 'A {left} file holds {right}.',
          topic: 'Files',
          level: 'hard',
        }),
    ],
  };

  const subjects = { physics, chemistry, maths, biology, gk, computer };

  // Generate one question for a subject at a level, falling back to another
  // level if a particular generator cannot build four distinct options.
  function generate(subject, level) {
    const set = subjects[subject];
    if (!set) return null;
    const wanted = LEVELS.includes(level) ? level : 'medium';
    const order = [wanted, ...shuffle(LEVELS.filter((item) => item !== wanted))];
    for (const name of order) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = pick(set[name])();
        if (result && LEVELS.includes(result.level)) return result;
      }
    }
    return null;
  }

  return { LEVELS, subjects: Object.keys(subjects), generate };
})();
