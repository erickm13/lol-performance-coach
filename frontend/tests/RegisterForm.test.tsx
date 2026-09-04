import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RegisterForm } from "../app/components/RegisterForm";

describe("RegisterForm", () => {
  it("registra y muestra el mensaje de verificación", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "1", email: "a@b.com" }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() =>
      expect(screen.getByText(/revisá tu correo/i)).toBeInTheDocument(),
    );
  });

  it("muestra error si las contraseñas no coinciden", async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
  });
});
