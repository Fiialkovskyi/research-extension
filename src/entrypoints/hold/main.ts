import { browser } from "wxt/browser";

import { HOLD_PORT_NAME } from "@/features/diagnostics";

/**
 * The hold page (spike M0-1, `hostPage` strategy): it connects a port the
 * background posts to while long work runs, and counts the posts in its title.
 * The background opens it and closes it.
 *
 * The listener is not decoration: in the spike, the background was unloaded
 * on schedule while this page only held the port, and stayed loaded once the
 * page listened for its posts.
 */
const port = browser.runtime.connect({ name: HOLD_PORT_NAME });
let pings = 0;

port.onMessage.addListener(() => {
  pings += 1;
  document.title = `Research Graph — working (${pings})`;
});
