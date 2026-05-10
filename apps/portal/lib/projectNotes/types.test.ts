import { describe, expect, it } from 'vitest';
import {
  PROJECT_NOTE_BODY_MAX_LENGTH,
  deriveAuthorDisplayName,
  mapProjectNoteRow,
  normalizeNoteBody,
  type ProjectNoteRow,
} from './types';

describe('normalizeNoteBody', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeNoteBody('  hello  ')).toBe('hello');
  });

  it('rejects empty bodies', () => {
    expect(normalizeNoteBody('')).toBeNull();
    expect(normalizeNoteBody('   ')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(normalizeNoteBody(123)).toBeNull();
    expect(normalizeNoteBody(null)).toBeNull();
    expect(normalizeNoteBody(undefined)).toBeNull();
  });

  it('rejects bodies past the maximum length', () => {
    const tooLong = 'x'.repeat(PROJECT_NOTE_BODY_MAX_LENGTH + 1);
    expect(normalizeNoteBody(tooLong)).toBeNull();
  });
});

describe('deriveAuthorDisplayName', () => {
  it('prefers full_name when present', () => {
    expect(deriveAuthorDisplayName({ user_metadata: { full_name: 'Casey Test' } })).toBe('Casey Test');
  });

  it('falls back to other metadata aliases', () => {
    expect(deriveAuthorDisplayName({ user_metadata: { name: 'Display' } })).toBe('Display');
    expect(deriveAuthorDisplayName({ user_metadata: { display_name: 'Display' } })).toBe('Display');
  });

  it('returns null when no usable name is set', () => {
    expect(deriveAuthorDisplayName({ user_metadata: {} })).toBeNull();
    expect(deriveAuthorDisplayName({})).toBeNull();
  });
});

describe('mapProjectNoteRow', () => {
  const baseRow: ProjectNoteRow = {
    id: 'note-1',
    project_id: 'proj-1',
    author_id: 'user-1',
    author_email: 'casey@example.test',
    author_display_name: 'Casey',
    body: 'hello',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    deleted_at: null,
  };

  it('marks notes as own when the current user matches the author', () => {
    const note = mapProjectNoteRow(baseRow, 'user-1');
    expect(note.isOwn).toBe(true);
    expect(note.authorDisplayName).toBe('Casey');
  });

  it('marks notes as not own when the current user differs', () => {
    expect(mapProjectNoteRow(baseRow, 'user-2').isOwn).toBe(false);
  });

  it('marks notes as not own when there is no current user', () => {
    expect(mapProjectNoteRow(baseRow, null).isOwn).toBe(false);
  });

  it('treats blank display names as null', () => {
    const note = mapProjectNoteRow({ ...baseRow, author_display_name: '   ' }, 'user-1');
    expect(note.authorDisplayName).toBeNull();
  });
});
