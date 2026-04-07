import 'server-only';

import { logPortalServerError, type PortalServerLogContext } from '@/lib/api/routeDiagnostics';

type SupabaseMutationResult<T = unknown> = {
  data?: T | null;
  error?: unknown;
};

export type PortalMutationFailure = {
  responseMessage: string;
};

type MutationCheckOptions = {
  diagnostics: PortalServerLogContext;
  table: string;
  operation: string;
  message: string;
  requireField?: string;
  extra?: Record<string, unknown>;
};

function hasRequiredField(data: unknown, field: string): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return field in data && (data as Record<string, unknown>)[field] != null;
}

export function getSupabaseMutationFailure<T>(
  result: SupabaseMutationResult<T>,
  options: MutationCheckOptions,
): PortalMutationFailure | null {
  if (result?.error) {
    logPortalServerError(options.diagnostics, {
      status: 500,
      message: options.message,
      error: result.error,
      extra: {
        table: options.table,
        operation: options.operation,
        ...(options.extra ?? {}),
      },
    });
    return { responseMessage: options.message };
  }

  if (options.requireField && !hasRequiredField(result?.data, options.requireField)) {
    logPortalServerError(options.diagnostics, {
      status: 500,
      message: options.message,
      extra: {
        table: options.table,
        operation: options.operation,
        missingField: options.requireField,
        ...(options.extra ?? {}),
      },
    });
    return { responseMessage: options.message };
  }

  return null;
}
