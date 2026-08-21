import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8'};

const server=http.createServer(async(request,response)=>{
 try{
  const pathname=new URL(request.url,'http://127.0.0.1').pathname;
  const relative=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
  const target=path.resolve(root,relative);
  if(!target.startsWith(root))throw new Error('Invalid path');
  const data=await fs.readFile(target);
  response.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});
  response.end(data);
 }catch(_){
  response.writeHead(404);
  response.end('Not found');
 }
});

await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));

function assert(condition,message){
 if(!condition)throw new Error(message);
}

try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
 assert(await page.locator('#startScreen').count()===0,'Legacy startup screen is still present');
 assert(!(await page.locator('body').getAttribute('class')||'').includes('startup-mode'),'Legacy startup mode is active');
 assert(await page.locator('#setupWizard').evaluate(node=>node.classList.contains('open')),'New timetable wizard did not open on first use');

 await page.locator('#wizardProjectName').fill('Smoke Test');
 await page.locator('#wizardNextBtn').click();
 await page.locator('#wizardLaneCount').fill('5');
 await page.locator('#wizardNextBtn').click();
 await page.locator('#wizardNextBtn').click();
 await page.waitForFunction(()=>!document.getElementById('setupWizard').classList.contains('open'));

 const defaults=await page.evaluate(()=>state.sessionTypes.map(({name,defaultTitle,colour})=>({name,defaultTitle,colour})));
 assert(JSON.stringify(defaults)===JSON.stringify([
  {name:'Public Swimming',defaultTitle:'Public Swimming',colour:'#b6defb'},
  {name:'Lane Swimming',defaultTitle:'Lane Swimming',colour:'#7cbbdf'},
  {name:'Lessons',defaultTitle:'Swimming Lessons',colour:'#0071db'},
  {name:'Club Booking',defaultTitle:'Club Booking',colour:'#f4e32a'},
  {name:'Aqua Class',defaultTitle:'Aqua Class',colour:'#91c9a8'},
  {name:'Pool Closure',defaultTitle:'CLOSED',colour:'#c9ced2'},
  {name:'Pool Party',defaultTitle:'Pool Party',colour:'#ff24f8'}
 ]),'Default booking types do not match the V2.1 setup');
 assert(await page.evaluate(()=>state.laneCount)===5,'Wizard did not create a five-lane timetable');

 const halfCheck=await page.evaluate(()=>{
  const lanes=[1,2,3,4,5];
  const top={id:'top',day:0,start:'10:00',end:'11:00',lanes,coverageMode:'half-first'};
  const bottom={id:'bottom',day:0,start:'10:00',end:'11:00',lanes,coverageMode:'half-second'};
  return {top:coverageBounds(top),bottom:coverageBounds(bottom),overlap:bookingsOverlap(top,bottom)};
 });
 assert(JSON.stringify(halfCheck.top)==='[0,50]'&&JSON.stringify(halfCheck.bottom)==='[50,100]','Odd-lane half geometry is not exact');
 assert(halfCheck.overlap===false,'Top and bottom halves incorrectly overlap');

 const bookingIds=await page.evaluate(()=>{
  const customId=uid();
  const typedId=uid();
  const laneType=sessionTypeById('lane-swimming');
  state.bookings.push(
   {id:customId,day:0,start:'09:00',end:'10:00',activity:'One-off booking',lanes:[1],coverageMode:'lanes',sessionTypeId:'',sessionTypeName:'Custom',colourHex:'#b4c4d2'},
   {id:typedId,day:0,start:'10:00',end:'11:00',activity:laneType.defaultTitle,lanes:[1,2],coverageMode:'lanes',sessionTypeId:laneType.id,sessionTypeName:laneType.name,colourHex:laneType.colour}
  );
  saveAndRender();
  return {customId,typedId};
 });
 const legendText=await page.locator('.legend').allTextContents();
 assert(legendText.join(' ').includes('Lane Swimming'),'Reusable booking type is missing from the key');
 assert(!legendText.join(' ').includes('Custom'),'Custom one-off booking incorrectly appears in the key');

 await page.evaluate(()=>{
  const id=uid();
  state.bookings.push({id,day:1,start:'09:00',end:'10:00',activity:'New booking',lanes:[1],coverageMode:'lanes',sessionTypeId:'',sessionTypeName:'Custom',colourHex:'#b4c4d2'});
  selectedId=id;
  saveAndRender();
  showQuickTypeBar(id,{x:220,y:180});
 });
 await page.locator('[data-quick-new-type]').click();
 await page.locator('#quickNewTypeName').fill('School Booking');
 await page.locator('#quickNewTypeColour').fill('#8844cc');
 await page.locator('#quickNewTypeForm button[type="submit"]').click();
 const newType=await page.evaluate(()=>({type:state.sessionTypes.find(type=>type.name==='School Booking'),booking:state.bookings.find(item=>item.sessionTypeName==='School Booking')}));
 assert(newType.type?.defaultTitle==='School Booking'&&newType.type?.colour==='#8844cc','New booking type was not created from the floating menu');
 assert(newType.booking?.sessionTypeId===newType.type?.id,'New booking type was not applied to the booking');
 assert((await page.locator('.legend').innerText()).includes('School Booking'),'New reusable booking type is missing from the key');

 if(!(await page.locator('#settingsPanel').evaluate(node=>node.open)))await page.locator('#settingsPanel > summary').click();
 await page.locator('#footerPolicyMarkdownInput').fill('**Admission policy**\n*Smoke test policy*');
 await page.waitForTimeout(50);
 assert((await page.locator('.policy-block strong').textContent())==='Admission policy','Markdown bold did not render in the footer');
 assert((await page.locator('.policy-block em').textContent())==='Smoke test policy','Markdown italic did not render in the footer');

 const exportCheck=await page.evaluate(()=>{
  const file=toV2File();
  return {format:file.format,formatVersion:file.formatVersion,appVersion:file.app.version,footer:file.timetable.footer};
 });
 assert(exportCheck.format==='fslt-pool-timetable'&&exportCheck.formatVersion===2,'V2 file format changed unexpectedly');
 assert(exportCheck.appVersion==='2.1','Export metadata is not V2.1');
 assert(exportCheck.footer.policyMarkdown.includes('Smoke test policy'),'Markdown footer is missing from export');

 const compatibility=await page.evaluate(()=>{
  const oldFile=toV2File();
  delete oldFile.timetable.footer;
  oldFile.app.version='2.0';
  normalizeState(oldFile);
  resetHistory();
  return {contact:state.footerContactMarkdown,policy:state.footerPolicyMarkdown,version:toV2File().formatVersion};
 });
 assert(compatibility.contact.includes('East Sands Leisure Centre'),'Older V2 file did not receive contact footer defaults');
 assert(compatibility.policy.includes('Admission policy'),'Older V2 file did not receive policy footer defaults');
 assert(compatibility.version===2,'Backward-compatible load changed the file format version');

 await page.evaluate(id=>{
  selectedId=id;
  selectedIds.clear();
  selectedIds.add(id);
  updateBooking(id,{start:'10:15',end:'11:15'});
 },bookingIds.typedId);
 assert(await page.evaluate(id=>state.bookings.find(item=>item.id===id)?.start,bookingIds.typedId)==='10:15','Booking edit failed before undo test');
 await page.evaluate(()=>undoEdit());
 assert(await page.evaluate(id=>state.bookings.find(item=>item.id===id)?.start,bookingIds.typedId)==='10:00','Undo did not restore the booking');
 await page.evaluate(()=>redoEdit());
 assert(await page.evaluate(id=>state.bookings.find(item=>item.id===id)?.start,bookingIds.typedId)==='10:15','Redo did not reapply the booking edit');

 await page.evaluate(id=>{selectedId=id;selectedIds.clear();selectedIds.add(id);prepareForPrint()},bookingIds.typedId);
 assert(await page.evaluate(()=>selectedId===null&&selectedIds.size===0),'Print preparation did not clear selection state');
 await page.emulateMedia({media:'print'});
 await page.pdf({path:'/tmp/timetable-creator-smoke.pdf',format:'A4',landscape:true,printBackground:true});
 const pdfStat=await fs.stat('/tmp/timetable-creator-smoke.pdf');
 assert(pdfStat.size>1000,'Chromium did not produce a usable PDF');

 assert(pageErrors.length===0,`Browser errors: ${pageErrors.join(' | ')}`);
 console.log('V2.1 browser smoke test passed');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
