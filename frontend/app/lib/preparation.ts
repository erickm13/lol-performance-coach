import { type ChampionSummary } from "./dataDragon";
export type DraftInput = {
  role: string;
  champion: string | null;
  allies: string[];
  enemies: string[];
  bans?: string[];
  availableChampions?: string[];
};
export type PreparationItem = {
  id: string;
  name: string;
  description: string;
  gold: number;
  reason: string;
  components: { id: string; name: string; gold: number }[];
};
export type PreparationRune = {
  id: number;
  name: string;
  icon: string;
  shortDesc: string;
  longDesc: string;
};
export type PreparationSpell = {
  key: string;
  name: string;
  description: string;
  image: { full: string };
  reason?: string;
};
export type PreparationGuide = {
  version: string;
  input: DraftInput;
  chosen: ChampionSummary;
  autoSelected: boolean;
  recommendations: { champion: ChampionSummary; reasons: string[] }[];
  method: string;
  composition: string[];
  starter: PreparationItem[];
  core: PreparationItem[];
  boots: PreparationItem[];
  situational: PreparationItem[];
  runes: {
    primaryTree: { name: string; icon: string } | null;
    primary: PreparationRune[];
    secondaryTree: { name: string; icon: string } | null;
    secondary: PreparationRune[];
    reason: string;
  };
  spells: PreparationSpell[];
  alternatives: PreparationSpell[];
  purchasePlan: string[];
  warnings: string[];
};
