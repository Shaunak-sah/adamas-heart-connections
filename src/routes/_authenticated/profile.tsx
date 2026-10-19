import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, signedUrls } from "@/lib/afterclass";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile · AFTERCLASS" }, { name: "description", content: "Edit your AFTERCLASS profile and verification." }] }),
  component: ProfilePage,
});

const select = "flex h-9 w-full border border-input bg-transparent px-3 text-sm text-foreground";

function ProfilePage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [form, setForm] = useState({ display_name: "", birthdate: "", gender: "", interested_in: "everyone", course: "", year: "", bio: "", interests: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = me?.profile;
    if (!p) return;
    setForm({ display_name: p.display_name ?? "", birthdate: p.birthdate ?? "", gender: p.gender ?? "", interested_in: p.interested_in ?? "everyone", course: p.course ?? "", year: p.year ?? "", bio: p.bio ?? "", interests: (p.interests ?? []).join(", ") });
    signedUrls("photos", [p.photo_path]).then((m) => setPhotoUrl(p.photo_path ? m[p.photo_path] ?? null : null));
  }, [me?.profile]);

  if (!me) return null;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (!photo && !me.profile?.photo_path) { toast.error("Add a profile photo"); return; }
    setBusy(true);
    try {
      let photo_path = me.profile?.photo_path ?? null;
      if (photo) {
        photo_path = `${me.user.id}/profile-${Date.now()}`;
        const { error } = await supabase.storage.from("photos").upload(photo_path, photo, { contentType: photo.type });
        if (error) throw error;
      }
      const { error } = await supabase.from("profiles").update({
        display_name: form.display_name.trim(), birthdate: form.birthdate, gender: form.gender, interested_in: form.interested_in,
        course: form.course.trim(), year: form.year.trim(), bio: form.bio.trim(),
        interests: form.interests.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8), photo_path, onboarded: true,
      }).eq("id", me.user.id);
      if (error) throw error;
      if (idFile) {
        const path = `${me.user.id}/id-${Date.now()}`;
        const up = await supabase.storage.from("id-cards").upload(path, idFile, { contentType: idFile.type });
        if (up.error) throw up.error;
        const { error: vErr } = await supabase.from("verifications").upsert({ user_id: me.user.id, id_card_path: path });
        if (vErr) throw vErr;
      }
      toast.success("Saved");
      setPhoto(null); setIdFile(null);
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const v = me.verification;
  const status = !v ? "Not submitted" : v.status === "approved" ? "Approved" : v.status === "rejected" ? `Not approved${v.note ? ` — ${v.note}` : ""}` : "Waiting for review";

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 md:py-20">
      <PageHeading eyebrow="Your profile" title="Share the details that matter." description="Only approved students can see your profile. Your email and college ID are never shown to anyone except moderators." />
      {me.approved && <Button asChild className="mt-6"><Link to="/discover">Start discovering</Link></Button>}
      <form onSubmit={save} className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center gap-5">
          <div className="size-24 shrink-0 overflow-hidden border border-border bg-secondary">{(photo || photoUrl) && <img src={photo ? URL.createObjectURL(photo) : photoUrl!} alt="Your photo" className="size-full object-cover" />}</div>
          <div className="space-y-2"><Label htmlFor="photo">Profile photo</Label><Input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="name">Display name</Label><Input id="name" required maxLength={40} value={form.display_name} onChange={set("display_name")} /></div>
        <div className="space-y-2"><Label htmlFor="dob">Date of birth (18+ only)</Label><Input id="dob" type="date" required value={form.birthdate} onChange={set("birthdate")} /></div>
        <div className="space-y-2"><Label htmlFor="gender">I am</Label><select id="gender" required className={select} value={form.gender} onChange={set("gender")}><option value="">Choose…</option><option value="woman">A woman</option><option value="man">A man</option><option value="nonbinary">Non-binary</option></select></div>
        <div className="space-y-2"><Label htmlFor="int">Show me</Label><select id="int" className={select} value={form.interested_in} onChange={set("interested_in")}><option value="everyone">Everyone</option><option value="woman">Women</option><option value="man">Men</option><option value="nonbinary">Non-binary people</option></select></div>
        <div className="space-y-2"><Label htmlFor="course">Course</Label><Input id="course" maxLength={60} value={form.course} onChange={set("course")} placeholder="e.g. B.Tech CSE" /></div>
        <div className="space-y-2"><Label htmlFor="year">Year</Label><Input id="year" maxLength={20} value={form.year} onChange={set("year")} placeholder="e.g. 3rd year" /></div>
        <div className="md:col-span-2 space-y-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" maxLength={300} value={form.bio} onChange={set("bio")} /></div>
        <div className="md:col-span-2 space-y-2"><Label htmlFor="interests">Interests (comma separated)</Label><Input id="interests" value={form.interests} onChange={set("interests")} placeholder="Music, Film, Coffee" /></div>
        <div className="md:col-span-2 border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">College ID verification · <span className="text-primary">{status}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Upload a clear photo of your Adamas student ID card. Only moderators can see it.</p>
          <Input className="mt-3" type="file" accept="image/*" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" disabled={busy} className="md:col-span-2">{busy ? "Saving…" : "Save profile"}</Button>
      </form>
    </main>
  );
}
