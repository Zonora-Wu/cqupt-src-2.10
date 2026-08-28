#!/usr/bin/env python3
"""Generate editable draw.io engineering diagrams for chapter 4."""

from __future__ import annotations

from html import escape
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs/assets/diagrams/system-design"
SPEC_DIR = OUTPUT_DIR / "specs"

TEXT = "#262626"
LINE = "#5F5F5F"
GRAY = "#F2F2F2"
BLUE = "#DCE8F2"
GREEN = "#DCEBDD"
AMBER = "#F4E5BD"
RED = "#F2D9D7"


def xml_value(text: str) -> str:
    return escape(text, quote=True).replace("\n", "&lt;br&gt;")


def cell(cell_id: str, label: str, style: str, x: int, y: int, width: int, height: int) -> str:
    return (
        f'<mxCell id="{cell_id}" value="{xml_value(label)}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>'
        "</mxCell>"
    )


def source_edge(
    edge_id: str,
    source: str,
    target: str,
    label: str = "",
    *,
    dashed: bool = False,
    color: str = LINE,
    ports: str = "",
) -> str:
    style = (
        "edgeStyle=orthogonalEdgeStyle;orthogonalLoop=1;jettySize=auto;rounded=0;html=1;"
        f"strokeColor={color};fontColor={color};fontSize=14;endArrow=block;endFill=1;"
        + ("dashed=1;" if dashed else "")
        + ports
    )
    return (
        f'<mxCell id="{edge_id}" value="{xml_value(label)}" edge="1" parent="1" '
        f'source="{source}" target="{target}" style="{style}">'
        '<mxGeometry relative="1" as="geometry"/></mxCell>'
    )


def point_edge(
    edge_id: str,
    source_x: int,
    target_x: int,
    y: int,
    label: str,
    *,
    dashed: bool = False,
    color: str = LINE,
) -> str:
    style = (
        "edgeStyle=none;html=1;rounded=0;"
        f"strokeColor={color};fontColor={color};fontSize=14;endArrow={'open' if dashed else 'block'};"
        f"endFill={'0' if dashed else '1'};" + ("dashed=1;" if dashed else "")
    )
    return (
        f'<mxCell id="{edge_id}" value="{xml_value(label)}" edge="1" parent="1" style="{style}">'
        '<mxGeometry relative="1" as="geometry">'
        f'<mxPoint x="{source_x}" y="{y}" as="sourcePoint"/>'
        f'<mxPoint x="{target_x}" y="{y}" as="targetPoint"/>'
        "</mxGeometry></mxCell>"
    )


def routed_edge(
    edge_id: str,
    points: list[tuple[int, int]],
    label: str = "",
    *,
    dashed: bool = False,
    color: str = LINE,
) -> str:
    if len(points) < 2:
        raise ValueError("routed edge needs at least two points")
    waypoints = "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in points[1:-1])
    style = (
        "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;"
        f"strokeColor={color};fontColor={color};fontSize=14;endArrow=block;endFill=1;"
        + ("dashed=1;" if dashed else "")
    )
    return (
        f'<mxCell id="{edge_id}" value="{xml_value(label)}" edge="1" parent="1" style="{style}">'
        '<mxGeometry relative="1" as="geometry">'
        f'<mxPoint x="{points[0][0]}" y="{points[0][1]}" as="sourcePoint"/>'
        f'<mxPoint x="{points[-1][0]}" y="{points[-1][1]}" as="targetPoint"/>'
        + (f'<Array as="points">{waypoints}</Array>' if waypoints else "")
        + "</mxGeometry></mxCell>"
    )
def graph(page_width: int, page_height: int, parts: list[str]) -> str:
    return (
        f'<mxGraphModel dx="{page_width}" dy="{page_height}" grid="1" gridSize="10" guides="1" '
        f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        f'pageWidth="{page_width}" pageHeight="{page_height}" adaptiveColors="auto">'
        '<root><mxCell id="0"/><mxCell id="1" parent="0"/>'
        + "".join(parts)
        + "</root></mxGraphModel>"
    )


def drawio(page_id: str, title: str, model: str) -> str:
    return (
        '<mxfile host="app.diagrams.net" agent="Codex" version="30.0.1">'
        f'<diagram id="{page_id}" name="{xml_value(title)}">{model}</diagram></mxfile>'
    )


