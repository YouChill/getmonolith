"use client";

import { useMemo } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { BlockNoteContent } from "@/types/blocknote";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface BlockNoteEditorProps {
  initialContent?: BlockNoteContent;
  onChange?: (content: BlockNoteContent) => void;
  editable?: boolean;
}

const DEFAULT_CONTENT: BlockNoteContent = [
  {
    type: "paragraph",
    content: "Zacznij pisać…",
  },
];

export function BlockNoteEditor({
  initialContent,
  onChange,
  editable = true,
}: BlockNoteEditorProps) {
  const content = useMemo(
    () => (initialContent && initialContent.length > 0 ? initialContent : DEFAULT_CONTENT),
    [initialContent],
  );

  const editor = useCreateBlockNote({
    initialContent: content,
  });

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-2">
      <BlockNoteView
        editor={editor}
        theme="dark"
        editable={editable}
        onChange={() => {
          onChange?.(editor.document);
        }}
      />
    </div>
  );
}
