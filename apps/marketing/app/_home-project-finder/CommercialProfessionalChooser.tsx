'use client';

import Image from 'next/image';
import type {
  KeyboardEvent,
  MouseEvent,
  RefObject,
} from 'react';
import { Container } from '../../components/marketing-foundation/Primitives';
import {
  commercialProfessionalPaths,
  type CommercialProfessionalPath,
} from '../../lib/projectFinderContract';
import { commercialProfessionalPathContent } from './projectFinderContent';
import type { ProjectFinderHomepageMedia } from './projectFinderMedia';
import styles from './projectFinderHomepage.module.css';

type InputMethod = 'keyboard' | 'pointer';

type CommercialProfessionalChooserProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  media: ProjectFinderHomepageMedia['choiceByProfessionalPath'];
  onSelect: (
    path: CommercialProfessionalPath,
    method: InputMethod,
  ) => void;
  sectionRef: RefObject<HTMLElement | null>;
  selectedPath?: CommercialProfessionalPath;
};

export default function CommercialProfessionalChooser({
  headingRef,
  media,
  onSelect,
  sectionRef,
  selectedPath,
}: CommercialProfessionalChooserProps) {
  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    const lastIndex = commercialProfessionalPaths.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    onSelect(commercialProfessionalPaths[nextIndex], 'keyboard');
  };

  const handleClick = (
    event: MouseEvent<HTMLButtonElement>,
    path: CommercialProfessionalPath,
  ) => {
    onSelect(path, event.detail === 0 ? 'keyboard' : 'pointer');
  };

  return (
    <section
      aria-labelledby="professional-path-heading"
      className={styles.professionalChooser}
      data-professional-path-chooser
      ref={sectionRef}
    >
      <Container width="wide">
        <header className={styles.finderHeader}>
          <p className={styles.eyebrow}>Commercial and professional</p>
          <h2 id="professional-path-heading" ref={headingRef} tabIndex={-1}>
            Which pathway fits best?
          </h2>
          <p>
            Choose the closest starting point. We will show the most relevant
            pathway and built work next.
          </p>
        </header>

        <fieldset
          aria-labelledby="professional-path-heading"
          className={styles.directionFieldset}
          role="radiogroup"
        >
          <legend className="visually-hidden">
            Choose a commercial or professional project pathway
          </legend>
          <div className={styles.directionGrid}>
            {commercialProfessionalPaths.map((path, index) => {
              const content = commercialProfessionalPathContent[path];
              const choiceMedia = media[path];
              const selected = selectedPath === path;
              return (
                <button
                  aria-checked={selected}
                  aria-describedby={`professional-path-${path}-description`}
                  className={`${styles.directionCard} ${styles.professionalPathCard}`}
                  data-professional-path={path}
                  data-selected={selected ? 'true' : 'false'}
                  key={path}
                  onClick={(event) => handleClick(event, path)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  role="radio"
                  tabIndex={selected || (!selectedPath && index === 0) ? 0 : -1}
                  type="button"
                >
                  <span className={styles.directionImage}>
                    <Image
                      alt={choiceMedia.alt}
                      fill
                      loading="lazy"
                      sizes="(max-width: 430px) 96px, (max-width: 760px) calc(100vw - 2.5rem), (max-width: 900px) 36vw, (max-width: 1100px) 33vw, 420px"
                      src={choiceMedia.src}
                      style={{ objectPosition: choiceMedia.objectPosition }}
                    />
                  </span>
                  <span className={styles.directionNumber} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.directionCopy}>
                    <strong>{content.label}</strong>
                    <span id={`professional-path-${path}-description`}>
                      {content.description}
                    </span>
                  </span>
                  <span className={styles.directionState} aria-hidden="true">
                    {selected ? 'Selected' : 'Choose'}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </Container>
    </section>
  );
}
