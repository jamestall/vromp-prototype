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
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  type: StopType;
  estimatedDurationMinutes: number;
  arrivalRadiusMeters: number;
  revealImage?: string | null;
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
              description: 'Placeholder stop for beta wiring. Replace with real coordinates.',
              latitude: 36.1627,
              longitude: -86.7816,
              type: 'scenic',
              estimatedDurationMinutes: 20,
              arrivalRadiusMeters: 200,
              revealImage: null,
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
          id: 'billings-day0',
          label: 'Hyrum → Kemmerer (Night Drive)',
          stops: [
            {
              id: 'billings-day0-stop1',
              name: 'Kemmerer Overnight Arrival',
              description:
                'Night transit leg complete. Settle in and reset before the full mystery route day.',
              latitude: 41.7916,
              longitude: -110.5377,
              type: 'rest',
              estimatedDurationMinutes: 30,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
          ],
        },
        {
          id: 'billings-day1',
          label: 'Kemmerer → Cody',
          stops: [
            {
              id: 'billings-day1-stop1',
              name: 'J.C. Penney Mother Store',
              description:
                'The original 1902 Golden Rule Store in Kemmerer, with historic details still intact and the famous cash pulley demo.',
              latitude: 41.7924,
              longitude: -110.5368,
              type: 'history',
              estimatedDurationMinutes: 20,
              arrivalRadiusMeters: 200,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop2',
              name: 'J.C. Penney Statue',
              description:
                'Quick photo stop at Triangle Park with the bronze James Cash Penney statue returned to Kemmerer.',
              latitude: 41.792,
              longitude: -110.5375,
              type: 'kitsch',
              estimatedDurationMinutes: 2,
              arrivalRadiusMeters: 160,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop3',
              name: 'Farson Mercantile (Big Cone)',
              description:
                'Wyoming roadside legend since 1908. Huge ice cream portions, deli food, and classic road-trip energy.',
              latitude: 42.1109,
              longitude: -109.442,
              type: 'food',
              estimatedDurationMinutes: 25,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop4',
              name: 'Maven Optics',
              description:
                'Lander-based premium optics stop for browsing gear before canyon country.',
              latitude: 42.833,
              longitude: -108.731,
              type: 'activity',
              estimatedDurationMinutes: 60,
              arrivalRadiusMeters: 180,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop5',
              name: 'Lander Bar & Coalter Block',
              description:
                'Historic 1907 western building with lunch, beer, and classic small-town Wyoming atmosphere.',
              latitude: 42.8329,
              longitude: -108.7306,
              type: 'food',
              estimatedDurationMinutes: 45,
              arrivalRadiusMeters: 180,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop6',
              name: 'Sinks Canyon State Park',
              description:
                'Watch the Popo Agie vanish into limestone and reappear at the Rise with giant trout.',
              latitude: 42.7472,
              longitude: -108.8264,
              type: 'nature',
              estimatedDurationMinutes: 30,
              arrivalRadiusMeters: 240,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop7',
              name: 'Wind River Canyon Scenic Drive',
              description:
                'A dramatic canyon corridor with 2.5 billion years of geology and unforgettable pull-off views.',
              latitude: 43.55,
              longitude: -108.19,
              type: 'scenic',
              estimatedDurationMinutes: 40,
              arrivalRadiusMeters: 320,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop8',
              name: 'Hot Springs State Park',
              description:
                'Thermopolis terraces, bridge views, and one of Wyoming’s signature geothermal landmarks.',
              latitude: 43.6464,
              longitude: -108.2055,
              type: 'nature',
              estimatedDurationMinutes: 30,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
            {
              id: 'billings-day1-stop9',
              name: 'Irma Hotel',
              description:
                'Buffalo Bill-era historic hotel in Cody for first-night arrival, dinner, and atmosphere.',
              latitude: 44.5241,
              longitude: -109.056,
              type: 'history',
              estimatedDurationMinutes: 75,
              arrivalRadiusMeters: 180,
              revealImage: null,
            },
          ],
        },
        {
          id: 'billings-day2',
          label: 'Cody Museums + Wapiti Valley',
          stops: [
            {
              id: 'billings-day2-stop1',
              name: 'Heart Mountain WWII Interpretive Center',
              description:
                'Powerful Smithsonian-affiliated site documenting Japanese American incarceration during WWII.',
              latitude: 44.67,
              longitude: -108.94,
              type: 'history',
              estimatedDurationMinutes: 120,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
            {
              id: 'billings-day2-stop2',
              name: 'Cody Dug Up Gun Museum',
              description:
                'Donation-based museum packed with recovered firearms and personal stories from the owner.',
              latitude: 44.5244,
              longitude: -109.064,
              type: 'history',
              estimatedDurationMinutes: 40,
              arrivalRadiusMeters: 180,
              revealImage: null,
            },
            {
              id: 'billings-day2-stop3',
              name: 'Buffalo Bill Dam',
              description:
                'Historic engineering landmark with dramatic canyon views and a vertigo-inducing top walk.',
              latitude: 44.4975,
              longitude: -109.1813,
              type: 'scenic',
              estimatedDurationMinutes: 20,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
            {
              id: 'billings-day2-stop4',
              name: 'Smith Mansion',
              description:
                'Surreal 5-story hand-built log structure in Wapiti Valley; unforgettable roadside outsider architecture.',
              latitude: 44.4878,
              longitude: -109.48,
              type: 'kitsch',
              estimatedDurationMinutes: 10,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
            {
              id: 'billings-day2-stop5',
              name: 'Lonely Big Boy Statue',
              description:
                'A random Big Boy statue in a Wyoming field. No one fully knows why. Peak roadside weirdness.',
              latitude: 44.49,
              longitude: -109.42,
              type: 'kitsch',
              estimatedDurationMinutes: 2,
              arrivalRadiusMeters: 180,
              revealImage: null,
            },
            {
              id: 'billings-day2-stop6',
              name: 'Buffalo Bill Center of the West',
              description:
                'Five major museums in one complex, including Plains Indian and Western art collections.',
              latitude: 44.5258,
              longitude: -109.0714,
              type: 'art',
              estimatedDurationMinutes: 180,
              arrivalRadiusMeters: 200,
              revealImage: null,
            },
          ],
        },
        {
          id: 'billings-day3',
          label: 'Cody Day 2 — Flex Day',
          stops: [
            {
              id: 'billings-day3-stop1',
              name: 'Buffalo Bill Center of the West (continued)',
              description:
                'Return pass to finish galleries from the previous day and revisit favorites.',
              latitude: 44.5258,
              longitude: -109.0714,
              type: 'art',
              estimatedDurationMinutes: 120,
              arrivalRadiusMeters: 200,
              revealImage: null,
            },
            {
              id: 'billings-day3-stop2',
              name: 'Meeteetse Museums Complex',
              description:
                'Small-town museum cluster with local history and standout ranch photography.',
              latitude: 44.157,
              longitude: -108.866,
              type: 'history',
              estimatedDurationMinutes: 45,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
            {
              id: 'billings-day3-stop3',
              name: 'Legend Rock Petroglyph Site',
              description:
                'Remote cliff panels with hundreds of ancient petroglyphs and deep regional history.',
              latitude: 43.82,
              longitude: -108.62,
              type: 'history',
              estimatedDurationMinutes: 60,
              arrivalRadiusMeters: 260,
              revealImage: null,
            },
            {
              id: 'billings-day3-stop4',
              name: 'Wyoming Dinosaur Center',
              description:
                'World-class paleontology museum with massive skeleton displays and major fossil highlights.',
              latitude: 43.6515,
              longitude: -108.1858,
              type: 'activity',
              estimatedDurationMinutes: 90,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
          ],
        },
        {
          id: 'billings-day4',
          label: 'Cody → Hyrum (Return)',
          stops: [
            {
              id: 'billings-day4-stop1',
              name: 'National Museum of Military Vehicles',
              description:
                'Massive Dubois museum with hundreds of restored military vehicles and standout artifacts.',
              latitude: 43.536,
              longitude: -109.57,
              type: 'history',
              estimatedDurationMinutes: 150,
              arrivalRadiusMeters: 220,
              revealImage: null,
            },
            {
              id: 'billings-day4-stop2',
              name: 'Dubois Jackalope Stop',
              description:
                'Peak Wyoming roadside kitsch: giant jackalope photo-op and surreal sculpture energy.',
              latitude: 43.5325,
              longitude: -109.628,
              type: 'kitsch',
              estimatedDurationMinutes: 10,
              arrivalRadiusMeters: 200,
              revealImage: null,
            },
            {
              id: 'billings-day4-stop3',
              name: 'National Bighorn Sheep Center',
              description:
                'Wildlife-focused interpretive center in Dubois with bighorn exhibits and regional context.',
              latitude: 43.534,
              longitude: -109.631,
              type: 'nature',
              estimatedDurationMinutes: 30,
              arrivalRadiusMeters: 200,
              revealImage: null,
            },
            {
              id: 'billings-day4-stop4',
              name: 'Fossil Butte National Monument',
              description:
                'Ancient fossil-lake story with fish and prehistoric finds near Kemmerer before the final push home.',
              latitude: 41.858,
              longitude: -110.766,
              type: 'nature',
              estimatedDurationMinutes: 45,
              arrivalRadiusMeters: 230,
              revealImage: null,
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
          id: 'halls-day1',
          label: 'Day 1: Provo → ???',
          stops: [
            {
              id: 'halls-day1-stop1',
              name: 'TBD Halls Stop 1',
              description: 'Placeholder for Provo-origin beta route.',
              latitude: 40.2338,
              longitude: -111.6585,
              type: 'activity',
              estimatedDurationMinutes: 25,
              arrivalRadiusMeters: 200,
              revealImage: null,
            },
          ],
        },
      ],
    },
  ],
};
