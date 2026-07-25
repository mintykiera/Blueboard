import { useState } from "react";
import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InviteManager({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="board p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <div
          className="grid h-8 w-8 place-items-center rounded-md border-2 border-ink"
          style={{ background: "var(--marker-yellow)" }}
        >
          <Pin className="h-4 w-4 text-ink" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-sm font-bold">Invite Students</h2>
          <p className="text-[10px] text-muted-foreground">Share this code with your block</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="flex h-10 flex-1 items-center justify-center rounded-md border-2 border-ink bg-secondary text-lg font-bold tracking-widest text-foreground">
          {inviteCode}
        </div>
        <button
          onClick={handleCopy}
          className="board-sm flex h-10 w-24 items-center justify-center font-bold text-white !bg-[var(--marker-blue)] transition-transform hover:translate-y-[-1px]"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </section>
  );
}
