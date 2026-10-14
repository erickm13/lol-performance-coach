import { Navbar } from "../../components/Navbar";
import { LogoutButton } from "../../components/LogoutButton";
import { WeaknessesList } from "../../components/WeaknessesList";

export default function WeaknessesPage() {
  return (
    <>
      <Navbar actions={<LogoutButton />} />
      <main className="flex flex-col items-center px-6 py-12">
        <WeaknessesList />
      </main>
    </>
  );
}
