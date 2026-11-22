// 실데이터 연결 점검: config/api_keys.csv의 키로 공공 출처를 직접 호출해
// HTTP 상태·건수·첫 항목 필드명만 출력한다(키 값은 출력하지 않음).
// 실행: cd web && node scripts/check-sources.mjs  (--env 를 붙이면 CSV에 입력된 키 전부를 web/.env.local에 쓴다)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const BOM = /^﻿/;
const NL = "\n";

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === NL) { row.push(cell.trimEnd()); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** config/api_keys.csv에서 API_KEY가 채워진 행을 {환경변수명: 값}으로. 엑셀이 ANSI(cp949)로 저장해도 읽는다 */
function readKeys() {
  const out = {};
  const buf = readFileSync(resolve(root, "config/api_keys.csv"));
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) text = new TextDecoder("euc-kr").decode(buf);
  const rows = parseCsv(text.replace(BOM, ""));
  const h = rows[0].map((c) => c.trim());
  const ki = h.indexOf("API_KEY"), ei = h.indexOf("환경변수명");
  if (ki < 0 || ei < 0) throw new Error("CSV 머리글에 API_KEY·환경변수명 열이 없음");
  for (const r of rows.slice(1)) {
    const value = (r[ki] ?? "").trim();
    const names = (r[ei] ?? "").split("/").map((n) => n.trim()).filter((n) => /^[A-Z0-9_]+$/.test(n));
    if (!value || names.length === 0) continue;
    // "URL / TOKEN"처럼 두 개를 한 칸에 넣은 경우 공백으로 나눈다
    const parts = names.length > 1 ? value.split(/\s+/).filter((x) => x !== "/") : [value];
    names.forEach((n, i) => { if (parts[i]) out[n] = parts[i]; });
  }
  if (process.env.DATA_GO_KR_KEY) out.DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY;
  return out;
}

const keys = readKeys();
const key = keys.DATA_GO_KR_KEY;
if (!key) {
  console.log("DATA_GO_KR_KEY 없음: config/api_keys.csv에서 환경변수명이 DATA_GO_KR_KEY인 행의 API_KEY 칸에 일반 인증키(Decoding)를 넣고 저장해 주세요.");
  process.exit(1);
}
const k = encodeURIComponent(key);
const y = new Date().getFullYear();

const targets = [
  ["LH 분양임대공고문", `https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=${k}&PG_SZ=10&PAGE=1&UPP_AIS_TP_CD=06&PAN_SS=${encodeURIComponent("공고중")}`],
  ["마이홈 공공주택 모집공고", `https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList?serviceKey=${k}&pageNo=1&numOfRows=10`],
  ["잡알리오 채용", `https://apis.data.go.kr/1051000/recruitment/list?serviceKey=${k}&numOfRows=10&pageNo=1&resultType=json&ongoingYn=Y`],
  ["공공서비스(혜택)", `https://api.odcloud.kr/api/gov24/v3/serviceList?page=1&perPage=10&returnType=JSON&serviceKey=${k}&${encodeURIComponent("cond[서비스명::LIKE]")}=${encodeURIComponent("청년")}`],
  ["청약홈 분양정보(별도 활용신청)", `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?page=1&perPage=10&serviceKey=${k}`],
  ["Q-Net 시험일정", `https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList?serviceKey=${k}&numOfRows=10&pageNo=1&dataFormat=json&implYy=${y}&qualgbCd=T`],
];

/** 응답 안에서 가장 먼저 나오는 객체 배열을 찾는다 */
function firstArray(x, depth = 0) {
  if (depth > 6 || !x || typeof x !== "object") return null;
  if (Array.isArray(x)) return x.length && typeof x[0] === "object" ? x : x.map((e) => firstArray(e, depth + 1)).find(Boolean) ?? null;
  for (const v of Object.values(x)) { const a = firstArray(v, depth + 1); if (a) return a; }
  return null;
}

for (const [name, url] of targets) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = null; }
    const arr = body ? firstArray(body) : null;
    const note = body ? "" : ` (JSON 아님: ${text.slice(0, 120).replace(/\s+/g, " ")})`;
    console.log(`${res.ok && arr?.length ? "OK " : "NG "} ${name} | HTTP ${res.status} | ${arr?.length ?? 0}건 | 필드: ${arr ? Object.keys(arr[0]).slice(0, 12).join(",") : "-"}${note}`);
  } catch (e) {
    console.log(`NG  ${name} | ${e.message}`);
  }
}

if (process.argv.includes("--env")) {
  // CSV에 입력된 키 전부를 web/.env.local에 반영(기존 다른 줄은 유지). 값은 출력하지 않는다
  const p = resolve(root, "web/.env.local");
  let cur = existsSync(p) ? readFileSync(p, "utf8") : "";
  for (const [name, value] of Object.entries(keys)) {
    const re = new RegExp(`^${name}=.*$`, "m");
    if (re.test(cur)) cur = cur.replace(re, `${name}=${value}`);
    else cur = `${cur}${cur && !cur.endsWith(NL) ? NL : ""}${name}=${value}${NL}`;
  }
  writeFileSync(p, cur);
  console.log(`web/.env.local 반영: ${Object.keys(keys).join(", ")} (값은 출력 안 함)`);
}
