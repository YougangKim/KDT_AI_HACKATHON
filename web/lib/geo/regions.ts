const REGION_ALIASES: Record<string, string[]> = {
  서울특별시: ["서울"],
  부산광역시: ["부산"],
  대구광역시: ["대구"],
  인천광역시: ["인천"],
  광주광역시: ["광주"],
  대전광역시: ["대전"],
  울산광역시: ["울산"],
  세종특별자치시: ["세종"],
  경기도: ["경기"],
  강원특별자치도: ["강원"],
  충청북도: ["충북"],
  충청남도: ["충남"],
  전북특별자치도: ["전북"],
  전라북도: ["전북"],
  전라남도: ["전남"],
  전남광주통합특별시: ["전남", "광주"],
  경상북도: ["경북"],
  경상남도: ["경남"],
  제주특별자치도: ["제주"],
};

export const regionAliases = (name: string): string[] => REGION_ALIASES[name] ?? [name];

export interface RegionCenter {
  name: string;
  lat: number;
  lng: number;
}

/** 시도청 소재지 중심 좌표. 정확한 행정 경계 판정이 아닌 근사값이다. */
export const REGION_CENTERS: RegionCenter[] = [
  { name: "서울", lat: 37.5665, lng: 126.978 },
  { name: "부산", lat: 35.1796, lng: 129.0756 },
  { name: "대구", lat: 35.8714, lng: 128.6014 },
  { name: "인천", lat: 37.4563, lng: 126.7052 },
  { name: "광주", lat: 35.1595, lng: 126.8526 },
  { name: "대전", lat: 36.3504, lng: 127.3845 },
  { name: "울산", lat: 35.5395, lng: 129.3114 },
  { name: "세종", lat: 36.48, lng: 127.289 },
  { name: "경기", lat: 37.2636, lng: 127.0286 },
  { name: "강원", lat: 37.8854, lng: 127.7298 },
  { name: "충북", lat: 36.6357, lng: 127.4917 },
  { name: "충남", lat: 36.6588, lng: 126.6728 },
  { name: "전북", lat: 35.8203, lng: 127.1088 },
  { name: "전남", lat: 34.8161, lng: 126.463 },
  { name: "경북", lat: 36.5759, lng: 128.5056 },
  { name: "경남", lat: 35.2383, lng: 128.6924 },
  { name: "제주", lat: 33.4996, lng: 126.5312 },
];

export function regionCenter(region: string | undefined): RegionCenter | undefined {
  if (!region) return undefined;
  return REGION_CENTERS.find((item) => region.includes(item.name) || item.name.includes(region));
}

export function nearestRegion(lat: number, lng: number): string {
  return REGION_CENTERS.reduce((best, item) => {
    const distance = (item.lat - lat) ** 2 + ((item.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    return distance < best.distance ? { name: item.name, distance } : best;
  }, { name: REGION_CENTERS[0].name, distance: Infinity }).name;
}
