import "server-only";
import { createHash } from "node:crypto";
import { jsonError, jsonOk } from "@/lib/api/staffApi";
import { createFileArtifact, insertAuditEvent } from "@/lib/quotes/serverCore";
import {
  studioPackageContext,
  packageRpc,
} from "./clientPackageContext.server";
import { readStudioRequestBody } from "./readRequestBody.server";
import { studioPackageFilename } from "./clientPackage";
import { PDFDocument } from "pdf-lib";
import { assertStudioRenderImage } from "@sp/studio-documents/render-image";
import { readProjectEnquiryAttachmentBytes } from "@/lib/projects/enquiryAttachments/server";
import { classifyStudioPackageFiles } from "./clientPackageFiles.server";
export async function studioPackageAssets(
  request: Request,
  quoteVersionId: string,
) {
  const context = await studioPackageContext(request, quoteVersionId);
  if (!context.ok) return context.response;
  try {
    if (request.method === "GET") {
      const offset = new URL(request.url).searchParams.get("offset");
      if (offset !== null) {
        if (!/^\d+$/.test(offset)) return jsonError("Invalid file page", 400);
        const page = await packageRpc(context, "studio_client_package_files", {
            p_offset: Number(offset),
          }),
          draft = await packageRpc(context, "studio_client_package_read");
        return jsonOk({
          page: {
            ...page,
            files: await classifyStudioPackageFiles(
              context,
              page.files,
              draft?.value.fileIds ?? [],
            ),
          },
        });
      }
      const id = new URL(request.url).searchParams.get("id");
      if (!id || !/^[a-f0-9-]{36}$/i.test(id))
        return jsonError("Image not found", 404);
      const result = await context.service
        .from("file_artifacts")
        .select("content_base64,content_type,size_bytes")
        .eq("id", id)
        .eq("project_id", context.projectId)
        .maybeSingle();
      if (
        result.error ||
        !result.data ||
        !["image/png", "image/jpeg", "image/webp"].includes(
          result.data.content_type,
        ) ||
        result.data.size_bytes > 2 * 1024 * 1024
      )
        return jsonError("Image unavailable", 404);
      return new Response(Buffer.from(result.data.content_base64, "base64"), {
        headers: {
          "Content-Type": result.data.content_type,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const body = (await readStudioRequestBody(
      request,
      3 * 1024 * 1024,
    )) as Record<string, unknown>;
    if (
      body &&
      Object.keys(body).join(",") === "projectFileId" &&
      typeof body.projectFileId === "string"
    ) {
      const source = await readProjectEnquiryAttachmentBytes(
          context.auth.supabase,
          context.service,
          `proj_${context.projectId}`,
          body.projectFileId,
        ),
        sha256 = createHash("sha256").update(source.content).digest("hex");
      source.filename = studioPackageFilename(source.filename);
      const existing = await context.service
        .from("file_artifacts")
        .select("id,content_base64")
        .eq("project_id", context.projectId)
        .eq("filename", source.filename)
        .eq("size_bytes", source.content.length)
        .limit(10);
      if (existing.error) throw Error("Project files could not be checked");
      let fileUuid = existing.data?.find(
        (row: any) =>
          createHash("sha256")
            .update(Buffer.from(row.content_base64, "base64"))
            .digest("hex") === sha256,
      )?.id;
      if (!fileUuid)
        fileUuid = (
          await createFileArtifact({
            projectUuid: context.projectId,
            ...source,
            actor: context.actorId,
          })
        ).fileUuid;
      await insertAuditEvent({
        projectId: context.projectId,
        type: "studio.package_file_imported",
        idempotencyKey: `studio:package-file:${context.id.uuid}:${body.projectFileId}:${sha256}`,
        payload: {
          quoteVersionId: context.id.uuid,
          attachmentId: body.projectFileId,
          fileId: fileUuid,
          sha256,
          actorId: context.actorId,
        },
      });
      return jsonOk({
        file: {
          id: fileUuid,
          filename: source.filename,
          contentType: source.contentType,
          sizeBytes: source.content.length,
          sha256,
          renderEligible:
            ["image/png", "image/jpeg"].includes(source.contentType) &&
            source.content.length <= 2 * 1024 * 1024,
        },
      });
    }
    if (
      !body ||
      Object.keys(body).sort().join(",") !==
        "contentBase64,contentType,filename" ||
      typeof body.filename !== "string" ||
      !body.filename.trim() ||
      body.filename.length > 120 ||
      typeof body.contentBase64 !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(body.contentBase64) ||
      !["image/png", "image/jpeg"].includes(String(body.contentType))
    )
      return jsonError("Choose a PNG or JPG image up to 2MB.", 400);
    const bytes = Buffer.from(body.contentBase64, "base64");
    if (
      !bytes.length ||
      bytes.length > 2 * 1024 * 1024 ||
      bytes.toString("base64") !== body.contentBase64
    )
      return jsonError("Choose an image up to 2MB.", 400);
    assertStudioRenderImage(bytes, body.contentType as string);
    // Decode the actual format and bound its pixels before storing immutable bytes.
    const pdf = await PDFDocument.create(),
      image =
        body.contentType === "image/png"
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);
    if (
      image.width > 8192 ||
      image.height > 8192 ||
      image.width * image.height > 16_777_216
    )
      return jsonError("Choose an image smaller than 16 megapixels.", 400);
    const filename = studioPackageFilename(body.filename);
    const file = await createFileArtifact({
      projectUuid: context.projectId,
      filename,
      contentType: body.contentType as string,
      content: bytes,
      actor: context.actorId,
    });
    return jsonOk({
      file: {
        id: file.fileUuid,
        filename: file.filename,
        contentType: body.contentType,
        sizeBytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        renderEligible: true,
      },
    });
  } catch {
    return jsonError(
      "The image could not be added. Check its format and try again.",
      400,
    );
  }
}
