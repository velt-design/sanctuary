'use client';

import Image from 'next/image';
import { useRef, useState, type ComponentProps } from 'react';
import { Figure } from './Primitives';

type Photo = { image: string; alt: string; caption: string; objectPosition?: string };
type Props = Omit<ComponentProps<typeof Figure>, 'image' | 'alt' | 'caption' | 'media' | 'detail' | 'objectPosition'> & {
  photo: Photo;
  sizes: string;
};

/** A choice changes the visible photo and its caption together, after decoding. */
export default function DecodedFigure({ photo, sizes, priority = false, ...figure }: Props) {
  const [shown, setShown] = useState(photo);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const current = useRef({ image: photo.image, attempt });
  current.current = { image: photo.image, attempt };
  const pending = photo.image !== shown.image;
  const displayed = pending ? shown : photo;
  const active = (element: HTMLImageElement) => element.isConnected
    && current.current.image === photo.image && current.current.attempt === attempt;
  const failure = pending && failed === `${photo.image}:${attempt}`;

  return <Figure {...figure} image={displayed.image} alt={displayed.alt} caption={displayed.caption}
    objectPosition={displayed.objectPosition} sizes={sizes} captionLive="polite"
    detail={failure ? <>New photo unavailable. <button className="min-h-11 underline underline-offset-4" type="button" onClick={() => { setFailed(null); setAttempt(value => value + 1); }}>Retry</button></> : undefined}
    media={<>
      <Image src={displayed.image} alt={displayed.alt} fill quality={75} sizes={sizes} priority={priority} data-decoded-photo="shown" />
      {pending && <Image key={`${photo.image}:${attempt}`} src={photo.image} alt="" aria-hidden="true" fill quality={75} sizes={sizes}
        loading="eager" style={{ opacity: 0, pointerEvents: 'none', objectPosition: photo.objectPosition }} data-decoded-photo="incoming"
        onLoad={async event => {
          const element = event.currentTarget;
          try { await element.decode(); } catch { if (active(element)) setFailed(`${photo.image}:${attempt}`); return; }
          if (!active(element)) return;
          setShown(photo); setFailed(null);
        }}
        onError={event => { if (active(event.currentTarget)) setFailed(`${photo.image}:${attempt}`); }} />}
    </>} />;
}
