"use client";

import { useLayoutEffect, useRef } from "react";

export function useResetOnHide(reset: () => void) {
  const resetRef = useRef(reset);

  useLayoutEffect(() => {
    resetRef.current = reset;
  });

  useLayoutEffect(() => () => resetRef.current(), []);
}
