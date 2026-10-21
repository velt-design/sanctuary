'use client';
import { PreviewBlindProvider as Shared, usePreviewBlinds } from '@sp/configurator/react';
import type { ComponentProps } from 'react';
import { useRail } from './RailProvider';
export { usePreviewBlinds };
export default function PreviewBlindProvider(props: ComponentProps<typeof Shared>) {
 const rail = useRail(); return <Shared {...props} onChooseSides={() => rail.choose('sides')} />;
}
