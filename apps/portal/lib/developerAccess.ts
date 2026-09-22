/** Navigation hint only; server callers must use isDeveloper with verified identity. */
export function isDeveloperEmail(email?: string | null): boolean {
  return email?.toLowerCase() === 'jordan@sanctuarypergolas.co.nz';
}

export function isDeveloper(user: { email?: string; email_confirmed_at?: string } | null): boolean {
  return Boolean(user?.email_confirmed_at && isDeveloperEmail(user.email));
}
