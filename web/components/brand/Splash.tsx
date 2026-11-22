"use client";

import { useEffect, useState } from "react";
import { LogoSymbol } from "./Logo";

export function Splash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("my-news-splash")) return;
    sessionStorage.setItem("my-news-splash", "shown");
    setVisible(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leave = window.setTimeout(() => setLeaving(true), reduced ? 200 : 900);
    const hide = window.setTimeout(() => setVisible(false), reduced ? 300 : 1150);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`splash ${leaving ? "splashLeaving" : ""}`}
      aria-hidden="true"
    >
      <span className="splashSignal">
        <LogoSymbol className="h-16 w-16 text-indigo-600" />
      </span>
      <strong>My News</strong>
      <span>나만의 소식통</span>
      <style jsx>{`
        .splash {
          align-items: center;
          background: var(--background);
          display: flex;
          flex-direction: column;
          inset: 0;
          justify-content: center;
          position: fixed;
          transition: opacity var(--motion-normal);
          z-index: 1000;
        }
        .splashLeaving { opacity: 0; }
        .splash strong { font-size: 24px; letter-spacing: -0.04em; margin-top: 18px; }
        .splash > span:last-child { color: var(--text-muted); font-size: 13px; font-weight: 600; }
        .splashSignal { animation: pulse 900ms ease-out; position: relative; }
        .splashSignal::before, .splashSignal::after { animation: wave 900ms ease-out; border: 2px solid var(--brand); border-radius: 999px; content: ""; inset: 10px; position: absolute; }
        .splashSignal::after { animation-delay: 180ms; }
        @keyframes pulse { 50% { transform: scale(1.06); } }
        @keyframes wave { to { opacity: 0; transform: scale(2); } }
        @media (prefers-reduced-motion: reduce) { .splashSignal, .splashSignal::before, .splashSignal::after { animation: none; } }
      `}</style>
    </div>
  );
}
