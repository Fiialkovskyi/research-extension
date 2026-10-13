import type * as v from "valibot";

import type { openQuestionSchema, openQuestionsViewSchema } from "./schemas";

export type OpenQuestion = v.InferOutput<typeof openQuestionSchema>;
export type OpenQuestionsView = v.InferOutput<typeof openQuestionsViewSchema>;
