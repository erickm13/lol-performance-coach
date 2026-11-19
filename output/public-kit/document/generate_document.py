#!/usr/bin/env python3
"""Build the editable Diff academic report and its PDF preview."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image as PDFImage,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BRAND_IMAGE = ROOT / "output/branding/diff/v1/04-wordmark-dark-background.png"
ACADEMY_SOURCE = ROOT / "frontend/app/lib/academyTerms.ts"
DOCX_PATH = HERE / "Diff_informe_academico.docx"
PDF_PATH = HERE / "Diff_informe_academico_preview.pdf"

INK = "0A0E12"
TEAL = "3ED6C4"
TEAL_DARK = "187A70"
GOLD = "D4A45C"
PAPER = "E7EEF0"
MID = "66747A"

GENERAL_OBJECTIVE = (
    "Desarrollar y evaluar una plataforma web que transforme los datos de partidas de "
    "League of Legends en un diagnóstico comprensible y un plan de práctica "
    "personalizado, explicable y con seguimiento de cumplimiento."
)

SPECIFIC_OBJECTIVES = [
    "Integrar datos de partidas y perfil obtenidos mediante servicios oficiales de Riot Games, dentro de los permisos y límites aplicables.",
    "Calcular métricas de desempeño y detectar patrones con reglas explícitas y referencias internas diferenciadas por rol.",
    "Generar recomendaciones de práctica explicadas en lenguaje claro por un modelo de lenguaje y ancladas en las métricas y patrones calculados.",
    "Facilitar la revisión de partidas y el acceso a contenidos educativos pertinentes a los hallazgos.",
    "Registrar el cumplimiento de los ejercicios para dar seguimiento a la práctica.",
    "Validar el funcionamiento con pruebas técnicas y planificar una futura validación de usabilidad con participantes, documentando alcance y límites.",
]

INTRODUCTION = [
    "Las personas han usado registros para conservar y consultar información desde hace milenios. Una tablilla proto-cuneiforme que el Museo Metropolitano de Arte fecha aproximadamente entre 3100 y 2900 a. C. documenta una distribución de cebada, probablemente en Uruk [1]. El registro administrativo no es ciencia de datos ni entrenamiento; muestra, en un contexto muy distinto, cómo dejar constancia de una actividad para revisarla después.",
    "En 1887, Eadweard Muybridge publicó secuencias fotográficas del movimiento en <i>Animal Locomotion</i> [2]. Las imágenes hicieron posible observar por separado momentos de una acción que normalmente se ve como continua. El registro de Uruk y las fotografías de Muybridge responden a necesidades y tecnologías diferentes; ambos sirven como ejemplos de cómo conservar rastros para que una actividad pueda examinarse más tarde.",
    "Un siglo después, la investigación sobre el aprendizaje de habilidades estudió qué distingue la práctica enfocada de la simple repetición. Ericsson, Krampe y Tesch-Römer describieron en 1993 la práctica deliberada: actividades organizadas para mejorar aspectos concretos del desempeño, con objetivos y retroalimentación [3]. Un metaanálisis posterior encontró que su contribución varía según el dominio [4]. Estos trabajos ayudan a pensar cómo orientar una práctica, pero no dicen que las horas por sí solas garanticen pericia ni demuestran que una aplicación particular produzca mejoras.",
    "League of Legends, lanzado en 2009, reúne a jugadores en equipos que compiten por objetivos en el mapa [5]. En su modo recomendado, dos equipos de cinco campeones intentan destruir el nexo rival; la guía básica presenta las posiciones como Top, Jungle, Mid, Bot y Support [8]. Como en otros deportes electrónicos, una partida deja estadísticas y resultados, pero ganar o perder no explica por sí solo qué decisión conviene repetir o cambiar. Una cifra como las bajas, el oro o los súbditos eliminados describe una parte del juego; para interpretarla hay que saber qué posición ocupaba la persona y en qué situación se obtuvo.",
    "La actualización de la temporada 2017 incorporó repeticiones con una línea de tiempo de eventos y una herramienta de práctica para ensayar situaciones del juego [6]. Las repeticiones permiten volver a una jugada; la práctica controlada permite repetir acciones aisladas. La documentación actual de Riot también describe interfaces para consultar datos de League of Legends y recursos estáticos sobre el juego [7]. Estas herramientas hacen posible revisar información desde distintos ángulos, aunque el registro disponible no contiene por sí solo todas las razones de una decisión.",
    "Al pasar de un replay a un análisis digital, cambia la unidad de observación. Una repetición permite recorrer una secuencia y volver a un instante; una API proporciona campos y eventos que el software puede ordenar y calcular [7]. Así se pueden formular preguntas comprobables sobre una partida o comparar métricas en contextos distintos. La vista numérica y la repetición se complementan: una facilita la comparación y la otra devuelve contexto, pero ninguna reemplaza la interpretación del jugador.",
    "Diff aborda el paso entre revisar una partida y decidir qué practicar. Es un proyecto académico que desarrolla un prototipo web para organizar datos de partidas recientes en un diagnóstico comprensible, explicaciones y ejercicios con seguimiento. El prototipo importa las diez partidas más recientes disponibles de la cuenta; esa selección puede reunir partidas de varios roles. Las referencias internas ajustan la lectura de ciertas métricas al rol cuando el dato está disponible, y funcionan como criterios de práctica propios del proyecto.",
    "El plan semanal usa reglas para priorizar focos de trabajo y ejercicios. Un modelo de lenguaje explica ese plan en texto claro, relacionando la recomendación con las métricas calculadas. El análisis de mapa es una función distinta: evalúa con IA los eventos individuales de la partida para apoyar la revisión. La Academia y el historial permiten consultar conceptos y volver a partidas; el jugador puede marcar los ejercicios que completa y seguir su práctica.",
    "Así, el flujo propuesto conecta observación, elección de un foco, práctica y nueva revisión. Su propósito es dar al jugador una forma ordenada de trabajar con sus propios datos, no reemplazar la experiencia humana ni decidir qué resultado competitivo debería obtener. La relación entre un indicador y una recomendación tiene que poder entenderse y discutirse a partir de la partida que la originó.",
    "Diff sigue siendo un prototipo académico. Las diez partidas recientes pueden mezclar roles y parches, y las métricas no capturan todo el contexto de juego; sus referencias internas orientan una revisión, no califican a la persona. El proyecto no promete mejorar victorias ni rango. Incluye pruebas técnicas y deja planificada una futura validación de usabilidad con participantes, cuyos resultados todavía no se presentan.",
]

EXTRA_GLOSSARY = [
    ("API", "Interfaz documentada que permite a una aplicación solicitar datos a otro servicio bajo reglas y permisos definidos."),
    ("Asistencia", "Participación en una baja del equipo sin haber dado el golpe final al rival."),
    ("Campeón", "Personaje que el jugador controla durante una partida y que cuenta con habilidades propias."),
    ("Datos estructurados", "Información organizada en campos y registros para que un programa pueda consultarla y calcular indicadores."),
    ("Derrota", "Resultado en que el equipo pierde la partida; por sí solo no identifica las causas del resultado."),
    ("Ejercicio de práctica", "Actividad breve con un foco definido que se puede repetir y revisar, como practicar los últimos golpes."),
    ("Equipo", "Grupo de jugadores que coopera para cumplir objetivos comunes dentro de una partida."),
    ("Experiencia (XP)", "Puntos que permiten subir de nivel dentro de una partida y mejorar habilidades del campeón."),
    ("Grounding (anclaje)", "Vincular una explicación generada a datos concretos proporcionados al modelo; no garantiza que la explicación sea correcta."),
    ("LLM (modelo de lenguaje)", "Sistema que genera texto a partir de patrones aprendidos y del contexto recibido; no es una fuente de verdad independiente."),
    ("Métrica", "Medida calculada a partir de datos, como bajas por partida o súbditos eliminados por minuto."),
    ("Muestra", "Conjunto de partidas usado para calcular una métrica o buscar un patrón; si es pequeño o poco representativo, la conclusión puede ser inestable."),
    ("Partida", "Una sesión de juego con inicio, desarrollo y resultado propios."),
    ("Parche", "Actualización del juego que puede cambiar contenido, reglas o equilibrio; conviene considerar la versión al comparar partidas."),
    ("Plan de práctica", "Lista priorizada de ejercicios y focos que organiza qué revisar o practicar; no garantiza un resultado competitivo."),
    ("Patrón recurrente", "Observación que aparece en varias partidas y puede orientar una revisión, sin demostrar por sí sola su causa."),
    ("Privacidad de datos", "Cuidado con que los datos personales o de juego se recopilen, usen y compartan según lo informado y permitido."),
    ("Regla de análisis", "Condición explícita que el sistema aplica a los datos para señalar una tendencia o priorizar un foco de práctica."),
    ("Referencia por rol", "Criterio interno para interpretar una métrica según el rol; no equivale a un percentil de rango ni a una norma profesional."),
    ("Rendimiento", "Conjunto de acciones y resultados observables en una partida; no se resume por completo en una sola cifra."),
    ("Riot ID", "Identificador público que una persona usa para encontrar su cuenta de juego en los servicios de Riot."),
    ("Súbdito", "Unidad controlada por el juego que avanza por una línea; eliminarla puede otorgar oro y experiencia según las reglas."),
    ("Tasa de victoria", "Proporción de partidas ganadas dentro de un conjunto definido; no explica por sí sola por qué se ganaron o perdieron."),
    ("Validación de usabilidad", "Evaluación con participantes y tareas para observar si pueden usar una interfaz; no es lo mismo que una prueba técnica ni demuestra eficacia de entrenamiento."),
    ("Bottom", "Línea inferior de la Grieta del Invocador; en una composición habitual la comparten el tirador (ADC) y el soporte."),
    ("Build", "Selección de objetos, runas y otras opciones de configuración para un campeón; puede variar según el parche y la partida."),
    ("CS/min", "Cantidad promedio de súbditos y monstruos neutrales eliminados por minuto. Se calcula a partir del CS total y el tiempo de partida."),
    ("Cooldown (enfriamiento)", "Tiempo que debe pasar para volver a usar una habilidad o recurso después de activarlo."),
    ("Farm (farmeo)", "Acción de obtener recursos, sobre todo oro, al dar el último golpe a súbditos o monstruos neutrales."),
    ("Grieta del Invocador", "Mapa clásico de League of Legends con tres líneas y una jungla, donde dos equipos compiten por destruir el nexo rival."),
    ("IA (inteligencia artificial)", "Métodos computacionales que realizan tareas como clasificar datos o generar texto a partir de patrones y ejemplos."),
    ("League of Legends (LoL)", "Videojuego competitivo de equipos en el que cada jugador controla un campeón y busca destruir la estructura principal del equipo rival."),
    ("Línea", "Camino principal del mapa por donde avanzan oleadas de súbditos; hay una línea superior, una central y una inferior."),
    ("Meta", "Tendencias de campeones, estrategias u objetos que la comunidad considera eficaces en una versión del juego; cambian y no garantizan ganar."),
    ("MOBA", "Sigla de Multiplayer Online Battle Arena: género de videojuegos en el que equipos controlan personajes y compiten en un mapa con objetivos."),
    ("Nexus", "Estructura principal de cada equipo; destruir el nexo rival termina la partida."),
    ("Oro", "Recurso que el jugador obtiene durante la partida y usa para comprar objetos para su campeón."),
    ("Rol", "Función o posición que ocupa una persona en el equipo, como top, jungle, mid, bottom o utility; orienta qué hace en el mapa."),
    ("Torre", "Estructura defensiva situada junto a una línea; ataca a los rivales cercanos y protege el acceso a la base."),
    ("Utility", "Nombre de la posición de apoyo en League of Legends; la comunidad suele llamarla support o soporte."),
]

REFERENCES = [
    ("The Metropolitan Museum of Art. <i>Proto-Cuneiform tablet with seal impressions: administrative account of barley distribution</i>, ca. 3100–2900 a. C.", "https://www.metmuseum.org/art/collection/search/329081"),
    ("Muybridge, E. (1887). <i>Animal locomotion: an electro-photographic investigation of consecutive phases of animal movements</i>. Library of Congress.", "https://www.loc.gov/item/31004968/"),
    ("Ericsson, K. A., Krampe, R. T., &amp; Tesch-Römer, C. (1993). The role of deliberate practice in the acquisition of expert performance. <i>Psychological Review, 100</i>(3), 363–406.", "https://doi.org/10.1037/0033-295X.100.3.363"),
    ("Macnamara, B. N., Hambrick, D. Z., &amp; Oswald, F. L. (2014). Deliberate practice and performance in music, games, sports, education, and professions: A meta-analysis. <i>Psychological Science, 25</i>(8), 1608–1618.", "https://www.psychologicalscience.org/journals/psychological-science/0956797614535810/"),
    ("Riot Games. (2024). <i>2024 Riot Games Fact Sheet</i>.", "https://www.riotgames.com/darkroom/original/68b33bf46dda70555c4dec34f6f736e9%3Aea81fb8a0be5cda5bec43af0f43694e2/2024-riot-fact-sheet.pdf"),
    ("Riot Games. (s. f.). <i>2017 Season Update: Replays and the Practice Tool</i>.", "https://na.leagueoflegends.com/en/featured/preseason-2017/replays-and-practice"),
    ("Riot Games Developer Portal. <i>League of Legends API and Data Dragon documentation</i>. Consulta: 30 de octubre de 2026.", "https://developer.riotgames.com/docs/lol"),
    ("Riot Games. (s. f.). <i>League of Legends: How to Play</i>. Consulta: 30 de octubre de 2026.", "https://www.leagueoflegends.com/en-us/how-to-play/"),
]


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.casefold())
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def academy_glossary() -> list[tuple[str, str]]:
    source = ACADEMY_SOURCE.read_text(encoding="utf-8")
    match = re.search(
        r"export const ACADEMY_TERMS: AcademyTerm\[\] = \[(.*?)\n\];",
        source,
        flags=re.S,
    )
    if not match:
        raise ValueError(f"No se encontró el catálogo de términos: {ACADEMY_SOURCE}")

    entries: list[tuple[str, str]] = []
    object_pattern = re.compile(r"^\s*\{(.*?)^\s*\},?", flags=re.M | re.S)
    string_pattern = r'"((?:\\.|[^"\\])*)"'
    for item in object_pattern.finditer(match.group(1)):
        body = item.group(1)
        term_match = re.search(r"\bterm:\s*" + string_pattern, body)
        definition_match = re.search(r"\bdefinition:\s*" + string_pattern, body, flags=re.S)
        if not term_match or not definition_match:
            continue
        term, definition = (json.loads('"' + found.group(1) + '"') for found in (term_match, definition_match))
        entries.append((term, definition))

    if len(entries) != 73:
        raise ValueError(f"Se esperaban 73 términos de Academia y se encontraron {len(entries)}")

    overrides = {
        "ADC": "Sigla de Attack Damage Carry; se usa para el rol que suele jugar en la línea inferior y aportar daño sostenido. Describe una función habitual, no una clase fija de campeón.",
        "All-in": "Intentar asegurar una baja usando varias habilidades y recursos disponibles, con menos opciones para retirarse si falla la jugada.",
        "Baron": "Monstruo neutral épico cuyo beneficio fortalece al equipo que lo derrota; sus efectos pueden cambiar por parche.",
        "Control ward": "Objeto de visión que se coloca en el mapa y ayuda a detectar ciertos elementos ocultos o a disputar la visión en su zona; no revela todos los tipos de invisibilidad.",
        "CS": "Número total de súbditos y monstruos neutrales eliminados durante la partida; no es una cifra por minuto.",
        "Drake": "Monstruo neutral épico que otorga efectos al equipo; sus reglas y recompensas dependen del parche.",
        "Jungle": "Rol que recorre la jungla, derrota monstruos neutrales y puede ayudar a las líneas; también llamado jungla o jungler.",
        "KDA": "Relación entre bajas y asistencias frente a muertes; las interfaces pueden tratar de forma especial una partida sin muertes.",
        "Mid": "Rol asociado a la línea central del mapa, desde donde es posible desplazarse hacia otras zonas.",
        "Support": "Rol de apoyo que suele acompañar al tirador en la línea inferior y ayuda con visión, protección o control de peleas.",
        "Tower plates": "Placas que pueden dar recompensas por dañar una torre durante una etapa inicial; sus reglas cambian por parche.",
        "Top": "Rol asociado a la línea superior del mapa; también se llama top laner.",
        "Utility": "Nombre que algunas listas de posiciones dan a la función de apoyo; la guía básica de Riot la llama Support y la comunidad suele decir soporte.",
        "Vision score": "Indicador agregado de visión colocada y negada; no mide por sí solo la calidad de las decisiones.",
        "Voidgrubs": "Monstruos neutrales que otorgan recompensas al equipo; su presencia y sus reglas pueden cambiar por parche.",
    }
    entries.extend(EXTRA_GLOSSARY)
    entries = [(term, overrides.get(term, definition)) for term, definition in entries]
    entries.sort(key=lambda item: (normalize(item[0]), item[0]))
    return entries


def word_count(text: str) -> int:
    return len(re.findall(r"[\wÁÉÍÓÚÜÑáéíóúüñ]+(?:[’'-][\wÁÉÍÓÚÜÑáéíóúüñ]+)*", re.sub(r"<[^>]+>", "", text)))


def validate_content(glossary: list[tuple[str, str]]) -> None:
    intro_words = word_count(" ".join(INTRODUCTION))
    if not 700 <= intro_words <= 1000:
        raise ValueError(f"La introducción tiene {intro_words} palabras; se requieren 700–1000")
    if not 80 <= len(glossary) <= 120:
        raise ValueError(f"El glosario tiene {len(glossary)} términos; se requieren 80–120")
    if len(SPECIFIC_OBJECTIVES) != 6:
        raise ValueError("Se requieren seis objetivos específicos")
    print(f"Contenido verificado: {intro_words} palabras de introducción, {len(glossary)} términos, 6 objetivos específicos.")


def set_cell_shading(cell, fill: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shading)


def set_cell_margins(cell, top=250, start=250, bottom=250, end=250) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_paragraph_bottom_border(paragraph, color=TEAL_DARK) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "5")
    bottom.set(qn("w:space"), "2")
    bottom.set(qn("w:color"), color)
    borders.append(bottom)
    p_pr.append(borders)


def add_bookmark(paragraph, name: str, bookmark_id: int) -> None:
    start = OxmlElement("w:bookmarkStart")
    start.set(qn("w:id"), str(bookmark_id))
    start.set(qn("w:name"), name)
    end = OxmlElement("w:bookmarkEnd")
    end.set(qn("w:id"), str(bookmark_id))
    paragraph._p.insert(0, start)
    paragraph._p.append(end)


def add_field(paragraph, instruction: str) -> None:
    begin_run = OxmlElement("w:r")
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    code = OxmlElement("w:instrText")
    code.set(qn("xml:space"), "preserve")
    code.text = f" {instruction} "
    begin_run.append(begin)
    begin_run.append(code)

    value_run = OxmlElement("w:r")
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    value_text = OxmlElement("w:t")
    value_text.text = "1"
    value_run.append(separate)
    value_run.append(value_text)

    end_run = OxmlElement("w:r")
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    end_run.append(end)
    paragraph._p.append(begin_run)
    paragraph._p.append(value_run)
    paragraph._p.append(end_run)


def add_hyperlink(paragraph, text: str, url: str) -> None:
    relationship = paragraph.part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), relationship)
    run = OxmlElement("w:r")
    properties = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), TEAL_DARK)
    properties.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    properties.append(underline)
    run.append(properties)
    text_node = OxmlElement("w:t")
    text_node.text = text
    run.append(text_node)
    link.append(run)
    paragraph._p.append(link)


def set_section_columns(section, count: int) -> None:
    nodes = section._sectPr.xpath("./w:cols")
    cols = nodes[0] if nodes else OxmlElement("w:cols")
    cols.set(qn("w:num"), str(count))
    cols.set(qn("w:space"), "420")
    if not nodes:
        section._sectPr.append(cols)


def add_heading_bookmark(document, text: str, level: int, name: str, bookmark_id: int):
    paragraph = document.add_heading(text, level=level)
    add_bookmark(paragraph, name, bookmark_id)
    return paragraph


def configure_docx(document: Document) -> None:
    for section in document.sections:
        section.page_width = Inches(8.5)
        section.page_height = Inches(11)
        section.top_margin = Inches(0.72)
        section.bottom_margin = Inches(0.72)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    styles = document.styles
    normal = styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing = 1.12

    for name, size in (("Heading 1", 21), ("Heading 2", 14), ("Heading 3", 11.5)):
        style = styles[name]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(TEAL_DARK if name == "Heading 1" else INK)
        style.paragraph_format.space_before = Pt(13 if name == "Heading 1" else 9)
        style.paragraph_format.space_after = Pt(6)
        style.paragraph_format.keep_with_next = True


def add_running_header_footer(section) -> None:
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False
    header = section.header
    header_table = header.add_table(rows=1, cols=2, width=Inches(6.5))
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_table.autofit = False
    header_table.columns[0].width = Inches(1.0)
    header_table.columns[1].width = Inches(5.5)
    for cell in header_table.rows[0].cells:
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    left, right = header_table.rows[0].cells
    p = left.paragraphs[0]
    p.paragraph_format.space_after = Pt(1)
    run = p.add_run("DIFF")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor.from_string(TEAL_DARK)
    p = right.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(1)
    run = p.add_run("PROYECTO ACADÉMICO · SEMINARIO PROFESIONAL 2")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(MID)

    footer = section.footer
    footer_table = footer.add_table(rows=1, cols=2, width=Inches(6.5))
    footer_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    footer_table.autofit = False
    footer_table.columns[0].width = Inches(4.7)
    footer_table.columns[1].width = Inches(1.8)
    p = footer_table.cell(0, 0).paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("Plataforma web de análisis y práctica")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(MID)
    p = footer_table.cell(0, 1).paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("Página ")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(MID)
    add_field(p, "PAGE")


def add_word_cover(document: Document) -> None:
    section = document.sections[0]
    section.top_margin = Inches(0.42)
    section.bottom_margin = Inches(0.42)
    section.left_margin = Inches(0.42)
    section.right_margin = Inches(0.42)

    table = document.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(7.66)
    row = table.rows[0]
    row.height = Inches(9.95)
    row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    cell = row.cells[0]
    cell.width = Inches(7.66)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_shading(cell, INK)
    set_cell_margins(cell, top=680, start=500, bottom=680, end=500)

    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(7)
    run = p.add_run("DIAGNÓSTICO · PRÁCTICA · PROGRESO")
    run.bold = True
    run.font.name = "Aptos"
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor.from_string(TEAL)

    p = cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(8)
    p.add_run().add_picture(str(BRAND_IMAGE), width=Inches(5.0))

    p = cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run("Del análisis de partidas a la práctica personal")
    run.bold = True
    run.font.name = "Aptos Display"
    run.font.size = Pt(28)
    run.font.color.rgb = RGBColor.from_string(PAPER)

    p = cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(20)
    run = p.add_run("Datos de League of Legends convertidos en un diagnóstico comprensible, recomendaciones explicables y ejercicios con seguimiento.")
    run.font.size = Pt(13)
    run.font.color.rgb = RGBColor.from_string(PAPER)

    p = cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(9)
    run = p.add_run("TRABAJO ACADÉMICO · SEMINARIO PROFESIONAL 2")
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor.from_string(GOLD)


def add_blank_field(document: Document, label: str, lines: int = 1) -> None:
    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(1)
    run = p.add_run(label)
    run.bold = True
    run.font.size = Pt(10.5)
    for _ in range(lines):
        blank = document.add_paragraph()
        blank.paragraph_format.space_after = Pt(10)
        set_paragraph_bottom_border(blank)


def add_academic_cover(document: Document) -> None:
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(20)
    run = p.add_run("UNIVERSIDAD GALILEO")
    run.bold = True
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor.from_string(INK)

    p = document.add_paragraph("Ingeniería en Sistemas")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(0)
    p.runs[0].font.size = Pt(12)

    p = document.add_paragraph("Seminario Profesional 2")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(0)
    p.runs[0].font.size = Pt(12)

    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(60)
    run = p.add_run("PLATAFORMA WEB PARA EL ANÁLISIS DEL RENDIMIENTO Y LA PLANIFICACIÓN DE PRÁCTICA EN LEAGUE OF LEGENDS")
    run.bold = True
    run.font.name = "Aptos Display"
    run.font.size = Pt(19)
    run.font.color.rgb = RGBColor.from_string(INK)

    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(32)
    run = p.add_run("Informe académico")
    run.italic = True
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor.from_string(MID)

    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Docente: Axel Benavides")
    run.font.size = Pt(11)
    p.paragraph_format.space_after = Pt(5)

    add_blank_field(document, "Integrantes", lines=2)
    add_blank_field(document, "Lugar", lines=1)
    add_blank_field(document, "Fecha de entrega", lines=1)


def add_docx_body(glossary: list[tuple[str, str]]) -> None:
    document = Document()
    configure_docx(document)
    add_word_cover(document)
    document.add_page_break()
    add_academic_cover(document)

    for title, bookmark in (("Índice", "index_contents"), ("Índice de figuras", "index_figures"), ("Índice de tablas", "index_tables")):
        document.add_page_break()
        p = add_heading_bookmark(document, title, 1, bookmark, {"index_contents": 1, "index_figures": 2, "index_tables": 3}[bookmark])
        p.paragraph_format.space_before = Pt(0)

    body_section = document.add_section(WD_SECTION.NEW_PAGE)
    body_section.page_width = Inches(8.5)
    body_section.page_height = Inches(11)
    body_section.top_margin = Inches(0.82)
    body_section.bottom_margin = Inches(0.68)
    body_section.left_margin = Inches(0.85)
    body_section.right_margin = Inches(0.85)
    body_section.header_distance = Inches(0.38)
    body_section.footer_distance = Inches(0.38)
    page_number = OxmlElement("w:pgNumType")
    page_number.set(qn("w:start"), "1")
    page_margins = body_section._sectPr.xpath("./w:pgMar")[0]
    body_section._sectPr.insert(list(body_section._sectPr).index(page_margins) + 1, page_number)
    set_section_columns(body_section, 2)
    add_running_header_footer(body_section)

    add_heading_bookmark(document, "Glosario", 1, "section_glosario", 4)
    for term, definition in glossary:
        p = document.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.keep_together = True
        p.paragraph_format.widow_control = True
        run = p.add_run(f"{term}. ")
        run.bold = True
        run.font.size = Pt(10.5)
        run.font.color.rgb = RGBColor.from_string(INK)
        definition_run = p.add_run(definition)
        definition_run.font.size = Pt(10.5)

    single_section = document.add_section(WD_SECTION.NEW_PAGE)
    single_section.page_width = Inches(8.5)
    single_section.page_height = Inches(11)
    single_section.top_margin = Inches(0.82)
    single_section.bottom_margin = Inches(0.68)
    single_section.left_margin = Inches(0.95)
    single_section.right_margin = Inches(0.95)
    single_section.header_distance = Inches(0.38)
    single_section.footer_distance = Inches(0.38)
    set_section_columns(single_section, 1)
    single_section.header.is_linked_to_previous = True
    single_section.footer.is_linked_to_previous = True
    for page_number in single_section._sectPr.xpath("./w:pgNumType"):
        single_section._sectPr.remove(page_number)

    add_heading_bookmark(document, "Introducción", 1, "section_introduccion", 5)
    for paragraph in INTRODUCTION:
        document.add_paragraph(re.sub(r"</?i>", "", paragraph))

    document.add_page_break()
    add_heading_bookmark(document, "Objetivos", 1, "section_objetivos", 6)
    document.add_heading("Objetivo general", level=2)
    document.add_paragraph(GENERAL_OBJECTIVE)
    document.add_heading("Objetivos específicos", level=2)
    for objective in SPECIFIC_OBJECTIVES:
        p = document.add_paragraph(objective, style="List Number")
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.keep_together = True

    document.add_page_break()
    add_heading_bookmark(document, "Referencias", 1, "section_referencias", 7)
    for index, (citation, url) in enumerate(REFERENCES, 1):
        p = document.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.25)
        p.paragraph_format.first_line_indent = Inches(-0.25)
        p.paragraph_format.space_after = Pt(8)
        p.add_run(f"[{index}] {re.sub(r'<[^>]+>', '', citation)} ")
        add_hyperlink(p, "Consultar fuente", url)

    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    run = p.add_run("Diff es un proyecto académico independiente. Riot Games no patrocina ni avala este trabajo.")
    run.italic = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor.from_string(MID)

    properties = document.core_properties
    properties.title = "Diff — Informe académico"
    properties.subject = "Análisis del rendimiento y planificación de práctica en League of Legends"
    document.save(DOCX_PATH)


def register_pdf_fonts() -> tuple[str, str]:
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"),
    ]
    regular = next((path for path in candidates if path.exists()), None)
    bold_candidates = [
        regular.with_name("DejaVuSans-Bold.ttf") if regular and regular.name.startswith("DejaVu") else None,
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
    ]
    bold = next((path for path in bold_candidates if path and path.exists()), None)
    if not regular or not bold:
        raise FileNotFoundError("Se requiere una fuente DejaVu Sans o Liberation Sans para el PDF")
    pdfmetrics.registerFont(TTFont("DiffSans", str(regular)))
    pdfmetrics.registerFont(TTFont("DiffSans-Bold", str(bold)))
    pdfmetrics.registerFontFamily("DiffSans", normal="DiffSans", bold="DiffSans-Bold", italic="DiffSans", boldItalic="DiffSans-Bold")
    return "DiffSans", "DiffSans-Bold"


def pdf_color(hex_color: str):
    return colors.HexColor(f"#{hex_color}")


def pdf_styles() -> dict[str, ParagraphStyle]:
    regular, bold = register_pdf_fonts()
    paper = pdf_color(PAPER)
    ink = pdf_color(INK)
    teal = pdf_color(TEAL)
    teal_dark = pdf_color(TEAL_DARK)
    mid = pdf_color(MID)
    return {
        "cover_eyebrow": ParagraphStyle("cover_eyebrow", fontName=bold, fontSize=10, leading=14, textColor=teal, alignment=TA_CENTER, spaceAfter=12),
        "cover_title": ParagraphStyle("cover_title", fontName=bold, fontSize=27, leading=32, textColor=paper, alignment=TA_CENTER, spaceBefore=8, spaceAfter=12),
        "cover_body": ParagraphStyle("cover_body", fontName=regular, fontSize=12.5, leading=18, textColor=paper, alignment=TA_CENTER, spaceAfter=16),
        "cover_label": ParagraphStyle("cover_label", fontName=bold, fontSize=9, leading=13, textColor=pdf_color(GOLD), alignment=TA_CENTER),
        "academic_top": ParagraphStyle("academic_top", fontName=bold, fontSize=14, leading=20, textColor=ink, alignment=TA_CENTER, spaceAfter=3),
        "academic_sub": ParagraphStyle("academic_sub", fontName=regular, fontSize=11, leading=16, textColor=ink, alignment=TA_CENTER),
        "academic_title": ParagraphStyle("academic_title", fontName=bold, fontSize=19, leading=25, textColor=ink, alignment=TA_CENTER),
        "body": ParagraphStyle("body", fontName=regular, fontSize=9.6, leading=14.1, textColor=ink, alignment=TA_JUSTIFY, spaceAfter=8),
        "glossary": ParagraphStyle("glossary", fontName=regular, fontSize=10.5, leading=13.5, textColor=ink, alignment=TA_LEFT, spaceAfter=5),
        "ref": ParagraphStyle("ref", fontName=regular, fontSize=8.7, leading=12.2, textColor=ink, alignment=TA_LEFT, leftIndent=17, firstLineIndent=-17, spaceAfter=8),
        "note": ParagraphStyle("note", fontName=regular, fontSize=8.7, leading=12, textColor=mid, alignment=TA_LEFT, spaceBefore=10),
        "h1": ParagraphStyle("h1", fontName=bold, fontSize=20, leading=24, textColor=teal_dark, alignment=TA_LEFT, spaceBefore=2, spaceAfter=11, keepWithNext=True),
        "h2": ParagraphStyle("h2", fontName=bold, fontSize=13, leading=17, textColor=ink, alignment=TA_LEFT, spaceBefore=12, spaceAfter=6, keepWithNext=True),
        "index": ParagraphStyle("index", fontName=bold, fontSize=22, leading=26, textColor=teal_dark, alignment=TA_LEFT),
        "list": ParagraphStyle("list", fontName=regular, fontSize=9.7, leading=14.2, textColor=ink, leftIndent=22, firstLineIndent=-16, spaceAfter=7),
    }


class ReportPDF(BaseDocTemplate):
    def __init__(self, filename: Path, styles: dict[str, ParagraphStyle]):
        super().__init__(str(filename), pagesize=letter, title="Diff — Informe académico", author="")
        self.styles_map = styles
        width, height = letter
        self.addPageTemplates([
            PageTemplate("cover", [Frame(0.55 * inch, 0.55 * inch, width - 1.1 * inch, height - 1.1 * inch, id="cover")], onPage=self.draw_cover),
            PageTemplate("academic", [Frame(0.92 * inch, 0.75 * inch, width - 1.84 * inch, height - 1.5 * inch, id="academic")]),
            PageTemplate("frontmatter", [Frame(0.95 * inch, 0.8 * inch, width - 1.9 * inch, height - 1.6 * inch, id="frontmatter")]),
            PageTemplate("bodyTwo", self.two_column_frames(width, height), onPage=self.draw_body),
            PageTemplate("body", [Frame(0.95 * inch, 0.72 * inch, width - 1.9 * inch, height - 1.55 * inch, id="body")], onPage=self.draw_body),
        ])

    @staticmethod
    def two_column_frames(width, height):
        left = 0.78 * inch
        right = 0.78 * inch
        bottom = 0.72 * inch
        top = 0.93 * inch
        gutter = 0.30 * inch
        col_width = (width - left - right - gutter) / 2
        col_height = height - top - bottom
        return [
            Frame(left, bottom, col_width, col_height, id="glossary-left", leftPadding=0, rightPadding=0.07 * inch, topPadding=0, bottomPadding=0),
            Frame(left + col_width + gutter, bottom, col_width, col_height, id="glossary-right", leftPadding=0.07 * inch, rightPadding=0, topPadding=0, bottomPadding=0),
        ]

    def draw_cover(self, canvas, doc):
        width, height = letter
        canvas.saveState()
        canvas.setFillColor(pdf_color(INK))
        canvas.rect(0, 0, width, height, fill=1, stroke=0)
        canvas.setFillColor(pdf_color(TEAL))
        canvas.rect(0, height - 8, width, 8, fill=1, stroke=0)
        canvas.setFillColor(pdf_color(GOLD))
        canvas.rect(0.55 * inch, 0.56 * inch, width - 1.1 * inch, 2, fill=1, stroke=0)
        canvas.restoreState()

    def draw_body(self, canvas, doc):
        page = canvas.getPageNumber() - 5
        canvas.saveState()
        canvas.setStrokeColor(pdf_color(TEAL_DARK))
        canvas.setLineWidth(0.7)
        canvas.line(0.78 * inch, letter[1] - 0.57 * inch, letter[0] - 0.78 * inch, letter[1] - 0.57 * inch)
        canvas.setFont("DiffSans-Bold", 8)
        canvas.setFillColor(pdf_color(TEAL_DARK))
        canvas.drawString(0.78 * inch, letter[1] - 0.47 * inch, "DIFF")
        canvas.setFont("DiffSans", 7.3)
        canvas.setFillColor(pdf_color(MID))
        canvas.drawRightString(letter[0] - 0.78 * inch, letter[1] - 0.47 * inch, "PROYECTO ACADÉMICO · SEMINARIO PROFESIONAL 2")
        canvas.setStrokeColor(colors.HexColor("#C9D2D5"))
        canvas.line(0.78 * inch, 0.52 * inch, letter[0] - 0.78 * inch, 0.52 * inch)
        canvas.setFont("DiffSans", 7.5)
        canvas.setFillColor(pdf_color(MID))
        canvas.drawString(0.78 * inch, 0.36 * inch, "Plataforma web de análisis y práctica")
        canvas.drawRightString(letter[0] - 0.78 * inch, 0.36 * inch, f"Página {page}")
        canvas.restoreState()


def build_pdf(glossary: list[tuple[str, str]]) -> None:
    styles = pdf_styles()
    doc = ReportPDF(PDF_PATH, styles)
    story = [
        Spacer(1, 1.15 * inch),
        Paragraph("DIAGNÓSTICO · PRÁCTICA · PROGRESO", styles["cover_eyebrow"]),
    ]
    image = PDFImage(str(BRAND_IMAGE), width=4.8 * inch, height=2.4 * inch, kind="proportional")
    image.hAlign = "CENTER"
    story.extend([
        image,
        Spacer(1, 0.2 * inch),
        Paragraph("Del análisis de partidas a la práctica personal", styles["cover_title"]),
        Paragraph("Datos de League of Legends convertidos en un diagnóstico comprensible, recomendaciones explicables y ejercicios con seguimiento.", styles["cover_body"]),
        Spacer(1, 0.15 * inch),
        Paragraph("TRABAJO ACADÉMICO · SEMINARIO PROFESIONAL 2", styles["cover_label"]),
        NextPageTemplate("academic"),
        PageBreak(),
        Spacer(1, 0.3 * inch),
        Paragraph("UNIVERSIDAD GALILEO", styles["academic_top"]),
        Paragraph("Ingeniería en Sistemas", styles["academic_sub"]),
        Paragraph("Seminario Profesional 2", styles["academic_sub"]),
        Spacer(1, 0.75 * inch),
        Paragraph("PLATAFORMA WEB PARA EL ANÁLISIS DEL RENDIMIENTO Y LA PLANIFICACIÓN DE PRÁCTICA EN LEAGUE OF LEGENDS", styles["academic_title"]),
        Spacer(1, 0.2 * inch),
        Paragraph("Informe académico", styles["academic_sub"]),
        Spacer(1, 0.33 * inch),
        Paragraph("Docente: Axel Benavides", styles["academic_sub"]),
        Spacer(1, 0.1 * inch),
        Paragraph("Integrantes:", styles["academic_sub"]),
        Spacer(1, 0.22 * inch),
        Paragraph("________________________________________________________________________________", styles["academic_sub"]),
        Spacer(1, 0.15 * inch),
        Paragraph("________________________________________________________________________________", styles["academic_sub"]),
        Spacer(1, 0.2 * inch),
        Paragraph("Lugar:", styles["academic_sub"]),
        Spacer(1, 0.2 * inch),
        Paragraph("________________________________________________________________________________", styles["academic_sub"]),
        Spacer(1, 0.2 * inch),
        Paragraph("Fecha de entrega:", styles["academic_sub"]),
        Spacer(1, 0.2 * inch),
        Paragraph("________________________________________________________________________________", styles["academic_sub"]),
        NextPageTemplate("frontmatter"),
        PageBreak(),
        Paragraph("Índice", styles["index"]),
        PageBreak(),
        Paragraph("Índice de figuras", styles["index"]),
        PageBreak(),
        Paragraph("Índice de tablas", styles["index"]),
        NextPageTemplate("bodyTwo"),
        PageBreak(),
        Paragraph("Glosario", styles["h1"]),
    ])

    for term, definition in glossary:
        story.append(KeepTogether([Paragraph(f"<b>{escape(term)}.</b> {escape(definition)}", styles["glossary"])]))

    story.extend([NextPageTemplate("body"), PageBreak(), Paragraph("Introducción", styles["h1"])])
    story.extend(Paragraph(paragraph, styles["body"]) for paragraph in INTRODUCTION)
    story.extend([
        PageBreak(),
        Paragraph("Objetivos", styles["h1"]),
        Paragraph("Objetivo general", styles["h2"]),
        Paragraph(GENERAL_OBJECTIVE, styles["body"]),
        Paragraph("Objetivos específicos", styles["h2"]),
    ])
    for index, objective in enumerate(SPECIFIC_OBJECTIVES, 1):
        story.append(KeepTogether([Paragraph(f"{index}. {escape(objective)}", styles["list"])]))

    story.extend([PageBreak(), Paragraph("Referencias", styles["h1"])])
    for index, (citation, url) in enumerate(REFERENCES, 1):
        citation = citation.replace("&amp;", "&")
        story.append(KeepTogether([Paragraph(f"[{index}] {citation}<br/><link href=\"{escape(url)}\" color=\"#{TEAL_DARK}\">Consultar fuente</link>", styles["ref"])]))
    story.append(Paragraph("Diff es un proyecto académico independiente. Riot Games no patrocina ni avala este trabajo.", styles["note"]))
    doc.build(story)


def build_docx(glossary: list[tuple[str, str]]) -> None:
    add_docx_body(glossary)


def main() -> None:
    if not BRAND_IMAGE.exists():
        raise FileNotFoundError(f"No se encontró el wordmark seleccionado: {BRAND_IMAGE}")
    glossary = academy_glossary()
    validate_content(glossary)
    build_docx(glossary)
    build_pdf(glossary)
    print(f"DOCX: {DOCX_PATH}")
    print(f"PDF:  {PDF_PATH}")


if __name__ == "__main__":
    main()
