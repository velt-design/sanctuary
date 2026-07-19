import type { ComponentProps } from 'react';
import Link from 'next/link';
import PortalIndexLink from './PortalIndexLink';

type ProjectsIndexLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

export default function ProjectsIndexLink(props: ProjectsIndexLinkProps) {
  return <PortalIndexLink {...props} />;
}
