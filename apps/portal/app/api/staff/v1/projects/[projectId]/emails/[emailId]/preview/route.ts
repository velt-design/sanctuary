import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { renderTemplate } from '@/lib/emails/renderTemplate';
import { isPortalTransactionalTemplateId, portalTransactionalTemplateBaseName } from '@/lib/emails/transactionalTemplates';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { renderWebsiteAutoresponder, isWebsiteAutoresponderTemplateId } from '@/lib/sharedEmails';

export const runtime = 'nodejs';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function renderDbTemplate(templateHtml: string, vars: Record<string, unknown>): string {
  return templateHtml.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    if (typeof v === 'string' || typeof v === 'number') return escapeHtml(String(v));
    return '';
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string; emailId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const { emailId } = await ctx.params;
  const emailUuid = String(emailId ?? '').trim();
  if (!isUuid(emailUuid)) return jsonError('Invalid emailId', 400);

  const outboxRes = await supabase
    .from('email_outbox')
    .select('id, project_id, template_id, variables')
    .eq('id', emailUuid)
    .eq('project_id', projectUuid)
    .single();

  if (outboxRes.error || !outboxRes.data) return jsonError('Email not found', 404);

  const templateId = String((outboxRes.data as any).template_id ?? '').trim();
  const vars = isRecord((outboxRes.data as any).variables) ? ((outboxRes.data as any).variables as Record<string, unknown>) : {};

  // Repo-rendered website autoresponder
  if (isWebsiteAutoresponderTemplateId(templateId)) {
    try {
      const rendered = await renderWebsiteAutoresponder(templateId, vars);
      return jsonOk({ html: rendered.html });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to render preview';
      return jsonOk({ html: `<p>${escapeHtml(msg)}</p>` });
    }
  }

  if (isPortalTransactionalTemplateId(templateId)) {
    try {
      const templateBaseName = portalTransactionalTemplateBaseName(templateId);
      const rendered = await renderTemplate(templateBaseName, vars);
      return jsonOk({ html: rendered.html });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to render preview';
      return jsonOk({ html: `<p>${escapeHtml(msg)}</p>` });
    }
  }

  // Fallback: render DB template with simple {{var}} replacement
  const tplRes = await supabase.from('email_templates').select('id, body_html').eq('id', templateId).single();
  if (tplRes.error || !tplRes.data) {
    return jsonOk({ html: `<p>Preview not available for template: ${escapeHtml(templateId || 'unknown')}</p>` });
  }

  const bodyHtml = String((tplRes.data as any).body_html ?? '');
  return jsonOk({ html: renderDbTemplate(bodyHtml, vars) });
}
