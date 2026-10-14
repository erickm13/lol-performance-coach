import { Navbar } from "../../components/Navbar";
import { LogoutButton } from "../../components/LogoutButton";
import { MatchHistory } from "../../components/MatchHistory";
import { AiChatProvider } from "../../components/AiChatContext";
import { AiChatFab, AiChatWidget } from "../../components/AiChatWidget";

export default function MatchHistoryPage() {
  return (
    <AiChatProvider>
      <Navbar actions={<LogoutButton />} />
      <main className="flex flex-col items-center px-6 py-12">
        <MatchHistory />
      </main>
      <AiChatFab />
      <AiChatWidget />
    </AiChatProvider>
  );
}
