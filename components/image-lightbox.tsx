"use client";

import { useEffect, useRef, useState } from "react";

export default function ImageLightbox({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    setIsZoomed(false);
  }

  return (
    <>
      <button
        className="menu-image-trigger"
        type="button"
        aria-label={"放大檢視：" + alt}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <img src={src} alt={alt} />
        <span>點擊放大</span>
      </button>
      <dialog
        ref={dialogRef}
        className="image-lightbox"
        aria-label={alt + "，放大檢視"}
        onClose={close}
        onCancel={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="image-lightbox-toolbar">
          <span>{alt}</span>
          <button
            type="button"
            aria-pressed={isZoomed}
            onClick={() => setIsZoomed(!isZoomed)}
          >
            {isZoomed ? "符合螢幕" : "再放大"}
          </button>
          <button
            type="button"
            onClick={close}
            autoFocus
            aria-label="關閉放大檢視"
          >
            關閉 ✕
          </button>
        </div>
        <div
          className={"image-lightbox-stage" + (isZoomed ? " zoomed" : "")}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <img className="image-lightbox-image" src={src} alt={alt} />
        </div>
      </dialog>
    </>
  );
}
