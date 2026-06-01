'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { qk } from '@/lib/queries/keys';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { enqueueAndProcessLocalFirstMutation } from '@/lib/localFirst/queue';
import legacy from '@/app/staff/projects/projects.module.css';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  buildOptimisticProjectNote,
  buildProjectNoteEntityKey,
  createLocalProjectNoteId,
  insertOptimisticProjectNote,
  type PortalProjectNoteCreateMutationPayload,
  type PortalProjectNoteDeleteMutationPayload,
  type PortalProjectNoteUpdateMutationPayload,
  removeProjectNoteFromSnapshot,
  replaceProjectNoteInSnapshot,
} from '@/lib/localFirst/portalEntities';
import type { ProjectNote, ProjectPageSnapshotResponse } from '@/lib/projects/types';
import {
  PROJECT_NOTE_BODY_MAX_LENGTH,
  normalizeNoteBody,
  projectNoteAuthorDisplayName,
} from '@/lib/projectNotes/types';
import styles from './ProjectNotesPanel.module.css';

function authorLabelFor(note: ProjectNote): string {
  const resolved = projectNoteAuthorDisplayName({
    authorDisplayName: note.authorDisplayName,
    authorEmail: note.authorEmail,
  });
  if (resolved) return resolved;
  if (note.authorEmail) {
    const local = note.authorEmail.split('@')[0];
    if (local) return local;
    return note.authorEmail;
  }
  return 'Unknown';
}

function noteWasEdited(note: ProjectNote): boolean {
  if (!note.updatedAt || !note.createdAt) return false;
  return new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;
}

function isPendingId(noteId: string): boolean {
  return noteId.startsWith('local-note:');
}

