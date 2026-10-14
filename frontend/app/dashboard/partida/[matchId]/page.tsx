import { Navbar } from "../../../components/Navbar";
import { LogoutButton } from "../../../components/LogoutButton";
import { MatchDetail } from "../../../components/MatchDetail";
import { AiChatProvider } from "../../../components/AiChatContext";
import { AiChatFab, AiChatWidget } from "../../../components/AiChatWidget";

export default function MatchDetailPage({ params }: { params: { matchId: string } }) {
  return (
    <AiChatProvider>
      <Navbar actions={<LogoutButton />} />
      <main className="flex flex-col items-center px-6 py-12">
        <MatchDetail matchId={params.matchId} />
      </main>
      <AiChatFab />
      <AiChatWidget />
    </AiChatProvider>
  );
}
