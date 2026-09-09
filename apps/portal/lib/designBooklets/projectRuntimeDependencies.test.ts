import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadDesignBookletSharp } from "./sharpRuntime";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, { dev?: boolean; optional?: boolean }>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

describe("project design booklet runtime dependencies", () => {
  it("ships Sharp and its Linux native runtime outside the development-only graph", () => {
    const portalPackage = readJson<PackageManifest>(
      path.join(process.cwd(), "apps/portal/package.json"),
    );
    const packageLock = readJson<PackageLock>(
      path.join(process.cwd(), "package-lock.json"),
    );

    expect(portalPackage.dependencies?.sharp).toBe("0.35.3");
    expect(portalPackage.devDependencies?.sharp).toBeUndefined();
    expect(packageLock.packages?.["node_modules/sharp"]?.dev).not.toBe(true);
    expect(
      packageLock.packages?.["node_modules/@img/sharp-linux-x64"]?.dev,
    ).not.toBe(true);
    expect(
      packageLock.packages?.["node_modules/@img/sharp-libvips-linux-x64"]
        ?.dev,
    ).not.toBe(true);
  });

  it("keeps lightweight project booklet routes independent of Sharp startup", () => {
    const runtimeConsumers = ["projectPersistence.ts", "request.ts", "pdf.ts"];
    const runtimeSource = readFileSync(
      path.join(
        process.cwd(),
        "apps/portal/lib/designBooklets/sharpRuntime.ts",
      ),
      "utf8",
    );

    for (const filename of runtimeConsumers) {
      const source = readFileSync(
        path.join(
          process.cwd(),
          "apps/portal/lib/designBooklets",
          filename,
        ),
        "utf8",
      );
      expect(source).not.toMatch(/^import sharp\b/m);
      expect(source).not.toContain('import("sharp")');
      expect(source).toContain("loadDesignBookletSharp");
    }
    expect(runtimeSource).toContain('import("sharp")');
  });

  it("traces the Linux Sharp and libvips runtime into booklet functions", () => {
    const nextConfigSource = readFileSync(
      path.join(process.cwd(), "apps/portal/next.config.ts"),
      "utf8",
    );

    expect(nextConfigSource).toContain(
      "outputFileTracingRoot: path.resolve(__dirname, '../..')",
    );
    expect(nextConfigSource).toContain(
      "'../../node_modules/@img/sharp-linux-x64/**/*'",
    );
    expect(nextConfigSource).toContain(
      "'../../node_modules/@img/sharp-libvips-linux-x64/**/*'",
    );
    expect(nextConfigSource).toContain(
      "'/api/staff/v1/design-booklets/pdf'",
    );
    expect(nextConfigSource).toContain(
      "'/api/staff/v1/projects/*/design-booklet/assets/complete'",
    );
    expect(nextConfigSource).toContain(
      "'/api/staff/v1/projects/*/design-booklet/assets/copy'",
    );
    expect(nextConfigSource).toContain(
      "'/api/staff/v1/projects/*/design-booklet/pdf'",
    );
  });

  it("loads the native image processor through the runtime adapter", async () => {
    const sharp = await loadDesignBookletSharp();

    expect(typeof sharp).toBe("function");
    expect(sharp.versions.vips).toMatch(/^8\./);
  });
});