def sequence_model(title: str, participants: list[str], messages: list[dict]) -> str:
    width, height = 1400, 920
    left, right = 85, 1315
    step = (right - left) / (len(participants) - 1)
    centers = [round(left + index * step) for index in range(len(participants))]
    parts = [
        cell("title", title, "text;html=1;align=center;fontSize=22;fontStyle=1;fontColor=#262626;", 300, 18, 800, 36)
    ]
    for index, (center, participant) in enumerate(zip(centers, participants)):
        box_width = min(164, max(118, round(step - 18)))
        parts.append(cell(
            f"p{index}", participant,
            "rounded=0;whiteSpace=wrap;html=1;fillColor=#E6E6E6;strokeColor=#707070;"
            "fontColor=#262626;fontSize=14;fontStyle=1;",
            center - box_width // 2, 68, box_width, 58,
        ))
        parts.append(
            f'<mxCell id="life{index}" edge="1" parent="1" '
            'style="edgeStyle=none;html=1;dashed=1;strokeColor=#8A8A8A;endArrow=none;">'
            '<mxGeometry relative="1" as="geometry">'
            f'<mxPoint x="{center}" y="126" as="sourcePoint"/><mxPoint x="{center}" y="875" as="targetPoint"/>'
            "</mxGeometry></mxCell>"
        )
    y = 165
    message_index = 1
    for item in messages:
        if "section" in item:
            parts.append(cell(
                f"section{message_index}", item["section"],
                "shape=rect;html=1;align=left;spacingLeft=12;fillColor=#F2F2F2;strokeColor=#8A8A8A;"
                "fontColor=#262626;fontSize=14;fontStyle=1;",
                30, y - 18, 1340, 34,
            ))
            y += 54
            continue
        source = centers[item["from"]]
        target = centers[item["to"]]
        parts.append(point_edge(
            f"m{message_index}", source, target, y,
            f'{message_index}. {item["label"]}',
            dashed=item.get("return", False),
            color=item.get("color", LINE),
        ))
        if item.get("note"):
            note_x = min(source, target) + 18
            note_width = max(220, abs(target - source) - 36)
            parts.append(cell(
                f"note{message_index}", item["note"],
                "shape=note;whiteSpace=wrap;html=1;fillColor=#F4E5BD;strokeColor=#A77D36;"
                "fontColor=#634A24;fontSize=12;",
                note_x, y + 12, note_width, 46,
            ))
            y += 58
        y += 52
        message_index += 1
    return graph(width, height, parts)


def flow_model(title: str, nodes: list[dict], edges: list[dict], *, note: str = "") -> str:
    width, height = 1400, 920
    styles = {
        "normal": f"rounded=0;whiteSpace=wrap;html=1;fillColor={GRAY};strokeColor=#707070;fontColor={TEXT};fontSize=15;",
        "process": f"rounded=0;whiteSpace=wrap;html=1;fillColor={BLUE};strokeColor=#52718A;fontColor={TEXT};fontSize=15;",
        "success": f"rounded=0;whiteSpace=wrap;html=1;fillColor={GREEN};strokeColor=#5B7F63;fontColor={TEXT};fontSize=15;",
        "warn": f"rounded=0;whiteSpace=wrap;html=1;fillColor={AMBER};strokeColor=#A77D36;fontColor={TEXT};fontSize=15;",
        "failure": f"rounded=0;whiteSpace=wrap;html=1;fillColor={RED};strokeColor=#A25752;fontColor={TEXT};fontSize=15;",
        "decision": f"rhombus;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#707070;fontColor={TEXT};fontSize=14;",
        "label": f"text;html=1;align=center;verticalAlign=middle;fontColor={TEXT};fontSize=14;",
        "start": "ellipse;html=1;aspect=fixed;fillColor=#444444;strokeColor=#444444;",
        "end": "ellipse;shape=doubleEllipse;html=1;aspect=fixed;fillColor=#FFFFFF;strokeColor=#555555;",
    }
    parts = [cell("title", title, "text;html=1;align=center;fontSize=22;fontStyle=1;fontColor=#262626;", 300, 18, 800, 36)]
    for node in nodes:
        parts.append(cell(
            node["id"], node.get("label", ""), styles[node.get("kind", "normal")],
            node["x"], node["y"], node.get("w", 210), node.get("h", 64),
        ))
    for index, edge in enumerate(edges, 1):
        if edge.get("points"):
            parts.append(routed_edge(
                f"e{index}", edge["points"], edge.get("label", ""),
                dashed=edge.get("dashed", False), color=edge.get("color", LINE),
            ))
        else:
            parts.append(source_edge(
                f"e{index}", edge["from"], edge["to"], edge.get("label", ""),
                dashed=edge.get("dashed", False), color=edge.get("color", LINE), ports=edge.get("ports", ""),
            ))
    if note:
        parts.append(cell("note", note, "shape=note;whiteSpace=wrap;html=1;fillColor=#F4E5BD;strokeColor=#A77D36;fontColor=#634A24;fontSize=13;", 1010, 770, 330, 100))
    return graph(width, height, parts)


