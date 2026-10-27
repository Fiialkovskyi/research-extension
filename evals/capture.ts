// The page-capture command: `npm run eval:capture -- <url> <id>`. A development tool, run by `tsx`.
import { FIXTURES_DIRECTORY } from "./constants";
import { captureFixture } from "./utils/captureFixture";

const [url, id] = process.argv.slice(2);

if (url === undefined || id === undefined) {
  process.stderr.write("Usage: npm run eval:capture -- <url> <id>\n");
  process.exit(1);
}

const result = await captureFixture(
  url,
  id,
  FIXTURES_DIRECTORY,
  new Date().toISOString().slice(0, 10),
);

if (result.saved) {
  process.stdout.write(
    `Saved ${result.directory}. Fill in ${result.directory}/labels.json, then run npm run eval.\n`,
  );
} else {
  process.stderr.write(`Nothing saved: ${result.reason}.\n`);
  process.exit(1);
}
