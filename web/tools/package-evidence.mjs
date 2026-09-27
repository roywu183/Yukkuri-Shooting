import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const names = [
  "browser-chrome",
  "browser-msedge",
  "edge-cases",
  "lifecycle",
  "production-smoke",
  "soak-chrome",
  "campaign-journey",
  "community-flow",
];
mkdirSync("validation/screenshots", { recursive: true });
const reports = Object.fromEntries(
  names.map((name) => [
    name,
    JSON.parse(readFileSync(`test-results/${name}.json`, "utf8")),
  ]),
);
for (const [name, report] of Object.entries(reports)) {
  assert.equal(report.completed, true, name);
  if (report.errors) assert.equal(report.errors.length, 0, name + " errors");
  copyFileSync(`test-results/${name}.json`, `validation/${name}.json`);
}
const soak = reports["soak-chrome"];
const unitTests = JSON.parse(
  readFileSync("test-results/unit-tests.json", "utf8"),
);
assert.equal(unitTests.success, true, "Unit tests");
assert.equal(unitTests.numFailedTests, 0);
copyFileSync("test-results/unit-tests.json", "validation/unit-tests.json");
copyFileSync("test-results/build.log", "validation/build.log");
assert.ok(soak.requestedSeconds >= 1800 && soak.wallSeconds >= 1800);
const sourceFiles = readdirSync("src", { recursive: true })
  .filter((f) => /\.(ts|css|json)$/.test(f))
  .sort();
const sourceHash = createHash("sha256");
for (const f of sourceFiles)
  sourceHash.update(f).update(readFileSync("src/" + f));
assert.equal(
  sourceHash.digest("hex"),
  soak.sourceHash,
  "Packaged source must match soak",
);
for (const file of [
  "production-home.png",
  "production-models.png",
  "chrome-models-back.png",
  "chrome-models-side.png",
  "chrome-models-helper.png",
  "chrome-park-scope.png",
  "chrome-city-scope.png",
  "chrome-residential-scope.png",
  "chrome-shopping_street-scope.png",
  "chrome-factory-scope.png",
  "chrome-rural-scope.png",
  "soak-chrome.png",
  "community.png",
])
  copyFileSync("test-results/" + file, "validation/screenshots/" + file);
const stable = soak.samples.filter((s) => s.wallSeconds >= 60);
const range = (key) => ({
  min: Math.min(...stable.map((s) => s[key])),
  max: Math.max(...stable.map((s) => s[key])),
});
const summary = {
  generatedAt: new Date().toISOString(),
  sourceHash: soak.sourceHash,
  durationSeconds: soak.wallSeconds,
  gpu: soak.samples[0].gpu,
  samples: soak.samples.length,
  afterWarmup: {
    fpsRolling120Frames: range("fps"),
    geometries: range("geometries"),
    textures: range("textures"),
    resources: range("resources"),
    actors: range("actors"),
    drops: range("drops"),
    jsHeapBytes: range("jsHeap"),
  },
  finalSample: soak.samples.at(-1),
  browserRuns:
    reports["browser-chrome"].runs.length +
    reports["browser-msedge"].runs.length,
  freshCampaignMissions: reports["campaign-journey"].runs.length,
  unitTests: unitTests.numPassedTests,
  files: Object.fromEntries(
    ["dist", "src"].flatMap((dir) =>
      readdirSync(dir, { recursive: true })
        .filter((f) => /\.(ts|css|json|html|js)$/.test(f))
        .map((f) => {
          const name = dir + "/" + f.replaceAll("\\", "/");
          return [
            name,
            createHash("sha256").update(readFileSync(name)).digest("hex"),
          ];
        }),
    ),
  ),
};
writeFileSync("validation/summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, files: undefined }, null, 2));
