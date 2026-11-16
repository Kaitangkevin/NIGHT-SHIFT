import { CELLS, SIZE, LIMITS, colOf, rowOf, inspect } from './puzzle.mjs';

const icons = {
  box: '<svg aria-hidden="true"><use href="#box-icon"/></svg>',
  lamp: '<svg aria-hidden="true"><use href="#lamp-icon"/></svg>',
  mark: '<span aria-hidden="true">×</span>'
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountGame(container, map, { onComplete, onShowResult } = {}) {
  const boxCells = new Set(map.boxes);
  const facilities = new Set(), occupied = new Map(), marks = new Set();
  const cellTarget = map.rows.reduce((sum, count) => sum + count, 0);
  let started = performance.now();
  let stoppedAt = null;
  let mode = 'single', orientation = 'horizontal', anchor = null;
  let lastTap = null, complete = false;
  let timer;

  const stats = element('div', 'puzzle-stats');
  const installed = element('span', 'installed');
  const clock = element('span', 'puzzle-clock');
  clock.setAttribute('aria-label', '用时');
  stats.append(installed, clock);

  const board = element('div', 'board puzzle-board');
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', '8×8 巡灯棋盘');
  const top = map.cols.map(value => element('span', 'clue', value));
  const left = map.rows.map(value => element('span', 'clue', value));
  board.append(element('span','clue-corner','↓ →'), ...top);
  const tiles = Array.from({ length: CELLS }, (_, index) => {
    const tile = element('button', 'tile');
    tile.type = 'button';
    if (boxCells.has(index)) tile.disabled = true;
    tile.addEventListener('click', () => interact(index));
    tile.addEventListener('keydown', event => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      event.preventDefault();
      if (!complete && (remove(index) || marks.delete(index))) {
        lastTap = null;
        render();
      }
    });
    return tile;
  });
  for (let row = 0; row < SIZE; row++) {
    board.append(left[row], ...tiles.slice(row * SIZE, (row + 1) * SIZE));
  }

  const inventory = element('div', 'puzzle-inventory');
  const singles = element('span', 'inventory-slot');
  const doubles = element('span', 'inventory-slot');
  inventory.append(singles, doubles);
  const controls = element('div', 'puzzle-controls');
  const singleMode = element('button', 'puzzle-tool', '单体路灯');
  const doubleMode = element('button', 'puzzle-tool', '双格路灯');
  const rotate = element('button', 'puzzle-tool orientation-tool');
  const markMode = element('button', 'puzzle-tool', '× 排除标记');
  const reset = element('button', 'puzzle-tool reset-tool', '重置');
  for (const button of [singleMode, doubleMode, markMode, reset, rotate]) button.type = 'button';
  controls.append(singleMode, doubleMode, rotate, markMode, reset);
  const message = element('p', 'puzzle-message');
  message.setAttribute('role', 'status');
  const showResult = element('button', 'puzzle-tool result-tool', '查看成绩 ↗');
  showResult.type = 'button';
  showResult.hidden = true;
  showResult.addEventListener('click', () => onShowResult?.());
  container.append(stats, board, inventory, controls, message, showResult);

  function updateClock() {
    const seconds = Math.floor(((stoppedAt ?? performance.now()) - started) / 1000);
    clock.textContent = [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  }

  function render() {
    const result = inspect(map, [...facilities]);
    const setClue = (node, count, target, label) => {
      node.classList.toggle('met', count === target);
      node.classList.toggle('over', count > target);
      node.setAttribute('aria-label', label + '需 ' + target + ' 格，已占用 ' + count + ' 格');
    };
    top.forEach((node, index) => setClue(node, result.cols[index], map.cols[index], '第 ' + (index + 1) + ' 列'));
    left.forEach((node, index) => setClue(node, result.rows[index], map.rows[index], '第 ' + (index + 1) + ' 行'));

    tiles.forEach((tile, index) => {
      const facility = occupied.get(index);
      const paired = facility?.length === 2;
      const kind = boxCells.has(index) ? 'box' : facility ? 'lamp' : marks.has(index) ? 'mark' : '';
      if ((tile.dataset.kind ?? '') !== kind) {
        tile.dataset.kind = kind;
        tile.innerHTML = icons[kind] || '';
      }
      tile.classList.toggle('conflict', result.conflicts.has(index));
      tile.classList.toggle('paired', paired);
      tile.classList.toggle('anchor', anchor === index);
      tile.classList.toggle('target', anchor !== null && !boxCells.has(index) && !facility && adjacentToAnchor(index));
      tile.classList.toggle('bridge-right', paired && facility.includes(index + 1) && colOf(index) < SIZE - 1);
      tile.classList.toggle('bridge-down', paired && facility.includes(index + SIZE));
      const label = { box: '电箱', lamp: paired ? '双格路灯' : '单体路灯', mark: '已排除' }[kind] || '空格';
      tile.setAttribute('aria-label', '第 ' + (rowOf(index) + 1) + ' 行，第 ' + (colOf(index) + 1) + ' 列，' + label);
    });
    installed.textContent = '设施 ' + facilities.size + ' / ' + map.boxes.length +
      ' · 占用 ' + occupied.size + ' / ' + cellTarget + ' 格';
    singles.textContent = '单体 ' + result.singles + ' / ' + LIMITS.single;
    doubles.textContent = '双格 ' + result.doubles + ' / ' + LIMITS.double;
    singleMode.setAttribute('aria-pressed', String(mode === 'single'));
    doubleMode.setAttribute('aria-pressed', String(mode === 'double'));
    markMode.setAttribute('aria-pressed', String(mode === 'mark'));
    rotate.hidden = mode !== 'double';
    const direction = orientation === 'horizontal' ? '横向' : '纵向';
    rotate.textContent = direction + ' ↻';
    rotate.setAttribute('aria-label', '双格路灯方向：' + direction + '，点击切换');

    const justCompleted = result.complete && !complete;
    if (justCompleted) {
      complete = true;
      stoppedAt = performance.now();
      updateClock();
      clearInterval(timer);
    }
    board.classList.toggle('solved', complete);
    message.classList.toggle('success', complete);
    message.textContent = complete ? '巡灯完成 · 用时 ' + clock.textContent :
      anchor !== null ? (tiles.some(tile => tile.classList.contains('target')) ?
        '选择高亮的第二格。' : '这个方向没有可用的第二格。可切换方向，或再次点击第一格取消。') :
      result.conflicts.size ? '红色设施与其他设施相邻。' :
      mode === 'mark' ? '点击空格添加或取消 × 标记。' :
      mode === 'double' ? '选择两个相邻格安装双格路灯。' :
      '点击空格安装，双击移除整组设施。';
    showResult.hidden = !complete || !onShowResult;
    if (justCompleted) onComplete?.([...facilities]);
  }

  function adjacentToAnchor(index) {
    if (orientation === 'horizontal') {
      return rowOf(index) === rowOf(anchor) && Math.abs(index - anchor) === 1;
    }
    return Math.abs(index - anchor) === SIZE;
  }

  function remove(index) {
    const facility = occupied.get(index);
    if (!facility) return false;
    facilities.delete(facility);
    for (const cell of facility) occupied.delete(cell);
    return true;
  }

  function install(cells) {
    facilities.add(cells);
    for (const cell of cells) {
      occupied.set(cell, cells);
      marks.delete(cell);
    }
  }

  function interact(index) {
    if (complete || boxCells.has(index)) return;
    const facility = occupied.get(index);
    if (facility) {
      const now = performance.now();
      if (lastTap?.facility === facility && now - lastTap.time <= 450) {
        remove(index);
        lastTap = null;
      } else {
        lastTap = { facility, time: now };
      }
    } else {
      lastTap = null;
      if (mode === 'mark') {
        if (!marks.delete(index)) marks.add(index);
      } else {
        const double = mode === 'double';
        const length = double ? 2 : 1;
        const used = [...facilities].filter(group => group.length === length).length;
        if (used >= (double ? LIMITS.double : LIMITS.single)) {
          message.textContent = double ? '双格路灯库存已用完。' : '单体路灯库存已用完。';
          return;
        }
        if (!double) {
          install([index]);
        } else if (anchor === index) {
          anchor = null;
        } else if (anchor === null) {
          anchor = index;
        } else if (adjacentToAnchor(index)) {
          install([anchor, index]);
          anchor = null;
        } else {
          message.textContent = '第二格必须与第一格沿所选方向相邻。';
          return;
        }
      }
    }
    render();
  }

  function switchMode(next) {
    mode = next;
    anchor = null;
    lastTap = null;
    render();
  }
  singleMode.addEventListener('click', () => switchMode('single'));
  doubleMode.addEventListener('click', () => switchMode('double'));
  rotate.addEventListener('click', () => {
    orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    lastTap = null;
    render();
  });
  markMode.addEventListener('click', () => switchMode('mark'));
  reset.addEventListener('click', () => {
    facilities.clear();
    occupied.clear();
    marks.clear();
    if (complete) {
      complete = false;
      started += performance.now() - stoppedAt;
      stoppedAt = null;
      timer = setInterval(updateClock, 250);
      updateClock();
    }
    switchMode('single');
  });

  updateClock();
  timer = setInterval(updateClock, 250);
  render();
  return () => clearInterval(timer);
}
