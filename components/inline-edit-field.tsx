"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
};
/** Native form fields keep keyboard, IME and validation behavior inside the real layout. */
export default function InlineEditField({ label, value, onChange, maxLength, multiline, required = true, placeholder, className = "", textareaRef, onSelectionChange }: Props) {
  const internalArea = useRef<HTMLTextAreaElement>(null);
  const area = textareaRef || internalArea;
  useLayoutEffect(() => {
    const node = area.current;
    if (!node) return;
    const fit = () => { node.style.height = "0px"; node.style.height = (node.scrollHeight + 2) + "px"; };
    fit();
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width !== node.clientWidth) { width = node.clientWidth; fit(); }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, area]);
  const props = {
    className: "inline-edit-field " + className,
    "aria-label": label, title: label, value, required, maxLength,
    placeholder: placeholder || label,
    onSelect: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => onSelectionChange?.({ start: event.currentTarget.selectionStart || 0, end: event.currentTarget.selectionEnd || 0 }),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  return multiline ? <textarea {...props} ref={area} rows={1} /> : <input {...props} type="text" onKeyDown={event => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault();
  }} />;
}
