import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VerifyEmailStatus } from "../app/components/VerifyEmailStatus";

describe("VerifyEmailStatus", () => {
  it("muestra éxito cuando el backend confirma el token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch,
    );

    render(<VerifyEmailStatus token="abc123" />);
    expect(screen.getByText(/verificando/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText(/quedó verificado/i)).toBeInTheDocument(),
    );
  });

  it("muestra error cuando no hay token", async () => {
    render(<VerifyEmailStatus token={null} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
