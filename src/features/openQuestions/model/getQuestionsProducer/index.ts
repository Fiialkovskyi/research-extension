import { OPEN_QUESTIONS_PROMPT } from "../../constants";

/** What a session's questions are keyed by: the prompt version and the model. */
export const getQuestionsProducer = (modelRef: string): string =>
  `${OPEN_QUESTIONS_PROMPT.id}@${OPEN_QUESTIONS_PROMPT.version}|${modelRef}`;
