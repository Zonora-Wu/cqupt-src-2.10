#!/usr/bin/env python3
"""Generate editable draw.io sources for the remaining SRS diagrams."""

from __future__ import annotations

from html import escape
from pathlib import Path
from xml.etree import ElementTree

from assets.srs_diagram_specs import AI_KNOWLEDGE_FLOW_SPEC, USE_CASE_DIAGRAM_SPECS


ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "docs" / "assets" / "diagrams" / "specs"

LANE_X = [20, 280, 550, 820]
LANE_W = [260, 270, 270, 260]
LANE_CENTER = [150, 415, 685, 950]


def value(text: str) -> str:
    return escape(text, quote=True).replace("\n", "&lt;br&gt;")


def cell(cell_id: str, label: str, style: str, x: int, y: int, width: int, height: int) -> str:
    return (
        f'<mxCell id="{cell_id}" value="{value(label)}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>'
        "</mxCell>"
    )


def activity_edge(edge_id: str, source: str, target: str, label: str = "", style_extra: str = "") -> str:
    style = (
        "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5F5F5F;"
        "fontColor=#404040;fontSize=13;endArrow=block;endFill=1;" + style_extra
    )
    return (
        f'<mxCell id="{edge_id}" value="{value(label)}" edge="1" parent="1" '
        f'source="{source}" target="{target}" style="{style}">'
        '<mxGeometry relative="1" as="geometry"/></mxCell>'
    )


def drawio_file(page_id: str, page_name: str, model: str) -> str:
    return (
        '<mxfile host="app.diagrams.net" agent="Codex" version="26.0.16">'
        f'<diagram id="{page_id}" name="{value(page_name)}">{model}</diagram></mxfile>'
    )


def activity_model(spec: dict) -> str:
    lanes = spec.get("lanes") or [spec["actor"], "React 前端", spec["service"], spec["dependency"]]
    parts = [
        '<mxGraphModel dx="1100" dy="1540" grid="1" gridSize="10" guides="1" tooltips="1" '
        'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="1540" adaptiveColors="auto">',
        "<root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>",
    ]
    for index, (x, width, label) in enumerate(zip(LANE_X, LANE_W, lanes)):
        fill = "#FFFFFF" if index % 2 == 0 else "#F7F7F7"
        parts.append(cell(f"lane-{index}", "", f"shape=rect;html=1;fillColor={fill};strokeColor=#B3B3B3;", x, 20, width, 1480))
        parts.append(cell(
            f"head-{index}", label,
            "shape=rect;whiteSpace=wrap;html=1;fillColor=#E6E6E6;strokeColor=#808080;"
            "fontColor=#262626;fontStyle=1;fontSize=16;",
            x, 20, width, 58,
        ))

    action_style = "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#6B6B6B;fontColor=#262626;fontSize=14;"
    success_style = "rounded=0;whiteSpace=wrap;html=1;fillColor=#DCEBDD;strokeColor=#5B7F63;fontColor=#294530;fontSize=14;"
    failure_style = "rounded=0;whiteSpace=wrap;html=1;fillColor=#F2D9D7;strokeColor=#A25752;fontColor=#713B37;fontSize=14;"
    note_style = "shape=note;whiteSpace=wrap;html=1;fillColor=#F4E5BD;strokeColor=#A77D36;fontColor=#634A24;fontSize=13;"

    parts.append(cell("start", "", "ellipse;html=1;aspect=fixed;fillColor=#444444;strokeColor=#444444;", 132, 103, 36, 36))
    parts.append(cell("request", spec["request"], action_style, 45, 170, 210, 68))
    parts.append(cell("validate", spec["validate"], action_style, 310, 290, 210, 68))
    parts.append(cell("dependency", spec["dependency_call"], action_style, 580, 410, 210, 68))
    parts.append(cell(
        "decision", spec["decision"],
        "rhombus;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#6B6B6B;fontColor=#262626;fontSize=14;",
        620, 530, 130, 88,
    ))
    success_lanes = [2, 2, 1]
    success_y = [680, 800, 920]
    for index, (label, lane, y) in enumerate(zip(spec["success"], success_lanes, success_y), 1):
        x = LANE_X[lane] + (LANE_W[lane] - 210) // 2
        parts.append(cell(f"success-{index}", label, success_style, x, y, 210, 68))
    parts.append(cell("failure", spec["failure"], failure_style, 845, 680, 210, 72))
    parts.append(cell("failure-end", "", "ellipse;shape=doubleEllipse;html=1;aspect=fixed;fillColor=#FFFFFF;strokeColor=#A25752;", 932, 790, 36, 36))
    parts.append(cell("audit", spec["audit"], action_style, 845, 1040, 210, 68))
    parts.append(cell("result", "查看处理结果", success_style, 45, 1160, 210, 68))
    parts.append(cell("end", "", "ellipse;shape=doubleEllipse;html=1;aspect=fixed;fillColor=#FFFFFF;strokeColor=#5B7F63;", 132, 1270, 36, 36))
    parts.append(cell("note", spec["note"], note_style, 825, 1240, 235, 100))

    parts.extend([
        activity_edge("e1", "start", "request"),
        activity_edge("e2", "request", "validate"),
        activity_edge("e3", "validate", "dependency"),
        activity_edge("e4", "dependency", "decision"),
        activity_edge("e5", "decision", "success-1", "是", "exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#55725D;fontColor=#3D5944;"),
        activity_edge("e6", "decision", "failure", "否", "exitX=1;exitY=0.5;entryX=0.5;entryY=0;strokeColor=#A25752;fontColor=#713B37;"),
        activity_edge("e7", "success-1", "success-2", style_extra="strokeColor=#55725D;"),
        activity_edge("e8", "success-2", "success-3", style_extra="strokeColor=#55725D;"),
        activity_edge("e9", "success-3", "audit", style_extra="strokeColor=#55725D;"),
        activity_edge("e10", "audit", "result", style_extra="strokeColor=#55725D;"),
        activity_edge("e11", "result", "end", style_extra="strokeColor=#55725D;"),
        activity_edge("e12", "failure", "failure-end", style_extra="strokeColor=#A25752;"),
    ])
    parts.append("</root></mxGraphModel>")
    return "".join(parts)


