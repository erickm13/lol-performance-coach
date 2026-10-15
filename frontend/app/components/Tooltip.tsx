"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Tooltip({
  label,
  content,
  className = "",
  popupClassName = "",
  onOpen,
  children,
}: {
  label: string;
  content: ReactNode;
  className?: string;
  popupClassName?: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function show() {
    clearTimeout(hideTimer.current);
    if (!open) onOpen?.();
    setOpen(true);
  }

  function hideSoon() {
    if (document.activeElement === triggerRef.current) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  }

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function updatePosition() {
      if (!triggerRef.current || !popupRef.current) return;
      const trigger = triggerRef.current.getBoundingClientRect();
      const popup = popupRef.current.getBoundingClientRect();
      const margin = 12;
      const above = trigger.top - popup.height - margin;
      const top = above >= margin ? above : trigger.bottom + margin;
      setPosition({
        top: Math.max(margin, Math.min(top, window.innerHeight - popup.height - margin)),
        left: Math.max(margin, Math.min(
          trigger.left + (trigger.width - popup.width) / 2,
          window.innerWidth - popup.width - margin,
        )),
      });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, content]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function dismissOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", dismissOutside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", dismissOutside);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`tooltip-trigger ${className}`}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(event) => { if (event.pointerType !== "touch") show(); }}
        onPointerLeave={hideSoon}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
      >
        {children}
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          id={id}
          role="tooltip"
          className={`hextech-tooltip ${popupClassName}`}
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
          onPointerEnter={() => clearTimeout(hideTimer.current)}
          onPointerLeave={hideSoon}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