SEQUENCE_SPECS = {
    "4-1": {
        "slug": "auth-token-management", "title": "身份认证与令牌管理时序图",
        "participants": ["浏览器", "AuthController", "AuthService", "人机验证", "PostgreSQL", "邮件服务"],
        "messages": [
            {"section": "密码登录"},
            {"from": 0, "to": 1, "label": "提交账号、密码与人机验证凭据"},
            {"from": 1, "to": 3, "label": "校验人机验证"},
            {"from": 3, "to": 1, "label": "返回校验结果", "return": True},
            {"from": 1, "to": 2, "label": "验证账号、密码与账户状态"},
            {"from": 2, "to": 4, "label": "读取用户、角色与权限；保存刷新令牌摘要"},
            {"from": 2, "to": 0, "label": "返回访问令牌、刷新令牌与用户信息", "return": True},
            {"section": "刷新轮换与退出吊销"},
            {"from": 0, "to": 1, "label": "提交刷新令牌"},
            {"from": 1, "to": 2, "label": "校验并执行一次性轮换"},
            {"from": 2, "to": 4, "label": "吊销旧令牌摘要并保存新摘要"},
            {"from": 2, "to": 0, "label": "返回新令牌；退出时仅吊销并清理会话", "return": True},
        ],
    },
    "4-3": {
        "slug": "vulnerability-draft-submit", "title": "漏洞草稿与 Markdown 报告提交时序图",
        "participants": ["提交页面", "漏洞控制器", "草稿服务", "Markdown服务", "准入守卫", "附件服务", "PostgreSQL", "通知服务"],
        "messages": [
            {"section": "草稿保存"},
            {"from": 0, "to": 1, "label": "保存基础字段、Markdown 与附件引用"},
            {"from": 1, "to": 2, "label": "覆盖保存本人唯一未提交草稿"},
            {"from": 2, "to": 3, "label": "清洗正文并校验图片引用"},
            {"from": 2, "to": 6, "label": "事务保存草稿版本"},
            {"section": "正式提交"},
            {"from": 0, "to": 1, "label": "确认责任边界并提交"},
            {"from": 1, "to": 4, "label": "校验责任书、答题、资料与权限"},
            {"from": 1, "to": 5, "label": "校验附件归属、状态与文件类型"},
            {"from": 1, "to": 3, "label": "校验标题、必要章节及最小长度"},
            {"from": 1, "to": 6, "label": "事务创建报告、事件并删除已提交草稿"},
            {"from": 1, "to": 7, "label": "提交后派发站内通知"},
            {"from": 1, "to": 0, "label": "返回漏洞编号与详情路由", "return": True},
        ],
    },
    "4-4": {
        "slug": "attachment-access", "title": "附件上传与授权访问时序图",
        "participants": ["用户/审核员", "附件控制器", "附件服务", "类型识别", "ClamAV", "对象存储", "PostgreSQL"],
        "messages": [
            {"section": "上传路径"},
            {"from": 0, "to": 1, "label": "上传文件与业务类型"},
            {"from": 1, "to": 2, "label": "校验大小、数量与频率"},
            {"from": 2, "to": 3, "label": "内容嗅探并核对允许类型"},
            {"from": 2, "to": 4, "label": "病毒扫描；命中则阻止"},
            {"from": 2, "to": 5, "label": "写入私有对象"},
            {"from": 2, "to": 6, "label": "事务保存元数据、归属与审计"},
            {"section": "下载或预览路径"},
            {"from": 0, "to": 1, "label": "请求附件"},
            {"from": 1, "to": 2, "label": "校验报告关系、所有权或敏感读取权限"},
            {"from": 2, "to": 6, "label": "敏感查看写入审计"},
            {"from": 2, "to": 5, "label": "读取对象或签发短期访问响应"},
            {"from": 2, "to": 0, "label": "返回文件；拒绝时不暴露对象键", "return": True},
        ],
    },
    "4-6": {
        "slug": "certificate-verification", "title": "证书签发、撤销与公开核验时序图",
        "participants": ["管理员/访客", "证书控制器", "证书服务", "限流与校验", "PostgreSQL", "对象存储", "通知服务"],
        "messages": [
            {"section": "签发与撤销"},
            {"from": 0, "to": 1, "label": "签发证书或提交撤销原因"},
            {"from": 1, "to": 2, "label": "校验权限、漏洞状态与唯一签发约束"},
            {"from": 2, "to": 5, "label": "使用启用模板与电子印章生成 PDF"},
            {"from": 2, "to": 4, "label": "事务保存证书、漏洞事件、审计与通知记录"},
            {"from": 2, "to": 6, "label": "提交后推送重要通知与必要邮件"},
            {"section": "公开核验"},
            {"from": 0, "to": 1, "label": "按证书编号查询"},
            {"from": 1, "to": 3, "label": "格式校验；按 IP 与证书编号双维度限流"},
            {"from": 1, "to": 2, "label": "查询签发、撤销状态"},
            {"from": 2, "to": 4, "label": "读取公开核验字段"},
            {"from": 2, "to": 0, "label": "最小披露：编号、状态、签发时间及必要摘要", "return": True},
        ],
    },
    "4-9": {
        "slug": "notification-delivery", "title": "通知、邮件与菜单未读发布时序图",
        "participants": ["业务服务", "业务事务", "通知服务", "PostgreSQL", "实时发布器", "邮件服务", "前端徽标"],
        "messages": [
            {"section": "事务内创建"},
            {"from": 0, "to": 1, "label": "完成审核、证书或安全事件"},
            {"from": 1, "to": 2, "label": "按事件策略生成脱敏通知"},
            {"from": 2, "to": 3, "label": "保存通知、事件键、菜单范围与邮件状态"},
            {"from": 1, "to": 0, "label": "提交业务事务", "return": True},
            {"section": "提交后派发与已读"},
            {"from": 0, "to": 2, "label": "dispatchAfterCommit"},
            {"from": 2, "to": 4, "label": "推送通知与未读变更"},
            {"from": 4, "to": 6, "label": "刷新铃铛和业务菜单红点"},
            {"from": 2, "to": 5, "label": "仅重要事件发送脱敏邮件"},
            {"from": 5, "to": 3, "label": "记录成功或失败审计；失败不重试"},
            {"from": 6, "to": 3, "label": "按通知、频道或业务实体标记已读"},
            {"from": 3, "to": 6, "label": "返回统一未读计数并清除已浏览红点", "return": True},
        ],
    },
    "4-10": {
        "slug": "chat-realtime", "title": "受控聊天发送与实时发布时序图",
        "participants": ["发送者", "Nginx代理", "ChatController", "ChatService", "PostgreSQL", "实时发布器", "Socket.IO房间", "接收者"],
        "messages": [
            {"section": "连接与房间"},
            {"from": 0, "to": 1, "label": "建立 /socket.io WebSocket 连接"},
            {"from": 1, "to": 6, "label": "转发升级请求；鉴权后加入 user 与 conversation 房间"},
            {"section": "消息发送"},
            {"from": 0, "to": 2, "label": "提交纯文本消息"},
            {"from": 2, "to": 3, "label": "校验会话、成员、首轮三条限制与双窗口限流"},
            {"from": 3, "to": 3, "label": "敏感词检查；命中则阻止并审计"},
            {"from": 3, "to": 4, "label": "事务保存消息、会话时间与必要审计"},
            {"from": 3, "to": 5, "label": "持久化成功后发布"},
            {"from": 5, "to": 6, "label": "发送 conversation 与 user 房间事件"},
            {"from": 6, "to": 7, "label": "即时显示消息并更新未读"},
            {"from": 7, "to": 4, "label": "提交已读游标"},
        ],
    },
    "4-11": {
        "slug": "ai-runtime-routing", "title": "AI 模型策略、BYOK 与运行时序图",
        "participants": ["AI页面", "AiController", "AiService", "模型策略", "知识/Skill路由", "工具守卫", "模型供应商", "运行记录"],
        "messages": [
            {"section": "请求编排"},
            {"from": 0, "to": 1, "label": "提交会话、模型配置与已固定 Skill"},
            {"from": 1, "to": 2, "label": "创建本次 AI 请求"},
            {"from": 2, "to": 3, "label": "按角色与三档策略选择平台模型或 BYOK"},
            {"from": 3, "to": 7, "label": "解密凭据并创建 RUNNING 运行记录"},
            {"from": 2, "to": 4, "label": "检索有限知识摘要并加载声明式 Skill"},
            {"from": 2, "to": 5, "label": "按角色限制工具；写操作仅形成提案"},
            {"from": 2, "to": 6, "label": "发送上下文与本次模型参数"},
            {"from": 6, "to": 2, "label": "流式返回回复或工具请求", "return": True},
            {"from": 2, "to": 7, "label": "保存步骤、用量、错误与最终状态"},
            {"from": 2, "to": 0, "label": "同一业务会话可在下次请求切换模型", "return": True},
            {"from": 0, "to": 7, "label": "取消请求时条件更新为 CANCELLED"},
        ],
    },
    "4-12": {
        "slug": "ai-report-advice", "title": "漏洞报告解析与按需 AI 建议时序图",
        "participants": ["用户/审核员", "AI控制器", "PDF解析服务", "脱敏服务", "完整度校验", "模型供应商", "建议存储", "漏洞服务"],
        "messages": [
            {"section": "用户报告解析"},
            {"from": 0, "to": 1, "label": "上传多个 PDF；每次选择一个候选漏洞"},
            {"from": 1, "to": 2, "label": "提取文本；扫描件不足时返回可理解提示"},
            {"from": 2, "to": 3, "label": "字段级脱敏；不可靠参数直接省略"},
            {"from": 1, "to": 4, "label": "独立校验必要字段完整度"},
            {"from": 1, "to": 5, "label": "最多 5000 字关键信息执行 Agent 评分"},
            {"from": 5, "to": 6, "label": "持久化评分、优点、建议与限制", "return": True},
            {"from": 0, "to": 7, "label": "完整度通过并确认知情书后直接提交原始附件"},
            {"section": "审核员按需建议"},
            {"from": 0, "to": 1, "label": "主动点击 AI 建议；未点击不消耗 Token"},
            {"from": 1, "to": 5, "label": "按统一评分规则请求审核动作建议"},
            {"from": 5, "to": 6, "label": "保存建议动作与可编辑审核意见", "return": True},
            {"from": 6, "to": 0, "label": "自动填入审核意见；最终动作仍由人工确认", "return": True},
        ],
    },
}


