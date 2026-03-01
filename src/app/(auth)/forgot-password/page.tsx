"use client";

import { useState } from "react";
import Link from "next/link";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Card className="border-border-subtle bg-bg-surface">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-content-primary">
            Sprawdz email
          </CardTitle>
          <CardDescription className="text-content-muted">
            Wyslalismy link do resetowania hasla na{" "}
            <span className="text-content-secondary">{email}</span>. Kliknij go,
            aby ustawic nowe haslo.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button
              variant="outline"
              className="w-full border-border-default text-content-secondary hover:bg-bg-elevated hover:text-content-primary"
            >
              Wroc do logowania
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
          Resetuj haslo
        </CardTitle>
        <CardDescription className="text-content-muted">
          Podaj adres email powiazany z kontem. Wyslemy link do ustawienia nowego
          hasla.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
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
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wysylanie..." : "Wyslij link resetujacy"}
          </Button>
          <p className="text-center text-sm text-content-muted">
            Pamietasz haslo?{" "}
            <Link
              href="/login"
              className="text-content-secondary transition-colors duration-150 hover:text-content-primary"
            >
              Zaloguj sie
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
