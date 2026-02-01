export type PostgrestErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

export class SupabaseRepoError extends Error {
  table: string;
  supabaseUrl: string;
  supabaseHost: string;
  postgrestUrl: string;
  postgrestHost: string;
  postgrestError: PostgrestErrorLike | null;

  constructor(message: string, opts: {
    table: string;
    supabaseUrl: string;
    supabaseHost: string;
    postgrestUrl: string;
    postgrestHost: string;
    postgrestError: PostgrestErrorLike | null;
  }) {
    super(message);
    this.name = 'SupabaseRepoError';
    this.table = opts.table;
    this.supabaseUrl = opts.supabaseUrl;
    this.supabaseHost = opts.supabaseHost;
    this.postgrestUrl = opts.postgrestUrl;
    this.postgrestHost = opts.postgrestHost;
    this.postgrestError = opts.postgrestError;
  }
}

