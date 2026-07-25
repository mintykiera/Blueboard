import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  Plus,
  Clock,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  RenameBlockDialog,
  LeaveBlockDialog,
  DeleteBlockDialog,
} from "@/components/dashboard/RenameBlockDialog";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      {
        title: "Calendar",
      },
    ],
  }),
  component: CalendarPage,
});

type Task = {
  id: string;
  block_id: string;
  title: string;
  course_code: string | null;
  due_at: string | null;
  source: "canvas_ics" | "manual";
  canvas_uid: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  done: boolean;
};

const MARKER_PALETTE = [
  "var(--marker-blue)",
  "var(--marker-red)",
  "var(--marker-green)",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
];

function getCourseColor(code: string | null) {
  if (!code) return "var(--marker-blue)";
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
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

function CalendarPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());

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
          const isBeadleTask = t.source === "manual" && isBeadleCreator;
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["completions", profile?.id] });
    },
  });

  const today = new Date();

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startingDayOfWeek = firstDayOfMonth.getDay();
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    const totalSlots = days.length > 35 ? 42 : 35;
    const remainingSlots = totalSlots - days.length;
    for (let day = 1; day <= remainingSlots; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month, startingDayOfWeek, totalDaysInMonth]);

  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentMonthDate(new Date());
  };

  const monthLabel = currentMonthDate.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameData, setRenameData] = useState<{ id: string; name: string } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveData, setLeaveData] = useState<{ id: string; name: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteData, setDeleteData] = useState<{ id: string; name: string } | null>(null);

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

  if (isLoadingBlocks || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-ink border-t-[var(--marker-blue)]"></div>
          <p className="mt-4 text-sm font-semibold text-muted-foreground">Loading calendar…</p>
        </div>
      </div>
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
        onRenameBlock={handleRenameBlock}
        onLeaveBlock={handleLeaveBlock}
        onDeleteBlock={handleDeleteBlock}
        isCalendarPage={true}
      />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="board mb-6 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink text-white shadow-[2px_2px_0_0_var(--color-ink)]"
              style={{ background: "var(--marker-blue)" }}
            >
              <CalendarIcon className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="marker text-2xl sm:text-3xl tracking-tight">{monthLabel}</h1>
              <p className="text-xs text-muted-foreground">
                Block: <span className="font-semibold text-foreground">{blockName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrevMonth}
              variant="outline"
              size="icon"
              className="h-10 w-10 border-2 border-ink bg-card shadow-[2px_2px_0_0_var(--color-ink)] hover:bg-secondary"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            </Button>
            <Button
              onClick={handleToday}
              className="h-10 border-2 border-ink bg-secondary font-bold text-foreground shadow-[2px_2px_0_0_var(--color-ink)] hover:bg-card"
            >
              Today
            </Button>
            <Button
              onClick={handleNextMonth}
              variant="outline"
              size="icon"
              className="h-10 w-10 border-2 border-ink bg-card shadow-[2px_2px_0_0_var(--color-ink)] hover:bg-secondary"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
            <div
              key={dayName}
              className={cn(
                "rounded-md border-2 border-ink py-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--color-ink)]",
                idx === 0 || idx === 6
                  ? "bg-[var(--marker-yellow)] text-ink"
                  : "bg-card text-foreground",
              )}
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const isTodayDate = isSameDay(date, today);
            const dayTasks = tasks.filter((t) => {
              if (!t.due_at) return false;
              return isSameDay(new Date(t.due_at), date);
            });

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[100px] sm:min-h-[120px] rounded-lg border-2 border-ink p-1.5 sm:p-2 transition-all flex flex-col justify-start",
                  isCurrentMonth
                    ? "bg-card text-foreground shadow-[3px_3px_0_0_var(--color-ink)]"
                    : "bg-secondary/40 text-muted-foreground opacity-60 shadow-none",
                  isTodayDate && "ring-2 ring-[var(--marker-yellow)] bg-amber-500/10",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                      isTodayDate
                        ? "border-2 border-ink bg-[var(--marker-yellow)] text-ink"
                        : "text-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                    </span>
                  )}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-[85px] scrollbar-none">
                  {dayTasks.map((task) => {
                    const due = task.due_at ? new Date(task.due_at) : null;
                    const isOverdue = !task.done && due !== null && due.getTime() < Date.now();
                    const isUrgent =
                      !task.done &&
                      !isOverdue &&
                      due !== null &&
                      (due.getTime() - Date.now()) / 36e5 < 24 &&
                      due.getTime() > Date.now();

                    const courseColor = getCourseColor(task.course_code);

                    return (
                      <button
                        key={task.id}
                        onClick={() => toggleMutation.mutate({ taskId: task.id, done: task.done })}
                        className={cn(
                          "w-full text-left rounded border border-ink p-1 text-[11px] font-semibold transition-transform hover:scale-[1.02] flex items-center justify-between gap-1 shadow-[1px_1px_0_0_var(--color-ink)]",
                          task.done && "opacity-50 line-through bg-muted",
                          isOverdue &&
                            !task.done &&
                            "border-rose-600 bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold shadow-[1.5px_1.5px_0_0_#E11D48]",
                        )}
                        title={`${task.title} ${task.due_at ? `(${new Date(task.due_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})` : ""}`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          {task.course_code && (
                            <span
                              className="shrink-0 rounded px-1 text-[9px] font-bold text-white"
                              style={{ background: courseColor }}
                            >
                              {task.course_code}
                            </span>
                          )}
                          <span className="truncate">{task.title}</span>
                        </div>
                        {isOverdue && (
                          <span className="shrink-0 animate-pulse rounded bg-rose-600 px-1 text-[8px] font-extrabold text-white uppercase">
                            OVERDUE
                          </span>
                        )}
                        {isUrgent && (
                          <span className="shrink-0 animate-pulse rounded bg-[var(--marker-red)] px-1 text-[8px] font-bold text-white uppercase">
                            !
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="board mt-8 flex flex-wrap items-center justify-between gap-4 p-4 text-xs font-semibold">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--marker-red)] animate-pulse" />
              <span>Urgent (&lt;24h)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--marker-yellow)] border border-ink" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--marker-blue)]" />
              <span>Course Tag</span>
            </div>
          </div>
          <div className="text-muted-foreground">
            Click any task pill to toggle completion status.
          </div>
        </div>
      </main>

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
