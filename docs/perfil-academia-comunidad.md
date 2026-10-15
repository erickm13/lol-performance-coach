# Perfil, Academia y comunidad

Incremento del 15 de octubre de 2026. Implementa las seis mejoras autorizadas: perfil inicial editable, contexto del coach, reglas por rol, Academia con recursos, comunidad/ranking y preparación manual.

## Recorrido

1. **Registro / Mi cuenta → Mi perfil de jugador**: tres pasos para línea principal/secundaria, campeones habituales, experiencia percibida, áreas y líneas de mejora, minutos semanales y universidad opcional. Se puede guardar un perfil parcial; el recordatorio desaparece al completar línea principal, experiencia y un objetivo. El rango sigue viniendo de Riot. Las preferencias y el usuario se crean en una transacción.
2. **Coach**: el servidor lee la cuenta autenticada y sus datos guardados. El chat recibe las últimas diez partidas, métricas con rol/muestra, debilidades, plan con cumplimiento y, cuando corresponde, una partida cuya propiedad verifica por UUID. Hasta ocho mensajes anteriores mantienen continuidad, sin convertirse en hechos verificados. El cliente ya no determina las estadísticas del análisis. Los errores del proveedor se presentan como errores recuperables.
3. **Debilidades**: referencias internas por rol, visibles en «Cómo se detectan estos patrones» al final de la página. Soporte queda fuera del análisis de farming. La variabilidad del KDA compara grupos del mismo rol de al menos tres partidas. La participación en kills orienta el juego en equipo; no se afirma que mida participación en dragones o torres. Se mantiene la ventana de diez partidas con métricas. Las filas sin rol se identifican como referencia general.
4. **Academia**: conserva los 73 términos y sus IDs del catálogo inicial `academyTerms.ts`, más guías de visión, posicionamiento y compras. Trece guías desarrolladas incluyen explicación, pasos, errores, ejercicio y recursos; los demás términos tienen definición, alias, pauta de revisión y enlaces a guías/recursos relacionados. Los términos reconocidos en chat, mapa, resumen, debilidades y plan son enlaces de React; se mantienen acentos y límites de palabra. Al salir del chat hacia una lección, se minimiza y conserva la conversación durante la navegación interna.
5. **Ranking**: participación desactivada por defecto. Solo aparecen participantes que optaron por publicar su Riot ID/rango/universidad, con correo verificado y rango guardado. «Global» agrupa a los participantes de la plataforma dentro de la región seleccionada. Universidad es una afiliación declarada, con nombres conocidos normalizados y opción libre. Orden: liga, división, LP y desempate por Riot ID; veinte resultados por página. La cola es explícitamente Solo/Dúo; no se mezclan colas. Se muestran cifras sincronizadas y su fecha, sin llamadas adicionales a Riot para listar el ranking. Una sincronización renueva el rango. Correo, objetivos y experiencia permanecen privados.
6. **Preparar partida**: el modo principal ahora conecta la selección del cliente de LoL en Windows mediante un acompañante local. Refleja equipos, estados y bloqueos y recalcula la guía al cambiar las elecciones; las intenciones propias se identifican como provisionales. «Simular selección» conserva la entrada manual. Propone opciones de un grupo de campeones revisado por línea, priorizando familiaridad declarada y partidas guardadas, con razones de composición. La guía incluye runas, hechizos, inicio, secuencia base, botas, opciones situacionales y componentes/precios. Ver instalación, contratos, alcance y comprobaciones pendientes en [Cliente en vivo](cliente-en-vivo.md).

## Datos y rutas

La migración **0009** crea `player_profiles` (uno por usuario, con borrado en cascada), `riot_accounts.analysis_version` y `riot_accounts.rank_updated_at`. Desvincular Riot conserva las preferencias del jugador; eliminar el usuario las elimina. No hay migraciones destructivas ni borrado de historial para activar estas pantallas.

| Método | Ruta | Función |
|---|---|---|
| GET / PUT | `/player/profile` | Leer o guardar preferencias propias |
| GET | `/player/ranking?region=LAN&university=all&page=1` | Participantes públicos por región/universidad |
| GET | `/preparation/catalog` | Versión y campeones para selección manual |
| POST | `/preparation/guide` | Guía por rol y composiciones elegidas |
| POST | `/auth/register` | Acepta `playerProfile` opcional, conserva compatibilidad con email/contraseña |
| POST | `/ai/chat` | `context`, `message`, `matchId` opcional e `history` acotado |

