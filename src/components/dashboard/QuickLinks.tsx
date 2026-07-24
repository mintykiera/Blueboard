import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Link as LinkIcon, ExternalLink, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

type BlockLink = {
  id: string;
  title: string;
  url: string;
  created_at: string;
};

const LINK_COLORS = [
  "var(--marker-blue)",
  "var(--marker-red)",
  "var(--marker-green)",
  "var(--marker-yellow)",
];

export function QuickLinks({ blockId, role }: { blockId: string; role: string }) {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const { data: links = [] } = useQuery({
    queryKey: ["block-links", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_links")
        .select("*")
        .eq("block_id", blockId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as BlockLink[];
    },
    enabled: !!blockId,
  });

  const addMutation = useMutation({
    mutationFn: async (link: { title: string; url: string }) => {
      let finalUrl = link.url;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      const { error } = await supabase.from("block_links").insert({
        block_id: blockId,
        title: link.title,
        url: finalUrl,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block-links", blockId] });
      setNewTitle("");
      setNewUrl("");
      setIsAddOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("block_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block-links", blockId] });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim() && newUrl.trim()) {
      addMutation.mutate({ title: newTitle.trim(), url: newUrl.trim() });
    }
  };

  return (
    <section className="board p-5 sm:p-6" id="links">
      <div className="flex items-center justify-between">
        <h2 className="marker text-xl">Quick Links</h2>
        {role === "beadle" && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-secondary"
                aria-label="Add Link"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="board max-w-sm gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
              <DialogHeader className="border-b-2 border-ink px-6 py-4">
                <DialogTitle className="marker text-2xl">Add a Link</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 px-6 py-5">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider">Title</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Class Drive"
                    className="h-11 rounded-md border-2 border-ink font-medium"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider">URL</Label>
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="e.g. drive.google.com/..."
                    className="h-11 rounded-md border-2 border-ink font-medium"
                    required
                  />
                </div>
                <DialogFooter className="gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsAddOpen(false)}
                    className="rounded-md border-2 border-ink font-semibold hover:bg-secondary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addMutation.isPending || !newTitle.trim() || !newUrl.trim()}
                    className="rounded-md border-2 border-ink bg-[var(--marker-blue)] font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)] hover:bg-[var(--marker-blue)] hover:shadow-[4px_4px_0_0_var(--color-ink)]"
                  >
                    Add Link
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Jump straight into your block's resources.
      </p>

      <div className="mt-4 grid gap-3">
        {links.length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">No links added yet.</p>
        )}
        {links.map((l, i) => (
          <div key={l.id} className="group flex items-center gap-2">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center gap-3 rounded-md border-2 border-ink bg-card p-3 text-left shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_var(--color-ink)]"
            >
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border-2 border-ink"
                style={{ background: LINK_COLORS[i % LINK_COLORS.length] }}
              >
                <LinkIcon className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="flex-1 truncate font-semibold">{l.title}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </a>

            {role === "beadle" && (
              <button
                onClick={() => deleteMutation.mutate(l.id)}
                disabled={deleteMutation.isPending}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md border-2 border-ink bg-card text-muted-foreground shadow-[3px_3px_0_0_var(--color-ink)] transition-all hover:bg-rose-500 hover:text-white hover:shadow-[4px_4px_0_0_var(--color-ink)] active:translate-y-[1px]"
                aria-label="Delete link"
                title="Delete Link"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
