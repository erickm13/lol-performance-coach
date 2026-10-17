# Preparar partida desde el cliente de LoL

## Cómo funciona

Un acompañante ejecutado en Windows lee la selección mediante la League Client API (LCU). Envía una selección reducida a la plataforma y la pantalla **Preparar partida → Desde el cliente · En vivo** actualiza la guía. El navegador consulta el backend; no intenta acceder al puerto local de LoL, por lo que el flujo también admite una web desplegada con HTTPS.

El acompañante utiliza Node.js 22 o posterior y módulos incluidos en Node. No requiere paquetes adicionales. Descubre el proceso `LeagueClientUx.exe` mediante PowerShell/CIM y utiliza su puerto y credencial local únicamente para llamadas GET a `127.0.0.1`. No se modifica el cliente ni se realizan elecciones o importaciones automáticas de runas.

## Activar en el servidor

```bash
docker compose up -d --build backend
```

El arranque aplica **0010_live_draft_connection**, después de la migración de perfil 0009. Crea una conexión por cuenta con clave SHA-256, caducidad, última recepción y selección reducida; el borrado de usuario elimina la conexión en cascada. Si el frontend utiliza Docker, reconstruir también `frontend`; en desarrollo, recargar la página.

## Conectar desde Windows

1. Abrir LoL y la web desde Windows. Instalar Node.js 22 o posterior si aún no está disponible.
2. En **Preparar partida**, descargar el acompañante. En una terminal situada en la carpeta descargada:

   ```powershell
   node coach-companion.mjs
   ```

3. Introducir la URL de API que muestra la pantalla. Es la URL del backend, no la de Next.js. Para un servidor remoto se exige HTTPS; HTTP se admite solamente para `localhost` y `127.0.0.1`.
4. En la web, generar un código y pegarlo en el acompañante. No es la contraseña de Riot ni una API key. Es una clave privada de conexión válida durante doce horas; se conserva solo en memoria del programa y del formulario. Si se cierra el programa, puede reutilizarse mientras siga vigente o generarse otra.
5. Dejar el acompañante abierto y entrar a selección. La web distingue cliente cerrado, sala, búsqueda, selección y partida iniciada. Si no hay rol asignado, elegirlo una vez en la página.

Generar otro código revoca el anterior. **Desconectar** elimina la conexión; un acompañante revocado o caducado se detiene al recibir 401. La sesión normal de la web sigue siendo necesaria para consultar la selección y generar la guía.

## Datos y actualización

