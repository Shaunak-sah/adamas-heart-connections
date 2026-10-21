import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";

import { ProfileCard } from "@/components/afterclass/profile-card";
import { Gate, PageHeading } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, signedUrls } from "@/lib/afterclass";
import { readPrompts } from "@/lib/profile-extras";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover · AFTERCLASS" }, { name: "description", content: "Meet verified Adamas students." }] }),
  component: () => <Gate><Discover /></Gate>,
});

function Discover() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data, isLoading } = useQuery({
    queryKey: ["discover"],
    enabled: !!me,
    queryFn: async () => {
      const uid = me!.user.id;
      const [{ data: swiped }, { data: profiles }] = await Promise.all([
        supabase.from("swipes").select("target").eq("swiper", uid),
        supabase.from("profiles").select("id, display_name, birthdate, gender, interested_in, course, year, bio, interests, photo_paths, prompts").neq("id", uid).limit(200),
      ]);
      const seen = new Set((swiped ?? []).map((s) => s.target));
      const mine = me!.profile!;
      const list = (profiles ?? []).filter((p) => !seen.has(p.id)
        && (!mine.interested_in || mine.interested_in === "everyone" || p.gender === mine.interested_in)
        && (!p.interested_in || p.interested_in === "everyone" || p.interested_in === mine.gender));
      const urls = await signedUrls("photos", list.flatMap((p) => p.photo_paths ?? []));
      return list.map((p) => ({ ...p, photos: (p.photo_paths ?? []).flatMap((path) => (urls[path] ? [urls[path]] : [])), prompts: readPrompts(p.prompts) }));
    },
  });

  async function swipe(target: string, liked: boolean) {
    const { error } = await supabase.from("swipes").insert({ swiper: me!.user.id, target, liked });
    if (error) { toast.error(error.message); return; }
    if (liked) {
      const { data: m } = await supabase.from("matches").select("id").or(`user_a.eq.${target},user_b.eq.${target}`).maybeSingle();
      if (m) toast.success("It’s a match! Say hello from your matches.");
    }
    qc.setQueryData(["discover"], (old: typeof data) => old?.filter((p) => p.id !== target));
    qc.invalidateQueries({ queryKey: ["matches"] });
  }

  const current = data?.[0];

  return (
    <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading eyebrow="Discover" title="Meet beyond the lecture hall." description="Every profile here is a verified, 18+ Adamas student. Likes stay private unless they’re mutual." />
      <div className="mt-10 max-w-md">
        {isLoading ? <p className="text-sm text-muted-foreground">Finding people…</p> : !current ? (
          <div className="border border-border p-8 text-center"><p className="font-display text-lg text-foreground">You’re all caught up.</p><p className="mt-2 text-sm text-muted-foreground">Check back later as more students join.</p><Button asChild variant="outline" className="mt-5"><Link to="/matches">See matches</Link></Button></div>
        ) : (
          <ProfileCard
            key={current.id}
            photos={current.photos}
            name={current.display_name}
            birthdate={current.birthdate}
            course={current.course}
            year={current.year}
            bio={current.bio}
            interests={current.interests}
            prompts={current.prompts}
            actions={<>
              <Button variant="outline" size="lg" onClick={() => swipe(current.id, false)}><X aria-hidden="true" /> Pass</Button>
              <Button size="lg" onClick={() => swipe(current.id, true)}><Heart aria-hidden="true" /> Like</Button>
            </>}
          />
        )}
      </div>
    </main>
  );
}
