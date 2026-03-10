"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export function useLogout() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setLoggingOut(true);
    setError(null);

    const supabase = createBrowserClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      setLoggingOut(false);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return { logout, loggingOut, error };
}
