// Wymagane zmienne środowiskowe:
// NEXT_PUBLIC_SUPABASE_URL — URL projektu Supabase
// NEXT_PUBLIC_SUPABASE_ANON_KEY — klucz publiczny (anon)

import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';

/**
 * Tworzy klienta Supabase do użycia w Client Components ('use client').
 * Klient automatycznie zarządza sesją przez ciasteczka przeglądarki.
 *
 * Użycie:
 *   const supabase = createBrowserClient();
 *   const { data } = await supabase.from('blocks').select('*');
 */
export function createBrowserClient() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
