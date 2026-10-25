'use client';
import type { ComponentProps } from 'react';
import Surface from './ProjectPageShellSurface';
import Body from './ProjectTabBody';
export default function ProjectPageShell(props: Omit<ComponentProps<typeof Surface>, 'body'>) {
  return <Surface {...props} body={props.privateContentReady === false ? null : <Body {...props} />} />;
}
