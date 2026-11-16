// A Supabase publishable key is intended for the browser. Private tables stay behind the RPC.
const endpoint = 'https://aapyrzjhefrdnqqacxat.supabase.co/rest/v1/rpc/night_shift_play';
const publishableKey = 'sb_publishable_Ub2kSiTdN4kzdc-UxjqJHw_DwHxR6M9';

export function canonicalLayout(facilities) {
  return facilities.map(group => [...group].sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}

export async function pagesApi(path, data, map) {
  let payload;
  if (path.startsWith('ranking?')) {
    payload = { p_action: 'ranking', p_date: new URLSearchParams(path.split('?')[1]).get('date') };
  } else if (path === 'attempts') {
    payload = { p_action: 'start', p_date: data.date };
  } else {
    const [, id, type] = path.split('/');
    payload = type === 'finish'
      ? { p_action: 'finish', p_id: id, p_solution: canonicalLayout(data.facilities) }
      : { p_action: 'score', p_id: id, p_name: data.name };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.code === 'P0001' ? result.message : '排行榜服务暂时不可用，请重试。');
  }
  return payload.p_action === 'start' ? { ...result, map } : result;
}
