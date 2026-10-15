import { LoginForm } from "../components/LoginForm";
import { AuthShell } from "../components/AuthShell";

export default function LoginPage(
  { searchParams }: { searchParams: { deleted?: string } },
) {
  return (
    <AuthShell>
      <LoginForm
        notice={searchParams.deleted === "1"
          ? "Tu cuenta se eliminó correctamente."
          : undefined}
      />
    </AuthShell>
  );
}