FLOW_SPECS = {
    "4-2": {
        "slug": "security-admission", "title": "账户资料与安全准入活动图",
        "nodes": [
            {"id": "start", "kind": "start", "x": 65, "y": 280, "w": 34, "h": 34},
            {"id": "login", "label": "用户完成登录", "kind": "process", "x": 145, "y": 265},
            {"id": "profile", "label": "资料完整", "kind": "normal", "x": 445, "y": 75, "w": 180},
            {"id": "agreement", "label": "责任书已签署", "kind": "normal", "x": 445, "y": 195, "w": 180},
            {"id": "exam", "label": "安全答题已通过", "kind": "normal", "x": 445, "y": 315, "w": 180},
            {"id": "account", "label": "账户状态正常", "kind": "normal", "x": 445, "y": 435, "w": 180},
            {"id": "guard", "label": "四项条件\n全部满足？", "kind": "decision", "x": 760, "y": 245, "w": 180, "h": 120},
            {"id": "tasks", "label": "返回待完成事项\n复用责任书与答题弹窗", "kind": "warn", "x": 1060, "y": 80, "w": 250, "h": 80},
            {"id": "complete", "label": "用户完成缺失事项", "kind": "process", "x": 1060, "y": 265, "w": 250},
            {"id": "allow", "label": "准入守卫放行\n访问漏洞提交等受保护功能", "kind": "success", "x": 1025, "y": 500, "w": 285, "h": 82},
            {"id": "end", "kind": "end", "x": 1150, "y": 665, "w": 34, "h": 34},
        ],
        "edges": [
            {"points": [(99, 297), (145, 297)]},
            {"points": [(355, 297), (395, 297), (395, 107), (445, 107)]},
            {"points": [(355, 297), (395, 297), (395, 227), (445, 227)]},
            {"points": [(355, 297), (395, 297), (395, 347), (445, 347)]},
            {"points": [(355, 297), (395, 297), (395, 467), (445, 467)]},
            {"points": [(625, 107), (700, 107), (700, 275), (760, 275)]},
            {"points": [(625, 227), (720, 227), (720, 290), (760, 290)]},
            {"points": [(625, 347), (720, 347), (720, 320), (760, 320)]},
            {"points": [(625, 467), (700, 467), (700, 335), (760, 335)]},
            {"points": [(850, 245), (850, 120), (1060, 120)], "label": "否", "color": "#A25752"},
            {"points": [(1185, 160), (1185, 265)]},
            {"points": [(1060, 297), (980, 297), (980, 395), (850, 395), (850, 365)], "label": "重新校验"},
            {"points": [(940, 305), (985, 305), (985, 541), (1025, 541)], "label": "是", "color": "#55725D"},
            {"points": [(1167, 582), (1167, 665)]},
        ],
        "note": "准入结果由服务端守卫计算；前端只展示缺失项，不能自行声明已通过。",
    },
    "4-7": {
        "slug": "points-redemption", "title": "积分商城并发兑换活动图",
        "nodes": [
            {"id": "start", "kind": "start", "x": 80, "y": 110, "w": 34, "h": 34},
            {"id": "request", "label": "用户提交兑换请求", "kind": "process", "x": 155, "y": 95},
            {"id": "validate", "label": "校验商品状态、兑换限制\n与请求幂等条件", "kind": "normal", "x": 440, "y": 82, "w": 240, "h": 78},
            {"id": "balance", "label": "汇总积分流水\n确认可用积分", "kind": "normal", "x": 760, "y": 82, "w": 210, "h": 78},
            {"id": "stock", "label": "条件更新库存成功？", "kind": "decision", "x": 1070, "y": 70, "w": 190, "h": 105},
            {"id": "failure", "label": "返回库存不足、积分不足\n或重复兑换原因", "kind": "failure", "x": 1080, "y": 290, "w": 240, "h": 78},
            {"id": "ledger", "label": "创建 OUT 积分流水", "kind": "process", "x": 770, "y": 300, "w": 210},
            {"id": "order", "label": "创建兑换单", "kind": "process", "x": 455, "y": 300, "w": 210},
            {"id": "commit", "label": "事务提交", "kind": "success", "x": 155, "y": 300},
            {"id": "cancel", "label": "后续取消时新增补偿流水\n不修改历史流水", "kind": "warn", "x": 455, "y": 525, "w": 250, "h": 78},
            {"id": "end", "kind": "end", "x": 238, "y": 525, "w": 34, "h": 34},
        ],
        "edges": [
            {"points": [(114, 127), (155, 127)]}, {"points": [(365, 127), (440, 127)]},
            {"points": [(680, 121), (760, 121)]}, {"points": [(970, 121), (1070, 121)]},
            {"points": [(1165, 175), (1165, 290)], "label": "失败", "color": "#A25752"},
            {"points": [(1070, 121), (1015, 121), (1015, 332), (980, 332)], "label": "成功", "color": "#55725D"},
            {"points": [(770, 332), (665, 332)]}, {"points": [(455, 332), (365, 332)]},
            {"points": [(260, 364), (260, 525)]},
            {"points": [(365, 332), (400, 332), (400, 564), (455, 564)], "label": "后续取消", "dashed": True},
        ],
        "note": "库存扣减、积分流水与兑换单处于同一数据库事务；任一步失败整体回滚。",
    },
    "4-8": {
        "slug": "learning-announcement", "title": "学习资源与公告内容发布活动图",
        "nodes": [
            {"id": "start", "kind": "start", "x": 75, "y": 110, "w": 34, "h": 34},
            {"id": "edit", "label": "管理员编辑资源或公告", "kind": "process", "x": 150, "y": 95, "w": 230},
            {"id": "upload", "label": "资源文件与封面写入对象存储", "kind": "normal", "x": 460, "y": 95, "w": 250},
            {"id": "publish", "label": "保存内容、范围与发布状态", "kind": "normal", "x": 790, "y": 95, "w": 240},
            {"id": "visible", "label": "请求者可见？", "kind": "decision", "x": 1110, "y": 78, "w": 180, "h": 100},
            {"id": "deny", "label": "不返回管理字段\n或未授权内容", "kind": "failure", "x": 1070, "y": 300, "w": 250},
            {"id": "list", "label": "返回已发布且符合角色范围的内容", "kind": "success", "x": 740, "y": 300, "w": 270, "h": 72},
            {"id": "download", "label": "用户实际触发资源下载", "kind": "process", "x": 420, "y": 300, "w": 240},
            {"id": "available", "label": "资源与对象可用？", "kind": "decision", "x": 120, "y": 282, "w": 190, "h": 105},
            {"id": "count", "label": "增加真实下载次数\n并返回资源", "kind": "success", "x": 120, "y": 510, "w": 210, "h": 76},
            {"id": "unavailable", "label": "返回资源不可用\n不增加下载次数", "kind": "failure", "x": 420, "y": 510, "w": 240, "h": 76},
            {"id": "end", "kind": "end", "x": 208, "y": 665, "w": 34, "h": 34},
        ],
        "edges": [
            {"points": [(109, 127), (150, 127)]}, {"points": [(380, 127), (460, 127)]},
            {"points": [(710, 127), (790, 127)]}, {"points": [(1030, 127), (1110, 127)]},
            {"points": [(1200, 178), (1200, 300)], "label": "不可见", "color": "#A25752"},
            {"points": [(1110, 127), (1040, 127), (1040, 336), (1010, 336)], "label": "可见", "color": "#55725D"},
            {"points": [(740, 336), (660, 336)]}, {"points": [(420, 336), (310, 336)]},
            {"points": [(215, 387), (215, 510)], "label": "可用", "color": "#55725D"},
            {"points": [(225, 586), (225, 665)]},
            {"points": [(310, 336), (360, 336), (360, 548), (420, 548)], "label": "不可用", "color": "#A25752"},
        ],
        "note": "页面展示不提前计数；只有文件存在且下载成功的请求进入学习趋势统计。",
    },
    "4-13": {
        "slug": "knowledge-rag", "title": "AI 知识沉淀与检索增强活动图",
        "nodes": [
            {"id": "start", "kind": "start", "x": 70, "y": 105, "w": 34, "h": 34},
            {"id": "resolved", "label": "用户确认问题已解决", "kind": "process", "x": 145, "y": 90, "w": 220},
            {"id": "value", "label": "至少两轮且具有复用价值？", "kind": "decision", "x": 440, "y": 72, "w": 200, "h": 110},
            {"id": "discard", "label": "不进入沉淀\n保留原会话", "kind": "failure", "x": 430, "y": 270, "w": 220},
            {"id": "summary", "label": "生成脱敏摘要、分类\n角色范围与质量评分", "kind": "normal", "x": 730, "y": 90, "w": 250, "h": 80},
            {"id": "review", "label": "自动规则通过？", "kind": "decision", "x": 1080, "y": 72, "w": 190, "h": 110},
            {"id": "manual", "label": "进入人工知识审核", "kind": "warn", "x": 1035, "y": 270, "w": 240},
            {"id": "approve", "label": "保存为可检索知识版本", "kind": "success", "x": 720, "y": 285, "w": 260},
            {"id": "query", "label": "后续用户提出相似问题", "kind": "process", "x": 390, "y": 520, "w": 240},
            {"id": "retrieve", "label": "按角色、分类、可见性、敏感级别\n与相似度召回有限摘要", "kind": "normal", "x": 720, "y": 505, "w": 290, "h": 82},
            {"id": "answer", "label": "将召回摘要注入本次上下文\n生成更准确回答", "kind": "success", "x": 1050, "y": 505, "w": 250, "h": 82},
            {"id": "end", "kind": "end", "x": 1155, "y": 625, "w": 34, "h": 34},
        ],
        "edges": [
            {"points": [(104, 122), (145, 122)]}, {"points": [(365, 122), (440, 122)]},
            {"points": [(540, 182), (540, 270)], "label": "否", "color": "#A25752"},
            {"points": [(640, 127), (730, 127)], "label": "是", "color": "#55725D"},
            {"points": [(980, 130), (1080, 130)]},
            {"points": [(1175, 182), (1175, 270)], "label": "否或有点踩", "color": "#A77D36"},
            {"points": [(1080, 130), (1020, 130), (1020, 325), (980, 325)], "label": "通过", "color": "#55725D"},
            {"points": [(1035, 302), (1005, 302), (1005, 347), (980, 347)], "label": "人工通过"},
            {"points": [(850, 349), (850, 470), (510, 470), (510, 520)]},
            {"points": [(630, 552), (720, 552)]}, {"points": [(1010, 546), (1050, 546)]},
            {"points": [(1175, 587), (1175, 625)]},
        ],
        "note": "知识库与声明式 Skill 完全分离；历史兼容状态不代表现行业务允许转换。",
    },
}


