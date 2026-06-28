import { supabase } from "./supabase";

export async function checkIsAdmin() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user,
      isAdmin: false,
      error: userError?.message || "Not logged in",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      user,
      isAdmin: false,
      error: profileError.message,
    };
  }

  return {
    user,
    isAdmin: Boolean(profile?.is_admin),
    error: "",
  };
}