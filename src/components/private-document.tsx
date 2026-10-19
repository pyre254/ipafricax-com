import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";
import { toast } from "sonner";

export function PrivateDocument({ bucket, path, label }: { bucket: string; path: string | null; label: string }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  if (!path) return null;
  const open = async () => {
    setBusy(true);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    setBusy(false);
    if (error) return toast.error("Could not open this document.");
    setUrl(data.signedUrl);
  };
  return <div className="space-y-2">
    <Button variant="outline" size="sm" disabled={busy} onClick={open}><FileSearch />{busy ? "Opening…" : label}</Button>
    {url && <a href={url} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">Open {label.toLowerCase()}</a>}
  </div>;
}