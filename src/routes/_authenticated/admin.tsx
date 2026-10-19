import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeading } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ageFrom, meQuery, signedUrls } from "@/lib/afterclass";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Moderation · AFTERCLASS" }, { name: "description", content: "Review IDs and reports." }] }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const isAdmin = !!me?.isAdmin;

  const { data: pending } = useQuery({
    queryKey: ["admin-verifications"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: v } = await supabase.from("verifications").select("*").eq("status", "pending").order("submitted_at");
      const ids = (v ?? []).map((x) => x.user_id);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, email, display_name, birthdate, course").in("id", ids) : { data: [] };
      const urls = await signedUrls("id-cards", (v ?? []).map((x) => x.id_card_path));
      return (v ?? []).map((x) => ({ ...x, profile: profiles?.find((p) => p.id === x.user_id), url: urls[x.id_card_path] }));
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("reports").select("*").eq("status", "open").order("created_at")).data ?? [],
  });

  async function review(userId: string, status: "approved" | "rejected") {
    const note = status === "rejected" ? prompt("Reason shown to the student (optional)") ?? "" : null;
    const { error } = await supabase.from("verifications").update({ status, note }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-verifications"] });
  }

  async function resolve(id: string) {
    await supabase.from("reports").update({ status: "resolved" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  if (!isAdmin) return <main className="mx-auto max-w-7xl px-5 py-14 md:px-8"><p className="text-sm text-muted-foreground">Moderators only.</p></main>;

  return (
    <main className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading eyebrow="Moderation" title="Keep the community safe." description="Approve only clear Adamas student IDs that match the profile name, for students aged 18 or over." />
      <h2 className="mt-12 font-display text-xl font-semibold text-foreground">ID checks ({pending?.length ?? 0})</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {pending?.map((v) => (
          <div key={v.user_id} className="border border-border bg-card p-4">
            {v.url && <a href={v.url} target="_blank" rel="noreferrer"><img src={v.url} alt="Student ID" className="max-h-64 w-full object-contain bg-secondary" /></a>}
            <p className="mt-3 text-sm font-semibold text-foreground">{v.profile?.display_name} · age {ageFrom(v.profile?.birthdate ?? null) ?? "?"}</p>
            <p className="text-xs text-muted-foreground">{v.profile?.email} · {v.profile?.course}</p>
            <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => review(v.user_id, "approved")}>Approve</Button><Button size="sm" variant="outline" onClick={() => review(v.user_id, "rejected")}>Reject</Button></div>
          </div>
        ))}
      </div>
      <h2 className="mt-12 font-display text-xl font-semibold text-foreground">Open reports ({reports?.length ?? 0})</h2>
      <div className="mt-4 space-y-3">
        {reports?.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-4 border border-border p-4">
            <div><p className="text-sm text-foreground">{r.reason}</p><p className="mt-1 text-xs text-muted-foreground">Reported user {r.reported} · by {r.reporter} · {new Date(r.created_at).toLocaleString()}</p></div>
            <Button size="sm" variant="outline" onClick={() => resolve(r.id)}>Resolve</Button>
          </div>
        ))}
      </div>
    </main>
  );
}
