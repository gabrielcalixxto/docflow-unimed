import { useCallback, useRef } from "react";

export default function useViewportPreserver() {
  const scrollTopRef = useRef(null);

  const rememberViewport = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    scrollTopRef.current = window.scrollY;
  }, []);

  const restoreViewport = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof scrollTopRef.current !== "number") {
      return;
    }
    const top = scrollTopRef.current;
    scrollTopRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: "auto" });
    });
  }, []);

  const preserveViewport = useCallback(
    (callback) => {
      rememberViewport();
      const result = callback();
      restoreViewport();
      return result;
    },
    [rememberViewport, restoreViewport],
  );

  const preserveViewportAsync = useCallback(
    async (callback) => {
      rememberViewport();
      try {
        return await callback();
      } finally {
        restoreViewport();
      }
    },
    [rememberViewport, restoreViewport],
  );

  return {
    preserveViewport,
    preserveViewportAsync,
    rememberViewport,
    restoreViewport,
  };
}

