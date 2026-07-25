import Image from 'next/image';
import type { Project } from '@/data/projects';

type ProjectGalleryImage = Project['gallery'][number];

type ProjectGalleryProps = {
  images: ProjectGalleryImage[];
  projectTitle: string;
};

export default function ProjectGallery({
  images,
  projectTitle,
}: ProjectGalleryProps) {
  return (
    <div
      aria-label={`${projectTitle} project gallery`}
      className="project-case-study__gallery"
      data-project-gallery-layout="responsive-strip"
      role="region"
      tabIndex={0}
    >
      {images.map((image, index) => (
        <figure key={image.src}>
          <div className="project-case-study__gallery-media">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              loading="lazy"
              sizes="(max-width: 640px) 74vw, (max-width: 899px) 84vw, (max-width: 1280px) 52vw, 720px"
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
  );
}
