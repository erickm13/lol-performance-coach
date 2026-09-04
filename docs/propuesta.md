# Propuesta de Proyecto — Seminario Profesional 2

## 1. Título

Plataforma web inteligente para el análisis de rendimiento y la generación de planes de entrenamiento personalizados en League of Legends, mediante integración con la API oficial de Riot Games y un motor híbrido de reglas + modelo de lenguaje (LLM).

## 2. Planteamiento del problema

League of Legends genera un volumen elevado de datos por partida (estadísticas de combate, visión, objetivos, trayectoria de ranking, entre otros). El jugador promedio dispone de historiales y de sitios de builds agregadas, pero carece de un sistema que traduzca su propio desempeño en un plan de mejora medible, priorizado y con seguimiento en el tiempo.

Las herramientas actuales (OP.GG, U.GG, Blitz, Mobalytics, entre otras) suelen presentar las siguientes limitaciones:

- Mostrar métricas genéricas o builds del meta sin personalización profunda.
- No detectar debilidades recurrentes del individuo a lo largo de múltiples partidas.
- No cerrar el ciclo diagnóstico → plan → práctica → reevaluación.

Como consecuencia, el entrenamiento tiende a ser ineficiente, se produce estancamiento en el nivel de juego (elo) y se genera dependencia de contenido genérico no adaptado al perfil del usuario.

## 3. Justificación

El proyecto es pertinente para la ingeniería de sistemas porque integra: consumo y gobernanza de una API externa (límites, caché y reintentos), modelado de datos de partidas y métricas históricas, procesamiento asíncrono (ingesta y análisis en background), indicadores estadísticos de rendimiento, un motor de recomendación híbrido (reglas + LLM con grounding en métricas, evitando alucinaciones), una aplicación web full-stack desplegable en la nube, y un análisis formal de riesgos (términos de servicio, privacidad, sesgos y cambios de parche).

El dominio de esports constituye un caso real de sistema de soporte a la decisión basado en datos, con la ventaja de que la API oficial de Riot Games da acceso estructurado y legítimo a los datos necesarios.

## 4. Objetivos

### Objetivo general

Diseñar, implementar y evaluar una plataforma web que analice el historial de partidas de un jugador de League of Legends y genere planes de entrenamiento personalizados, medibles y explicables.

### Objetivos específicos

1. Integrar la obtención de datos de partidas y perfil mediante la API oficial de Riot Games, respetando límites de tasa y buenas prácticas.
2. Definir e implementar un modelo de métricas de rendimiento (por rol y por fase de juego, dentro del alcance definido).
3. Construir un motor de detección de debilidades recurrentes basado en reglas, y un componente de generación de recomendaciones explicadas mediante un modelo de lenguaje (Claude), ancladas a las métricas calculadas.
4. Desarrollar un frontend de dashboard con historial, tendencias y plan semanal de entrenamiento.
5. Desplegar la solución en un entorno cloud con autenticación, persistencia, registros (logs) y documentación de arquitectura.
6. Evaluar la utilidad del sistema mediante pruebas técnicas y un protocolo de validación con usuarios piloto (muestra reducida).

## 5. Alcance y limitaciones

### Incluye

- Registro e inicio de sesión, y vinculación de cuenta de juego según los mecanismos permitidos por Riot.
- Ingesta de N partidas recientes de **League of Legends** (ventana configurable).
- Cálculo de métricas y almacenamiento histórico.
- Detección de debilidades mediante un **motor de reglas**, y generación del plan de entrenamiento con **explicaciones generadas por un LLM (Claude)**, citando siempre las métricas que las sustentan.
- Dashboard web responsive.
- API backend, base de datos, trabajos de ingesta/análisis, contenedores y CI básico.
- Documento técnico: arquitectura, riesgos, manual de uso y evidencias de pruebas.

### No incluye (limitaciones de esta entrega)

- Soporte a otros juegos (VALORANT, TFT u otros) — la arquitectura se diseña con capacidad de extensión, pero **no se implementa** en este curso.
- Un motor de recomendación basado en un modelo de Machine Learning entrenado por el equipo (ej. XGBoost/Random Forest) — el motor de recomendación de esta entrega es reglas + LLM, no una comparación de tres motores.
- Overlay dentro del cliente de juego.
- Análisis frame a frame de replays de video.
- Cobertura de todos los roles y todos los campeones.
- Garantía de subida de elo (el sistema recomienda; no asegura resultado competitivo).
- Uso comercial masivo ni operación SaaS a gran escala.

