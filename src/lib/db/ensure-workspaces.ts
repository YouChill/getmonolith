import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Tworzy domyślne workspace'y (Prywatna + Służbowa) dla nowego użytkownika.
 *
 * Wywoływane przy pierwszym wejściu zalogowanego użytkownika,
 * gdy nie ma jeszcze żadnego membership w workspace_members.
 *
 * Zwraca slug pierwszego workspace'a (personal) do redirect.
 */
export async function ensureWorkspacesExist(
  userId: string,
  email: string
): Promise<string> {
  // Sprawdź, czy użytkownik ma już jakieś workspace'y
  const existing = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    // Już ma workspace — pobierz slug pierwszego
    const ws = await db
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, existing[0].workspaceId))
      .limit(1);

    return ws[0].slug;
  }

  // Generuj bazowy slug z email (przed @, bez znaków specjalnych)
  // Dodajemy krótki suffix z userId aby uniknąć kolizji slugów
  const emailPrefix = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = userId.slice(0, 6);
  const baseSlug = `${emailPrefix}-${suffix}`;

  const now = new Date();

  // Twórz oba workspace'y w transakcji
  const personalSlug = `${baseSlug}-personal`;
  const workSlug = `${baseSlug}-work`;

  const [personalWs] = await db.transaction(async (tx) => {
    const [personal] = await tx
      .insert(workspaces)
      .values({
        name: "Prywatna",
        slug: personalSlug,
        type: "personal",
        ownerId: userId,
      })
      .returning();

    const [work] = await tx
      .insert(workspaces)
      .values({
        name: "Służbowa",
        slug: workSlug,
        type: "work",
        ownerId: userId,
      })
      .returning();

    // Dodaj użytkownika jako ownera do obu workspace'ów
    await tx.insert(workspaceMembers).values([
      {
        workspaceId: personal.id,
        userId,
        role: "owner",
        acceptedAt: now,
      },
      {
        workspaceId: work.id,
        userId,
        role: "owner",
        acceptedAt: now,
      },
    ]);

    return [personal, work];
  });

  return personalWs.slug;
}
