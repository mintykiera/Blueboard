import { useState } from "react";
import { Pin, Bell, X, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";

const NOTE_COLORS = ["var(--marker-yellow)", "#FED7D7", "#BEE3F8", "#C6F6D5"];

type Announcement = {
  id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let counter = 0;

  const regex =
    /(\[.*?\]\(https?:\/\/[^\s\)]+\)|https?:\/\/[^\s\)]+|\*\*.*?\*\*|__.*?__|~~.*?~~|\*.*?\*|_.*?_|`.*?`)/g;
  const parts = text.split(regex);

  parts.forEach((part) => {
    if (!part) return;

    const mdLink = part.match(/^\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/);
    if (mdLink) {
      nodes.push(
        <a
          key={counter++}
          href={mdLink[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline text-[var(--marker-blue)] hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          {mdLink[1]}
        </a>,
      );
      return;
    }

    if (/^https?:\/\/[^\s\)]+$/.test(part)) {
      nodes.push(
        <a
          key={counter++}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline text-[var(--marker-blue)] hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>,
      );
      return;
    }

    const boldMatch = part.match(/^(\*\*|__)(.*?)\1$/);
    if (boldMatch) {
      nodes.push(
        <strong key={counter++} className="font-extrabold text-foreground">
          {boldMatch[2]}
        </strong>,
      );
      return;
    }

    const strikeMatch = part.match(/^~~(.*?)~~$/);
    if (strikeMatch) {
      nodes.push(
        <del key={counter++} className="line-through opacity-75">
          {strikeMatch[1]}
        </del>,
      );
      return;
    }

    const italicMatch = part.match(/^(\*|_)(.*?)\1$/);
    if (italicMatch) {
      nodes.push(
        <em key={counter++} className="italic">
          {italicMatch[2]}
        </em>,
      );
      return;
    }

    const codeMatch = part.match(/^`(.*?)`$/);
    if (codeMatch) {
      nodes.push(
        <code
          key={counter++}
          className="rounded border border-ink/40 bg-black/10 px-1 py-0.5 font-mono text-xs font-semibold"
        >
          {codeMatch[1]}
        </code>,
      );
      return;
    }

    nodes.push(<span key={counter++}>{part}</span>);
  });

  return nodes;
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={idx} className="marker text-xl font-bold mt-2 mb-1">
              {parseInlineMarkdown(trimmed.slice(2))}
            </h1>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={idx} className="marker text-lg font-bold mt-2 mb-1">
              {parseInlineMarkdown(trimmed.slice(3))}
            </h2>
          );
        }

        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="font-bold text-base mt-1">
              {parseInlineMarkdown(trimmed.slice(4))}
            </h3>
          );
        }

        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="text-[var(--marker-blue)] font-bold text-base leading-none">•</span>
              <div className="flex-1">{parseInlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="font-bold text-xs text-muted-foreground">{numMatch[1]}.</span>
              <div className="flex-1">{parseInlineMarkdown(numMatch[2])}</div>
            </div>
          );
        }

        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-ink bg-secondary/40 pl-3 py-1 my-1 italic rounded-r text-xs"
            >
              {parseInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        }

        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        return (
          <p key={idx} className="min-h-[1.2em]">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

export function BeadleBoard({ blockId, role }: { blockId: string; role: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState("");

  const { data: announcements = [] } = useQuery({
    queryKey: ["beadle-announcements", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beadle_announcements")
        .select(
          `
          id,
          content,
          created_at,
          profiles(full_name)
        `,
        )
        .eq("block_id", blockId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Announcement[];
    },
    enabled: !!blockId,
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!profile?.id) throw new Error("Not logged in");
      const { error } = await supabase.from("beadle_announcements").insert({
        block_id: blockId,
        author_id: profile.id,
        content,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beadle-announcements", blockId] });
      setNewContent("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("beadle_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beadle-announcements", blockId] });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newContent.trim()) {
      addMutation.mutate(newContent.trim());
    }
  };

  return (
    <section className="board relative p-5 sm:p-6" id="announcements">
      <div className="absolute -top-3 left-6 flex items-center gap-2 rounded-full border-2 border-ink bg-card px-3 py-1 shadow-[2px_2px_0_0_var(--color-ink)]">
        <Pin
          className="h-3.5 w-3.5 -rotate-45"
          style={{ color: "var(--marker-red)" }}
          strokeWidth={2.5}
        />
        <span className="marker text-sm">Beadle Board</span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Announcements</h2>
        <Bell className="h-4 w-4 text-muted-foreground" />
      </div>

      {role === "beadle" && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Post an announcement... (Supports markdown & new lines)"
            className="min-h-[80px] w-full rounded-md border-2 border-ink font-medium"
            disabled={addMutation.isPending}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Tip: Use **bold**, *italic*, or [link](url)
            </span>
            <button
              type="submit"
              disabled={addMutation.isPending || !newContent.trim()}
              className="board-sm flex h-9 items-center gap-2 px-4 font-bold text-white !bg-[var(--marker-blue)] shadow-[4px_4px_0_0_var(--color-ink)] cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:pointer-events-none disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2.5} /> Post
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {announcements.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No announcements from your beadle yet.
          </p>
        )}
        {announcements.map((n, i) => {
          const authorName =
            (n.profiles && !Array.isArray(n.profiles) && n.profiles.full_name) || "Beadle";
          return (
            <div
              key={n.id}
              className="group relative rounded-md border-2 border-ink p-3.5 shadow-[3px_3px_0_0_var(--color-ink)]"
              style={{
                background: NOTE_COLORS[i % NOTE_COLORS.length],
                transform: `rotate(${i % 2 === 0 ? -0.4 : 0.5}deg)`,
              }}
            >
              <div className="pr-6 text-sm font-medium text-ink" style={{ color: "var(--ink)" }}>
                <MarkdownContent content={n.content} />
              </div>
              <p
                className="mt-3 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--ink)" }}
              >
                — {authorName}
              </p>

              {role === "beadle" && (
                <button
                  onClick={() => deleteMutation.mutate(n.id)}
                  disabled={deleteMutation.isPending}
                  className="absolute right-2 top-2 rounded border-2 border-transparent p-0.5 text-ink/40 cursor-pointer transition-colors hover:border-ink hover:bg-white/50 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Delete announcement"
                >
                  <X className="h-3 w-3" strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
