"use client";
import { type InputHTMLAttributes, useId, useState } from "react";
export function PasswordInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">,
) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <span className="password-control">
      <input {...props} id={id} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </span>
  );
}
