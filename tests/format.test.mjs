import test from "node:test";
import assert from "node:assert/strict";
import { formatOrderTime } from "../lib/format.js";

test("order times are shown in Pakistan time with date and time", () => {
  // 10:46 UTC is 3:46 pm in Karachi (UTC+5).
  // Browsers print "Sep" or "Sept" depending on their locale data.
  assert.match(
    formatOrderTime("2026-09-27T10:46:00Z"),
    /^27 Sept? 2026, 3:46 pm$/i,
  );
  assert.equal(formatOrderTime("not a date"), "");
});
