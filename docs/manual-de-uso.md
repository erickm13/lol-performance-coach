# Manual de uso — LoL Performance Coach

Guía para instalar, levantar y usar la plataforma de análisis de rendimiento y
generación de planes de entrenamiento para League of Legends.

## 1. Requisitos previos

| Herramienta | Versión | Para qué |
|---|---|---|
| Docker + Docker Compose | reciente | Levantar todo (postgres + backend + frontend) |
| Deno | >= 2.0 | Solo si corres el backend fuera de Docker |
| Node.js | >= 20 | Solo si corres el frontend fuera de Docker |

Además necesitas estas credenciales externas:

| Variable | Dónde obtenerla | Obligatoria |
|---|---|---|
| `RIOT_API_KEY` | Portal de desarrolladores de Riot Games (https://developer.riotgames.com) | Sí, para ingesta de partidas |
| `GROQ_API_KEY` | Consola de Groq (https://console.groq.com) | Opcional; preferido para chat y explicación del plan |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/api-keys) | Opcional; preferido para el análisis del mapa |
| `GEMINI_MODEL` | Modelo habilitado en AI Studio; predeterminado `gemini-3.8-flash` | Opcional |
| `RESEND_API_KEY` | Resend (https://resend.com) | Sí, para enviar correos de verificación/reset |
| `JWT_SECRET` | Cadena aleatoria larga que generas tú | Sí, firma las sesiones |

> Con una sola clave se usa ese proveedor para todo. Con ambas, mapa prefiere Gemini y chat/plan prefieren Groq; ante cuota o fallos transitorios del servicio se intenta el otro. Sin claves o si el LLM falla, el plan **igual se genera** en modo solo-reglas.

> En Gemini gratuito, Google puede usar prompts y respuestas para mejorar sus productos; se envían datos de partidas y, según el contexto, nombres de invocadores. Consulta la [privacidad del coach](arquitectura.md#proveedores-del-coach-y-privacidad).

## 2. Configuración

Desde la raíz del repositorio:

```bash
cp .env.example .env
```

Edita `.env` y completa las claves vacías (`GROQ_API_KEY`, `RIOT_API_KEY`,
`JWT_SECRET`, `RESEND_API_KEY`); añade `GEMINI_API_KEY` para habilitar Gemini. Crea una clave nueva en AI Studio y guárdala únicamente en `.env`, sin pegarla en chats ni documentación. Tras cambiar claves o modelo, ejecuta `docker compose up -d --build backend`. Las demás variables ya traen valores válidos
para desarrollo local.

## 3. Levantar el proyecto con Docker (recomendado)

```bash
docker compose up -d --build
```

Esto levanta cuatro servicios: `postgres`, `redis`, `backend` y `frontend`.

- **Frontend:** http://localhost:3000
- **Backend (health check):** http://localhost:8000/health → `{"status":"ok","db":"connected"}`

Para detener todo:

```bash
docker compose down
```

## 4. Levantar sin Docker (desarrollo)

### Backend

```bash
cd backend
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics
deno task db:generate   # genera migraciones desde el schema
deno task db:migrate    # aplica migraciones
deno task dev           # arranca en modo watch
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 5. Recorrido de usuario (flujo completo)

1. **Registro.** Abre http://localhost:3000, ve a *Registrarse* y crea una cuenta con correo y contraseña.
2. **Verificación de correo.** Recibes un correo (vía Resend) con un enlace; al abrirlo se confirma tu cuenta en la pantalla *verify-email*.
3. **Inicio de sesión.** Entra con tus credenciales. La sesión se mantiene con una cookie firmada (JWT).
4. **Vincular cuenta de Riot.** En el dashboard, en la tarjeta de cuenta de Riot, introduce tu Riot ID. Al vincular, el sistema ejecuta la **ingesta inicial** de tus partidas recientes de forma síncrona.
5. **Dashboard.** Verás tus partidas recientes, tu foco de mejora y el siguiente ejercicio pendiente, con el cumplimiento semanal de tus ejercicios. Haz clic en la fila de una partida para abrir su detalle; los iconos mantienen sus tooltips y el botón del coach abre el chat.
6. **Debilidades** (`/dashboard/debilidades`). El resumen muestra partidas disponibles, áreas de mejora y prioridades altas. Los hallazgos aparecen por prioridad: cada tarjeta distingue lo observado en tus partidas del siguiente paso para practicarlo. Despliega «Ver partidas de evidencia» para abrir las partidas que lo sustentan. La muestra contempla las últimas diez partidas guardadas, sin restringir a Solo/Dúo. Se distinguen cuenta sin vincular, muestra insuficiente, ausencia de patrones y error de carga.
7. **Entrenamiento** (`/dashboard/entrenamiento`). Empieza por la tarjeta «Empieza aquí» y pulsa «Empezar ejercicio» para ir a la práctica pendiente. Junto a ella se muestra tu progreso semanal. El objetivo de la semana y las explicaciones del coach se pueden desplegar. Los ejercicios se agrupan por área; «Pendientes» muestra lo que falta y «Todos» incluye lo completado. Genera tu plan desde aquí si aún no tienes uno; las recomendaciones de campeones y el mapa orientativo aparecen después. La ruta antigua `/dashboard/plan` redirige a esta sección.
8. **Marcar progreso.** Completa los ejercicios desde el plan o desde el mapa del ejercicio seleccionado. Los pendientes aparecen primero y puedes ocultar los completados. El porcentaje principal cuenta únicamente ejercicios (`drill`); revisar objetivos o recomendaciones se registra aparte y no aumenta ese porcentaje. Cumplimiento no implica mejora de rendimiento: contrástalo con tus próximas partidas. La confirmación espera a que el servidor guarde el progreso, y los errores permiten reintentar.
9. **Re-sincronizar.** Cuando juegues más partidas, usa *sincronizar* para traer las nuevas y reevaluar debilidades y plan.
10. **Chat de coach (IA).** El widget de chat flotante responde preguntas sobre tu rendimiento, anclado a tus métricas reales.

### Pantallas adicionales

- **Historial** (`/dashboard/historial`): filtros por resultado/cola, paginación y acción **Limpiar filtros**. El resumen incluye victorias/derrotas, porcentaje de victorias, promedio del KDA de cada partida y CS/min promedio de **todo el conjunto filtrado**, incluidas las otras páginas. Si faltan métricas, se indica cuántas partidas sustentan los promedios. Distingue historial sin sincronizar de filtros sin coincidencias. Haz clic en cualquier zona de la fila para abrir el detalle de la partida; también puedes enfocar el enlace del campeón con Tab y abrirlo con Enter. Los iconos mantienen sus tooltips y **Analizar** abre el coach con sus métricas, sin navegar al detalle.
- **Detalle** (`/dashboard/partida/:id`): resultado, objetos y hechizos con tooltips, métricas, equipos y eventos de la partida. El mapa del template usa **rojo** para explicar el error señalado por el coach, **amarillo** para la mejor jugada alternativa sugerida y **azul** para explicar qué hiciste bien. Las flechas enlazan cada error con su alternativa. Con **Todos los eventos** se analiza la partida completa: cada punto recibe una explicación del coach. Los grises son **evaluaciones contextuales**, cuando los datos no permiten calificar la jugada como error o acierto. Durante el análisis aparecen progresivamente los puntos evaluados y el contador muestra el avance; no hay una muestra ni un tope de ocho momentos. Pasa el cursor, enfoca o toca cada punto para ver su tooltip. El mapa es compacto y se amplía suavemente un 10% desde el centro al pasar el cursor, manteniendo el contorno transparente del template. El zoom y las flechas están activos automáticamente. Las flechas tienen un gradiente rojo animado y brillo suave que indica la dirección sugerida; los puntos muestran pulsaciones. Puedes filtrar el análisis, los errores o las buenas jugadas; la lista desplegable permite destacar un evento. La perspectiva del mapa está calibrada con nueve torres. Los eventos indican el lugar de la baja, también para las asistencias; las flechas son alternativas orientativas. Para agrupamiento, el tooltip muestra el aliado de referencia y la antigüedad de su posición cuando existe una instantánea reciente. Los tooltips presentan primero la evaluación del coach; **Datos del momento** permite desplegar los hechos usados. El nombre del coach coincide con el chat, por ejemplo **Coach Gromp**, y el contador escribe el número en palabras. Los consejos se generan con Gemini Flash (Groq como respaldo ante cuota o indisponibilidad temporal, o como único proveedor si falta la clave Gemini) al abrir el mapa, usando también compras, wards, intercambios, objetivos y composición cuando están disponibles, y se reutilizan en visitas posteriores; si falla el coach, se conservan las evaluaciones completadas y puedes usar **Reintentar** para continuar desde ahí. Si se alcanza el límite de uso, el análisis respeta la cuenta regresiva y continúa automáticamente; tras tres reintentos consecutivos sin avance queda pausado hasta que lo reanudes. Cambiar el filtro reutiliza el análisis guardado y prioriza los siguientes eventos relacionados; todos se evalúan antes de marcar la partida como completa. `/dashboard/partida` abre la última partida guardada.
- **Entrenamiento** (`/dashboard/entrenamiento`): objetivo semanal, plan y cumplimiento en una sola pantalla. Selecciona un ejercicio para explorar su zona sugerida en el mapa; puedes completarlo allí mismo. Las zonas son orientativas, no errores observados en partidas.
- **Configuración** (`/dashboard/configuracion`): cambio de contraseña, datos de Riot, desvinculación y eliminación de cuenta. Desvincular elimina historial y planes guardados asociados a Riot, conservando tu acceso. Eliminar cuenta requiere contraseña y escribir **ELIMINAR**. Ambas acciones muestran confirmación y no modifican tu cuenta de Riot Games.
- La navegación principal contiene **Dashboard · Entrenamiento · Debilidades · Historial**; **Mi cuenta** abre Configuración y cerrar sesión. El detalle se abre desde cada partida y mantiene Historial activo. El chat conserva su conversación al navegar. Las secciones nuevas comparten cabeceras, animaciones de entrada al desplazarte y contadores; se respeta movimiento reducido.
- El inicio público (`/`) presenta el recorrido, una captura real del mapa de análisis y enlaces a registro/login. Acceso y Configuración permiten mostrar/ocultar contraseñas; registro y restablecimiento indican el mínimo de ocho caracteres y requieren confirmación. Verificar correo y restablecer contraseña ofrecen acceso al siguiente paso. Recuperación muestra un error de conexión si no se pudo enviar la solicitud; una respuesta aceptada mantiene la confirmación genérica para no revelar si existe el email. Las rutas inexistentes muestran la pantalla 404.

### Explorar el detalle de una partida

- Las secciones y filas aparecen progresivamente al entrar en pantalla. K/D/A, oro, CS, daño y demás estadísticas cuentan desde cero; porcentajes y barras parten de 100 hasta su valor real. La entrada se reproduce una sola vez al desplazarte y los datos nuevos se actualizan sin reiniciar los contadores. Si tu sistema tiene activado movimiento reducido, se muestran directamente los valores finales.
- La navegación **Resumen · Equipos · Mapa** permanece accesible al desplazarte e indica la sección actual.
- **La lectura del coach** muestra un acierto, un error a trabajar (o riesgo a revisar) y una alternativa para aplicar en la próxima partida. Se extraen del mismo análisis de eventos; el estado indica si son hallazgos parciales o si terminó. **Ver momento** abre el mapa y fija el evento correspondiente.
- En el mapa, **Toda la partida**, **Inicio (0–10 min)**, **Medio (10–20 min)** y **Final (20+ min)** filtran el tiempo mostrado. Los contadores indican eventos registrados por tramo. Estos controles no reducen los eventos enviados al coach: el análisis sigue cubriendo toda la partida.
- Pasar el cursor o enfocar un punto permite previsualizar su tooltip. **Seleccionarlo** fija su explicación y destaca el evento, su alternativa y su flecha, atenuando el resto. El panel queda al lado del mapa en escritorio y debajo en móvil. **Anterior/Siguiente** recorre los eventos visibles y **Quitar selección** devuelve la vista general.
- La lista de momentos permanece accesible bajo el mapa, también para seleccionar eventos que coincidan en una misma ubicación. Al cambiar de fase o categoría se limpia la selección para mantenerla dentro del filtro. Los enlaces del resumen restablecen la vista completa para mostrar su evento.

### Aplicar esta actualización a un stack existente

Desde la raíz del repo, con tu `.env` ya configurado:

```bash
docker compose up -d --build backend
```

El backend aplica automáticamente las migraciones pendientes, incluida `0009` para perfil y comunidad, al arrancar. Si usás el frontend con `npm run dev`, recargá la página; si también corre en Docker, reconstruí ese servicio:

```bash
docker compose up -d --build frontend
```

Las partidas antiguas se enriquecen al abrir su detalle, sin borrar ni volver a sincronizar tu historial. Si la clave de Riot expiró, las estadísticas guardadas siguen visibles; renová la clave y reintentá el detalle.

## 6. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `/health` devuelve `db: disconnected` | Postgres no está listo | Espera unos segundos o revisa `docker compose logs postgres` |
| No llegan los correos | Falta o es inválida `RESEND_API_KEY` | Revisa la clave en `.env` |
| El plan no trae explicación en texto | Ningún proveedor disponible/configurado o fallo del LLM | El plan funciona igual en modo solo-reglas; revisa la clave para recuperar la explicación |
| La ingesta falla | `RIOT_API_KEY` vencida (las de desarrollo caducan cada 24 h) o Riot ID inválido | Renueva la clave en el portal de Riot |

## 7. Pruebas

```bash
cd backend && deno task test     # 93 tests
cd frontend && npm test          # 26 tests
```

Ver el detalle en [evidencias-de-pruebas.md](evidencias-de-pruebas.md).


## Perfil, Academia, ranking y preparación manual

- **Mi cuenta → Mi perfil de jugador**: completa o edita líneas, campeones, experiencia, objetivos y tiempo disponible. El registro ya ofrece el formulario por pasos; las cuentas anteriores tienen un recordatorio. Universidad y participación pública son opcionales.
- El coach usa tus preferencias junto con tus propias partidas y el avance del plan. Las cifras y la partida se consultan en el servidor. Un plan semanal ya activo conserva su cumplimiento; los planes nuevos incorporan estas preferencias.
- En **Debilidades**, despliega «Cómo se detectan estos patrones», al final de la página, para ver las referencias internas por rol. Soporte queda fuera del objetivo de CS.
- En **Preparar partida → Desde el cliente · En vivo**, descarga y ejecuta el acompañante en Windows con Node.js 22 o posterior. Introduce la URL de API indicada y el código privado que generas en la web. Deja el programa abierto: la selección y la guía se actualizan automáticamente; si LoL no asignó una línea, elígela en la web. «Simular selección» conserva el formulario manual. Instrucciones y límites en [Cliente en vivo](cliente-en-vivo.md).
- Las palabras enlazadas de los consejos abren la **Academia**, con definición, guías prácticas, ejercicios y recursos originales. Puedes volver al chat sin perder la conversación durante la navegación interna.
- **Ranking** permite consultar la comunidad global o una universidad dentro de la región elegida. Publica solo participantes con consentimiento, correo verificado, Riot vinculado y rango guardado. Usa liga/división/LP oficiales de Solo/Dúo y muestra cuándo se actualizaron. Sincroniza partidas para refrescarlo.
- **Preparar partida** permite elegir rol, tu campeón y los aliados/rivales conocidos de forma manual. Ofrece campeones con razones, runas, hechizos, objetos de inicio, ruta de compras, botas y alternativas con precios/componentes del catálogo actual. Si cambias la selección, regenera la guía. Las plantillas explican opciones por función; ajusta en el cliente tu elección final, fragmentos y coste restante.

Ver [perfil-academia-comunidad.md](perfil-academia-comunidad.md) para fuentes, criterios y actualización del stack. Hace falta reconstruir el backend para aplicar la migración 0009.
