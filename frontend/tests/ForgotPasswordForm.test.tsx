import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ForgotPasswordForm } from "../app/components/ForgotPasswordForm";

describe("ForgotPasswordForm", () => {
  it("envía la solicitud y muestra la confirmación genérica", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
      ) as unknown as typeof fetch,
    );

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() =>
      expect(screen.getByText(/si existe una cuenta/i)).toBeInTheDocument(),
    );
  });

  it("muestra un error si falla la conexión de red", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error"))) as unknown as typeof fetch,
    );

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /no pudimos enviar la solicitud/i,
      ),
    );
  });
});
