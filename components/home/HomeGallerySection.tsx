'use client';

import { useEffect, useState } from 'react';
import OriginalViewer, { type GalleryImage } from '@/components/Gallery/OriginalViewer';

const VIEWER_IMAGE_SRCS = [
  '/images/project-Bronwyn-01.jpg',
  '/images/project-asquith-ave-01.jpg',
  '/images/project-asquith-ave-02.jpg',
  '/images/project-atelier-shu-01.jpg',
  '/images/project-atelier-shu-02.jpg',
  '/images/project-dairy-flat-01.jpg',
  '/images/project-dukeson-change-name-01.jpg',
  '/images/project-dukeson-change-name-02.jpg',
  '/images/project-goodhome-01.jpg',
  '/images/project-goodhome-02.jpg',
  '/images/project-goodhome-03.jpg',
  '/images/project-goodhome-04.jpg',
  '/images/project-kiwi-rail-01.jpg',
  '/images/project-kiwi-rail-02.jpg',
  '/images/project-kiwi-rail-03.jpg',
  '/images/project-new-windsor-01.jpg',
  '/images/project-new-windsor-02.jpg',
  '/images/project-st-heliers-01.jpg',
  '/images/project-st-heliers-02.jpg',
  '/images/project-summit-dr-01.jpg',
  '/images/project-tamaki-dr-01.jpg',
  '/images/project-tamaki-dr-02.jpg',
  '/images/project-tamaki-dr-03.jpg',
  '/images/project-tamaki-dr-04.jpg',
  '/images/project-tindalls-bay.jpg',
  '/images/project-unknown-01.jpg',
  '/images/project-velskov-01.jpg',
  '/images/project-velskov-02.jpg',
  '/images/project-waiheke-01.jpg',
  '/images/project-waiheke-02.jpg',
  '/images/project-waitakere-ranges-01.jpg',
  '/images/project-waitakere-ranges-02.jpg',
  '/images/project-westmere-01.jpg',
];

const toAlt = (src: string): string => {
  const file = src.split('/').pop() ?? '';
  const noExt = file.replace(/\.[^.]+$/, '');
  const cleaned = noExt.replace(/^project-/, '').replace(/-/g, ' ');
  if (!cleaned) return 'Project image';
  return cleaned
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

const BASE_VIEWER_IMAGES: GalleryImage[] = VIEWER_IMAGE_SRCS.map((src) => ({
  src,
  alt: toAlt(src),
}));

export default function HomeGallerySection() {
  const [viewerImages, setViewerImages] = useState<GalleryImage[]>(BASE_VIEWER_IMAGES);

  useEffect(() => {
    const shuffled = [...BASE_VIEWER_IMAGES];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    setViewerImages(shuffled);
  }, []);

  return (
    <section className="home-gallery" aria-label="Project gallery">
      <div className="projects-experience__viewer">
        <div className="projects-experience__viewer-actual">
          <OriginalViewer images={viewerImages} defaultMode="slider" />
        </div>
      </div>
    </section>
  );
}

