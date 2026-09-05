import LocalStorage from '@react-native-async-storage/async-storage';

export type AlphaAccount = { id: string; email: string; isAdmin: boolean };
type Entry = { value: string | null; version: number };
const cloudKeys = new Set([
  'thingsNearbyGooglePlacesMemoryV1', 'nomNomGoSavedPlansV1', 'nomNomGoBetaPlansV1',
  'nomNomGoActiveBetaPlanV1', 'nomNomGoPlanningSessionsV1', 'nomNomGoActivePlanningSessionV1',
  'nomNomGoUsageMeterV1',
]);
let account: AlphaAccount | null = null;
let state: Record<string, Entry> = {};
let queue: Promise<void> = Promise.resolve();
let saveError = '';
const listeners = new Set<(error: string) => void>();

export async function accountRequest<T>(body?: Record<string, unknown>, method = body ? 'POST' : 'GET'): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/account', {
      method, credentials: 'include', signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || 'Your account could not be reached. Please try again.'), { status: response.status });
    return result as T;
  } finally { clearTimeout(timer); }
}

export async function initializeAlphaAccount() {
  const result = await accountRequest<{ user: AlphaAccount; state: Record<string, Entry> }>();
  if (!result.user?.id || !result.user.email || !result.state) throw new Error('Please sign in again.');
  account = result.user;
  state = result.state;
  queue = Promise.resolve();
  saveError = '';
}

export function getAlphaAccount() { return account; }
export function subscribeAccountSaveError(listener: (error: string) => void) {
  listeners.add(listener);
  listener(saveError);
  return () => { listeners.delete(listener); };
}

export async function signOutAlphaAccount() {
  await queue.catch(() => undefined);
  await accountRequest(undefined, 'DELETE');
  account = null;
  state = {};
}

function localKey(key: string) { return account ? `nng:${account.id}:${key}` : key; }

async function write(key: string, value: string | null) {
  if (!account || !cloudKeys.has(key)) {
    if (value === null) await LocalStorage.removeItem(localKey(key));
    else await LocalStorage.setItem(localKey(key), value);
    return;
  }
  const operation = queue.then(async () => {
    // Following any failed/uncertain write, require a reload before another edit.
    // This prevents stale in-memory state from overwriting another device's data.
    if (saveError) throw new Error(saveError);
    const result = await accountRequest<{ version: number }>({
      action: 'save', key, value, version: state[key]?.version || 0,
    });
    state[key] = { value, version: result.version };
  });
  queue = operation.catch((error: unknown) => {
    saveError = `${error instanceof Error ? error.message : 'Your account could not be saved.'} Reload to recover the last cloud save before continuing.`;
    listeners.forEach((listener) => listener(saveError));
  });
  return operation;
}

// Hosted web uses the verified account. Local web/Expo keep existing local storage.
// Old prototype tester data is deliberately not imported into a real account.
export default {
  async getItem(key: string): Promise<string | null> {
    if (account && key === 'nomNomGoSelectedTesterV1') return JSON.stringify({ name: account.email });
    if (account && cloudKeys.has(key)) return state[key]?.value ?? null;
    return LocalStorage.getItem(localKey(key));
  },
  setItem: (key: string, value: string) => write(key, value),
  removeItem: (key: string) => write(key, null),
};
