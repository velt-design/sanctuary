export function strongFileVersion(value: string | null | undefined): string | null {
  return value && value.length <= 1024 && /^"[^"\x00-\x1f\x7f]*"$/.test(value) ? value : null;
}

export const VERIFIED_FILE_VERSION_HEADER = 'x-project-file-verified-version';
