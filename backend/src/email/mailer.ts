import nodemailer from "npm:nodemailer@^6.9.16";

function getTransport() {
  const user = Deno.env.get("SMTP_USER");
  // Gmail muestra las contraseñas de aplicación con espacios; no forman parte de ella.
  const pass = Deno.env.get("SMTP_PASS")?.replaceAll(" ", "");
  if (!user || !pass) {
    throw new Error("Las variables de entorno SMTP_USER y SMTP_PASS son requeridas");
  }
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
  return {
    from: Deno.env.get("SMTP_FROM") ?? `LoL Performance Coach <${user}>`,
    transport: nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
  };
}

function getFrontendUrl(): string {
  return Deno.env.get("FRONTEND_URL") ?? "http://localhost:3000";
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const { from, transport } = getTransport();
  try {
    await transport.sendMail({ from, to, subject, html });
  } catch (error) {
    console.error(`El servidor SMTP rechazó el email "${subject}":`, error);
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = `${getFrontendUrl()}/verify-email?token=${token}`;
  await send(
    to,
    "Verifica tu cuenta",
    `<p>Haz clic para verificar tu cuenta: <a href="${link}">${link}</a></p>`,
  );
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = `${getFrontendUrl()}/reset-password?token=${token}`;
  await send(
    to,
    "Recupera tu contraseña",
    `<p>Haz clic para restablecer tu contraseña: <a href="${link}">${link}</a></p>`,
  );
}
