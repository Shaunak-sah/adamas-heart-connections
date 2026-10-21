import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, Heart, Plus, Shuffle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { cleanPrompts, MAX_ANSWER, MAX_PHOTOS, MAX_PROMPTS, moveItem, PROMPT_QUESTIONS, randomQuestion, readPrompts, type Prompt } from "@/lib/profile-extras";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile · AFTERCLASS" }, { name: "description", content: "Edit your AFTERCLASS photos, prompts, profile and verification." }] }),
  component: ProfilePage,
});

type PhotoItem = { key: string; url: string; path?: string; file?: File };

function fillSlots(saved: Prompt[]): Prompt[] {
  const slots = saved.slice(0, MAX_PROMPTS);
  while (slots.length < MAX_PROMPTS) {
    slots.push({ question: randomQuestion(slots.map((s) => s.question)), answer: "" });
  }
  return slots;
}

function ProfilePage() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [form, setForm] = useState({ display_name: "", birthdate: "", gender: "", interested_in: "everyone", course: "", year: "", bio: "", interests: "" });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [slots, setSlots] = useState<Prompt[]>(() => fillSlots([]));
  const [idFile, setIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoItem[]>([]);
  photosRef.current = photos;

  useEffect(() => () => photosRef.current.forEach((p) => p.file && URL.revokeObjectURL(p.url)), []);

  useEffect(() => {
    const p = me?.profile;
    if (!p) return;
    setForm({ display_name: p.display_name ?? "", birthdate: p.birthdate ?? "", gender: p.gender ?? "", interested_in: p.interested_in ?? "everyone", course: p.course ?? "", year: p.year ?? "", bio: p.bio ?? "", interests: (p.interests ?? []).join(", ") });
    setSlots(fillSlots(readPrompts(p.prompts)));
    const paths = p.photo_paths ?? [];
    signedUrls("photos", paths).then((m) => {
      photosRef.current.forEach((x) => x.file && URL.revokeObjectURL(x.url));
      setPhotos(paths.flatMap((path) => { const url = m[path]; return url ? [{ key: path, path, url }] : []; }));
    });
  }, [me?.profile]);

  if (!me) return null;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (chosen.length > room) toast.error(`You can have up to ${MAX_PHOTOS} photos`);
    const added = chosen.slice(0, room).map((file, i) => ({ key: `new-${Date.now()}-${i}`, file, url: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...added]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(i: number) {
    const item = photos[i];
    if (item?.file) URL.revokeObjectURL(item.url);
    setPhotos(photos.filter((_, j) => j !== i));
  }

  const setSlot = (i: number, patch: Partial<Prompt>) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const shuffleSlot = (i: number) => setSlot(i, { question: randomQuestion(slots.map((s) => s.question)) });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (!photos.length) { toast.error("Add at least one photo"); return; }
    if (!form.gender) { toast.error("Choose how you identify under “I am”"); return; }
    const prompts = cleanPrompts(slots);
    if (!prompts.length) { toast.error("Answer at least one question so people have something to talk about"); return; }
    setBusy(true);
    try {
      const photo_paths: string[] = [];
      for (const [i, item] of photos.entries()) {
        if (item.path) { photo_paths.push(item.path); continue; }
        const path = `${me.user.id}/photo-${Date.now()}-${i}`;
        const { error } = await supabase.storage.from("photos").upload(path, item.file!, { contentType: item.file!.type });
        if (error) throw error;
        photo_paths.push(path);
      }
      const { error } = await supabase.from("profiles").update({
        display_name: form.display_name.trim(), birthdate: form.birthdate, gender: form.gender, interested_in: form.interested_in,
        course: form.course.trim(), year: form.year.trim(), bio: form.bio.trim(),
        interests: parseInterests(form.interests), photo_paths, prompts, onboarded: true,
      }).eq("id", me.user.id);
      if (error) throw error;
      const removed = (me.profile?.photo_paths ?? []).filter((p) => !photo_paths.includes(p));
      if (removed.length) await supabase.storage.from("photos").remove(removed);
      if (idFile) {
        const path = `${me.user.id}/id-${Date.now()}`;
        const up = await supabase.storage.from("id-cards").upload(path, idFile, { contentType: idFile.type });
        if (up.error) throw up.error;
        const { error: vErr } = await supabase.from("verifications").upsert({ user_id: me.user.id, id_card_path: path });
        if (vErr) throw vErr;
      }
      toast.success("Saved");
      setIdFile(null);
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const v = me.verification;
  const status = !v ? "Not submitted" : v.status === "approved" ? "Approved" : v.status === "rejected" ? `Not approved${v.note ? ` — ${v.note}` : ""}` : "Waiting for review";
  const answered = slots.filter((s) => s.answer.trim()).length;
  const preview = (
    <ProfileCard
      photos={photos.map((p) => p.url)}
      name={form.display_name.trim()}
      birthdate={form.birthdate || null}
      course={form.course.trim()}
      year={form.year.trim()}
      bio={form.bio.trim()}
      interests={parseInterests(form.interests)}
      prompts={cleanPrompts(slots)}
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
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium text-foreground">Photos <span className="text-muted-foreground">· {photos.length}/{MAX_PHOTOS}</span></legend>
          <p className="mt-1 text-xs text-muted-foreground">Add up to {MAX_PHOTOS}. The first photo is your main one — use the arrows to change the order.</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <div key={p.key} className="relative aspect-[4/5] overflow-hidden border border-border bg-secondary">
                <img src={p.url} alt={`Your photo ${i + 1}`} className="size-full object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">Main</span>}
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="secondary" className="size-7" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => setPhotos(moveItem(photos, i, i - 1))}><ChevronLeft /></Button>
                    <Button type="button" size="icon" variant="secondary" className="size-7" aria-label={`Move photo ${i + 1} later`} disabled={i === photos.length - 1} onClick={() => setPhotos(moveItem(photos, i, i + 1))}><ChevronRight /></Button>
                  </div>
                  <Button type="button" size="icon" variant="secondary" className="size-7" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)}><Trash2 /></Button>
                </div>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileInput.current?.click()} className="grid aspect-[4/5] place-items-center border border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <span className="flex flex-col items-center gap-1 text-xs"><Plus aria-hidden="true" className="size-5" />Add photos</span>
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple className="sr-only" aria-label="Add photos" onChange={(e) => addFiles(e.target.files)} />
        </fieldset>

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

        <fieldset className="md:col-span-2 space-y-4">
          <div>
            <legend className="text-sm font-medium text-foreground">Answer a few questions <span className="text-muted-foreground">· {answered}/{MAX_PROMPTS}</span></legend>
            <p className="mt-1 text-xs text-muted-foreground">Answers give people an easy way to start a conversation. Answer at least one — all three helps you stand out. Don’t like a question? Shuffle it or pick another.</p>
          </div>
          {slots.map((s, i) => (
            <div key={i} className="border border-border bg-panel p-4">
              <div className="flex gap-2">
                <Select value={s.question} onValueChange={(q) => setSlot(i, { question: q })}>
                  <SelectTrigger aria-label={`Question ${i + 1}`} className="w-full"><SelectValue placeholder="Choose a question…" /></SelectTrigger>
                  <SelectContent>
                    {PROMPT_QUESTIONS.map((q) => (
                      <SelectItem key={q} value={q} disabled={q !== s.question && slots.some((o) => o.question === q)}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" aria-label={`Shuffle question ${i + 1}`} onClick={() => shuffleSlot(i)}><Shuffle /></Button>
              </div>
              <Textarea className="mt-3" aria-label={`Your answer to: ${s.question}`} placeholder="Your answer…" maxLength={MAX_ANSWER} value={s.answer} onChange={(e) => setSlot(i, { answer: e.target.value })} />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{s.answer.length}/{MAX_ANSWER}</p>
            </div>
          ))}
        </fieldset>

        <div className="md:col-span-2 border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">College ID verification · <span className="text-primary">{status}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Upload a clear photo of your Adamas student ID card. Only moderators can see it.</p>
          <Input className="mt-3" type="file" accept="image/*" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" disabled={busy} className="md:col-span-2">{busy ? "Saving…" : "Save profile"}</Button>
      </form>
      <aside aria-label="Profile preview" className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Live preview</p>
          <p className="mb-4 text-xs text-muted-foreground">How other students see you in Discover. Tap the sides of the photo to flip through. Not saved until you press Save profile.</p>
          {preview}
        </div>
      </aside>
      </div>
    </main>
  );
}
