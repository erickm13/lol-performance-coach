/** Account facts come from the application, not a model or chat history. */
export function accountHelpReply(message: string): string | null {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const asksPassword = /\b(contrasenas?|passwords?|credenciales)\b/.test(
    normalized,
  );
  const asksLogin =
    /\b(?:iniciar|inicio|inicia|inicie|entrar)\s+(?:la\s+)?sesion\b|\b(?:log[ -]?in|loguearme|loguearse)\b/
      .test(normalized);
  if (!asksPassword && !asksLogin) return null;
  return "Para iniciar sesión en esta plataforma usa el correo con el que te registraste y la contraseña que elegiste. Tu Riot ID sirve para vincular tu cuenta de LoL, no para iniciar sesión aquí. No puedo ver ni recuperar tu contraseña ni proporcionarte credenciales de otra cuenta. Si la olvidaste, selecciona «¿Olvidaste tu contraseña?» en la pantalla de inicio de sesión. Si aún no tienes cuenta, puedes registrarte allí.";
}
