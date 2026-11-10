/**
 * Environment configuration helper
 * Priority: .env (Vite env) > localStorage (User UI settings) > Defaults
 */

const getEnv = (key) => (import.meta.env[key] ? String(import.meta.env[key]).trim() : '');

export const ENV_CONFIG = {
  datalabApiKey:
    getEnv('VITE_DATALAB_API_KEY') ||
    getEnv('DATALAB_API_KEY') ||
    '',
  llmBaseURL:
    getEnv('VITE_LLM_BASE_URL') ||
    getEnv('LLM_BASE_URL') ||
    '',
  llmApiKey:
    getEnv('VITE_LLM_API_KEY') ||
    getEnv('LLM_API_KEY') ||
    '',
  llmModel:
    getEnv('VITE_LLM_MODEL') ||
    getEnv('LLM_MODEL') ||
    '',
};

/**
 * Get initial Datalab API key:
 * Priority: .env > localStorage > ''
 */
export function getInitialDatalabKey() {
  if (ENV_CONFIG.datalabApiKey) {
    return ENV_CONFIG.datalabApiKey;
  }
  return localStorage.getItem('app_api_key') || localStorage.getItem('datalab_api_key') || '';
}

/**
 * Get initial LLM Config:
 * Priority: .env > localStorage > Defaults
 */
export function getInitialLlmConfig() {
  let saved = null;
  try {
    const raw = localStorage.getItem('app_llm_config');
    if (raw) saved = JSON.parse(raw);
  } catch {
    // ignore
  }

  const savedApiKey = localStorage.getItem('llm_api_key') || '';

  return {
    preset: saved?.preset || (ENV_CONFIG.llmBaseURL ? 'custom' : 'openai'),
    baseURL: ENV_CONFIG.llmBaseURL || saved?.baseURL || 'https://api.openai.com/v1',
    apiKey: ENV_CONFIG.llmApiKey || saved?.apiKey || savedApiKey || '',
    model: ENV_CONFIG.llmModel || saved?.model || 'gpt-4o-mini',
  };
}

