import { SUPPORTED_QUANTIZATIONS } from "../../../../constants";

/** A weight variant the runtime can load. */
export type ModelDtype = (typeof SUPPORTED_QUANTIZATIONS)[number];

/**
 * Validates a manifest's quantization as something the runtime can load.
 *
 * Checked rather than passed through, because the quantization also selects
 * which weight file the runtime asks for. An unrecognised value would make it
 * request a file that was never installed, and the failure would surface as a
 * missing cache entry rather than as the profile mistake it is.
 *
 * @throws when the quantization is not a variant the runtime understands.
 */
export const getModelDtype = (quantization: string | undefined): ModelDtype => {
  const match = SUPPORTED_QUANTIZATIONS.find((candidate) => candidate === quantization);

  if (match === undefined) {
    throw new Error(
      `Unsupported quantization "${String(quantization)}". ` +
        `The runtime loads one of: ${SUPPORTED_QUANTIZATIONS.join(", ")}.`,
    );
  }

  return match;
};
