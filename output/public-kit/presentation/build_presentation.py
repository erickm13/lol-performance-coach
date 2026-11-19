from __future__ import annotations

from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PDF = OUT / "diff-propuesta-academica.pdf"
PREVIEWS = OUT / "render-previews"
W, H = 960, 540
TOTAL = 13

BG = HexColor("#0A0E12")
PANEL = HexColor("#121A20")
PANEL2 = HexColor("#172229")
LINE = HexColor("#2A3A42")
TEXT = HexColor("#E7EEF0")
MUTED = HexColor("#A9B8BE")
TEAL = HexColor("#3ED6C4")
GOLD = HexColor("#D4A45C")
BLUE = HexColor("#8BC9E2")

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
pdfmetrics.registerFont(TTFont("Diff", FONT_REG))
pdfmetrics.registerFont(TTFont("Diff-Bold", FONT_BOLD))


SOURCES = {
    "R1": (
        "Riot Developer Portal: LoL docs / API reference",
        [
            "https://developer.riotgames.com/docs/lol",
            "https://developer.riotgames.com/apis#match-v5",
        ],
    ),
    "R2": (
        "Riot: Season Update — Replays and Practice (2017)",
        ["https://na.leagueoflegends.com/en/featured/preseason-2017/replays-and-practice"],
    ),
    "O1": (
        "OP.GG: Viewing detailed match data",
        ["https://help.op.gg/hc/en-us/articles/31091817743129-Viewing-detailed-match-data"],
    ),
    "O2": (
        "OP.GG: Getting Started with the OP.GG App",
        ["https://help.op.gg/hc/en-us/articles/48467238743961-Getting-Started-with-the-OP.GG-App"],
    ),
    "M1": (
        "Mobalytics: Gamer Performance Index",
        ["https://mobalytics.gg/gpi/"],
    ),
    "M2": (
        "Mobalytics: League app guide",
        ["https://mobalytics.gg/lol/guides/mobalytics-beginners-guide"],
    ),
    "M3": (
        "Mobalytics: League of Legends guides",
        ["https://mobalytics.gg/lol/guides"],
    ),
    "M4": (
        "Mobalytics: Challenges; disponibilidad actual incierta",
        [
            "https://mobalytics.gg/lol/lp/gpi",
            "https://mobalytics.gg/blog/dev-blog-mobalytics-challenges/",
            "https://mobalytics.gg/lol/guides/mobalytics-beginners-guide",
        ],
    ),
    "B1": (
        "Blitz: current homepage and League page",
        ["https://blitz.gg/", "https://blitz.gg/lol"],
    ),
    "H3": (
        "Deliberate practice research and meta-analysis (1993, 2014)",
        [
            "https://doi.org/10.1037/0033-295X.100.3.363",
            "https://www.psychologicalscience.org/journals/psychological-science/0956797614535810/",
        ],
    ),
}


def wrap(text: str, font: str, size: float, width: float) -> list[str]:
    result: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            result.append("")
            continue
        line = ""
        for word in paragraph.split():
            candidate = word if not line else f"{line} {word}"
            if pdfmetrics.stringWidth(candidate, font, size) <= width:
                line = candidate
                continue
            if line:
                result.append(line)
                line = ""
            if pdfmetrics.stringWidth(word, font, size) <= width:
                line = word
            else:
                part = ""
                for char in word:
                    candidate = part + char
                    if part and pdfmetrics.stringWidth(candidate, font, size) > width:
                        result.append(part)
                        part = char
                    else:
                        part = candidate
                line = part
        if line:
            result.append(line)
    return result


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    top: float,
    width: float,
    *,
    size: float = 20,
    leading: float | None = None,
    color: HexColor = TEXT,
    bold: bool = False,
    align: str = "left",
) -> float:
    font = "Diff-Bold" if bold else "Diff"
    leading = leading or size * 1.32
    lines = wrap(text, font, size, width)
    c.setFillColor(color)
    c.setFont(font, size)
    y = top - size
    for line in lines:
        if align == "center":
            c.drawCentredString(x + width / 2, y, line)
        elif align == "right":
            c.drawRightString(x + width, y, line)
        else:
            c.drawString(x, y, line)
        y -= leading
    return y + leading


