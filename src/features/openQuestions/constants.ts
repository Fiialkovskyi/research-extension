import openQuestionsInstructions from "./prompts/openQuestions@1.md?raw";
import openQuestionsJsonSchema from "./prompts/openQuestions@1.schema.json";

/** The open-questions prompt (REQ-SYN-008, REQ-SYN-010). */
export const OPEN_QUESTIONS_PROMPT = {
  id: "openQuestions",
  version: 1,
  instructions: openQuestionsInstructions,
  jsonSchema: openQuestionsJsonSchema,
} as const;

/** The most questions the model may suggest (REQ-SYN-008); the schemas carry the same bound. */
export const MAXIMUM_QUESTIONS = 5;

/** The job that asks the model for a session's open questions. */
export const SUGGEST_QUESTIONS_JOB = "suggestQuestions";

/** Below fact extraction, beside summaries. */
export const SUGGEST_QUESTIONS_PRIORITY = -20;

/** How long a session's facts must settle before questions are asked for. */
export const QUESTIONS_DEBOUNCE_MS = 60_000;

/** The most facts the questions are built from, as for a summary. */
export const MAXIMUM_QUESTION_FACTS = 60;

/** The longest query a question carries. */
export const MAXIMUM_QUESTION_QUERY_LENGTH = 120;

/** Five short questions with their queries. */
export const QUESTIONS_ANSWER_MAX_TOKENS = 512;

/** Sixty facts and the answer exceed Ollama's default context, as for a summary. */
export const QUESTIONS_CONTEXT_TOKENS = 8_192;
