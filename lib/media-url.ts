/**
 * The URL a browser uses to fetch an uploaded file.
 *
 * This lives apart from lib/storage.ts on purpose. That module is `server-only` because
 * it touches the filesystem, and anything importing it — even transitively, even for one
 * pure function — drags that restriction along. Avatar and MediaBlock both need this
 * string and both get rendered inside client components, so building the URL has to be
 * reachable from the client bundle.
 *
 * Always the authenticated route, never a static path: /api/media runs the same
 * `canView` check as the page embedding the file, which is what keeps a "just me" video
 * private even if its URL leaks.
 */
export function mediaUrl(key: string): string {
  return `/api/media/${key}`;
}
