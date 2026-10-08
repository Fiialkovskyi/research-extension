import { getGreetingMessage } from "../../model/getGreetingMessage";

/** Renders the popup's greeting. */
export function Greeting() {
  return (
    <p data-testid="greeting" className="text-base font-medium">
      {getGreetingMessage()}
    </p>
  );
}
