import { highlightedParts, type HighlightRange } from "@/lib/text-highlights";

export default function HighlightedText({ text, highlights }: { text: string; highlights?: readonly HighlightRange[] }) {
  return <>{highlightedParts(text, highlights).map((part, index) => part.highlighted
    ? <mark className="text-yellow-underline" key={index}>{part.text}</mark>
    : part.text)}</>;
}
