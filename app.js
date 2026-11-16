import { solve } from './puzzle.mjs';
import { mountGame } from './game.mjs';
import { config } from './config.mjs';
import { renderRules, renderRanking, renderNameForm } from './dialogs.mjs';

const home = document.querySelector('#home');
const game = document.querySelector('#game');
const start = document.querySelector('#start');
const dialog = document.querySelector('#dialog');
const mount = document.querySelector('#game-mount');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const beijing = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});
const dayMs = 86400000;
let daily;
let changing = false;
let cleanup;
let midnight;
let toggleScene = () => {};
let dialogRequest = 0;
let liveRanking = false;
let maps = {};
let loading = true;
let mapRequest;

function loadMaps() {
  if (mapRequest) return mapRequest;
  mapRequest = (async () => {
    try {
      const response = await fetch(config.mapSource, { cache: 'no-cache' });
      if (!response.ok) throw new Error('无法读取每日地图');
      const entries = await response.json();
      maps = Object.fromEntries(Object.entries(entries).filter(([, map]) => solve(map).length === 1));
    } catch (error) {
      console.error(error);
    } finally {
      loading = false;
      mapRequest = null;
      refreshDaily();
    }
  })();
  return mapRequest;
}

function refreshDaily() {
  const now = new Date();
  const parts = Object.fromEntries(beijing.formatToParts(now).map(({ type, value }) => [type, value]));
  const date = [parts.year, parts.month, parts.day].join('-');
  const dateStamp = Date.parse(date);
  const day = Math.floor((dateStamp - Date.parse(config.startDate)) / dayMs) + 1;
  const map = maps[date];
  const published = day > 0 && Boolean(map);
  const rankingDateChanged = daily?.date !== date || daily?.published !== published;
  daily = { date, day, map, published };
  document.querySelector('#day').textContent = day > 0 ? String(day).padStart(3, '0') : '—';
  const stamp = document.querySelector('#date');
  stamp.dateTime = date;
  stamp.textContent = date.replaceAll('-', '.');
  document.querySelector('#availability').textContent = loading ? '正在读取地图…' :
    published ? '' : '今日挑战尚未开放。';
  start.disabled = !published;
  clearTimeout(midnight);
  midnight = setTimeout(() => { refreshDaily(); loadMaps(); }, dateStamp + dayMs - 8*3600000 - now.getTime() + 100);
  if (rankingDateChanged && liveRanking && dialog.open) {
    showRanking(daily, undefined, true);
  }
  return daily;
}

function fade() {
  return reducedMotion.matches ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, 240));
}

async function navigate(from, to, beforeShow, focus) {
  if (changing) return;
  changing = true;
  from.inert = true;
  from.classList.add('faded');
  await fade();
  if (await beforeShow() === false) {
    from.inert = false;
    from.classList.remove('faded');
    changing = false;
    return;
  }
  from.hidden = true;
  to.classList.add('faded');
  to.inert = true;
  to.hidden = false;
  void to.offsetWidth;
  to.classList.remove('faded');
  await fade();
  changing = false;
  to.inert = false;
  focus.focus({ preventScroll: true });
}

async function api(path, data) {
  let response;
  try {
    response = await fetch('./api/' + path, data === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
  } catch {
    throw new Error('无法连接成绩服务，请重试。');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || '服务暂时不可用，请重试。');
  return result;
}

start.addEventListener('click', () => {
  if (!refreshDaily().published) return;
  navigate(home, game, async () => {
    const challenge = refreshDaily();
    if (!challenge.published) return false;
    document.querySelector('#availability').textContent = '正在打开今日地图…';
    try {
      const attempt = await api('attempts', { date: challenge.date });
      let result, facilities, finish;
      const recordFinish = () => api('attempts/' + attempt.id + '/finish', { facilities });
      const openResult = () => {
        if (result) {
          showRanking(challenge, result);
          return;
        }
        const body = openDialog('score', '巡灯完成', challenge);
        const request = dialogRequest;
        renderNameForm(body, async name => {
          if (!await finish) {
            finish = recordFinish().catch(() => null);
            if (!await finish) throw new Error('暂时无法记录通关，请重试。');
          }
          result = await api('attempts/' + attempt.id + '/score', { name });
          if (dialog.open && request === dialogRequest) showRanking(challenge, result);
        }).focus();
      };
      cleanup = mountGame(mount, attempt.map, {
        onComplete(solution) {
          if (!facilities) {
            facilities = solution;
            finish = recordFinish().catch(() => null);
          }
          openResult();
        },
        onShowResult: openResult
      });
    } catch (error) {
      mount.replaceChildren();
      document.querySelector('#availability').textContent = error.message || '今日地图暂时无法载入，请重试。';
      return false;
    }
    document.querySelector('#game-label').textContent = 'DAY ' + String(challenge.day).padStart(3, '0');
    document.querySelector('#availability').textContent = '';
    toggleScene(false);
    window.scrollTo(0, 0);
  }, document.querySelector('#game-title-board'));
});

document.querySelector('#back').addEventListener('click', () => {
  navigate(game, home, () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    mount.replaceChildren();
    refreshDaily();
    toggleScene(true);
    window.scrollTo(0, 0);
  }, start.disabled ? document.querySelector('.wordmark') : start);
});

function openDialog(type, title, challenge) {
  dialogRequest++;
  liveRanking = false;
  dialog.dataset.view = type;
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-kicker').textContent = type === 'rules' ? 'NIGHT SHIFT · V4.0' :
    'DAY ' + String(challenge.day).padStart(3, '0') + ' / ' + challenge.date.replaceAll('-', '.');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  return document.querySelector('#dialog-content');
}

async function showRanking(challenge, result, followToday = false) {
  const title = followToday || challenge.date === daily?.date ? '今日排行榜' : '当日排行榜';
  const body = openDialog('ranking', title, challenge);
  liveRanking = followToday;
  document.querySelector('#close-dialog').focus({ preventScroll: true });
  const request = dialogRequest;
  if (result) {
    renderRanking(body, result);
    return;
  }
  body.textContent = challenge.published ? '正在载入…' : '今日挑战尚未开放。';
  if (!challenge.published) return;
  try {
    const scores = await api('ranking?date=' + encodeURIComponent(challenge.date));
    if (request === dialogRequest && dialog.open) renderRanking(body, scores);
  } catch (error) {
    if (request === dialogRequest && dialog.open) body.textContent = error.message;
  }
}

for (const button of document.querySelectorAll('[data-dialog]')) {
  button.addEventListener('click', () => {
    if (button.dataset.dialog === 'rules') {
      const onHome = game.hidden;
      renderRules(openDialog('rules', '游戏规则'), {
        actionLabel: onHome ? '开始挑战 →' : '返回棋盘 →',
        disabled: onHome && start.disabled,
        onAction: () => {
          dialog.close();
          if (onHome) start.click();
        }
      });
    } else {
      showRanking(refreshDaily(), undefined, true);
    }
  });
}
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  dialogRequest++;
  liveRanking = false;
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { refreshDaily(); loadMaps(); }
});
refreshDaily();
loadMaps();
if (!new URLSearchParams(location.search).has('static')) {
  import('./scene.js').then(({ mountScene }) => {
    toggleScene = mountScene(document.querySelector('#render-surface'), start);
    toggleScene(game.hidden);
  }).catch(error => console.info('使用静态夜景', error.message));
}
