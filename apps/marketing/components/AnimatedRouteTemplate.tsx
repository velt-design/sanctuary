'use client';

import { AnimatePresence, motion } from 'framer-motion';

export default function AnimatedRouteTemplate({ children, routeKey }: { children: React.ReactNode; routeKey: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={routeKey}
        initial={{ opacity: 0, y: 8, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, y: -8, scale: 0.995, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
