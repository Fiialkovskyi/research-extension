/** How far apart two numbers in one unit may be and still agree (REQ-SYN-006). */
export const VALUE_TOLERANCE = 0.05;

/** The most columns a table proposes before the user edits it (REQ-SYN-005). */
export const MAXIMUM_PROPOSED_COLUMNS = 8;

/** CSV fields starting with these are prefixed, so a spreadsheet does not evaluate them. */
export const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"] as const;
