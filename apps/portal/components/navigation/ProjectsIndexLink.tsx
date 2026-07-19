'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { openProjectsIndexInstantly, preloadProjectsIndex } from '@/lib/queries/projectsIndexNavigation';

type ProjectsIndexLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

export default function ProjectsIndexLink({
  href,
  onClick,
  onFocus,
  onMouseEnter,
  onPointerDown,
  onTouchStart,
  prefetch = false,
  ...props
}: ProjectsIndexLinkProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prepare = () => preloadProjectsIndex(queryClient, router, href);

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openProjectsIndexInstantly(event, router, href);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) prepare();
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented) prepare();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) prepare();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        if (!event.defaultPrevented) prepare();
      }}
    />
  );
}
