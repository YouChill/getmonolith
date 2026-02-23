// Wymagane zmienne środowiskowe:
// NEXT_PUBLIC_SUPABASE_URL — URL projektu Supabase
// NEXT_PUBLIC_SUPABASE_ANON_KEY — klucz publiczny (anon)

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware odświeżający sesję Supabase Auth przy każdym żądaniu
 * oraz chroniący route'y /(dashboard) przed niezalogowanymi użytkownikami.
 *
 * Mechanizm:
 * 1. Tworzy klienta Supabase z dostępem do ciasteczek request/response.
 * 2. Wywołuje getUser() — jeśli token wygasł, Supabase automatycznie
 *    go odświeża i zapisuje nowe ciasteczka w response.
 * 3. Chroni route'y wymagające autentykacji.
 * 4. Przekierowuje zalogowanych użytkowników z /login i /register na /.
 */

const protectedSegments = ['/board', '/calendar', '/notes', '/block', '/settings'];
const authPaths = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Ustawiamy ciasteczka na request (dla dalszych middleware/RSC)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Tworzymy nowy response z zaktualizowanymi ciasteczkami
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // WAŻNE: Nie usuwaj tego wywołania.
  // getUser() triggeruje odświeżenie sesji jeśli token wygasł.
  // Używamy getUser() zamiast getSession() — getSession() nie waliduje
  // tokena po stronie serwera i nie jest bezpieczna do autoryzacji.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Zalogowany użytkownik na stronach auth → redirect do głównej
  if (user && authPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Niezalogowany użytkownik na chronionych ścieżkach → redirect do logowania
  // Dashboard paths: /[workspaceSlug]/board, /[workspaceSlug]/calendar, etc.
  const isProtected = protectedSegments.some((segment) => pathname.includes(segment));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Dopasuj wszystkie ścieżki OPRÓCZ:
     * - _next/static (pliki statyczne)
     * - _next/image (optymalizacja obrazów)
     * - favicon.ico (ikona)
     * - Pliki statyczne z rozszerzeniami (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
