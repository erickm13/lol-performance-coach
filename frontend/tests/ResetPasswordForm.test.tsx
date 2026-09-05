import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResetPasswordForm } from "../app/components/ResetPasswordForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("restablece la contraseña y redirige a /login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
      ) as unknown as typeof fetch,
    );

    render(<ResetPasswordForm token="abc123" />);
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar nueva contraseña/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("muestra error si el token es null", async () => {
    render(<ResetPasswordForm token={null} />);
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar nueva contraseña/i }));

    expect(await screen.findByText(/link inválido/i)).toBeInTheDocument();
  });

  it("muestra error si falla la conexión de red", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error"))) as unknown as typeof fetch,
    );

    render(<ResetPasswordForm token="abc123" />);
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar nueva contraseña/i }));

    expect(
      await screen.findByRole("alert", { hidden: false }),
    ).toHaveTextContent(/no se pudo conectar con el servidor/i);
  });
});
