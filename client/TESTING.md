# Client regression checks

From `client/`, install the locked dependencies and run:

```sh
npm ci
npm run lint:hooks
npm test
npm run build
```

- **`lint:hooks`** checks hook ordering in every `src/**/*.ts` and `.tsx` file,
  including hooks hidden below early returns. It uses a dedicated configuration
  because the legacy default ESLint configuration only includes JavaScript.
- **`test`** runs the React/DOM auction regression suite. `test:watch` runs the
  same tests interactively. No MongoDB, backend server, network access or login
  is required. Socket/API boundaries and WebAudio devices are controlled;
  React, Framer Motion, the live store and engine reconciliation are real.
- **`build`** creates the production client and service worker. Like the
  existing build, it does not run TypeScript typechecking.
- **`typecheck`** invokes the installed TypeScript compiler directly. The
  repository currently has **290 existing diagnostics** outside this repair;
  this command intentionally fails until those are addressed. Do not interpret
  a filtered output, a successful Vite build, or `npx` downloading an unrelated
  package as a successful full-project typecheck.

The tests cover hook order across lot transitions; image fallbacks; fresh vs
historical verdicts; event deduplication and auction-context changes; cross,
Escape, backdrop and automatic dismissal; parent clock updates; consecutive
verdicts and stale callbacks; focus/scroll restoration; portal/fullscreen
lifecycle; sound cancellation and mute synchronization; unavailable audio or
storage; and StrictMode resource cleanup.

Most animation tests skip decorative keyframe duration for determinism.
`SoldUnsoldAnimation.motion.test.tsx` deliberately runs real entrance/exit
animations on real timers in an isolated module graph. It asserts DOM removal,
not merely `aria-hidden`, to detect invisible overlays left over the auction.
Unexpected React console errors also fail tests, even if an error boundary
catches them.

Additional cross-layer contract check, from the repository root after installing
backend dependencies:

```sh
node backend/scripts/verify-socket-contract.mjs
```
