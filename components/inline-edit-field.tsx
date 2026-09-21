"use client";
import { useLayoutEffect, useRef } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
};
/** Native form fields keep keyboard, IME and validation behavior inside the real layout. */
export default function InlineEditField({ label, value, onChange, maxLength, multiline, required = true, placeholder, className = "" }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
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
  }, [value]);
  const props = {
    className: "inline-edit-field " + className,
    "aria-label": label, title: label, value, required, maxLength,
    placeholder: placeholder || label,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  return multiline ? <textarea {...props} ref={area} rows={1} /> : <input {...props} type="text" onKeyDown={event => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault();
  }} />;
}
