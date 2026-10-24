// QA com armazenamento exclusivo da worktree e notícias sintéticas.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.notEqual(repo, '/root/CHATGPT');
const data = path.join(repo, 'data');
try { await access(data); throw new Error('QA exige data inexistente'); } catch(error) { if(error.code !== 'ENOENT') throw error; }
const out = process.env.DISCOVER_QA_OUTPUT || '/root/.cache/gaucho-discover-delete/browser';
const port = process.env.DISCOVER_QA_PORT || '3149';
const base = `http://127.0.0.1:${port}/chat`;
const env = { PATH:'/usr/bin:/bin', NODE_ENV:'production', NEXT_PUBLIC_BASE_PATH:'/chat', AUTH_ENABLED:'true', AUTH_USERNAME:'synthetic-user', AUTH_PASSWORD:'synthetic-password', JWT_SECRET:'synthetic-discover-qa-secret-not-production', GAUCHO_ISOLATED_RUNTIME:'true', RATE_LIMIT_ENABLED:'false' };
const articles = [1,2,3].map(n=>({id:`synthetic-${n}`, title:`Notícia sintética ${n}`, summary:'Resumo sintético para conferir a exclusão.', content:'Texto completo com contexto e fontes verificáveis.', topic:'Pesquisa', publishedAt:'2026-10-23T12:00:00Z',createdAt:'2026-10-23T12:00:00Z', sources:[{title:'Fonte sintética',url:`https://example.org/${n}`}]}));
const state = { topics:['Pesquisa'], articles, job:{status:'idle'}, schedule:{enabled:false}, lastDailyDate:'2026-10-23' };
let server, browser, page, ownsData=false, log='';const results=[];
const wait = async(fn)=>{ for(let i=0;i<100;i++){if(await fn())return; await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout'); };
try {
 await mkdir(out,{recursive:true});await mkdir(data);ownsData=true;
 await writeFile(path.join(data,'discover.json'),JSON.stringify(state));
 await writeFile(path.join(data,'conversations.json'),JSON.stringify([{id:'qa-conversation',title:'Conversa sintética',messages:[],createdAt:'2026-10-23T12:00:00Z',updatedAt:'2026-10-23T12:00:00Z'}]));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',port],{cwd:repo,env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
 await wait(()=>fetch(`${base}/login`).then(r=>r.ok).catch(()=>false));
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:true,env});
 const anonymous=await fetch(`${base}/api/discover`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:['synthetic-1']})});assert.equal(anonymous.status,401);
 for(const [width,embedded] of [[1440,false],[390,false],[320,false],[1440,true],[390,true]]) {
  await writeFile(path.join(data,'discover.json'),JSON.stringify(state));
  const context=await browser.newContext({viewport:{width,height:width>800?1000:844},reducedMotion:'reduce'});
  await context.addInitScript(()=>sessionStorage.setItem('gpt-splash-shown','1'));
  assert.equal((await context.request.post(`${base}/api/auth/login`,{data:{username:'synthetic-user',password:'synthetic-password'}})).status(),200);
  page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.stack || e.message));
  await page.goto(embedded?base:`${base}/discover`,{waitUntil:'networkidle'});
  if(embedded){let entry=page.locator('a[href="/chat/discover"]:visible').first();if(!await entry.count()) {await page.getByRole('button',{name:'Abrir conversas',exact:true}).filter({visible:true}).first().click();entry=page.locator('a[href="/chat/discover"]:visible').first();}await entry.click();}
  const feed=page.locator('[data-discover-scroll-root]');await feed.getByRole('heading',{name:'Notícia sintética 1',exact:true}).waitFor();
  await feed.getByRole('button',{name:'Apagar notícia: Notícia sintética 1',exact:true}).click();
  const dialog=page.locator('[data-discover-confirmation]');await dialog.waitFor();assert.match(await dialog.innerText(),/Notícia sintética 1/);
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'detached'});
  if(embedded)assert.equal(await page.locator('[data-workspace-region="discover"]').count(),1);
  assert.equal((await (await context.request.get(`${base}/api/discover`)).json()).articles.length,3);
  await feed.getByRole('button',{name:'Apagar notícia: Notícia sintética 1',exact:true}).click();
  await dialog.evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished));});
  await page.screenshot({path:`${out}/${width}-${embedded?'panel':'page'}-confirm.png`});
  await dialog.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();
  await feed.locator('[data-discover-article="synthetic-1"]').waitFor({state:'detached'});
  assert.equal((await (await context.request.get(`${base}/api/discover`)).json()).articles.length,2);
  // Falha não remove nem perde a seleção; a mesma confirmação pode ser tentada novamente.
  await feed.getByRole('button',{name:'Selecionar notícias',exact:true}).click();
  await feed.getByRole('button',{name:'Selecionar todas',exact:true}).click();
  await feed.getByRole('button',{name:'Apagar selecionadas (2)',exact:true}).click();
  await page.route('**/api/discover',async route=>route.request().method()==='DELETE'?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Falha sintética'})}):route.continue());
  await dialog.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();
  await dialog.getByRole('alert').waitFor();assert.equal(await feed.locator('[data-discover-article]').count(),2);
  await page.unroute('**/api/discover');
  await dialog.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();
  await feed.getByText('O feed ainda está vazio.',{exact:true}).waitFor();
  const persisted=JSON.parse(await readFile(path.join(data,'discover.json'),'utf8'));
  assert.deepEqual(persisted.articles,[]);assert.deepEqual(persisted.topics,state.topics);assert.deepEqual(persisted.schedule,state.schedule);assert.equal(persisted.lastDailyDate,state.lastDailyDate);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/${width}-${embedded?'panel':'page'}-empty.png`});
  results.push({width,embedded,cancel:true,single:true,batch:true,errorRetry:true,persisted:true,noOverflow:true});await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}catch(error){await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}
finally{
 await browser?.close();
 if(server&&server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill('SIGTERM');const timer=setTimeout(()=>server.kill('SIGKILL'),4000);await exited;clearTimeout(timer);}
 await writeFile(`${out}/server.log`,log);if(ownsData)await rm(data,{recursive:true,force:true});
}
