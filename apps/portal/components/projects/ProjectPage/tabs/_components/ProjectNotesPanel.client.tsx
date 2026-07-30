"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePortalSession } from "@/components/auth/PortalAuthProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { formatPortalDateTime } from "@/lib/format/portalDateTime";
import { qk } from "@/lib/queries/keys";
import {
  supabaseHostFromUrl,
  supabaseRuntimeUrl,
} from "@/lib/supabase/browserClient";
import { enqueueAndProcessLocalFirstMutation } from "@/lib/localFirst/queue";
import {
  ActivityTimeline,
  ActivityTimelineItem,
  Badge,
  Button,
  DestructiveConfirmation,
  EmptyState,
  Textarea,
} from "@/components/ui/foundation";
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
} from "@/lib/localFirst/portalEntities";
import type {
  ProjectNote,
  ProjectPageSnapshotResponse,
} from "@/lib/projects/types";
import {
  PROJECT_NOTE_BODY_MAX_LENGTH,
  normalizeNoteBody,
  projectNoteAuthorDisplayName,
} from "@/lib/projectNotes/types";
import styles from "./ProjectNotesPanel.module.css";

function authorLabelFor(note: ProjectNote): string {
  const resolved = projectNoteAuthorDisplayName({
    authorDisplayName: note.authorDisplayName,
    authorEmail: note.authorEmail,
  });
  if (resolved) return resolved;
  if (note.authorEmail) {
    const local = note.authorEmail.split("@")[0];
    if (local) return local;
    return note.authorEmail;
  }
  return "Unknown";
}

function noteWasEdited(note: ProjectNote): boolean {
  if (!note.updatedAt || !note.createdAt) return false;
  return (
    new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() >
    1000
  );
}

function isPendingId(noteId: string): boolean {
  return noteId.startsWith("local-note:");
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
  const hostKey = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || "unknown",
    [],
  );

  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);
  const [composerValue, setComposerValue] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ProjectNote | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  // Subscribe to snapshot cache updates so optimistic + server reconciles flow into the list.
  useEffect(() => {
    const queryKey = qk.projects.snapshot(hostKey, projectId);
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      if (!event.query) return;
      if (JSON.stringify(event.query.queryKey) !== JSON.stringify(queryKey))
        return;
      const data = event.query.state.data as
        | ProjectPageSnapshotResponse
        | undefined;
      if (data?.snapshot?.notes) setNotes(data.snapshot.notes);
    });
    return () => unsubscribe();
  }, [hostKey, projectId, queryClient]);

  const isAdmin = session.isAdmin;
  const currentUserId = session.user?.id ?? null;
  const currentEmail = session.email ?? "";

  function canEditNote(note: ProjectNote): boolean {
    if (isPendingId(note.id)) return false;
    if (isAdmin) return true;
    return note.isOwn;
  }

  async function handleSubmit() {
    const body = normalizeNoteBody(composerValue);
    if (!body) {
      setComposerError("Note cannot be empty");
      return;
    }
    if (!currentUserId) {
      setComposerError("Sign-in required");
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
    setComposerValue("");

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
      removeProjectNoteFromSnapshot(
        queryClient,
        hostKey,
        projectId,
        localNoteId,
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to add note",
      );
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
    setEditorValue("");
    setEditorError(null);
  }

  async function commitEdit(note: ProjectNote) {
    const body = normalizeNoteBody(editorValue);
    if (!body) {
      setEditorError("Note cannot be empty");
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
    replaceProjectNoteInSnapshot(
      queryClient,
      hostKey,
      projectId,
      note.id,
      optimisticUpdated,
    );
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
      replaceProjectNoteInSnapshot(
        queryClient,
        hostKey,
        projectId,
        note.id,
        previous,
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to update note",
      );
    }
  }

  async function handleDelete(note: ProjectNote) {
    setDeleting(true);
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
      toast.error(
        error instanceof Error ? error.message : "Failed to delete note",
      );
    } finally {
      setDeleting(false);
      setDeleteCandidate(null);
      setDeleteConfirmText("");
    }
  }

  return (
    <div className={styles.panel} data-project-notes-panel="true">
      <div className={styles.composer}>
        <Textarea
          label="Add a note"
          placeholder="Add a note for the team…"
          value={composerValue}
          maxLength={PROJECT_NOTE_BODY_MAX_LENGTH}
          error={composerError}
          onChange={(event) => {
            setComposerValue(event.target.value);
            if (composerError) setComposerError(null);
          }}
          disabled={submitting}
        />
        <div className={styles.composerActions}>
          <Button
            type="button"
            loading={submitting}
            disabled={submitting || !composerValue.trim()}
            onClick={() => void handleSubmit()}
          >
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          compact
          title="No notes yet"
          description="Add the first note for the team."
        />
      ) : (
        <ActivityTimeline ariaLabel="Project notes">
          {notes.map((note) => {
            const editing = editingId === note.id;
            const pending = isPendingId(note.id);
            return (
              <ActivityTimelineItem
                key={note.id}
                data-project-note-id={note.id}
                marker={<Badge tone="info">Project note</Badge>}
                meta={
                  <>
                    {formatPortalDateTime(note.createdAt)}
                    {pending
                      ? " · Saving…"
                      : !pending && noteWasEdited(note)
                        ? " · Edited"
                        : ""}
                  </>
                }
                footer={<>Added by {authorLabelFor(note)}</>}
                actions={
                  !editing && canEditNote(note) ? (
                    <>
                      <Button
                        type="button"
                        variant="quiet"
                        size="small"
                        onClick={() => startEditing(note)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        size="small"
                        onClick={() => {
                          setDeleteCandidate(note);
                          setDeleteConfirmText("");
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  ) : null
                }
              >
                {editing ? (
                  <div className={styles.editor}>
                    <Textarea
                      label="Edit note"
                      value={editorValue}
                      maxLength={PROJECT_NOTE_BODY_MAX_LENGTH}
                      error={editorError}
                      onChange={(event) => {
                        setEditorValue(event.target.value);
                        if (editorError) setEditorError(null);
                      }}
                    />
                    <div className={styles.editorActions}>
                      <Button
                        type="button"
                        variant="tertiary"
                        size="small"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="small"
                        onClick={() => void commitEdit(note)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.noteBody}>{note.body}</p>
                )}
              </ActivityTimelineItem>
            );
          })}
        </ActivityTimeline>
      )}

      <DestructiveConfirmation
        open={Boolean(deleteCandidate)}
        title="Delete project note?"
        description="The note will be removed from this project activity."
        confirmationText="DELETE"
        value={deleteConfirmText}
        onValueChange={setDeleteConfirmText}
        pending={deleting}
        onCancel={() => {
          if (!deleting) {
            setDeleteCandidate(null);
            setDeleteConfirmText("");
          }
        }}
        onConfirm={() => {
          if (deleteCandidate) void handleDelete(deleteCandidate);
        }}
        consequences="The note cannot be recovered after the queued delete is confirmed."
      />
    </div>
  );
}