def round_card(c: canvas.Canvas, x: float, y: float, w: float, h: float, *, fill=PANEL, stroke=LINE, radius=16):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def background(c: canvas.Canvas):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(TEAL)
    c.rect(0, H - 4, W, 4, stroke=0, fill=1)


def header(c: canvas.Canvas, section: str, title: str, page: int):
    background(c)
    c.setFont("Diff-Bold", 12.5)
    c.setFillColor(TEAL)
    c.drawString(56, 503, section.upper())
    draw_text(c, title, 56, 485, 846, size=33, leading=37, bold=True)
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(56, 45, 904, 45)
    c.setFont("Diff-Bold", 11.8)
    c.setFillColor(MUTED)
    c.drawRightString(904, 23, f"{page:02d} / {TOTAL}")


def footer_refs(c: canvas.Canvas, refs: str):
    c.setFont("Diff", 12)
    c.setFillColor(MUTED)
    c.drawString(56, 23, refs)


def dot(c: canvas.Canvas, x: float, y: float, color=TEAL, r: float = 7):
    c.setFillColor(color)
    c.circle(x, y, r, stroke=0, fill=1)


def draw_cover(c: canvas.Canvas):
    background(c)
    # The supplied wordmark is kept at its original 2:1 aspect ratio.
    logo_path = ROOT / "output/branding/diff/v1/04-wordmark-dark-background.png"
    logo = ImageReader(str(logo_path))
    c.drawImage(logo, 56, 288, width=390, height=195, preserveAspectRatio=True, mask="auto")
    c.setFillColor(GOLD)
    c.roundRect(498, 432, 92, 5, 2, stroke=0, fill=1)
    draw_text(c, "Del análisis\na la práctica", 498, 410, 392, size=44, leading=51, bold=True)
    draw_text(
        c,
        "Una propuesta para pasar de señales a práctica explicable y con seguimiento.",
        500,
        292,
        390,
        size=18,
        leading=23,
        color=MUTED,
    )
    c.setFillColor(TEAL)
    c.setFont("Diff-Bold", 13.5)
    c.drawString(56, 232, "PROYECTO ACADÉMICO  ·  LEAGUE OF LEGENDS")
    c.setStrokeColor(LINE)
    c.line(56, 224, 904, 224)
    fields = [
        (56, 196, "UNIVERSIDAD", "Universidad Galileo", 360),
        (500, 196, "CURSO", "Seminario Profesional 2", 360),
        (56, 145, "CARRERA", "Ingeniería en Sistemas", 360),
        (500, 145, "DOCENTE", "Axel Benavides", 360),
    ]
    for x, label_y, label, value, width in fields:
        c.setFont("Diff-Bold", 12.5)
        c.setFillColor(MUTED)
        c.drawString(x, label_y, label)
        draw_text(c, value, x, label_y - 16, width, size=17, leading=21, bold=True)
    c.setStrokeColor(LINE)
    c.line(56, 96, 904, 96)
    draw_text(c, "Equipo: __________________________", 56, 80, 385, size=15.5, color=MUTED)
    draw_text(c, "Fecha: __________________________", 500, 80, 404, size=15.5, color=MUTED)
    c.showPage()


def draw_problem(c: canvas.Canvas):
    header(c, "Problema", "¿Qué patrón merece convertirse en práctica?", 2)
    draw_text(c, "Hipótesis de fricción por validar con jugadores", 56, 423, 848, size=16, color=MUTED)
    cards = [
        (56, "INTERPRETAR CON CONTEXTO", "Leer una métrica junto con el rol, la partida y el momento en que ocurrió."),
        (347, "PRIORIZAR UN PATRÓN", "Cuando varias señales se repiten, decidir cuál trabajar primero puede ser difícil."),
        (638, "PASAR A LA PRÁCTICA", "Convertir la revisión en un ejercicio concreto y una forma de darle seguimiento."),
    ]
    for i, (x, title, body) in enumerate(cards):
        accent = TEAL if i != 1 else GOLD
        round_card(c, x, 169, 266, 201, fill=PANEL if i != 1 else PANEL2)
        c.setFillColor(accent)
        draw_text(c, title, x + 20, 342, 226, size=14.5, leading=19, bold=True, color=accent)
        c.setStrokeColor(LINE)
        c.line(x + 20, 303, x + 246, 303)
        draw_text(c, body, x + 20, 282, 226, size=18, leading=24)
    round_card(c, 56, 76, 848, 66, fill=PANEL2)
    c.setFillColor(GOLD)
    c.setFont("Diff-Bold", 13.5)
    c.drawString(76, 115, "OPORTUNIDAD PARA DIFF")
    draw_text(c, "Conectar patrones recientes con un foco semanal explicable y una lista de seguimiento.", 294, 132, 586, size=17, leading=21)
    c.showPage()


