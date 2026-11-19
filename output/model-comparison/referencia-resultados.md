# Referencia numérica (no entregar al modelo)

Estos resultados se derivan de `10-partidas.json`. Sirven para comprobar aritmética; no son una respuesta correcta sobre qué prioridad de práctica importa más.

| Métrica | Resultado |
| --- | ---: |
| Partidas | 10 |
| Victorias | 5/10 (50%) |
| Duración media | 29.9 min |
| Kills / deaths / assists medios | 6.1 / 5.1 / 5.6 |
| CS/min medio | 5.41 |
| Visión/min media | 0.506 (0.51 a dos decimales) |
| KP media | 49.1% |
| Muertes antes del minuto 10 | media 1.50; 12 muertes en 8 valores conocidos |
| KDA medio por partida | 3.130 (media aritmética de los 10 KDA) |
| KDA agregado | 2.29 = (61 kills + 56 assists) / 51 deaths |
| Variación de KDA | CV poblacional 0.646; supera 0.60 |

KDA por partida usa `(kills + assists) / max(deaths, 1)`, de acuerdo con el cálculo del backend. El coeficiente de variación usa la desviación estándar poblacional dividida entre la media de esos 10 KDA.

| Referencia interna TOP | Casos bajo el valor | Cobertura |
| --- | ---: | ---: |
| CS/min < 6 | 7 | 7/10 |
| Visión/min < 0.60 | 9 | 9/10 |
| KP < 35% | 0 | 0/10 (un caso está exactamente en 35%) |
| Muertes antes del minuto 10 > 1 | 4 | 4/8 conocidas |

Todos los registros tienen `rol=TOP` y `cola=420`; hay 10 campeones distintos. No hay fecha ni parche. Dos valores de `muertes_antes_10` son desconocidos y se representan como JSON `null` / CSV `NA`.
