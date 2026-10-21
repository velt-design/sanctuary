'use client';
import { PreviewScene as Shared } from '@sp/configurator/react';
import type { ComponentProps } from 'react';
import PreviewSurroundings from './PreviewSurroundings';
import StudioSetting from './StudioSetting';
import PreviewDimensionGuide from './PreviewDimensionGuide';
import styles from './prototype.module.css';
export default function PreviewScene(props: ComponentProps<typeof Shared>) {
 const { context, plan, reviewSetting = false, showReferenceBase = true, realism = false, activeDimension } = props;
 return <Shared {...props} loadingClassName={styles.loading}
  renderContext={({ reducedDetail, bounds, fitPoints }) => <>
   {showReferenceBase && context && <PreviewSurroundings reducedDetail={reducedDetail} richSetting={reviewSetting} studio context={context} bounds={bounds} productPoints={fitPoints} />}
   {reviewSetting && (showReferenceBase || realism) && <StudioSetting plan={plan} context={context} showBase={showReferenceBase} />}
  </>}
  renderDimension={roof => activeDimension && <PreviewDimensionGuide axis={activeDimension} plan={plan} roof={roof} />} />;
}
