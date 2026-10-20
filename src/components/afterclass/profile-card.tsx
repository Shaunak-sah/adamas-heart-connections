import type { ReactNode } from "react";

import { ageFrom } from "@/lib/afterclass";

export function parseInterests(text: string) {
  return text.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
}

type ProfileCardProps = {
  photo?: string | null | undefined;
  name: string | null;
  birthdate: string | null;
  course: string | null;
  year: string | null;
  bio: string | null;
  interests: string[] | null;
  actions?: ReactNode;
};

/** The card other students see in Discover. Shared so the profile preview matches exactly. */
export function ProfileCard({ photo, name, birthdate, course, year, bio, interests, actions }: ProfileCardProps) {
  const age = ageFrom(birthdate);
  return (
    <article className="border border-border bg-card">
      <div className="grid aspect-[4/5] place-items-center overflow-hidden bg-secondary">
        {photo ? <img src={photo} alt={name ?? ""} className="size-full object-cover" /> : <span className="text-xs text-muted-foreground">No photo yet</span>}
      </div>
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {name || <span className="text-muted-foreground">Your name</span>}{age !== null && `, ${age}`}
          </h2>
          <span className="text-xs text-muted-foreground">{year}</span>
        </div>
        {course && <p className="mt-1 text-sm text-muted-foreground">{course}</p>}
        {bio && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-secondary-foreground">{bio}</p>}
        {(interests?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {interests!.map((i) => <span key={i} className="border border-border px-2 py-1 text-[11px] text-muted-foreground">{i}</span>)}
          </div>
        )}
        {actions && <div className="mt-6 grid grid-cols-2 gap-3">{actions}</div>}
      </div>
    </article>
  );
}
