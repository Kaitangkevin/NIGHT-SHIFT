import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createScoreStore } from './scores.mjs';
import { inspect, solve } from './puzzle.mjs';
import { config } from './config.mjs';

const root = new URL('./', import.meta.url);
const leaderboard = createScoreStore();
const attempts = new Map();
const attemptLifetime = 48 * 60 * 60 * 1000;
const timezone = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', dateStyle: 'short' });
const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  request.setEncoding('utf8');
  let data = '';
  for await (const chunk of request) {
    data += chunk;
    if (data.length > 8192) throw new HttpError(413, '请求内容过大。');
  }
  try {
    return JSON.parse(data);
  } catch {
    throw new HttpError(400, '请求格式有误。');
  }
}

const mime = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  json: 'application/json; charset=utf-8'
};
const files = new Set([
  'index.html', 'style.css', 'app.js', 'config.mjs', 'game.mjs', 'puzzle.mjs', 'scene.js',
  'dialogs.mjs', 'maps.json', 'assets/favicon.svg', 'assets/scene-desktop.webp', 'assets/scene-mobile.webp', 'assets/three.module.min.js'
]);

async function route(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const { pathname } = url;
  if (pathname === '/api/ranking' && request.method === 'GET') {
    const date = url.searchParams.get('date');
    if (!dateFormat.test(date ?? '')) throw new HttpError(400, '日期无效。');
    return send(response, 200, await leaderboard.ranking(date));
  }
  if (pathname === '/api/attempts' && request.method === 'POST') {
    const { date } = (await readBody(request)) ?? {};
    const today = timezone.format(new Date());
    if (date !== today || date < config.startDate) throw new HttpError(409, '日期已更新，请重新开始今日挑战。');
    const maps = JSON.parse(readFileSync(new URL(config.mapSource, root), 'utf8'));
    const map = maps[date];
    if (solve(map).length !== 1) throw new HttpError(404, '今日挑战尚未开放。');
    const now = Date.now(), id = randomUUID();
    for (const [key, run] of attempts) {
      if (now - run.started > attemptLifetime) attempts.delete(key);
    }
    attempts.set(id, { started: now, date, map });
    return send(response, 201, { id, map });
  }
  const action = pathname.match(/^\/api\/attempts\/([a-f0-9-]+)\/(finish|score)$/);
  if (action && request.method === 'POST') {
    const [, id, type] = action;
    const attempt = attempts.get(id);
    if (!attempt || Date.now() - attempt.started > attemptLifetime) {
      throw new HttpError(404, '本局记录已过期，请重新开始挑战。');
    }
    const body = await readBody(request);
    if (type === 'finish') {
      const facilities = body?.facilities;
      if (!Array.isArray(facilities) || facilities.length > 9 ||
          !facilities.every(group => Array.isArray(group) && group.length >= 1 && group.length <= 2 &&
            group.every(Number.isInteger)) || !inspect(attempt.map, facilities).complete) {
        throw new HttpError(400, '棋盘尚未满足通关条件。');
      }
      attempt.duration ??= Math.max(0, Date.now() - attempt.started);
      return send(response, 200, { duration: attempt.duration });
    }
    if (attempt.duration === undefined) throw new HttpError(409, '请先完成挑战。');
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || [...name].length > 20 || /[\p{Cc}\p{Cf}]/u.test(name)) {
      throw new HttpError(400, '请输入 1–20 个可显示字符。');
    }
    await leaderboard.save(attempt.date, { id, name, duration: attempt.duration });
    return send(response, 200, await leaderboard.ranking(attempt.date, id));
  }
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['GET', 'HEAD'].includes(request.method) || !files.has(file)) throw new HttpError(404, '页面不存在。');
  const content = readFileSync(new URL(file, root));
  response.writeHead(200, {
    'Content-Type': mime[file.split('.').at(-1)],
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(request.method === 'HEAD' ? undefined : content);
}

createServer((request, response) => {
  route(request, response).catch(error => {
    if (!(error instanceof HttpError)) console.error(error);
    if (!response.headersSent) send(response, error.status ?? 500, {
      error: error.status ? error.message : '服务暂时不可用，请重试。'
    });
  });
}).listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1', function () {
  console.log('NIGHT SHIFT · http://' + this.address().address + ':' + this.address().port + '/');
  console.log('排行榜存储 · ' + leaderboard.name);
});
