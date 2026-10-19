import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Gate, PageHeading } from "@/components/afterclass/shell";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, signedUrls } from "@/lib/afterclass";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({ meta: [{ title: "Matches · AFTERCLASS" }, { name: "description", content: "Your mutual matches." }] }),
  component: () => <Gate><Matches /></Gate>,
});

export const matchesQueryKey = ["matches"];

function Matches() {
  const { data: me } = useQuery(meQuery);
  const { data, isLoading } = useQuery({
    queryKey: matchesQueryKey,
    enabled: !!me,
    queryFn: async () => {
      const uid = me!.user.id;
      const { data: matches } = await supabase.from("matches").select("*").order("created_at", { ascending: false });
      const otherIds = (matches ?? []).map((m) => (m.user_a === uid ? m.user_b : m.user_a));
      if (!otherIds.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, photo_path, course").in("id", otherIds);
      const urls = await signedUrls("photos", (profiles ?? []).map((p) => p.photo_path));
      return (matches ?? []).flatMap((m) => {
        const p = profiles?.find((x) => x.id === (m.user_a === uid ? m.user_b : m.user_a));
        return p ? [{ matchId: m.id, ...p, photo: p.photo_path ? urls[p.photo_path] : undefined }] : [];
      });
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading eyebrow="Mutual, by design" title="Your matches." description="You both said yes. Open a chat to say hello." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">No matches yet — keep exploring <Link to="/discover" className="underline">Discover</Link>.</p>}
        {data?.map((m) => (
          <Link key={m.matchId} to="/messages/$matchId" params={{ matchId: m.matchId }} className="group border border-border bg-card">
            <div className="aspect-square overflow-hidden bg-secondary">{m.photo && <img src={m.photo} alt={m.display_name ?? ""} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />}</div>
            <div className="p-4"><p className="font-display text-lg font-semibold text-foreground">{m.display_name}</p><p className="text-xs text-muted-foreground">{m.course}</p></div>
          </Link>
        ))}
      </div>
    </main>
  );
}
