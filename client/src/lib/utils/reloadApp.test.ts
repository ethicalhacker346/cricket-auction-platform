import { expect, it, vi } from "vitest";
import { reloadApp } from "./reloadApp";

function workerFixture() {
  const container = new EventTarget();
  const waiting = { postMessage: vi.fn() };
  const installing = Object.assign(new EventTarget(), { state: "installing" });
  const registration = {
    waiting: waiting as typeof waiting | null,
    installing: null as typeof installing | null,
    update: vi.fn().mockResolvedValue(undefined),
  };
  const getRegistration = vi.fn().mockResolvedValue(registration);
  return {
    container,
    waiting,
    installing,
    registration,
    serviceWorker: Object.assign(container, {
      getRegistration,
    }) as unknown as ServiceWorkerContainer,
    getRegistration,
  };
}

it("reloads normally when service workers are unsupported or no registration exists", async () => {
  const reload = vi.fn();
  await reloadApp({ serviceWorker: null, reload });
  expect(reload).toHaveBeenCalledTimes(1);
  const fixture = workerFixture();
  fixture.getRegistration.mockResolvedValue(undefined);
  await reloadApp({ serviceWorker: fixture.serviceWorker, reload });
  expect(reload).toHaveBeenCalledTimes(2);
});

it("does not activate an update or reload until explicitly invoked, then waits for the controller change", async () => {
  vi.useFakeTimers();
  const { serviceWorker, waiting, container } = workerFixture();
  const reload = vi.fn();
  expect(waiting.postMessage).not.toHaveBeenCalled();
  const result = reloadApp({ serviceWorker, reload });
  await Promise.resolve();
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  expect(reload).not.toHaveBeenCalled();
  container.dispatchEvent(new Event("controllerchange"));
  await result;
  container.dispatchEvent(new Event("controllerchange"));
  expect(reload).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("coalesces rapid recovery actions into one worker activation and reload", async () => {
  const { serviceWorker, waiting, container, getRegistration } =
    workerFixture();
  const reload = vi.fn();
  const first = reloadApp({ serviceWorker, reload });
  const second = reloadApp({ serviceWorker, reload });
  expect(second).toBe(first);
  await Promise.resolve();
  expect(getRegistration).toHaveBeenCalledTimes(1);
  expect(waiting.postMessage).toHaveBeenCalledTimes(1);
  container.dispatchEvent(new Event("controllerchange"));
  await Promise.all([first, second]);
  expect(reload).toHaveBeenCalledTimes(1);
});

it("checks for a new worker before falling back to an ordinary reload", async () => {
  const { serviceWorker, registration } = workerFixture();
  registration.waiting = null;
  const reload = vi.fn();
  await reloadApp({ serviceWorker, reload });
  expect(registration.update).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledTimes(1);
});

it("activates an update that finishes installing during the explicit recovery action", async () => {
  const { serviceWorker, registration, installing, waiting, container } =
    workerFixture();
  registration.waiting = null;
  registration.installing = installing;
  const reload = vi.fn();
  const result = reloadApp({ serviceWorker, reload });
  await Promise.resolve();
  await Promise.resolve();
  expect(reload).not.toHaveBeenCalled();
  registration.waiting = waiting;
  installing.state = "installed";
  installing.dispatchEvent(new Event("statechange"));
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  container.dispatchEvent(new Event("controllerchange"));
  await result;
  expect(reload).toHaveBeenCalledTimes(1);
});

it("bounds stalled updates and ignores late worker events after the single reload", async () => {
  vi.useFakeTimers();
  const { serviceWorker, registration, container } = workerFixture();
  registration.waiting = null;
  let resume!: () => void;
  registration.update.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
  );
  const reload = vi.fn();
  const result = reloadApp({ serviceWorker, reload });
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(2500);
  await result;
  resume();
  await Promise.resolve();
  container.dispatchEvent(new Event("controllerchange"));
  expect(reload).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("still reloads if worker access or update fails", async () => {
  const { serviceWorker, getRegistration } = workerFixture();
  getRegistration.mockRejectedValue(new Error("Storage blocked"));
  const reload = vi.fn();
  await reloadApp({ serviceWorker, reload });
  expect(reload).toHaveBeenCalledTimes(1);
});
