const SHARED_SPEC_HEADING = 'Shared across all roof sections';
const LEGACY_SHARED_SPEC_HEADING = 'Shared specification';
const INCLUDED_INFILLS_HEADING = 'Included infills';

type PergolaFieldKey =
  | 'included'
  | 'configuration'
  | 'style'
  | 'size'
  | 'pitch'
  | 'posts'
  | 'roof'
  | 'colour'
  | 'houseConnection'
  | 'postFixings'
  | 'projectDelivery'
  | 'quoteDiscount';

type PergolaModuleFieldKey = Exclude<
  PergolaFieldKey,
  'included' | 'configuration' | 'projectDelivery' | 'quoteDiscount'
>;

export type PergolaFieldMap = {
  roof: string;
  colour: string;
  houseConnection: string;
  postFixings: string;
};

export type PergolaModuleDraft = {
  title: string;
  style: string;
  size: string;
  pitch: string;
  posts: string;
  roof: string;
  colour: string;
  houseConnection: string;
  postFixings: string;
  includedInfills?: string[];
};

type PergolaStructuredDraft = {
  heading: string;
  included?: string;
  projectDelivery?: string;
  configuration: string;
  shared: PergolaFieldMap;
  modules: PergolaModuleDraft[];
  quoteDiscount?: string;
};

type SharedFieldDefinition = {
  key: keyof PergolaFieldMap;
  label: string;
};

const SHARED_FIELD_DEFINITIONS: SharedFieldDefinition[] = [
  { key: 'roof', label: 'Roof covering' },
  { key: 'colour', label: 'Frame finish' },
  { key: 'houseConnection', label: 'Connection to home' },
  { key: 'postFixings', label: 'Post foundations and fixings' },
];

const LINE_LABEL_TO_KEY: Record<string, PergolaFieldKey> = {
  included: 'included',
  configuration: 'configuration',
  style: 'style',
  'roof form': 'style',
  size: 'size',
  'overall size': 'size',
  pitch: 'pitch',
  'roof pitch': 'pitch',
  posts: 'posts',
  'support posts': 'posts',
  roof: 'roof',
  'roof covering': 'roof',
  colour: 'colour',
  'frame finish': 'colour',
  'house connection': 'houseConnection',
  'connection to home': 'houseConnection',
  'post fixings': 'postFixings',
  'post foundations and fixings': 'postFixings',
  'project delivery': 'projectDelivery',
  'quote discount': 'quoteDiscount',
};

function emptySharedFields(): PergolaFieldMap {
  return {
    roof: '',
    colour: '',
    houseConnection: '',
    postFixings: '',
  };
}

function emptyModuleDraft(index: number): PergolaModuleDraft {
  return {
    title: `Roof section ${index + 1}`,
    style: '',
    size: '',
    pitch: '',
    posts: '',
    roof: '',
    colour: '',
    houseConnection: '',
    postFixings: '',
    includedInfills: [],
  };
}

function isPergolaHeading(value: string): boolean {
  return /\bpergola\b/i.test(value);
}

function parseKeyValueLine(raw: string): { key: PergolaFieldKey; value: string } | null {
  const stripped = raw.replace(/^[-•]\s*/, '').trim();
  const match = stripped.match(/^([^:]+):\s*(.+)$/);
  if (!match) return null;
  const key = LINE_LABEL_TO_KEY[match[1]!.trim().toLowerCase()];
  if (!key) return null;
  return { key, value: match[2]!.trim() };
}

function parseModuleHeading(raw: string): { title: string; style: string } | null {
  const stripped = raw.replace(/^[-•]\s*/, '').trim();
  const match = stripped.match(/^((?:Module|Roof section)\s+\d+)(?:\s*:\s*(.+))?$/i);
  if (!match) return null;
  return {
    title: match[1]!.trim(),
    style: match[2]?.trim() ?? '',
  };
}

function isPergolaModuleFieldKey(key: PergolaFieldKey): key is PergolaModuleFieldKey {
  return key !== 'included'
    && key !== 'configuration'
    && key !== 'projectDelivery'
    && key !== 'quoteDiscount';
}

function stripBullet(raw: string): string {
  return raw.replace(/^[-•]\s*/, '').trim();
}

function canonicalRoofSectionTitle(value: string, index: number): string {
  const trimmed = value.trim();
  if (!trimmed) return `Roof section ${index + 1}`;
  return trimmed.replace(/^Module\b/i, 'Roof section');
}

function appendIncludedInfills(lines: string[], module: PergolaModuleDraft) {
  const details = (module.includedInfills ?? []).map((detail) => detail.trim()).filter(Boolean);
  if (!details.length) return;
  lines.push('', INCLUDED_INFILLS_HEADING, ...details.map((detail) => `- ${detail}`));
}

function appendLine(lines: string[], label: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  lines.push(`- ${label}: ${trimmed}`);
}