def draw_current(c: canvas.Canvas):
    header(c, "Solución actual", "Recursos para revisar y aprender", 3)
    cards = [
        (56, 250, "REPETIR Y OBSERVAR", "Jugar otra partida mirando si una situación vuelve a aparecer.", "Alternativa de práctica", TEAL),
        (492, 250, "REVISAR HISTORIAL O REPLAY", "Revisar una jugada y anotar qué decisión se quiere entender.", "[R2]", GOLD),
        (56, 94, "VER UN TUTORIAL O GUÍA", "Aprender un concepto y buscar ejemplos en una partida.", "[M3]", GOLD),
        (492, 94, "PEDIR UNA REVISIÓN", "Compartir una jugada y conversar sobre las decisiones tomadas.", "Alternativa de acompañamiento", TEAL),
    ]
    for x, y, eyebrow, body, ref, accent in cards:
        round_card(c, x, y, 412, 138)
        c.setFillColor(accent)
        c.setFont("Diff-Bold", 13.5)
        c.drawString(x + 22, y + 108, eyebrow)
        draw_text(c, body, x + 22, y + 91, 368, size=18.5, leading=24)
        c.setFont("Diff-Bold", 12.5)
        c.setFillColor(MUTED)
        c.drawString(x + 22, y + 18, ref)
    footer_refs(c, "La oportunidad explorada por Diff: conectar análisis personal con una rutina explicable.")
    c.showPage()


def draw_landscape(c: canvas.Canvas):
    header(c, "¿Qué hay?", "Datos, herramientas y aprendizaje", 4)
    cards = [
        (56, 250, "DATOS Y REPLAYS", "Riot documenta APIs de partidas, datos del cliente y controles de replay.", "[R1] [R2]", TEAL),
        (492, 250, "ANÁLISIS Y PREPARACIÓN", "OP.GG y Mobalytics describen análisis personal, preparación y overlays.", "[O1] [O2] [M1] [M2]", GOLD),
        (56, 94, "CONTENIDO EDUCATIVO", "Guías disponibles ayudan a estudiar conceptos del juego.", "[M3]", GOLD),
        (492, 94, "PRÁCTICA Y FEEDBACK", "Práctica estructurada y feedback: los efectos varían por dominio.", "[H3]", TEAL),
    ]
    for x, y, eyebrow, body, ref, accent in cards:
        round_card(c, x, y, 412, 138)
        c.setFillColor(accent)
        c.setFont("Diff-Bold", 13.5)
        c.drawString(x + 22, y + 108, eyebrow)
        draw_text(c, body, x + 22, y + 91, 368, size=18.3, leading=23.5)
        c.setFont("Diff-Bold", 12.5)
        c.setFillColor(MUTED)
        c.drawString(x + 22, y + 18, ref)
    footer_refs(c, "El acceso a datos depende de las fuentes, sus permisos y sus límites. [R1]")
    c.showPage()


