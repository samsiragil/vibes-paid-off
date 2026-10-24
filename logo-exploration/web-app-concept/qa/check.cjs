const {chromium}=require('C:/Users/samsi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:1000},deviceScaleFactor:1,colorScheme:'light'});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(pathToFileURL(path.join(__dirname,'preview.html')).href);
 await page.waitForSelector('iframe');
 const frame=page.frames().find(f=>f!==page.mainFrame());
 await frame.waitForSelector('#jd-gallery .jd-feature');await frame.evaluate(()=>document.fonts.ready);
 const out={errors,checks:[],layout:[]};
 async function dimensions(label){out.layout.push({label,...await frame.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,font:document.fonts.check('400 16px JadinyaPreview'),fontSemibold:document.fonts.check('600 16px JadinyaPreview'),app:document.querySelector('[data-variant]:not([hidden]) .jd-app')?.getBoundingClientRect().toJSON()}))});}
 async function shot(name,selector='#jd-gallery'){const vp=page.viewportSize();await page.setViewportSize({width:vp.width,height:3400});await page.evaluate(()=>scrollTo(0,0));await frame.evaluate(()=>scrollTo(0,0));await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const box=await page.locator('iframe').boundingBox();await page.screenshot({path:path.join(__dirname,name+'.png'),clip:{x:0,y:0,width:vp.width,height:Math.min(3400,Math.ceil(box.y+box.height+70))}});await page.setViewportSize(vp);}
 await dimensions('gallery-desktop-light');await shot('gallery-desktop-light');
 const app=frame.locator('#jd-gallery');
 await app.locator('[data-vote="rapi"]').click();out.checks.push({name:'vote-toggle',pass:await app.locator('[data-vote="rapi"]').getAttribute('aria-pressed')==='true'});
 await app.locator('[data-project="rapi"]').click();out.checks.push({name:'detail-open',pass:await app.locator('.jd-detail-head h1').textContent()==='Rapi'});
 await shot('detail-desktop-light');
 await app.locator('[data-detail-tab="lessons"]').click();out.checks.push({name:'lessons-tab',pass:(await app.locator('[role="tabpanel"]').textContent()).includes('Membatasi fitur')});
 await app.locator('.jd-nav [data-view="explore"]').click();await app.locator('input[type="search"]').fill('bekal');out.checks.push({name:'search',pass:await app.locator('.jd-results .jd-project').count()===1});
 await app.locator('input[type="search"]').fill('tidak-ada');out.checks.push({name:'empty',pass:await app.locator('.jd-empty').count()===1});
 await app.locator('[data-reset]').click();out.checks.push({name:'reset',pass:await app.locator('.jd-results .jd-project').count()===3});
 await app.locator('[data-filter="Produktivitas"]').click();out.checks.push({name:'category',pass:await app.locator('.jd-results .jd-project').count()===2});
 await app.locator('.jd-nav [data-view="submit"]').click();await app.locator('input[name="title"]').fill('Uji konsep');await app.locator('textarea').fill('Buat daftar kecil.');await app.locator('input[name="url"]').fill('https://example.com');await app.locator('[data-save-draft]').click();out.formInfo=await app.locator('form').evaluate(f=>({valid:f.checkValidity(),status:f.querySelector('[data-form-status]').textContent,fields:[...f.elements].map(e=>({name:e.name,value:e.value,valid:e.validity.valid,message:e.validationMessage}))}));out.checks.push({name:'draft-feedback',pass:out.formInfo.status.includes('Tidak ada data yang dikirim')});
 await app.locator('[data-view="home"]').first().click();await page.emulateMedia({colorScheme:'dark'});await dimensions('gallery-desktop-dark');await shot('gallery-desktop-dark');
 await page.emulateMedia({colorScheme:'light'});
 // Runtime carousel: inspect the existing button labels and click its real next control.
 out.carouselButtons=await frame.locator('.viz-carousel button').evaluateAll(bs=>bs.filter(b=>!b.closest('.jd-app')).map(b=>({text:b.textContent,label:b.getAttribute('aria-label')})));
 const next=frame.getByRole('button',{name:'Berikutnya',exact:true});
 if(await next.count()){await next.click();out.checks.push({name:'carousel',pass:await frame.locator('[data-variant="Jurnal maker"]').isVisible()});}
 else{throw new Error('Kontrol carousel Berikutnya tidak ditemukan');}
 await dimensions('journal-desktop-light');await shot('journal-desktop-light','#jd-journal');
 await page.setViewportSize({width:390,height:844});await dimensions('journal-mobile-light');await shot('journal-mobile-light','#jd-journal');
 await frame.getByRole('button',{name:'Sebelumnya',exact:true}).click();await dimensions('gallery-mobile-light');await shot('gallery-mobile-light');
 await page.emulateMedia({colorScheme:'dark'});await shot('gallery-mobile-dark');
 await page.setViewportSize({width:320,height:760});await dimensions('gallery-narrow-dark');
 // Semua palet diperiksa melalui pasangan token yang memang dipakai, bukan asumsi warna.
 const pairs=[['brand-light','#A44732','#FFFFFF'],['brand-dark','#E8A58E','#2D1D17'],['text-light','#252523','#F7F7F5'],['muted-light','#62635C','#FFFFFF'],['muted-dark','#B5B7AD','#252623'],['input-light','#8B8E82','#FFFFFF'],['input-dark','#777C6E','#252623'],['pinus-light','#365D4A','#FFFFFF'],['pinus-dark','#9AC5AD','#152D20'],['tinta-light','#345C82','#FFFFFF'],['tinta-dark','#A1C3E5','#152738']];
 const lum=h=>{const v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
 out.contrast=pairs.map(([name,a,b])=>({name,ratio:+((Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)).toFixed(2)}));
 fs.writeFileSync(path.join(__dirname,'check-results.json'),JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
 if(errors.length||out.checks.some(c=>!c.pass)||out.layout.some(d=>d.scrollWidth>d.width))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
