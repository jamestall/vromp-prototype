#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VROMP_GMS_API_KEY;

if (!apiKey) {
  console.error('Missing API key. Set GOOGLE_MAPS_API_KEY or VROMP_GMS_API_KEY.');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/geocode-trip.mjs <input-json> [output-json]');
  process.exit(1);
}

const outputPath = process.argv[3] || inputPath.replace(/\.json$/i, '.geocoded.json');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const geocodeAddress = async address => {
  const params = new URLSearchParams({address, key: apiKey});
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  return data;
};

const main = async () => {
  const absIn = path.resolve(process.cwd(), inputPath);
  const absOut = path.resolve(process.cwd(), outputPath);

  const raw = await fs.readFile(absIn, 'utf8');
  const trip = JSON.parse(raw);

  let success = 0;
  let failed = 0;
  const warnings = [];

  for (const day of trip.days ?? []) {
    for (const stop of day.stops ?? []) {
      const address = stop.address || stop.navigate_to || stop.navigateTo;
      if (!address) {
        stop.coordinates_source = 'geocode_failed';
        failed += 1;
        warnings.push(`${stop.stop_id || stop.id}: missing address`);
        continue;
      }

      try {
        const data = await geocodeAddress(address);

        if (data.status !== 'OK' || !data.results?.length) {
          stop.coordinates_source = 'geocode_failed';
          failed += 1;
          warnings.push(`${stop.stop_id || stop.id}: ${data.status}`);
          continue;
        }

        const result = data.results[0];
        stop.lat = result.geometry?.location?.lat ?? stop.lat ?? null;
        stop.lng = result.geometry?.location?.lng ?? stop.lng ?? null;
        stop.google_place_id = result.place_id ?? null;
        stop.coordinates_source = 'google_geocoding_api';

        if (data.results.length > 1) {
          warnings.push(`${stop.stop_id || stop.id}: multiple geocode results, used first`);
        }

        success += 1;
        await sleep(120);
      } catch (error) {
        stop.coordinates_source = 'geocode_failed';
        failed += 1;
        warnings.push(`${stop.stop_id || stop.id}: ${String(error)}`);
      }
    }
  }

  await fs.writeFile(absOut, JSON.stringify(trip, null, 2));

  console.log(`Geocoding complete.`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  if (warnings.length) {
    console.log('\nWarnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
  console.log(`\nOutput: ${absOut}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
