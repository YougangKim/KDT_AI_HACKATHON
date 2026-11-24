import Link from "next/link";

export const metadata = { title: "개인정보 처리방침 | My News" };

// 실제 사용하는 도구 기준 최소 고지. 도구를 추가·변경하면 이 페이지도 고친다.
export default function PrivacyPage() {
  return (
    <main className="flex-1 py-6 text-sm leading-6 text-slate-700">
      <h1 className="mb-4 text-xl font-extrabold text-slate-900">개인정보 처리방침</h1>
      <p className="mb-4">My News는 로그인이 없고 이름·연락처·주민번호를 받지 않습니다. 아래 정보만 서비스 제공과 개선에 씁니다.</p>

      <h2 className="mt-5 font-bold text-slate-900">1. 처리하는 정보와 보관 기간</h2>
      <ul className="ml-5 list-disc">
        <li>질문 답변·결과: 이 기기의 브라우저에만 저장합니다. 브라우저 데이터를 지우면 사라집니다.</li>
        <li>알림 저장 시: 조건(답변·관심 분야·약 1km 단위 위치·반경), 이미 본 공고 번호, 브라우저 알림 구독 정보. 마지막 저장 후 60일이 지나면 자동 삭제되고, 설정에서 조건을 지우면 바로 삭제됩니다.</li>
        <li>피드백 설문(선택): 점수·선택 항목·한 줄 의견, 응답한 화면 경로, 유입 경로 표시(ref), 응답 시각. 최근 5,000건까지만 보관합니다. IP·기기 정보는 저장하지 않습니다.</li>
        <li>방문 통계: 페이지 방문·유입 경로·국가·브라우저·기기 종류를 쿠키 없이 익명 집계합니다.</li>
      </ul>

      <h2 className="mt-5 font-bold text-slate-900">2. 처리를 맡기는 곳(국외 처리 포함)</h2>
      <ul className="ml-5 list-disc">
        <li>Vercel(미국): 서비스 호스팅, 방문 통계(Vercel Web Analytics)</li>
        <li>Upstash: 알림 조건·설문 응답 저장</li>
        <li>Anthropic·Google·Groq: 추가 질문·공고 요약 생성. 공고 내용과 질문 흐름 일부가 전송될 수 있습니다.</li>
        <li>카카오: 지도 표시·주소 검색</li>
      </ul>

      <h2 className="mt-5 font-bold text-slate-900">3. 거부와 삭제</h2>
      <p>알림 저장과 설문은 선택입니다. 하지 않아도 공고 찾기는 그대로 쓸 수 있습니다. 저장한 조건은 <Link href="/settings" className="text-indigo-600 underline">설정</Link>에서 지울 수 있습니다.</p>

      <h2 className="mt-5 font-bold text-slate-900">4. 입력 시 주의</h2>
      <p>의견 칸에 이름·연락처·건강·소득 등 개인정보를 적지 마세요.</p>

      <p className="mt-6 text-xs text-slate-500">시행일 2026-11-24</p>
    </main>
  );
}
