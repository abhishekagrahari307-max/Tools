// Original vector stationery plates. Each occasion has its own illustration, not an emoji or a recoloured stock photograph.
const petals = (n, r, c, edge = 'none') =>
  Array.from(
    { length: n },
    (_, i) =>
      `<ellipse cy="${-r * 0.61}" rx="${r * 0.2}" ry="${r * 0.39}" transform="rotate(${(360 * i) / n})" fill="${c}" stroke="${edge}"/>`,
  ).join('');
const star = (x, y, r, c) =>
  `<path transform="translate(${x} ${y}) scale(${r})" fill="${c}" d="M0-1 .18-.24 1 0 .18.2 0 1-.19.23-1 0-.2-.22Z"/>`;
const bursts = (x, y, r, c) =>
  `<g transform="translate(${x} ${y})" stroke="${c}" stroke-width="2" stroke-linecap="round">${Array.from({ length: 16 }, (_, i) => `<g transform="rotate(${i * 22.5})"><path d="M0 ${-r * 0.4}v${-r * 0.45}"/><circle cy="${-r}" r="1.6" fill="${c}"/></g>`).join('')}</g>`;
const bead = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const leaf = (x, y, angle, c) =>
  `<path transform="translate(${x} ${y}) rotate(${angle})" d="M0 0Q-19-1-21-18Q-3-18 0 0Z" fill="${c}"/>`;
const arch = 'M-69 65V-5Q-68-32-47-36Q-36-55 0-72Q35-56 47-36Q68-32 69-5V65Z';
const gold = '#e4b867',
  light = '#fff0c3',
  green = '#699177',
  pink = '#ce8093';
