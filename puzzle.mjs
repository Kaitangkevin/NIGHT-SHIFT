export const SIZE = 8;
export const CELLS = SIZE * SIZE;
export const LIMITS = { single: 7, double: 2 };
export const VERSION = 4;
const indexes = Array.from({length: CELLS}, (_, index) => index);
export const rowOf = index => Math.floor(index / SIZE);
export const colOf = index => index % SIZE;

function neighbors(index, diagonals) {
  return indexes.filter(other => {
    const y = Math.abs(rowOf(index) - rowOf(other));
    const x = Math.abs(colOf(index) - colOf(other));
    return diagonals ? Math.max(x, y) === 1 : x + y === 1;
  });
}
const cardinal = indexes.map(index => neighbors(index, false));
const surrounding = indexes.map(index => neighbors(index, true));

function match(facilities, choices) {
  const assigned = new Map();
  function assign(facility, seen) {
    for (const box of choices(facility)) {
      if (seen.has(box)) continue;
      seen.add(box);
      if (!assigned.has(box) || assign(assigned.get(box), seen)) {
        assigned.set(box, facility);
        return true;
      }
    }
    return false;
  }
  for (const facility of facilities) if (!assign(facility, new Set())) return null;
  return assigned;
}

function adjacentBoxes(facility, isBox) {
  return [...new Set(facility.flatMap(cell => cardinal[cell].filter(isBox)))];
}

export function clues(cells) {
  const rows = Array(SIZE).fill(0), cols = Array(SIZE).fill(0);
  for (const cell of cells) {
    rows[rowOf(cell)]++;
    cols[colOf(cell)]++;
  }
  return { rows, cols };
}

export function inspect(map, facilities) {
  const boxes = new Set(map.boxes), occupied = new Map(), conflicts = new Set();
  let singles = 0, doubles = 0, legal = true;
  for (const facility of facilities) {
    const [first, second] = facility;
    if (facility.length === 1) singles++;
    else if (facility.length === 2 && cardinal[first]?.includes(second)) doubles++;
    else legal = false;
    for (const cell of facility) {
      if (!Number.isInteger(cell) || !cardinal[cell]) {
        legal = false;
        continue;
      }
      if (boxes.has(cell) || occupied.has(cell)) {
        legal = false;
        conflicts.add(cell);
      }
      occupied.set(cell, facility);
    }
  }
  for (const [cell, facility] of occupied) {
    for (const neighbor of surrounding[cell]) {
      if (occupied.has(neighbor) && occupied.get(neighbor) !== facility) {
        conflicts.add(cell);
        conflicts.add(neighbor);
      }
    }
  }
  const counts = clues(occupied.keys());
  const complete = legal && !conflicts.size && facilities.length === boxes.size &&
    singles <= LIMITS.single && doubles <= LIMITS.double &&
    counts.rows.every((value, index) => value === map.rows[index]) &&
    counts.cols.every((value, index) => value === map.cols[index]) &&
    match(facilities, facility => adjacentBoxes(facility, cell => boxes.has(cell))) !== null;
  return { ...counts, singles, doubles, conflicts, complete };
}

function validMap(map) {
  if (map?.version !== VERSION || !Array.isArray(map.boxes)) return false;
  const { boxes, rows, cols } = map;
  const count = boxes.length;
  if (count < 1 || count > LIMITS.single + LIMITS.double ||
      new Set(boxes).size !== count ||
      !boxes.every(cell => Number.isInteger(cell) && cell >= 0 && cell < CELLS)) return false;
  if (![rows, cols].every(line => Array.isArray(line) && line.length === SIZE &&
      line.every(value => Number.isInteger(value) && value >= 0 && value <= SIZE))) return false;
  const sum = line => line.reduce((total, value) => total + value, 0);
  const doubles = sum(rows) - count;
  return sum(rows) === sum(cols) && doubles >= 0 && doubles <= Math.min(count, LIMITS.double) &&
    count - doubles <= LIMITS.single;
}

// Legal facilities are uniquely determined by the orthogonal components of occupied cells.
function components(cells) {
  const remaining = new Set(cells), facilities = [];
  for (const cell of remaining) {
    const facility = [cell];
    remaining.delete(cell);
    for (const member of facility) {
      for (const neighbor of cardinal[member]) {
        if (remaining.delete(neighbor)) facility.push(neighbor);
      }
    }
    facilities.push(facility);
  }
  return facilities;
}

