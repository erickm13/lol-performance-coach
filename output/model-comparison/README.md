# Paquete de comparación JSON/CSV

**Todos los datos de este paquete son sintéticos y ficticios. No son partidas de Riot, ni datos de una cuenta real.** Los valores ilustran formatos y patrones para una demostración; no describen resultados reales de un jugador.

## Archivos

- `10-partidas.json` y `10-partidas.csv`: las mismas 10 filas, campos, orden y valores. En CSV, `NA` equivale a JSON `null` para un valor desconocido.
- `prompt-comun.txt`: pega exactamente el mismo prompt en las cuatro ejecuciones.
- `plantilla-resultados.csv`: registra local JSON, local CSV, cloud JSON y cloud CSV.
- `referencia-resultados.md`: comprobación aritmética para la persona que evalúa. **No la incluyas en el contexto ni se la entregues al modelo.**

## Comparación

Para reducir diferencias de lectura, pega el contenido de JSON o CSV como texto plano después del mismo prompt; evita rutas de carga distintas que puedan parsear los archivos de manera diferente. Conserva iguales el prompt, instrucciones adicionales, formato exigido para la respuesta y configuración/contexto del modelo cuando sea posible. Registra el nombre y versión reales, configuración, tokens y tiempo medidos en la plantilla; no asumas ni rellenes valores que la plataforma no reporte. Anota por separado errores numéricos y la calidad de las prioridades o ejercicios. La referencia ayuda a comprobar números, pero no establece una respuesta única sobre qué debe practicar el jugador ni es una respuesta modelo.

## Esquema y límites

| Campo | Tipo / unidad |
| --- | --- |
| `id` | texto, M01–M10 |
| `campeon`, `rol` | texto; todas las filas son `TOP` |
| `minutos` | entero, minutos de partida |
| `victoria` | entero, 0 o 1 |
| `kills`, `deaths`, `assists` | enteros |
| `cs_min` | número, súbditos por minuto |
| `vision_min` | número, puntuación de visión por minuto |
| `kp_pct` | entero, porcentaje de 0 a 100 |
| `muertes_antes_10` | entero o desconocido (`null` / `NA`) |
| `cola` | entero, ID 420 constante en la muestra |

Se omiten fechas y parche para evitar presentar metadatos ficticios como hechos. Las referencias TOP de 6 CS/min, 0.60 visión/min, 35% de participación y 1 muerte temprana son referencias internas de práctica, no benchmarks oficiales de rango. Las partidas son sintéticas y no provienen de Riot; las ejecuciones de proveedores se conservan aparte en `resultados-api/`.

## Vista de comparación

La ruta pública `/comparacion-modelos` presenta cuatro ejecuciones completas: Groq y Ollama con JSON y CSV. Incluye tiempos y tokens observados, comprobaciones aritméticas y controles para consultar el prompt, los datos y las respuestas originales. Los intentos JSON fallido e incompleto de Gemini aparecen aparte; no hay ejecución CSV de Gemini. Se excluyen las capturas locales antiguas porque no se conoce su modelo ni su hash de entrada.

La página lee el snapshot local `frontend/app/comparacion-modelos/snapshot.json`; no llama a APIs ni necesita backend. Desde la raíz del repositorio, regenera el snapshot o comprueba que esté actualizado con:

```sh
node output/model-comparison/build-visualization.mjs
node output/model-comparison/build-visualization.mjs --check
```

El generador exige exactamente una ejecución completa por proveedor y formato primarios (Groq/Ollama × JSON/CSV), y valida los hashes del prompt y los datos antes de generar. Si hay varias ejecuciones completas para una condición, falla para evitar una selección ambigua.

## Ejecución con APIs

Desde la raíz del repositorio, ejecuta una combinación por proceso. Node.js 20.6 o posterior carga `.env` con `--env-file`; las claves existentes se leen del entorno y nunca se imprimen ni se guardan.

```sh
node --env-file=.env output/model-comparison/probar-api.mjs groq json
node --env-file=.env output/model-comparison/probar-api.mjs groq csv
node --env-file=.env output/model-comparison/probar-api.mjs gemini json
node --env-file=.env output/model-comparison/probar-api.mjs gemini csv
node --env-file=.env output/model-comparison/probar-api.mjs ollama json
node --env-file=.env output/model-comparison/probar-api.mjs ollama csv
```

Groq requiere `GROQ_API_KEY`; Gemini requiere `GEMINI_API_KEY` y admite `GEMINI_MODEL` (por defecto `gemini-3.8-flash`). Ollama usa `OLLAMA_HOST` (por defecto `http://localhost:11434`) y `OLLAMA_MODEL` (por defecto `gemma4:e4b`); su daemon debe estar iniciado. Solo hace falta configurar la clave del proveedor elegido. El proceso principal de la app no necesita estar ejecutándose. `API_TIMEOUT_MS` permite fijar el timeout entre 1 y 180000 ms (por defecto 180000).

Cada ejecución envía un único mensaje de usuario con `prompt-comun.txt`, una línea en blanco y el archivo JSON o CSV; no añade instrucciones del sistema, historial ni contexto personalizado de la app. Usa temperatura 0 y límite de salida 4096, deja intactos los ajustes internos de razonamiento del modelo y no reintenta ni cambia de proveedor. Por eso compara el formato con un prompt común, no reproduce el flujo completo de chat de la app. Los modelos y claves siguen la configuración de sus proveedores en el backend; el modelo alojado de Groq no implica que sea un modelo de frontera. El tiempo y los tokens son los reportados por esta solicitud; no se estima costo ni se afirma que temperatura 0 haga deterministas las respuestas.

La respuesta y sus métricas se guardan con nombres únicos en `output/model-comparison/resultados-api/`. Las métricas incluyen proveedor y modelos solicitado/devuelto, formato, tiempo de solicitud, tokens y uso anidado cuando se reportan, motivo de finalización, huellas SHA-256 de la entrada y los datos, y estadísticas de evaluación/carga de Ollama cuando están disponibles. Errores HTTP, de red, JSON o respuesta vacía terminan con código distinto de cero y dejan solo un archivo de métricas de fallo; los tokens y el uso desconocidos quedan como `null`, no como cero. Si la salida se trunca, se guardan la respuesta parcial y métricas marcadas `incomplete`.

Un HTTP 503 indica disponibilidad del proveedor, no calidad del formato JSON o CSV, y no cuenta como respuesta evaluable. El runner registra ese intento sin reintentar ni cambiar de modelo o proveedor. Espera el tiempo indicado por `Retry-After` si se reporta; si no, espera 30–60 segundos. Repetir manualmente el mismo comando crea un registro nuevo, por ejemplo: `node --env-file=.env output/model-comparison/probar-api.mjs gemini json`. El uso de tokens desconocido no significa que haya sido cero ni que la solicitud haya sido gratuita. Google clasifica 503 como indisponibilidad temporal en su [guía de errores](https://ai.google.dev/gemini-api/docs/api-errors) y [troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting).

El runner envía y registra `temperature: 0`, pero Google indica que Gemini 3.6 y posteriores pueden ignorar ese parámetro en su [troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting); no debe tomarse como garantía de temperatura efectiva ni determinismo. La temperatura no se cambia como parte de la recuperación de un 503.
