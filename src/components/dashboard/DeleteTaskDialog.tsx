import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function DeleteTaskDialog({
  open,
  onOpenChange,
  taskTitle,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="board max-w-sm gap-0 border-2 p-0 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader className="border-b-2 border-ink px-6 py-4">
          <DialogTitle className="marker flex items-center gap-2 text-2xl text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Task
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm font-medium leading-relaxed">
            Are you sure you want to delete <strong className="font-bold">"{taskTitle}"</strong>?
            This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 pt-2 sm:justify-end">
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
              Delete Task
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