Las nuevas rutas de API requieren sesión. Las pantallas están en `/dashboard/perfil`, `/dashboard/academia`, `/dashboard/academia/:slug`, `/dashboard/ranking` y `/dashboard/preparar`. La navegación principal y el menú de cuenta las enlazan.

Los planes semanales nuevos consideran preferencias para desempatar debilidades de igual prioridad y proponen ejercicios acotados al tiempo declarado. El ejercicio de farming distingue jungla. Las explicaciones se adaptan al perfil incluso en la generación; el plan activo y su cumplimiento se conservan. El mapa incluye preferencias compactas y cambia a caché **v5**, con revisión de preferencias: al cambiarlas regenera la explicación, manteniendo todos los eventos, lotes y calibración existentes. Cambiar solo universidad o visibilidad no invalida el análisis del mapa.

Las preguntas comunes de inicio de sesión y contraseña reciben ayuda fija desde `coaching/accountHelp.ts`, después de autenticar y sin llamar a Groq: acceso con correo y contraseña elegida, Riot ID solo para vincular LoL, recuperación mediante el formulario correspondiente. No se proporcionan credenciales. El prompt del coach contiene los mismos hechos y pide corregir respuestas previas incorrectas. Esta ayuda sigue disponible aunque el proveedor limite las consultas de coaching con HTTP 429.

## Criterios y fuentes