export function parsePergolaStructuredDescription(raw: string): PergolaStructuredDraft | null {
  const lines = String(raw ?? '').split('\n').map((line) => line.trim());
  const heading = lines[0]?.trim() ?? '';
  if (!heading) return null;

  const nonTitleLines = lines.slice(1);
  const draft: PergolaStructuredDraft = {
    heading,
    included: '',
    projectDelivery: '',
    configuration: '',
    shared: emptySharedFields(),
    modules: [],
    quoteDiscount: '',
  };

  let currentSection: 'root' | 'shared' | 'module' | 'includedInfills' = 'root';
  let currentModule: PergolaModuleDraft | null = null;
  let recognizedPergolaSpecification = false;

  for (const rawLine of nonTitleLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (
      line.toLowerCase() === SHARED_SPEC_HEADING.toLowerCase()
      || line.toLowerCase() === LEGACY_SHARED_SPEC_HEADING.toLowerCase()
    ) {
      currentSection = 'shared';
      currentModule = null;
      continue;
    }

    const moduleHeading = parseModuleHeading(line);
    if (moduleHeading) {
      currentSection = 'module';
      currentModule = emptyModuleDraft(draft.modules.length);
      currentModule.title = moduleHeading.title;
      currentModule.style = moduleHeading.style;
      draft.modules.push(currentModule);
      continue;
    }

    const parsed = parseKeyValueLine(line);
    if (parsed?.key === 'included') {
      draft.included = parsed.value;
      continue;
    }
    if (parsed?.key === 'projectDelivery') {
      draft.projectDelivery = parsed.value;
      continue;
    }
    if (parsed?.key === 'quoteDiscount') {
      draft.quoteDiscount = parsed.value;
      continue;
    }

    if (line.toLowerCase() === INCLUDED_INFILLS_HEADING.toLowerCase()) {
      if (!currentModule) return null;
      currentSection = 'includedInfills';
      continue;
    }

    if (currentSection === 'includedInfills') {
      const detail = stripBullet(line);
      if (detail && currentModule) currentModule.includedInfills?.push(detail);
      continue;
    }

    if (!parsed) return null;
    if (parsed.key !== 'configuration') recognizedPergolaSpecification = true;

    if (currentSection === 'root') {
      if (parsed.key === 'configuration') {
        draft.configuration = parsed.value;
        continue;
      }
      if (!draft.modules.length) {
        draft.modules.push(emptyModuleDraft(0));
        currentModule = draft.modules[0]!;
      }
      if (!currentModule) currentModule = draft.modules[0]!;
      if (!isPergolaModuleFieldKey(parsed.key)) return null;
      currentModule[parsed.key] = parsed.value;
      continue;
    }

    if (currentSection === 'shared') {
      if (parsed.key === 'roof' || parsed.key === 'colour' || parsed.key === 'houseConnection' || parsed.key === 'postFixings') {
        draft.shared[parsed.key] = parsed.value;
        continue;
      }
      return null;
    }

    if (!currentModule) return null;
    if (!isPergolaModuleFieldKey(parsed.key)) return null;
    currentModule[parsed.key] = parsed.value;
  }

  if (!draft.modules.length || (!isPergolaHeading(heading) && !recognizedPergolaSpecification)) return null;
  return draft;
}

export function buildPergolaStructuredDescription(draft: PergolaStructuredDraft): string {
  const heading = draft.heading.trim();
  if (!heading) return '';

  const lines: string[] = [heading];
  const modules = draft.modules.length ? draft.modules : [emptyModuleDraft(0)];
  appendLine(lines, 'Included', draft.included ?? '');
  appendLine(lines, 'Project delivery', draft.projectDelivery ?? '');

  if (modules.length === 1) {
    const module = modules[0]!;
    appendLine(lines, 'Roof form', module.style);
    appendLine(lines, 'Overall size', module.size);
    appendLine(lines, 'Roof covering', module.roof || draft.shared.roof);
    appendLine(lines, 'Frame finish', module.colour || draft.shared.colour);
    appendLine(lines, 'Roof pitch', module.pitch);
    appendLine(lines, 'Support posts', module.posts);
    appendLine(lines, 'Connection to home', module.houseConnection || draft.shared.houseConnection);
    appendLine(lines, 'Post foundations and fixings', module.postFixings || draft.shared.postFixings);
    appendIncludedInfills(lines, module);
    appendLine(lines, 'Quote discount', draft.quoteDiscount ?? '');
    return lines.join('\n');
  }

  appendLine(lines, 'Configuration', draft.configuration);

  const sharedLines: string[] = [];
  SHARED_FIELD_DEFINITIONS.forEach(({ key, label }) => {
    appendLine(sharedLines, label, draft.shared[key]);
  });
  if (sharedLines.length) {
    lines.push('', SHARED_SPEC_HEADING, ...sharedLines);
  }

  modules.forEach((module, index) => {
    lines.push('');
    const title = canonicalRoofSectionTitle(module.title, index);
    const styleSuffix = module.style.trim() ? `: ${module.style.trim()}` : '';
    lines.push(`${title}${styleSuffix}`);
    appendLine(lines, 'Overall size', module.size);
    appendLine(lines, 'Roof pitch', module.pitch);
    appendLine(lines, 'Support posts', module.posts);

    if (!draft.shared.roof.trim()) appendLine(lines, 'Roof covering', module.roof);
    if (!draft.shared.colour.trim()) appendLine(lines, 'Frame finish', module.colour);
    if (!draft.shared.houseConnection.trim()) appendLine(lines, 'Connection to home', module.houseConnection);
    if (!draft.shared.postFixings.trim()) appendLine(lines, 'Post foundations and fixings', module.postFixings);
    appendIncludedInfills(lines, module);
  });

  appendLine(lines, 'Quote discount', draft.quoteDiscount ?? '');

  return lines.join('\n');
}

export function updateSharedPergolaField(
  draft: PergolaStructuredDraft,
  key: keyof PergolaFieldMap,
  value: string,
): PergolaStructuredDraft {
  const previous = draft.shared[key];
  const nextValue = value.trim();
  return {
    ...draft,
    shared: {
      ...draft.shared,
      [key]: value,
    },
    modules: nextValue
      ? draft.modules
      : draft.modules.map((module) => ({
          ...module,
          [key]: module[key] || previous,
        })),
  };
}