export default function ProjectNotesPanel({
  projectId,
  initialNotes,
}: {
  projectId: string;
  initialNotes: ProjectNote[];
}) {
  const queryClient = useQueryClient();
  const session = usePortalSession();
  const toast = useToast();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);
  const [composerValue, setComposerValue] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  // Subscribe to snapshot cache updates so optimistic + server reconciles flow into the list.
  useEffect(() => {
    const queryKey = qk.projects.snapshot(hostKey, projectId);
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      if (!event.query) return;
      if (JSON.stringify(event.query.queryKey) !== JSON.stringify(queryKey)) return;
      const data = event.query.state.data as ProjectPageSnapshotResponse | undefined;
      if (data?.snapshot?.notes) setNotes(data.snapshot.notes);
    });
    return () => unsubscribe();
  }, [hostKey, projectId, queryClient]);

  const isAdmin = session.isAdmin;
  const currentUserId = session.user?.id ?? null;
  const currentEmail = session.email ?? '';

  function canEditNote(note: ProjectNote): boolean {
    if (isPendingId(note.id)) return false;
    if (isAdmin) return true;
    return note.isOwn;
  }

  async function handleSubmit() {
    const body = normalizeNoteBody(composerValue);
    if (!body) {
      setComposerError('Note cannot be empty');
      return;
    }
    if (!currentUserId) {
      setComposerError('Sign-in required');
      return;
    }
    setSubmitting(true);
    setComposerError(null);

    const localNoteId = createLocalProjectNoteId();
    const optimistic = buildOptimisticProjectNote({
      localNoteId,
      body,
      author: {
        authorId: currentUserId,
        authorEmail: currentEmail,
        authorDisplayName: null,
      },
    });
    insertOptimisticProjectNote(queryClient, hostKey, projectId, optimistic);
    setComposerValue('');

    const payload: PortalProjectNoteCreateMutationPayload = {
      localNoteId,
      projectId,
      body,
      authorOptimistic: {
        authorId: currentUserId,
        authorEmail: currentEmail,
        authorDisplayName: null,
      },
    };

    try {
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildProjectNoteEntityKey(localNoteId),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteCreate,
        payload,
      });
    } catch (error) {
      removeProjectNoteFromSnapshot(queryClient, hostKey, projectId, localNoteId);
      toast.error(error instanceof Error ? error.message : 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(note: ProjectNote) {
    setEditingId(note.id);
    setEditorValue(note.body);
    setEditorError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditorValue('');
    setEditorError(null);
  }

  async function commitEdit(note: ProjectNote) {
    const body = normalizeNoteBody(editorValue);
    if (!body) {
      setEditorError('Note cannot be empty');
      return;
    }
    if (body === note.body) {
      cancelEditing();
      return;
    }
    const previous = note;
    const optimisticUpdated: ProjectNote = {
      ...note,
      body,
      updatedAt: new Date().toISOString(),
    };
    replaceProjectNoteInSnapshot(queryClient, hostKey, projectId, note.id, optimisticUpdated);
    cancelEditing();

    const payload: PortalProjectNoteUpdateMutationPayload = {
      noteId: note.id,
      projectId,
      body,
    };

    try {
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildProjectNoteEntityKey(note.id),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteUpdate,
        payload,
      });
    } catch (error) {
      replaceProjectNoteInSnapshot(queryClient, hostKey, projectId, note.id, previous);
      toast.error(error instanceof Error ? error.message : 'Failed to update note');
    }
  }

  async function handleDelete(note: ProjectNote) {
    const confirmed =
      typeof window === 'undefined' || window.confirm('Delete this note? This cannot be undone.');
    if (!confirmed) return;

    removeProjectNoteFromSnapshot(queryClient, hostKey, projectId, note.id);

    const payload: PortalProjectNoteDeleteMutationPayload = {
      noteId: note.id,
      projectId,
    };

    try {
      await enqueueAndProcessLocalFirstMutation({
        entityKey: buildProjectNoteEntityKey(note.id),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteDelete,
        payload,
      });
    } catch (error) {
      // Re-insert the note on terminal failure so the user can retry.
      insertOptimisticProjectNote(queryClient, hostKey, projectId, note);
      toast.error(error instanceof Error ? error.message : 'Failed to delete note');
    }
  }

  return (
    <section className={styles.panel} data-project-notes-panel="true">
      <div className={styles.composer}>
        <textarea
          className={styles.composerTextarea}
          aria-label="Add a note"
          placeholder="Add a note for the team…"
          value={composerValue}
          maxLength={PROJECT_NOTE_BODY_MAX_LENGTH}
          onChange={(event) => {
            setComposerValue(event.target.value);
            if (composerError) setComposerError(null);
          }}
          disabled={submitting}
        />
        {composerError ? <p className={styles.composerError}>{composerError}</p> : null}
        <div className={styles.composerActions}>
          <button
            type="button"
            className={legacy.button}
            disabled={submitting || !composerValue.trim()}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Adding…' : 'Add note'}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className={styles.empty}>No notes yet. Add the first note for the team.</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((note) => {
            const editing = editingId === note.id;
            const pending = isPendingId(note.id);
            return (
              <li key={note.id} className={styles.note} data-project-note-id={note.id}>
                <header className={styles.noteHeader}>
                  <span className={styles.noteTypePill}>Project note</span>
                  <span className={styles.noteMetaCluster}>
                    <span className={styles.noteMeta}>{formatPortalDateTime(note.createdAt)}</span>
                    {pending ? <span className={styles.notePending}>Saving…</span> : null}
                    {!pending && noteWasEdited(note) ? <span className={styles.noteEdited}>(edited)</span> : null}
                    {!editing && canEditNote(note) ? (
                      <span className={styles.noteActions}>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => startEditing(note)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => void handleDelete(note)}
                        >
                          Delete
                        </button>
                      </span>
                    ) : null}
                  </span>
                </header>
                {editing ? (
                  <div>
                    <textarea
                      className={styles.editorTextarea}
                      aria-label="Edit note"
                      value={editorValue}
                      maxLength={PROJECT_NOTE_BODY_MAX_LENGTH}
                      onChange={(event) => {
                        setEditorValue(event.target.value);
                        if (editorError) setEditorError(null);
                      }}
                    />
                    {editorError ? <p className={styles.composerError}>{editorError}</p> : null}
                    <div className={styles.editorActions}>
                      <button type="button" className={styles.actionButton} onClick={cancelEditing}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={legacy.button}
                        onClick={() => void commitEdit(note)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.noteBody}>{note.body}</p>
                )}
                <p className={styles.noteFooter}>Added by {authorLabelFor(note)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
