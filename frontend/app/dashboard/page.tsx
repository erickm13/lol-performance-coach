import { DashboardContent } from "../components/DashboardContent";
import { Navbar } from "../components/Navbar";
import { LogoutButton } from "../components/LogoutButton";

export default function DashboardPage() {
  return (
    <>
      <Navbar actions={<LogoutButton />} />
      <main className="flex flex-col items-center px-6 py-12">
        <DashboardContent />
      </main>
    </>
  );
}
