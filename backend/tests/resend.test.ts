import { assertRejects } from "jsr:@std/assert@^1.0.0";
import { sendVerificationEmail } from "../src/email/resend.ts";

Deno.test("sendVerificationEmail lanza un error si RESEND_API_KEY no está configurada", async () => {
  const previous = Deno.env.get("RESEND_API_KEY");
  Deno.env.delete("RESEND_API_KEY");

  try {
    await assertRejects(() => sendVerificationEmail("test@example.com", "token123"));
  } finally {
    if (previous !== undefined) {
      Deno.env.set("RESEND_API_KEY", previous);
    }
  }
});
