"use client";

import { useEffect, useState, useRef } from "react";

export function useClock(serverRemainingMs: number, isRunning: boolean) {
  const [displayMs, setDisplayMs] = useState(serverRemainingMs);
  const lastServerValue = useRef(serverRemainingMs);
  const lastTick = useRef(Date.now());

  useEffect(() => {
    lastServerValue.current = serverRemainingMs;
    setDisplayMs(serverRemainingMs);
    lastTick.current = Date.now();
  }, [serverRemainingMs]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastTick.current;
      setDisplayMs(Math.max(0, lastServerValue.current - elapsed));
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning]);

  const minutes = Math.floor(displayMs / 60000);
  const seconds = Math.floor((displayMs % 60000) / 1000);
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return { displayMs, formatted, isLow: displayMs < 10000 };
}
