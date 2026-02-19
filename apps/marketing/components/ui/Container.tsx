import * as React from 'react';
import { cn } from '@/lib/cn';

type ContainerProps = React.HTMLAttributes<HTMLDivElement>;

export default function Container({ className, ...props }: ContainerProps) {
  return (
    <div
      className={cn('container', className)}
      {...props}
    />
  );
}
