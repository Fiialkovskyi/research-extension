import { Greeting } from "@/features/greeting/ui/greeting";
import { Panel } from "@/shared/ui";

/** Composition root of the toolbar popup surface. */
export function PopupApp() {
  return (
    <Panel>
      <Greeting />
    </Panel>
  );
}
