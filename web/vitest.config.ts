import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // 테스트는 AI 결과 파일 캐시(web/.cache)를 읽거나 쓰지 않는다(테스트끼리 결과가 섞이지 않게)
  test: { env: { AI_CACHE_DISABLE_FILE: "1" } },
});
