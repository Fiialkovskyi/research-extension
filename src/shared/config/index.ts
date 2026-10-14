/**
 * The extension's configuration: values, not logic.
 *
 * One barrel over a subdirectory per topic. A topic holds files rather than an
 * entity, so it has no `index.ts` of its own.
 */

export { ANCHOR_RULES } from "./anchorRules/constants";
export { CAPTURE_DENYLIST } from "./captureDenylist/constants";
export type {
  CaptureDenylist,
  DenylistCategory,
  DenylistCategoryName,
} from "./captureDenylist/types";
export { ENGAGEMENT_RULES, ENGAGEMENT_STATES } from "./engagementRules/constants";
export { ENGAGEMENT_DISPLAY } from "./engagementRules/display";
export { EXTENSION_ID, FIREFOX_MIN_VERSION, OPTIONS_PATH, POPUP_PATH } from "./extension/constants";
export {
  BGE_SMALL_EN_V1_5,
  BUNDLED_MODEL_PROFILES,
  DEFAULT_PROFILE_BY_FAMILY,
  MINILM_L6_V2,
} from "./modelProfiles/constants";
export type {
  EmbeddingProfileContract,
  ModelProfile,
  TextGenerationProfileContract,
} from "./modelProfiles/types";
export {
  LOCAL_INFERENCE_ORIGINS,
  OLLAMA_DOWNLOAD_URL,
  OLLAMA_ORIGIN,
  OLLAMA_PROFILES,
} from "./ollama/constants";
export type {
  OllamaEmbeddingProfile,
  OllamaGenerationProfile,
  OllamaProfile,
} from "./ollama/types";
export { ONNX_RUNTIME_DIRECTORY, ONNX_RUNTIME_WASM_VARIANTS } from "./onnxRuntime/constants";
export type { OnnxRuntimeVariant } from "./onnxRuntime/types";
export { SEARCH_ENGINES } from "./searchEngines/constants";
export type { SearchEngine } from "./searchEngines/types";
