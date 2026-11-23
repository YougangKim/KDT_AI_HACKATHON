import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.TEST_BASE_URL || 'http://localhost:3950';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const pool = ['월세 지원','전세 보증금 지원','자격증 교육비 지원','상세 확인 공고'].map((title,i)=>({id:String(i),title,summary:title,domain:'benefit',org:'테스트 기관',region:[],conditions:[],url:'https://example.org',source:'test',isSample:false,fetchedAt:'2026-11-23'}));
  await page.goto(base);
  await page.evaluate((pool)=>sessionStorage.setItem('lastResult',JSON.stringify({pool,answers:[],matches:pool.map(opportunity=>({opportunity,status:'eligible',reasons:[],unknowns:[]}))})),pool);
  const requests=[];
  await page.route('**/play/phrase',route=>route.fulfill({json:{ai:false}}));
  await page.route('**/api/next-question',route=>route.fulfill({json:{ai:false}}));
  await page.route('**/api/refine-question',async route=>{
    const body=route.request().postDataJSON(); requests.push(body);
    await route.fulfill({json: requests.length===1 ? {ai:true,question:{text:'현재 줄이고 싶은 비용은 무엇입니까?',why:'남은 공고의 지원 항목을 비교합니다.',options:[{label:'주거 비용',ids:['0','1']},{label:'학습 비용',ids:['2']}]}}:{ai:false,reason:'provider_unavailable'}});
  });
  await page.goto(base+'/play?continue=1');
  await page.getByTestId('question').filter({hasText:'현재 줄이고 싶은 비용은 무엇입니까?'}).waitFor();
  assert.equal(requests[0].evidence.length,4);
  assert.equal('facets' in requests[0],false);
  await page.getByRole('button',{name:'주거 비용',exact:true}).click();
  await page.getByText('추가 질문 생성에 성공하지 못했습니다',{exact:true}).waitFor();
  assert.deepEqual(requests[1].evidence.map(e=>e.id).sort(),['0','1','3']);
  assert.equal(requests[1].answered.length,2);
  await page.getByRole('button',{name:'이전 질문'}).click();
  await page.getByTestId('question').filter({hasText:'현재 줄이고 싶은 비용은 무엇입니까?'}).waitFor({timeout:5000}).catch(async error => {console.log('Undo state:',await page.locator('body').innerText(), requests.length);throw error;});
  await page.getByRole('button',{name:'모름',exact:true}).click();
  await page.getByText('추가 질문 생성에 성공하지 못했습니다',{exact:true}).waitFor();
  assert.equal(requests.at(-1).evidence.length,4);
  await page.getByRole('button',{name:'추가 질문 다시 생성'}).click();
  await page.getByText('추가 질문 생성에 성공하지 못했습니다',{exact:true}).waitFor();
  assert.equal(requests.length,4);
  console.log('PASS: new question buttons -> narrowed evidence/history -> undo -> unknown preserves all -> retry');
} finally {await browser.close();}
