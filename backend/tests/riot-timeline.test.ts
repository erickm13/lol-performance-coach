import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { countDeathsBefore10, RiotMatchTimeline } from "../src/riot/client.ts";

function timelineWithKills(
  kills: { victimId: number; timestamp: number }[],
): RiotMatchTimeline {
  return {
    info: {
      frames: [
        {
          events: kills.map((k) => ({
            type: "CHAMPION_KILL",
            timestamp: k.timestamp,
            victimId: k.victimId,
          })),
        },
      ],
    },
  };
}

Deno.test("countDeathsBefore10 cuenta solo las muertes del participante antes del minuto 10", () => {
  const timeline = timelineWithKills([
    { victimId: 3, timestamp: 120_000 }, // nuestro jugador, min 2
    { victimId: 3, timestamp: 590_000 }, // nuestro jugador, min ~9.8
    { victimId: 3, timestamp: 650_000 }, // nuestro jugador, pero después del min 10
    { victimId: 7, timestamp: 100_000 }, // otro jugador
  ]);

  assertEquals(countDeathsBefore10(timeline, 3), 2);
});

Deno.test("countDeathsBefore10 devuelve 0 sin muertes antes del minuto 10", () => {
  const timeline = timelineWithKills([{ victimId: 3, timestamp: 700_000 }]);
  assertEquals(countDeathsBefore10(timeline, 3), 0);
});

Deno.test("countDeathsBefore10 ignora eventos que no son CHAMPION_KILL", () => {
  const timeline: RiotMatchTimeline = {
    info: {
      frames: [
        {
          events: [
            { type: "WARD_PLACED", timestamp: 50_000, victimId: 3 },
          ],
        },
      ],
    },
  };
  assertEquals(countDeathsBefore10(timeline, 3), 0);
});
