// A guest link addresses a print by its stable code. Keep these v1 recipes (and
// the 39 original catalog plates) available, even if the shelf is reordered later.
// Palette entries: display name, ink, paper, accent and night stock.
const inks = {
  rosewater: ['Rosewater', '#803f56', '#fff0ed', '#c9737f', '#452237'],
  malachite: ['Malachite', '#285c49', '#f0f5df', '#81a356', '#1a3a31'],
  amber: ['Amber', '#804726', '#fff2d4', '#db9c41', '#4a3025'],
  lapis: ['Lapis', '#30497a', '#eff3fc', '#748fc4', '#222d50'],
  terracotta: ['Terracotta', '#893e30', '#fbeddf', '#c47d50', '#4d2926'],
  orchid: ['Orchid', '#70427c', '#f7edfa', '#b18cba', '#3b2749'],
  lagoon: ['Lagoon', '#23656b', '#e7f5f2', '#68aba9', '#193e49'],
  fig: ['Fig', '#714057', '#f8ede8', '#ab895e', '#452d40'],
  graphite: ['Graphite', '#43464a', '#f5f3eb', '#94927c', '#292c35'],
  citron: ['Citron', '#60652a', '#f9f5d6', '#a8ac4b', '#353e2a'],
};
// Each press has its own plate composition, book layout, lettering and reveal.
const presses = [
  ['cameo', 'Cameo engraving', 'signature', 'serif', '', 'chimes'],
  ['post', 'Postal stationery', 'folio', 'hand', 'envelope', 'none'],
  ['orbit', 'Celestial chart', 'nocturne', 'sans', '', 'chimes'],
  ['ribbon', 'Ribbon binding', 'folio', 'serif', 'gift', 'festive'],
  ['garden', 'Botanical border', 'signature', 'hand', '', 'chimes'],
  ['arcade', 'Deco pavilion', 'nocturne', 'serif', '', 'festive'],
  ['quilt', 'Block-printed quilt', 'signature', 'sans', 'gift', 'none'],
  ['gallery', 'Gallery mount', 'folio', 'sans', 'envelope', 'none'],
  ['pennant', 'Festival pennants', 'signature', 'hand', 'confetti', 'festive'],
  ['horizon', 'Landscape cut-paper', 'nocturne', 'serif', '', 'chimes'],
];
const titles = {
  birthday: [
    'Cake Cameo',
    'Birthday Dispatch',
    'Candle Constellation',
    'A Wrapped Wish',
    'Garden Party',
    'Birthday Ballroom',
    'Sprinkle Quilt',
    'The Cake Gallery',
    'Party Parade',
    'Birthday Afterglow',
  ],
  wedding: [
    'Heirloom Vows',
    'Wedding Correspondence',
    'Written in the Stars',
    'Silk Gathbandhan',
    'Jasmine Courtyard',
    'The Wedding Pavilion',
    'Brocade Vows',
    'Portrait of Two',
    'Baraat Bunting',
    'Dusk at the Mandap',
  ],
  engagement: [
    'Betrothal Cameo',
    'A Promise by Post',
    'Orbit of Two',
    'Tied Together',
    'Proposal Garden',
    'The Ring Salon',
    'Woven Promises',
    'Jeweller’s Showcase',
    'Engagement Fête',
    'A New Horizon',
  ],
  anniversary: [
    'Keepsake Cameo',
    'Letters Through Time',
    'Our Constellation',
    'Anniversary Ribbon',
    'The Perennial Garden',
    'Jubilee Ballroom',
    'Memory Quilt',
    'The Anniversary Archive',
    'Years of Joy',
    'Still Together',
  ],
  diwali: [
    'The Lamp Medallion',
    'Diwali Post',
    'Kartik Sky',
    'A Box of Mithai',
    'Marigold Veranda',
    'Diya Arcade',
    'Rangoli Blocks',
    'The Lamp Gallery',
    'Lantern Mela',
    'Lamps at Dusk',
  ],
  holi: [
    'Gulal Cameo',
    'Festival Colours by Post',
    'Rang Under Stars',
    'Gulal Parcels',
    'Palash Garden',
    'The Rang Pavilion',
    'Colour Blocks',
    'Pigment Studies',
    'Phagun Mela',
    'Holi Sunset',
  ],
  'raksha-bandhan': [
    'Rakhi Medallion',
    'Sibling Post',
    'Our Childhood Stars',
    'The Knotted Thread',
    'Jasmine Rakhi',
    'The Thread Pavilion',
    'Woven Memories',
    'Threads on Display',
    'Rakhi Fair',
    'Across the Miles',
  ],
  'baby-shower': [
    'Little Cameo',
    'Stork Post',
    'Cradle Constellation',
    'A Tiny Bow',
    'The Nursery Garden',
    'Cradle Canopy',
    'First Quilt',
    'The Nursery Print',
    'Welcome Bunting',
    'Sweet Dreams',
  ],
  housewarming: [
    'Doorstep Cameo',
    'Our New Address',
    'Stars Above Home',
    'Keys on a Ribbon',
    'Mango Leaf Garden',
    'Welcome Arch',
    'Courtyard Tiles',
    'The House Portrait',
    'Neighbourhood Fête',
    'Lights at Home',
  ],
  'festival-party': [
    'Disco Cameo',
    'The Guest Pass',
    'Dancefloor Orbit',
    'Backstage Ribbon',
    'Garden Sessions',
    'Neon Arcade',
    'The Remix Quilt',
    'The Poster Room',
    'Carnival Parade',
    'Last Light Set',
  ],
  'karwa-chauth': [
    'Moon Cameo',
    'Moonrise Letter',
    'Lunar Chart',
    'Silken Vrat',
    'Henna Garden',
    'The Moon Pavilion',
    'Mehendi Blocks',
    'Moonlit Portrait',
    'Courtyard Garlands',
    'Moonrise Vista',
  ],
  'new-year': [
    'Clock Cameo',
    'January Dispatch',
    'Midnight Sky',
    'A New Beginning',
    'Winter Garden',
    'Countdown Ballroom',
    'Calendar Quilt',
    'Year in Pictures',
    'Midnight Parade',
    'First Light',
  ],
  christmas: [
    'Holly Cameo',
    'December Post',
    'Christmas Star',
    'Ribbon and Pine',
    'Winter Wreath',
    'Carol Pavilion',
    'Christmas Patchwork',
    'Ornament Studies',
    'Market Garlands',
    'Christmas Eve',
  ],
};

export function editionsV1(seed) {
  const templates = [...seed.templates],
    palettes = { ...seed.palettes };
  const stocks = Object.entries(inks);
  for (const [key, colors] of stocks) palettes['press-' + key] = colors;
  for (const e of seed.occasions) {
    // Interleave presses and inkways, so even the first page samples the range.
    for (let run = 0; run < stocks.length; run++) {
      presses.forEach(([print, caption, edition, font, reveal, music], i) => {
        const [ink, colors] = stocks[(run + i) % stocks.length];
        // The original signature, folio and nocturne occupy the first three slots.
        if (ink === 'rosewater' && i < 3) return;
        const palette = 'press-' + ink;
        templates.push({
          code: `${e.id}-v1-${print}-${ink}`,
          name: `${titles[e.id][i]} · ${colors[0]}`,
          occasion: e.id,
          art: e.id,
          collection: e.group,
          print,
          edition,
          caption,
          palette,
          opening: reveal || e.opening,
          font,
          music,
        });
      });
    }
  }
  return { ...seed, templates, palettes };
}
