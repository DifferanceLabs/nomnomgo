type Events = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
type RefreshOptions = {
  ready?: () => boolean;
  page?: Events & { readonly hidden: boolean };
  window?: Events;
  schedule?: typeof setTimeout;
  cancel?: typeof clearTimeout;
};

// A skipped tick must not stop polling. Phone browsers also restore pages via
// pageshow/online, without necessarily issuing a new window focus event.
export function startForegroundRefresh(run: () => Promise<void>, options: RefreshOptions = {}) {
  const page = options.page ?? (typeof document !== 'undefined' ? document : undefined);
  const target = options.window ?? (typeof window !== 'undefined' ? window : undefined);
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  let active = true;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = () => { if (active) timer = schedule(() => { void refresh(); }, 5000); };
  const refresh = async () => {
    if (!active || running) return;
    cancel(timer);
    if (page?.hidden || (options.ready && !options.ready())) { later(); return; }
    running = true;
    try { await run(); }
    finally { running = false; later(); }
  };
  const wake = () => { void refresh(); };
  for (const name of ['focus', 'pageshow', 'online']) target?.addEventListener(name, wake);
  page?.addEventListener('visibilitychange', wake);
  wake();
  return {
    refresh: wake,
    stop() {
      active = false; cancel(timer);
      for (const name of ['focus', 'pageshow', 'online']) target?.removeEventListener(name, wake);
      page?.removeEventListener('visibilitychange', wake);
    },
  };
}
