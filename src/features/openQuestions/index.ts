/**
 * Open questions (REQ-SYN-008): at most 5 questions the model suggests about a
 * session — what someone comparing its findings would still need answered —
 * each with a search, labelled as suggestions, regenerated on the generation
 * schedule once the session's facts settle, stored encrypted.
 */

// `ui/` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React. Surfaces import components by path.

export { OPEN_QUESTIONS_PROMPT, SUGGEST_QUESTIONS_JOB } from "./constants";
export { openQuestionRequestSchemas, openQuestionResponseSchemas } from "./schemas";
export type { OpenQuestion, OpenQuestionsView } from "./types";
export { enqueueOpenQuestions } from "./model/enqueueOpenQuestions";
export { getQuestionsProducer } from "./model/getQuestionsProducer";
export { readOpenQuestions } from "./model/readOpenQuestions";
export { requestOpenQuestions } from "./model/requestOpenQuestions";
export { runOpenQuestionsJob, type RunOpenQuestionsJobOptions } from "./model/runOpenQuestionsJob";
