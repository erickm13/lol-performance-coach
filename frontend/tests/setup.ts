import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock por defecto del App Router de Next para que los componentes que usan
// navegación (directa o vía hooks como useResource) se puedan renderizar en los
// tests sin montar el router real. Los tests que necesiten afirmar sobre la
// navegación pueden sobreescribir este mock con su propio vi.mock.
vi.mock("next/navigation", () => {
  // Referencia ESTABLE del router: Next devuelve el mismo objeto entre renders.
  // Devolver uno nuevo por llamada haría que los efectos con dependencia [router]
  // (p. ej. useResource) se reejecuten infinitamente y agoten la memoria.
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  };
  return {
    useRouter: () => router,
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    redirect: vi.fn(),
    notFound: vi.fn(),
  };
});

// jsdom no implementa matchMedia; varios componentes/hooks consultan
// prefers-reduced-motion y se suscriben con addEventListener. Proveemos una
// implementación mínima completa para que no reviente el render en los tests.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
