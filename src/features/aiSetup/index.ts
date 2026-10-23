/**
 * Getting the user from a fresh install to working local AI: whether it is set
 * up, whether they started, and what tells them so.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import components by path.

export {
  BADGE_APPEARANCE,
  NOTIFICATION_ICON_PATH,
  SETUP_NOTIFICATION,
  SETUP_NOTIFICATION_ID,
  SETUP_PAGE_PATH,
} from "./constants";
export { aiSetupRequestSchemas, aiSetupResponseSchemas } from "./schemas";
export type { AiSetupStatus, TurnOnProgress } from "./types";
export { buildTurnOnPlan, type TurnOnPlan, type TurnOnStep } from "./model/buildTurnOnPlan";
export { type BadgeState, getBadgeState } from "./model/getBadgeState";
export { getSetupStep } from "./model/getSetupStep";
export type { SetupServerState, SetupStep, SetupStepInput } from "./model/getSetupStep/types";
export { collapseSetupBanner } from "./model/collapseSetupBanner";
export { isAiSetUp } from "./model/isAiSetUp";
export { readAiSetupStatus } from "./model/readAiSetupStatus";
export { startAiSetup } from "./model/startAiSetup";
