import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginForm } from "../app/components/LoginForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("hace login y redirige a /dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: "1", email: "a@b.com", emailVerified: true }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("muestra un error si las credenciales son inválidas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Credenciales inválidas" }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/credenciales inválidas/i),
    );
  });
});
