import { Resend } from "npm:resend@^4.0.0";

function getClient(): Resend {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("La variable de entorno RESEND_API_KEY es requerida");
  }
  return new Resend(apiKey);
}

function getFrontendUrl(): string {
  return Deno.env.get("FRONTEND_URL") ?? "http://localhost:3000";
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const resend = getClient();
  const link = `${getFrontendUrl()}/verify-email?token=${token}`;
  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject: "Verificá tu cuenta",
    html: `<p>Hacé click para verificar tu cuenta: <a href="${link}">${link}</a></p>`,
  });
  if (error) {
    console.error("Resend rechazó el email de verificación:", error);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const resend = getClient();
  const link = `${getFrontendUrl()}/reset-password?token=${token}`;
  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject: "Recuperá tu contraseña",
    html: `<p>Hacé click para restablecer tu contraseña: <a href="${link}">${link}</a></p>`,
  });
  if (error) {
    console.error("Resend rechazó el email de recuperación de contraseña:", error);
  }
}