def vulnerability_state_model() -> str:
    nodes = [
        {"id": "draft", "label": "DRAFT\n草稿", "kind": "normal", "x": 60, "y": 100, "w": 190},
        {"id": "submitted", "label": "SUBMITTED\n已提交", "kind": "process", "x": 330, "y": 100, "w": 190},
        {"id": "review", "label": "PENDING_REVIEW\n待审核", "kind": "process", "x": 610, "y": 100, "w": 210},
        {"id": "rejected", "label": "REJECTED\n已驳回", "kind": "failure", "x": 1050, "y": 100, "w": 190},
        {"id": "supplement", "label": "NEEDS_SUPPLEMENT\n待补充", "kind": "warn", "x": 410, "y": 350, "w": 220},
        {"id": "retest", "label": "PENDING_RETEST\n待复测", "kind": "success", "x": 760, "y": 350, "w": 210},
        {"id": "archived", "label": "ARCHIVED\n已归档", "kind": "success", "x": 1080, "y": 350, "w": 190},
        {"id": "fixing", "label": "FIXING\n修复中", "kind": "warn", "x": 760, "y": 590, "w": 210},
        {"id": "certified", "label": "CERTIFIED\n已签发证书", "kind": "success", "x": 1080, "y": 590, "w": 190},
        {"id": "supplement-label", "label": "要求补充（审核员）", "kind": "label", "x": 500, "y": 270, "w": 190, "h": 28},
        {"id": "confirm-label", "label": "确认有效（审核员）", "kind": "label", "x": 760, "y": 285, "w": 190, "h": 28},
    ]
    edges = [
        {"points": [(250, 132), (330, 132)], "label": "用户提交"},
        {"points": [(520, 132), (610, 132)], "label": "进入审核"},
        {"points": [(820, 132), (1050, 132)], "label": "驳回（审核员）", "color": "#A25752"},
        {"points": [(690, 164), (690, 255), (630, 255), (630, 350)], "color": "#A77D36"},
        {"points": [(410, 382), (355, 382), (355, 220), (650, 220), (650, 164)], "label": "用户补充后重审"},
        {"points": [(740, 164), (740, 320), (865, 320), (865, 350)], "color": "#55725D"},
        {"points": [(970, 382), (1080, 382)], "label": "复测通过/归档"},
        {"points": [(840, 414), (840, 590)], "label": "退回修复", "color": "#A77D36"},
        {"points": [(890, 590), (890, 500), (930, 500), (930, 414)], "label": "标记待复测"},
        {"points": [(1175, 414), (1175, 590)], "label": "签发证书"},
    ]
    return flow_model(
        "漏洞审核、补充、复测与归档状态图", nodes, edges,
        note="最终状态由服务端依据当前状态与人工 ReviewDecision 计算；AI 只提供建议，不直接迁移状态。",
    )


