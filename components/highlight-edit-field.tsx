"use client";
import { useRef, useState } from "react";
import { isHighlighted, remapHighlights, toggleHighlight, type HighlightRange } from "@/lib/text-highlights";
import InlineEditField from "./inline-edit-field";
import HighlightedText from "./highlighted-text";

type Props = { value: string; highlights?: HighlightRange[]; onChange: (value: string, highlights: HighlightRange[]) => void };
export default function HighlightEditField({ value, highlights = [], onChange }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const hasSelection = selection.end > selection.start;
  const marked = isHighlighted(value, highlights, selection.start, selection.end);
  function toggle() {
    if (!hasSelection) return;
    onChange(value, toggleHighlight(value, highlights, selection.start, selection.end));
    requestAnimationFrame(() => {
      area.current?.focus({ preventScroll: true });
      area.current?.setSelectionRange(selection.start, selection.end);
    });
  }
  return <div className="highlight-editor">
    <div className="highlight-input-shell">
      <div className="highlight-mirror" aria-hidden="true"><HighlightedText text={value + "\n"} highlights={highlights} /></div>
      <InlineEditField label="選項補充說明" value={value} placeholder="補充說明（選填）" required={false} maxLength={250} multiline textareaRef={area}
        onSelectionChange={setSelection} onChange={next => onChange(next, remapHighlights(value, next, highlights))} />
    </div>
    <div className="highlight-tools">
      <button type="button" aria-label="黃底線" aria-pressed={marked} disabled={!hasSelection} title={marked ? "取消選取文字的黃底線" : "替選取文字加上黃底線"}
        onMouseDown={event => event.preventDefault()} onClick={toggle}><span aria-hidden="true">A</span>黃底線</button>
      <small>{hasSelection ? marked ? "再按一次取消" : "套用至選取文字" : "選取文字後標記"}</small>
    </div>
  </div>;
}
