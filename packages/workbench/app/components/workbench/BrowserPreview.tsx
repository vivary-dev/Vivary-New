import { useState, type FormEvent } from "react";
import { IconExternalLink, IconWorld, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewUrl } from "@/lib/workbench-preview";

export function BrowserPreview() {
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  function openPreview(event: FormEvent) {
    event.preventDefault();
    try {
      if (!address.trim()) throw new Error("Enter a preview address.");
      setUrl(previewUrl(address.trim(), window.location.origin));
      setRevision((value) => value + 1);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the preview address.");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Web preview">
      <form onSubmit={openPreview} className="flex shrink-0 items-center gap-2 border-b border-border p-3">
        <label htmlFor="preview-address" className="sr-only">Preview address</label>
        <Input id="preview-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="https://example.com or /app-path" className="min-w-0 flex-1" />
        <Button type="submit" size="sm">Open</Button>
        {url && <Button type="button" variant="ghost" size="icon" aria-label="Refresh preview" onClick={() => setRevision((value) => value + 1)}><IconRefresh className="size-4" /></Button>}
        {url && <Button variant="ghost" size="icon" asChild><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open preview in a new tab"><IconExternalLink className="size-4" /></a></Button>}
      </form>
      {error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{error}</p>}
      {url ? (
        <iframe key={`${url}-${revision}`} title="Running web preview" src={url} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" className="min-h-0 w-full flex-1 border-0 bg-white" />
      ) : (
        <div className="m-auto max-w-sm px-8 py-12 text-center">
          <IconWorld className="mx-auto mb-4 size-7 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Preview a running page</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Open an existing page beside your conversation. This panel does not start an app or change project files.</p>
        </div>
      )}
      <p className="shrink-0 border-t border-border px-4 py-2 text-xs leading-5 text-muted-foreground">Some sites and sign-in flows block embedded previews. Use the new-tab button if the page does not work here.</p>
    </section>
  );
}
