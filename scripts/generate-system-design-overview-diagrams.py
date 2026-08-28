#!/usr/bin/env python3
"""Generate editable overview diagrams for the V2.10 system design document."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess

import cairosvg


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs/assets/diagrams/system-design"
SPEC_DIR = OUTPUT_DIR / "specs"
RENDERER = Path.home() / ".codex/skills/figure-spec/scripts/figure_renderer.py"
USE_CASE_SOURCE = ROOT / "docs/assets/diagrams/figure-4-1-system-use-cases.png"
USE_CASE_SVG_SOURCE = ROOT / "docs/assets/diagrams/figure-4-1-system-use-cases.svg"
USE_CASE_DRAWIO_SOURCE = ROOT / "docs/assets/diagrams/specs/figure-4-1-system-use-cases.drawio"

STYLE = {
    "font_family": "Noto Sans CJK SC, Microsoft YaHei, sans-serif",
    "font_size": 14,
    "bg_color": "#FFFFFF",
    "palette": ["#F3F4F6", "#DCE8F2", "#DCEBDD", "#F4E5BD", "#F2D9D7"],
}

COLORS = {
    "text": "#262626",
    "line": "#606060",
    "gray": "#F3F4F6",
    "gray_stroke": "#777777",
    "blue": "#DCE8F2",
    "blue_stroke": "#52718A",
    "green": "#DCEBDD",
    "green_stroke": "#5B7F63",
    "amber": "#F4E5BD",
    "amber_stroke": "#A77D36",
    "red": "#F2D9D7",
    "red_stroke": "#A25752",
}


def node(
    node_id: str,
    label: str,
    x: int,
    y: int,
    width: int = 170,
    height: int = 58,
    *,
    fill: str | None = None,
    stroke: str | None = None,
    shape: str = "rect",
    font_size: int = 14,
    sublabel: str | None = None,
) -> dict:
    value = {
        "id": node_id,
        "label": label,
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "shape": shape,
        "fill": fill or COLORS["gray"],
        "stroke": stroke or COLORS["gray_stroke"],
        "text_color": COLORS["text"],
        "font_size": font_size,
    }
    if sublabel:
        value["sublabel"] = sublabel
    return value


def edge(source: str, target: str, label: str = "", *, style: str = "solid", color: str | None = None) -> dict:
    return {
        "from": source,
        "to": target,
        "label": label,
        "style": style,
        "color": color or COLORS["line"],
        "thickness": 2,
        "curve": False,
    }


def label(text: str, x: int, y: int, size: int = 16) -> dict:
    return {"text": text, "x": x, "y": y, "font_size": size, "color": COLORS["text"], "anchor": "middle"}


def deployment_spec() -> dict:
    nodes = [
        node("browser", "浏览器", 450, 60, 180, 54, fill="#FFFFFF"),
        node("npm", "Nginx Proxy Manager\nHTTPS / proxy_net", 450, 165, 250, 72, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("web", "web 容器\nNginx :80 / SPA / API转发", 450, 300, 270, 76, fill=COLORS["green"], stroke=COLORS["green_stroke"]),
        node("backend", "backend 容器\nNestJS :3000 / REST / Socket.IO", 450, 440, 290, 78, fill=COLORS["green"], stroke=COLORS["green_stroke"]),
        node("data-gateway", "持久化与运行状态", 280, 580, 230, 58, fill=COLORS["gray"]),
        node("integration-gateway", "安全检测与外部集成", 610, 580, 230, 58, fill=COLORS["gray"]),
        node("postgres", "PostgreSQL\n业务数据", 120, 735, 160, 66, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("redis", "Redis\n共享限流 / 短期状态", 300, 735, 170, 66, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("minio", "MinIO\n私有对象存储", 480, 735, 150, 66, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("clamav", "ClamAV\n恶意文件检测", 1010, 520, 190, 66, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("smtp", "SMTP 邮件服务", 1010, 700, 190, 60, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("ai", "AI 模型供应商", 1010, 880, 190, 60, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("minio-init", "minio-init\n初始化任务（退出码0）", 480, 900, 180, 66, fill="#FFFFFF"),
    ]
    edges = [
        edge("browser", "npm", "HTTPS"),
        edge("npm", "web", "proxy_net"),
        edge("web", "backend", "/api 与 /socket.io"),
        edge("backend", "data-gateway"),
        edge("backend", "integration-gateway"),
        edge("data-gateway", "postgres", "Prisma"),
        edge("data-gateway", "redis", "Redis Client"),
        edge("data-gateway", "minio", "S3 API"),
        edge("integration-gateway", "clamav"),
        edge("integration-gateway", "smtp"),
        edge("integration-gateway", "ai", "HTTPS"),
        edge("minio-init", "minio", "创建存储桶", style="dashed"),
    ]
    return {
        "title": "系统部署架构图",
        "canvas": {"width": 1200, "height": 990},
        "style": STYLE,
        "nodes": nodes,
        "edges": edges,
        "groups": [
            {"id": "docker", "label": "Linux 容器运行环境 / 应用内部网络", "node_ids": ["web", "backend", "data-gateway", "integration-gateway", "postgres", "redis", "minio", "minio-init"], "fill": "#FAFAFA", "stroke": "#777777", "padding": 24},
            {"id": "external", "label": "外部依赖", "node_ids": ["clamav", "smtp", "ai"], "fill": "#FFFDF7", "stroke": COLORS["amber_stroke"], "padding": 20},
        ],
        "labels": [label("域名：test.cquptsrc.asia", 260, 135, 13)],
    }


def component_spec() -> dict:
    nodes = [
        node("public-ui", "公开访问端", 150, 85, 200),
        node("student-ui", "用户端", 450, 85, 200),
        node("auditor-ui", "审核员端", 750, 85, 200),
        node("admin-ui", "管理员端", 1050, 85, 200),
        node("frontend", "React 19 表现层\n路由 / 页面 / 公共组件 / API Client / Socket Client", 600, 235, 820, 82, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("access", "接入层\nNginx Proxy Manager → Web Nginx → NestJS Main", 600, 380, 820, 76, fill=COLORS["gray"]),
        node("identity", "身份与准入\nAuth / Account / Access", 160, 555, 240, 78, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=13),
        node("vulnerability", "漏洞响应\nVulnerabilities / Attachments\nCertificates", 450, 555, 250, 92, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=13),
        node("collaboration", "内容与协作\nNotifications / Chat / Learning\nPointsMall", 750, 555, 250, 92, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=13),
        node("ai", "AI 与治理\nAI / Knowledge / Settings\nUsers / Audit / Dashboard", 1040, 555, 240, 92, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=13),
        node("shared", "共享访问组件\nSecurity / Prisma / ObjectStorage / Gateway", 600, 725, 560, 76, fill=COLORS["gray"]),
        node("postgres", "PostgreSQL", 170, 900, 190, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("redis", "Redis", 440, 900, 170, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("object", "S3 / MinIO", 700, 900, 190, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("external", "SMTP / ClamAV\nAI Provider", 1000, 900, 210, 66, fill=COLORS["amber"], stroke=COLORS["amber_stroke"], font_size=13),
    ]
    edges = [
        edge("public-ui", "frontend"), edge("student-ui", "frontend"), edge("auditor-ui", "frontend"), edge("admin-ui", "frontend"),
        edge("frontend", "access", "HTTPS / WebSocket"),
        edge("access", "identity"), edge("access", "vulnerability"), edge("access", "collaboration"), edge("access", "ai"),
        edge("identity", "shared"), edge("vulnerability", "shared"), edge("collaboration", "shared"), edge("ai", "shared"),
        edge("shared", "postgres", "Prisma"), edge("shared", "redis"), edge("shared", "object", "S3 API"), edge("shared", "external", "适配器"),
    ]
    return {
        "title": "软件组件架构图",
        "canvas": {"width": 1200, "height": 1010},
        "style": STYLE,
        "nodes": nodes,
        "edges": edges,
        "groups": [
            {"id": "presentation", "label": "表现层", "node_ids": ["public-ui", "student-ui", "auditor-ui", "admin-ui", "frontend"], "fill": "#FAFCFE", "stroke": COLORS["blue_stroke"], "padding": 22},
            {"id": "application", "label": "NestJS 应用层", "node_ids": ["identity", "vulnerability", "collaboration", "ai", "shared"], "fill": "#FBFDFB", "stroke": COLORS["green_stroke"], "padding": 22},
            {"id": "data", "label": "基础设施层", "node_ids": ["postgres", "redis", "object", "external"], "fill": "#FAFCFE", "stroke": COLORS["blue_stroke"], "padding": 22},
        ],
        "labels": [],
    }


def package_spec() -> dict:
    nodes = [
        node("app", "AppModule\n应用组合根", 700, 70, 260, 66, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("registry", "NestJS 模块注册", 700, 180, 240, 54, fill=COLORS["gray"]),
        node("identity", "身份与安全准入包\nAuth / Account / Access\nSecurityExam\nHumanVerification", 150, 365, 260, 120, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=12),
        node("response", "漏洞响应包\nVulnerabilities / Attachments\nCertificates", 425, 365, 240, 108, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=12),
        node("content", "内容与激励包\nAnnouncements / Learning\nPointsMall", 700, 365, 240, 108, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=12),
        node("communication", "沟通协作包\nChat / Notifications", 975, 365, 220, 108, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=12),
        node("ai", "AI 与平台治理包\nAI / AI Knowledge / Users\nDashboard / Settings / Audit", 1250, 365, 250, 108, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=12),
        node("shared", "共享基础模块\nSecurity / Prisma / ObjectStorage / Health", 700, 590, 430, 78, fill=COLORS["gray"]),
        node("database", "PostgreSQL", 250, 780, 190, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("cache", "Redis", 550, 780, 170, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("storage", "MinIO / S3", 850, 780, 190, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("external", "SMTP / ClamAV\nAI Provider", 1160, 780, 260, 66, fill=COLORS["amber"], stroke=COLORS["amber_stroke"], font_size=13),
    ]
    edges = [
        edge("app", "registry", "imports"),
        edge("registry", "identity"), edge("registry", "response"), edge("registry", "content"), edge("registry", "communication"), edge("registry", "ai"),
        edge("identity", "shared"), edge("response", "shared"), edge("content", "shared"), edge("communication", "shared"), edge("ai", "shared"),
        edge("shared", "database"), edge("shared", "cache"), edge("shared", "storage"), edge("shared", "external"),
    ]
    return {
        "title": "后端模块依赖图",
        "canvas": {"width": 1400, "height": 900},
        "style": STYLE,
        "nodes": nodes,
        "edges": edges,
        "groups": [],
        "labels": [label("业务包通过共享模块访问基础设施", 700, 865, 13)],
    }


def domain_spec() -> dict:
    nodes = [
        node("user", "User\n平台主体", 600, 65, 190, 66, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("chat", "ChatConversation", 135, 235, 200, 58),
        node("report", "VulnerabilityReport\n漏洞聚合根", 600, 235, 230, 72, fill=COLORS["green"], stroke=COLORS["green_stroke"]),
        node("run", "AiAgentRun", 1120, 235, 180, 58, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("message", "ChatMessage", 135, 400, 180, 56),
        node("supplement", "VulnerabilitySupplement", 355, 415, 220, 62),
        node("attachment", "VulnerabilityAttachment", 600, 415, 220, 62),
        node("review", "ReviewAssignment / Comment", 830, 415, 220, 62),
        node("knowledge", "AiKnowledgeEntry", 1040, 415, 190, 58, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("skill", "AiSkill\n与知识库分离", 1220, 415, 170, 66, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("retest", "RetestRecord", 830, 610, 180, 58),
        node("event", "VulnerabilityEvent", 600, 610, 190, 58),
        node("certificate", "Certificate", 1000, 790, 180, 58, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("points", "PointLedgerEntry", 470, 790, 190, 58, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("notification", "PlatformNotification", 730, 790, 200, 58, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
    ]
    edges = [
        edge("user", "chat", "参与"), edge("user", "report", "提交"), edge("user", "run", "发起"),
        edge("chat", "message", "1:N"),
        edge("report", "supplement", "1:N"), edge("report", "attachment", "1:N"),
        edge("report", "review", "审核"), edge("review", "retest", "复测"), edge("report", "event", "记录"),
        edge("retest", "certificate", "通过后签发"), edge("event", "points", "产生流水"), edge("event", "notification", "派发通知"),
        edge("run", "knowledge", "检索/反馈", style="dashed"), edge("run", "skill", "调用", style="dashed"),
    ]
    return {
        "title": "核心领域模型图",
        "canvas": {"width": 1320, "height": 890},
        "style": STYLE,
        "nodes": nodes,
        "edges": edges,
        "groups": [],
        "labels": [label("沟通域", 135, 150, 13), label("漏洞响应域", 600, 150, 13), label("AI 域", 1120, 150, 13)],
    }


def security_spec() -> dict:
    nodes = [
        node("request", "外部请求", 450, 55, 170, 52, fill="#FFFFFF"),
        node("edge", "边界安全\nTLS、Nginx Proxy Manager、CORS、HSTS、安全响应头", 450, 170, 530, 78, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("identity", "身份与访问控制\nJWT、令牌轮换、RBAC、权限覆盖、资源归属", 450, 315, 530, 78, fill=COLORS["green"], stroke=COLORS["green_stroke"]),
        node("input", "输入与业务边界\nDTO、长度格式、状态前置条件、限流、请求编号", 450, 460, 530, 78, fill=COLORS["gray"]),
        node("file", "文件安全\n类型识别、大小数量限制、ClamAV、私有对象键", 240, 625, 330, 82, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("ai", "AI 出站安全\n凭据加密、SSRF 防护、字段脱敏、最小上下文", 660, 625, 330, 82, fill=COLORS["amber"], stroke=COLORS["amber_stroke"]),
        node("data", "数据与事务安全\nPrisma 事务、唯一约束、乐观并发、最小权限访问", 450, 790, 530, 78, fill=COLORS["blue"], stroke=COLORS["blue_stroke"]),
        node("audit", "审计与恢复\n结构化日志、X-Request-Id、敏感操作审计、备份恢复验证", 450, 930, 530, 78, fill=COLORS["red"], stroke=COLORS["red_stroke"]),
    ]
    edges = [
        edge("request", "edge"), edge("edge", "identity"), edge("identity", "input"),
        edge("input", "file"), edge("input", "ai"), edge("file", "data"), edge("ai", "data"), edge("data", "audit"),
    ]
    return {
        "title": "安全控制架构图",
        "canvas": {"width": 900, "height": 1030},
        "style": STYLE,
        "nodes": nodes,
        "edges": edges,
        "groups": [],
        "labels": [label("纵深防御：每一层失败均拒绝继续处理并保留可追踪结果", 450, 995, 13)],
    }


def er_spec() -> dict:
    nodes = [
        node("user", "User\nPK id\nemail / roleId / status", 215, 360, 210, 92, fill=COLORS["blue"], stroke=COLORS["blue_stroke"], font_size=13),
        node("report", "VulnerabilityReport\nPK id / FK submitterId\nreportNo / status / title", 650, 360, 250, 108, fill=COLORS["green"], stroke=COLORS["green_stroke"], font_size=13),
        node("attachment", "VulnerabilityAttachment\nPK id / FK reportId\nstorageKey / sha256", 470, 100, 230, 96, font_size=12),
        node("supplement", "VulnerabilitySupplement\nPK id / FK reportId\nmarkdown / version", 750, 100, 230, 96, font_size=12),
        node("review", "ReviewAssignment\nPK id / FK reportId\nauditorId / closedAt", 1010, 220, 220, 96, font_size=12),
        node("retest", "RetestRecord\nPK id / FK reportId\nresult / evidenceSha256", 1010, 500, 220, 96, font_size=12),
        node("event", "VulnerabilityEvent\nPK id / FK reportId\nfromStatus / toStatus", 830, 735, 230, 96, font_size=12),
        node("certificate", "Certificate\nPK id / FK vulnerabilityId\ncertificateNo / status", 540, 760, 230, 96, fill=COLORS["blue"], stroke=COLORS["blue_stroke"], font_size=12),
        node("points", "PointLedgerEntry\nPK id / FK userId, reportId\npoints / balanceAfter", 95, 635, 190, 96, fill=COLORS["blue"], stroke=COLORS["blue_stroke"], font_size=11),
        node("notification", "PlatformNotification\nPK id / FK recipientId\nreadAt / menuScope", 310, 635, 200, 96, fill=COLORS["blue"], stroke=COLORS["blue_stroke"], font_size=11),
    ]
    edges = [
        edge("user", "report", "1:N 提交"),
        edge("report", "attachment", "1:N"), edge("report", "supplement", "1:N"), edge("report", "review", "1:N"),
        edge("report", "retest", "1:N"), edge("report", "event", "1:N"), edge("report", "certificate", "1:0..1"),
        edge("user", "points", "1:N"), edge("user", "notification", "1:N"),
    ]
    return {
        "title": "数据库核心实体关系图",
        "canvas": {"width": 1150, "height": 870},
        "style": STYLE,
        "nodes": nodes,
        "edges": edges,
        "groups": [],
        "labels": [label("核心关系按 Prisma Schema 外键与基数绘制", 575, 840, 13)],
    }


SPECS = {
    "figure-3-1-deployment": deployment_spec,
    "figure-3-2-component-architecture": component_spec,
    "figure-3-3-backend-package-dependencies": package_spec,
    "figure-3-4-core-domain-model": domain_spec,
    "figure-3-5-security-architecture": security_spec,
    "figure-5-1-core-er": er_spec,
}

FONT_SCALES = {
    "figure-3-1-deployment": 1.2,
    "figure-3-2-component-architecture": 1.35,
    "figure-3-3-backend-package-dependencies": 1.4,
    "figure-3-4-core-domain-model": 1.15,
    "figure-5-1-core-er": 1.2,
}


def render_spec(name: str, spec: dict) -> None:
    scale = FONT_SCALES.get(name, 1.0)
    if scale != 1.0:
        for item in spec.get("nodes", []):
            item["font_size"] = round(item["font_size"] * scale)
        for item in spec.get("labels", []):
            item["font_size"] = round(item["font_size"] * scale)
    spec_path = SPEC_DIR / f"{name}.json"
    svg_path = OUTPUT_DIR / f"{name}.svg"
    png_path = OUTPUT_DIR / f"{name}.png"
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subprocess.run(["python3", str(RENDERER), "validate", str(spec_path)], check=True)
    subprocess.run(["python3", str(RENDERER), "render", str(spec_path), "--output", str(svg_path)], check=True)
    cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), output_width=1800)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    if not RENDERER.exists():
        raise FileNotFoundError(f"FigureSpec renderer not found: {RENDERER}")
    for name, factory in SPECS.items():
        render_spec(name, factory())
    shutil.copy2(USE_CASE_SOURCE, OUTPUT_DIR / "figure-2-1-system-use-cases.png")
    shutil.copy2(USE_CASE_SVG_SOURCE, OUTPUT_DIR / "figure-2-1-system-use-cases.svg")
    shutil.copy2(USE_CASE_DRAWIO_SOURCE, SPEC_DIR / "figure-2-1-system-use-cases.drawio")
    print(f"Generated {len(SPECS) + 1} system design overview diagrams in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
