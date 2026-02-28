"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Hasła nie są takie same.");
      return;
    }

    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }

    setLoading(true);

    const supabase = createBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        setError("Ten adres email jest już zajęty.");
      } else if (signUpError.message.includes("valid email")) {
        setError("Podaj prawidłowy adres email.");
      } else {
        setError(signUpError.message);
      }
      return;
    }

    setSuccess(true);
  }

  async function handleGoogleLogin() {
    setError(null);
    const supabase = createBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  if (success) {
    return (
      <Card className="border-border-subtle bg-bg-surface">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-content-primary">
            Sprawdź email
          </CardTitle>
          <CardDescription className="text-content-muted">
            Wysłaliśmy link potwierdzający na{" "}
            <span className="text-content-secondary">{email}</span>. Kliknij go,
            aby aktywować konto.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full border-border-default text-content-secondary hover:bg-bg-elevated hover:text-content-primary">
              Wróć do logowania
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-border-subtle bg-bg-surface">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-content-primary">
          Utwórz konto
        </CardTitle>
        <CardDescription className="text-content-muted">
          Podaj email i hasło, aby się zarejestrować
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-content-secondary">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="jan@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="border-border-default bg-bg-base focus-visible:ring-border-strong"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-content-secondary">
              Hasło
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              className="border-border-default bg-bg-base focus-visible:ring-border-strong"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-content-secondary">
              Powtórz hasło
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              className="border-border-default bg-bg-base focus-visible:ring-border-strong"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Rejestracja..." : "Zarejestruj się"}
          </Button>
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-bg-surface px-2 text-content-muted">
                lub
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full border-border-default text-content-secondary hover:bg-bg-elevated hover:text-content-primary"
            onClick={handleGoogleLogin}
          >
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Kontynuuj z Google
          </Button>
          <p className="text-center text-sm text-content-muted">
            Masz już konto?{" "}
            <Link
              href="/login"
              className="text-content-secondary transition-colors duration-150 hover:text-content-primary"
            >
              Zaloguj się
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