- Las referencias por rol se definen en `backend/src/analysis/weaknesses.ts` (`role-practice-v1`): **criterios internos de práctica**, sin atribuirles percentiles de rango o validación profesional.
- La preparación es determinista y no consume Groq. Data Dragon se consulta desde el backend con tiempo límite y caché compartida de una hora. Se valida disponibilidad de objetos comprables en la Grieta, ramas y posiciones de runas y hechizos del modo clásico. Si una plantilla pierde una opción, se informa; no se inventan objetos. Algunas sustituciones de runas están revisadas y solo se usan si existen en la misma posición. No se importa automáticamente una página al cliente; se revisan los fragmentos allí.
- Las etiquetas de clase de campeones son aproximaciones para sugerir opciones; no permiten concluir el daño exacto de una composición ni el resultado de un enfrentamiento. Las rutas son plantillas generales por función con excepciones para recursos/campeones, **no builds óptimas demostradas ni estadísticas de meta**. Es posible seleccionar manualmente combinaciones fuera del grupo revisado; la pantalla lo indica.
- Catálogos y recursos se renderizan como texto/componentes, sin insertar HTML de Riot ni aceptar enlaces inventados por el modelo. Los videos de YouTube tienen tarjetas con miniatura y reproductor integrado, cargado al pulsar «Reproducir aquí». Solo hay un reproductor activo por sección y se respeta el minuto del capítulo enlazado; permite controles nativos, pantalla completa y cierre con retorno de foco. Conserva enlace al original si la reproducción integrada no está disponible. Cursos y lecturas enlazan a su proveedor. Los recursos antiguos se etiquetan como fundamentos, con fecha cuando está confirmada. CoreJJ se identifica como profesional; los demás autores conservan su atribución de creador/organización.
- [Data Dragon de Riot](https://developer.riotgames.com/docs/lol#data-dragon): campeones, objetos, runas y hechizos versionados.
- [Políticas de integridad de Riot](https://developer.riotgames.com/policies/general#game-integrity): usar el rango oficial, sin crear un MMR alternativo.
- [Skill Capped: control de oleadas](https://www.youtube.com/watch?v=p9ZUxaCpvjc): capítulos a 1:24, 3:46 y 12:17 para los tres tipos de manejo.
- [Skill Capped: ganking](https://www.youtube.com/watch?v=RoY-ddiKoxk).
- [Zadarkus: ataque y movimiento](https://www.youtube.com/watch?v=ASpfEUAnQyQ).
- [Curso de CoreJJ en Aimlabs](https://aimlabs.com/courses/7IeultcsJG4RYIS6L8tPtc): visión, línea y roaming; puede requerir registro/pago.
- [Dignitas: fundamentos de práctica](https://dignitas.gg/articles/the-fundamentals-for-improving-at-league-of-legends-as-an-average-player).

## Aplicar al stack existente

Desde la raíz, con el `.env` local configurado:

```bash
docker compose up -d --build backend
```

El arranque aplica la migración 0009 automáticamente. Si el frontend corre en modo desarrollo, recarga la página. Si corre en Docker:

```bash
docker compose up -d --build frontend
```

Comprobaciones estáticas realizadas: build de Next.js (incluye tipos/lint), `deno check src/app.ts` y lint de ambos proyectos. No se ejecutaron suites de pruebas para este incremento ni se validó en esta sesión el stack con PostgreSQL, Docker o un navegador. Esa revisión funcional sigue pendiente antes de la demo.


### Tarjetas de video en Academia

`AcademyResources.tsx` comparte la presentación de recursos entre guías y glosario. `academyVideo.ts` admite únicamente HTTPS de YouTube con identificador válido y convierte los capítulos `t`/`start` a segundos. El reproductor usa `youtube.com/embed` por defecto, con `origin` y referrer de origen. La ayuda permite probar el modo `youtube-nocookie.com`, abrir el video exacto con su capítulo y remontar el iframe para reintentar. Solo se monta tras una acción del jugador; abrir otro desmonta el anterior. No necesita una clave de API. Las miniaturas fallidas mantienen el botón de reproducción y el enlace externo. Fuentes de integración: [parámetros oficiales del reproductor](https://developers.google.com/youtube/player_parameters) y [modo de privacidad mejorada](https://support.google.com/youtube/answer/171780?hl=es).


### Revisión de catálogo y bloqueo de YouTube

El catálogo creció de tres a ocho videos distintos, con alternativas de Skill Capped, Virkayu, 3 Minute League of Legends y xPetu, además de Zadarkus. No se duplican capítulos del mismo video para aparentar autores distintos. Los temas muestran su número real de videos; el glosario ya no recorta la selección a tres recursos. La verificación «no soy un robot» procede del reproductor de YouTube; alternar modos o autenticar en el sitio original no garantiza que el proveedor permita reproducir en el iframe. Este estado no se detecta inspeccionando el contenido del iframe, que es de otro origen. La ayuda está disponible manualmente sin afirmar que hubo un error ni que se resolvió.

Recursos añadidos: [ataque y movimiento de Skill Capped](https://www.youtube.com/watch?v=-oyxOgtT33U), [congelación de Skill Capped](https://www.youtube.com/watch?v=wjD2rGFua8s), [ganks de Virkayu](https://www.youtube.com/watch?v=-4IQG7vocKk), [visión en tres minutos](https://www.youtube.com/watch?v=sVrw5Ikgv3Y) y [compras de xPetu](https://www.youtube.com/watch?v=60hSIrt8LsE&t=477s). Sus ejemplos de parches antiguos siguen etiquetados como fundamentos.


### Presentación de la Academia

La portada usa un feed de publicaciones con búsqueda, temas, miniaturas, tiempos estimados de lectura calculados a partir del texto y recuentos del catálogo. El glosario se distingue con cabecera propia y categorías.

Las publicaciones usan una sola columna de lectura con categoría, título y autor. El cuerpo fluye como un post: párrafos, listas, subtítulos o citas opcionales, sin índice lateral ni secciones numeradas o recuadros obligatorios. Los conceptos breves no reciben contenido de relleno para alargarlos. Se conserva el fondo translúcido con desenfoque suave y texto a opacidad completa. Videos y lecturas aparecen al final cuando existen; se mantienen el reproductor, su ayuda y los enlaces relacionados.

`AcademyPostView` presenta el modelo flexible `AcademyPost` de `academyPosts.ts`. Las guías actuales se adaptan desde el catálogo estático; un futuro editor podrá generar los mismos bloques y usar esta presentación. Todavía no hay editor, almacenamiento de publicaciones ni flujo de publicación manual. El autor actual se identifica como «Academia de la Grieta»; solo se muestran fechas si están disponibles. No se inventan personas, fechas, vistas, votos o comentarios.

### Debilidades y Entrenamiento: jerarquía de lectura

Debilidades presenta una muestra resumida, número de áreas y prioridades altas. Los hallazgos se ordenan por severidad y se muestran en dos columnas (una en móvil): categoría e icono, prioridad, observación y siguiente paso diferenciado. Las partidas de evidencia se despliegan dentro de cada tarjeta; las reglas y referencias quedan en una sección secundaria al final. Se conservan las descripciones y las muestras del servidor.

Entrenamiento comienza con el siguiente ejercicio pendiente y una acción «Empezar ejercicio», junto al progreso semanal. El objetivo guardado de la semana es desplegable y se distingue del análisis actual, que puede cambiar con nuevas partidas. Los ejercicios se agrupan por área, con estado y contadores; «Pendientes» es el filtro inicial y «Todos» permite consultar los completados. Las explicaciones del coach y el fundamento de cada grupo son desplegables. Las recomendaciones de campeones y el mapa orientativo aparecen después como apoyo. Se conservan generación, guardado del cumplimiento, errores, enlaces directos, animaciones al desplazarse y movimiento reducido.
