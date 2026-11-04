import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {chromium} from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const app=await createServer({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1920,1600,1280,1024,768,720,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:'+app.port);await page.locator('#hub-qr').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(let p=0;p<3;p++){
   assert.equal(await page.locator('.hub-card:visible').count(),p===2?1:4);
   assert.equal(await page.locator('#hub-page').textContent(),(p+1)+' / 3');
   await page.locator('.hub-card:not([hidden]) img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
   const issues=await page.evaluate(()=>{
    const issues=[];
    if(document.documentElement.scrollWidth>innerWidth)issues.push('horizontal page overflow');
    for(const c of document.querySelectorAll('.hub-card:not([hidden])')){
     const r=c.getBoundingClientRect();
     if(c.scrollWidth>c.clientWidth+1||c.scrollHeight>c.clientHeight+1)issues.push('card overflow '+c.dataset.game);
     for(const el of c.children){const b=el.getBoundingClientRect();if(b.left<r.left||b.right>r.right+1||b.top<r.top||b.bottom>r.bottom+1)issues.push('content outside '+c.dataset.game);}
    }
    return issues;
   });assert.deepEqual(issues,[],width+' page '+p);
   if(width===1600)await page.screenshot({path:'.runtime/web-catalog-'+p+'.png',fullPage:true});
   if(p<2)await page.locator('#hub-next').click();
  }
  assert(await page.locator('#hub-next').isDisabled());
  await page.locator('#hub-prev').click();assert.equal(await page.locator('.hub-card:visible').first().getAttribute('data-game'),'4');
 }
 assert.deepEqual(errors,[]);console.log('PASS: browser pagination and overflow at eight widths, last page and previous navigation');
}finally{await browser.close();await app.close();}
