import {TRIPS} from '../trips';

const allowedTypes = new Set([
  'nature',
  'food',
  'kitsch',
  'art',
  'history',
  'scenic',
  'activity',
  'rest',
]);

describe('trips data integrity', () => {
  it('has unique family/day/stop ids', () => {
    const familyIds = new Set<string>();
    const dayIds = new Set<string>();
    const stopIds = new Set<string>();

    for (const family of TRIPS.families) {
      expect(familyIds.has(family.id)).toBe(false);
      familyIds.add(family.id);

      for (const day of family.days) {
        expect(dayIds.has(day.id)).toBe(false);
        dayIds.add(day.id);

        for (const stop of day.stops) {
          expect(stopIds.has(stop.id)).toBe(false);
          stopIds.add(stop.id);
        }
      }
    }
  });

  it('validates stop schema constraints', () => {
    for (const family of TRIPS.families) {
      for (const day of family.days) {
        expect(day.stops.length).toBeGreaterThan(0);

        for (const stop of day.stops) {
          expect(typeof stop.name).toBe('string');
          expect(stop.name.length).toBeGreaterThan(0);
          expect(typeof stop.description).toBe('string');
          expect(stop.description.length).toBeGreaterThan(0);

          expect(stop.latitude).toBeGreaterThanOrEqual(-90);
          expect(stop.latitude).toBeLessThanOrEqual(90);
          expect(stop.longitude).toBeGreaterThanOrEqual(-180);
          expect(stop.longitude).toBeLessThanOrEqual(180);

          expect(allowedTypes.has(stop.type)).toBe(true);
          expect(stop.estimatedDurationMinutes).toBeGreaterThan(0);
          expect(stop.arrivalRadiusMeters).toBeGreaterThanOrEqual(75);
          expect(stop.arrivalRadiusMeters).toBeLessThanOrEqual(500);
        }
      }
    }
  });
});
