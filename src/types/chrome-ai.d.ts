// Type declarations for Chrome's built-in AI / Gemini Nano (window.ai) API
// Based on current origin trial specs

interface AILanguageModelCapabilities {
  available: 'readily' | 'after-download' | 'no';
}

interface AICreateOptions {
  systemPrompt?: string;
  initialPrompts?: { role: 'system' | 'user' | 'model'; content: string }[];
  expectedInputs?: { type: 'text'; languages: string[] }[];
  expectedOutputs?: { type: 'text'; languages: string[] }[];
  signal?: AbortSignal;
  monitor?: (monitor: AILanguageModelMonitor) => void;
}

interface AIPromptOptions {
  signal?: AbortSignal;
}

interface AILanguageModelSession {
  prompt(text: string, options?: AIPromptOptions): Promise<string>;
  destroy(): void;
}

interface AILanguageModelMonitor {
  addEventListener(
    event: 'downloadprogress',
    listener: (e: { loaded: number; total: number }) => void,
  ): void;
}

interface AILanguageModel {
  capabilities?(): Promise<AILanguageModelCapabilities>;
  availability(): Promise<'available' | 'downloading' | 'downloadable' | 'unavailable'>;
  create(options?: AICreateOptions): Promise<AILanguageModelSession>;
}

interface Window {
  ai?: {
    languageModel?: AILanguageModel;
    create?: (options?: AICreateOptions) => Promise<AILanguageModelSession>;
  };
}

declare const LanguageModel: AILanguageModel | undefined;
