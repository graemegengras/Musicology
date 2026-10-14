import { describe, expect, it } from 'vitest';
import {
  albumFromGroup,
  albumOverlap,
  artistLinks,
  creditsFromReleases,
  isTechnicalRole,
  looseTitle,
  matchAlbums,
  nameMatches,
  normalize,
  normalizeTitle,
  splitArtistNames,
  type MbArtist,
  type MbRelation,
  type MbRelease,
  type MbReleaseGroup,
} from '../src/lib/mb';

// Fixtures are trimmed from real MusicBrainz responses (cached by scripts/build-graph.ts).
const DANGELO = { id: 'b66771cc-45fa-4a32-b14f-5337d7223d7a', name: 'D’Angelo', type: 'Person' };
const PINO = { id: '0dfd6aab-9056-4764-89b0-80bee7c9f998', name: 'Pino Palladino', type: 'Person' };
const QUESTLOVE = { id: '9436fbf8-5498-43e9-9a8d-eccbe53df6ad', name: '?uestlove', type: 'Person' };
const HARGROVE = { id: '8cdf780e-b909-4d25-9060-e552e95b3414', name: 'Roy Hargrove', type: 'Person' };
const ELEVADO = { id: 'b8108fbd-14ef-4811-9bec-d952897be6c6', name: 'Russell Elevado', type: 'Person' };
const SAADIQ = { id: 'a2eb319d-a45e-43c3-bb14-d0ffb577222c', name: 'Raphael Saadiq', type: 'Person' };
const REDMAN_METH = { id: 'c03e2388-9e1b-4b78-8194-28c0d6ca19a0', name: 'Redman & Method Man', type: 'Group' };

const rel = (type: string, artist: typeof PINO, attributes: string[] = []): MbRelation => ({
  type,
  direction: 'backward',
  'target-type': 'artist',
  attributes,
  artist,
});

describe('normalize / normalizeTitle', () => {
  it('folds accents, curly quotes, "the" and "&"', () => {
    expect(normalize('D’Angelo')).toBe(normalize("D'Angelo"));
    expect(normalize('The Notorious B.I.G.')).toBe(normalize('Notorious B.I.G'));
    expect(normalize('Sly & The Family Stone')).toBe('sly and the family stone');
    expect(normalize('João Gilberto')).toBe('joao gilberto');
  });

  it('strips streaming-service suffixes and edition tags', () => {
    expect(normalizeTitle("You're Dead! (Deluxe Edition)")).toBe(normalizeTitle('You’re Dead!'));
    expect(normalizeTitle('Black Gold / Between Memories - EP')).toBe(normalizeTitle('Black Gold / Between Memories'));
    expect(normalizeTitle('Kind of Blue (Legacy Edition)')).toBe('kind of blue');
    expect(normalizeTitle('Abbey Road (Remastered 2009)')).toBe('abbey road');
    expect(normalizeTitle('Abbey Road [2019 Mix] - Remastered')).toBe('abbey road 2019 mix');
    expect(normalizeTitle('I Found My Smile Again - Single')).toBe('i found my smile again');
    expect(normalizeTitle('Reset EP')).toBe(normalizeTitle('Reset'));
    expect(normalizeTitle('Old.Klouds.LP')).toBe('old klouds');
  });

  it('folds volume and part spellings', () => {
    expect(normalizeTitle('The Do-Over Vol.1')).toBe(normalizeTitle('Do-Over, Volume 1'));
    expect(normalizeTitle('Hexual.Sealings.Prt.5')).toBe(normalizeTitle('Hexual Sealings Part 5'));
  });

  it("reads Knxwledge's ∆ as an A", () => {
    expect(normalizeTitle('SKR∆WBERRiES')).toBe(normalizeTitle('SKRAWBERRiES.'));
  });

  it('loose keys drop subtitles, brackets and spacing', () => {
    expect(looseTitle('HexualSealings.Prt.7')).toBe(looseTitle('Hexual.Sealings.Prt.7'));
    expect(looseTitle('Yasuke (Music from the Netflix Original Anime Series)')).toBe(looseTitle('Yasuke'));
    expect(looseTitle('Flying Lotus Presents: Music From the Hit Game Show')).toBe('flyinglotuspresents');
  });
});

