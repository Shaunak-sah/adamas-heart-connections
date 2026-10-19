import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

const primaryLinks = [
  { to: "/discover", label: "Discover" },
  { to: "/matches", label: "Matches" },
  { to: "/messages", label: "Messages" },
  { to: "/profile", label: "Profile" },
] as const;

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 text-foreground" aria-label="AFTERCLASS home">
      <span className="grid size-8 place-items-center border border-primary/60 text-xs font-semibold text-primary">A</span>
      <span className={compact ? "sr-only" : "font-display text-sm font-bold tracking-[0.12em]"}>AFTERCLASS</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="relative z-10 border-b border-border bg-background">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-5 px-5 md:px-8">
        <BrandMark />
        <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
          {primaryLinks.map((item) => (
            <Link key={item.to} to={item.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <Link to="/safety" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Safety</Link>
        </nav>
        <Button asChild size="sm" variant="outline" className="border-border bg-transparent">
          <Link to="/login">Sign in <ArrowUpRight aria-hidden="true" /></Link>
        </Button>
      </div>
      <nav aria-label="Mobile navigation" className="flex gap-6 overflow-x-auto border-t border-border px-5 py-3 md:hidden">
        {primaryLinks.map((item) => (
          <Link key={item.to} to={item.to} className="shrink-0 text-xs text-muted-foreground">{item.label}</Link>
        ))}
        <Link to="/safety" className="shrink-0 text-xs text-muted-foreground">Safety</Link>
      </nav>
    </header>
  );
}

export function PreviewNotice() {
  return (
    <div className="border-b border-primary/25 bg-primary/10 px-5 py-2.5 text-center text-xs text-foreground">
      <span className="inline-flex items-center justify-center gap-2"><LockKeyhole aria-hidden="true" className="size-3.5 text-primary" />
        Private preview · Verification isn’t available · No real profiles or interactions
      </span>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-4"><BrandMark compact /><p className="text-xs text-muted-foreground">An independent student-focused project.</p></div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/guidelines" className="hover:text-foreground">Community guidelines</Link>
          <Link to="/safety" className="hover:text-foreground">Safety</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
        <span className="text-xs text-muted-foreground">Not operated by or affiliated with Adamas University.</span>
      </div>
    </footer>
  );
}

export function SiteFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background"><SiteHeader /><PreviewNotice />{children}<SiteFooter /></div>;
}

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h1 className="font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

export function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-border py-7"><h2 className="font-display text-xl font-semibold text-foreground">{title}</h2><div className="mt-4 text-sm leading-7 text-muted-foreground">{children}</div></section>;
}

export function VerificationLock() {
  return <div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-4 text-sm leading-6 text-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><p>Real student access stays closed until an approved verification method and adult eligibility checks are in place.</p></div>;
}