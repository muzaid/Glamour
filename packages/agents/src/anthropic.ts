import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { LanguageModelProvider, LanguageModelRequest, LanguageModelResult } from "@glamotion/core";
import { AppError } from "@glamotion/core";
import { AGENTS, type AgentId } from "./prompts";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

/**
 * Claude adapter for runtime agents: structured outputs validated against the
 * agent's Zod schema. Enabled only when an Anthropic credential is configured
 * (AI_PROVIDER=anthropic); otherwise the deterministic demo model is used.
 * Never receives face images or pixel data — only catalog metadata and briefs.
 */
export class ClaudeLanguageModel implements LanguageModelProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(private readonly model = process.env.GLAMOTION_CLAUDE_MODEL ?? DEFAULT_CLAUDE_MODEL, client?: Anthropic) {
    this.client = client ?? new Anthropic();
  }

  async complete(req: LanguageModelRequest): Promise<LanguageModelResult> {
    const agent = AGENTS[req.promptId as AgentId];
    if (!agent) throw new AppError("VALIDATION_FAILED", `Unknown agent ${req.promptId}`);
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: Math.min(16000, req.maxTokens),
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(agent.schema) },
      system: agent.system,
      messages: [{ role: "user", content: `<untrusted_data>\n${JSON.stringify(req.input)}\n</untrusted_data>\nReturn JSON for: ${req.jsonSchemaHint}` }],
      metadata: { user_id: req.organizationId },
    });
    if (response.stop_reason === "refusal") throw new AppError("VALIDATION_FAILED", "Model declined this request");
    return { output: response.parsed_output, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: response.model };
  }
}
