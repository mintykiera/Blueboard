import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log In — Blueboard" },
      {
        name: "description",
        content:
          "Sign in to Blueboard with your university Google account. Track deadlines for your block without the Canvas chaos.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const combined = `${hash}&${search}`;

    if (
      combined.includes("error") ||
      combined.includes("denied") ||
      combined.includes("unapproved")
    ) {
      const params = new URLSearchParams(hash.replace(/^#/, "") || search.replace(/^\?/, ""));
      const errorDesc = params.get("error_description") || params.get("error") || "";

      if (errorDesc || combined.includes("error")) {
        setShowAccessDeniedModal(true);
        // Clear the URL hash & query string so it doesn't persist on page refresh
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleLogin = async () => {
    setIsLoading(true);
    await signInWithGoogle();
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ perspective: "1000px" }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="board relative w-full max-w-md transition-transform duration-150 ease-out will-change-transform"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-sm border-2 border-ink px-6 py-1 shadow-[2px_2px_0_0_var(--color-ink)]"
          style={{ background: "var(--marker-yellow)" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink">Sign In</span>
        </div>

        <div className="px-8 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
          <div className="flex items-center justify-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white shadow-[3px_3px_0_0_var(--color-ink)]">
              <img
                src="/blueboard-removebg-preview.png"
                alt="Blueboard"
                className="h-6 w-6 object-contain"
              />
            </div>
            <h1 className="marker text-4xl tracking-tight">Blueboard</h1>
          </div>

          <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
            Track deadlines for your block
            <br />
            <span className="marker-underline font-semibold text-foreground">
              without the Canvas chaos.
            </span>
          </p>

          <div className="mt-6 space-y-2.5">
            {[
              "Your beadle syncs deadlines from Canvas — automatically",
              "One board for every class, every task, every due date",
              "Check off what's done and see what's left at a glance",
            ].map((text) => (
              <div key={text} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "var(--marker-green)" }}
                  strokeWidth={2.5}
                />
                <span className="text-xs font-medium text-muted-foreground sm:text-sm">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-0.5 flex-1 bg-ink/10" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Get Started
            </span>
            <div className="h-0.5 flex-1 bg-ink/10" />
          </div>

          <button
            id="login-google-button"
            onClick={handleLogin}
            disabled={isLoading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-ink bg-card px-6 py-3.5 text-sm font-bold shadow-[4px_4px_0_0_var(--color-ink)] cursor-pointer transition-[transform,box-shadow] duration-250 ease-out hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:pointer-events-none disabled:opacity-60"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {isLoading ? "Redirecting…" : "Log in with Google"}
            {!isLoading && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            Use your university Google account
            <br />
            <span className="font-semibold text-foreground">(e.g. @student.ateneo.edu)</span>
          </p>
        </div>

        <div className="flex items-center justify-between border-t-2 border-ink px-8 py-3 sm:px-10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Built for blocks, by blocks
          </p>
          <div className="flex gap-1.5">
            {[
              "var(--marker-blue)",
              "var(--marker-red)",
              "var(--marker-green)",
              "var(--marker-yellow)",
            ].map((c) => (
              <div
                key={c}
                className="h-2.5 w-2.5 rounded-full border border-ink"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <Dialog open={showAccessDeniedModal} onOpenChange={setShowAccessDeniedModal}>
        <DialogContent className="board max-w-md gap-0 border-2 border-ink p-0 shadow-[6px_6px_0_0_var(--color-ink)] bg-background">
          <DialogHeader className="border-b-2 border-ink bg-rose-50 dark:bg-rose-950/40 px-6 py-4">
            <DialogTitle className="marker flex items-center gap-2 text-2xl text-[var(--marker-red)]">
              <AlertTriangle
                className="h-6 w-6 shrink-0 text-[var(--marker-red)]"
                strokeWidth={2.5}
              />
              Access Denied
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <p className="text-sm font-semibold leading-relaxed text-foreground">
              Personal{" "}
              <code className="rounded border border-ink bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.5 font-bold text-rose-700 dark:text-rose-300">
                @gmail.com
              </code>{" "}
              or non-university accounts are strictly not allowed on Blueboard.
            </p>

            <p className="text-xs text-muted-foreground font-medium">
              Please sign in using an official email account from one of our supported universities:
            </p>

            <div className="space-y-2 rounded-lg border-2 border-ink bg-card p-3 shadow-[2px_2px_0_0_var(--color-ink)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-ink/20 pb-1 mb-2">
                Approved University Email Formats
              </div>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">Ateneo:</span>
                  <code className="rounded border border-ink bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                    *@student.ateneo.edu
                  </code>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">DLSU:</span>
                  <code className="rounded border border-ink bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                    *@dlsu.edu.ph
                  </code>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">FEU Tech:</span>
                  <code className="rounded border border-ink bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                    *@fit.edu.ph
                  </code>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">FEU Manila:</span>
                  <code className="rounded border border-ink bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                    *@feu.edu.ph
                  </code>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">UST:</span>
                  <code className="rounded border border-ink bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                    *@ust.edu.ph
                  </code>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">UA&P:</span>
                  <code className="rounded border border-ink bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                    *@uap.asia
                  </code>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground">CIIT:</span>
                  <code className="rounded border border-ink bg-secondary px-1.5 py-0.5 font-mono text-[11px]">
                    *@ciit.edu.ph
                  </code>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border-2 border-ink bg-[var(--marker-yellow)] p-3 text-xs font-semibold text-ink shadow-[2px_2px_0_0_var(--color-ink)] flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                Want your university added to the Blueboard?{" "}
                <a
                  href="mailto:kieraesque@gmail.com"
                  className="font-bold underline decoration-2 hover:text-blue-900 cursor-pointer"
                >
                  Email me, kieraesque@gmail.com!
                </a>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t-2 border-ink px-6 py-4 bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAccessDeniedModal(false)}
              className="w-full py-3 text-sm font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
