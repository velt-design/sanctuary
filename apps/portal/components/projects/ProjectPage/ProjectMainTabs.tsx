'use client';
import type { ComponentProps } from 'react';
import Surface from './ProjectMainTabsSurface';
import Body from './ProjectTabBody';
export default function ProjectMainTabs(props: ComponentProps<typeof Body>) {
  return <Surface {...props} body={props.privateContentReady === false ? null : <Body {...props} />} />;
}
