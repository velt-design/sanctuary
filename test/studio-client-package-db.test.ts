// @vitest-environment node
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  packageDatabase,
  packageIds as ids,
} from "./fixtures/studio-client-package-db";
let db: Awaited<ReturnType<typeof packageDatabase>>;
const draft = (renders: string[] = []) => ({
  to: "qa@example.test",
  subject: "Your Sanctuary quote",
  message: "Hello, please find your quote.",
  includeBooklet: true,
  renderFileIds: renders,
  fileIds: [],
});
const save = (revision: number, value = draft()) =>
  db
    .query<{
      value: any;
    }>("select public.studio_client_package_save($1,$2,$3,$4) value", [ids.quote, ids.actor, revision, value])
    .then((r) => r.rows[0].value);
beforeEach(async () => {
  db = await packageDatabase();
}, 20000);
afterEach(async () => {
  await db?.close();
});
it("applies forward migrations and preserves base identity/bytes while composing and reusing exact ordered variants", async () => {
  const base = await save(0);
  expect(base.documentId).toBe(ids.snapshot);
  const variant = await save(1, draft([ids.file]));
  expect(variant.documentId).not.toBe(ids.snapshot);
  const rows = await db.query<any>(
    "select document_id,snapshot_id,total_pages,variant_manifest,job_id from private.studio_client_documents order by variant_manifest nulls first",
  );
  expect(rows.rows).toHaveLength(2);
  expect(rows.rows[1]).toMatchObject({
    snapshot_id: ids.snapshot,
    total_pages: 14,
  });
  expect(rows.rows[1].job_id).toBeTruthy();
  expect((await save(2, draft([ids.file]))).documentId).toBe(
    variant.documentId,
  );
  const empty = await save(3);
  expect(empty.documentId).toBe(ids.snapshot);
  const status = await db.query<any>(
    "select public.studio_client_document_status($1,$2,true) value",
    [ids.quote, ids.actor],
  );
  expect(status.rows[0].value.file.contentBase64).toBe(
    Buffer.from("%PDF-original-booklet").toString("base64"),
  );
  expect(status.rows[0].value.totalPages).toBe(13);
  await expect(save(1)).rejects.toThrow("stale");
  await expect(
    db.query(
      "update private.studio_client_documents set variant_hash=$1 where document_id=$2",
      ["b".repeat(64), variant.documentId],
    ),
  ).rejects.toThrow("immutable");
});
it("filters variant jobs before queue visibility mutation for a V4-only old worker", async () => {
  const variant = await save(0, draft([ids.file]));
  expect(variant.documentId).toBeTruthy();
  await db.query(
    "select set_config('sanctuary.background_job_claim_kinds',$1,false),set_config('sanctuary.background_job_claim_projects',$2,false),set_config('sanctuary.studio_document_manifest_versions',$3,false)",
    [
      JSON.stringify(["studio_design_booklet_v1"]),
      JSON.stringify([ids.project]),
      JSON.stringify(["studio-booklet-layout.v4"]),
    ],
  );
  expect(
    (
      await db.query(
        "select * from private.background_job_read_claim_queue(120,1)",
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (await db.query<any>("select read_ct from pgmq.q_portal_background_jobs"))
      .rows[0].read_ct,
  ).toBe(0);
  await db.query(
    "select set_config('sanctuary.studio_document_manifest_versions',$1,false)",
    [JSON.stringify(["studio-booklet-layout.v4", "studio-booklet-renders.v1"])],
  );
  expect(
    (
      await db.query(
        "select * from private.background_job_read_claim_queue(120,1)",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (await db.query<any>("select read_ct from pgmq.q_portal_background_jobs"))
      .rows[0].read_ct,
  ).toBe(1);
});
async function prepare(saved: any) {
  const payload = {
    commercialRevision: 1,
    studioPackage: {
      actorUserId: ids.actor,
      revision: saved.revision,
      documentId: saved.documentId,
      value: saved.value,
    },
    attachmentFileIds: [
      ids.financial,
      ...(saved.value.includeBooklet ? [ids.booklet] : []),
      ...saved.value.fileIds,
    ],
  };
  return (
    await db.query<any>(
      "select intent_id from public.commercial_quote_prepare_delivery_email($1,1,$2,'quote_send',$1,$3,$4,$5,now()+interval '1 day')",
      [
        ids.quote,
        `package:${saved.revision}`,
        ids.project,
        "c".repeat(64),
        payload,
      ],
    )
  ).rows[0].intent_id;
}
const cancel = (saved: any, intent: string) =>
  db.query("select public.studio_client_package_cancel($1,$2,$3,$4,$5,1)", [
    ids.quote,
    ids.actor,
    saved.revision,
    intent,
    "c".repeat(64),
  ]);
it("prepares canonical payload without dispatch, fences edits, cancels only unattempted intent and permits reprepare with new identity", async () => {
  const saved = await save(0),
    intent = await prepare(saved);
  expect(
    (
      await db.query<any>(
        "select status,attempt_count from private.commercial_email_intents",
      )
    ).rows[0],
  ).toEqual({ status: "prepared", attempt_count: 0 });
  await expect(save(1)).rejects.toThrow("prepared");
  await cancel(saved, intent);
  await expect(
    db.query("select public.commercial_email_mark_dispatching($1)", [intent]),
  ).rejects.toThrow("cancelled");
  const next = (
    await db.query<any>(
      "select public.studio_client_package_read($1,$2) value",
      [ids.quote, ids.actor],
    )
  ).rows[0].value;
  expect(next.revision).toBe(2);
  expect(next.preparedIntentId).toBeNull();
  const second = await prepare(next);
  expect(second).not.toBe(intent);
});
it("refuses cancellation if dispatch wins and never resurrects a superseded quote", async () => {
  const saved = await save(0),
    intent = await prepare(saved);
  await db.query("select public.commercial_email_mark_dispatching($1)", [
    intent,
  ]);
  await expect(cancel(saved, intent)).rejects.toThrow("attempted");
  await db.query(
    "update private.commercial_email_intents set status='prepared',attempt_count=0 where id=$1",
    [intent],
  );
  await db.query(
    "insert into public.quote_versions values(gen_random_uuid(),$1,2,'DRAFT',1,true,null)",
    [ids.family],
  );
  await cancel(saved, intent);
  expect(
    (
      await db.query<any>(
        "select is_current_draft from public.quote_versions where id=$1",
        [ids.quote],
      )
    ).rows[0].is_current_draft,
  ).toBe(false);
});
it("refuses pending variants, mismatched exact attachment list, cross-project and duplicated render files", async () => {
  const saved = await save(0, draft([ids.file]));
  await expect(prepare(saved)).rejects.toThrow("not ready");
  await expect(save(1, draft([ids.file, ids.file]))).rejects.toThrow(
    "selection_invalid",
  );
  await db.query(
    "update public.file_artifacts set project_id=gen_random_uuid() where id=$1",
    [ids.file],
  );
  await expect(save(1, draft([ids.file]))).rejects.toThrow("unavailable");
});
it("supports financial-only save/read/prepare with no phantom base document or render job", async () => {
  await db.query(
    "delete from private.studio_client_documents where document_id=$1",
    [ids.snapshot],
  );
  await db.query(
    "update private.studio_client_document_sources set drawing_source=$1 where snapshot_id=$2",
    [
      {
        layoutVersion: "studio-booklet-layout.v4",
        products: [],
        pageManifest: [],
      },
      ids.snapshot,
    ],
  );
  const saved = await save(0, { ...draft(), includeBooklet: false });
  expect(saved.documentId).toBeNull();
  expect(
    (
      await db.query<any>(
        "select public.studio_client_document_status($1,$2,false) value",
        [ids.quote, ids.actor],
      )
    ).rows[0].value.state,
  ).toBe("unavailable");
  await prepare(saved);
  expect(
    (
      await db.query<any>(
        "select protected_payload from private.commercial_email_intents",
      )
    ).rows[0].protected_payload.attachmentFileIds,
  ).toEqual([ids.financial]);
  expect(
    (await db.query("select * from public.background_jobs")).rows,
  ).toHaveLength(0);
});
it("fails closed for missing/empty/wrong named cancellation command and null or mismatched expected identities", async () => {
  const saved = await save(0),
    intent = await prepare(saved);
  for (const setting of [null, "", "wrong-intent"]) {
    if (setting !== null)
      await db.query(
        "select set_config('sanctuary.studio_package_cancel',$1,false)",
        [setting],
      );
    await expect(
      db.query(
        "update private.commercial_email_intents set status='cancelled' where id=$1",
        [intent],
      ),
    ).rejects.toThrow("Only invoice restoration");
  }
  const valid: any[] = [
    ids.quote,
    ids.actor,
    saved.revision,
    intent,
    "c".repeat(64),
    1,
  ];
  for (const index of [0, 1, 2, 3, 4, 5]) {
    const invalid = [...valid];
    invalid[index] = null;
    await expect(
      db.query(
        "select public.studio_client_package_cancel($1,$2,$3,$4,$5,$6)",
        invalid,
      ),
    ).rejects.toThrow("invalid");
  }
  await expect(
    db.query("select public.studio_client_package_cancel($1,$2,$3,$4,$5,$6)", [
      ...valid.slice(0, 4),
      "b".repeat(64),
      1,
    ]),
  ).rejects.toThrow("attempted");
  await cancel(saved, intent);
  expect(
    (
      await db.query<any>(
        "select status from private.commercial_email_intents where id=$1",
        [intent],
      )
    ).rows[0].status,
  ).toBe("cancelled");
});
it.each(["DRAFT", "SENT"])(
  "does not restore old current draft when any newer %s version exists, including prepared versions",
  async (status) => {
    const saved = await save(0),
      intent = await prepare(saved);
    await db.query(
      "insert into public.quote_versions values(gen_random_uuid(),$1,2,$2,1,false,now())",
      [ids.family, status],
    );
    await cancel(saved, intent);
    expect(
      (
        await db.query<any>(
          "select is_current_draft from public.quote_versions where id=$1",
          [ids.quote],
        )
      ).rows[0].is_current_draft,
    ).toBe(false);
  },
);
it("binds preview/download/retry to expected package revision and exact desired document across two-window changes", async () => {
  const chosen = await save(0, draft([ids.file]));
  const request = (
    revision: number,
    doc: string,
    download = false,
    retry = false,
  ) =>
    db.query<any>(
      "select public.studio_client_package_document($1,$2,$3,$4,$5,$6) value",
      [ids.quote, ids.actor, revision, doc, download, retry],
    );
  await expect(request(0, ids.snapshot, true)).rejects.toThrow("stale");
  await expect(request(1, chosen.documentId, true)).rejects.toThrow(
    "not ready",
  );
  await db.query(
    "update private.studio_client_documents set file_id=$1 where document_id=$2",
    [ids.booklet, chosen.documentId],
  );
  const response = await request(1, chosen.documentId, true);
  expect(response.rows[0].value).toMatchObject({
    documentId: chosen.documentId,
    packageRevision: 1,
    state: "ready",
  });
  await save(1);
  for (const [download, retry] of [
    [false, false],
    [true, false],
    [false, true],
  ])
    await expect(
      request(1, chosen.documentId, download, retry),
    ).rejects.toThrow("stale");
});
it("keeps older selected artifact identities visible while exposing and traversing bounded metadata pages", async () => {
  await db.query(
    "update public.file_artifacts set created_at=now()-interval '2 years' where id=$1",
    [ids.file],
  );
  await db.query(
    "insert into public.file_artifacts(project_id,filename,content_type,size_bytes,content_base64) select $1,'Site file '||i,'application/pdf',1,'eA==' from generate_series(1,110) i",
    [ids.project],
  );
  await save(0, { ...draft(), fileIds: [ids.file] });
  const page = (
    await db.query<any>(
      "select public.studio_client_package_files($1,$2,0) value",
      [ids.quote, ids.actor],
    )
  ).rows[0].value;
  expect(page.hasMore).toBe(true);
  expect(page.files.some((file: any) => file.id === ids.file)).toBe(true);
  const next = (
    await db.query<any>(
      "select public.studio_client_package_files($1,$2,100) value",
      [ids.quote, ids.actor],
    )
  ).rows[0].value;
  expect(next.hasMore).toBe(false);
  expect(next.files.some((file: any) => file.id === ids.file)).toBe(true);
});
