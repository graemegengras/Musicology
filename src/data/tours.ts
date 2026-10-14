import type { Tour } from './types';

export const TOURS: Tour[] = [
  {
    id: 'blues-roots',
    title: 'Roots of the Blues',
    blurb: 'Follow a musical idea from West Africa to a Chicago amplifier.',
    steps: [
      { eraId: 'west-africa', note: 'Start here: call-and-response, polyrhythm, and bent "blue" notes all travel across the Atlantic.' },
      { eraId: 'spirituals', note: 'Under slavery, those traditions merge with Christian hymnody into spirituals.' },
      { eraId: 'delta-blues', note: 'In the Delta, a solo singer with a guitar turns them into the blues.' },
      { eraId: 'chicago-blues', note: 'The Great Migration moves the blues north, and it gets electric.' },
      { eraId: 'rock-and-roll', note: 'Add a backbeat and teenagers with radios, and you get rock & roll.' },
    ],
  },
  {
    id: 'jazz-steps',
    title: 'Jazz in Six Steps',
    blurb: 'From piano rolls to total freedom in about 65 years.',
    steps: [
      { eraId: 'ragtime', note: 'Syncopation over a march bass. Listen for the "ragged" right hand.' },
      { eraId: 'new-orleans-jazz', note: 'Improvisation arrives. Armstrong’s opening cadenza on "West End Blues" changed everything.' },
      { eraId: 'swing', note: 'Jazz becomes America’s dance music, and its pop music.' },
      { eraId: 'bebop', note: 'Musicians take it back: faster, harder, made for listening.' },
      { eraId: 'modal-jazz', note: 'Slow down and float on a single scale. "So What" stays on two chords.' },
      { eraId: 'free-jazz', note: 'Then drop the rules entirely.' },
    ],
  },
  {
    id: 'machines',
    title: 'Machines That Make Music',
    blurb: 'How recording technology became an instrument in its own right.',
    steps: [
      { eraId: 'phonautograph', note: 'The first recording ever made could not be played back for 148 years.' },
      { eraId: 'cylinders', note: 'Edison makes sound repeatable, and music becomes a product.' },
      { eraId: 'magnetic-tape', note: 'Tape can be cut and spliced, so sound becomes editable.' },
      { eraId: 'musique-concrete', note: 'Composers make music out of the recordings themselves.' },
      { eraId: 'synthesizer', note: 'Electricity becomes the sound source.' },
      { eraId: 'krautrock', note: 'Kraftwerk imagines music made by machines.' },
      { eraId: 'drum-machines', note: 'Cheap boxes from Japan reshape popular music.' },
      { eraId: 'detroit-techno', note: 'Detroit answers Düsseldorf.' },
    ],
  },
  {
    id: 'bronx',
    title: 'The Bronx and Beyond',
    blurb: 'Hip-hop’s family tree, from James Brown’s drummer to Houston cassettes.',
    steps: [
      { eraId: 'funk', note: 'The raw material: funk records with long drum breaks.' },
      { eraId: 'jamaica', note: 'The method: Jamaican sound systems, toasting over riddims, and the dub remix.' },
      { eraId: 'block-parties', note: 'Kool Herc combines the two in the Bronx. None of it is on Spotify, because none of it was released.' },
      { eraId: 'old-school', note: 'Six years later, rap finally reaches vinyl.' },
      { eraId: 'golden-age', note: 'Samplers turn producers into collage artists.' },
      { eraId: 'chopped-screwed', note: 'Houston slows it all down, on tapes sold out of a house.' },
    ],
  },
  {
    id: 'off-the-grid',
    title: 'Off the Grid',
    blurb: 'Crucial music you won’t find on Spotify, and where to hear it instead.',
    steps: [
      { eraId: 'phonautograph', note: 'A voice recorded in 1860, rediscovered in an archive and first heard in 2008.' },
      { eraId: 'cylinders', note: 'Tens of thousands of early recordings live in free library archives.' },
      { eraId: 'new-orleans-jazz', note: 'Buddy Bolden, the first jazz star, was never recorded at all.' },
      { eraId: 'field-recordings', note: 'Alan Lomax’s archive has 17,000 recordings, and most aren’t on any streaming service.' },
      { eraId: 'jamaica', note: 'Dubplates were cut for one sound system only, never for sale.' },
      { eraId: 'block-parties', note: 'Hip-hop’s first six years survive only on party tapes.' },
      { eraId: 'chopped-screwed', note: 'Hundreds of DJ Screw tapes are still unreleased.' },
    ],
  },
  {
    id: 'bach-to-reich',
    title: 'From Bach to Reich',
    blurb: 'Three and a half centuries of European concert music, and how it came back to the pulse.',
    steps: [
      { eraId: 'baroque', note: 'A bass line drives everything, and opera and the concerto appear.' },
      { eraId: 'classical', note: 'Elegant architecture: sonata form.' },
      { eraId: 'romantic', note: 'Emotion, the virtuoso, and the giant orchestra.' },
      { eraId: 'modernism', note: 'The rules break.' },
      { eraId: 'minimalism', note: 'Then a return to pulse, by way of Ghana and Coltrane.' },
    ],
  },
];
