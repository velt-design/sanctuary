import type {
  DeckAttachment,
  HouseFormModel,
  OpeningObjectModel,
  PergolaAttachment,
  WorkbenchObjectRef,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';

type HouseContextSource = 'selected_house' | 'deck_host' | 'opening_host' | 'pergola_host';

export type ObjectWorkbenchHouseActionContext = {
  houseForm: HouseFormModel;
  source: HouseContextSource;
};

type DeckLike = {
  id: string;
  attachment?: DeckAttachment | null;
};

type OpeningLike = Pick<OpeningObjectModel, 'id' | 'sourceFormId'>;

type PergolaLike = {
  id: string;
  attachment?: PergolaAttachment | null;
};

function findHouseFormById(
  houseForms: ReadonlyArray<HouseFormModel>,
  houseFormId: string | null | undefined,
): HouseFormModel | null {
  if (!houseFormId) return null;
  return houseForms.find((houseForm) => houseForm.id === houseFormId) ?? null;
}

function contextFromHouseFormId(input: {
  houseForms: ReadonlyArray<HouseFormModel>;
  houseFormId: string | null | undefined;
  source: HouseContextSource;
}): ObjectWorkbenchHouseActionContext | null {
  const houseForm = findHouseFormById(input.houseForms, input.houseFormId);
  return houseForm ? { houseForm, source: input.source } : null;
}

export function resolveSelectedHouseActionContext(input: {
  activeObjectRef: WorkbenchObjectRef;
  houseForms: ReadonlyArray<HouseFormModel>;
}): ObjectWorkbenchHouseActionContext | null {
  if (input.activeObjectRef.family !== 'house_forms') return null;
  return contextFromHouseFormId({
    houseForms: input.houseForms,
    houseFormId: input.activeObjectRef.objectId,
    source: 'selected_house',
  });
}

export function resolveObjectOwnedHouseActionContext(input: {
  decks?: ReadonlyArray<DeckLike>;
  houseForms: ReadonlyArray<HouseFormModel>;
  openings?: ReadonlyArray<OpeningLike>;
  pergolas?: ReadonlyArray<PergolaLike>;
  target: WorkbenchObjectRef;
}): ObjectWorkbenchHouseActionContext | null {
  if (!input.target.objectId) return null;
  if (input.target.family === 'house_forms') {
    return contextFromHouseFormId({
      houseForms: input.houseForms,
      houseFormId: input.target.objectId,
      source: 'selected_house',
    });
  }
  if (input.target.family === 'decks') {
    const deck = input.decks?.find((candidate) => candidate.id === input.target.objectId) ?? null;
    return contextFromHouseFormId({
      houseForms: input.houseForms,
      houseFormId: deck?.attachment?.host?.objectId ?? null,
      source: 'deck_host',
    });
  }
  if (input.target.family === 'openings') {
    const opening = input.openings?.find((candidate) => candidate.id === input.target.objectId) ?? null;
    return contextFromHouseFormId({
      houseForms: input.houseForms,
      houseFormId: opening?.sourceFormId ?? null,
      source: 'opening_host',
    });
  }

  const pergola = input.pergolas?.find((candidate) => candidate.id === input.target.objectId) ?? null;
  const host =
    pergola?.attachment?.host?.objectFamily === 'house_forms'
      ? pergola.attachment.host.objectId
      : null;
  return contextFromHouseFormId({
    houseForms: input.houseForms,
    houseFormId: host,
    source: 'pergola_host',
  });
}
