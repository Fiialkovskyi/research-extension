import { Greeting } from "@/features/greeting";
import { Panel } from "@/shared/ui/panel";

/** Composition root of the toolbar popup surface. */
export function PopupApp() {
  return (
    <Panel>
      <Greeting />
    </Panel>
  );
}
