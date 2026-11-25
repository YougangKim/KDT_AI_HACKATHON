// 채용 공고 원문에서 "근무지·근무 장소" 라벨이 붙은 값만 뽑는다(기관명·본사·접수처 주소 제외)

/** 근무지를 말하는 라벨(긴 것부터: "근무지역"이 "근무지"로 잘리지 않게) */
const LABEL_RE = /(?<!비)근무\s*(?:지역|장소|예정지|위치|처|지(?!원))/; // "근무지원(금)"·"비근무지역" 제외
/** 라벨 뒤 구분 기호(근무지: / 근무지 - / [근무장소] / 근무지 = ) */
const SEP_RE = /^[\s:：=\-–—\])】>」·]+/;
/** 줄머리 글머리표 */
const BULLET_RE = /^(?:[\s□■○●◦▶▷►※*\-–·ㆍ•]+|\d+[.)]\s+)/;
const MEANINGFUL_RE = /[가-힣A-Za-z0-9]{2,}/;

/** 원문을 줄·항목 단위로 나눈다(HTML 줄바꿈 태그도 줄로) */
function segments(text: string): string[] {
  return text
    .replace(/<br\s*\/?>|<\/(?:p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .split(/\n|\s\/\s|\/(?!\d)|[.!?](?=\s|$)|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanValue(value: string): string {
  return value.replace(SEP_RE, "").replace(/^(?:은|는|:)\s+/, "").replace(SEP_RE, "").replace(BULLET_RE, "").replace(/(?:입니다|이다|임)$/, "").trim().slice(0, 80);
}

/**
 * "근무지: 서울 강남구", "근무지는 ...", "[근무장소] ...", 라벨만 있는 줄 다음 줄의 값까지 근무지 값 목록으로 돌려준다.
 * 같은 줄 라벨 앞(본사·기관 주소)은 버린다.
 */
export function workplaceValues(text: string): string[] {
  const parts = segments(text);
  const out: string[] = [];
  parts.forEach((part, i) => {
    const m = part.match(LABEL_RE);
    if (!m || m.index === undefined) return;
    const value = cleanValue(part.slice(m.index + m[0].length));
    if (MEANINGFUL_RE.test(value)) out.push(value);
    else if (parts[i + 1] && !LABEL_RE.test(parts[i + 1])) {
      const next = cleanValue(parts[i + 1]);
      if (MEANINGFUL_RE.test(next)) out.push(next);
    }
  });
  return out;
}

const SIDO = "서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주";
/** 줄임 시·도 표기 주소: "서울 강남구", "경기 성남시 분당구 판교로 1", "서울시 중구" */
export const SHORT_ADDRESS_RE = new RegExp(
  `(?:${SIDO})(?:특별시|광역시|특별자치시|특별자치도|도|시)?\\s+[가-힣0-9]+(?:시|군|구)(?:\\s+[가-힣0-9]+구)?(?:\\s+[가-힣0-9·.-]+(?:읍|면|동|가|로|길)(?:\\s+\\d+(?:-\\d+)?)?)?`,
);
