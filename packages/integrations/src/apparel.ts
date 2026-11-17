import { AppError, type ApparelTryOnProvider } from "@glamotion/core";

/**
 * Default provider: no AI try-on vendor is configured. It refuses honestly
 * instead of returning a fake image (CLAUDE.md rule 7). A real adapter
 * (vendor is an open decision, ADR-010) implements the same port.
 */
export class UnconfiguredApparelTryOnProvider implements ApparelTryOnProvider {
  readonly name = "unconfigured";
  readonly disclosure = null;
  async generate(): Promise<never> {
    throw new AppError("FEATURE_DISABLED", "Realistic AI try-on isn't configured for this store yet. The on-device preview is still available.");
  }
}
