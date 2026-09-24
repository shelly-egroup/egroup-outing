"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type MouseEvent, type RefObject } from "react";

import { useImageViewport } from "./use-image-viewport";

type MenuPage = { src: string; alt: string; title: string };
type Direction = -1 | 1;
type PageView = { index: number; from: number | null; direction: Direction; revision: number };

function PageControls({ index, count, title, onTurn, controls }: { index: number; count: number; title: string; onTurn: (direction: Direction) => void; controls: string }) {
  return <div className="menu-page-controls" role="group" aria-label="價目表翻頁">
    <button type="button" aria-label="上一頁價目表" aria-controls={controls} disabled={index === 0} onClick={() => onTurn(-1)}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5-7 7 7 7" /></svg>
    </button>
    <span className="menu-page-number" aria-live="polite" aria-atomic="true"><b>{index + 1}<span> / {count}</span></b><small>{title}</small></span>
    <button type="button" aria-label="下一頁價目表" aria-controls={controls} disabled={index === count - 1} onClick={() => onTurn(1)}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m10 5 7 7-7 7" /></svg>
    </button>
  </div>;
}

function MenuSheet({ pages, view, sheetRef }: { pages: readonly MenuPage[]; view: PageView; sheetRef?: RefObject<HTMLSpanElement | null> }) {
  const page = pages[view.index];
  return <span className="menu-sheet" ref={sheetRef}>
    <img className="menu-page-face" src={page.src} alt={page.alt} draggable={false} />
    {view.from !== null && <span key={view.revision} className={"menu-page-leaf " + (view.direction === 1 ? "turn-forward" : "turn-backward")} aria-hidden="true">
      <img src={pages[view.from].src} alt="" draggable={false} />
    </span>}
  </span>;
}

export default function ImageLightbox({ pages }: { pages: readonly [MenuPage, ...MenuPage[]] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<PageView>({ index: 0, from: null, direction: 1, revision: 0 });
  const page = pages[view.index];
  const pageId = useId();
  const gesture = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const sources = pages.map(item => item.src).join("\n");
  const viewport = useImageViewport(isOpen, turn, clearTurn);
  const isZoomed = viewport.zoomed;

  useEffect(() => {
    // Warm both pages so rapid turns never wait for the next photo to download.
    sources.split("\n").forEach(src => { const image = new Image(); image.src = src; });
  }, [sources]);
  useEffect(() => {
    if (view.from === null) return;
    const timer = setTimeout(() => setView(current => ({ ...current, from: null })), 340);
    return () => clearTimeout(timer);
  }, [view.revision, view.from]);
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

  function clearTurn() { setView(current => current.from === null ? current : { ...current, from: null }); }
  function close() { setIsOpen(false); viewport.reset(); gesture.current = null; clearTurn(); }
  function turn(direction: Direction) {
    setView(current => {
      const next = current.index + direction;
      if (next < 0 || next >= pages.length) return current;
      return { index: next, from: current.index, direction, revision: current.revision + 1 };
    });
    viewport.reset();
    dialogRef.current?.querySelector(".image-lightbox-stage")?.scrollTo({ left: 0, top: 0, behavior: "instant" });
  }
  function keyTurn(event: KeyboardEvent) {
    if (viewport.keyDown(event)) return;
    if (isZoomed || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    event.stopPropagation();
    turn(event.key === "ArrowLeft" ? -1 : 1);
  }
  function pointerDown(event: PointerEvent) {
    if (isZoomed || !event.isPrimary || event.button !== 0) return;
    gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick.current = false;
  }
  function pointerMove(event: PointerEvent) {
    const start = gesture.current;
    if (!start || event.pointerId !== start.pointer) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }
  function pointerUp(event: PointerEvent) {
    const start = gesture.current;
    gesture.current = null;
    if (!start || event.pointerId !== start.pointer) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      suppressClick.current = true;
      turn(dx < 0 ? 1 : -1);
    }
  }
  const swipeHandlers = {
    onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp,
    onPointerCancel: () => { gesture.current = null; suppressClick.current = false; },
    onClickCapture: (event: MouseEvent) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    },
  };

  return <>
    <section className="menu-book" aria-label="不老松店家圖冊" onKeyDown={keyTurn}>
      <div className="menu-book-heading"><span>店家圖冊</span>{pages.length > 1 && <small>左右滑動翻頁</small>}</div>
      <div className="menu-book-stage" id={pageId} {...swipeHandlers}>
        <button className="menu-image-trigger" type="button" aria-label={"放大檢視：" + page.alt} aria-haspopup="dialog" onClick={() => { clearTurn(); setIsOpen(true); }}>
          <MenuSheet pages={pages} view={view} />
          <span className="menu-zoom-hint">點圖放大 ＋</span>
        </button>
      </div>
      {pages.length > 1 && <PageControls index={view.index} count={pages.length} title={page.title} controls={pageId} onTurn={turn} />}
    </section>
    <dialog ref={dialogRef} className="image-lightbox" aria-label="不老松店家圖冊，放大檢視" onClose={close} onCancel={close} onKeyDown={keyTurn}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
      <div className="image-lightbox-toolbar">
        <strong><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3Zm0 14h16M8 3v14" /></svg>店家圖冊</strong>
        <div className="image-lightbox-actions">
          <button type="button" aria-pressed={isZoomed} onClick={viewport.toggle}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6M7 10h6" />{!isZoomed && <path d="M10 7v6" />}</svg>
            <span>{isZoomed ? "縮回" : "放大"}</span>
          </button>
          <button type="button" className="image-lightbox-close" onClick={close} autoFocus aria-label="關閉放大檢視" title="關閉">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>
      <div ref={viewport.stageRef} id={pageId + "-zoom"} className={"image-lightbox-stage" + (isZoomed ? " zoomed" : "")} data-dragging={viewport.dragging || undefined}
        role="group" tabIndex={0} aria-label={page.title + "，可縮放圖片"} aria-describedby={pageId + "-help"} style={viewport.style} {...viewport.handlers}>
        <MenuSheet pages={pages} view={view} sheetRef={viewport.sheetRef} />
      </div>
      <p className="image-lightbox-help" id={pageId + "-help"}>{isZoomed ? Math.round(viewport.scale * 100) + "% · 滑動或拖曳查看" : <><span className="image-help-touch">雙指放大 · 左右滑動翻頁</span><span className="image-help-mouse">Ctrl＋滾輪／± 縮放 · 放大後拖曳</span></>}</p>
      {pages.length > 1 && <PageControls index={view.index} count={pages.length} title={page.title} controls={pageId + "-zoom"} onTurn={turn} />}
    </dialog>
  </>;
}
