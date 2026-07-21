import type { ComponentProps } from 'react';
import PortalIndexLink from './PortalIndexLink';

type ProjectsIndexLinkProps = ComponentProps<typeof PortalIndexLink>;

export default function ProjectsIndexLink(props: ProjectsIndexLinkProps) {
  return <PortalIndexLink {...props} />;
}