def skill_state_model() -> str:
    nodes = [
        {"id": "draft", "label": "DRAFT\n用户草稿", "kind": "normal", "x": 55, "y": 90, "w": 180},
        {"id": "private", "label": "ACTIVE_PRIVATE\n私有可用", "kind": "process", "x": 305, "y": 90, "w": 200},
        {"id": "submitted", "label": "SUBMITTED\n申请公开", "kind": "warn", "x": 580, "y": 90, "w": 190},
        {"id": "review", "label": "UNDER_REVIEW\n人工审核", "kind": "warn", "x": 850, "y": 90, "w": 200},
        {"id": "published", "label": "PUBLISHED\n公开可用", "kind": "success", "x": 1130, "y": 90, "w": 190},
        {"id": "changes", "label": "CHANGES_REQUESTED\n要求修改", "kind": "warn", "x": 580, "y": 335, "w": 230},
        {"id": "rejected", "label": "REJECTED\n已拒绝", "kind": "failure", "x": 860, "y": 335, "w": 190},
        {"id": "disabled", "label": "DISABLED\n已停用", "kind": "normal", "x": 1130, "y": 335, "w": 190},
        {"id": "archived", "label": "ARCHIVED\n已归档", "kind": "normal", "x": 1130, "y": 570, "w": 190},
        {"id": "system", "label": "系统 Skill\n管理员创建、编辑、发布\n可设置用户侧展示与默认固定", "kind": "process", "x": 55, "y": 565, "w": 300, "h": 100},
        {"id": "pin", "label": "用户固定至输入框上方\n最多选择 3 个并调整顺序", "kind": "success", "x": 430, "y": 575, "w": 300, "h": 80},
    ]
    edges = [
        {"points": [(235, 122), (305, 122)], "label": "启用"},
        {"points": [(505, 122), (580, 122)], "label": "申请公开"},
        {"points": [(770, 122), (850, 122)], "label": "管理员受理"},
        {"points": [(1050, 122), (1130, 122)], "label": "通过", "color": "#55725D"},
        {"points": [(900, 154), (900, 275), (695, 275), (695, 335)], "label": "要求修改", "color": "#A77D36"},
        {"points": [(580, 367), (540, 367), (540, 230), (405, 230), (405, 154)], "label": "修改后启用"},
        {"points": [(950, 154), (950, 335)], "label": "拒绝", "color": "#A25752"},
        {"points": [(860, 367), (800, 367), (800, 240), (455, 240), (455, 154)], "label": "修改后启用"},
        {"points": [(1225, 154), (1225, 335)], "label": "停用"},
        {"points": [(1270, 335), (1270, 250), (1175, 250), (1175, 154)], "label": "恢复"},
        {"points": [(1225, 399), (1225, 570)], "label": "归档"},
        {"points": [(355, 615), (430, 615)], "label": "展示/默认固定"},
        {"points": [(1130, 122), (1080, 122), (1080, 500), (730, 500), (730, 615)], "label": "用户选择公开 Skill"},
    ]
    return flow_model(
        "声明式 Skill 生命周期与固定关系图", nodes, edges,
        note="审核员只能使用平台发布的 Skill，不能创建或审核。知识库不创建 Skill，也不能转换为 Skill。",
    )


