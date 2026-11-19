# Conceptos de logo Diff · v1

Seis propuestas visuales basadas en `DiffLogo.png`: cuatro símbolos y dos composiciones horizontales con la palabra `Diff`. Las opciones 04 (wordmark) y 06 (símbolo compacto) están integradas en la aplicación; la app usa copias sin cambios en `frontend/public/branding/`. La D segmentada se mantiene reconocible, pero algunos detalles ópticos pueden variar.

## Paleta

| Color | Valor | Uso en las propuestas |
| --- | --- | --- |
| Turquesa | `#3ED6C4` | Segmentos izquierdos/acento |
| Dorado | `#D4A45C` | Segmentos derechos/acento |
| Tinta | `#0A0E12` | Fondo oscuro o símbolo oscuro |
| Pergamino | `#E7EEF0` | Fondo claro o símbolo/texto claro |

Estos valores coinciden con los tokens de color actuales de `frontend/app/globals.css`.

## Archivos

| Archivo | Propuesta | Dimensión nativa |
| --- | --- | --- |
| `01-symbol-color-dark.png` | D turquesa + dorado sobre tinta | 1254 × 1254 px |
| `02-symbol-light-dark.png` | D pergamino sobre tinta | 1254 × 1254 px |
| `03-symbol-dark-light.png` | D tinta sobre pergamino | 1254 × 1254 px |
| `04-wordmark-dark-background.png` | D bicolor + Diff claro sobre tinta | 1774 × 887 px |
| `05-wordmark-light-background.png` | D bicolor + Diff oscuro sobre pergamino | 1774 × 887 px |
| `06-symbol-compact.png` | D compacta turquesa sobre tinta | 1254 × 1254 px |

Los seis archivos son PNG RGB con fondo completamente opaco; ninguno es vectorial ni tiene transparencia. Los enlaces de descarga de la galería entregan estos archivos sin cambios.

## Vistas de tamaño

La galería muestra escalados CSS de 32, 64 y 128 px para comparación en pantalla. No son exportaciones nuevas ni tamaños optimizados. Revisa especialmente el símbolo compacto en los tamaños pequeños antes de decidir un uso final. Los dos wordmarks se escalan con esos mismos anchos solo para comparación visual.

## Galería y prompts

Abre `index.html` directamente o sírvelo localmente, por ejemplo:

```sh
python3 -m http.server 3001 --directory output/branding/diff/v1
```

`prompts.json` contiene la copia exacta de los prompts usados para estos seis conceptos. Se excluyeron borradores con transparencia porque sus bordes no quedaron limpios.
