const SHARED_SPEC_HEADING = 'Shared specification';

export type PergolaFieldKey =
  | 'configuration'
  | 'style'
  | 'size'
  | 'pitch'
  | 'posts'
  | 'roof'
  | 'colour'
  | 'houseConnection'
  | 'postFixings';

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
};

export type PergolaStructuredDraft = {
  heading: string;
  configuration: string;
  shared: PergolaFieldMap;
  modules: PergolaModuleDraft[];
};

type SharedFieldDefinition = {
  key: keyof PergolaFieldMap;
  label: string;
};

const SHARED_FIELD_DEFINITIONS: SharedFieldDefinition[] = [
  { key: 'roof', label: 'Roof' },
  { key: 'colour', label: 'Colour' },
  { key: 'houseConnection', label: 'House connection' },
  { key: 'postFixings', label: 'Post fixings' },
];

const LINE_LABEL_TO_KEY: Record<string, PergolaFieldKey> = {
  configuration: 'configuration',
  style: 'style',
  size: 'size',
  pitch: 'pitch',
  posts: 'posts',
  roof: 'roof',
  colour: 'colour',
  'house connection': 'houseConnection',
  'post fixings': 'postFixings',
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
    title: `Module ${index + 1}`,
    style: '',
    size: '',
    pitch: '',
    posts: '',
    roof: '',
    colour: '',
    houseConnection: '',
    postFixings: '',
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
  const match = stripped.match(/^(Module\s+\d+)(?:\s*:\s*(.+))?$/i);
  if (!match) return null;
  return {
    title: match[1]!.trim(),
    style: match[2]?.trim() ?? '',
  };
}

function appendLine(lines: string[], label: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  lines.push(`- ${label}: ${trimmed}`);
}

export function parsePergolaStructuredDescription(raw: string): PergolaStructuredDraft | null {
  const lines = String(raw ?? '').split('\n').map((line) => line.trim());
  const heading = lines[0]?.trim() ?? '';
  if (!heading || !isPergolaHeading(heading)) return null;

  const nonTitleLines = lines.slice(1);
  const draft: PergolaStructuredDraft = {
    heading,
    configuration: '',
    shared: emptySharedFields(),
    modules: [],
  };

  let currentSection: 'root' | 'shared' | 'module' = 'root';
  let currentModule: PergolaModuleDraft | null = null;

  for (const rawLine of nonTitleLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toLowerCase() === SHARED_SPEC_HEADING.toLowerCase()) {
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
    if (!parsed) return null;

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
      currentModule[parsed.key as keyof PergolaModuleDraft] = parsed.value;
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
    currentModule[parsed.key as keyof PergolaModuleDraft] = parsed.value;
  }

  if (!draft.modules.length) return null;
  return draft;
}

export function buildPergolaStructuredDescription(draft: PergolaStructuredDraft): string {
  const heading = draft.heading.trim();
  if (!heading) return '';

  const lines: string[] = [heading];
  const modules = draft.modules.length ? draft.modules : [emptyModuleDraft(0)];

  if (modules.length === 1) {
    const module = modules[0]!;
    appendLine(lines, 'Style', module.style);
    appendLine(lines, 'Size', module.size);
    appendLine(lines, 'Roof', module.roof || draft.shared.roof);
    appendLine(lines, 'Colour', module.colour || draft.shared.colour);
    appendLine(lines, 'Pitch', module.pitch);
    appendLine(lines, 'Posts', module.posts);
    appendLine(lines, 'House connection', module.houseConnection || draft.shared.houseConnection);
    appendLine(lines, 'Post fixings', module.postFixings || draft.shared.postFixings);
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
    const title = module.title.trim() || `Module ${index + 1}`;
    const styleSuffix = module.style.trim() ? `: ${module.style.trim()}` : '';
    lines.push(`${title}${styleSuffix}`);
    appendLine(lines, 'Size', module.size);
    appendLine(lines, 'Pitch', module.pitch);
    appendLine(lines, 'Posts', module.posts);

    if (!draft.shared.roof.trim()) appendLine(lines, 'Roof', module.roof);
    if (!draft.shared.colour.trim()) appendLine(lines, 'Colour', module.colour);
    if (!draft.shared.houseConnection.trim()) appendLine(lines, 'House connection', module.houseConnection);
    if (!draft.shared.postFixings.trim()) appendLine(lines, 'Post fixings', module.postFixings);
  });

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