def governance_component_model() -> str:
    nodes = [
        {"id": "student", "label": "用户\n业务功能与本人资源", "kind": "normal", "x": 70, "y": 90, "w": 220, "h": 76},
        {"id": "auditor", "label": "审核员\n漏洞审核域", "kind": "normal", "x": 370, "y": 90, "w": 220, "h": 76},
        {"id": "admin", "label": "管理员\n平台治理域", "kind": "normal", "x": 670, "y": 90, "w": 220, "h": 76},
        {"id": "settings", "label": "系统设置服务\n外观、准入、模型、通知策略", "kind": "warn", "x": 1030, "y": 82, "w": 280, "h": 92},
        {"id": "jwt", "label": "JWT 身份认证", "kind": "process", "x": 85, "y": 285, "w": 190},
        {"id": "rbac", "label": "角色与权限守卫", "kind": "process", "x": 385, "y": 285, "w": 200},
        {"id": "ownership", "label": "资源归属与状态条件", "kind": "process", "x": 675, "y": 285, "w": 220},
        {"id": "dashboard", "label": "仪表盘服务\n聚合脱敏统计", "kind": "normal", "x": 1030, "y": 285, "w": 280, "h": 76},
        {"id": "services", "label": "受控业务服务\n用户 / 漏洞 / 证书 / 内容 / AI", "kind": "success", "x": 345, "y": 500, "w": 440, "h": 90},
        {"id": "audit", "label": "AuditLog\n操作者、动作、对象、结果、请求编号与时间", "kind": "warn", "x": 930, "y": 495, "w": 380, "h": 100},
        {"id": "db", "label": "PostgreSQL", "kind": "normal", "x": 600, "y": 720, "w": 220},
    ]
    edges = [
        {"points": [(180, 166), (180, 285)]},
        {"points": [(480, 166), (480, 285)]},
        {"points": [(780, 166), (780, 285)]},
        {"points": [(275, 317), (385, 317)]},
        {"points": [(585, 317), (675, 317)]},
        {"points": [(785, 349), (785, 435), (565, 435), (565, 500)]},
        {"points": [(1030, 128), (950, 128), (950, 455), (785, 455), (785, 520)], "label": "运行策略"},
        {"points": [(785, 545), (860, 545), (860, 323), (1030, 323)], "label": "聚合查询"},
        {"points": [(785, 555), (930, 555)], "label": "关键操作审计"},
        {"points": [(1310, 128), (1350, 128), (1350, 545), (1310, 545)], "label": "变更审计"},
        {"points": [(565, 590), (565, 680), (660, 680), (660, 720)]},
        {"points": [(1120, 595), (1120, 680), (760, 680), (760, 720)]},
    ]
    return flow_model(
        "用户、系统设置、仪表盘与审计组件图", nodes, edges,
        note="权限判断同时包含角色权限、资源归属与业务状态；前端菜单隐藏不能替代服务端授权。",
    )


