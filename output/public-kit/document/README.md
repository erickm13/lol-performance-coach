# Diff — informe académico

Este paquete contiene el informe en Word editable y una vista previa en PDF.

- `Diff_informe_academico.docx`: documento editable; incluye campos en blanco para integrantes, lugar y fecha de entrega.
- `Diff_informe_academico_preview.pdf`: maquetación PDF del mismo contenido, 13 páginas. El cuerpo reinicia la numeración en la página 1; el glosario ocupa las páginas físicas 6–9, la introducción 10–11, los objetivos 12 y las referencias 13.
- `preview/`: imágenes de la portada, portada formal, los tres índices, primera y última página del glosario, introducción, objetivos y referencias.
- `generate_document.py`: genera el DOCX y el PDF a partir del catálogo de Academia y el contenido definido en el script; es la fuente canónica de la introducción y los objetivos.
- `render_previews.py`: vuelve a generar las imágenes PNG de revisión.

El PDF se generó con ReportLab a partir del mismo contenido porque no había un renderizador de Word disponible en el entorno. Por eso funciona como vista previa de la maquetación y puede diferir del paginado final de Word. La portada formal usa los datos recibidos de Universidad Galileo, Ingeniería en Sistemas, Seminario Profesional 2 y el docente Axel Benavides; las líneas de integrantes, lugar y fecha quedan vacías para completar.

Las páginas de índice están deliberadamente vacías, salvo por su encabezado. Los encabezados de sección del cuerpo usan estilos de Word y marcadores para facilitar la creación posterior de índices automáticos. La introducción tiene 758 palabras y usa prosa original con fuentes enlazadas. El glosario incluye 113 términos: los 73 del catálogo de la Academia más 40 conceptos para lectores nuevos en el juego, métricas, práctica e inteligencia artificial. El texto base de los 73 términos está en `frontend/app/lib/academyTerms.ts`. Las definiciones del glosario usan 10.5 pt en Word y PDF; el PDF usa 13.5 pt de interlineado.

## Regenerar

Desde esta carpeta, instala las dependencias y ejecuta:

```bash
python3 -m pip install -r requirements.txt
python3 generate_document.py
python3 render_previews.py
```

La generación del PDF usa la fuente DejaVu Sans o Liberation Sans disponible en el sistema.
