// Ten print compositions for the v1 collection. Only trusted catalog inks and
// studio-drawn subjects enter these SVGs; user text is rendered separately as HTML.
const repeat = (n, draw) => Array.from({ length: n }, (_, i) => draw(i)).join('');
const rect = (x, y, w, h, fill, attrs = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${attrs}/>`;
const path = (d, fill, attrs = '') => `<path d="${d}" fill="${fill}" ${attrs}/>`;
const dot = (x, y, r, color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const lines = (color, paths, width = 1) =>
  `<g fill="none" stroke="${color}" stroke-width="${width}">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`;
const transform = (t, body) => `<g transform="${t}">${body}</g>`;
const mirror = (shape) => shape + transform('translate(480 0) scale(-1 1)', shape);
const gleam = (x, y, r, c) =>
  transform(
    `translate(${x} ${y}) scale(${r})`,
    path('M0-1Q.1-.1 1 0 .1.1 0 1-.1.1-1 0-.1-.1 0-1Z', c),
  );

export function pressArtwork(frame, [ink, paper, accent, dark], subject) {
  const sheet = (c) => rect(0, 0, 480, 260, c),
    place = (x = 240, y = 130, s = 1.18) => transform(`translate(${x} ${y}) scale(${s})`, subject),
    border = (gap, c) => rect(gap, gap, 480 - 2 * gap, 260 - 2 * gap, 'none', `stroke="${c}"`),
    rule = `stroke="${accent}"`,
    gold = '#e6c588';
  switch (frame) {
    case 'cameo': {
      const fan = repeat(13, (i) => lines(accent, [`M0 ${12 + i * 19}Q61 130 116 ${62 + i * 11}`]));
      return (
        sheet(ink) +
        mirror(fan) +
        `<ellipse cx="240" cy="130" rx="134" ry="112" fill="${accent}"/><ellipse cx="240" cy="130" rx="126" ry="104" fill="${paper}" stroke="${ink}" stroke-width="3"/><ellipse cx="240" cy="130" rx="119" ry="97" fill="none" stroke="${accent}" stroke-dasharray="2 5"/>` +
        place() +
        border(9, accent)
      );
    }
    case 'post': {
      const perforations = repeat(
        22,
        (i) => dot(42 + i * 19, 22, 5, dark) + dot(42 + i * 19, 238, 5, dark),
      );
      return (
        sheet(dark) +
        rect(32, 22, 416, 216, paper) +
        perforations +
        rect(49, 39, 382, 182, 'none', rule) +
        lines(accent, ['M82 172h97m-97 12h77m-77 12h84', 'M199 70v123']) +
        transform(
          'translate(120 96) rotate(-12)',
          `<circle r="33" fill="none" stroke="${ink}"/><circle r="28" fill="none" ${rule}/>` +
            repeat(3, (i) => lines(ink, [`M-44 ${i * 6 - 8}q22-8 44 0t48 0`])),
        ) +
        rect(224, 52, 161, 150, accent) +
        rect(228, 56, 153, 142, paper) +
        place(304, 132, 0.91)
      );
    }
    case 'orbit': {
      const chart = repeat(38, (i) =>
        dot((i * 101 + 23) % 480, (i * 53 + 21) % 256, i % 5 === 0 ? 2.2 : 1.1, gold),
      );
      return (
        sheet(dark) +
        chart +
        transform(
          'rotate(-17 240 130)',
          `<g fill="none" stroke="${accent}"><ellipse cx="240" cy="130" rx="209" ry="62"/><ellipse cx="240" cy="130" rx="196" ry="81" stroke-dasharray="2 6"/><circle cx="240" cy="130" r="103"/></g>`,
        ) +
        lines(gold, ['M22 84l37-34 43 14 21-24', 'M361 209l31-36 38 21 26-32']) +
        gleam(72, 163, 11, gold) +
        gleam(377, 64, 7, gold) +
        place(240, 133, 1.28)
      );
    }
    case 'ribbon': {
      const folds =
        path('M0 0h84l72 260H77Z', ink) +
        path('M0 0h20l73 260H72Z', accent) +
        lines(paper, ['M31 0l72 260', 'M38 0l72 260']);
      return (
        sheet(paper) +
        mirror(folds) +
        rect(141, 37, 198, 185, accent) +
        rect(146, 42, 188, 175, paper) +
        rect(151, 47, 178, 165, 'none', rule) +
        path('m209 35 31-22 31 22-31 13Z', ink) +
        place(240, 134, 1.12) +
        gleam(240, 215, 6, ink)
      );
    }
    case 'garden': {
      const stems =
        lines(ink, ['M17 258Q120 129 41 15', 'M22 248q73-66 96-65', 'M37 12q20 65 87 64'], 2) +
        repeat(9, (i) => {
          const y = 33 + i * 23,
            x = 38 + Math.sin(i * 0.43) * 32;
          return transform(
            `translate(${x.toFixed(1)} ${y}) rotate(${i % 2 ? -15 : 30})`,
            path('M0 0Q-29-3-32-24-6-23 0 0Z', i % 3 === 0 ? accent : ink) +
              path('M5 6Q25 5 31-15 8-16 5 6Z', accent),
          );
        });
      return (
        sheet(paper) +
        mirror(stems) +
        `<ellipse cx="240" cy="130" rx="110" ry="93" fill="none" ${rule} stroke-dasharray="1 5"/>` +
        gleam(240, 27, 8, accent) +
        gleam(240, 234, 8, accent) +
        place()
      );
    }
    case 'arcade': {
      const arch = 'M66 245V99h22V73h25V55h28V41h51V26h96v15h51v14h28v18h25v26h22v146Z';
      return (
        sheet(dark) +
        repeat(3, (i) =>
          transform(
            `translate(240 133) scale(${1 - i * 0.09}) translate(-240 -133)`,
            path(
              arch,
              'none',
              `stroke="${i === 1 ? gold : accent}" stroke-width="${i === 1 ? 2 : 1}"`,
            ),
          ),
        ) +
        mirror(repeat(4, (i) => lines(accent, [`M${14 + i * 10} 260V${104 + i * 11}l20-19`]))) +
        rect(191, 218, 98, 2, gold) +
        gleam(240, 62, 8, gold) +
        place(240, 145, 1.08)
      );
    }
    case 'quilt': {
      const block = `<pattern id="block" width="56" height="56" patternUnits="userSpaceOnUse">${rect(0, 0, 56, 56, paper)}${path('m0 0 28 28L0 56Zm56 0L28 28l28 28Z', accent)}${path('m28 13 15 15-15 15-15-15Z', ink)}</pattern>`;
      return (
        `<defs>${block}</defs>` +
        sheet('url(#block)') +
        path('m240 11 125 119-125 119-125-119Z', ink) +
        path('m240 22 114 108-114 108-114-108Z', paper) +
        place(240, 131, 0.98) +
        border(6, paper)
      );
    }
    case 'gallery': {
      return (
        sheet(ink) +
        mirror(repeat(6, (i) => lines(accent, [`M${7 + i * 11} 0v260`]))) +
        rect(94, 20, 292, 222, dark) +
        rect(89, 15, 292, 222, paper) +
        rect(108, 35, 254, 156, accent) +
        rect(113, 40, 244, 146, paper) +
        place(237, 116, 0.97) +
        lines(ink, ['M176 208h120', 'M205 216h62']) +
        dot(237, 200, 2, accent)
      );
    }
    case 'pennant': {
      const cord =
        lines(ink, ['M-12 15Q240 115 492 15'], 2) +
        repeat(18, (i) => {
          const x = i * 28 - 12,
            y = 21 + Math.sin((Math.PI * i) / 17) * 46;
          return path(`M${x} ${y}l13 ${i % 2 ? 19 : 26} 13-20Z`, i % 3 === 0 ? ink : accent);
        });
      return (
        sheet(paper) +
        mirror(path('M0 104q26 106 128 156H0Z', accent) + path('M0 143q24 80 81 117H0Z', ink)) +
        cord +
        place(240, 156, 1.02) +
        mirror(gleam(92, 154, 10, accent) + gleam(65, 131, 4, ink))
      );
    }
    case 'horizon': {
      return (
        sheet(dark) +
        dot(240, 109, 85, accent) +
        dot(240, 109, 76, paper) +
        repeat(19, (i) => gleam((i * 107 + 23) % 480, (i * 39 + 11) % 108, 2 + (i % 3), gold)) +
        path('M0 201q77-94 184-38t154-18q67-52 142-20v135H0Z', ink) +
        path('M0 218q94 16 168-34t180 12q48 30 132-12v76H0Z', accent) +
        path('M0 241q122-45 232-18t248-11v48H0Z', dark) +
        place(240, 113, 0.94)
      );
    }
    default:
      throw Error('Unknown print composition.');
  }
}
