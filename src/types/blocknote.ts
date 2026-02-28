import type { PartialBlock } from "@blocknote/core";

export type BlockNoteContent = PartialBlock[];

export interface BlockNoteDocument {
  content: BlockNoteContent;
}
