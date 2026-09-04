import { DashboardContent } from "../components/DashboardContent";
import { Navbar } from "../components/Navbar";

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col items-center px-6 py-12">
        <DashboardContent />
      </main>
    </>
  );
}
