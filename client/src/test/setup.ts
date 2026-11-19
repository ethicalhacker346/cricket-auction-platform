import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterEach, beforeEach, expect, vi } from "vitest";

// Exercise real React + Framer Motion, but don't spend wall-clock time
// rendering decorative keyframes in unit/integration tests.
MotionGlobalConfig.skipAnimations = true;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  // An error boundary returning null must not make a lifecycle test pass
  // accidentally. Unexpected React/runtime errors always fail the suite.
  const errors = vi.mocked(console.error).mock.calls.slice();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.style.overflow = "";
  MotionGlobalConfig.skipAnimations = true;
  expect(errors).toEqual([]);
});
