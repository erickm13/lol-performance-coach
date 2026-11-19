# Diff public presentation research factpack

**Task ID:** public-research  
**Problem ID:** diff-public-evidence  
**Evidence checked:** 2026-10-30  
**Source boundary:** first-party product pages, official Riot/Met museum materials, and primary research.

## Historical introduction: evidence and safe framing

There are useful historical parallels in how people record activity and use feedback, but the evidence does not show a continuous lineage leading to Diff.

1. **Administrative records in ancient Uruk, ca. 3100–2900 BCE.** The Met catalogs a proto-cuneiform clay tablet, probably from Uruk, as an administrative account of barley distribution. This is an early example of recording and organizing information. It is an analogy for recordkeeping only: it is not ancient data science, sports coaching, or evidence of a direct lineage to a modern game tool. [Met collection record](https://www.metmuseum.org/art/collection/search/329081)
2. **Movement made visible, 1887.** Eadweard Muybridge's published sequential photographs document human and animal locomotion. They let viewers inspect movement frame by frame; they were not digital sports performance analysis. [Library of Congress catalog](https://www.loc.gov/item/31004968/)
3. **Deliberate practice research, 1993.** Ericsson, Krampe, and Tesch-Römer described structured activities designed to improve performance, with attention to results and feedback. This research can motivate focused practice but does not prove that Diff or any particular product improves performance. A later meta-analysis found that deliberate practice explains some performance differences, with the contribution varying by domain; do not present practice as a complete explanation of expertise. [Ericsson et al.](https://doi.org/10.1037/0033-295X.100.3.363); [Macnamara et al.](https://www.psychologicalscience.org/journals/psychological-science/0956797614535810)
4. **League of Legends, 2009.** Riot's fact sheet identifies League as the company's debut title released in 2009. [Riot Games fact sheet](https://www.riotgames.com/darkroom/original/68b33bf46dda70555c4dec34f6f736e9%3Aea81fb8a0be5cda5bec43af0f43694e2/2024-riot-fact-sheet.pdf)
5. **Game replays and structured data.** Riot's preseason-for-season-2017 page describes replays with an annotated event timeline. Call this “temporada 2017” material; the page title/path alone does not establish a calendar-2017 publication or release date. Riot's current developer docs describe League live-client data such as player scores and game events, plus replay controls. This supports a modern account of game review using structured data; avoid implying that every product has access to every data source. [Riot 2017 season update](https://na.leagueoflegends.com/en/featured/preseason-2017/replays-and-practice); [Riot LoL developer docs](https://developer.riotgames.com/docs/lol); [Riot API reference](https://developer.riotgames.com/apis#match-v5)

## Glossary source check

Riot's official [League of Legends How to Play](https://www.leagueoflegends.com/en-us/how-to-play/) guide supports a beginner description of the standard five-versus-five team format, the enemy Nexus as the win objective, and the five recommended positions (top, jungle, mid, bot, support). It discusses minions, experience, and gold at a high level. It does **not** textually define CS, CS/min, wards, or Control Wards; do not attribute detailed definitions of those terms to this guide. Riot's older [2017 Season Update: Assassins](https://oce.leagueoflegends.com/en/featured/preseason-2017/assassins) explains the conceptual distinction between camouflage and invisibility and says Control Wards do not reveal invisible champions. Use it for that terminology caveat only, not current item stats or patch details.

Three precision checks for glossary wording:

- Keep **CS total** distinct from **CS/min**. The generated document override defines CS as a total; the current Academy source aliases CS with “cs por minuto” and defines it per minute, which conflates the two. [Academy source](../../../frontend/app/lib/academyTerms.ts); [document generator override](../document/generate_document.py).
- Avoid saying a Control Ward reveals all stealth or is literally permanent. Define its ward/trap vision and disabling behavior narrowly; it does not reveal every invisible champion.
- Treat **ADC** as a community name for a bot-lane carry role, not as a champion class. Marksman champions and the bot-carry role are related conventions, not identical categories.

**Possible intro wording:** “People have long used records to make activity easier to inspect: ancient administrative tablets recorded distributions of goods, and later photography made movement visible frame by frame. Modern performance research examines how structured practice and feedback relate to skill. In League of Legends, replays and game data make match events reviewable. Diff is a prototype that aims to connect reviewing recent matches with selecting and tracking a practice goal. These are historical parallels, not a direct line of development, and they do not establish that Diff improves rank or win rate.”

## Competitor comparison

Status labels mean **Documentado** = stated in the cited product material; **No verificado** = not verified in the sources consulted, not a claim that the feature is absent; **Prototipo** = reported in the supplied Diff brief, not independently verified. Diff features are not production claims.

| Product | Personal match review | Builds/meta | Live preparation/overlay | Learning content | Practice/progress | Map/timeline review |
|---|---|---|---|---|---|---|
| OP.GG | **Documentado:** match analysis, VOD, player statistics. [Match detail help](https://help.op.gg/hc/en-us/articles/31091817743129-Viewing-detailed-match-data) | **Documentado:** champion-analysis pick-rate setup and build data. [App help](https://help.op.gg/hc/en-us/articles/48467238743961-Getting-Started-with-the-OP.GG-App) | **Documentado:** overlay with builds, opponent data, and spell timers. [App help](https://help.op.gg/hc/en-us/articles/48467238743961-Getting-Started-with-the-OP.GG-App) | **No verificado** in sources consulted. | **No verificado** in sources consulted. | **Documentado:** heatmap and gold/XP/objective timelines. [Match detail help](https://help.op.gg/hc/en-us/articles/31091817743129-Viewing-detailed-match-data) |
| Mobalytics | **Documentado:** GPI identifies performance strengths/weaknesses across skills. [GPI](https://mobalytics.gg/gpi/) | **Documentado:** recommended builds based on win rate/popularity. [App guide](https://mobalytics.gg/lol/guides/mobalytics-beginners-guide) | **Documentado:** pre-game companion and in-game overlay. [App guide](https://mobalytics.gg/lol/guides/mobalytics-beginners-guide) | **Documentado:** LoL guides and skill articles. [Guides](https://mobalytics.gg/lol/guides) | **Documentado in product materials:** skill Challenges and multi-game goals; present availability is uncertain because the product page lists Challenges while the 2026-updated app guide also retains “coming soon” wording. [GPI/Challenges](https://mobalytics.gg/lol/lp/gpi); [Challenge dev blog](https://mobalytics.gg/blog/dev-blog-mobalytics-challenges/); [App guide](https://mobalytics.gg/lol/guides/mobalytics-beginners-guide) | **No verificado** in sources consulted. |
| Blitz | **Current LoL-specific workflow not verified.** The current homepage generally claims personalized stats; its LoL page returned no readable feature content. [Blitz homepage](https://blitz.gg/); [LoL page](https://blitz.gg/lol) | **Current LoL-specific workflow not verified.** Homepage generally claims meta insights. [Blitz homepage](https://blitz.gg/) | **Current LoL-specific workflow not verified.** Homepage generally claims overlays; it lists League of Legends as a supported game. [Blitz homepage](https://blitz.gg/) | **No verified LoL learning library** in current sources consulted. | **No current multi-game practice plan/progress system verified.** | **No current LoL map/timeline workflow verified.** |
| Diff | **Prototipo según brief:** imports recent 10 matches. | **No informado** in brief; do not add build/meta claims. | **Prototipo según brief:** preparation and ranking. | **Prototipo según brief:** Academy and internal role practice references. | **Prototipo según brief:** rule-selected weekly plan, LLM explanation, and checklist. | **Prototipo según brief:** AI-assisted map/timeline review. |

## Positioning and implementation limits

- Do not claim Diff is the first personal LoL coach or that competitors provide only raw statistics. OP.GG documents map/timeline review, and Mobalytics documents personal insights and a Challenges system.
- A supportable product hypothesis is that Diff aims to connect recent-match review with a Spanish-language practice workflow. Do not claim this integration is unique without a broader product review.
- Per-role isolated 10-match blocks and Bedrock are **not implemented**, per the supplied brief. Label current product surfaces as prototype where applicable.
- Blitz evidence is materially weaker than OP.GG/Mobalytics evidence: the accessible current homepage makes broad claims for the overall product and lists League as supported, but does not substantiate individual LoL workflows. The legacy [ads.blitz.gg page](https://ads.blitz.gg/) is indexed as a 5.6-year-old capture and says “Blitz Pro is coming soon”; exclude it as evidence of current feature availability.
- Product features and Riot documentation can change. This factpack records pages checked on 2026-10-30 and does not assert test results, prices, benchmarks, or causal effects.

## Source register

| ID | Title | URL | Access date |
|---|---|---|---|
| met_uruk_tablet | Proto-Cuneiform tablet with seal impressions: administrative account of barley distribution | https://www.metmuseum.org/art/collection/search/329081 | 2026-10-30 |
| loc_muybridge | Animal locomotion: An electro-photographic investigation of consecutive phases of animal movements | https://www.loc.gov/item/31004968/ | 2026-10-30 |
| ericsson_1993 | The role of deliberate practice in the acquisition of expert performance | https://doi.org/10.1037/0033-295X.100.3.363 | 2026-10-30 |
| macnamara_2014 | Deliberate Practice and Performance in Music, Games, Sports, Education, and Professions: A Meta-Analysis | https://www.psychologicalscience.org/journals/psychological-science/0956797614535810/ | 2026-10-30 |
| riot_fact_sheet | Riot Games 2024 fact sheet | https://www.riotgames.com/darkroom/original/68b33bf46dda70555c4dec34f6f736e9%3Aea81fb8a0be5cda5bec43af0f43694e2/2024-riot-fact-sheet.pdf | 2026-10-30 |
| riot_replays | 2017 Season Update: Replays and Practice | https://na.leagueoflegends.com/en/featured/preseason-2017/replays-and-practice | 2026-10-30 |
| riot_lol_docs | Riot Developer Portal: League of Legends documentation | https://developer.riotgames.com/docs/lol | 2026-10-30 |
| riot_api_ref | Riot Developer Portal API reference | https://developer.riotgames.com/apis#match-v5 | 2026-10-30 |
| riot_how_to_play | League of Legends How to Play | https://www.leagueoflegends.com/en-us/how-to-play/ | 2026-10-30 |
| riot_stealth_update | 2017 Season Update: Assassins | https://oce.leagueoflegends.com/en/featured/preseason-2017/assassins | 2026-10-30 |
| opgg_match | Viewing detailed match data | https://help.op.gg/hc/en-us/articles/31091817743129-Viewing-detailed-match-data | 2026-10-30 |
| opgg_app | Getting Started with the OP.GG App | https://help.op.gg/hc/en-us/articles/48467238743961-Getting-Started-with-the-OP.GG-App | 2026-10-30 |
| mobalytics_gpi | Gamer Performance Index Explained | https://mobalytics.gg/gpi/ | 2026-10-30 |
| mobalytics_app | The Ultimate Mobalytics Guide for League of Legends | https://mobalytics.gg/lol/guides/mobalytics-beginners-guide | 2026-10-30 |
| mobalytics_guides | League of Legends Guides | https://mobalytics.gg/lol/guides | 2026-10-30 |
| mobalytics_challenges_page | GPI / Challenges product page | https://mobalytics.gg/lol/lp/gpi | 2026-10-30 |
| mobalytics_challenges_blog | Dev Blog: Mobalytics Challenges, A New Way To Improve Your League Skills | https://mobalytics.gg/blog/dev-blog-mobalytics-challenges/ | 2026-10-30 |
| blitz_home | Blitz.gg homepage | https://blitz.gg/ | 2026-10-30 |
| blitz_lol | Blitz League of Legends page; no readable feature text returned | https://blitz.gg/lol | 2026-10-30 |
| blitz_legacy_ads | Legacy Blitz landing page; indexed capture is stale | https://ads.blitz.gg/ | 2026-10-30 |
