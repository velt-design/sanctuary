import Image from 'next/image';
import type { Project } from '@/data/projects';
import { ResponsiveGallery } from '@/components/marketing-foundation/ResponsiveGallery';

type ProjectGalleryImage = Project['gallery'][number];

type ProjectGalleryProps = {
  images: ProjectGalleryImage[];
  projectTitle: string;
};

export default function ProjectGallery({
  images,
  projectTitle,
}: ProjectGalleryProps) {
  const mobileItems = images.map((image, index) => ({
    alt: image.alt,
    caption: String(index + 1).padStart(2, '0'),
    detail: image.alt,
    id: image.src,
    image: image.src,
    objectPosition: image.objectPosition ?? 'center',
    ratio: index % 3 === 1 ? 'portrait' as const : 'standard' as const,
    sizes: '(max-width: 899px) calc(100vw - 2.5rem), 1px',
  }));

  return (
    <>
      <div className="project-case-study__gallery" data-project-gallery-layout="desktop">
        {images.map((image, index) => (
          <figure key={image.src}>
            <div className="project-case-study__gallery-media">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                loading="lazy"
                sizes="(max-width: 899px) 1px, (max-width: 1280px) 52vw, 720px"
                style={{ objectPosition: image.objectPosition ?? 'center' }}
              />
            </div>
            <figcaption>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{image.alt}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <ResponsiveGallery
        className="project-case-study__gallery-mobile"
        items={mobileItems}
        label={`${projectTitle} project gallery`}
        swipe
      />
    </>
  );
}