describe('album matching', () => {
  const groups: MbReleaseGroup[] = [
    { id: 'single', title: 'Voodoo', 'primary-type': 'Single', 'first-release-date': '2000-01-01' },
    { id: 'album', title: 'Voodoo', 'primary-type': 'Album', 'first-release-date': '2000-01-25' },
    { id: 'comp', title: 'Voodoo', 'primary-type': 'Album', 'secondary-types': ['Compilation'] },
    { id: 'bs', title: 'Brown Sugar', 'primary-type': 'Album', 'first-release-date': '1995-07-03' },
    { id: 'yasuke', title: 'Yasuke (Music from the Netflix Original Anime Series)', 'primary-type': 'Album' },
  ];

  it('prefers the studio album over a same-named single or compilation', () => {
    expect(matchAlbums(['Voodoo'], groups).get('Voodoo')?.id).toBe('album');
  });

  it('falls back to the loose key', () => {
    const m = matchAlbums(['Brown Sugar (Deluxe Edition)', 'Yasuke', 'Live at the Cirkus'], groups);
    expect(m.get('Brown Sugar (Deluxe Edition)')?.id).toBe('bs');
    expect(m.get('Yasuke')?.id).toBe('yasuke');
    expect(m.has('Live at the Cirkus')).toBe(false);
    expect(albumOverlap(['Brown Sugar (Deluxe Edition)', 'Yasuke', 'Live at the Cirkus'], groups)).toBe(2);
  });

  it('albumFromGroup flags secondary types', () => {
    expect(albumFromGroup(groups[2])).toMatchObject({ id: 'comp', type: 'Compilation', by: [] });
    expect(albumFromGroup(groups[3])).toMatchObject({ type: 'Album', year: 1995 });
  });
});

describe('artist resolution helpers', () => {
  // From /artist?query=artist:"D'Angelo"
  const search: MbArtist[] = [
    { id: DANGELO.id, name: 'D’Angelo', score: 100, disambiguation: 'US soul singer, songwriter & producer' },
    { id: 'nino', name: 'Nino D’Angelo', score: 89 },
    { id: 'br', name: 'D’angelo', score: 79, disambiguation: 'Brazilian jazz/samba group' },
    { id: 'alias', name: 'Michael Archer', score: 85, aliases: [{ name: "D'Angelo" }] },
  ];

  it('keeps exact name or alias matches with a decent score', () => {
    expect(nameMatches(search, "D'Angelo").map((a) => a.id)).toEqual([DANGELO.id, 'alias']);
  });

  it('splits joint billings but not single names', () => {
    expect(splitArtistNames('Freddie Gibbs & Madlib')).toEqual(['Freddie Gibbs', 'Madlib']);
    expect(splitArtistNames('João Gilberto; Stan Getz')).toEqual(['João Gilberto', 'Stan Getz']);
    expect(splitArtistNames('Danny Grissett, Walter Smith III, Vicente Archer & Bill Stewart')).toHaveLength(4);
    expect(splitArtistNames('Knxwledge')).toEqual([]);
  });
});

describe('artistLinks', () => {
  // Trimmed from /artist/f5535b25-…?inc=artist-rels (Karriem Riggins) plus Flying Lotus and G. Love.
  const karriem: MbArtist = {
    id: 'f5535b25-11fb-429c-8589-417ded07caf7',
    name: 'Karriem Riggins',
    relations: [
      { type: 'instrumental supporting musician', direction: 'forward', 'target-type': 'artist', attributes: ['drums (drum set)'], artist: { id: 'c0a1179b-b14a-4d68-a3c1-1fdab16ed602', name: 'Common', type: 'Person' } },
      { type: 'member of band', direction: 'forward', 'target-type': 'artist', attributes: [], artist: { id: 'f0d7c0f3-5caf-4c38-9809-df6a72c8f0f0', name: 'August Greene', type: 'Group' } },
      { type: 'parent', direction: 'backward', 'target-type': 'artist', attributes: [], artist: { id: 'cc0e9881-af76-4d4d-a1d8-a64cd1638a15', name: 'Emmanuel Riggins', type: 'Person' } },
      { type: 'member of band', direction: 'forward', 'target-type': 'artist', attributes: ['eponymous'], artist: { id: 'krt', name: 'Karriem Riggins Trio', type: 'Group' } },
      { type: 'allmusic', direction: 'forward', 'target-type': 'url', url: { resource: 'https://www.allmusic.com/artist/mn0000176820' } },
      { type: 'tribute', direction: 'forward', 'target-type': 'artist', artist: { id: 'x', name: 'Someone' } },
    ],
  };

  it('labels memberships, support work and family from this artist’s side', () => {
    const links = artistLinks(karriem);
    expect(links.map((l) => [l.other.name, l.kind, l.label])).toEqual([
      ['Common', 'support', 'drums for'],
      ['August Greene', 'member', 'member of'],
      ['Emmanuel Riggins', 'family', 'child of'],
      ['Karriem Riggins Trio', 'member', 'member of'],
    ]);
  });

  it('reads "is person" the right way round', () => {
    const flylo: MbArtist = {
      id: 'fc7376fe-1a6f-4414-b4a7-83f50ed59c92',
      name: 'Flying Lotus',
      relations: [{ type: 'is person', direction: 'backward', 'target-type': 'artist', attributes: [], artist: { id: '87b72fc9-3a4d-4e8d-90c0-cdb22dce0266', name: 'Steven Ellison', type: 'Person' } }],
    };
    expect(artistLinks(flylo)[0]).toMatchObject({ kind: 'collab', label: 'also known as' });
    const ellison: MbArtist = { id: 'se', name: 'Steven Ellison', relations: [{ ...flylo.relations![0], direction: 'forward', artist: { id: flylo.id, name: 'Flying Lotus' } }] };
    expect(artistLinks(ellison)[0].label).toBe('performs as');
  });
});

