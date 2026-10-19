import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Gate } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, signedUrls } from "@/lib/afterclass";

export const Route = createFileRoute("/_authenticated/messages/$matchId")({
  head: () => ({ meta: [{ title: "Chat · AFTERCLASS" }, { name: "description", content: "A private conversation with your match." }] }),
  component: () => <Gate><Chat /></Gate>,
});

function Chat() {
  const { matchId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const uid = me?.user.id;

  const { data: info, isLoading } = useQuery({
    queryKey: ["match", matchId],
    enabled: !!uid,
    queryFn: async () => {
      const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
      if (!m) return null;
      const otherId = m.user_a === uid ? m.user_b : m.user_a;
      const { data: p } = await supabase.from("profiles").select("id, display_name, photo_path").eq("id", otherId).maybeSingle();
      const urls = await signedUrls("photos", [p?.photo_path]);
      return { otherId, name: p?.display_name ?? "Your match", photo: p?.photo_path ? urls[p.photo_path] : undefined };
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", matchId],
    enabled: !!info,
    queryFn: async () => (await supabase.from("messages").select("*").eq("match_id", matchId).order("created_at")).data ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel(`messages-${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => qc.invalidateQueries({ queryKey: ["messages", matchId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !uid) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ match_id: matchId, sender_id: uid, body });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["messages", matchId] });
  }

  async function block() {
    if (!info || !uid || !confirm(`Block ${info.name}? This ends the match for both of you.`)) return;
    const { error } = await supabase.from("blocks").insert({ blocker: uid, blocked: info.otherId });
    if (error) { toast.error(error.message); return; }
    toast.success("Blocked");
    qc.invalidateQueries({ queryKey: ["matches"] });
    navigate({ to: "/matches" });
  }

  async function report() {
    if (!info || !uid) return;
    const reason = prompt("What happened? Moderators will review this.");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase.from("reports").insert({ reporter: uid, reported: info.otherId, reason: reason.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Report sent to moderators");
  }

  async function unmatch() {
    if (!confirm("Unmatch? The conversation will be deleted.")) return;
    await supabase.from("matches").delete().eq("id", matchId);
    qc.invalidateQueries({ queryKey: ["matches"] });
    navigate({ to: "/matches" });
  }

  if (isLoading) return <p className="mx-auto max-w-3xl px-5 py-14 text-sm text-muted-foreground">Loading…</p>;
  if (!info) return <main className="mx-auto max-w-3xl px-5 py-14"><p className="text-sm text-muted-foreground">This conversation isn’t available.</p><Button asChild variant="outline" className="mt-4"><Link to="/matches">Back to matches</Link></Button></main>;

  return (
    <main className="mx-auto flex max-w-3xl flex-col px-5 py-8" style={{ minHeight: "70vh" }}>
      <div className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
        <div className="size-12 overflow-hidden bg-secondary">{info.photo && <img src={info.photo} alt="" className="size-full object-cover" />}</div>
        <h1 className="flex-1 font-display text-xl font-semibold text-foreground">{info.name}</h1>
        <Button size="sm" variant="ghost" onClick={unmatch}>Unmatch</Button>
        <Button size="sm" variant="ghost" onClick={report}>Report</Button>
        <Button size="sm" variant="outline" onClick={block}>Block</Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto py-6">
        {messages?.length === 0 && <p className="text-center text-sm text-muted-foreground">Say hello 👋</p>}
        {messages?.map((m) => (
          <div key={m.id} className={m.sender_id === uid ? "ml-auto max-w-[75%] bg-primary px-4 py-2 text-sm text-primary-foreground" : "max-w-[75%] border border-border bg-card px-4 py-2 text-sm text-foreground"}>{m.body}</div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border pt-4">
        <Input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" />
        <Button type="submit">Send</Button>
      </form>
    </main>
  );
}
