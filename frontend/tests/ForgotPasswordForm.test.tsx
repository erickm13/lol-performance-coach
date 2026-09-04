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
    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() =>
      expect(screen.getByText(/si el email existe/i)).toBeInTheDocument(),
    );
  });
});
