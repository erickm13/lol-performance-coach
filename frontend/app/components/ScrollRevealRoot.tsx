"use client";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { observeVisibleOnce } from "../lib/observeVisible";

export function ScrollRevealRoot(
  { children, className }: { children: ReactNode; className: string },
) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tracked = new Map<Element, () => void>();
    const show = (element: Element, immediate = false) => {
      if (immediate) element.setAttribute("data-reveal-immediate", "true");
      element.setAttribute("data-revealed", "true");
      tracked.get(element)?.();
      tracked.delete(element);
    };
    const register = (element: Element) => {
      if (element.hasAttribute("data-revealed") || tracked.has(element)) return;
      if (preference.matches) {
        show(element, true);
        return;
      }
      const stop = observeVisibleOnce(element, () => show(element));
      // The fallback for browsers without IntersectionObserver runs immediately.
      if (element.hasAttribute("data-revealed")) stop();
      else tracked.set(element, stop);
    };
    const scan = (element: Element) => {
      if (element.matches("[data-reveal]")) register(element);
      element.querySelectorAll("[data-reveal]").forEach(register);
    };
    const changePreference = () => {
      root.setAttribute(
        "data-scroll-motion",
        preference.matches ? "off" : "ready",
      );
      if (preference.matches) {
        [...tracked.keys()].forEach((element) => show(element, true));
      }
    };
    changePreference();
    scan(root);
    // Route data can arrive after navigation has attempted to scroll to its
    // fragment. Retry once when the real content mounts, revealing the target.
    let anchorFrame = 0;
    if (window.location.hash) {
      anchorFrame = requestAnimationFrame(() => {
        let id: string;
        try {
          id = decodeURIComponent(window.location.hash.slice(1));
        } catch {
          return;
        }
        const target = document.getElementById(id);
        if (!target || !root.contains(target)) return;
        let ancestor: Element | null = target;
        while (ancestor && ancestor !== root) {
          if (ancestor.hasAttribute("data-reveal")) show(ancestor, true);
          ancestor = ancestor.parentElement;
        }
        target.scrollIntoView({ block: "start", behavior: "auto" });
      });
    }
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
      for (const [element, stop] of tracked) {
        if (!root.contains(element)) {
          stop();
          tracked.delete(element);
        }
      }
    });
    mutations.observe(root, { childList: true, subtree: true });
    const revealFocused = (event: FocusEvent) => {
      let element = event.target instanceof Element ? event.target : null;
      while (element && element !== root) {
        if (
          element.hasAttribute("data-reveal") &&
          !element.hasAttribute("data-revealed")
        ) show(element, true);
        element = element.parentElement;
      }
    };
    root.addEventListener("focusin", revealFocused);
    preference.addEventListener("change", changePreference);
    return () => {
      cancelAnimationFrame(anchorFrame);
      mutations.disconnect();
      tracked.forEach((stop) => stop());
      root.removeEventListener("focusin", revealFocused);
      root.removeAttribute("data-scroll-motion");
      preference.removeEventListener("change", changePreference);
    };
  }, []);
  return (
    <div ref={ref} className={`${className} scroll-reveal-page`}>
      {children}
    </div>
  );
}
