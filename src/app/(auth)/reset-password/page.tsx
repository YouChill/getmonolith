"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // User might already have a session from the callback redirect
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSessionReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Hasla nie sa takie same.");
      return;
    }

    if (password.length < 6) {
      setError("Haslo musi miec co najmniej 6 znakow.");
      return;
    }

    setLoading(true);

    const supabase = createBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      if (updateError.message.includes("should be different")) {
        setError("Nowe haslo musi byc inne niz poprzednie.");
      } else {
        setError(updateError.message);
      }
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <Card className="border-border-subtle bg-bg-surface">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-content-primary">
            Haslo zmienione
          </CardTitle>
          <CardDescription className="text-content-muted">
            Twoje haslo zostalo zaktualizowane. Mozesz teraz zalogowac sie nowym
            haslem.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
          >
            Przejdz do aplikacji
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!sessionReady) {
    return (
      <Card className="border-border-subtle bg-bg-surface">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-content-primary">
            Resetuj haslo
          </CardTitle>
          <CardDescription className="text-content-muted">
            Weryfikowanie linku resetujacego...
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/forgot-password" className="w-full">
            <Button
              variant="outline"
              className="w-full border-border-default text-content-secondary hover:bg-bg-elevated hover:text-content-primary"
            >
              Wyslij link ponownie
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
          Ustaw nowe haslo
        </CardTitle>
        <CardDescription className="text-content-muted">
          Wpisz nowe haslo do swojego konta
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-content-secondary">
              Nowe haslo
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
              Powtorz nowe haslo
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
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Zapisywanie..." : "Zapisz nowe haslo"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
