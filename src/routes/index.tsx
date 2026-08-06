import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  LogOut,
  Menu,
  Pin,
  Plus,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

import { BeadleBoard } from "@/components/dashboard/BeadleBoard";
import { QuickLinks } from "@/components/dashboard/QuickLinks";
import { InviteManager } from "@/components/dashboard/InviteManager";
import { Header, UserPill } from "@/components/layout/Header";
import { syncCanvasIcs } from "@/lib/canvas-sync";
import {
  RenameBlockDialog,
  LeaveBlockDialog,
  DeleteBlockDialog,
} from "@/components/dashboard/RenameBlockDialog";
import { DeleteTaskDialog } from "@/components/dashboard/DeleteTaskDialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2, Eye, CheckSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blueboard" },
      {
        name: "description",
        content:
          "Blueboard is a whiteboard-inspired task and deadline tracker built for college course blocks. Track assignments, verify with your beadle, and never miss a due date.",
      },
      { property: "og:title", content: "Blueboard — Track Deadlines for Your Block" },
      {
        property: "og:description",
        content:
          "A dry-erase whiteboard for your block's assignments, deadlines, and beadle-verified announcements.",
      },
    ],
  }),
  component: Blueboard,
});

export type Task = {
  id: string;
  block_id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  due_at: string | null;
  is_personal: boolean;
  source: "canvas_ics" | "manual";
  canvas_uid: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  done: boolean;
  isBeadleTask?: boolean;
  isPersonalTask?: boolean;
  isUserCreator?: boolean;
};

type Filter = "all" | "today" | "week" | "overdue" | "done";

const MARKER_PALETTE = [
  "var(--marker-blue)",
  "var(--marker-red)",
  "var(--marker-green)",
  "#8B5CF6",
];

