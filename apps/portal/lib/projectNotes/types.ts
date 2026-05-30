import type { ProjectNote } from '@/lib/projects/types';

export type ProjectNoteRow = {
  id: string;
  project_id: string;
  author_id: string;
  author_email: string;
  author_display_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProjectNoteCreateInput = {
  body: string;
};

export type ProjectNoteUpdateInput = {
  body: string;
};

export const PROJECT_NOTE_BODY_MAX_LENGTH = 8000;
const PROJECT_NOTE_AUTHOR_EMAIL_DISPLAY_OVERRIDES: Record<string, string> = {
  'info@sanctuarypergolas.co.nz': 'Ellen',
};

export function normalizeNoteBody(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length > PROJECT_NOTE_BODY_MAX_LENGTH) return null;
  return trimmed;
}

export function mapProjectNoteRow(row: ProjectNoteRow, currentUserId: string | null): ProjectNote {
  return {
    id: row.id,
    body: row.body,
    authorId: row.author_id,
    authorEmail: row.author_email,
    authorDisplayName: projectNoteAuthorDisplayName({
      authorDisplayName: row.author_display_name,
      authorEmail: row.author_email,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwn: currentUserId !== null && row.author_id === currentUserId,
  };
}

export function projectNoteAuthorDisplayName(input: {
  authorDisplayName?: string | null;
  authorEmail?: string | null;
}): string | null {
  const displayName = input.authorDisplayName?.trim();
  if (displayName) return displayName;

  const email = input.authorEmail?.trim().toLowerCase();
  if (!email) return null;
  return PROJECT_NOTE_AUTHOR_EMAIL_DISPLAY_OVERRIDES[email] ?? null;
}

export function deriveAuthorDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const meta = user.user_metadata ?? {};
  const candidates = [meta?.full_name, meta?.fullName, meta?.name, meta?.display_name];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return projectNoteAuthorDisplayName({ authorEmail: user.email });
}
