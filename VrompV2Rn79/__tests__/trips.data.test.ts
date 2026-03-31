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
          expect(typeof stop.hook).toBe('string');
          expect(stop.hook.length).toBeGreaterThan(0);
          expect(typeof stop.subtitle).toBe('string');
          expect(typeof stop.revealEmoji).toBe('string');
          expect(stop.revealEmoji.length).toBeGreaterThan(0);
          expect(typeof stop.context).toBe('string');
          expect(stop.context.length).toBeGreaterThan(0);
          expect(Array.isArray(stop.whatToDo)).toBe(true);
          expect(stop.whatToDo.length).toBeGreaterThan(0);
          expect(Array.isArray(stop.proTips)).toBe(true);
          expect(stop.proTips.length).toBeGreaterThan(0);
          expect(typeof stop.suggestedDuration).toBe('string');
          expect(typeof stop.costNote).toBe('string');
          expect(typeof stop.hoursToday).toBe('string');

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