def message(edge_id: str, source_x: int, target_x: int, y: int, label: str, kind: str = "call", color: str = "#555555") -> str:
    dashed = "dashed=1;" if kind == "return" else ""
    arrow = "open" if kind == "return" else "block"
    fill = "0" if kind == "return" else "1"
    style = (
        f"edgeStyle=none;html=1;{dashed}strokeColor={color};fontColor={color};fontSize=13;"
        f"endArrow={arrow};endFill={fill};"
    )
    return (
        f'<mxCell id="{edge_id}" value="{value(label)}" edge="1" parent="1" style="{style}">'
        '<mxGeometry relative="1" as="geometry">'
        f'<mxPoint x="{source_x}" y="{y}" as="sourcePoint"/><mxPoint x="{target_x}" y="{y}" as="targetPoint"/>'
        "</mxGeometry></mxCell>"
    )


def sequence_model(spec: dict) -> str:
    participants = [spec["actor"], "React 前端", spec["service"], spec["dependency"]]
    centers = [120, 380, 660, 930]
    parts = [
        '<mxGraphModel dx="1100" dy="1420" grid="1" gridSize="10" guides="1" tooltips="1" '
        'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="1420" adaptiveColors="auto">',
        "<root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>",
        cell("title", f'{spec["title"]}系统顺序图', "text;html=1;align=center;fontSize=19;fontStyle=1;fontColor=#262626;", 250, 15, 600, 30),
    ]
    for index, (center, label) in enumerate(zip(centers, participants)):
        shape = "shape=cylinder3;boundedLbl=1;backgroundOutline=1;" if index == 3 and "PostgreSQL" in label else "rounded=0;"
        parts.append(cell(
            f"participant-{index}", label,
            f"{shape}whiteSpace=wrap;html=1;fillColor=#E6E6E6;strokeColor=#707070;fontColor=#262626;fontSize=15;fontStyle=1;",
            center - 85, 60, 170, 54,
        ))
        parts.append(
            f'<mxCell id="life-{index}" edge="1" parent="1" style="edgeStyle=none;html=1;dashed=1;strokeColor=#8A8A8A;endArrow=none;">'
            '<mxGeometry relative="1" as="geometry">'
            f'<mxPoint x="{center}" y="114" as="sourcePoint"/><mxPoint x="{center}" y="1330" as="targetPoint"/>'
            "</mxGeometry></mxCell>"
        )

    parts.extend([
        message("m1", centers[0], centers[1], 165, f'1. {spec["request"]}'),
        message("m2", centers[1], centers[2], 235, f'2. {spec["validate"]}'),
        message("m3", centers[2], centers[3], 305, f'3. {spec["dependency_call"]}'),
        message("m4", centers[3], centers[2], 365, "4. 返回校验、数据或调用结果", "return"),
    ])

    parts.append(cell("frame-alt", "", "shape=rect;html=1;fillColor=none;strokeColor=#737373;", 25, 410, 1050, 650))
    parts.append(cell("label-alt", "alt  处理结果", "shape=rect;html=1;align=left;spacingLeft=8;fillColor=#E6E6E6;strokeColor=#737373;fontColor=#262626;fontSize=14;fontStyle=1;", 25, 410, 180, 34))
    parts.append(cell("guard-fail", "[校验失败或依赖异常]", "text;html=1;align=left;fontColor=#713B37;fontSize=14;fontStyle=1;", 42, 455, 220, 28))
    parts.extend([
        message("m5", centers[2], centers[1], 515, f'5. {spec["failure"]}', "return", "#A25752"),
        message("m6", centers[1], centers[0], 575, "6. 显示原因并保留可恢复状态", "return", "#A25752"),
    ])
    parts.append(message("separator", 25, 1075, 635, "", "return", "#8A8A8A").replace("endArrow=open;", "endArrow=none;"))
    parts.append(cell("guard-ok", "[校验通过]", "text;html=1;align=left;fontColor=#2B4732;fontSize=14;fontStyle=1;", 42, 650, 160, 28))
    parts.extend([
        message("m7", centers[2], centers[3], 715, f'7. {spec["success"][0]}；{spec["success"][1]}', color="#55725D"),
        message("m8", centers[3], centers[2], 775, "8. 返回持久化或外部处理结果", "return", "#55725D"),
        message("m9", centers[2], centers[1], 835, f'9. {spec["success"][2]}', "return", "#55725D"),
        message("m10", centers[1], centers[0], 895, "10. 展示处理结果", "return", "#55725D"),
    ])
    parts.append(message("m11", centers[2], centers[3], 1115, f'11. {spec["audit"]}'))
    parts.append(cell("note", spec["note"], "shape=note;whiteSpace=wrap;html=1;fillColor=#F4E5BD;strokeColor=#A77D36;fontColor=#634A24;fontSize=13;", 540, 1190, 440, 90))
    parts.append("</root></mxGraphModel>")
    return "".join(parts)


