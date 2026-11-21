# AI 시대 "확정적 수입" 소일거리 조사 (2026-11-21 03:40)

질문: 크리에이터처럼 불확실한 수입이 아니라, AI 슬롭이 넘치는 지금 손쉽게 확정적인 돈을 받는 구조가 있나?
주의: 조사·정리이며 평가가 아니다. 해커톤 후보로 쓰면 Codex 교차 평가를 거친다.

## 1. 지금 실제로 있는 구조

| 유형 | 예 | 수입 구조 | 냉정한 메모 |
|---|---|---|---|
| 데이터 라벨링 | 크라우드웍스(아카데미·AIDE 자격), 에이모 | 건당 단가. 단순 분류 건당 약 10원, 세그멘테이션·폴리곤 건당 1,000~10,000원(약 1년 전 기사) [1][2] | 확정적이지만 단순 작업은 시급이 매우 낮음. 일감이 프로젝트 단위라 들쭉날쭉 |
| AI 답변 평가·RLHF | Outlier, Mercor, Handshake 등 해외 플랫폼 | 시간당 또는 과제당. Mercor·Handshake 연환산 매출 10억 달러 돌파(2026) [3][4] | 전문 분야(의료·법·코딩) 지식이 있을수록 단가 높음. 한국어 과제 단가는 공개 자료로 확인 못 함 |
| 사람이 만든 데이터 공급 | 음성 녹음·사진 촬영 미션, 정부 AI 학습데이터 구축사업 참여 | 건당 | "웹이 AI 생성물로 오염돼 검증된 사람 데이터가 귀해진다"는 업계 주장 [5]. 업체 마케팅성 자료가 많아 걸러 봐야 함 |
| 소상공인 AI 도입 대행 | 메뉴판 번역·리뷰 답글·상세페이지를 AI로 만들어 주고 사람이 검수 | 건당 의뢰비 | 숨고·크몽에 이미 있는 영역. 품질 보증이 관건 |

## 2. 해커톤으로 옮긴다면 (불씨, 평가 전)

- **AI 결과물 "사람 검수" 일감 브리프**: 소상공인이 AI로 만든 결과물(메뉴 번역, 안내문, 상세페이지)을 올리면 AI가 검수 체크리스트와 건당 보수가 붙은 짧은 과업으로 쪼개고, 청년이 검수해 건당 확정 보수를 받는 구조. 이전 리서치의 "동네 일감 브리프"와 같은 계열
- **라벨링·평가 일감 선별 비서**: 여러 플랫폼 과제의 실제 시급(단가 ÷ 예상 소요시간)을 계산해 "할 만한 과제"만 고르게 도움 → 플랫폼 데이터를 합법적으로 가져올 방법이 없어 반려 가능성 높음
- 공통 약점: 양면 시장(의뢰자와 청년)이라 2.5일 데모에서 실제 거래를 보여 주기 어렵고, 시드 데이터 시연이 됨

## 출처
1. [크라우드웍스 아카데미 데이터라벨링](https://academy.crowdworks.kr/data-labeling)
2. [다음 뉴스: 데이터 라벨링 부업 기사](https://v.daum.net/v/pS3gRR0HvH?f=p)
3. [Wikipedia: Mercor](https://en.wikipedia.org/wiki/Mercor)
4. [Handshake·Mercor 연환산 매출 10억 달러](https://savedelete.com/article/ai-data-labeling-startups-handshake-and-mercor-both-hit-1-billion-in-annualized-revenue/)
5. [Careerflow: Why Human Data Will Become Scarce](https://www.careerflow.ai/human-data/blogs/human-data-scarce-valuable), [Tom's Guide: 75% of web pages AI-generated](https://www.tomsguide.com/ai/75-percent-of-web-pages-are-ai-generated-ai-ceo-explains-why-companies-are-desperate-for-real-human-data)
