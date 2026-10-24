// Gunakan PLAYWRIGHT_MODULE atau paket Playwright yang sudah tersedia di mesin.
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const issues=[];page.on('pageerror',e=>issues.push(String(e)));
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 await page.evaluate(()=>document.fonts.ready);
 const results={desktop:{},mobile:{},svg:[],issues};
 async function metrics(){return page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,fontLoaded:document.fonts.check('600 16px Source'),images:[...document.images].length,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),sizeTests:[...document.querySelectorAll('.small-sizes img,.large-size img')].map(i=>({asset:i.getAttribute('src'),expected:i.width,width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height})),headerLogos:[...document.querySelectorAll('.mockup-header>img')].map(i=>({width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height}))}));}
 results.desktop=await metrics();
 await page.screenshot({path:path.join(__dirname,'desktop-overview.png')});
 for(const id of ['01-jejak-jadi','02-temu-hasil','03-keping-jadi','04-lembar-lanjut','05-jadi-terbuka']){
  await page.locator(`[id="${id}"]`).screenshot({path:path.join(__dirname,id+'-desktop.png')});
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
 results.mobile=await metrics();
 await page.screenshot({path:path.join(__dirname,'mobile-overview.png')});
 await page.screenshot({path:path.join(__dirname,'mobile-full.png'),fullPage:true});
 await page.locator('[id="01-jejak-jadi"]').screenshot({path:path.join(__dirname,'01-jejak-jadi-mobile.png')});
 await page.locator('[id="05-jadi-terbuka"]').screenshot({path:path.join(__dirname,'05-jadi-terbuka-mobile.png')});
 // Cek lebar sempit tambahan; inspeksi visual dilakukan pada screenshot 390px.
 await page.setViewportSize({width:320,height:760});results.narrow=await metrics();
 // Semua bounds geometris SVG dihitung oleh renderer, bukan perkiraan string path.
 for(const dir of fs.readdirSync(root).filter(n=>/^0[1-5]-/.test(n))){
  for(const file of fs.readdirSync(path.join(root,dir)).filter(n=>n.endsWith('.svg'))){
   const relative=dir+'/'+file;
   await page.goto(pathToFileURL(path.join(root,relative)).href);
   const checked=await page.evaluate(()=>{const s=document.querySelector('svg'),v=s.viewBox.baseVal,b=s.getBBox();return {viewBox:[v.x,v.y,v.width,v.height],bounds:[b.x,b.y,b.width,b.height],clipped:b.x<v.x-.01||b.y<v.y-.01||b.x+b.width>v.x+v.width+.01||b.y+b.height>v.y+v.height+.01};});
   results.svg.push({file:relative,...checked});
  }
 }
 fs.writeFileSync(path.join(__dirname,'render-results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({desktop:results.desktop,mobile:results.mobile,narrowOverflow:results.narrow.scrollWidth>320,svgCount:results.svg.length,clipped:results.svg.filter(s=>s.clipped),issues},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
