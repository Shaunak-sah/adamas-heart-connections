import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ProfileCard, parseInterests } from "@/components/afterclass/profile-card";
import { PageHeading } from "@/components/afterclass/shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, signedUrls } from "@/lib/afterclass";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile · AFTERCLASS" }, { name: "description", content: "Edit your AFTERCLASS profile and verification." }] }),
  component: ProfilePage,
});


function ProfilePage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [form, setForm] = useState({ display_name: "", birthdate: "", gender: "", interested_in: "everyone", course: "", year: "", bio: "", interests: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) { setLocalPhoto(null); return; }
    const url = URL.createObjectURL(photo);
    setLocalPhoto(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

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
    if (!form.gender) { toast.error("Choose how you identify under “I am”"); return; }
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
        interests: parseInterests(form.interests), photo_path, onboarded: true,
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
  const shownPhoto = localPhoto ?? photoUrl;
  const preview = (
    <ProfileCard
      photo={shownPhoto}
      name={form.display_name.trim()}
      birthdate={form.birthdate || null}
      course={form.course.trim()}
      year={form.year.trim()}
      bio={form.bio.trim()}
      interests={parseInterests(form.interests)}
      actions={<>
        <Button type="button" variant="outline" size="lg" disabled tabIndex={-1}><X aria-hidden="true" /> Pass</Button>
        <Button type="button" size="lg" disabled tabIndex={-1}><Heart aria-hidden="true" /> Like</Button>
      </>}
    />
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <PageHeading eyebrow="Your profile" title="Share the details that matter." description="Only approved students can see your profile. Your email and college ID are never shown to anyone except moderators." />
      <div className="mt-6 flex flex-wrap gap-3">
        {me.approved && <Button asChild><Link to="/discover">Start discovering</Link></Button>}
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="lg:hidden"><Eye aria-hidden="true" /> Preview my card</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>How you’ll appear in Discover</DialogTitle>
              <DialogDescription>This updates as you type. Nothing is saved until you press Save profile.</DialogDescription>
            </DialogHeader>
            {preview}
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={save} className="grid content-start gap-5 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center gap-5">
          <div className="size-24 shrink-0 overflow-hidden border border-border bg-secondary">{shownPhoto && <img src={shownPhoto} alt="Your photo" className="size-full object-cover" />}</div>
          <div className="space-y-2"><Label htmlFor="photo">Profile photo</Label><Input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="name">Display name</Label><Input id="name" required maxLength={40} value={form.display_name} onChange={set("display_name")} /></div>
        <div className="space-y-2"><Label htmlFor="dob">Date of birth (18+ only)</Label><Input id="dob" type="date" required value={form.birthdate} onChange={set("birthdate")} /></div>
        <div className="space-y-2">
          <Label htmlFor="gender">I am</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger id="gender" className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="woman">A woman</SelectItem>
              <SelectItem value="man">A man</SelectItem>
              <SelectItem value="nonbinary">Non-binary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="int">Show me</Label>
          <Select value={form.interested_in} onValueChange={(v) => setForm({ ...form, interested_in: v })}>
            <SelectTrigger id="int" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="woman">Women</SelectItem>
              <SelectItem value="man">Men</SelectItem>
              <SelectItem value="nonbinary">Non-binary people</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="course">Course</Label><Input id="course" maxLength={60} value={form.course} onChange={set("course")} placeholder="e.g. B.Tech CSE" /></div>
        <div className="space-y-2"><Label htmlFor="year">Year</Label><Input id="year" maxLength={20} value={form.year} onChange={set("year")} placeholder="e.g. 3rd year" /></div>
        <div className="md:col-span-2 space-y-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" maxLength={300} value={form.bio} onChange={set("bio")} /></div>
        <div className="md:col-span-2 space-y-2"><Label htmlFor="interests">Interests (comma separated, up to 8)</Label><Input id="interests" value={form.interests} onChange={set("interests")} placeholder="Music, Film, Coffee" /></div>
        <div className="md:col-span-2 border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">College ID verification · <span className="text-primary">{status}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Upload a clear photo of your Adamas student ID card. Only moderators can see it.</p>
          <Input className="mt-3" type="file" accept="image/*" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" disabled={busy} className="md:col-span-2">{busy ? "Saving…" : "Save profile"}</Button>
      </form>
      <aside aria-label="Profile preview" className="hidden lg:block">
        <div className="sticky top-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Live preview</p>
          <p className="mb-4 text-xs text-muted-foreground">How other students see you in Discover. Not saved until you press Save profile.</p>
          {preview}
        </div>
      </aside>
      </div>
    </main>
  );
}
