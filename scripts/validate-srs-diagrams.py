#!/usr/bin/env python3
"""Validate generated SRS diagram sources and exports."""

from __future__ import annotations

from pathlib import Path
from struct import unpack
from xml.etree import ElementTree

from assets.srs_diagram_specs import USE_CASE_DIAGRAM_SPECS


ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "docs" / "assets" / "diagrams" / "specs"
OUTPUT_DIR = ROOT / "docs" / "assets" / "diagrams"


def expected_bases() -> list[str]:
    bases = ["figure-3-2-ai-knowledge-flow"]
    for spec in USE_CASE_DIAGRAM_SPECS:
        base = f'figure-{spec["number"]}-{spec["slug"]}'
        bases.extend([f"{base}-activity", f"{base}-sequence"])
    return bases


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) != 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Invalid PNG: {path}")
    return unpack(">II", data[16:24])


def validate_drawio(path: Path) -> list[str]:
    errors = []
    root = ElementTree.parse(path).getroot()
    diagrams = root.findall("diagram")
    if len(diagrams) != 1:
        errors.append(f"{path.name}: expected one page")
        return errors
    model = diagrams[0].find("mxGraphModel")
    if model is None:
        errors.append(f"{path.name}: missing mxGraphModel")
        return errors
    cells = model.findall("./root/mxCell")
    ids = [cell.get("id") for cell in cells]
    if len(ids) != len(set(ids)):
        errors.append(f"{path.name}: duplicate cell IDs")
    page_width = int(model.get("pageWidth", "0"))
    page_height = int(model.get("pageHeight", "0"))
    for cell in cells:
        geometry = cell.find("mxGeometry")
        if cell.get("vertex") != "1" or geometry is None:
            continue
        x = float(geometry.get("x", "0"))
        y = float(geometry.get("y", "0"))
        width = float(geometry.get("width", "0"))
        height = float(geometry.get("height", "0"))
        if x < 0 or y < 0 or x + width > page_width or y + height > page_height:
            errors.append(f'{path.name}: cell {cell.get("id")} exceeds canvas')
    is_sequence = path.stem.endswith("-sequence")
    for cell in cells:
        if cell.get("edge") != "1":
            continue
        style = cell.get("style", "")
        if is_sequence and "edgeStyle=none" not in style:
            errors.append(f'{path.name}: sequence edge {cell.get("id")} is not straight')
        if not is_sequence and "edgeStyle=orthogonalEdgeStyle" not in style:
            errors.append(f'{path.name}: activity edge {cell.get("id")} is not orthogonal')
    return errors


def main() -> None:
    errors = []
    for base in expected_bases():
        drawio = SPEC_DIR / f"{base}.drawio"
        svg = OUTPUT_DIR / f"{base}.svg"
        png = OUTPUT_DIR / f"{base}.png"
        for path in (drawio, svg, png):
            if not path.exists() or path.stat().st_size == 0:
                errors.append(f"Missing or empty: {path.relative_to(ROOT)}")
        if drawio.exists():
            errors.extend(validate_drawio(drawio))
        if svg.exists():
            try:
                ElementTree.parse(svg)
            except ElementTree.ParseError as error:
                errors.append(f"Invalid SVG {svg.name}: {error}")
        if png.exists():
            try:
                width, height = png_dimensions(png)
                if width < 800 or height < 1000:
                    errors.append(f"PNG too small: {png.name} ({width}x{height})")
            except ValueError as error:
                errors.append(str(error))
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Validated {len(expected_bases())} diagram sets")


if __name__ == "__main__":
    main()
