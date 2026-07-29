import { useState, useEffect } from "react";
import { Edit2, LogOut, Trash2 } from "lucide-react";
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

export function RenameBlockDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (newName: string) => void;
}) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      onRename(name.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="board max-w-sm gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader className="border-b-2 border-ink px-6 py-4">
          <DialogTitle className="marker flex items-center gap-2 text-2xl">
            <Edit2 className="h-5 w-5 text-[var(--marker-blue)]" strokeWidth={2.5} />
            Rename Block
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider">Block Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Block A1 — Freshmen"
              className="h-11 rounded-md border-2 border-ink font-semibold"
              autoFocus
              required
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || name.trim() === currentName}>
              Save Name
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveBlockDialog({
  open,
  onOpenChange,
  blockName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockName: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="board max-w-sm gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader className="border-b-2 border-ink px-6 py-4">
          <DialogTitle className="marker flex items-center gap-2 text-2xl text-amber-600">
            <LogOut className="h-5 w-5" />
            Leave Block
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm font-medium leading-relaxed">
            Are you sure you want to leave <strong className="font-bold">{blockName}</strong>? You
            will lose access to its deadlines and announcements.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-amber-500 hover:bg-amber-500 text-white"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              Leave Block
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteBlockDialog({
  open,
  onOpenChange,
  blockName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockName: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="board max-w-sm gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader className="border-b-2 border-ink px-6 py-4">
          <DialogTitle className="marker flex items-center gap-2 text-2xl text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Block
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm font-medium leading-relaxed">
            Are you sure you want to delete <strong className="font-bold">{blockName}</strong>? This
            action is permanent and will remove the block for all students.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
