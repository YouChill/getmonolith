"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

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

      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-bg-surface text-sm font-medium text-content-primary">
        {avatarFallback}
      </div>
    </header>
  );
}
