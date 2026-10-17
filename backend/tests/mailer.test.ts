import { assertRejects } from "jsr:@std/assert@^1.0.0";
import { sendVerificationEmail } from "../src/email/mailer.ts";

Deno.test("sendVerificationEmail lanza un error si SMTP_USER o SMTP_PASS no están configuradas", async () => {
  const previous = Deno.env.get("SMTP_PASS");
  Deno.env.delete("SMTP_PASS");

  try {
    await assertRejects(() => sendVerificationEmail("test@example.com", "token123"));
  } finally {
    if (previous !== undefined) {
      Deno.env.set("SMTP_PASS", previous);
    }
  }
});
