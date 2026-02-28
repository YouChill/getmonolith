"use client";

import dynamic from "next/dynamic";
import type { BlockNoteContent } from "@/lib/types/blocknote";

const BlockNoteEditor = dynamic(
  () => import("@/components/editor/block-note-editor").then((mod) => mod.BlockNoteEditor),
  { ssr: false },
);

const demoContent: BlockNoteContent = [
  {
    type: "heading",
    props: { level: 2 },
    content: "BlockNote integration test",
  },
  {
    type: "paragraph",
    content: "Ta strona służy do weryfikacji działania edytora BlockNote.",
  },
  {
    type: "bulletListItem",
    content: "Tryb dark zgodny z tokenami Monolith",
  },
  {
    type: "bulletListItem",
    content: "Obsługa JSON content przez TypeScript",
  },
];

export default function BlockNoteTestPage() {
  return (
    <main className="min-h-screen bg-bg-base px-6 py-10 text-content-primary">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <h1 className="text-2xl font-semibold">BlockNote — strona testowa</h1>
        <p className="text-content-secondary">
          Sprawdź edycję treści, menu slash i formatowanie bloków.
        </p>
        <BlockNoteEditor initialContent={demoContent} />
      </div>
    </main>
  );
}