function getCourseColor(code: string | null): string {
  if (!code) return "var(--marker-blue)";
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  return MARKER_PALETTE[Math.abs(hash) % MARKER_PALETTE.length];
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDue(d: Date) {
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = Math.round(diffMs / 36e5);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffH < 0) return `Overdue · ${Math.abs(diffH)}h ago`;
  if (isSameDay(d, now)) return `Today · ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(d, tomorrow)) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

function Blueboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [joinOrCreateOpen, setJoinOrCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameData, setRenameData] = useState<{ id: string; name: string } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveData, setLeaveData] = useState<{ id: string; name: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteData, setDeleteData] = useState<{ id: string; name: string } | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", blockId] });
    },
  });

  const renameBlockMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await (supabase.from("blocks") as any).update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
    },
  });

  const leaveBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.id) return;
      const { error } = await supabase
        .from("block_members")
        .delete()
        .eq("block_id", id)
        .eq("profile_id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedBlockId(null);
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedBlockId(null);
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
    },
  });

  const { data: userBlocks = [], isLoading: isLoadingBlocks } = useQuery({
    queryKey: ["user-blocks", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      let universityId = profile.university_id;
      if (!universityId) {
        const { data: uni } = await (supabase.from("universities") as any)
          .select("id")
          .limit(1)
          .maybeSingle();
        if (uni?.id) {
          universityId = uni.id;
          await (supabase.from("profiles") as any)
            .update({ university_id: uni.id })
            .eq("id", profile.id);
        }
      }

      if (universityId) {
        const { data: existingPersonal } = await (supabase.from("blocks") as any)
          .select("id")
          .eq("created_by", profile.id)
          .eq("name", "My Personal Board")
          .maybeSingle();

        if (!existingPersonal) {
          const code = "PERS-" + Math.random().toString(36).substring(2, 6).toUpperCase();
          const { data: newPersonal } = await (supabase.from("blocks") as any)
            .insert({
              name: "My Personal Board",
              university_id: universityId,
              invite_code: code,
              created_by: profile.id,
            })
            .select()
            .maybeSingle();

          if (newPersonal) {
            await (supabase.from("block_members") as any).insert({
              block_id: newPersonal.id,
              profile_id: profile.id,
              role: "beadle",
            });
          }
        }
      }

      const { data: members, error: membersErr } = await supabase
        .from("block_members")
        .select("block_id, role, blocks(*)")
        .eq("profile_id", profile.id);

      if (membersErr) throw membersErr;
      if (!members) return [];

      const list = members
        .filter((m: any) => m.blocks)
        .map((m: any) => ({
          id: m.blocks.id,
          name: m.blocks.name,
          role: m.role,
          invite_code: m.blocks.invite_code,
          canvas_ics_url: m.blocks.canvas_ics_url,
          created_by: m.blocks.created_by,
        }));

      list.sort((a: any, b: any) =>
        a.name.includes("Personal Board") ? -1 : b.name.includes("Personal Board") ? 1 : 0,
      );

      return list;
    },
    enabled: !!profile?.id,
  });

  const currentBlock = useMemo(() => {
    if (!userBlocks || userBlocks.length === 0) return null;
    return userBlocks.find((b) => b.id === selectedBlockId) || userBlocks[0];
  }, [userBlocks, selectedBlockId]);

  const blockId: string | undefined = currentBlock?.id;
  const blockName: string = currentBlock?.name ?? "";

  const { data: rawTasks = [] } = useQuery({
    queryKey: ["tasks", blockId],
    queryFn: async () => {
      if (!blockId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("block_id", blockId)
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!blockId,
  });

  const { data: blockMembers = [] } = useQuery({
    queryKey: ["block-members", blockId],
    queryFn: async () => {
      if (!blockId) return [];
      const { data, error } = await supabase
        .from("block_members")
        .select("profile_id, role")
        .eq("block_id", blockId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!blockId,
  });

  const beadleProfileIds = useMemo(
    () =>
      new Set(blockMembers.filter((m: any) => m.role === "beadle").map((m: any) => m.profile_id)),
    [blockMembers],
  );

  const { data: completionSet = new Set<string>() } = useQuery({
    queryKey: ["completions", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return new Set<string>();
      const { data, error } = await supabase
        .from("user_task_completions")
        .select("task_id")
        .eq("profile_id", profile.id);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.task_id as string));
    },
    enabled: !!profile?.id,
  });

  const tasks: Task[] = useMemo(
    () =>
      rawTasks
        .map((t: any) => {
          const isBeadleCreator = t.created_by && beadleProfileIds.has(t.created_by);
          const isBeadleTask =
            (t.source === "manual" || t.source === "canvas_ics") &&
            isBeadleCreator &&
            !t.is_personal;
          const isPersonalTask = !isBeadleTask;
          const isUserCreator = t.created_by === profile?.id;

          return {
            ...t,
            done: completionSet.has(t.id),
            isBeadleTask,
            isPersonalTask,
            isUserCreator,
          };
        })
        .filter((t) => {
          if (t.isBeadleTask) return true;
          return t.isUserCreator;
        }),
    [rawTasks, completionSet, beadleProfileIds, profile?.id],
  );

  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, done }: { taskId: string; done: boolean }) => {
      if (!profile?.id) throw new Error("Not authenticated");
      if (done) {
        const { error } = await supabase
          .from("user_task_completions")
          .delete()
          .eq("task_id", taskId)
          .eq("profile_id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_task_completions").insert({
          task_id: taskId,
          profile_id: profile.id,
        } as any);
        if (error) throw error;
      }
    },
    onMutate: async ({ taskId, done }) => {
      await queryClient.cancelQueries({ queryKey: ["completions", profile?.id] });
      const prev = queryClient.getQueryData<Set<string>>(["completions", profile?.id]);
      queryClient.setQueryData<Set<string>>(["completions", profile?.id], (old) => {
        const next = new Set(old);
        if (done) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["completions", profile?.id], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["completions", profile?.id] });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      course_code: string;
      due_at: string;
      is_personal: boolean;
    }) => {
      if (!blockId || !profile?.id) throw new Error("Not ready");
      const { error } = await supabase.from("tasks").insert({
        block_id: blockId,
        title: input.title,
        description: input.description || null,
        course_code: input.course_code || null,
        due_at: input.due_at,
        is_personal: input.is_personal,
        source: "manual",
        created_by: profile.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", blockId] });
    },
  });

  const now = new Date();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  const parseDue = (t: Task) => (t.due_at ? new Date(t.due_at) : null);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        const due = parseDue(t);
        if (filter === "all") return !t.done;
        if (filter === "today")
          return !t.done && due !== null && isSameDay(due, now) && due.getTime() >= now.getTime();
        if (filter === "week") return !t.done && due !== null && due <= weekEnd && due >= now;
        if (filter === "overdue") return !t.done && due !== null && due.getTime() < now.getTime();
        if (filter === "done") return t.done;
        return true;
      })
      .sort((a, b) => {
        const da = parseDue(a);
        const db = parseDue(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.getTime() - db.getTime();
      });
  }, [tasks, filter, now, weekEnd]);

  const totalTasks = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  const weekTasks = tasks.filter((t) => {
    const due = parseDue(t);
    return due !== null && due <= weekEnd && due >= now && !t.done;
  });

  const urgentCount = tasks.filter((t) => {
    if (t.done) return false;
    const due = parseDue(t);
    if (!due) return false;
    const hours = (due.getTime() - Date.now()) / 36e5;
    return hours > 0 && hours < 24;
  }).length;

  const toggle = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) toggleMutation.mutate({ taskId: id, done: task.done });
  };

  const courseCodes = useMemo(
    () => [...new Set(tasks.map((t) => t.course_code).filter(Boolean))] as string[],
    [tasks],
  );

  if (isLoadingBlocks || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-ink border-t-[var(--marker-blue)]"></div>
          <p className="mt-4 text-sm font-semibold text-muted-foreground">Loading your board…</p>
        </div>
      </div>
    );
  }

  if (!currentBlock) {
    return (
      <OnboardingGate
        onSuccess={(id) => {
          if (id) setSelectedBlockId(id);
        }}
      />
    );
  }

  const handleRenameBlock = (id: string, currentName: string) => {
    setRenameData({ id, name: currentName });
    setRenameOpen(true);
  };

  const handleLeaveBlock = (id: string, name: string) => {
    setLeaveData({ id, name });
    setLeaveOpen(true);
  };

  const handleDeleteBlock = (id: string, name: string) => {
    setDeleteData({ id, name });
    setDeleteOpen(true);
  };

  return (
    <div className="min-h-screen text-foreground">
      <Header
        blockName={blockName}
        blocks={userBlocks}
        currentBlockId={currentBlock?.id}
        onSelectBlock={(id) => setSelectedBlockId(id)}
        onOpenJoinOrCreate={() => setJoinOrCreateOpen(true)}
        onRenameBlock={handleRenameBlock}
        onLeaveBlock={handleLeaveBlock}
        onDeleteBlock={handleDeleteBlock}
        onAdd={() => setAddOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Hero
          blockName={blockName}
          weekCount={weekTasks.length}
          doneCount={doneCount}
          progress={progress}
          urgent={urgentCount}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section>
            <FilterBar
              filter={filter}
              setFilter={setFilter}
              counts={{
                all: tasks.filter((t) => !t.done).length,
                today: tasks.filter((t) => {
                  const due = parseDue(t);
                  return (
                    !t.done && due !== null && isSameDay(due, now) && due.getTime() >= now.getTime()
                  );
                }).length,
                week: weekTasks.length,
                overdue: tasks.filter((t) => {
                  const due = parseDue(t);
                  return !t.done && due !== null && due.getTime() < now.getTime();
                }).length,
                done: doneCount,
              }}
            />
            <div className="mt-4 space-y-4">
              {filtered.length === 0 && (
                <div className="board p-8 text-center">
                  <p className="marker text-2xl">All clear</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nothing here. Enjoy the empty board.
                  </p>
                </div>
              )}
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onToggle={() => toggle(t.id)}
                  onOpenDetails={() => setDetailTask(t)}
                  onDeleteTask={() => setTaskToDelete(t)}
                  canDelete={currentBlock?.role === "beadle" || t.created_by === profile?.id}
                />
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            {!currentBlock?.name?.includes("Personal Board") &&
              currentBlock?.role === "beadle" &&
              currentBlock?.invite_code && <InviteManager inviteCode={currentBlock.invite_code} />}
            {blockId && <CanvasSyncButton blockId={blockId} />}
            {!currentBlock?.name?.includes("Personal Board") && blockId && (
              <BeadleBoard blockId={blockId} role={currentBlock?.role ?? "student"} />
            )}
            {blockId && <QuickLinks blockId={blockId} role={currentBlock?.role ?? "student"} />}
          </aside>
        </div>
      </main>

      <AddDeadlineDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        courseCodes={courseCodes}
        isBeadle={currentBlock?.role === "beadle"}
        onAdd={(input) => {
          addTaskMutation.mutate(input);
          setAddOpen(false);
        }}
      />

      <TaskDetailsDialog
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(v) => {
          if (!v) setDetailTask(null);
        }}
      />

      <DeleteTaskDialog
        open={!!taskToDelete}
        onOpenChange={(v) => {
          if (!v) setTaskToDelete(null);
        }}
        taskTitle={taskToDelete?.title || ""}
        onConfirm={() => {
          if (taskToDelete) {
            deleteTaskMutation.mutate(taskToDelete.id);
          }
        }}
      />

      <Dialog open={joinOrCreateOpen} onOpenChange={setJoinOrCreateOpen}>
        <DialogContent className="board max-w-4xl border-2 p-6 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-8 max-h-[90vh] overflow-y-auto">
          <div className="pb-4">
            <OnboardingGate
              isModal={true}
              onSuccess={(id) => {
                if (id) setSelectedBlockId(id);
                setJoinOrCreateOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <RenameBlockDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={renameData?.name || ""}
        onRename={(newName) => {
          if (renameData?.id) {
            renameBlockMutation.mutate({ id: renameData.id, name: newName });
          }
        }}
      />

      <LeaveBlockDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        blockName={leaveData?.name || ""}
        onConfirm={() => {
          if (leaveData?.id) {
            leaveBlockMutation.mutate(leaveData.id);
          }
        }}
      />

      <DeleteBlockDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        blockName={deleteData?.name || ""}
        onConfirm={() => {
          if (deleteData?.id) {
            deleteBlockMutation.mutate(deleteData.id);
          }
        }}
      />
    </div>
  );
}

function Hero({
  blockName,
  weekCount,
  doneCount,
  progress,
  urgent,
}: {
  blockName: string;
  weekCount: number;
  doneCount: number;
  progress: number;
  urgent: number;
}) {
  return (
    <section className="board mt-6 overflow-hidden">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-[var(--marker-yellow)] px-3 py-1 text-xs font-bold">
            <Calendar className="h-3.5 w-3.5" strokeWidth={2.5} />
            THIS WEEK · {blockName}
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            You have <span className="marker-underline">{weekCount} deadlines</span>
            <br />
            on the board.
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
            {urgent > 0
              ? `${urgent} of them ${urgent === 1 ? "is" : "are"} due within 24 hours — grab a marker and start knocking them out.`
              : "Nothing screaming urgent yet. Stay ahead of the curve."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile label="Due this week" value={weekCount} color="var(--marker-blue)" />
          <StatTile label="Urgent (<24h)" value={urgent} color="var(--marker-red)" />
          <StatTile label="Completed" value={doneCount} color="var(--marker-green)" />
          <div className="board-sm p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Progress
            </p>
            <p className="marker mt-1 text-3xl">{progress}%</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-ink bg-secondary">
              <div
                className="h-full"
                style={{ width: `${progress}%`, background: "var(--marker-green)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="board-sm p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="marker mt-1 text-3xl" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function FilterBar({
  filter,
  setFilter,
  counts,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  counts: Record<Filter, number>;
}) {
  const items: { id: Filter; label: string }[] = [
    { id: "all", label: "All Tasks" },
    { id: "today", label: "Due Today" },
    { id: "week", label: "This Week" },
    { id: "overdue", label: "Overdue" },
    { id: "done", label: "Completed" },
  ];
  return (
    <div className="board-sm flex flex-wrap items-center gap-1 p-1">
      {items.map((i) => {
        const active = filter === i.id;
        const isOverdueTab = i.id === "overdue";
        return (
          <button
            key={i.id}
            onClick={() => setFilter(i.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold cursor-pointer transition-colors",
              active
                ? "border-2 border-ink text-white shadow-[2px_2px_0_0_var(--color-ink)]"
                : "text-foreground hover:bg-secondary",
            )}
            style={
              active ? { background: isOverdueTab ? "#E11D48" : "var(--marker-blue)" } : undefined
            }
          >
            {i.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                active
                  ? "bg-white/25 text-white"
                  : isOverdueTab && counts.overdue > 0
                    ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {counts[i.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function extractCanvasUrl(description: string | null): string | null {
  if (!description) return null;
  const match = description.match(/https?:\/\/[^\s)"'>]+\.instructure\.com\/[^\s)"'>]+/);
  if (match) return match[0];
  const genericMatch = description.match(/https?:\/\/[^\s)"'>]+\/courses\/\d+\/assignments\/\d+/);
  return genericMatch ? genericMatch[0] : null;
}

function TaskCard({
  task,
  onToggle,
  onOpenDetails,
  onDeleteTask,
  canDelete,
}: {
  task: Task;
  onToggle: () => void;
  onOpenDetails: () => void;
  onDeleteTask?: () => void;
  canDelete?: boolean;
}) {
  const due = task.due_at ? new Date(task.due_at) : null;
  const hoursLeft = due ? (due.getTime() - Date.now()) / 36e5 : Infinity;
  const isOverdue = !task.done && due !== null && due.getTime() < Date.now();
  const isUrgent = !task.done && !isOverdue && hoursLeft < 24 && hoursLeft > 0;
  const courseColor = getCourseColor(task.course_code);
  const canvasUrl = task.source === "canvas_ics" ? extractCanvasUrl(task.description) : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          onClick={onOpenDetails}
          className={cn(
            "board-sm relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 sm:p-5 shadow-[4px_4px_0_0_var(--color-ink)] cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]",
            task.done && "opacity-60 bg-muted/20",
            isOverdue &&
              !task.done &&
              "bg-rose-50/60 dark:bg-rose-950/20 border-2 border-rose-600 shadow-[4px_4px_0_0_#E11D48]",
          )}
          style={
            isUrgent && !isOverdue
              ? { borderColor: "var(--marker-red)", boxShadow: "4px 4px 0 0 var(--marker-red)" }
              : undefined
          }
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label="Toggle complete"
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-ink cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]",
              task.done ? "text-white" : "bg-card",
            )}
            style={task.done ? { background: "var(--marker-green)" } : undefined}
          >
            {task.done && <Check className="h-5 w-5" strokeWidth={3} />}
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-md border-2 border-ink px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)]"
                style={{ background: courseColor }}
              >
                {task.course_code || "MISC"}
              </span>

              {task.isBeadleTask ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)]"
                  title="Official task assigned by a Beadle"
                >
                  <CheckCircle2 className="h-3 w-3" strokeWidth={3} /> Beadle verified task
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-purple-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)]"
                  title="Private personal task created by you"
                >
                  <User className="h-3 w-3" strokeWidth={2.5} /> Personal Task
                </span>
              )}

              {isOverdue && (
                <span className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)] animate-pulse">
                  <AlertTriangle className="h-3 w-3" strokeWidth={2.5} /> OVERDUE
                </span>
              )}
              {isUrgent && (
                <span className="inline-flex items-center rounded-md border-2 border-ink bg-[var(--marker-red)] px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)]">
                  URGENT
                </span>
              )}
              {canvasUrl && (
                <a
                  href={canvasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-[#E74C3C] px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)] hover:bg-[#C0392B] transition-colors"
                  title="Open in Canvas"
                >
                  <ExternalLink className="h-3 w-3" strokeWidth={2.5} /> Canvas
                </a>
              )}
            </div>
            <h3
              className={cn(
                "mt-2 truncate text-base font-bold sm:text-lg",
                task.done && "line-through decoration-2 text-muted-foreground",
              )}
            >
              {task.title}
            </h3>
            <p
              className={cn(
                "mt-0.5 text-xs font-medium sm:text-sm",
                isOverdue ? "text-rose-600 font-bold dark:text-rose-400" : "text-muted-foreground",
              )}
            >
              {due ? formatDue(due) : "No due date"}
            </p>
            {task.description && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {task.description.length > 80
                  ? task.description.slice(0, 80) + "…"
                  : task.description}
              </p>
            )}
          </div>

          {due && (
            <div className="hidden shrink-0 sm:block">
              <div
                className="marker text-right text-2xl"
                style={{
                  color: isOverdue
                    ? "#E11D48"
                    : isUrgent
                      ? "var(--marker-red)"
                      : "var(--marker-blue)",
                }}
              >
                {due.toLocaleDateString([], { day: "2-digit" })}
              </div>
              <div className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {due.toLocaleDateString([], { month: "short" })}
              </div>
            </div>
          )}
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 rounded-md border-2 border-ink bg-card p-1 shadow-[4px_4px_0_0_var(--color-ink)]">
        <ContextMenuItem
          onSelect={onOpenDetails}
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus:bg-secondary"
        >
          <Eye className="h-4 w-4 text-[var(--marker-blue)]" />
          View Details
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onToggle}
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus:bg-secondary"
        >
          <CheckSquare className="h-4 w-4 text-[var(--marker-green)]" />
          {task.done ? "Mark Incomplete" : "Mark Complete"}
        </ContextMenuItem>
        {canDelete && onDeleteTask && (
          <ContextMenuItem
            onSelect={onDeleteTask}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete Task
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function TaskDetailsDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!task) return null;
  const due = task.due_at ? new Date(task.due_at) : null;
  const courseColor = getCourseColor(task.course_code);
  const canvasUrl = task.source === "canvas_ics" ? extractCanvasUrl(task.description) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="board max-w-lg gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
        {canvasUrl && (
          <a
            href={canvasUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-4 top-14 grid h-8 w-8 place-items-center rounded-lg border-2 border-ink bg-[#E74C3C] text-white shadow-[2px_2px_0_0_var(--color-ink)] transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer z-10"
            title="Open in Canvas"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2.5} />
          </a>
        )}
        <DialogHeader className="border-b-2 border-ink px-6 py-4 pr-14">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="inline-flex items-center rounded-md border-2 border-ink px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)]"
              style={{ background: courseColor }}
            >
              {task.course_code || "MISC"}
            </span>
            {task.isBeadleTask ? (
              <span className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)]">
                <CheckCircle2 className="h-3 w-3" strokeWidth={3} /> Beadle verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-purple-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-[1px_1px_0_0_var(--color-ink)]">
                <User className="h-3 w-3" strokeWidth={2.5} /> Personal
              </span>
            )}
          </div>
          <DialogTitle className="text-xl font-bold">{task.title}</DialogTitle>
          {due && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Due:{" "}
              {due.toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              at {due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </DialogHeader>
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
          {task.description ? (
            <div className="prose prose-sm max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:text-sm [&_li]:mb-0.5 [&_a]:text-[var(--marker-blue)] [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_pre]:rounded-md [&_pre]:border-2 [&_pre]:border-ink [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:mb-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--marker-blue)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_strong]:font-bold [&_em]:italic [&_hr]:border-ink [&_hr]:my-4">
              <Markdown remarkPlugins={[remarkGfm]}>{task.description}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description provided.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddDeadlineDialog({
  open,
  onOpenChange,
  courseCodes,
  isBeadle,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseCodes: string[];
  isBeadle?: boolean;
  onAdd: (input: {
    title: string;
    description: string;
    course_code: string;
    due_at: string;
    is_personal: boolean;
  }) => void;
}) {
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("23:59");
  const [isPersonal, setIsPersonal] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    const due_at = new Date(`${date}T${time}`).toISOString();
    onAdd({
      course_code: course,
      title,
      description,
      due_at,
      is_personal: isBeadle ? isPersonal : false,
    });
    setTitle("");
    setDescription("");
    setDate("");
    setCourse("");
    setTime("23:59");
    setIsPersonal(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="board max-w-lg gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader className="border-b-2 border-ink px-6 py-4">
          <DialogTitle className="marker text-2xl">Add a Deadline</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider">Course</Label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="h-11 rounded-md border-2 border-ink font-semibold">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent className="board-sm">
                {courseCodes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider">Assignment Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Problem Set 5"
              className="h-11 rounded-md border-2 border-ink font-medium"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider">Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, instructions, or links… (Markdown supported)"
              rows={4}
              className="w-full rounded-md border-2 border-ink bg-background px-3 py-2 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <p className="text-[10px] text-muted-foreground">
              Supports **bold**, *italic*, lists, links, and more.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Due Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 rounded-md border-2 border-ink font-medium"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 rounded-md border-2 border-ink font-medium"
              />
            </div>
          </div>
          {isBeadle && (
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Task Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPersonal(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border-2 border-ink px-3 py-2.5 text-sm font-semibold cursor-pointer transition-all",
                    !isPersonal
                      ? "bg-blue-600 text-white shadow-[3px_3px_0_0_var(--color-ink)]"
                      : "bg-card text-foreground hover:bg-secondary",
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                  <span className="text-left leading-tight">Beadle Verified</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPersonal(true)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border-2 border-ink px-3 py-2.5 text-sm font-semibold cursor-pointer transition-all",
                    isPersonal
                      ? "bg-purple-600 text-white shadow-[3px_3px_0_0_var(--color-ink)]"
                      : "bg-card text-foreground hover:bg-secondary",
                  )}
                >
                  <User className="h-4 w-4" strokeWidth={2.5} />
                  <span className="text-left leading-tight">Personal</span>
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isPersonal
                  ? "Only you will see this task."
                  : "All block members will see this task."}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-md border-2 border-ink font-semibold hover:bg-secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-md border-2 border-ink bg-[var(--marker-blue)] font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)] hover:bg-[var(--marker-blue)] hover:shadow-[4px_4px_0_0_var(--color-ink)]"
            >
              Add to Board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CanvasSyncButton({ blockId }: { blockId: string }) {
  const { profile } = useAuth();
  const [icsUrl, setIcsUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const handleSync = async () => {
    if (!icsUrl.trim()) {
      setStatus("error");
      setMessage("Paste a Canvas .ics URL first");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await syncCanvasIcs(blockId, icsUrl.trim(), profile?.id || "");
      setStatus("success");
      setMessage(res.message);
      queryClient.invalidateQueries({ queryKey: ["tasks", blockId] });
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  return (
    <section className="board p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <div
          className="grid h-8 w-8 place-items-center rounded-md border-2 border-ink"
          style={{ background: "var(--marker-green)" }}
        >
          <RefreshCw className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-sm font-bold">Sync from Canvas</h2>
          <p className="text-[10px] text-muted-foreground">Paste your .ics calendar link</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Input
          value={icsUrl}
          onChange={(e) => {
            setIcsUrl(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder="https://canvas.instructure.com/feeds/calendars/..."
          className="h-9 rounded-md border-2 border-ink text-xs font-medium"
        />
        <button
          onClick={handleSync}
          disabled={status === "loading"}
          className={cn(
            "board-sm flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-bold shadow-[4px_4px_0_0_var(--color-ink)] cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:pointer-events-none disabled:opacity-60",
            status === "success"
              ? "!bg-[var(--marker-green)] text-white"
              : "bg-card text-foreground",
          )}
        >
          {status === "loading" ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Syncing…
            </>
          ) : status === "success" ? (
            <>
              <Check className="h-4 w-4" strokeWidth={3} />
              Done!
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Sync Deadlines
            </>
          )}
        </button>

        {message && (
          <p
            className={cn(
              "text-xs font-medium",
              status === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function OnboardingGate({
  isModal = false,
  onSuccess,
}: {
  isModal?: boolean;
  onSuccess?: (id?: string) => void;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [joinCode, setJoinCode] = useState("");
  const [blockName, setBlockName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const createBlock = useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.id) throw new Error("User not authenticated.");

      let universityId = profile.university_id;
      if (!universityId) {
        const { data: uni } = await (supabase.from("universities") as any)
          .select("id")
          .limit(1)
          .maybeSingle();

        const uniData = uni as any;

        if (uniData?.id) {
          universityId = uniData.id;
          await (supabase.from("profiles") as any)
            .update({ university_id: uniData.id })
            .eq("id", profile.id);
        }
      }

      if (!universityId) {
        throw new Error("No university found. Please contact support.");
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: block, error: blockErr } = await supabase
        .from("blocks")
        .insert({
          name,
          university_id: universityId,
          invite_code: code,
          created_by: profile.id,
        } as any)
        .select()
        .single();

      if (blockErr) throw blockErr;

      const blockData = block as any;

      const { error: memberErr } = await supabase.from("block_members").insert({
        block_id: blockData.id,
        profile_id: profile.id,
        role: "beadle",
      } as any);

      if (memberErr) throw memberErr;
      return blockData;
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
      onSuccess?.(data?.id);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const joinBlock = useMutation({
    mutationFn: async (code: string) => {
      if (!profile?.id) throw new Error("Profile not ready.");

      const { data: block, error: blockErr } = await supabase
        .from("blocks")
        .select("id")
        .eq("invite_code", code)
        .maybeSingle();

      if (blockErr) throw blockErr;
      if (!block) throw new Error("Invalid invite code.");

      const blockData = block as any;

      const { error: memberErr } = await supabase.from("block_members").insert({
        block_id: blockData.id,
        profile_id: profile.id,
        role: "student",
      } as any);

      if (memberErr) {
        if (memberErr.code === "23505") {
          throw new Error("You are already in this block.");
        }
        throw memberErr;
      }
      return blockData;
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
      onSuccess?.(data?.id);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const handleJoin = () => {
    setErrorMsg("");
    if (!joinCode.trim()) return;
    joinBlock.mutate(joinCode.trim().toUpperCase());
  };

  const handleCreate = () => {
    setErrorMsg("");
    if (!blockName.trim()) return;
    createBlock.mutate(blockName.trim());
  };

  const [personalName, setPersonalName] = useState("My Personal Board");

  const handleCreatePersonal = () => {
    setErrorMsg("");
    const name = personalName.trim() || "My Personal Board";
    createBlock.mutate(name);
  };

  const content = (
    <div className="w-full">
      {!isModal && (
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white shadow-[3px_3px_0_0_var(--color-ink)]">
            <img
              src="/blueboard-removebg-preview.png"
              alt="Blueboard"
              className="h-6 w-6 object-contain"
            />
          </div>
          <h1 className="marker text-4xl tracking-tight">Blueboard</h1>
        </div>
      )}

      <div className={cn("w-full", !isModal && "board max-w-5xl p-6 sm:p-10 mx-auto")}>
        <div className="text-center">
          <h2 className="marker text-2xl sm:text-3xl">Join or Create a Board</h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Join your class block with an invite code, create a class block, or set up a personal
            board.
          </p>
          {errorMsg && <p className="mt-3 text-sm font-semibold text-destructive">{errorMsg}</p>}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3 md:gap-6">
          <div className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-purple-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Personal
            </div>
            <h3 className="text-xl font-bold">Personal Board</h3>
            <p className="text-xs text-muted-foreground">
              Create a private personal workspace for your own deadlines, notes, and links.
            </p>
            <div className="mt-auto space-y-3 pt-3">
              <Input
                value={personalName}
                onChange={(e) => setPersonalName(e.target.value)}
                placeholder="e.g. My Personal Space"
                className="h-11 border-2 border-ink font-semibold"
              />
              <button
                onClick={handleCreatePersonal}
                disabled={createBlock.isPending || joinBlock.isPending}
                className="board-sm flex h-11 w-full items-center justify-center gap-2 font-bold text-white !bg-purple-600 shadow-[4px_4px_0_0_var(--color-ink)] cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:pointer-events-none disabled:opacity-70"
              >
                {createBlock.isPending ? "Creating..." : "Create Personal Board"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-[var(--marker-yellow)] px-3 py-1 text-xs font-bold uppercase tracking-wider">
              Student
            </div>
            <h3 className="text-xl font-bold">Join a Block</h3>
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit invite code from your beadle to access your block's board.
            </p>
            <div className="mt-auto space-y-3 pt-3">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3"
                className="h-11 border-2 border-ink text-center text-base font-bold tracking-widest"
                maxLength={6}
              />
              <button
                onClick={handleJoin}
                disabled={joinBlock.isPending || createBlock.isPending}
                className="board-sm flex h-11 w-full items-center justify-center gap-2 font-bold text-white !bg-[var(--marker-blue)] shadow-[4px_4px_0_0_var(--color-ink)] cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:pointer-events-none disabled:opacity-70"
              >
                {joinBlock.isPending ? "Joining..." : "Join Block"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-[var(--marker-green)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Beadle
            </div>
            <h3 className="text-xl font-bold">Create a Class Block</h3>
            <p className="text-xs text-muted-foreground">
              Are you the beadle? Create a new block board and invite your classmates.
            </p>
            <div className="mt-auto space-y-3 pt-3">
              <Input
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="e.g. Block A1 — Freshmen"
                className="h-11 border-2 border-ink font-semibold"
              />
              <button
                onClick={handleCreate}
                disabled={createBlock.isPending || joinBlock.isPending}
                className="board-sm flex h-11 w-full items-center justify-center gap-2 font-bold text-white !bg-[var(--marker-green)] shadow-[4px_4px_0_0_var(--color-ink)] cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:pointer-events-none disabled:opacity-70"
              >
                {createBlock.isPending ? "Creating..." : "Create Class Block"}
              </button>
            </div>
          </div>
        </div>

        {!isModal && (
          <div className="mt-8 flex justify-center">
            <UserPill />
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) return content;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">{content}</div>
  );
}