def write_diagram(path: Path, page_id: str, page_name: str, model: str) -> None:
    payload = drawio_file(page_id, page_name, model)
    ElementTree.fromstring(payload)
    path.write_text(payload, encoding="utf-8")


def generate() -> list[Path]:
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    ai = AI_KNOWLEDGE_FLOW_SPEC
    ai_path = SPEC_DIR / "figure-3-2-ai-knowledge-flow.drawio"
    write_diagram(ai_path, "figure-3-2", f'图3-2 {ai["title"]}', activity_model(ai))
    written.append(ai_path)
    for spec in USE_CASE_DIAGRAM_SPECS:
        base = f'figure-{spec["number"]}-{spec["slug"]}'
        activity_path = SPEC_DIR / f"{base}-activity.drawio"
        sequence_path = SPEC_DIR / f"{base}-sequence.drawio"
        write_diagram(activity_path, f'{spec["number"]}-activity', f'图{spec["number"]}(a) {spec["title"]}活动图', activity_model(spec))
        write_diagram(sequence_path, f'{spec["number"]}-sequence', f'图{spec["number"]}(b) {spec["title"]}系统顺序图', sequence_model(spec))
        written.extend([activity_path, sequence_path])
    return written


if __name__ == "__main__":
    paths = generate()
    print(f"Generated {len(paths)} draw.io files")
    for path in paths:
        print(path.relative_to(ROOT))
