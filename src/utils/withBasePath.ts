export function withBasePath(path: string): string {
  if (!path.startsWith('/')) return path;

  const rawBase = import.meta.env.BASE_URL ?? '/';
  const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

  if (!base || base === '/') return path;
  if (path === base || path.startsWith(`${base}/`)) return path;

  return `${base}${path}`;
}
