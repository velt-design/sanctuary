import fs from 'node:fs/promises';
import path from 'node:path';
import Handlebars from 'handlebars';
import { BRAND_ACCENT_HEX, BRAND_ACCENT_RGB_CSV } from '@sp/theme';

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

export async function renderTemplate(templateBaseName: string, variables: Record<string, unknown>): Promise<{ html: string; text?: string }> {
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
    brand_accent_hex: BRAND_ACCENT_HEX,
    brand_accent_rgb: BRAND_ACCENT_RGB_CSV,
    ...variables,
  };

  const html = Handlebars.compile(htmlSource)(themedVariables);
  const text = textSource ? Handlebars.compile(textSource)(themedVariables) : undefined;

  return { html, text };
}
