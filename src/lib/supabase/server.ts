// Wymagane zmienne środowiskowe:
// NEXT_PUBLIC_SUPABASE_URL — URL projektu Supabase
// NEXT_PUBLIC_SUPABASE_ANON_KEY — klucz publiczny (anon)

import { createServerClient as _createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Tworzy klienta Supabase do użycia w Server Components i Route Handlers.
 * Zawsze używaj tej funkcji po stronie serwera — nigdy `createClient` z `@supabase/supabase-js`.
 *
 * Klient automatycznie odczytuje i ustawia ciasteczka sesji,
 * co pozwala Supabase Auth działać poprawnie w kontekście SSR.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll jest wywoływane z Server Component — ignorujemy.
            // Sesja zostanie odświeżona przez middleware.
          }
        },
      },
    }
  );
}
