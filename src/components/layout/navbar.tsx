"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useLogout } from "@/lib/hooks/use-logout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  workspaceName: string;
  userEmail: string;
}

function toCrumb(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Navbar({ workspaceName, userEmail }: NavbarProps) {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);

    if (!segments.length) {
      return [workspaceName];
    }

    const [, ...rest] = segments;
    return [workspaceName, ...rest.map(toCrumb)];
  }, [pathname, workspaceName]);

  const avatarFallback = (userEmail[0] ?? "U").toUpperCase();

  return (
    <header className="flex h-12 items-center justify-between border-b border-border-subtle bg-bg-base px-4">
      <nav className="flex min-w-0 items-center gap-2 text-sm text-content-secondary">
        {breadcrumbs.map((crumb, index) => (
          <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-2">
            {index > 0 && <span className="text-content-muted">/</span>}
            <span
              className={index === breadcrumbs.length - 1 ? "truncate text-content-primary" : "truncate"}
            >
              {crumb}
            </span>
          </div>
        ))}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-bg-surface text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-bg-elevated hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
          >
            {avatarFallback}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border-border-subtle bg-bg-surface">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium text-content-primary">Konto</p>
            <p className="text-xs text-content-muted truncate">{userEmail}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border-subtle" />
          <DropdownMenuItem
            onClick={logout}
            disabled={loggingOut}
            className="text-content-secondary focus:bg-bg-elevated focus:text-content-primary cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Wylogowywanie..." : "Wyloguj sie"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
