// Only the outer listener can register a context. No HTTP field conveys this authority.
const contexts = new WeakMap();
export function admitBrowserContext(context, identity) { contexts.set(context, identity); }
export function browserRequestIdentity(context) { return context && contexts.get(context); }
export function isDesktopRequest(context) { return browserRequestIdentity(context)?.kind === 'desktop'; }
