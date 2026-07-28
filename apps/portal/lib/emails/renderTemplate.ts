import fs from 'node:fs/promises';
import path from 'node:path';
import Handlebars from 'handlebars';
import { PORTAL_DEFAULT_ACCENT_HEX, PORTAL_DEFAULT_ACCENT_RGB_CSV } from '../theme/presets';
import { SANCTUARY_ARTIFACT_BRAND } from '../customerArtifacts/brand';

let cachedTemplateDir: string | null = null;

function templateDirCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, 'lib', 'emails', 'templates'),
    path.join(cwd, 'apps', 'portal', 'lib', 'emails', 'templates'),
    path.join(cwd, '..', 'portal', 'lib', 'emails', 'templates'),
    path.join(cwd, '..', '..', 'apps', 'portal', 'lib', 'emails', 'templates'),
  ];
}

async function resolveTemplateDir(): Promise<string> {
  if (cachedTemplateDir) return cachedTemplateDir;

  for (const candidate of templateDirCandidates()) {
    try {
      await fs.access(candidate);
      cachedTemplateDir = candidate;
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('Email template directory not found.');
}

export async function renderTemplate(
  templateBaseName: string,
  variables: Record<string, unknown>,
  options: { plainTextNoEscape?: boolean } = {},
): Promise<{ html: string; text?: string }> {
  const templateDir = await resolveTemplateDir();
  const htmlPath = path.join(templateDir, `${templateBaseName}.html`);
  const htmlSource = await fs.readFile(htmlPath, 'utf8');

  const textPath = path.join(templateDir, `${templateBaseName}.txt`);
  let textSource: string | null = null;
  try {
    textSource = await fs.readFile(textPath, 'utf8');
  } catch {
    textSource = null;
  }

  const themedVariables: Record<string, unknown> = {
    brand_accent_hex: PORTAL_DEFAULT_ACCENT_HEX,
    brand_accent_rgb: PORTAL_DEFAULT_ACCENT_RGB_CSV,
    brand_canvas_hex: SANCTUARY_ARTIFACT_BRAND.colors.canvas,
    brand_paper_hex: SANCTUARY_ARTIFACT_BRAND.colors.paper,
    brand_paper_strong_hex: SANCTUARY_ARTIFACT_BRAND.colors.paperStrong,
    brand_ink_hex: SANCTUARY_ARTIFACT_BRAND.colors.ink,
    brand_ink_muted_hex: SANCTUARY_ARTIFACT_BRAND.colors.inkMuted,
    brand_rule_hex: SANCTUARY_ARTIFACT_BRAND.colors.rule,
    brand_rule_strong_hex: SANCTUARY_ARTIFACT_BRAND.colors.ruleStrong,
    brand_display_font_stack: SANCTUARY_ARTIFACT_BRAND.fonts.display,
    brand_body_font_stack: SANCTUARY_ARTIFACT_BRAND.fonts.body,
    ...variables,
  };

  const html = Handlebars.compile(htmlSource)(themedVariables);
  const text = textSource
    ? Handlebars.compile(textSource, {
        noEscape: options.plainTextNoEscape ?? false,
      })(themedVariables)
    : undefined;

  return { html, text };
}
