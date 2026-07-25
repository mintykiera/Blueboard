import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Link as LinkIcon, ExternalLink, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const [editingLink, setEditingLink] = useState<BlockLink | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, url }: { id: string; title: string; url: string }) => {
      let finalUrl = url;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      const { error } = await (supabase.from("block_links") as any)
        .update({ title, url: finalUrl })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block-links", blockId] });
      setEditingLink(null);
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLink && editTitle.trim() && editUrl.trim()) {
      updateMutation.mutate({ id: editingLink.id, title: editTitle.trim(), url: editUrl.trim() });
    }
  };

  return (
    <section className="board p-5 sm:p-6" id="links">
      <div className="flex items-center justify-between">
        <h2 className="marker text-xl">Quick Links</h2>
        {role === "beadle" && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button
                className="board-sm grid h-8 w-8 place-items-center transition-transform hover:translate-y-[-1px]"
                aria-label="Add Link"
              >
                <Plus className="h-4 w-4" />
              </button>
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
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="board-sm px-4 py-2 text-sm font-semibold transition-transform hover:translate-y-[-1px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addMutation.isPending || !newTitle.trim() || !newUrl.trim()}
                    className="board-sm px-4 py-2 text-sm font-bold !bg-[var(--marker-blue)] text-white transition-transform hover:translate-y-[-1px] disabled:opacity-50"
                  >
                    Add Link
                  </button>
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
          <div
            key={l.id}
            className="board-sm group flex items-center justify-between gap-2 p-3 transition-transform hover:translate-y-[-1px]"
          >
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center gap-3 min-w-0"
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="board-sm grid h-7 w-7 shrink-0 place-items-center transition-transform hover:translate-y-[-1px]"
                    aria-label="Link actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-md border-2 border-ink bg-card p-1 shadow-[4px_4px_0_0_var(--color-ink)]"
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditingLink(l);
                      setEditTitle(l.title);
                      setEditUrl(l.url);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold focus:bg-secondary"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[var(--marker-blue)]" />
                    Rename Link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => deleteMutation.mutate(l.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-rose-600 focus:bg-rose-500/10 focus:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
        <DialogContent className="board max-w-sm gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
          <DialogHeader className="border-b-2 border-ink px-6 py-4">
            <DialogTitle className="marker text-2xl">Edit Link</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 px-6 py-5">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                className="h-11 rounded-md border-2 border-ink font-medium"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider">URL</Label>
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="URL"
                className="h-11 rounded-md border-2 border-ink font-medium"
                required
              />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLink(null)}
                className="board-sm px-4 py-2 text-sm font-semibold transition-transform hover:translate-y-[-1px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending || !editTitle.trim() || !editUrl.trim()}
                className="board-sm px-4 py-2 text-sm font-bold !bg-[var(--marker-blue)] text-white transition-transform hover:translate-y-[-1px] disabled:opacity-50"
              >
                Save Changes
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
