/**
 * Two vectors from different embedding spaces were about to be compared
 * (REQ-LIN-002). Their similarity would be a number with no meaning, so the
 * comparison is refused rather than answered.
 */
export class EmbeddingSpaceMismatchError extends Error {
  constructor(
    readonly firstSpaceId: string,
    readonly secondSpaceId: string,
  ) {
    super(`Cannot compare vectors from embedding spaces ${firstSpaceId} and ${secondSpaceId}.`);
    this.name = "EmbeddingSpaceMismatchError";
  }
}
