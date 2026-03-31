export type StopType =
  | 'nature'
  | 'food'
  | 'kitsch'
  | 'art'
  | 'history'
  | 'scenic'
  | 'activity'
  | 'rest';

export type TripStop = {
  // Identity
  id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  type: StopType;
  arrivalRadiusMeters: number;
  revealEmoji: string;

  // Reveal content
  hook: string;
  whatToDo: string[];
  proTips: string[];
  context: string;

  // Practical strip
  estimatedDurationMinutes: number;
  suggestedDuration: string;
  costNote: string;
  hoursToday: string;

  // Conditional (show only when present)
  whatToOrder?: string | null;
  photoTips?: string | null;
  parkingNotes?: string | null;
  safetyNotes?: string | null;
};

export type TripDay = {
  id: string;
  label: string;
  stops: TripStop[];
};

export type TripFamily = {
  id: string;
  name: string;
  days: TripDay[];
};

export const TRIPS: {families: TripFamily[]} = {
  families: [
    {
      id: 'fords',
      name: 'The Fords',
      days: [
        {
          id: 'fords-day1',
          label: 'Nashville → St. Louis',
          stops: [
            {
              id: 'fords-day1-stop1',
              name: 'TBD Ford Stop 1',
              subtitle: 'TBD',
              revealEmoji: '📍',
              hook: 'TBD — hook goes here.',
              whatToDo: ['TBD — action steps go here.'],
              proTips: ['TBD — pro tips go here.'],
              context: 'TBD — context goes here.',
              latitude: 36.1627,
              longitude: -86.7816,
              type: 'scenic',
              estimatedDurationMinutes: 20,
              arrivalRadiusMeters: 200,
              suggestedDuration: '20 min',
              costNote: 'TBD',
              hoursToday: 'TBD',
            },
          ],
        },
      ],
    },
    {
      id: 'billings',
      name: 'The Billings',
      days: [
        {
          id: 'billings-day1',
          label: 'Kemmerer → Cody',
          stops: [
            {
              id: 'farson-mercantile',
              name: 'Farson Mercantile',
              subtitle: 'Home of the Big Cone',
              revealEmoji: '🍦',
              hook: "A gas station in remote Wyoming serving absurdly huge scoops — the 'baby' is bigger than most larges.",
              whatToDo: [
                'Order at the back counter and start with the baby cone.',
                'Try huckleberry or maple walnut.',
                'Browse local gifts and honey while you eat.',
              ],
              proTips: [
                'Half-scoop is enough for two people.',
                'Great backup for sandwiches/pizza if you need real food.',
              ],
              context: 'A century-old crossroads stop that has become a regional road-trip institution.',
              latitude: 42.1109,
              longitude: -109.442,
              type: 'food',
              estimatedDurationMinutes: 25,
              arrivalRadiusMeters: 220,
              suggestedDuration: '20–25 min',
              costNote: '~$5–8',
              hoursToday: '9:00 AM – 9:00 PM',
              whatToOrder: 'Baby cone (huckleberry)',
              photoTips: 'Cone + Home of the Big Cone sign.',
              parkingNotes: 'Front lot, easy pull-in.',
            },
            {
              id: 'maven-optics',
              name: 'Maven Optics',
              subtitle: 'Built in Lander',
              revealEmoji: '🔭',
              hook: 'A premium optics brand built and shipped from this small Wyoming town.',
              whatToDo: [
                'Browse binoculars, spotting scopes, and sunglasses.',
                'Ask about custom options and direct-buy perks.',
              ],
              proTips: ['Strong quality/value rep; ideal stop if anyone is shopping gear.'],
              context: 'Founded in Lander, Maven runs a direct model from this location.',
              latitude: 42.838,
              longitude: -108.7167,
              type: 'activity',
              estimatedDurationMinutes: 60,
              arrivalRadiusMeters: 200,
              suggestedDuration: '30–60 min',
              costNote: 'Free to browse',
              hoursToday: '8:00 AM – 5:00 PM',
              parkingNotes: 'On-site lot.',
            },
            {
              id: 'lander-bar-coalter-block',
              name: 'Lander Bar & Coalter Block',
              subtitle: 'Saloon Since 1907',
              revealEmoji: '🍺',
              hook: 'Historic saloon-era building with original tin ceilings and true Wyoming character.',
              whatToDo: [
                'Grab lunch and check the old interior details.',
                'Try a local draft if desired.',
              ],
              proTips: ['Atmosphere > fancy menu. Keep it simple and quick for timing.'],
              context: 'A long-running Lander anchor that evolved from saloon/hotel roots.',
              latitude: 42.8325,
              longitude: -108.7276,
              type: 'food',
              estimatedDurationMinutes: 45,
              arrivalRadiusMeters: 180,
              suggestedDuration: '40–50 min',
              costNote: '~$15–25/person',
              hoursToday: '11:00 AM – 2:00 AM',
              whatToOrder: 'Burger or sourdough pizza.',
              parkingNotes: 'Street parking.',
            },
            {
              id: 'sinks-canyon',
              name: 'Sinks Canyon State Park',
              subtitle: 'The Disappearing River',
              revealEmoji: '🌊',
              hook: 'A river that disappears into limestone and reappears downstream in a trout-filled rise.',
              whatToDo: [
                'Visit both the Sinks and the Rise overlooks.',
                'Feed trout at the Rise (bring quarters).',
              ],
              proTips: ['Road can be slick in early spring; wear good shoes at overlooks.'],
              context: 'One of Wyoming’s most famous geology oddities, with decades of dye-test study.',
              latitude: 42.747,
              longitude: -108.8132,
              type: 'nature',
              estimatedDurationMinutes: 30,
              arrivalRadiusMeters: 240,
              suggestedDuration: '20–30 min',
              costNote: 'Free',
              hoursToday: 'Dawn to dusk',
              safetyNotes: 'Watch for icy/slippery surfaces.',
            },
            {
              id: 'wind-river-heritage-center',
              name: 'Wind River Heritage Center',
              subtitle: "A Trapper's Life Work",
              revealEmoji: '🦬',
              hook: 'Unexpected taxidermy + wax museum combo with deep regional lore.',
              whatToDo: ['Ask for guided tour, then walk both galleries.'],
              proTips: ['Time-gated stop; skip if running late out of Lander.'],
              context: 'Combines a lifetime wildlife collection with old-west wax exhibits.',
              latitude: 43.025,
              longitude: -108.38,
              type: 'history',
              estimatedDurationMinutes: 30,
              arrivalRadiusMeters: 220,
              suggestedDuration: '30–45 min',
              costNote: '~$5',
              hoursToday: '9:00 AM – 4:00 PM',
            },
            {
              id: 'wind-river-canyon',
              name: 'Wind River Canyon',
              subtitle: 'Two Billion Years in Twenty Miles',
              revealEmoji: '🏔️',
              hook: 'A cinematic canyon drive through layered deep-time geology.',
              whatToDo: ['Drive through slowly and use pull-outs for photos.'],
              proTips: ['Late light is best; look for bighorn sheep on slopes.'],
              context: 'A classic Wyoming scenic corridor where the drive itself is the stop.',
              latitude: 43.38,
              longitude: -108.18,
              type: 'scenic',
              estimatedDurationMinutes: 40,
              arrivalRadiusMeters: 320,
              suggestedDuration: '30–45 min',
              costNote: 'Free',
              hoursToday: 'Always accessible',
            },
            {
              id: 'safari-club-lounge',
              name: 'Safari Club Lounge',
              subtitle: 'Inside the Days Inn',
              revealEmoji: '🦌',
              hook: 'World-travel trophy collection hidden inside an ordinary hotel.',
              whatToDo: ['Walk lobby/bar and ask for wall/species diagram if available.'],
              proTips: ['Great visual stop; keep it short to protect dinner timing.'],
              context: 'An eccentric private collection turned roadside legend.',
              latitude: 43.65,
              longitude: -108.21,
              type: 'kitsch',
              estimatedDurationMinutes: 20,
              arrivalRadiusMeters: 220,
              suggestedDuration: '15–20 min',
              costNote: 'Free to browse',
              hoursToday: 'Afternoons (verify)',
            },
            {
              id: 'hot-springs-state-park',
              name: 'Hot Springs State Park',
              subtitle: "Wyoming's First State Park",
              revealEmoji: '♨️',
              hook: 'Mineral terraces, river bridge, and classic Thermopolis landmark energy.',
              whatToDo: ['Quick terrace/bridge loop; keep moving for Cody arrival window.'],
              proTips: ['Time-gated near dinner constraint.'],
              context: 'Historic park with famous geothermal features and treaty history.',
              latitude: 43.6511,
              longitude: -108.2058,
              type: 'nature',
              estimatedDurationMinutes: 15,
              arrivalRadiusMeters: 220,
              suggestedDuration: '15 min',
              costNote: 'Free',
              hoursToday: 'Always accessible',
            },
            {
              id: 'meeteetse',
              name: 'Meeteetse',
              subtitle: 'Population 330',
              revealEmoji: '🐾',
              hook: 'Tiny Wyoming ranch town with outsized conservation history.',
              whatToDo: ['Slow drive-through; optional quick museum peek if ahead of schedule.'],
              proTips: ['Usually a short pass-through stop.'],
              context: 'Known for black-footed ferret rediscovery lore.',
              latitude: 44.157,
              longitude: -108.866,
              type: 'history',
              estimatedDurationMinutes: 5,
              arrivalRadiusMeters: 200,
              suggestedDuration: '5 min',
              costNote: 'Free',
              hoursToday: 'Drive-through',
            },
            {
              id: 'irma-hotel',
              name: 'Irma Hotel',
              subtitle: "Buffalo Bill's Place",
              revealEmoji: '🤠',
              hook: 'Historic Cody arrival dinner in Buffalo Bill’s original hotel.',
              whatToDo: ['Walk the lobby displays, then settle in for dinner.'],
              proTips: ['Atmosphere is the win; keep menu choices simple.'],
              context: 'A centerpiece of Cody history since 1902.',
              latitude: 44.5258,
              longitude: -109.0644,
              type: 'history',
              estimatedDurationMinutes: 75,
              arrivalRadiusMeters: 180,
              suggestedDuration: '60–75 min',
              costNote: '~$20–30/person',
              hoursToday: 'Dinner service (verify)',
            },
          ],
        },
        {
          id: 'billings-day4',
          label: 'Cody → Hyrum',
          stops: [
            {
              id: 'nmmv-dubois',
              name: 'National Museum of Military Vehicles',
              subtitle: 'Smithsonian-Caliber in a Town of 900',
              revealEmoji: '🪖',
              hook: 'Massive museum with rare vehicles/artifacts in an unexpected place.',
              whatToDo: [
                'Walk galleries in chronological order.',
                'Don’t miss the Higgins Boat and featured weapons vault.',
              ],
              proTips: ['Give it 2+ hours minimum.', 'Canteen is solid for lunch.'],
              context: 'One of the strongest surprise museums on the whole route.',
              latitude: 43.4724,
              longitude: -109.4958,
              type: 'history',
              estimatedDurationMinutes: 150,
              arrivalRadiusMeters: 220,
              suggestedDuration: '2–3 hours',
              costNote: '$23/adult',
              hoursToday: '9:30 AM – 5:00 PM',
            },
            {
              id: 'dubois-jackalope',
              name: 'Giant Jackalope & Sasquatch-Unicorn Statue',
              subtitle: 'Peak Wyoming',
              revealEmoji: '🐰',
              hook: 'Pure roadside weirdness and great photo stop.',
              whatToDo: ['Quick photos at indoor/outdoor jackalope + nearby sculpture.'],
              proTips: ['Great combo gas/snack/bathroom stop.'],
              context: 'Wyoming folklore turned into a fully committed town-side attraction.',
              latitude: 43.5342,
              longitude: -109.6374,
              type: 'kitsch',
              estimatedDurationMinutes: 10,
              arrivalRadiusMeters: 200,
              suggestedDuration: '10 min',
              costNote: 'Free',
              hoursToday: '7:00 AM – 8:00 PM',
            },
            {
              id: 'continental-divide-togwotee',
              name: 'Continental Divide',
              subtitle: 'Togwotee Pass — 9,655 Feet',
              revealEmoji: '⛰️',
              hook: 'Stand on the continental spine where waters split Atlantic vs Pacific.',
              whatToDo: ['Short summit pull-off photo stop.'],
              proTips: ['It can still be very cold/windy up here in April.'],
              context: 'Historic mountain crossing with huge scenic payoff on descent.',
              latitude: 43.75,
              longitude: -110.0833,
              type: 'scenic',
              estimatedDurationMinutes: 5,
              arrivalRadiusMeters: 220,
              suggestedDuration: '5 min',
              costNote: 'Free',
              hoursToday: 'Always accessible',
            },
            {
              id: 'oxbow-bend',
              name: 'Oxbow Bend',
              subtitle: 'The Reflection',
              revealEmoji: '🫎',
              hook: 'Iconic Teton reflection/wildlife overlook and one of the best fast scenic stops.',
              whatToDo: ['Hit the turnout and scan shorelines for wildlife.'],
              proTips: ['Calm water = best reflection shots.'],
              context: 'A signature Grand Teton viewpoint with excellent visual reward per minute.',
              latitude: 43.8553,
              longitude: -110.5378,
              type: 'nature',
              estimatedDurationMinutes: 5,
              arrivalRadiusMeters: 220,
              suggestedDuration: '5 min',
              costNote: 'GTNP pass required',
              hoursToday: 'Always accessible',
            },
            {
              id: 'snake-river-overlook',
              name: 'Snake River Overlook',
              subtitle: 'The Ansel Adams Shot',
              revealEmoji: '📸',
              hook: 'Classic Teton + Snake River vista made famous by Ansel Adams.',
              whatToDo: ['Quick overlook stop and photo from the main pullout.'],
              proTips: ['Great wide-angle frame; quick but memorable stop.'],
              context: 'One of the most historically recognizable landscape viewpoints in the region.',
              latitude: 43.778,
              longitude: -110.59,
              type: 'scenic',
              estimatedDurationMinutes: 5,
              arrivalRadiusMeters: 220,
              suggestedDuration: '5 min',
              costNote: 'GTNP pass required',
              hoursToday: 'Always accessible',
            },
            {
              id: 'moos-ice-cream-jackson',
              name: "Moo's Gourmet Ice Cream",
              subtitle: 'Best Dessert in Wyoming',
              revealEmoji: '🫐',
              hook: 'Top-tier Jackson dessert stop — wild huckleberry is the move.',
              whatToDo: ['Order huckleberry, then walk Town Square antler arches.'],
              proTips: ['Twin cone if you want huckleberry + Buzz Bomb.'],
              context: 'A high-quality, high-morale stop in the middle of a long return day.',
              latitude: 43.4799,
              longitude: -110.7624,
              type: 'food',
              estimatedDurationMinutes: 20,
              arrivalRadiusMeters: 200,
              suggestedDuration: '15–20 min',
              costNote: '~$7–10',
              hoursToday: '12:30 PM – 9:00 PM',
            },
            {
              id: 'napoleon-dynamite-house',
              name: "Napoleon Dynamite's House",
              subtitle: 'Gosh!',
              revealEmoji: '🦙',
              hook: 'The actual house from the film — quick roadside nostalgia hit.',
              whatToDo: ['Quick photo from road/shoulder only.'],
              proTips: ['Private property — do not enter the lot.'],
              context: 'Cult-film location that makes a perfect near-home final reveal.',
              latitude: 42.103,
              longitude: -111.884,
              type: 'kitsch',
              estimatedDurationMinutes: 2,
              arrivalRadiusMeters: 180,
              suggestedDuration: '2 min',
              costNote: 'Free',
              hoursToday: 'Always visible',
              safetyNotes: 'Private residence. Roadside viewing only.',
            },
          ],
        },
      ],
    },
    {
      id: 'halls',
      name: 'The Halls',
      days: [
        {
          id: 'halls-test',
          label: 'Test Route — Drive Home',
          stops: [
            {
              id: 'halls-test-stop1',
              name: 'Home Sweet Home',
              subtitle: 'The final destination',
              revealEmoji: '🏠',
              hook: 'You made it. The reveal system works.',
              whatToDo: [
                'Check that the animation played in sequence.',
                'Try switching between tabs.',
                'Tap "Finish Trip" and verify the completion screen.',
              ],
              proTips: [
                'If you tapped during the animation, it should have snapped to complete.',
                'Try killing the app and relaunching to test resume.',
              ],
              context:
                'This is a test stop for verifying the full reveal flow before the Billings beta.',
              latitude: 40.2551,
              longitude: -111.631,
              type: 'rest',
              estimatedDurationMinutes: 5,
              arrivalRadiusMeters: 250,
              suggestedDuration: '5 min',
              costNote: 'Free',
              hoursToday: 'Always open',
              parkingNotes: 'Your driveway.',
            },
          ],
        },
        {
          id: 'halls-day1',
          label: 'Day 1: Provo → ???',
          stops: [
            {
              id: 'halls-day1-stop1',
              name: 'TBD Halls Stop 1',
              subtitle: 'TBD',
              revealEmoji: '📍',
              hook: 'TBD — hook goes here.',
              whatToDo: ['TBD — action steps go here.'],
              proTips: ['TBD — pro tips go here.'],
              context: 'TBD — context goes here.',
              latitude: 40.2338,
              longitude: -111.6585,
              type: 'activity',
              estimatedDurationMinutes: 25,
              arrivalRadiusMeters: 200,
              suggestedDuration: '25 min',
              costNote: 'TBD',
              hoursToday: 'TBD',
            },
          ],
        },
      ],
    },
  ],
};