- GET locales: `/lol-gameflow/v1/gameflow-phase`, `/lol-gameflow/v1/session`, `/lol-champ-select/v1/session`, `/lol-champ-select/v1/pickable-champion-ids` y `/lol-summoner/v1/current-summoner`.
- Se transmiten estado, identificador efímero de draft, mapa/cola/modo, posición propia, campeones y roles aliados visibles, rivales confirmados y su posición asignada cuando LCU la informa, bloqueos y campeones disponibles. Para comprobar la cuenta, el acompañante calcula localmente SHA-256 del PUUID actual y envía solo esa huella; el servidor la compara con la cuenta vinculada y guarda el estado de coincidencia, nunca el PUUID del usuario ni la huella recibida. Si LCU proporciona PUUIDs de aliados visibles, el acompañante los envía transitoriamente para consultar su liga Solo/Dúo con Riot; no se guardan ni se registran, y el snapshot conserva únicamente las ligas obtenidas. El filtro usa la liga más alta entre la cuenta vinculada y los aliados consultables. No se envían nombres, chat, credenciales locales ni respuestas completas de LCU.
- La página informa si las cuentas coinciden, son distintas, no hay cuenta vinculada o no se pudo verificar. La discrepancia no bloquea el draft; advierte que la personalización basada en el historial puede corresponder a otra cuenta.
- Los rivales solo se leen para las colas con draft público 400, 420 y 440 y con acción de elección completada. En otras colas no se envían rivales. Nunca se transmiten sus intenciones ni identidades ocultas.
- Lectura local aproximadamente cada 1,5 s, envío al cambiar o como latido cada 5 s, consulta web cada 2 s (8 s si está oculta o hay error). Tras 20 s sin recepción se muestra desconectado. Todas las solicitudes son consecutivas; tienen tiempo límite.
- Los IDs numéricos del cliente se traducen mediante `key` de Data Dragon. Un campeón seleccionado desconocido en el catálogo impide generar una guía incompleta. La preparación automática se limita a mapa 11 / modo CLASSIC; las selecciones con campeones duplicados no se admiten.
- El generador excluye bloqueados, campeones ya elegidos por otros jugadores y opciones no disponibles cuando existe esa lista. Las elecciones confirmadas ajustan recomendaciones de composición, objetos situacionales, la segunda runa contra varias amenazas de entrada y Purificación para tirador ante varias amenazas de control conocidas. Sigue siendo una guía de reglas revisadas, sin tasas de victoria inventadas ni llamadas a Groq.
- La tabla de orden de habilidades agrega eventos `SKILL_LEVEL_UP` de Match-V5 de hasta 500 partidas clasificatorias Solo/Flex recientes que la aplicación ya tiene guardadas, limitado al campeón, línea y parche actual. Requiere 15 niveles observables; muestra el orden de 15 niveles más repetido, el tamaño de muestra y aclara que no representa todas las partidas ni es una estadística global de meta. Si no hay muestra, la pantalla no inventa un orden. Data Dragon entrega iconos/nombres/descripciones de Q-W-E-R. La respuesta nunca incluye participantes, Riot IDs ni PUUIDs.
- El campeón propio sin confirmar produce una guía provisional; aliados y rivales solo influyen cuando están confirmados. Un cambio relevante cancela la respuesta anterior y recalcula tras 600 ms. No hace scroll automático durante el draft.
- La línea asignada por el cliente se muestra como confirmación; si LCU no la informa, la página permite elegirla manualmente.
- La preparación consulta primero la línea asignada al jugador y busca entre los picks rivales confirmados un rival de esa misma línea. Si LCU también informa su posición, consulta la página de enfrentamiento de LoLalytics (campeón propio contra rival, en ambas líneas); si falta la posición o hay más de un candidato, usa la build general del campeón propio y su línea. Si la página de enfrentamiento no se puede validar, intenta la build general como respaldo. El encabezado identifica el rival cuando los datos realmente provienen de esa página.
- Las identidades aliadas ocultas o sin PUUID disponible no se pueden consultar; en ese caso no elevan el filtro. El acceso a Riot falla de forma tolerante y la guía conserva el rango más alto que sí se pudo verificar.
- Cada nuevo draft descarta la guía anterior. Fuera de selección o si se pierde la conexión, la última guía visible se identifica como histórica. «Simular selección» permite una preparación manual independiente.

## Contratos de la plataforma

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/preparation/live/companion` | Descarga pública del código sin credenciales |
| POST | `/preparation/live/connect` | Sesión del usuario; genera/reemplaza clave |
| POST | `/preparation/live/disconnect` | Sesión del usuario; revoca conexión |
| GET | `/preparation/live/status` | Sesión del usuario; solo su selección |
| POST | `/preparation/live/snapshot` | Clave Bearer del acompañante; no utiliza cookies |

Las rutas de dispositivo se montan antes del middleware de sesión de `/preparation`. El servidor valida y reduce nuevamente la selección antes de guardarla; nunca devuelve la clave almacenada. La clave solo permite publicar selecciones durante su vigencia, no consultar datos de la cuenta. Las respuestas llevan `Cache-Control: no-store`.

## Compatibilidad y revisión pendiente

Riot explica que la [LCU es local y no tiene soporte oficial para terceros](https://developer.riotgames.com/docs/lol#league-client-api); sus endpoints y estructuras pueden cambiar. El uso de estos endpoints debe indicarse en la aplicación del Developer Portal. Se respetan las [políticas de integridad](https://developer.riotgames.com/docs/lol#game-integrity), incluida la prohibición de identificar jugadores deliberadamente ocultos. Esta implementación no equivale a una aprobación de Riot.

El usuario comprobó que el acompañante conecta con el cliente y captura las elecciones. Tras añadir huella de cuenta y ajustes situacionales de runas/hechizos, queda pendiente volver a descargar el acompañante y comprobar coincidencia/no coincidencia de cuenta, rol asignado, control/entradas enemigas y pérdida de conexión. La huella sirve como aviso ante cuentas distintas; no es autenticación de Riot. No se ha distribuido un ejecutable de Windows; el archivo descargable requiere Node.js.
