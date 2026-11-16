import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function localStore(env) {
  const file = env.SCORE_FILE ? resolve(env.SCORE_FILE) :
    fileURLToPath(new URL('./.night-shift-scores.json', import.meta.url));
  const pending = file + '.tmp';
  let scores;
  try {
    scores = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    scores = {};
  }
  return {
    name: '本地文件',
    ranking(date, id) {
      const sorted = [...(scores[date] ?? [])].sort((a, b) => a.duration - b.duration);
      const index = id ? sorted.findIndex(entry => entry.id === id) : -1;
      return {
        entries: sorted.map(({ name, duration }) => ({ name, duration })),
        rank: index < 0 ? null : index + 1
      };
    },
    save(date, entry) {
      const existing = scores[date] ?? [];
      if (existing.some(score => score.id === entry.id)) return;
      const next = { ...scores, [date]: [...existing, entry] };
      writeFileSync(pending, JSON.stringify(next) + '\n', { mode: 0o600 });
      renameSync(pending, file);
      scores = next;
    }
  };
}

export function createScoreStore(env = process.env, fetchApi = fetch) {
  const url = env.SUPABASE_URL?.trim();
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  const legacy = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = secret || legacy;
  if (!url && !key) return localStore(env);
  if (!url || !key) throw new Error('需要同时配置 SUPABASE_URL 和服务端密钥。');
  const project = new URL(url);
  if (project.protocol !== 'https:' || project.username || project.password ||
      project.search || project.hash || project.pathname !== '/') {
    throw new Error('SUPABASE_URL 应为 Supabase 项目 HTTPS 地址。');
  }
  if (secret ? !secret.startsWith('sb_secret_') : !/^eyJ[\w.-]+\.[\w.-]+\.[\w-]+$/.test(legacy)) {
    throw new Error('请配置 Supabase 服务端 Secret key 或旧版 service_role key。');
  }

  async function request(path, payload, prefer) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (!secret) headers.Authorization = 'Bearer ' + key;
    if (prefer) headers.Prefer = prefer;
    const response = await fetchApi(new URL('/rest/v1/' + path, project), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      redirect: 'error'
    });
    if (!response.ok) {
      throw new Error('Supabase 排行榜请求失败（HTTP ' + response.status + '）。');
    }
    if (response.status !== 204 && !prefer) return response.json();
  }

  return {
    name: 'Supabase',
    ranking(date, id) {
      return request('rpc/night_shift_ranking', { p_date: date, p_attempt_id: id ?? null });
    },
    save(date, { id, name, duration }) {
      return request('night_shift_scores?on_conflict=id', {
        id, challenge_date: date, player_name: name, duration_ms: duration
      }, 'resolution=ignore-duplicates,return=minimal');
    }
  };
}
