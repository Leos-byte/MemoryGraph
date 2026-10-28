import type { Settings } from './types';

interface ModelPreset extends Pick<Settings, 'baseUrl' | 'model' | 'apiMode'> {
  name: string;
  compatibilityAlias?: boolean;
}

export const defaultOpenAiPreset: ModelPreset = {
  name: 'OpenAI / gpt-6.1-terra', baseUrl: 'https://api.openai.com', model: 'gpt-6.1-terra', apiMode: 'responses',
};

// Verified against provider documentation on 2026-10-28; saved/custom IDs remain valid inputs.
export const modelPresets: readonly ModelPreset[] = [
  defaultOpenAiPreset,
  ...['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'].map(model => ({
    name: `OpenAI / ${model}`, baseUrl: 'https://api.openai.com', model, apiMode: 'responses' as const,
  })),
  ...['deepseek-flash', 'deepseek-v4-pro'].map(model => ({
    name: `DeepSeek / ${model}`, baseUrl: 'https://api.deepseek.com', model, apiMode: 'chat_completions' as const,
  })),
  { name: 'DeepSeek / deepseek-v4-flash', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', apiMode: 'chat_completions', compatibilityAlias: true },
];