def write(number: str, slug: str, title: str, model: str) -> Path:
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    path = SPEC_DIR / f"figure-{number}-{slug}.drawio"
    payload = drawio(f"figure-{number}", f"图{number} {title}", model)
    ElementTree.fromstring(payload)
    path.write_text(payload, encoding="utf-8")
    return path


def generate() -> list[Path]:
    written: list[Path] = []
    for number, spec in SEQUENCE_SPECS.items():
        written.append(write(number, spec["slug"], spec["title"], sequence_model(spec["title"], spec["participants"], spec["messages"])))
    for number, spec in FLOW_SPECS.items():
        written.append(write(number, spec["slug"], spec["title"], flow_model(spec["title"], spec["nodes"], spec["edges"], note=spec["note"])))
    written.append(write("4-5", "vulnerability-lifecycle", "漏洞审核、补充、复测与归档状态图", vulnerability_state_model()))
    written.append(write("4-14", "skill-lifecycle", "声明式 Skill 生命周期与固定关系图", skill_state_model()))
    written.append(write("4-15", "governance-audit", "用户、系统设置、仪表盘与审计组件图", governance_component_model()))
    return sorted(written, key=lambda path: [int(part) if part.isdigit() else part for part in path.stem.replace("figure-", "").split("-")[:2]])


if __name__ == "__main__":
    paths = generate()
    print(f"Generated {len(paths)} chapter 4 draw.io files")
    for path in paths:
        print(path.relative_to(ROOT))
