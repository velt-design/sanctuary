// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260731_000001_project_design_booklets.sql",
  ),
  "utf8",
).toLowerCase();
const pdfDrawingMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260810_000001_project_design_booklet_pdf_drawings.sql",
  ),
  "utf8",
).toLowerCase();

describe("project design booklet persistence migration", () => {
  it("owns one active draft per project with optimistic revisions", () => {
    expect(migration).toContain(
      "create table if not exists public.project_design_booklets",
    );
    expect(migration).toContain(
      "project_id uuid primary key references public.projects(id) on delete cascade",
    );
    expect(migration).toContain("revision bigint not null default 1");
  });

  it("keeps image assets and generated PDFs in a private, project-scoped bucket", () => {
    expect(migration).toContain("'design-booklet-assets'");
    expect(migration).toMatch(/false,\r?\n {2}20971520/);
    expect(migration).toContain("'application/pdf'");
    expect(migration).toContain(
      "projects.id::text = split_part(storage.objects.name, '/', 1)",
    );
    expect(migration).not.toContain("to anon");
  });

  it("gives authenticated portal staff row-level access to both metadata tables", () => {
    expect(migration).toContain(
      "alter table public.project_design_booklets enable row level security",
    );
    expect(migration).toContain(
      "alter table public.project_design_booklet_assets enable row level security",
    );
    expect(
      migration.match(/select public\.has_portal_access\(\)/g)?.length,
    ).toBeGreaterThanOrEqual(6);
  });

  it("adds validated PDF drawing metadata without weakening the existing access boundary", () => {
    expect(pdfDrawingMigration).toContain("'application/pdf'");
    expect(pdfDrawingMigration).toContain(
      "add column if not exists page_count integer not null default 1",
    );
    expect(pdfDrawingMigration).toContain("page_count between 1 and 50");
    expect(pdfDrawingMigration).not.toContain("grant ");
    expect(pdfDrawingMigration).not.toContain("policy");
  });
});
