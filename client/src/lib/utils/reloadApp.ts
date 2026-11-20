type ReloadEnvironment = {
  serviceWorker: ServiceWorkerContainer | null;
  reload: () => void;
  timeoutMs?: number;
};

let recoveryInFlight: Promise<void> | null = null;

/**
 * Only an explicit recovery action may activate a waiting app update. A plain
 * reload can otherwise keep serving an old cached shell with deleted chunks.
 * Never activate/reload in the background, especially during a live auction.
 * Rapid repeated clicks share one update check, activation, and reload.
 */
export function reloadApp(environment?: ReloadEnvironment): Promise<void> {
  if (recoveryInFlight) return recoveryInFlight;
  const attempt = performReload(environment);
  recoveryInFlight = attempt;
  const clear = () => {
    if (recoveryInFlight === attempt) recoveryInFlight = null;
  };
  void attempt.then(clear, clear);
  return attempt;
}

function performReload(environment?: ReloadEnvironment): Promise<void> {
  let serviceWorker = environment?.serviceWorker ?? null;
  if (!environment) {
    try {
      serviceWorker = navigator.serviceWorker ?? null;
    } catch {
      // Restricted browser contexts can deny access to the worker container.
    }
  }
  const container = serviceWorker;
  const reload = environment?.reload ?? (() => window.location.reload());
  return new Promise((resolve) => {
    let finished = false;
    const cleanup: Array<() => void> = [];
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      cleanup.forEach((remove) => remove());
      reload();
      resolve();
    };
    // Broken/offline/stalled worker updates must not trap the recovery button.
    const deadline = setTimeout(finish, environment?.timeoutMs ?? 2500);
    const listen = (
      target: EventTarget,
      event: string,
      callback: () => void,
    ) => {
      target.addEventListener(event, callback);
      cleanup.push(() => target.removeEventListener(event, callback));
    };
    const prepare = async () => {
      const registration = await container?.getRegistration();
      if (finished) return;
      if (!registration || !container) return finish();
      const activate = () => {
        if (finished) return;
        const waiting = registration.waiting;
        if (!waiting) return finish();
        listen(container, "controllerchange", finish);
        waiting.postMessage({ type: "SKIP_WAITING" });
      };
      if (registration.waiting) return activate();
      await registration.update();
      if (finished) return;
      if (registration.waiting) return activate();
      const installing = registration.installing;
      if (!installing) return finish();
      const onState = () => {
        if (installing.state === "installed") activate();
        else if (installing.state === "redundant") finish();
      };
      listen(installing, "statechange", onState);
      onState();
    };
    void prepare().catch(finish);
  });
}
