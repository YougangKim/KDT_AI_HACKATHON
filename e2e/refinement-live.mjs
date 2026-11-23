// 공개 공고만 사용하는 명시적 실호출 검증. 사용자 저장 답변을 읽지 않습니다.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.TEST_BASE_URL || 'http://localhost:3950';
const pool = await (await fetch(base+'/api/opportunities')).json();
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await page.goto(base);
  await page.evaluate(pool=>sessionStorage.setItem('lastResult',JSON.stringify({pool,answers:[],matches:[]})),pool);
  await page.route('**/play/phrase',route=>route.fulfill({json:{ai:false}}));
  await page.route('**/api/map-config',route=>route.fulfill({json:{key:null}}));
  let calls=0;
  await page.route('**/api/refine-question',route=>++calls===1 ? route.continue() : route.fulfill({json:{ai:false,reason:'test_stop'}}));
  await page.goto(base+'/play?continue=1');
  const question = page.getByTestId('question');
  await question.waitFor({timeout:35000});
  console.log('Live generated question:',await question.innerText());
  await page.getByRole('group',{name:'추가 맞춤 탐색'}).getByRole('button').first().click();
  await page.getByRole('button',{name:'현재 조건으로 결과 보기'}).click();
  await page.waitForURL('**/result');
  const counts=await page.evaluate(()=>{const r=JSON.parse(sessionStorage.getItem('lastResult'));return {before:r.pool.length,after:r.matches.length};});
  assert.ok(counts.after>0 && counts.after<counts.before,JSON.stringify(counts));
  console.log('PASS live public announcements -> generated buttons -> actual narrowing:',counts);
} finally {await browser.close();}
