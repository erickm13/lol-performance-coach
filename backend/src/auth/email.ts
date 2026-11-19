const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const EMAIL_RE = new RegExp(
  `^[^\\s@]{1,64}@((?:${LABEL}\\.)+[a-z]{2,63})$`,
);

export type MxResolver = (domain: string) => Promise<{ exchange: string }[]>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Domain of a normalized address, or null when the address is malformed. */
export function emailDomain(email: string): string | null {
  if (email.length > 254) return null;
  return EMAIL_RE.exec(email)?.[1] ?? null;
}

const resolveMx: MxResolver = (domain) =>
  // The trailing dot keeps the system resolver from appending a search domain.
  Deno.resolveDns(`${domain}.`, "MX");

/**
 * Whether the domain publishes a mail server. It cannot prove that the mailbox
 * exists; that is what email verification is for.
 */
export async function domainAcceptsMail(
  domain: string,
  resolve: MxResolver = resolveMx,
): Promise<boolean> {
  try {
    const records = await resolve(domain);
    // A null MX (RFC 7505) declares that the domain accepts no mail.
    return records.some((record) => record.exchange.replace(/\.$/, "") !== "");
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    // A DNS outage must not block sign-ups; verification still applies.
    return true;
  }
}
