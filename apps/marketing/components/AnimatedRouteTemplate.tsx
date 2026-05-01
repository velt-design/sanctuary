'use client';

import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion';

export default function AnimatedRouteTemplate({ children, routeKey }: { children: React.ReactNode; routeKey: string }) {
  const reducedMotion = useReducedMotion();
  const enterTransition: Transition = reducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] };
  const exitTransition: Transition = reducedMotion ? { duration: 0 } : { duration: 0.16, ease: [0.4, 0, 1, 1] };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={routeKey}
        initial={reducedMotion ? false : { opacity: 0.96 }}
        animate={{ opacity: 1, transition: enterTransition }}
        exit={{ opacity: reducedMotion ? 1 : 0.96, transition: exitTransition }}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
