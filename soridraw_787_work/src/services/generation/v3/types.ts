import type { GenerateSongParams } from '../../../types';

/** Raw app state passed into V3 without interpretation or creative rewriting. */
export type V3SourceParams = GenerateSongParams;

export interface V3CollectedInput {
  params: V3SourceParams;
  collectedAt: number;
}

export interface V3PromptRequest {
  systemInstruction: string;
  userContent: string;
}

export interface V3GenerationResult {
  title: string;
  musicPrompt: string;
  lyrics: string;
  rawResponse: string;
}

export interface V3ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface V3ValidationResult {
  valid: boolean;
  issues: V3ValidationIssue[];
}
