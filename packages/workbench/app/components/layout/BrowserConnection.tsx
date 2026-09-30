import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { browserStatus, type BrowserStatus } from '../../../shared/browser-access';

type Connection = { kind: 'checking' } | { kind: 'local' } | { kind: 'remote'; host: BrowserStatus; problem: null | 'unavailable' | 'revoked' | 'changed' };
const BrowserHost = createContext<BrowserStatus | null>(null);
export const useBrowserHost = () => useContext(BrowserHost);

export function BrowserConnection({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection>({ kind: 'checking' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    let host: BrowserStatus | null = connection.kind === 'remote' ? connection.host : null;
    let failed = false;
    async function check() {
      if (failed) return;
      try {
        const response = await fetch('/_vivary/browser/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!alive) return;
        if (!response.ok) {
          if (!host) { setConnection({ kind: 'local' }); return; }
          failed = true; setConnection({ kind: 'remote', host, problem: response.status === 401 ? 'revoked' : 'unavailable' }); return;
        }
        const status = browserStatus.parse(await response.json());
        if (!status.remote) { setConnection({ kind: 'local' }); return; }
        host = status;
        const key = 'vivary-browser-instance';
        const pinned = sessionStorage.getItem(key);
        if (pinned && pinned !== status.instanceId) { failed = true; setConnection({ kind: 'remote', host, problem: 'changed' }); return; }
        sessionStorage.setItem(key, status.instanceId);
        setConnection({ kind: 'remote', host, problem: null });
      } catch {
        if (alive && host) { failed = true; setConnection({ kind: 'remote', host, problem: 'unavailable' }); }
        else if (alive) setConnection({ kind: 'local' });
      }
    }
    void check();
    const timer = setInterval(() => { if (host) void check(); }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [retry]);
  if (connection.kind === 'checking') return <p role="status" className="p-4 text-sm">Connecting to Vivary…</p>;
  if (connection.kind === 'local') return children;
  return <BrowserHost.Provider value={connection.host}><div className="browser-connection">
    <div className="min-w-0 border-b bg-muted px-4 py-2 text-sm [overflow-wrap:anywhere]" role="status">
      {connection.problem === 'changed' ? 'The host at this address changed. Requests are paused. Return to your original host.'
        : connection.problem === 'revoked' ? 'Browser access ended. Unsent text stays here; copy it before pairing again.'
          : connection.problem === 'unavailable' ? `Cannot reach ${connection.host.label}. Keep this page open to preserve unsaved text. Retry does not send messages.`
            : `Connected to ${connection.host.label}. Files and tools run on this host.`}
      {connection.problem && connection.problem !== 'changed' && <button className="ml-3 min-h-11 underline" onClick={() => setRetry(value => value + 1)}>Retry connection</button>}
      {connection.problem === 'revoked' && <a className="ml-3 underline" href="/pair">Pair again</a>}
    </div>
    <div className="browser-connection-workspace">{connection.problem === 'changed' ? null : children}</div>
  </div></BrowserHost.Provider>;
}
