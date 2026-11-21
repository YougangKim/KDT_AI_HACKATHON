import Link from "next/link";

const DOMAINS = [
  { emoji: "🏠", label: "청년 주택" },
  { emoji: "💰", label: "지원금·혜택" },
  { emoji: "💼", label: "채용·인턴" },
  { emoji: "⏰", label: "알바" },
  { emoji: "📚", label: "국비 과정" },
  { emoji: "📝", label: "자격증 일정" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-8 py-12">
      <div className="space-y-3 text-center">
        <p className="text-5xl" aria-hidden>
          🔮
        </p>
        <h1 className="text-3xl font-bold">찾아줄게</h1>
        <p className="text-lg font-semibold leading-snug text-slate-700 break-keep">
          질문 몇 개로 조건을 저장하면,
          <br />
          연결된 출처를 매일 다시 조회해서
          <br />
          처음 보는 공고만 알려 줄게요.
        </p>
      </div>

      <p className="text-center text-xs text-slate-500">
        대상 출처: LH·마이홈·잡알리오·정부24·온통청년·고용24·Q-Net (연결 전 출처는 예시 데이터로 표시)
      </p>

      <ul className="grid grid-cols-3 gap-2 text-center text-sm">
        {DOMAINS.map((d) => (
          <li key={d.label} className="rounded-xl bg-white p-3 shadow-sm">
            <span className="block text-2xl" aria-hidden>
              {d.emoji}
            </span>
            {d.label}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <Link
          href="/play"
          className="block rounded-2xl bg-indigo-600 py-4 text-center text-lg font-semibold text-white shadow active:scale-95"
        >
          30초 만에 시작하기
        </Link>
        <Link href="/alerts" className="block py-2 text-center text-sm text-slate-500 underline">
          이미 조건이 있어요 → 알림함
        </Link>
      </div>

      <p className="text-center text-xs text-slate-400">
        결과는 참고용이며 최종 자격은 각 공고 원문에서 확인하세요. 알림을 켜면 예·아니오 답변만 서버에 저장돼요(이름·연락처 없음).
      </p>
    </main>
  );
}
