import { MatchDetailView } from "../../../components/MatchDetailView";
export default function MatchPage({ params }: { params: { matchId: string } }) {
  return <MatchDetailView matchId={params.matchId} />;
}