function motif(id, ink, accent) {
  const archwork = `<path d="${arch}" fill="${ink}" stroke="${gold}" stroke-width="3"/><path d="${arch}" transform="scale(.88)" fill="none" stroke="${gold}" stroke-dasharray="3 3"/>`;
  switch (id) {
    case 'birthday':
      return `<g stroke="#9c5166" stroke-width="1.6"><path d="M-48 40V3q49-13 96 0v37q-45 12-96 0" fill="#df94a2"/><ellipse cy="2" rx="48" ry="11" fill="#ffe8c7"/><path d="M-47 5q8 16 15 3 8 18 16 4 9 16 16 0 10 15 18-1 10 14 16-4 7 10 13-4" fill="#fff1d9"/><path d="M-31-2v-22q31-9 62 0v22q-30 9-62 0" fill="#edb4b6"/><ellipse cy="-24" rx="31" ry="7" fill="#fff4d8"/>${[-17, 0, 17].map((x, i) => `<path d="M${x}-25v-20" stroke="${[green, '#c47c48', '#ad7397'][i]}" stroke-width="5"/><path d="M${x}-46q-6-5 2-13 5 10-2 13" fill="#e7a344" stroke="none"/>`).join('')}<path d="M-60 46q60 16 120 0m-60 9v10m-22 2h44" fill="none" stroke="#867760" stroke-width="4"/></g>`;
    case 'wedding':
      return `${archwork}<g fill="#daaa62" stroke="${light}" stroke-width="1.2"><path d="M-53 56V10h22v46m-18-46q-2-12 7-20 10 8 8 20m39 46V10h26v46m-24-46q-1-13 11-20 12 8 10 20"/><path d="M-28 56V-7h56v63M-30-7q-1-15 15-24Q-6-34 0-45q6 11 15 14Q31-22 30-7Z"/></g><path d="M-13 57V29q0-11 13-18 13 8 13 18v28" fill="${ink}"/><path d="M-56 59H56m-48-95-1-9" stroke="${light}" stroke-width="3"/>`;
    case 'engagement':
      return `<g transform="rotate(-7)"><rect x="-50" y="-51" width="100" height="77" rx="15" fill="${ink}" stroke="${gold}" stroke-width="3"/><rect x="-42" y="-44" width="84" height="60" rx="12" fill="none" stroke="${gold}" opacity=".7"/><path d="m-63 21 15 37q48 11 96-1l15-36Z" fill="#be8284" stroke="${gold}" stroke-width="2"/><ellipse cy="21" rx="61" ry="12" fill="#86525f"/><circle cy="1" r="25" fill="none" stroke="url(#metal)" stroke-width="7"/><path d="m-15-26 8-12H8l9 12L1-10Z" fill="#e6eaf4" stroke="${gold}"/><path d="M-15-26H17M-6-37l7 26 7-26" fill="none" stroke="#a9b8c8"/></g>`;
    case 'anniversary':
      return `<g fill="none" stroke="url(#metal)" stroke-width="7"><ellipse cx="-19" cy="-1" rx="31" ry="42" transform="rotate(-28)"/><ellipse cx="21" cy="1" rx="31" ry="42" transform="rotate(25)"/></g><path d="M-63 6q17 64 86 46" fill="none" stroke="${green}" stroke-width="2"/>${[-49, -33, -14, 8].map((x, i) => leaf(x, [29, 46, 53, 55][i], i * 19, green)).join('')}<g transform="translate(39 38)">${petals(8, 18, pink)}<circle r="4" fill="${gold}"/></g>`;
    case 'diwali':
      return `<g transform="translate(0 4)">${bursts(0, -13, 58, gold)}<path d="M0 3C-26-14 3-35 6-61c22 29 26 53-6 64Z" fill="#f2a438"/><path d="M1 3q-12-13 7-41 12 28-7 41Z" fill="#fff4bc"/><path d="M-63 6q64 19 126 0-11 46-63 52Q-49 47-63 6Z" fill="#a74839" stroke="${gold}" stroke-width="2"/><path d="M-57 12q56 27 114 0m-96 15q39 21 78 0" fill="none" stroke="${gold}" stroke-width="3"/>${[-25, -12, 0, 12, 25].map((x) => bead(x, 44 - Math.abs(x) * 0.22, 2, light)).join('')}</g>`;
    case 'holi':
      return `<g>${Array.from({ length: 76 }, (_, i) => bead(Math.sin(i * 17) * 75, Math.cos(i * 9) * 48 - 10, 1 + (i % 3), ['#d96686', '#65a9a1', '#e2a33c'][i % 3])).join('')}${[
        [-37, 5, '#cd4675'],
        [32, 7, '#389b98'],
        [0, 36, '#f5b13c'],
      ]
        .map(
          ([x, y, c]) =>
            `<g transform="translate(${x} ${y})"><path d="M-35 0q15-16 27-25 8-11 16 0L35 0Z" fill="${c}"/><path d="M-37 0q37 12 74 0-5 25-37 28Q-31 24-37 0" fill="#b87b50" stroke="#f2cc83" stroke-width="2"/><path d="M-31 7q32 13 62 0" fill="none" stroke="#ffdf98"/></g>`,
        )
        .join('')}</g>`;
    case 'raksha-bandhan':
      return `<g transform="rotate(-9)"><path d="M-135 5Q-88-12-42 0t88-2 90 6" fill="none" stroke="#b34536" stroke-width="8"/><path d="M-135 5Q-88-12-42 0t88-2 90 6" fill="none" stroke="${gold}" stroke-width="4" stroke-dasharray="5 4"/>${[-68, -54, 54, 68].map((x) => bead(x, 0, 6, gold)).join('')} ${petals(14, 52, '#cb7556', gold)}${petals(10, 37, gold, light)}<circle r="18" fill="#a94542" stroke="${light}" stroke-width="3"/><path d="m0-11 10 11L0 11-10 0Z" fill="#f2bd83"/></g>`;
    case 'baby-shower':
      return `<g fill="none" stroke="#a48779" stroke-width="3"><path d="M-57 17q20-42 16-72 37 1 48 37" fill="#dbc3c8"/><path d="M-40-53q15 19 20 42m-20-42q29 13 36 34" stroke="#f7e6d9"/><path d="M-57 7H53q-4 39-52 39T-57 7Z" fill="#95b7a9"/><path d="M-51 11q8 12 16 0 8 12 16 0 8 12 16 0 8 12 16 0 8 12 16 0 8 12 16 0" stroke="#fff0db"/><path d="M-30 39l-8 14m64-14 9 14m-92-4q55 31 110-2"/></g>${star(48, -36, 13, gold)}`;
    case 'housewarming':
      return `<path d="M-65 58V-31q66-54 130 0v89Z" fill="#ad7c54" stroke="#e3bf7d" stroke-width="3"/><path d="M-47 56v-78q47-40 94 0v78" fill="#426855" stroke="${light}" stroke-width="2"/><path d="M0-39v95m-40-66h30v24h-30zm50 0h30v24H10zm-50 32h30v27h-30zm50 0h30v27H10z" stroke="#b7b47d" fill="none"/>${bead(-6, 18, 2.4, gold)}${bead(6, 18, 2.4, gold)}<path d="M-65-38q63 30 130 0" fill="none" stroke="${green}" stroke-width="3"/>${Array.from(
        { length: 11 },
        (_, i) => {
          const x = -57 + i * 11.4,
            y = -36 + Math.sin((i * Math.PI) / 10) * 14;
          return leaf(x, y, -110, green) + bead(x + 2, y + 8, 4, '#eab044');
        },
      ).join('')}<path d="M-77 62H77m-86 6h20" stroke="#ab8660" stroke-width="4"/>`;
    case 'festival-party':
      return `<g transform="rotate(-14)"><circle cy="-12" r="44" fill="#9881b2" stroke="#f0c0e6" stroke-width="2"/><g stroke="#f1dae9" opacity=".9" fill="none"><ellipse cy="-12" rx="18" ry="44"/><ellipse cy="-12" rx="35" ry="44"/><path d="M-42-25q42 15 84 0m-83 26q40 13 82 0m-70 17q30 10 59 0m-61-59q34 10 66 0m-32-15v-22"/></g></g>${star(-45, -35, 13, light)}${star(49, -10, 11, '#69dfd1')}<g fill="${accent}">${Array.from({ length: 15 }, (_, i) => `<rect x="${i * 7 - 51}" y="${53 - ((i * 13) % 25)}" width="4" height="${9 + ((i * 13) % 25)}" rx="2"/>`).join('')}</g>`;
    case 'karwa-chauth':
      return `<path d="M-9-58q-32 51 24 62-42 23-59-18-8-29 35-44" fill="url(#metal)"/><g transform="translate(25 6) rotate(-20)"><path d="M0 30v36" stroke="#aa7a46" stroke-width="8"/><circle r="37" fill="#f9d692" fill-opacity=".25" stroke="url(#metal)" stroke-width="6"/><circle r="31" fill="url(#mesh)"/></g>`;
    case 'new-year':
      return `${bursts(-44, -29, 39, '#c3828e')}${bursts(48, -39, 32, gold)}<circle cy="13" r="43" fill="${ink}" stroke="url(#metal)" stroke-width="5"/><g transform="translate(0 13)" stroke="${light}" stroke-linecap="round">${Array.from({ length: 12 }, (_, i) => `<path transform="rotate(${i * 30})" d="M0-35v4"/>`).join('')}<path d="M0-15V0L-11-23" fill="none" stroke-width="3"/></g>`;
    case 'christmas':
      return `<path d="M-7 43H7v20H-7z" fill="#a27751"/><path d="m0-62 36 44H23L48 12H30L62 47q-61 15-124 0l31-35h-17l25-30h-14Z" fill="#46725a" stroke="${gold}" stroke-width="1.5"/><path d="M-21-19q25 17 53 7m-65 20q39 18 76 5m-92 22q42 19 89 10" fill="none" stroke="${gold}" stroke-width="2"/>${[
        [-11, -25],
        [12, -8],
        [-24, 4],
        [22, 16],
        [-30, 32],
        [5, 35],
      ]
        .map(([x, y], i) => bead(x, y, 4, i % 2 ? gold : '#d78180'))
        .join('')}${star(0, -62, 12, light)}`;
    default:
      return '';
  }
}
// The night editions have different subjects, not a dark filter over the signature plate.
function nightMotif(id) {
  const line = `fill="none" stroke="${gold}" stroke-linecap="round" stroke-width="2"`;
  const candle = (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="-28" width="10" height="51" rx="2" fill="${c}"/><path d="M-5-18l10-5m-10 16 10-5m-10 16 10-5m-10 16 10-5" ${line}/><path d="M0-29q-10-8 2-23 10 18-2 23" fill="${light}"/></g>`;
  const diya = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-26 0q25 6 52 0-9 23-26 24Q-19 21-26 0" fill="#cf8351" stroke="${gold}"/><path d="M0-2q-14-10 3-30 10 20-3 30" fill="${light}"/><path d="M-17 30q15 3 31 0m-22 5h10" ${line}/></g>`;
  const crescent = (x, y, r) =>
    `<path transform="translate(${x} ${y}) scale(${r})" fill="url(#metal)" d="M.4-.92A1 1 0 1 0 .85.51 1.03 1.03 0 0 1 .4-.92Z"/>`;
  const flute = (x, a) =>
    `<g transform="translate(${x} 0) rotate(${a})"><path d="M-12-37h24L9-3Q8 12 0 13-9 10-9-2Z" fill="#ffe6a6" fill-opacity=".3" stroke="${gold}" stroke-width="2"/><path d="M-9-14q9-4 18 0L7-1Q4 9 0 10-6 7-7 0Z" fill="${gold}"/><path d="M0 13v25m-12 2h24" ${line}/></g>`;
  switch (id) {
    case 'birthday':
      return `${bursts(-62, -30, 17, '#d9939c')}${bursts(51, -36, 14, gold)}${[
        [-35, 22, 0.7, '#d991a0'],
        [-17, 12, 0.97, '#88b1ab'],
        [0, 5, 1.2, '#d9a05c'],
        [18, 12, 0.97, '#ca88a1'],
        [36, 23, 0.68, '#8ebaa5'],
      ]
        .map((v) => candle(...v))
        .join('')}<path d="M-54 42q53 8 108 0m-88 9h69" ${line}/>`;
    case 'wedding':
      return `${crescent(37, -36, 13)}<path d="M-65 47h130m-122-5V-23m114 65V-23" fill="none" stroke="url(#metal)" stroke-width="5"/><path d="M-69-23q34 0 69-37 36 37 68 37l-8 8H-61Z" fill="#b76575" stroke="${gold}" stroke-width="2"/><path d="M-56-16q3 25 22 29-21 1-23 25zm112 0q-4 25-23 29 19 1 23 25Z" fill="#ca8593" stroke="${gold}"/><path d="M-51-15q25 26 51 0 22 26 50 0" ${line}/>${[-42, -32, -22, -10, 10, 21, 32, 42].map((x) => bead(x, -6 - Math.abs(26 - Math.abs(x)) * 0.35, 2.7, '#f6b94e')).join('')}${diya(0, 33, 0.42)}`;
    case 'engagement':
      return `<g fill="none" stroke="url(#metal)" stroke-width="5"><ellipse cx="-16" cy="7" rx="25" ry="32" transform="rotate(-17)"/><ellipse cx="18" cy="9" rx="27" ry="30" transform="rotate(18)"/></g><path d="m-35-23 9-12h13l7 12-13 14Z" fill="#c9e8e8" stroke="${gold}"/>${star(-44, -32, 8, light)}${star(43, 22, 5, gold)}<path d="m-61-4 9-15 9 6m75-24 13 8 14-16" ${line}/>`;
    case 'anniversary':
      return `<path d="M-62-33q35-9 62 8 27-17 62-8v69q-33-8-62 7-30-15-62-7Z" fill="#cab08a" stroke="${gold}" stroke-width="3"/><path d="M-57-29Q-27-35 0-19V36q-26-14-57-9Zm61 10q25-17 53-11v57q-26-5-53 8Z" fill="#ffebbf"/><path d="M-45 2q14-3 29 3m-29 7q15-3 29 3m29-9q12-7 31-5m-31 14q13-7 31-5" fill="none" stroke="#bd956a" stroke-width="2"/><path d="M-18-16v31l-6-5-6 3v-32Z" fill="#a55762"/>${star(49, -32, 8, light)}`;
    case 'diwali':
      return `<path d="M-72 4q35 6 57 0t73-1M-64 37q39 4 58-1t64 0" stroke="#d4ac6880" fill="none"/>${diya(-48, -9, 0.62)}${diya(47, -11, 0.62)}${diya(0, 13, 1.17)}${star(25, -33, 5, light)}`;
    case 'holi':
      return `<g transform="rotate(-13)"><path d="M-43-19q43-12 88 1v45q-40 13-88-1Z" fill="#ca7163" stroke="${gold}" stroke-width="2"/><ellipse cx="-44" cy="4" rx="9" ry="23" fill="#f4ce9a"/><ellipse cx="44" cy="4" rx="9" ry="23" fill="#e3ba7b"/><path d="m-35-17 9 47 10-50 11 51 12-52 12 49 12-46" fill="none" stroke="${light}" stroke-width="2"/></g><path d="m-18-30 43-21M23-19l39-4" stroke="#e7ab70" stroke-linecap="round" stroke-width="3"/>${bursts(-51, -23, 18, '#d673a0')}${bursts(59, 34, 16, '#5fc4b6')}`;
    case 'raksha-bandhan':
      return `<path d="M-91 3C-50-41-16 52 12 3c17-28-9-44-17-13-11 43 42 37 84-10" fill="none" stroke="#cb775b" stroke-width="8"/><path d="M-91 3C-50-41-16 52 12 3c17-28-9-44-17-13-11 43 42 37 84-10" fill="none" stroke="${gold}" stroke-width="2.8" stroke-dasharray="4 4"/><g transform="translate(-27 7)">${petals(9, 26, gold)}${bead(0, 0, 8, '#bd5554')}</g><g transform="translate(35 17)">${petals(9, 21, '#e6b47c')}${bead(0, 0, 6, '#ba6461')}</g>`;
    case 'baby-shower':
      return `<path d="M-59-28q60-14 119 0m-99-4v27m38-32v24m42-18V7" ${line}/>${crescent(-38, 12, 20)}${star(0, 0, 15, '#e8c990')}${star(42, 18, 14, '#e6b6c2')}<path d="M-21 43q-2-10 7-12 6-13 17-7 8 0 12 9 10-1 12 10Z" fill="#adc2c6"/>`;
    case 'housewarming':
      return `<g transform="rotate(-37)"><circle cx="-26" cy="0" r="20" fill="none" stroke="url(#metal)" stroke-width="7"/><path d="M-5 0h59v15h-8V5H34v12h-7V5H-5Z" fill="url(#metal)"/><path d="M-45-6q-15-10-16 3-1 11 15 2" fill="none" stroke="#cf8996" stroke-width="4"/></g>${leaf(44, 36, 130, green)}${star(29, -34, 9, light)}`;
    case 'festival-party':
      return `<g transform="rotate(-12)"><path d="M-62-31H62v17q-15 11 0 21v22H-62V9q15-11 0-22Z" fill="#734f8e" stroke="#e6a8ce" stroke-width="3"/><path d="M25-29v56" stroke="#e8cba1" stroke-dasharray="3 4"/><path d="m-45 2 9 0 4-13 6 23 6-31 6 33 4-15h11" fill="none" stroke="#8ae6d8" stroke-width="3"/>${[34, 38, 45, 52].map((x, i) => `<path d="M${x}-13v25" stroke="${light}" stroke-width="${(i % 3) + 1}"/>`).join('')}</g>${star(-54, -34, 7, light)}`;
    case 'karwa-chauth':
      return `${crescent(15, -20, 29)}<path d="M-69 30q27-17 48-32 18 13 25 21 9-4 20-11 20 9 47 22Z" fill="#8d627e"/><path d="M-72 33q49 9 144 0m-116 10q28-6 68 0m-47 5h31" ${line}/>`;
    case 'new-year':
      return `${bursts(-46, -32, 19, '#cb90aa')}${bursts(47, -30, 17, gold)}${flute(-19, 16)}${flute(18, -16)}${star(0, -38, 7, light)}`;
    case 'christmas':
      return `<path d="M-62-39q55-4 126 15" stroke="#8aa589" stroke-width="3" fill="none"/>${[-34, -14, 9, 31, 47].map((x, i) => leaf(x, -36 + i * 2.5, 130 + i * 6, green)).join('')}<path d="M-23-36v28m49-21V4" ${line}/><circle cx="-23" cy="12" r="23" fill="#b65e64" stroke="${gold}" stroke-width="2"/><circle cx="26" cy="22" r="17" fill="#578c7b" stroke="${gold}" stroke-width="2"/><path d="m-42 7 8 5 8-7 8 8 8-6m22 12q14 8 26 0" ${line}/>${star(-24, 15, 9, light)}`;
    default:
      return '';
  }
}

const cache = new Map();
export function plate(id, edition, colors) {
  const key = id + '/' + edition;
  if (cache.has(key)) return cache.get(key);
  const [ink, paper, accent, dark] = colors;
  const jewel = ['wedding', 'diwali', 'festival-party', 'new-year', 'karwa-chauth'].includes(id),
    night = edition === 'nocturne',
    folio = edition === 'folio',
    deep = night || (jewel && !folio);
  const bg = deep ? dark : paper,
    detail = deep ? gold : accent;
  const surround = [...Array(22)]
    .map((_, i) => {
      const x = (i * 83 + 11) % 477,
        y = (i * 53 + 19) % 251;
      return i % 3 ? bead(x, y, 1.6, detail) : star(x, y, 3 + (i % 4), detail);
    })
    .join('');
  const border =
    id === 'birthday' || id === 'baby-shower'
      ? `<path d="M0 12${'q12 21 24 0'.repeat(21)}" stroke="${detail}" fill="none"/>`
      : id === 'festival-party'
        ? `<path d="M0 222h480m-480-9h480m-480-10h480" stroke="${accent}" opacity=".5"/>`
        : `<rect x="12" y="12" width="456" height="236" rx="3" fill="none" stroke="${detail}"/><rect x="17" y="17" width="446" height="226" fill="none" stroke="${detail}" stroke-dasharray="1 6"/>`;
  const framing = folio
    ? `<g transform="rotate(-6 240 130)"><rect x="69" y="32" width="346" height="197" fill="#6e4439" opacity=".17"/><rect x="65" y="26" width="346" height="197" fill="#fff2d8" stroke="${detail}"/><path d="M88 140h102m-102 16h83m-83 16h92" stroke="${ink}" opacity=".4"/><circle cx="107" cy="74" r="18" fill="none" stroke="${detail}"/><path d="M82 66q25 12 52 0m-52 8q25 12 52 0" fill="none" stroke="${detail}"/></g>`
    : night
      ? `<g fill="none" stroke="${gold}" opacity=".52"><path d="M83 239V115Q97 50 240 17q140 33 157 98v124Z"/><circle cx="240" cy="134" r="89" stroke-dasharray="1 5"/></g>`
      : `<circle cx="240" cy="132" r="93" fill="${detail}" opacity=".09"/><circle cx="240" cy="132" r="95" fill="none" stroke="${detail}" stroke-dasharray="1 7" opacity=".7"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 260"><defs><linearGradient id="metal" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#ab7940"/><stop offset=".46" stop-color="#ffdf8b"/><stop offset="1" stop-color="#bd904e"/></linearGradient><pattern id="mesh" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0l7 7m0-7L0 7" stroke="${gold}" stroke-width=".6"/></pattern><pattern id="grain" width="8" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="3" r=".65" fill="${detail}" opacity=".29"/></pattern></defs><rect width="480" height="260" fill="${bg}"/><rect width="480" height="260" fill="url(#grain)"/>${border}<g opacity=".65">${surround}</g>${framing}<g transform="translate(${folio ? '282 130' : '240 130'}) scale(${folio ? '1.07' : night ? '1.27' : '1.4'})">${night ? nightMotif(id) : motif(id, ink, accent)}</g></svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, '%27');
  cache.set(key, url);
  return url;
}
