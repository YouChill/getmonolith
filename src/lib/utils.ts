import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse a fetch Response as JSON.
 * Returns a fallback `{ data: null, error }` envelope on malformed responses
 * instead of throwing a SyntaxError.
 */
export async function safeJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return { data: null, error: "Invalid server response" } as T;
  }
}
