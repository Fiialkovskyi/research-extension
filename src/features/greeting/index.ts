// `ui/greeting` is deliberately absent from this barrel: the background imports
// feature barrels and has no use for React, so the surface that renders the
// component imports it from `ui/` by path.
export { getGreetingMessage } from "./model/getGreetingMessage";
