'use client';
import type { ComponentProps } from 'react';
import Surface from './ProjectHeaderActionsSurface';
import PrivateActions from './ProjectHeaderPrivateActions';
export default function ProjectHeaderActions(props: Omit<ComponentProps<typeof Surface>, 'privateActions'>) {
  return <Surface {...props} privateActions={props.privateContentReady === false ? null : <PrivateActions {...props} />} />;
}
