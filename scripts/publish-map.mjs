import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { generate, solve } from '../puzzle.mjs';

const [date, count, doubles] = process.argv.slice(2);
const stamp = Date.parse(date);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(stamp) ||
    new Date(stamp).toISOString().slice(0,10) !== date) {
  throw new Error('用法：node scripts/publish-map.mjs YYYY-MM-DD [电箱数量] [双格数量]');
}
const file = new URL('../maps.json', import.meta.url);
const temp = new URL('../maps.json.tmp', import.meta.url);
const lock = new URL('../maps.json.lock', import.meta.url);
const handle = await open(lock, 'wx');
try {
  const maps = JSON.parse(await readFile(file, 'utf8'));
  if (Object.hasOwn(maps, date)) throw new Error('该日期已发布，原地图已保留。');
  const map = generate({
    count: count === undefined ? undefined : Number(count),
    doubles: doubles === undefined ? undefined : Number(doubles)
  });
  if (solve(map).length !== 1) throw new Error('地图未通过唯一解验证。');
  await writeFile(temp, JSON.stringify({ ...maps, [date]: map }, null, 2) + '\n');
  await rename(temp, file);
  console.log('已写入', date, '地图，共', map.boxes.length, '个电箱。');
} finally {
  await handle.close();
  await unlink(lock);
}
