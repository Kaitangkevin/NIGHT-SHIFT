import { readFile } from 'node:fs/promises';
import { solve } from '../puzzle.mjs';
import { canonicalLayout } from '../pages-api.mjs';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
const maps = JSON.parse(await readFile(new URL('../maps.json', import.meta.url), 'utf8'));
const rows = Object.entries(maps).map(([challenge_date, map]) => {
  const solutions = solve(map);
  if (solutions.length !== 1) throw new Error('Map must have one solution: ' + challenge_date);
  return { challenge_date, solution: canonicalLayout(solutions[0]) };
});
const response = await fetch(new URL('/rest/v1/night_shift_published_maps?on_conflict=challenge_date', SUPABASE_URL), {
  method: 'POST',
  headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json',
    Prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify(rows),
  signal: AbortSignal.timeout(10000),
  redirect: 'error'
});
if (!response.ok) throw new Error('Map synchronization failed (HTTP ' + response.status + ').');
console.log('Verified and synchronized ' + rows.length + ' daily maps.');
