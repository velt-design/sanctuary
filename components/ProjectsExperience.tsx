// components/ProjectsExperience.tsx
'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import OriginalViewer, { type GalleryImage } from '@/components/Gallery/OriginalViewer';

type ProjectsExperienceProps = {
  images: GalleryImage[];
};

export default function ProjectsExperience({ images }: ProjectsExperienceProps) {
  const titleControls = useAnimation();
  const viewerControls = useAnimation();
  const [showViewer, setShowViewer] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    document.body.classList.add('header-hidden');
    return () => {
      document.body.classList.remove('header-hidden');
      document.body.classList.remove('header-flip');
    };
  }, []);

  useEffect(() => {
    if (!frameReady) return;
    document.body.classList.remove('header-hidden');
    document.body.classList.add('header-flip');
    const timer = window.setTimeout(() => {
      document.body.classList.remove('header-flip');
    }, 800);
    return () => window.clearTimeout(timer);
  }, [frameReady]);

  useEffect(() => {
    let cancelled = false;
    const easeEnter: [number, number, number, number] = [0.33, 1, 0.68, 1];
    const easeExit: [number, number, number, number] = [0.16, 1, 0.3, 1];

    async function runSequence() {
      await titleControls.start({
        y: ['100vh', 0],
        opacity: [0, 1],
        transition: { duration: 1.2, ease: easeEnter }
      });

      if (cancelled) return;
      await new Promise(resolve => setTimeout(resolve, 650));

      await titleControls.start({
        y: -260,
        opacity: 0,
        transition: { duration: 1.05, ease: easeExit, delay: 0.18 }
      });

      if (cancelled) return;
      setShowViewer(true);

      await new Promise(resolve => setTimeout(resolve, 90));

      await viewerControls.start({
        y: ['110vh', 0],
        opacity: 1,
        transition: { duration: 1.3, ease: easeEnter }
      });

      if (cancelled) return;
      setFrameReady(true);
    }

    titleControls.set({ y: '100vh', opacity: 0 });
    viewerControls.set({ y: '110vh', opacity: 0 });
    runSequence();
    return () => { cancelled = true; };
  }, [titleControls, viewerControls]);

  return (
    <main className="projects-experience" aria-labelledby="projects-page-title">
      <motion.h1
        id="projects-page-title"
        className="projects-experience__title"
        initial={{ y: '100vh', opacity: 0 }}
        animate={titleControls}
      >
        Projects
      </motion.h1>

      <div className={`projects-experience__viewer-frame ${frameReady ? 'ready' : ''}`}>
        <motion.div
          className="projects-experience__viewer"
          initial={{ y: '110vh', opacity: 0 }}
          animate={viewerControls}
        >
          <AnimatePresence mode="wait">
            {!showViewer ? (
              <motion.div
                key="placeholder"
                className="projects-experience__viewer-placeholder"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.33, 1, 0.68, 1] }}
              />
            ) : (
              <motion.div
                key="viewer"
                className="projects-experience__viewer-actual"
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
              >
                <OriginalViewer images={images} defaultMode="slider" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}
