/** Validate the final URL before attaching a credential. Never follow redirects. */
export function credentialEndpoint(value: string, origins: readonly string[]): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      !origins.includes(url.origin)) throw new Error('Credential destination is not approved');
  return url.href;
}

export function redactCredential<T>(data: T, credential: string): T {
  if (!credential) return data;
  const variants = [credential, encodeURIComponent(credential), credential.slice(0, 10)]
    .filter(Boolean).sort((a, b) => b.length - a.length);
  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') {
      for (const secret of variants) value = (value as string).split(secret).join('[redacted]');
      return value;
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [clean(key), clean(item)]),
    );
    return value;
  };
  return clean(data) as T;
}