**Acotación de alcance:** uno o dos roles y un conjunto limitado de campeones, o exclusivamente la cola Ranked Solo/Duo (a definir con el equipo antes de iniciar el desarrollo).

## 6. Estado del arte y competidores

| Solución | Enfoque | Brecha que aborda el proyecto |
|---|---|---|
| OP.GG, U.GG, Blitz, Porofessor, Mobalytics | Estadísticas, builds y overlays | Poco plan de entrenamiento personal con seguimiento de progreso |
| Contenido educativo y coaches | Pedagogía humana | No automatiza el diagnóstico continuo del historial del usuario |
| Cliente e historial de Riot | Datos oficiales | No ofrece un coach personalizado de producto |

## 7. Propuesta de solución

1. El usuario se autentica y vincula su cuenta de League of Legends.
2. El sistema descarga y normaliza las partidas recientes.
3. Un motor de análisis calcula indicadores clave de desempeño (KPI) y detecta patrones mediante reglas (muertes tempranas, CS bajo, visión, consistencia, entre otros).
4. Se genera un plan semanal (focos de mejora, drills y campeones a priorizar o limitar). Claude recibe las métricas y debilidades detectadas de forma estructurada y redacta la explicación en lenguaje natural, citando siempre el dato que la sustenta — el modelo explica, no decide qué está mal.
5. El usuario registra el cumplimiento; el sistema reevalúa en la siguiente ventana de partidas.

## 8. Arquitectura lógica propuesta

- **Frontend:** React + Next.js.
- **Backend API:** REST en TypeScript sobre **Deno**.
- **Workers:** cola de trabajos (Redis) para ingesta y cálculo de métricas.
- **Datos:** PostgreSQL (usuarios, partidas, métricas, planes) y caché en Redis.
- **IA (controlada):** Claude (Sonnet por defecto) para la explicación del plan, con prompts restringidos y grounding obligatorio en las métricas calculadas — sin margen para afirmar causas no verificables.
- **Nube:** contenedores Docker, reverse proxy, variables de entorno y CI (GitHub Actions).
- **Observabilidad:** logs estructurados básicos de trabajos y errores de la API de Riot.

El detalle del modelo de datos, diagrama de arquitectura y endpoints está en [arquitectura.md](arquitectura.md).

## 9. Análisis de riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Límites de tasa y cambios de la API de Riot | Alto | Caché, backoff, ventanas de ingesta configurables |
| Términos de servicio y políticas de desarrollador | Alto | Cumplir políticas oficiales; evitar scraping indebido |
| Parches que invalidan heurísticas del meta | Medio | Versionar las reglas por parche; alcance acotado |
| Alucinaciones del LLM | Medio | Grounding obligatorio en métricas; modo solo-reglas como respaldo si el LLM falla |
| Sesgo de muestra de partidas | Medio | Mínimo de partidas por análisis e intervalos de confianza simples |
| Inflación del alcance | Alto | MVP acotado por rol/campeón; backlog priorizado; multi-juego y motor ML propio quedan explícitamente fuera de esta entrega |

## 10. Mejoras futuras

Estas líneas se identificaron durante la revisión de la propuesta como extensiones de valor, pero **quedan fuera del alcance de esta entrega** (posible continuación en una tesis):

- Extender la arquitectura a otros juegos con API oficial de Riot (VALORANT, TFT) mediante un patrón de adaptadores sobre un modelo de datos común.
- Incorporar un motor de recomendación basado en un modelo de ML propio (ej. XGBoost/Random Forest) y comparar objetivamente reglas vs. ML propio vs. LLM (precisión, explicabilidad, personalización, consistencia, costo, latencia).
- Registro del setup del jugador (mouse, DPI, monitor, sensibilidad) con detección de eventos de cambio y comparación de métricas antes/después, sin afirmar causalidad.
- Experimentos controlados por el propio jugador (ej. comparar configuraciones A/B con análisis estadístico de significancia).
- Separación de rendimiento individual vs. rendimiento de equipo, y comparación contra cohortes de jugadores similares.
- Análisis de rendimiento por horario del día y posición en la sesión de juego.
- Overlay in-game, aplicación móvil e integración con revisión de VODs.
