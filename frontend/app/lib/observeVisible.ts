// One observer shared by scroll reveals, number counters and bars. Clipped
// content (including closed disclosures and scrollable lists) waits its turn.
const waiting = new Map<Element, Set<() => void>>();
let observer: IntersectionObserver | null = null;
export function observeVisibleOnce(element: Element, callback: () => void) {
  if (typeof IntersectionObserver === "undefined") {
    callback();
    return () => {};
  }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callbacks = waiting.get(entry.target);
        waiting.delete(entry.target);
        observer?.unobserve(entry.target);
        callbacks?.forEach((notify) => notify());
      }
    }, { threshold: .08, rootMargin: "0px 0px -24px 0px" });
  }
  const callbacks = waiting.get(element) ?? new Set<() => void>();
  callbacks.add(callback);
  waiting.set(element, callbacks);
  observer.observe(element);
  return () => {
    const pending = waiting.get(element);
    pending?.delete(callback);
    if (!pending?.size) {
      waiting.delete(element);
      observer?.unobserve(element);
    }
  };
}
