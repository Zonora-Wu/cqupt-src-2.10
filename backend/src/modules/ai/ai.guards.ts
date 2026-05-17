import { ForbiddenException } from '@nestjs/common'
import { RoleCode } from '@prisma/client'
import { isToolAllowed, getToolDefinition } from './ai.tools.registry'
import { AiToolDefinition } from './ai.types'

/** Tool 执行守卫 —— 所有 tool call 必须经过这些检查 */
export class AiGuardService {
  /**
   * 1. 白名单校验
   * 不允许执行未注册的 tool，也不允许执行超出角色权限的 tool
   */
  assertToolAllowed(name: string, role: RoleCode): void {
    if (!isToolAllowed(name, role)) {
      throw new ForbiddenException(`Tool "${name}" 不允许角色 ${role} 调用`)
    }
  }

  /**
   * 2. 参数校验
   * 用 tool definition 的 parameters schema 校验参数类型
   * 不抛异常，返回清洗后的参数（剥离未声明的字段）
   */
  validateArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
    const def = getToolDefinition(name)
    if (!def) return args

    const schema = def.parameters
    const cleaned: Record<string, unknown> = {}

    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in args && args[key] !== undefined && args[key] !== null) {
        const value = args[key]
        // 类型强转
        if (prop.type === 'number' && typeof value === 'string') {
          const parsed = Number(value)
          if (!Number.isNaN(parsed)) {
            cleaned[key] = parsed
            continue
          }
        }
        if (prop.type === 'string' && typeof value !== 'string') {
          cleaned[key] = String(value)
          continue
        }
        cleaned[key] = value
      }
    }

    return cleaned
  }

  /**
   * 3. 用户隔离
   * 后端强制覆盖 userId，不接受 Agent 传入的 userId
   */
  enforceUserIsolation(args: Record<string, unknown>, userId: string): Record<string, unknown> {
    return { ...args, userId }
  }

  /**
   * 4. 只读保证
   * 所有 tool 必须只读；写操作走 AiActionProposal
   */
  assertReadOnly(_name: string): void {
    // 当前所有注册的 tool 都是只读的
    // 将来如果添加写 tool，在此处黑名单
    const writeTools: string[] = []
    if (writeTools.includes(_name)) {
      throw new ForbiddenException(`Tool "${_name}" 是写操作，请通过 AiActionProposal 确认后执行`)
    }
  }
}