export function solve(map, limit = 2) {
  if (!validMap(map) || limit < 1) return [];
  const boxes = new Set(map.boxes);
  const canPair = indexes.map(cell => cardinal[cell].some(neighbor => boxes.has(neighbor)));
  const doubleTarget = map.rows.reduce((sum, count) => sum + count, 0) - boxes.size;
  const options = map.rows.map((count, row) => {
    const free = cell => !boxes.has(cell) && map.rows[rowOf(cell)] && map.cols[colOf(cell)];
    const cells = indexes.slice(row * SIZE, (row + 1) * SIZE).filter(cell =>
      free(cell) && (canPair[cell] || (doubleTarget && cardinal[cell].some(next => free(next) && canPair[next]))));
    const masks = [];
    for (let selection = 0; selection < 2 ** cells.length; selection++) {
      const picked = cells.filter((_, i) => selection & (1 << i));
      if (picked.length !== count) continue;
      const mask = picked.reduce((bits, cell) => bits | (1 << colOf(cell)), 0);
      const horizontal = picked.filter(cell => mask & (1 << (colOf(cell) + 1))).length;
      if ((mask & (mask << 1) & (mask << 2)) === 0 && horizontal <= doubleTarget) {
        masks.push({ mask, picked, horizontal });
      }
    }
    return masks;
  });
  const solutions = [], occupied = [], remaining = [...map.cols];
  function search(row, previous, previousVertical, doubleCount) {
    if (row === SIZE) {
      if (doubleCount !== doubleTarget) return;
      const facilities = components(occupied);
      if (inspect(map, facilities).complete) solutions.push(facilities);
      return;
    }
    for (const { mask, picked, horizontal } of options[row]) {
      const vertical = mask & previous;
      if (mask & ((previous << 1) | (previous >> 1)) || vertical & previousVertical) continue;
      const placedDoubles = doubleCount + horizontal +
        picked.filter(cell => vertical & (1 << colOf(cell))).length;
      if (placedDoubles > doubleTarget || picked.some(cell => remaining[colOf(cell)] === 0)) continue;
      for (const cell of picked) remaining[colOf(cell)]--;
      occupied.push(...picked);
      if (remaining.every(value => value <= SIZE - row - 1)) {
        search(row + 1, mask, vertical, placedDoubles);
      }
      occupied.length -= picked.length;
      for (const cell of picked) remaining[colOf(cell)]++;
      if (solutions.length >= limit) return;
    }
  }
  search(0, 0, 0, 0);
  return solutions;
}

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generate({ count, doubles, random = Math.random, attempts = 5000 } = {}) {
  const capacity = LIMITS.single + LIMITS.double;
  count ??= 4 + Math.floor(random() * (capacity - 3));
  if (!Number.isInteger(count) || count < 1 || count > capacity) {
    throw new Error('电箱数量必须是 1–9 的整数。');
  }
  const minimum = Math.max(0, count - LIMITS.single);
  const maximum = Math.min(LIMITS.double, count);
  if (doubles !== undefined && (!Number.isInteger(doubles) || doubles < minimum || doubles > maximum)) {
    throw new Error('指定的双格设施数量超出该地图的库存限制。');
  }
  for (let attempt = 0; attempt < attempts; attempt++) {
    const doubleCount = doubles ?? minimum + Math.floor(random() * (maximum - minimum + 1));
    const occupied = new Set(), facilities = [];
    for (let placed = 0; placed < count; placed++) {
      const double = placed < doubleCount;
      const available = indexes.filter(cell => !occupied.has(cell) &&
        surrounding[cell].every(neighbor => !occupied.has(neighbor)));
      const free = new Set(available);
      const candidates = double ? available.filter(cell => cardinal[cell].some(next => free.has(next))) : available;
      const first = candidates[Math.floor(random() * candidates.length)];
      if (first === undefined) break;
      const facility = [first];
      if (double) {
        const next = cardinal[first].filter(cell => free.has(cell));
        facility.push(next[Math.floor(random() * next.length)]);
      }
      facilities.push(facility);
      for (const cell of facility) occupied.add(cell);
    }
    if (facilities.length !== count) continue;
    const pairs = match(facilities, facility =>
      shuffle(adjacentBoxes(facility, cell => !occupied.has(cell)), random));
    if (!pairs) continue;
    const map = { version: VERSION, boxes: [...pairs.keys()].sort((a,b) => a-b), ...clues(occupied) };
    if (solve(map).length === 1) return map;
  }
  throw new Error('未找到唯一解地图，请重试。');
}
