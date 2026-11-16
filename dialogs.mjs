export function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

export function formatTime(duration) {
  const seconds = Math.floor(duration / 1000);
  const clock = [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  return clock + '.' + String(Math.floor(duration % 1000 / 10)).padStart(2, '0');
}

const lessons = [
  {
    title: '一个电箱，一组设施',
    text: '每个电箱都要配一组路灯，每组也只配一个电箱。单体占一格。双格横着或竖着占两格，其中一格与电箱上下左右紧挨着就能配对。斜对角不能配对。',
    label: '左侧单体和右侧双格分别与各自的电箱相邻',
    boxes: [4, 7], lamps: [0, 2, 3], pair: [2, 3], connections: [[0, 4], [3, 7]]
  },
  {
    title: '给不同设施留出间隔',
    text: '不同组的路灯不能上下、左右或斜对角相邻。图中左侧两盏单体斜着相邻，标红表示冲突。右侧的两格属于同一组双格路灯，可以相接。',
    label: '左侧两盏独立的路灯对角相邻，标红表示冲突',
    lamps: [0, 5, 3, 7], pair: [3, 7], conflict: [0, 5]
  },
  {
    title: '行列数字数的是格子',
    text: '上方数字对应列，左侧数字对应行。横向双格在同一行计 2，经过的两列各计 1。纵向双格在两行各计 1。数字为 0 的行或列不用装灯，即使那里有电箱。',
    label: '一组横向双格路灯占据同一行，所在行提示为二，经过的两列提示各为一',
    lamps: [5, 6], boxes: [9], pair: [5, 6], rows: [0, 2, 0], cols: [0, 1, 1, 0]
  },
  {
    title: '安装、排除与重置',
    text: '选择单体后点一格。选择双格后，切换横向或纵向，点第一格，再点高亮的相邻格。双击任一格可拆除整组。× 可标记空格，重置会清除设施和标记，计时继续。',
    label: '棋盘上有电箱、单体路灯、排除标记以及待选中的双格位置',
    boxes: [4], lamps: [0], marks: [6, 8], selected: [10, 11]
  }
];

function diagram(lesson) {
  const svg = node('div', 'rule-diagram');
  const size = 32, startX = 46, startY = 26;
  let art = '';
  const x = index => startX + (index % 4) * size;
  const y = index => startY + Math.floor(index / 4) * size;
  for (let index = 0; index < 12; index++) {
    const box = lesson.boxes?.includes(index);
    const lamp = lesson.lamps?.includes(index);
    const conflict = lesson.conflict?.includes(index);
    const selected = lesson.selected?.includes(index);
    const fill = box ? '#142336' : conflict ? '#563237' : lamp ? '#4a3c29' : '#25384d';
    const stroke = selected ? ' stroke="#c4a36a" stroke-dasharray="3 2"' : '';
    art += '<rect x="' + x(index) + '" y="' + y(index) + '" width="29" height="29" rx="3" fill="' + fill + '"' + stroke + '/>';
    if (lamp || box) {
      art += '<use href="#' + (lamp ? 'lamp-icon' : 'box-icon') + '" width="23" height="23" x="' + (x(index) + 3) +
        '" y="' + (y(index) + 3) + '" color="' + (box ? '#a5c0d3' : conflict ? '#f28b82' : '#ffd479') + '"/>';
    }
    if (lesson.marks?.includes(index)) {
      art += '<text x="' + (x(index) + 14) + '" y="' + (y(index) + 19) + '" fill="#a5b2c4">×</text>';
    }
  }
  if (lesson.pair) {
    const [a, b] = lesson.pair;
    if (b-a === 1) art += '<path d="M' + (x(a)+28) + ' ' + (y(a)+14) + 'h6" stroke="#ffd479" stroke-width="3"/>';
    else art += '<path d="M' + (x(a)+14) + ' ' + (y(a)+28) + 'v6" stroke="#ffd479" stroke-width="3"/>';
  }
  for (const [a, b] of lesson.connections ?? []) {
    art += '<path d="M' + (x(a)+14) + ' ' + (y(a)+26) + 'V' + (y(b)+3) +
      '" stroke="#74d6ae" stroke-width="2" stroke-dasharray="2 2"/>';
  }
  lesson.cols?.forEach((value, i) => { art += '<text x="' + (x(i)+14) + '" y="20">' + value + '</text>'; });
  lesson.rows?.forEach((value, i) => { art += '<text x="34" y="' + (y(i*4)+19) + '">' + value + '</text>'; });
  svg.innerHTML = '<svg viewBox="0 0 218 142" role="img" aria-label="' + lesson.label +
    '" xmlns="http://www.w3.org/2000/svg"><g fill="#a5b2c4" font-size="12" font-family="monospace" text-anchor="middle">' +
    art + '</g></svg>';
  return svg;
}

const firstMoves = [
  '先标记数字为 0 的行和列。这些位置一定不装灯。',
  '查看电箱上下左右，优先考虑只剩一个可连接位置的电箱。这个位置仍可能属于一组双格路灯。',
  '对照行列数字。提示为 1 的行放不下一组横向双格。装好一组后，检查它周围八个方向，再填写剩余格子。'
];

const questions = [
  ['必须用完库存吗？', '每局最多使用 7 盏单体和 2 组双格。比如有 5 个电箱，就需要 5 组设施。若用了 4 盏单体和 1 组双格，就会占用 6 格。剩余库存可以留着。'],
  ['一组路灯靠近两个电箱，可以吗？', '可以。每组最终只能配给其中一个电箱，另一个电箱必须有自己的设施。'],
  ['行列数字都对了，为什么还没通关？', '再检查每个电箱是否都能一一配对，双格是否占了连续两格，以及不同设施之间有没有接触。全部满足时会自动通关。'],
  ['每日挑战什么时候更新？', '北京时间每天 00:00 换图。同一天所有玩家使用同一张地图，每张正式地图都经过唯一解验证。通关后可提交名字加入当日排行榜。']
];

function expand(label, content, open = false) {
  const details = node('details', 'rule-details');
  details.open = open;
  details.append(node('summary', '', label), content);
  return details;
}

export function renderRules(body, { actionLabel, onAction, disabled }) {
  const lead = node('p', 'rules-lead',
    '城市有些街道失去了照明。你的任务是在 8×8 地图上，给每个固定电箱配一组路灯，同时满足行列数字和安全间隔。');
  const grid = node('div', 'rules-grid');
  for (const lesson of lessons) {
    const figure = node('figure', 'rule-figure');
    const caption = node('figcaption');
    caption.append(node('h3', '', lesson.title), node('p', '', lesson.text));
    figure.append(diagram(lesson), caption);
    grid.append(figure);
  }
  const steps = node('ol', 'rule-steps');
  for (const step of firstMoves) steps.append(node('li', '', step));
  const faq = node('section', 'rule-faq');
  faq.append(node('h3', '', '常见问题'));
  for (const [question, answer] of questions) {
    faq.append(expand(question, node('p', '', answer)));
  }
  const footer = node('div', 'rule-footer');
  const action = node('button', 'primary', actionLabel);
  action.type = 'button';
  action.disabled = disabled;
  action.addEventListener('click', onAction);
  footer.append(action);
  body.replaceChildren(lead, grid, expand('第一步怎么下手？', steps, true), faq, footer);
}

function crown() {
  const wrapper = node('span', 'podium-crown');
  wrapper.innerHTML = '<svg viewBox="0 0 48 36" aria-hidden="true"><path d="M5 10 15 18 24 5 33 18 43 10 38 29H10Z" fill="currentColor" opacity=".23"/><path d="M5 10 15 18 24 5 33 18 43 10 38 29H10ZM12 34h24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="5" cy="9" r="2" fill="currentColor"/><circle cx="24" cy="4" r="2" fill="currentColor"/><circle cx="43" cy="9" r="2" fill="currentColor"/></svg>';
  return wrapper;
}

export function renderRanking(body, result) {
  const { entries, rank } = result;
  const podium = node('div', 'ranking-podium');
  for (const position of [2, 1, 3]) {
    const score = entries[position - 1];
    const entry = node('div', 'podium-place place-' + position);
    entry.append(crown(), node('span', 'podium-rank', '第 ' + position + ' 名'),
      node('strong', 'podium-name', score?.name ?? '—'),
      node('span', 'podium-time', score ? formatTime(score.duration) : '待上榜'));
    podium.append(entry);
  }
  const caption = node('div', 'ranking-caption');
  caption.append(node('h3', '', '通关榜'), node('span', '', rank ? '你的名次 · 第 ' + rank + ' 名' : '按通关用时排序'));
  const list = node('ol', 'ranking-list');
  list.start = 4;
  for (const [index, score] of entries.slice(3).entries()) {
    const row = node('li', 'ranking-row');
    row.append(node('span', 'ranking-position', String(index + 4)),
      node('span', 'ranking-name', score.name), node('time', 'ranking-time', formatTime(score.duration)));
    list.append(row);
  }
  body.replaceChildren(podium, caption);
  body.append(list.childElementCount ? list : node('p', 'ranking-empty',
    entries.length ? '第 4 名起的成绩将在这里显示。' : '今日首位巡灯员尚未登榜。'));
}

export function renderNameForm(body, submit) {
  const form = node('form', 'score-form');
  const label = node('label', '', '排行榜显示名称');
  label.htmlFor = 'player-name';
  const input = node('input', 'player-name');
  input.id = 'player-name';
  input.name = 'playerName';
  input.autocomplete = 'nickname';
  input.placeholder = '输入名字';
  input.maxLength = 40;
  input.required = true;
  const status = node('p', 'score-status');
  status.setAttribute('role', 'status');
  const button = node('button', 'primary score-confirm', '确认并查看排行榜 →');
  button.type = 'submit';
  form.append(label, input, button, status);
  body.replaceChildren(form);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name || [...name].length > 20) {
      status.textContent = '请输入 1–20 个字符。';
      return;
    }
    button.disabled = true;
    status.textContent = '正在提交成绩…';
    try {
      await submit(name);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  return input;
}
