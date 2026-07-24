import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Check,
  Calendar as CalendarIcon,
  MoreVertical,
  Edit2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type BlockOption = {
  id: string;
  name: string;
  role: string;
};

export function UserPill() {
  const { user, profile, signOut } = useAuth();

  const initials = (profile?.full_name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const displayEmail = profile?.email || user?.email || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden items-center gap-2 rounded-full border-2 border-ink bg-card py-1 pl-1 pr-3 shadow-[2px_2px_0_0_var(--color-ink)] transition-transform hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--color-ink)] sm:inline-flex">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={initials}
              className="h-7 w-7 rounded-full border-2 border-ink object-cover"
            />
          ) : (
            <div
              className="grid h-7 w-7 place-items-center rounded-full border-2 border-ink text-xs font-bold text-white"
              style={{ background: "var(--marker-blue)" }}
            >
              {initials}
            </div>
          )}
          <span className="max-w-[160px] truncate text-xs font-semibold">{displayEmail}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 max-w-[90vw] rounded-md border-2 border-ink bg-card p-0 shadow-[4px_4px_0_0_var(--color-ink)]"
        align="end"
        sideOffset={6}
      >
        <div className="flex flex-col min-w-0 px-5 py-4">
          <p className="truncate text-sm font-bold">{profile?.full_name || "User"}</p>
          <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
        </div>
        <div className="h-0.5 bg-ink" />
        <div className="p-1">
          <DropdownMenuItem
            onSelect={() => signOut()}
            className="cursor-pointer gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BlockSelector({
  blockName,
  blocks = [],
  currentBlockId,
  onSelectBlock,
  onOpenJoinOrCreate,
  onRenameBlock,
  onLeaveBlock,
  onDeleteBlock,
}: {
  blockName: string;
  blocks: BlockOption[];
  currentBlockId?: string;
  onSelectBlock?: (id: string) => void;
  onOpenJoinOrCreate?: () => void;
  onRenameBlock?: (blockId: string, currentName: string) => void;
  onLeaveBlock?: (blockId: string, blockName: string) => void;
  onDeleteBlock?: (blockId: string, blockName: string) => void;
}) {
  if (blocks.length === 0) {
    return (
      <div className="board-sm inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
        <BookOpen className="h-4 w-4" />
        {blockName}
      </div>
    );
  }

  const activeBlock = blocks.find((b) => b.id === currentBlockId);
  const isBeadle = activeBlock?.role === "beadle";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="board-sm inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-transform hover:translate-y-[-1px]">
          <BookOpen className="h-4 w-4" />
          <span>{blockName || "Select Block"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 max-w-[90vw] rounded-md border-2 border-ink bg-card p-1 shadow-[4px_4px_0_0_var(--color-ink)]"
        align="center"
        sideOffset={6}
      >
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Your Blocks
        </div>
        {blocks.map((b) => {
          const isSelected = b.id === currentBlockId;
          return (
            <DropdownMenuItem
              key={b.id}
              onSelect={() => onSelectBlock?.(b.id)}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-semibold focus:bg-secondary"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{b.name}</span>
                <span className="rounded border border-ink bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase">
                  {b.role}
                </span>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 text-[var(--marker-blue)]" strokeWidth={2.5} />
              )}
            </DropdownMenuItem>
          );
        })}

        {activeBlock && (
          <>
            <div className="my-1 h-0.5 bg-ink" />
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Block Settings ({activeBlock.name})
            </div>
            {isBeadle && onRenameBlock && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(() => {
                    onRenameBlock(activeBlock.id, activeBlock.name);
                  }, 60);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus:bg-secondary"
              >
                <Edit2 className="h-4 w-4 text-[var(--marker-blue)]" />
                Rename Block
              </DropdownMenuItem>
            )}
            {onLeaveBlock && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(() => {
                    onLeaveBlock(activeBlock.id, activeBlock.name);
                  }, 60);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-amber-600 focus:bg-amber-500/10"
              >
                <LogOut className="h-4 w-4" />
                Leave Block
              </DropdownMenuItem>
            )}
            {isBeadle && onDeleteBlock && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(() => {
                    onDeleteBlock(activeBlock.id, activeBlock.name);
                  }, 60);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete Block
              </DropdownMenuItem>
            )}
          </>
        )}

        <div className="my-1 h-0.5 bg-ink" />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setTimeout(() => {
              onOpenJoinOrCreate?.();
            }, 60);
          }}
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[var(--marker-blue)] focus:bg-[var(--marker-blue)]/10"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Join or Create Block
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BlockActionsMenu({
  currentBlock,
  onRenameBlock,
  onLeaveBlock,
  onDeleteBlock,
}: {
  currentBlock?: BlockOption;
  onRenameBlock?: (blockId: string, currentName: string) => void;
  onLeaveBlock?: (blockId: string, blockName: string) => void;
  onDeleteBlock?: (blockId: string, blockName: string) => void;
}) {
  if (!currentBlock) return null;

  const isBeadle = currentBlock.role === "beadle";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-card shadow-[2px_2px_0_0_var(--color-ink)] transition-transform hover:translate-y-[-1px]"
          aria-label="Block Actions"
          title="Block Settings"
        >
          <MoreVertical className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-48 rounded-md border-2 border-ink bg-card p-1 shadow-[4px_4px_0_0_var(--color-ink)]"
        align="center"
        sideOffset={6}
      >
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {currentBlock.name}
        </div>
        <div className="my-1 h-0.5 bg-ink" />

        {isBeadle && onRenameBlock && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => {
                onRenameBlock(currentBlock.id, currentBlock.name);
              }, 60);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus:bg-secondary"
          >
            <Edit2 className="h-4 w-4 text-[var(--marker-blue)]" />
            Rename Block
          </DropdownMenuItem>
        )}

        {onLeaveBlock && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => {
                onLeaveBlock(currentBlock.id, currentBlock.name);
              }, 60);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-amber-600 focus:bg-amber-500/10 focus:text-amber-600"
          >
            <LogOut className="h-4 w-4" />
            Leave Block
          </DropdownMenuItem>
        )}

        {isBeadle && onDeleteBlock && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => {
                onDeleteBlock(currentBlock.id, currentBlock.name);
              }, 60);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete Block
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({
  blockName,
  blocks = [],
  currentBlockId,
  onSelectBlock,
  onOpenJoinOrCreate,
  onRenameBlock,
  onLeaveBlock,
  onDeleteBlock,
  onAdd,
  isCalendarPage,
}: {
  blockName: string;
  blocks?: BlockOption[];
  currentBlockId?: string;
  onSelectBlock?: (id: string) => void;
  onOpenJoinOrCreate?: () => void;
  onRenameBlock?: (blockId: string, currentName: string) => void;
  onLeaveBlock?: (blockId: string, blockName: string) => void;
  onDeleteBlock?: (blockId: string, blockName: string) => void;
  onAdd?: () => void;
  isCalendarPage?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeBlock = blocks.find((b) => b.id === currentBlockId);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-background/95 backdrop-blur">
      <div className="mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white">
            <img
              src="/blueboard-removebg-preview.png"
              alt="Blueboard"
              className="h-5 w-5 object-contain"
            />
          </div>
          <span className="marker-underline pb-0.5 text-2xl font-bold tracking-tight">
            Blueboard
          </span>
        </a>

        <div className="hidden flex-1 justify-center items-center gap-2 md:flex">
          <BlockSelector
            blockName={blockName}
            blocks={blocks}
            currentBlockId={currentBlockId}
            onSelectBlock={onSelectBlock}
            onOpenJoinOrCreate={onOpenJoinOrCreate}
            onRenameBlock={onRenameBlock}
            onLeaveBlock={onLeaveBlock}
            onDeleteBlock={onDeleteBlock}
          />
          {activeBlock && (
            <BlockActionsMenu
              currentBlock={activeBlock}
              onRenameBlock={onRenameBlock}
              onLeaveBlock={onLeaveBlock}
              onDeleteBlock={onDeleteBlock}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {isCalendarPage && (
            <a
              href="/"
              className="h-10 items-center gap-2 rounded-lg border-2 border-ink bg-secondary px-3 sm:px-4 font-bold text-foreground shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_var(--color-ink)] inline-flex"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> <span className="hidden sm:inline">Back</span>
            </a>
          )}

          <a
            href="/calendar"
            className="hidden h-10 items-center gap-2 rounded-lg border-2 border-ink bg-card px-4 font-semibold text-foreground shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_var(--color-ink)] sm:inline-flex"
          >
            <CalendarIcon className="h-4 w-4" strokeWidth={2.5} /> Calendar
          </a>
          <a
            href="/calendar"
            className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-card text-foreground shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_var(--color-ink)] sm:hidden"
            aria-label="Calendar"
          >
            <CalendarIcon className="h-4 w-4" strokeWidth={2.5} />
          </a>

          {onAdd && (
            <>
              <Button
                onClick={onAdd}
                className="hidden h-10 gap-2 rounded-lg border-2 border-ink bg-[var(--marker-blue)] px-4 font-semibold text-white shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-y-[-1px] hover:bg-[var(--marker-blue)] hover:shadow-[4px_4px_0_0_var(--color-ink)] sm:inline-flex"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Deadline
              </Button>
              <Button
                onClick={onAdd}
                size="icon"
                className="h-10 w-10 rounded-lg border-2 border-ink bg-[var(--marker-blue)] text-white shadow-[3px_3px_0_0_var(--color-ink)] hover:bg-[var(--marker-blue)] sm:hidden"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </Button>
            </>
          )}
          <UserPill />
          <button
            className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-card md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t-2 border-ink bg-background px-4 py-3 md:hidden flex items-center justify-between gap-2">
          <BlockSelector
            blockName={blockName}
            blocks={blocks}
            currentBlockId={currentBlockId}
            onSelectBlock={onSelectBlock}
            onOpenJoinOrCreate={onOpenJoinOrCreate}
            onRenameBlock={onRenameBlock}
            onLeaveBlock={onLeaveBlock}
            onDeleteBlock={onDeleteBlock}
          />
          {activeBlock && (
            <BlockActionsMenu
              currentBlock={activeBlock}
              onRenameBlock={onRenameBlock}
              onLeaveBlock={onLeaveBlock}
              onDeleteBlock={onDeleteBlock}
            />
          )}
        </div>
      )}
    </header>
  );
}
