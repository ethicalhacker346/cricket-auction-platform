import { useCallback, useEffect, useRef, useState } from "react";
import "@fontsource-variable/geist";
import { motion, useReducedMotion } from "framer-motion";

type OpeningLandingPageProps = {
  /** How long the intro remains visible before revealing the app, in milliseconds. */
  duration?: number;
  /** Called once when the intro has finished or is skipped with Escape. */
  onComplete: () => void;
  /** Public URL for the logo. Defaults to the supplied asset in /public. */
  logoSrc?: string;
};

/**
 * The GullyBid opening mark.
 *
 * This intentionally contains only the brand mark and its creator credit. It
 * is mounted outside <Routes>, letting the destination route resolve behind it
 * with no visible authentication/redirect flash.
 */
export default function OpeningLandingPage({
  duration = 1000,
  onComplete,
  logoSrc = "/landingimage.png",
}: OpeningLandingPageProps) {
  const reducedMotion = useReducedMotion();
  const [isExiting, setIsExiting] = useState(false);
  const exitStarted = useRef(false);
  const latestOnComplete = useRef(onComplete);

  useEffect(() => {
    latestOnComplete.current = onComplete;
  }, [onComplete]);

  const startExit = useCallback(() => {
    if (exitStarted.current) return;
    exitStarted.current = true;
    setIsExiting(true);
  }, []);

  useEffect(() => {
    // Keep the reveal concise for people who have requested reduced motion.
    const visibleFor = reducedMotion ? Math.min(duration, 900) : duration;
    const timer = window.setTimeout(startExit, visibleFor);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") startExit();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [duration, reducedMotion, startExit]);

  useEffect(() => {
    if (!isExiting) return;

    // Let the logo complete its deliberate "vanishing into the arena" motion
    // before unmounting the overlay and exposing the resolved app route.
    const timer = window.setTimeout(latestOnComplete.current, reducedMotion ? 80 : 880);
    return () => window.clearTimeout(timer);
  }, [isExiting, reducedMotion]);

  return (
    <motion.main
      aria-label="GullyBid opening experience"
      className={`gb-intro fixed inset-0 z-[100] grid min-h-dvh place-items-center overflow-hidden bg-[#010208] text-white${isExiting ? " gb-intro--closing" : ""}`}
      initial={{ opacity: 0 }}
      animate={isExiting
        ? { opacity: 0, filter: "blur(2px)", transition: { duration: reducedMotion ? 0.08 : 0.66, delay: reducedMotion ? 0 : 0.19, ease: [0.65, 0, 0.35, 1] } }
        : { opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      <style>{introStyles}</style>

      {/* Deliberately quiet, premium atmosphere — it supports the mark rather than competing with it. */}
      <div aria-hidden="true" className="gb-intro-grain absolute inset-0" />
      <div aria-hidden="true" className="gb-intro-spotlight absolute left-1/2 top-1/2 h-[min(120vw,1050px)] w-[min(120vw,1050px)] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <div aria-hidden="true" className="gb-intro-ring gb-intro-ring-one" />
      <div aria-hidden="true" className="gb-intro-ring gb-intro-ring-two" />
      <div aria-hidden="true" className="gb-intro-ring gb-intro-ring-three" />
      <div aria-hidden="true" className="gb-intro-line gb-intro-line-left" />
      <div aria-hidden="true" className="gb-intro-line gb-intro-line-right" />
      <div aria-hidden="true" className="gb-intro-vignette absolute inset-0" />
      <motion.div
        aria-hidden="true"
        className="gb-intro-departure absolute left-1/2 top-1/2 z-[15] h-[min(60vw,440px)] w-[min(60vw,440px)] rounded-full"
        initial={false}
        animate={isExiting
          ? { x: "-50%", y: "-50%", opacity: [0, 0.9, 0], scale: [0.08, 1.1, 2.45], transition: { duration: reducedMotion ? 0.08 : 0.72, ease: [0.16, 1, 0.3, 1] } }
          : { x: "-50%", y: "-50%", opacity: 0, scale: 0.08 }}
      />

      <section className="relative z-10 flex w-full flex-col items-center px-5 pb-24 pt-8 sm:px-8 sm:pb-28">
        <motion.div
          className="relative flex aspect-square w-[min(92vw,680px)] items-center justify-center"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8, filter: "blur(12px)" }}
          animate={isExiting
            ? { opacity: 0, scale: 0.038, y: -3, rotate: -1.5, filter: "blur(1px)", transition: { duration: reducedMotion ? 0.08 : 0.8, ease: [0.74, 0, 0.26, 1] } }
            : { opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={!isExiting ? { duration: reducedMotion ? 0.01 : 1.15, delay: reducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] } : undefined}
        >
          <motion.div
            aria-hidden="true"
            className="gb-intro-aura absolute inset-[14%] rounded-full"
            animate={isExiting
              ? { scale: [0.95, 1.42, 2.6], opacity: [0.3, 0.88, 0], transition: { duration: reducedMotion ? 0.08 : 0.68, ease: "easeOut" } }
              : reducedMotion ? undefined : { scale: [0.96, 1.07, 0.96], opacity: [0.55, 0.92, 0.55] }}
            transition={isExiting ? undefined : { duration: 4.8, ease: "easeInOut", repeat: Infinity }}
          />

          {/* The supplied black logo background melts into the canvas with screen blending. */}
          <img
            src={logoSrc}
            alt="GullyBid — Cricket Auction OS"
            className="gb-intro-logo relative z-10 h-full w-full select-none object-contain"
            draggable={false}
          />

          <motion.div
            aria-hidden="true"
            className="gb-intro-glint pointer-events-none absolute z-20 overflow-hidden rounded-[42%]"
            style={{ skewX: -20 }}
            initial={{ x: "-132%", opacity: 0 }}
            animate={reducedMotion ? { opacity: 0 } : { x: "142%", opacity: [0, 0.78, 0] }}
            transition={{ duration: 1.45, delay: 1.12, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div>
      </section>

      <motion.footer
        className="absolute bottom-7 left-1/2 z-20 flex flex-col items-center text-center sm:bottom-9"
        initial={reducedMotion ? { x: "-50%", opacity: 1 } : { x: "-50%", opacity: 0, y: 12 }}
        animate={isExiting
          ? { x: "-50%", opacity: 0, y: 20, scale: 0.9, filter: "blur(2px)", transition: { duration: reducedMotion ? 0.08 : 0.35, ease: "easeIn" } }
          : { x: "-50%", opacity: 1, y: 0 }}
        transition={!isExiting ? { duration: reducedMotion ? 0.01 : 0.65, delay: reducedMotion ? 0 : 1.12, ease: [0.16, 1, 0.3, 1] } : undefined}
      >
        <span className="gb-credit-label">CREATED BY</span>
        <div className="mt-2 flex items-baseline justify-center gap-2.5 whitespace-nowrap sm:gap-3">
          <strong className="gb-credit-name">VENKAT SAI</strong>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#d9a82a]" />
          <em className="gb-credit-tag">the HitMan</em>
        </div>
      </motion.footer>

      {/* No visible interface clutter. Escape still provides a respectful fast path. */}
      <button type="button" onClick={startExit} className="sr-only" aria-label="Skip GullyBid opening experience">
        Skip opening experience
      </button>
    </motion.main>
  );
}

const introStyles = `
  .gb-intro {
    font-family: Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    isolation: isolate;
  }
  .gb-intro-grain {
    z-index: 1;
    opacity: .105;
    pointer-events: none;
    mix-blend-mode: soft-light;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.92' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.58'/%3E%3C/svg%3E");
  }
  .gb-intro-spotlight {
    z-index: 0;
    pointer-events: none;
    background: radial-gradient(circle, rgba(205, 153, 34, .14) 0%, rgba(157, 107, 18, .07) 26%, rgba(14, 19, 35, .065) 48%, transparent 68%);
    filter: blur(9px);
    animation: gb-breathe 6s ease-in-out infinite;
  }
  .gb-intro-vignette {
    z-index: 8;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 31%, rgba(1, 2, 8, .27) 67%, rgba(0, 1, 5, .9) 100%);
  }
  .gb-intro-departure {
    pointer-events: none;
    border: 1px solid rgba(255, 218, 111, .9);
    background: radial-gradient(circle, rgba(255, 246, 194, .92) 0%, rgba(255, 194, 52, .47) 12%, rgba(235, 152, 24, .16) 32%, transparent 68%);
    box-shadow: 0 0 24px rgba(255, 205, 74, .9), 0 0 110px rgba(236, 164, 35, .52), inset 0 0 56px rgba(255, 241, 180, .48);
    mix-blend-mode: screen;
  }
  .gb-intro-ring {
    position: absolute;
    z-index: 2;
    left: 50%;
    top: 50%;
    border: 1px solid rgba(221, 170, 47, .17);
    border-radius: 999px;
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition: opacity .42s ease-out;
    mask-image: linear-gradient(110deg, transparent 0%, black 23%, black 74%, transparent 100%);
    -webkit-mask-image: linear-gradient(110deg, transparent 0%, black 23%, black 74%, transparent 100%);
  }
  .gb-intro-ring-one { width: min(92vw, 786px); height: min(92vw, 786px); animation: gb-rotate 26s linear infinite; }
  .gb-intro-ring-two { width: min(109vw, 935px); height: min(72vw, 618px); border-color: rgba(177, 194, 222, .095); transform: translate(-50%, -50%) rotate(48deg); animation: gb-rotate-reverse 35s linear infinite; }
  .gb-intro-ring-three { width: min(77vw, 660px); height: min(106vw, 905px); border-color: rgba(238, 197, 84, .1); transform: translate(-50%, -50%) rotate(-32deg); animation: gb-rotate 31s linear infinite; }
  .gb-intro-line {
    position: absolute;
    z-index: 3;
    top: 50%;
    width: 26vw;
    height: 1px;
    pointer-events: none;
    opacity: .38;
    transition: opacity .32s ease-out, transform .58s cubic-bezier(.74, 0, .26, 1);
  }
  .gb-intro--closing .gb-intro-ring { opacity: 0; }
  .gb-intro--closing .gb-intro-line { opacity: 0; transform: scaleX(.05); }
  .gb-intro-line-left { left: 0; background: linear-gradient(90deg, transparent, rgba(235, 184, 54, .55), transparent); }
  .gb-intro-line-right { right: 0; background: linear-gradient(90deg, transparent, rgba(235, 184, 54, .55), transparent); }
  .gb-intro-aura {
    background: radial-gradient(circle, rgba(255, 213, 89, .1) 0%, rgba(221, 161, 25, .065) 38%, transparent 70%);
    filter: blur(18px);
  }
  .gb-intro-logo {
    filter: contrast(1.04) saturate(1.06) drop-shadow(0 0 20px rgba(252, 199, 58, .12)) drop-shadow(0 22px 55px rgba(0, 0, 0, .5));
    mix-blend-mode: screen;
  }
  .gb-intro-glint {
    top: 7%;
    bottom: 7%;
    left: -31%;
    right: auto;
    width: 36%;
    background: linear-gradient(102deg, transparent 0%, rgba(255,255,255,0) 17%, rgba(255,255,255,.04) 31%, rgba(255,249,210,.72) 47%, rgba(255,255,255,.08) 61%, transparent 82%);
    filter: blur(2px);
    mix-blend-mode: screen;
  }
  .gb-credit-label {
    color: rgba(184, 195, 215, .58);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .31em;
  }
  .gb-credit-name {
    color: #f0f3fa;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: .19em;
  }
  .gb-credit-tag {
    color: #d9a82a;
    font-size: 11px;
    font-style: italic;
    font-weight: 550;
    letter-spacing: .08em;
  }
  @keyframes gb-breathe { 50% { transform: translate(-50%, -50%) scale(1.075); opacity: .82; } }
  @keyframes gb-rotate { to { transform: translate(-50%, -50%) rotate(360deg); } }
  @keyframes gb-rotate-reverse { to { transform: translate(-50%, -50%) rotate(-312deg); } }
  @media (max-width: 640px) {
    .gb-intro-line { width: 16vw; }
    .gb-credit-label { font-size: 8px; }
    .gb-credit-name, .gb-credit-tag { font-size: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .gb-intro *, .gb-intro *::before, .gb-intro *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
    }
  }
`;