describe('creditsFromReleases', () => {
  // Trimmed from /release?release-group=…(Voodoo)&inc=artist-rels+recordings+recording-level-rels+artist-credits
  const voodoo: MbRelease[] = [
    {
      id: '249cd5d6-b56e-43c4-82b0-d1923fd202b0',
      title: 'Voodoo',
      'artist-credit': [{ name: 'D’Angelo', artist: DANGELO }],
      relations: [
        { ...rel('mastering', { id: 'tc', name: 'Tom Coyne', type: 'Person' }), direction: 'backward' },
        rel('producer', { id: 'exec', name: 'Label Boss', type: 'Person' }, ['executive']),
        rel('design/illustration', { id: 'art', name: 'Art Person', type: 'Person' }),
      ],
      media: [
        {
          tracks: [
            {
              title: 'Left & Right',
              recording: {
                id: 'r1',
                title: 'Left & Right',
                'artist-credit': [
                  { name: 'D’Angelo', joinphrase: ' feat. ', artist: DANGELO },
                  { name: 'Redman & Method Man', artist: REDMAN_METH },
                ],
                relations: [rel('producer', DANGELO), rel('instrument', QUESTLOVE, ['drums (drum set)'])],
              },
            },
            {
              title: 'Send It On',
              recording: {
                id: 'r2',
                title: 'Send It On',
                'artist-credit': [{ name: 'D’Angelo', artist: DANGELO }],
                relations: [
                  rel('producer', DANGELO),
                  rel('instrument', HARGROVE, ['flugelhorn', 'trumpet']),
                  rel('instrument', PINO, ['bass guitar']),
                  rel('instrument', QUESTLOVE, ['drums (drum set)']),
                  rel('mix', ELEVADO),
                  rel('engineer', { id: 'asst', name: 'Second Engineer', type: 'Person' }, ['assistant']),
                ],
              },
            },
            {
              title: 'Untitled (How Does It Feel)',
              recording: {
                id: 'r3',
                title: 'Untitled (How Does It Feel)',
                'artist-credit': [{ name: 'D’Angelo', artist: DANGELO }],
                relations: [rel('instrument', SAADIQ, ['bass guitar', 'guitar']), rel('instrument', SAADIQ, ['guitar']), rel('producer', SAADIQ)],
              },
            },
          ],
        },
      ],
    },
    // A second release of the same album repeats a track: tracks are counted once.
    {
      id: 'reissue',
      title: 'Voodoo',
      'artist-credit': [{ name: 'D’Angelo', artist: DANGELO }],
      media: [{ tracks: [{ title: 'Send It On', recording: { id: 'r2b', title: 'Send It On', relations: [rel('instrument', PINO, ['bass guitar'])] } }] }],
    },
  ];
  const credits = creditsFromReleases(voodoo);
  const by = (name: string) => credits.find((c) => c.artist.name === name);

  it('collects personnel with readable roles and track counts', () => {
    expect(by('?uestlove')).toMatchObject({ roles: ['drums'], tracks: 2 });
    expect(by('Pino Palladino')).toMatchObject({ roles: ['bass'], tracks: 1 });
    expect(by('Roy Hargrove')?.roles).toEqual(['flugelhorn', 'trumpet']);
    expect(by('Raphael Saadiq')?.roles).toEqual(['bass', 'guitar', 'producer']);
    expect(by('Tom Coyne')).toMatchObject({ roles: ['mastering'], tracks: 0 });
    expect(by('Russell Elevado')?.roles).toEqual(['mixing']);
  });

  it('marks featured track artists but not the album artist', () => {
    expect(by('Redman & Method Man')).toMatchObject({ roles: ['featured'], tracks: 1 });
    expect(by('D’Angelo')?.roles).toEqual(['producer']);
  });

  it('drops assistants, executive producers and artwork', () => {
    expect(by('Second Engineer')).toBeUndefined();
    expect(by('Label Boss')).toBeUndefined();
    expect(by('Art Person')).toBeUndefined();
  });

  it('sorts by track count', () => {
    expect(credits[0].tracks).toBeGreaterThanOrEqual(credits[credits.length - 1].tracks);
  });

  it('flags studio roles as technical', () => {
    expect(['mixing', 'mastering', 'recording', 'engineer'].every(isTechnicalRole)).toBe(true);
    expect(['drums', 'producer', 'featured'].some(isTechnicalRole)).toBe(false);
  });
});
