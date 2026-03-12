"use client";

import { useEffect } from "react";

/**
 * Sets a --app-height CSS variable on <html> to window.innerHeight.
 * This is the only reliable way to get the true viewport height on
 * iOS PWA standalone mode, where CSS units (vh, dvh, svh, %) all
 * report incorrect values.
 */
export function ViewportHeight() {
  useEffect(() => {
    const update = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return null;
}