def draw_competitors(c: canvas.Canvas):
    header(c, "Competidores", "Capacidades y evidencia por producto", 5)
    cards = [
        (
            56,
            "OP.GG",
            "Análisis de partidas, VOD, estadísticas, heatmaps y cronologías. La app también documenta builds y overlay.",
            "[O1] [O2]",
            "Funciones descritas en el producto",
            TEAL,
        ),
        (
            347,
            "Mobalytics",
            "GPI, recomendaciones de build, overlay y guías. Sus materiales mencionan Challenges; la disponibilidad actual es incierta.",
            "[M1] [M2] [M3] [M4]",
            "Buen alcance personal y educativo documentado",
            GOLD,
        ),
        (
            638,
            "Blitz",
            "La página actual hace afirmaciones generales sobre estadísticas, meta y overlay. El flujo específico de LoL no se verificó.",
            "[B1]",
            "Evidencia específica de LoL limitada",
            BLUE,
        ),
    ]
    for x, name, body, refs, note, accent in cards:
        round_card(c, x, 106, 266, 303)
        c.setFillColor(accent)
        c.setFont("Diff-Bold", 27)
        c.drawString(x + 22, 371, name)
        c.setStrokeColor(LINE)
        c.line(x + 22, 352, x + 244, 352)
        draw_text(c, note, x + 22, 334, 222, size=15.3, leading=20, bold=True, color=accent)
        draw_text(c, body, x + 22, 274, 222, size=17, leading=23)
        c.setFont("Diff-Bold", 12.5)
        c.setFillColor(MUTED)
        c.drawString(x + 22, 126, refs)
    footer_refs(c, "No verificado en las fuentes consultadas no significa que la función esté ausente.")
    c.showPage()


def draw_solution(c: canvas.Canvas):
    header(c, "Nuestra solución", "Del historial a una rutina semanal", 6)
    draw_text(c, "Flujo implementado en el prototipo académico de Diff", 56, 426, 848, size=20, color=MUTED)
    xs = [56, 272, 488, 704]
    steps = [
        ("01", "LEER", "Importa las últimas 10 partidas."),
        ("02", "INTERPRETAR", "Reglas y referencias por rol detectan patrones; la muestra puede mezclar roles."),
        ("03", "PRACTICAR", "Reglas eligen foco y ejercicios. Un modelo de lenguaje explica el plan; una lista registra avance."),
        ("04", "REVISAR", "IA apoya la revisión del mapa por evento; chat, Academy y preparación."),
    ]
    for i, (x, (num, verb, body)) in enumerate(zip(xs, steps)):
        round_card(c, x, 147, 200, 238, fill=PANEL if i % 2 == 0 else PANEL2)
        c.setFillColor(GOLD if i % 2 == 0 else TEAL)
        c.setFont("Diff-Bold", 16)
        c.drawString(x + 20, 354, num)
        c.setFillColor(TEXT)
        c.setFont("Diff-Bold", 19)
        c.drawString(x + 20, 323, verb)
        c.setStrokeColor(LINE)
        c.line(x + 20, 306, x + 180, 306)
        draw_text(c, body, x + 20, 288, 160, size=17.2, leading=22.5)
        if i < 3:
            c.setStrokeColor(TEAL)
            c.setLineWidth(2)
            c.line(x + 202, 266, x + 214, 266)
            c.line(x + 208, 272, x + 214, 266)
            c.line(x + 208, 260, x + 214, 266)
    footer_refs(c, "Funciones implementadas en el prototipo académico de Diff.")
    c.showPage()


