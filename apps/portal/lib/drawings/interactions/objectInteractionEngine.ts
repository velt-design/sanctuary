type ObjectInteractionReferenceGuideState = 'none' | 'witness' | 'snap-lane';
type ObjectInteractionPreviewBodyState =
  | 'grabbed'
  | 'floating'
  | 'snap-available'
  | 'snapped'
  | 'blocked'
  | 'settling';
type ObjectInteractionPreviewTargetState = 'preview' | 'snap-available' | 'snapped';

type ObjectInteractionPreviewAnchor = {
  x: number;
  y: number;
};

type ObjectInteractionPreviewOwnerKind = 'deck' | 'opening';

type ObjectInteractionPreviewReferenceGuide<TPoint extends ObjectInteractionPreviewAnchor> = {
  start: TPoint;
  end: TPoint;
  state: Exclude<ObjectInteractionReferenceGuideState, 'none'>;
};

type ObjectInteractionPreviewTargetHighlight<TPoint extends ObjectInteractionPreviewAnchor> = {
  start: TPoint;
  end: TPoint;
  state: ObjectInteractionPreviewTargetState;
};

export type ObjectInteractionPreviewOverlay<TPoint extends ObjectInteractionPreviewAnchor> = {
  ownerKind: ObjectInteractionPreviewOwnerKind;
  ownerId: string;
  polygon: TPoint[];
  bodyState: ObjectInteractionPreviewBodyState;
  anchorPoint: TPoint | null;
  lockedCornerPoint: TPoint | null;
  endCatchPoint: TPoint | null;
  referenceGuide: ObjectInteractionPreviewReferenceGuide<TPoint> | null;
  targetHighlights: ObjectInteractionPreviewTargetHighlight<TPoint>[];
};
