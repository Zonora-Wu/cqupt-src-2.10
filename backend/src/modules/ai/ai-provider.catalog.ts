import { AiProviderCategory } from '@prisma/client'

export const AI_PROVIDER_PRESETS = [
  { id: 'custom', name: '自定义配置', region: 'CUSTOM', category: AiProviderCategory.RELAY, baseUrl: '', websiteUrl: '', defaultModel: '', notes: '兼容 OpenAI Chat Completions API 的服务' },
  { id: 'deepseek', name: 'DeepSeek', region: 'CN', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.deepseek.com/', websiteUrl: 'https://platform.deepseek.com', defaultModel: 'deepseek-v4-flash', notes: '深度求索官方 API' },
  { id: 'moonshot', name: 'Moonshot AI', region: 'CN', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.moonshot.cn/v1/', websiteUrl: 'https://platform.moonshot.cn', defaultModel: 'moonshot-v1-8k', notes: 'Kimi 开放平台' },
  { id: 'zhipu', name: '智谱 AI', region: 'CN', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://open.bigmodel.cn/api/paas/v4/', websiteUrl: 'https://open.bigmodel.cn', defaultModel: 'glm-4-flash', notes: '智谱开放平台' },
  { id: 'qwen', name: '通义千问', region: 'CN', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/', websiteUrl: 'https://bailian.console.aliyun.com', defaultModel: 'qwen-plus', notes: '阿里云百炼兼容接口' },
  { id: 'siliconflow', name: '硅基流动', region: 'CN', category: AiProviderCategory.AGGREGATOR, baseUrl: 'https://api.siliconflow.cn/v1/', websiteUrl: 'https://cloud.siliconflow.cn', defaultModel: 'deepseek-ai/DeepSeek-V3', notes: '多模型聚合服务' },
  { id: 'modelscope', name: '魔搭社区', region: 'CN', category: AiProviderCategory.AGGREGATOR, baseUrl: 'https://api-inference.modelscope.cn/v1/', websiteUrl: 'https://modelscope.cn', defaultModel: 'Qwen/Qwen3-32B', notes: '魔搭推理 API' },
  { id: 'openai', name: 'OpenAI', region: 'GLOBAL', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.openai.com/v1/', websiteUrl: 'https://platform.openai.com', defaultModel: 'gpt-4.1-mini', notes: 'OpenAI 官方 API' },
  { id: 'openrouter', name: 'OpenRouter', region: 'GLOBAL', category: AiProviderCategory.AGGREGATOR, baseUrl: 'https://openrouter.ai/api/v1/', websiteUrl: 'https://openrouter.ai', defaultModel: 'openai/gpt-4.1-mini', notes: '多模型聚合与中转服务' },
  { id: 'xai', name: 'xAI', region: 'GLOBAL', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.x.ai/v1/', websiteUrl: 'https://console.x.ai', defaultModel: 'grok-3-mini', notes: 'xAI 官方 API' },
  { id: 'mistral', name: 'Mistral AI', region: 'GLOBAL', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.mistral.ai/v1/', websiteUrl: 'https://console.mistral.ai', defaultModel: 'mistral-small-latest', notes: 'Mistral 官方 API' },
  { id: 'groq', name: 'Groq', region: 'GLOBAL', category: AiProviderCategory.AGGREGATOR, baseUrl: 'https://api.groq.com/openai/v1/', websiteUrl: 'https://console.groq.com', defaultModel: 'llama-3.3-70b-versatile', notes: 'Groq 高速推理服务' },
] as const

export const AI_PROVIDER_CATALOG_SOURCE_COMMIT = 'a377d79303bc1e592d2783d559ca5bd6b8ba1417'

export function findProviderPreset(id: string) {
  return AI_PROVIDER_PRESETS.find((provider) => provider.id === id)
}
