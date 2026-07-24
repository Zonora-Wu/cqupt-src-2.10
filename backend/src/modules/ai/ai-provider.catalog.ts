import { AiProviderCategory } from '@prisma/client'

export const AI_PROVIDER_PRESETS = [
  { id: 'openai', name: 'OpenAI', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.openai.com/v1/' },
  { id: 'deepseek', name: 'DeepSeek', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.deepseek.com/v1/' },
  { id: 'moonshot', name: 'Moonshot AI', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://api.moonshot.cn/v1/' },
  { id: 'zhipu', name: '智谱 AI', category: AiProviderCategory.OFFICIAL, baseUrl: 'https://open.bigmodel.cn/api/paas/v4/' },
  { id: 'siliconflow', name: '硅基流动', category: AiProviderCategory.AGGREGATOR, baseUrl: 'https://api.siliconflow.cn/v1/' },
  { id: 'openrouter', name: 'OpenRouter', category: AiProviderCategory.AGGREGATOR, baseUrl: 'https://openrouter.ai/api/v1/' },
  { id: 'modelscope', name: '魔搭社区', category: AiProviderCategory.AGGREGATOR, baseUrl: 'https://api-inference.modelscope.cn/v1/' },
] as const

export const AI_PROVIDER_CATALOG_SOURCE_COMMIT = 'a377d79303bc1e592d2783d559ca5bd6b8ba1417'

export function findProviderPreset(id: string) {
  return AI_PROVIDER_PRESETS.find((provider) => provider.id === id)
}
