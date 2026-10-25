"use client";

import { createContext, useContext } from 'react';

const context = createContext({
  ready: true,
  error: null as string | null,
  onRetry: () => {},
});

export const CalculatorSessionReadProvider = context.Provider;

/** Existing standalone presenters remain ready outside the request-owned boundary. */
export function useCalculatorSessionRead() {
  return useContext(context);
}
