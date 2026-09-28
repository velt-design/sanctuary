type PreviewEnvironment = {
  HOMEPAGE_CHALLENGER_PREVIEW?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

// Deployment-wide preview only: never a visitor assignment or client-side swap.
// A production deployment remains A even if the opt-in flag is inherited.
export function isHomepageChallengerPreview(env: PreviewEnvironment): boolean {
  return env.HOMEPAGE_CHALLENGER_PREVIEW === '1'
    && (env.VERCEL_ENV === 'preview'
      || (!env.VERCEL_ENV && env.NODE_ENV === 'development'));
}
