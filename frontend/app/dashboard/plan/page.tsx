import { Navbar } from "../../components/Navbar";
import { LogoutButton } from "../../components/LogoutButton";
import { TrainingPlanView } from "../../components/TrainingPlanView";

export default function TrainingPlanPage() {
  return (
    <>
      <Navbar actions={<LogoutButton />} />
      <main className="flex flex-col items-center px-6 py-12">
        <TrainingPlanView />
      </main>
    </>
  );
}
