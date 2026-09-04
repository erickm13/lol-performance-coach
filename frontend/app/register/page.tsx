import { RegisterForm } from "../components/RegisterForm";
import { AuthShell } from "../components/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
