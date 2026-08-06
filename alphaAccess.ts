export const DIFFERANCE_NOMNOMGO_LAUNCH_URL =
  'https://differancelabs.com/api/apps/launch?app=nomnomgo';

export const LAUNCH_TOKEN_PARAM = 'dl_launch_token';

type AlphaAccessResponse = Pick<Response, 'headers' | 'json' | 'ok'>;

export async function responseGrantsAlphaAccess(response: AlphaAccessResponse) {
  if (!response.ok) return false;

  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/json')) return false;

  try {
    const payload: unknown = await response.json();
    return Boolean(
      payload
      && typeof payload === 'object'
      && 'access' in payload
      && payload.access === true,
    );
  } catch {
    return false;
  }
}