def draw_product_map(c: canvas.Canvas):
    header(c, "Vista del producto", "La partida, vista en el mapa", 7)
    image_path = ROOT / "frontend/public/previews/match-analysis.png"
    image = ImageReader(str(image_path))
    iw, ih = image.getSize()
    box = (56, 91, 612, 389)
    scale = min(box[2] / iw, box[3] / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(image, box[0], box[1] + (box[3] - dh) / 2, width=dw, height=dh, preserveAspectRatio=True, mask="auto")
    round_card(c, 692, 91, 212, 389)
    c.setFillColor(TEAL)
    c.setFont("Diff-Bold", 14)
    c.drawString(712, 446, "VISTA DEL PROTOTIPO")
    draw_text(c, "Eventos y rutas sobre el mapa de la partida.", 712, 418, 172, size=19, leading=25, bold=True)
    c.setStrokeColor(LINE)
    c.line(712, 312, 884, 312)
    draw_text(c, "Función descrita: revisión asistida por IA para analizar eventos del mapa.", 712, 294, 172, size=17.2, leading=23)
    c.setFillColor(GOLD)
    c.setFont("Diff-Bold", 13.5)
    c.drawString(712, 163, "LÍMITE DE LECTURA")
    draw_text(c, "Un marcador aislado no prueba una causa ni un resultado.", 712, 152, 172, size=15.5, leading=20.5, color=MUTED)
    footer_refs(c, "Vista ilustrativa de la revisión de una partida en Diff.")
    c.showPage()


def draw_general_objective(c: canvas.Canvas):
    header(c, "Objetivos", "Objetivo general", 8)
    round_card(c, 72, 145, 816, 273, fill=PANEL2)
    c.setFillColor(GOLD)
    c.roundRect(102, 376, 74, 5, 2, stroke=0, fill=1)
    objective = (
        "Desarrollar y evaluar una plataforma web que transforme los datos de partidas de League of Legends en un diagnóstico comprensible y un plan de práctica personalizado, explicable y con seguimiento de cumplimiento."
    )
    draw_text(c, objective, 102, 350, 756, size=26, leading=34, bold=True)
    draw_text(c, "El proyecto no promete mejoras de rango o tasa de victoria.", 72, 108, 816, size=17.5, color=MUTED, align="center")
    footer_refs(c, "Objetivo compartido con el documento del proyecto.")
    c.showPage()


def draw_specific_objectives(c: canvas.Canvas):
    header(c, "Objetivos", "Objetivos específicos", 9)
    objectives = [
        "Integrar datos de partidas y perfil obtenidos mediante servicios oficiales de Riot Games, dentro de los permisos y límites aplicables.",
        "Calcular métricas de desempeño y detectar patrones con reglas explícitas y referencias internas diferenciadas por rol.",
        "Generar recomendaciones de práctica explicadas en lenguaje claro por un modelo de lenguaje y ancladas en las métricas y patrones calculados.",
        "Facilitar la revisión de partidas y el acceso a contenidos educativos pertinentes a los hallazgos.",
        "Registrar el cumplimiento de los ejercicios para dar seguimiento a la práctica.",
        "Validar el funcionamiento con pruebas técnicas y planificar una futura validación de usabilidad con participantes, documentando alcance y límites.",
    ]
    positions = [(56, 279), (492, 279), (56, 171), (492, 171), (56, 63), (492, 63)]
    for i, (text, (x, y)) in enumerate(zip(objectives, positions), start=1):
        round_card(c, x, y, 412, 100, fill=PANEL if i % 2 else PANEL2)
        c.setFillColor(TEAL if i % 2 else GOLD)
        c.circle(x + 28, y + 50, 15, stroke=0, fill=1)
        c.setFillColor(BG)
        c.setFont("Diff-Bold", 11.5)
        c.drawCentredString(x + 28, y + 46, f"{i:02d}")
        draw_text(c, text, x + 55, y + 84, 338, size=15.3, leading=18.5)
    footer_refs(c, "Texto completo alineado con los seis objetivos entregados para el documento.")
    c.showPage()


def draw_matrix(c: canvas.Canvas):
    header(c, "Matriz comparativa", "Comparación de capacidades y evidencia", 10)
    x0, top = 56, 408
    widths = [252, 149, 149, 149, 149]
    header_h, row_h = 42, 40
    headers = ["Dimensión", "OP.GG", "Mobalytics", "Blitz", "Diff"]
    xx = x0
    for idx, (label, width) in enumerate(zip(headers, widths)):
        c.setFillColor(PANEL2 if idx else HexColor("#1B2930"))
        c.setStrokeColor(LINE)
        c.rect(xx, top - header_h, width, header_h, stroke=1, fill=1)
        draw_text(c, label, xx + 8, top - 8, width - 16, size=15.5, leading=18, bold=True, color=TEAL if idx else TEXT, align="center" if idx else "left")
        xx += width
    rows = [
        ("Análisis personal de partidas", "Doc. [O1]", "Doc. [M1]", "General [B1]", "P"),
        ("Builds y meta global", "Doc. [O2]", "Doc. [M2]", "General [B1]", "No evaluado"),
        ("Preparación / overlay", "Doc. [O2]", "Doc. [M2]", "General [B1]", "Preparación web; sin overlay"),
        ("Contenido educativo", "NV", "Doc. [M3]", "NV", "P"),
        ("Práctica y seguimiento", "NV", "Incierta [M4]", "NV", "P"),
        ("Mapa / línea de tiempo", "Doc. [O1]", "NV", "NV", "P"),
    ]
    for r, row in enumerate(rows):
        y_top = top - header_h - r * row_h
        xx = x0
        for col, (value, width) in enumerate(zip(row, widths)):
            c.setFillColor(PANEL if r % 2 == 0 else BG)
            c.setStrokeColor(LINE)
            c.rect(xx, y_top - row_h, width, row_h, stroke=1, fill=1)
            color = TEXT if col == 0 else (TEAL if value == "P" or value.startswith("Preparación") else GOLD if value == "No evaluado" else MUTED)
            font_size = 15.2 if col == 0 else 14.1
            draw_text(c, value, xx + (10 if col == 0 else 5), y_top - 3, width - (20 if col == 0 else 10), size=font_size, leading=16.3, color=color, bold=(col == 0 or value in {"P", "No evaluado"}), align="left" if col == 0 else "center")
            xx += width
    draw_text(c, "Doc. = documentada en fuentes · General = declaración general en la web de Blitz; flujo de LoL no confirmado.", 56, 116, 848, size=12.7, leading=15.5, color=MUTED)
    draw_text(c, "NV = no verificado, no indica ausencia · P = función implementada en el prototipo · No evaluado = servicio global de meta.", 56, 98, 848, size=12.7, leading=15.5, color=MUTED)
    draw_text(c, "Challenges de Mobalytics: disponibilidad actual incierta [M4]. Sugerencias puntuales de Diff no son un servicio global.", 56, 80, 848, size=12.7, leading=15.5, color=GOLD)
    footer_refs(c, "Fuentes por capacidad: [O1] [O2] [M1–M4] [B1] · Diff: prototipo académico.")
    c.showPage()


def draw_scope(c: canvas.Canvas):
    header(c, "Alcance y validación", "Qué existe, qué falta y qué sigue", 11)
    cards = [
        (
            56,
            "IMPLEMENTADO",
            [
                "10 partidas; muestra mixta; referencias por rol.",
                "Reglas eligen foco y ejercicios; un modelo explica el plan.",
                "Mapa con IA por evento; chat, Academy, preparación web sin overlay y ranking voluntario.",
            ],
            TEAL,
        ),
        (
            347,
            "SIGUIENTE TRABAJO",
            [
                "Separar 10 partidas por rol.",
                "Simplificar el registro.",
                "Son pasos próximos, aún no implementados.",
            ],
            GOLD,
        ),
        (
            638,
            "VALIDACIÓN POR AMPLIAR",
            [
                "Hay pruebas automatizadas; ampliar la validación integral.",
                "Preparar un piloto con jugadores y medir comprensión y utilidad.",
                "No se dispone aún de resultados de piloto.",
            ],
            BLUE,
        ),
    ]
    for x, title, bullets, accent in cards:
        round_card(c, x, 91, 266, 324)
        c.setFillColor(accent)
        draw_text(c, title, x + 20, 385, 226, size=14.3, leading=18, bold=True, color=accent)
        c.setStrokeColor(LINE)
        c.line(x + 20, 349, x + 246, 349)
        cursor = 329
        for bullet in bullets:
            dot(c, x + 26, cursor - 10, accent, 4)
            cursor = draw_text(c, bullet, x + 40, cursor, 202, size=16, leading=19) - 6
    c.showPage()


def draw_close(c: canvas.Canvas):
    background(c)
    c.setFillColor(TEAL)
    c.setFont("Diff-Bold", 13.5)
    c.drawString(56, 489, "DIFF  ·  CIERRE")
    round_card(c, 72, 176, 816, 242, fill=PANEL2)
    draw_text(c, "¿Qué señal de mis últimas partidas merece convertirse en la práctica de esta semana?", 117, 365, 726, size=35, leading=45, bold=True, align="center")
    c.setStrokeColor(GOLD)
    c.setLineWidth(4)
    c.line(422, 216, 538, 216)
    draw_text(c, "Revisar → elegir un foco → practicar → dar seguimiento", 100, 195, 760, size=21, leading=27, color=MUTED, align="center")
    draw_text(c, "Propuesta académica para League of Legends", 56, 113, 848, size=17.5, color=MUTED, align="center")
    c.setStrokeColor(LINE)
    c.line(56, 45, 904, 45)
    c.setFont("Diff-Bold", 11.8)
    c.drawString(56, 23, "UNIVERSIDAD GALILEO  ·  INGENIERÍA EN SISTEMAS")
    c.drawRightString(904, 23, f"12 / {TOTAL}")
    c.showPage()


def source_url_lines(url: str, width: float, size: float = 11.8) -> list[str]:
    lines: list[str] = []
    line = ""
    for piece in [url.split("/")[0], *["/" + part for part in url.split("/")[1:]]]:
        candidate = line + piece
        if pdfmetrics.stringWidth(candidate, "Diff", size) <= width:
            line = candidate
            continue
        if line:
            lines.append(line)
            line = ""
        if pdfmetrics.stringWidth(piece, "Diff", size) <= width:
            line = piece
            continue
        fragment = ""
        for char in piece:
            candidate = fragment + char
            if fragment and pdfmetrics.stringWidth(candidate, "Diff", size) > width:
                lines.append(fragment)
                fragment = char
            else:
                fragment = candidate
        line = fragment
    if line:
        lines.append(line)
    return lines


def draw_source_item(c: canvas.Canvas, x: float, top: float, width: float, source_id: str, *, size=11.8, title_size=14.3, link_color=BLUE) -> float:
    title, urls = SOURCES[source_id]
    c.setFillColor(TEAL)
    c.setFont("Diff-Bold", 12.8)
    c.drawString(x, top - 13, f"[{source_id}]")
    title_lines = wrap(title, "Diff-Bold", title_size, width - 46)
    c.setFillColor(TEXT)
    c.setFont("Diff-Bold", title_size)
    y = top - 13
    for line in title_lines:
        y -= 17
        c.drawString(x + 46, y, line)
    y -= 3
    for url in urls:
        lines = source_url_lines(url, width - 46, size)
        c.setFont("Diff", size)
        c.setFillColor(link_color)
        for line in lines:
            y -= 14
            c.drawString(x + 46, y, line)
            line_width = min(pdfmetrics.stringWidth(line, "Diff", size), width - 46)
            c.linkURL(url, (x + 46, y - 2, x + 46 + line_width, y + size + 1), relative=0, thickness=0)
    return top - y + 5


def draw_sources(c: canvas.Canvas):
    header(c, "Fuentes", "Fuentes de datos y productos", 13)
    draw_text(c, "Las páginas de producto describen funciones; no son pruebas independientes de funcionamiento.", 56, 428, 848, size=16, color=MUTED)
    columns = [(56, ["R1", "R2", "O1", "O2", "B1"]), (492, ["M1", "M2", "M3", "M4", "H3"])]
    for x, ids in columns:
        y = 410
        for source_id in ids:
            used = draw_source_item(c, x, y, 412, source_id, size=11.8, title_size=14.1)
            y -= used
    footer_refs(c, "Fecha de consulta de todas las fuentes: 2026-10-30. Enlaces seleccionables en el PDF.")
    c.showPage()


def render_previews(pdf_path: Path):
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    assert len(doc) == TOTAL, f"Expected {TOTAL} pages, got {len(doc)}"
    thumbs = []
    for index, page in enumerate(doc, start=1):
        assert abs(page.rect.width - W) < 0.1 and abs(page.rect.height - H) < 0.1, page.rect
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
        path = PREVIEWS / f"slide-{index:02d}.png"
        pix.save(path)
        thumb = Image.open(path).convert("RGB")
        thumb.thumbnail((480, 270))
        tile = Image.new("RGB", (480, 292), "#10161B")
        tile.paste(thumb, ((480 - thumb.width) // 2, 18))
        ImageDraw.Draw(tile).text((14, 4), f"Slide {index:02d}", fill="#A9B8BE")
        thumbs.append(tile)
    for path in PREVIEWS.glob("slide-*.png"):
        try:
            if int(path.stem.split("-")[1]) > TOTAL:
                path.unlink()
        except (IndexError, ValueError):
            continue
    contact = Image.new("RGB", (480 * 3, 292 * 5), "#080B0E")
    for i, thumb in enumerate(thumbs):
        contact.paste(thumb, ((i % 3) * 480, (i // 3) * 292))
    contact.save(PREVIEWS / "contact-sheet.png")


def verify_pdf(pdf_path: Path):
    doc = pymupdf.open(pdf_path)
    assert len(doc) == TOTAL
    link_uris = set()
    for page_number, page in enumerate(doc, start=1):
        assert abs(page.rect.width - W) < 0.1 and abs(page.rect.height - H) < 0.1, (page_number, page.rect)
        link_uris.update(link.get("uri") for link in page.get_links() if link.get("uri"))
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    x0, y0, x1, y1 = span["bbox"]
                    assert x0 >= -0.2 and y0 >= -0.2 and x1 <= W + 0.2 and y1 <= H + 0.2, (page_number, span["text"], span["bbox"])
                    assert span["size"] >= 11.4, (page_number, span["text"], span["size"])
    text = " ".join(" ".join(page.get_text().split()) for page in doc).casefold()
    required = [
        "problema",
        "solución actual",
        "¿qué hay?",
        "competidores",
        "nuestra solución",
        "objetivo general",
        "objetivos específicos",
        "matriz comparativa",
        "preparación web; sin overlay",
        "no evaluado",
        "¿qué patrón merece convertirse en práctica?",
        "pruebas automatizadas",
        "disponibilidad actual incierta",
        "función implementada en el prototipo",
        "declaración general en la web de blitz",
        "flujo implementado en el prototipo académico de diff",
        "un modelo de lenguaje explica el plan",
        "ia apoya la revisión del mapa por evento",
        "no se dispone aún de resultados de piloto",
    ]
    missing = [item for item in required if item not in text]
    assert not missing, f"Required slide content missing: {missing}"
    forbidden = [item for item in ("brief", "frontend/public/", "claim general") if item in text]
    assert not forbidden, f"Internal process language leaked into the presentation: {forbidden}"
    exact_objectives = [
        "Desarrollar y evaluar una plataforma web que transforme los datos de partidas de League of Legends en un diagnóstico comprensible y un plan de práctica personalizado, explicable y con seguimiento de cumplimiento.",
        "Integrar datos de partidas y perfil obtenidos mediante servicios oficiales de Riot Games, dentro de los permisos y límites aplicables.",
        "Calcular métricas de desempeño y detectar patrones con reglas explícitas y referencias internas diferenciadas por rol.",
        "Generar recomendaciones de práctica explicadas en lenguaje claro por un modelo de lenguaje y ancladas en las métricas y patrones calculados.",
        "Facilitar la revisión de partidas y el acceso a contenidos educativos pertinentes a los hallazgos.",
        "Registrar el cumplimiento de los ejercicios para dar seguimiento a la práctica.",
        "Validar el funcionamiento con pruebas técnicas y planificar una futura validación de usabilidad con participantes, documentando alcance y límites.",
    ]
    missing_objectives = [objective for objective in exact_objectives if " ".join(objective.split()).casefold() not in text]
    assert not missing_objectives, f"Objective text differs from the approved wording: {missing_objectives}"
    expected_urls = {url for _, urls in SOURCES.values() for url in urls}
    assert expected_urls <= link_uris, f"Missing linked source URLs: {expected_urls - link_uris}"
    return len(doc), len(text)


def main():
    c = canvas.Canvas(str(PDF), pagesize=(W, H), pageCompression=1)
    c.setTitle("Diff — propuesta académica de práctica para League of Legends")
    c.setAuthor("Universidad Galileo · Ingeniería en Sistemas")
    c.setSubject("Seminario Profesional 2 · Diff")
    c.setKeywords("Diff, League of Legends, desempeño, práctica, Universidad Galileo")
    for draw in (
        draw_cover,
        draw_problem,
        draw_current,
        draw_landscape,
        draw_competitors,
        draw_solution,
        draw_product_map,
        draw_general_objective,
        draw_specific_objectives,
        draw_matrix,
        draw_scope,
        draw_close,
        draw_sources,
    ):
        draw(c)
    c.save()
    pages, text_chars = verify_pdf(PDF)
    render_previews(PDF)
    print(f"Created {PDF}")
    print(f"Verified {pages} 16:9 pages; extracted text: {text_chars} characters")
    print(f"Previews: {PREVIEWS}")


if __name__ == "__main__":
    main()
