import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args[0] === "--diff") {
  const [beforePath, afterPath] = args.slice(1);
  if (!beforePath || !afterPath) {
    throw new Error("usage: node e2e/ai-compare.mjs --diff before.json after.json");
  }
  const before = JSON.parse(await readFile(resolve(beforePath), "utf8"));
  const after = JSON.parse(await readFile(resolve(afterPath), "utf8"));
  const routes = [...new Set([...Object.keys(before.routes), ...Object.keys(after.routes)])];
  const average = (items, field) => {
    const values = items.map((item) => item[field]).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const delta = (a, b) => a === null || b === null ? null : b - a;
  const result = Object.fromEntries(routes.map((route) => {
    const a = before.routes[route] ?? [];
    const b = after.routes[route] ?? [];
    const beforeLength = average(a, "questionLength");
    const afterLength = average(b, "questionLength");
    const beforeOptions = average(a, "optionCount");
    const afterOptions = average(b, "optionCount");
    return [route, {
      sameTopLevelKeys: JSON.stringify(a.map((item) => item.topLevelKeys)) ===
        JSON.stringify(b.map((item) => item.topLevelKeys)),
      questionLength: { before: beforeLength, after: afterLength, delta: delta(beforeLength, afterLength) },
      optionCount: { before: beforeOptions, after: afterOptions, delta: delta(beforeOptions, afterOptions) },
    }];
  }));
  process.stdout.write(`${JSON.stringify({ before: beforePath, after: afterPath, routes: result }, null, 2)}\n`);
  process.exit(0);
}

const baseUrl = (args[0] || "http://localhost:3950").replace(/\/$/, "");
const outputPath = resolve(args[1] || "e2e/ai-compare-result.json");
const sample = JSON.parse(await readFile(resolve(here, "../web/data/samples/benefit.json"), "utf8"));
const evidence = sample.slice(0, 10).map(({ id, domain, title, summary }) => ({ id, domain, title, summary }));
const opportunity = sample[0];

const cases = [
  {
    route: "/api/next-question",
    body: {
      total: sample.length,
      facets: [
        {
          id: "region:eq:서울",
          text: "지금 어디에 살고 있습니까?",
          options: [
            { key: "0", label: "서울", remaining: 4 },
            { key: "1", label: "그 외 지역", remaining: 6 },
          ],
        },
        {
          id: "need:eq:교육",
          text: "어떤 지원이 더 필요합니까?",
          options: [
            { key: "0", label: "교육비", remaining: 3 },
            { key: "1", label: "생활비", remaining: 7 },
          ],
        },
      ],
      answered: [{ text: "관심 분야가 무엇입니까?", answer: "지원금·혜택" }],
      evidence,
    },
  },
  {
    route: "/api/refine-question",
    body: {
      evidence,
      answered: [{ text: "관심 분야가 무엇입니까?", answer: "지원금·혜택" }],
    },
  },
  {
    route: "/api/prep",
    body: {
      opportunity,
      answers: [{ text: "지금 어떤 상태입니까?", answer: "구직 중" }],
      location: "서울",
    },
  },
  {
    route: "/play/phrase",
    body: { attr: "age", op: "lte", value: 34 },
  },
];

function inspect(body, elapsedMs, status) {
  const object = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const question = object.question && typeof object.question === "object" ? object.question : null;
  const text = typeof question?.text === "string"
    ? question.text
    : typeof object.text === "string"
      ? object.text
      : "";
  const options = Array.isArray(question?.options) ? question.options : [];
  const validationPassed = object.ai === true
    ? Boolean(
      (question && typeof question.text === "string" && Array.isArray(question.options)) ||
      typeof object.text === "string" ||
      Array.isArray(object.tips) ||
      Array.isArray(object.drafts)
    )
    : object.ai === false;
  return {
    status,
    topLevelKeys: Object.keys(object).sort(),
    ai: typeof object.ai === "boolean" ? object.ai : null,
    questionLength: text.length,
    optionCount: options.length,
    validationPassed,
    elapsedMs,
    sample: { text, options: options.map((o) => o?.label ?? o?.text ?? o), tips: object.tips, drafts: object.drafts, questionKeys: question ? Object.keys(question).sort() : [] },
  };
}

const routes = {};
for (const testCase of cases) {
  routes[testCase.route] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${testCase.route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(testCase.body),
      });
      const body = await response.json();
      routes[testCase.route].push(inspect(body, Math.round(performance.now() - started), response.status));
    } catch (error) {
      routes[testCase.route].push({
        status: 0,
        topLevelKeys: [],
        ai: null,
        questionLength: 0,
        optionCount: 0,
        validationPassed: false,
        elapsedMs: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

await writeFile(outputPath, `${JSON.stringify({
  baseUrl,
  createdAt: new Date().toISOString(),
  routes,
}, null, 2)}\n`, "utf8");
process.stdout.write(`${outputPath}\n`);
