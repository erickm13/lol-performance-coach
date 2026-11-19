#!/usr/bin/env python3
"""Render the report cover, glossary, and objectives pages as PNG previews."""

from pathlib import Path

import pymupdf


HERE = Path(__file__).resolve().parent
PDF_PATH = HERE / "Diff_informe_academico_preview.pdf"
PREVIEW_DIR = HERE / "preview"


def find_page(document, predicate):
    for index, page in enumerate(document):
        if predicate(page.get_text()):
            return index
    raise ValueError("No se encontró una página que cumpla el criterio de vista previa")


def main():
    document = pymupdf.open(PDF_PATH)
    blank_indexes = {
        "index.png": "Índice",
        "index-figures.png": "Índice de figuras",
        "index-tables.png": "Índice de tablas",
    }
    pages = {
        "cover.png": find_page(document, lambda text: "DIAGNÓSTICO · PRÁCTICA · PROGRESO" in text),
        "formal-cover.png": find_page(document, lambda text: "UNIVERSIDAD GALILEO" in text),
        "glossary.png": find_page(document, lambda text: "Glosario" in text),
        "introduction.png": find_page(document, lambda text: "Introducción" in text),
        "objectives.png": find_page(document, lambda text: "Objetivo general" in text and "Objetivos específicos" in text),
        "references.png": find_page(document, lambda text: "Referencias" in text and "Consultar fuente" in text),
    }
    pages["glossary-last.png"] = pages["introduction.png"] - 1
    for filename, heading in blank_indexes.items():
        index = find_page(document, lambda text, title=heading: " ".join(text.split()) == title)
        pages[filename] = index
        actual = " ".join(document[index].get_text().split())
        if actual != heading:
            raise ValueError(f"La página de índice no está vacía: {actual}")

    PREVIEW_DIR.mkdir(exist_ok=True)
    for filename, index in pages.items():
        document[index].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False).save(PREVIEW_DIR / filename)
        print(f"{filename}: página {index + 1}")


if __name__ == "__main__":
    main()
