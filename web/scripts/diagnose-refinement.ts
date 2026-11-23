import { loadEnvConfig } from '@next/env';
import { readFileSync } from 'node:fs';
loadEnvConfig(process.cwd());
const pool = await (await fetch('http://localhost:3950/api/opportunities')).json();
const evidence = pool.slice(0,240).map((o:any)=>({id:o.id,title:o.title.slice(0,160),summary:o.summary.slice(0,240),domain:o.domain}));
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input,init);
  if (!response.ok) {
    const body = await response.clone().json().catch(()=>({}));
    let message = String(body.error?.message ?? body.errors?.[0]?.message ?? '');
    for (const [key,value] of Object.entries(process.env)) if (/KEY|TOKEN|SECRET/.test(key) && value && value.length>5) message=message.replaceAll(value,'[redacted]');
    console.log(new URL(String(input)).hostname,response.status,message.slice(0,500));
  }
  return response;
};
const {POST} = await import('../app/api/refine-question/route');
console.log('Public evidence count/chars:',evidence.length,JSON.stringify(evidence).length);
console.log('API result:',await (await POST(new Request('http://localhost/api/refine-question',{method:'POST',body:JSON.stringify({evidence,answered:[]})}))).json());
