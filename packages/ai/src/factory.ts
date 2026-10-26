/**
 * @license Apache-2.0
 * ShellMind AI Provider Factory
 */

import { ShellMindConfig } from '@shellmind/core';
import { IAIProvider } from './provider.interface.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAIProvider } from './providers/openai.js';
import { OllamaProvider } from './providers/ollama.js';

export class AIProviderFactory {
  public static create(config: ShellMindConfig): IAIProvider {
    const active = config.provider.active;

    switch (active) {
      case 'gemini':
        return new GeminiProvider({
          model: config.provider.gemini?.model,
        });

      case 'openai':
        return new OpenAIProvider({
          apiKey: config.provider.openai?.apiKey,
          model: config.provider.openai?.model,
          baseUrl: config.provider.openai?.baseUrl,
        });

      case 'ollama':
        return new OllamaProvider({
          endpoint: config.provider.ollama?.endpoint,
          model: config.provider.ollama?.model,
        });

      default:
        console.warn(`Unknown provider '${active}', defaulting to Gemini`);
        return new GeminiProvider();
    }
  }
}
