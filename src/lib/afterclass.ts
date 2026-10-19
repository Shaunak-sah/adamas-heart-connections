import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const STUDENT_DOMAIN = "@stu.adamasuniversity.ac.in";

export function isStudentEmail(email: string) {
  return email.trim().toLowerCase().endsWith(STUDENT_DOMAIN);
}

export function ageFrom(birthdate: string | null) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return null;
    const [profile, verification, roles] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("verifications").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const isAdmin = (roles.data ?? []).some((r) => r.role === "admin");
    const p = profile.data;
    const v = verification.data;
    const approved = !!p?.onboarded && v?.status === "approved" && (ageFrom(p.birthdate) ?? 0) >= 18;
    return { user, profile: p, verification: v, isAdmin, approved };
  },
});

export async function signedUrls(bucket: string, paths: (string | null | undefined)[]) {
  const clean = paths.filter((p): p is string => !!p);
  if (!clean.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(clean, 3600);
  const map: Record<string, string> = {};
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}
