import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(request,response)=>{
 try{
  const pathname=new URL(request.url,'http://127.0.0.1').pathname;
  const relative=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
  const target=path.resolve(root,relative);
  if(!target.startsWith(root))throw new Error('Invalid path');
  const data=await fs.readFile(target);
  response.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});
  response.end(data);
 }catch(_){response.writeHead(404);response.end('Not found')}
});

function assert(condition,message){if(!condition)throw new Error(message)}

await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();

try{
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'networkidle'});
 await page.locator('#wizardProjectName').fill('Booking Type Safety');
 await page.locator('#wizardNextBtn').click();
 await page.locator('#wizardNextBtn').click();
 await page.locator('#wizardNextBtn').click();
 await page.waitForFunction(()=>!document.getElementById('setupWizard').classList.contains('open'));

 assert(await page.locator('#resetBookingTypesBtn').count()===1,'Reset booking types button is missing');
 if(!(await page.locator('#sessionTypesPanel').evaluate(node=>node.open)))await page.locator('#sessionTypesPanel > summary').click();

 await page.evaluate(()=>{
  state.sessionTypes=state.sessionTypes.map(type=>type.id==='public-swimming'?{...type,name:'Changed Public',defaultTitle:'Changed Public',colour:'#111111'}:type);
  state.sessionTypes.push({id:'school-type',name:'School Booking',defaultTitle:'School Booking',colour:'#8844cc'});
  state.bookings.push(
   {id:'standard-booking',day:0,start:'09:00',end:'10:00',activity:'Existing public title',lanes:[1],coverageMode:'lanes',sessionTypeId:'public-swimming',sessionTypeName:'Changed Public',colourHex:'#123456'},
   {id:'custom-type-booking',day:0,start:'10:00',end:'11:00',activity:'Existing school title',lanes:[2],coverageMode:'lanes',sessionTypeId:'school-type',sessionTypeName:'School Booking',colourHex:'#8844cc'}
  );
  saveAndRender();
 });

 let resetCancelMessage='';
 page.once('dialog',async dialog=>{resetCancelMessage=dialog.message();await dialog.dismiss()});
 await page.locator('#resetBookingTypesBtn').click();
 assert(resetCancelMessage.includes('will become Custom'),'Reset confirmation does not clearly warn about Custom conversion');
 assert(await page.evaluate(()=>state.sessionTypes.some(type=>type.id==='school-type')),'Cancelling reset still changed booking types');

 let resetMessage='';
 page.once('dialog',async dialog=>{resetMessage=dialog.message();await dialog.accept()});
 await page.locator('#resetBookingTypesBtn').click();
 assert(resetMessage.includes('booking type you created will be removed'),'Reset confirmation does not warn that created types are removed');
 assert(resetMessage.includes('will become Custom'),'Reset confirmation does not warn that affected bookings become Custom');

 const resetResult=await page.evaluate(()=>({
  types:state.sessionTypes.map(({id,name,defaultTitle,colour})=>({id,name,defaultTitle,colour})),
  standard:state.bookings.find(booking=>booking.id==='standard-booking'),
  removed:state.bookings.find(booking=>booking.id==='custom-type-booking')
 }));
 assert(resetResult.types.length===7,'Reset did not restore exactly seven default booking types');
 assert(resetResult.types.find(type=>type.id==='public-swimming')?.colour==='#b6defb','Reset did not restore the standard Public Swimming colour');
 assert(resetResult.standard.sessionTypeId==='public-swimming','Standard booking lost its reusable booking type after reset');
 assert(resetResult.standard.activity==='Existing public title'&&resetResult.standard.colourHex==='#123456','Reset rewrote an existing standard booking');
 assert(resetResult.removed.sessionTypeId===''&&resetResult.removed.sessionTypeName==='Custom','Booking using a removed type did not become Custom');
 assert(resetResult.removed.activity==='Existing school title'&&resetResult.removed.colourHex==='#8844cc','Custom conversion changed the booking title or colour');

 await page.evaluate(()=>{
  state.sessionTypes.push({id:'delete-type',name:'One-off Reusable',defaultTitle:'One-off Reusable',colour:'#336699'});
  state.bookings.push({id:'delete-booking',day:1,start:'09:00',end:'10:00',activity:'Keep this title',lanes:[1],coverageMode:'lanes',sessionTypeId:'delete-type',sessionTypeName:'One-off Reusable',colourHex:'#336699'});
  renderSessionTypeControls();
  saveAndRender();
 });

 let deleteMessage='';
 page.once('dialog',async dialog=>{deleteMessage=dialog.message();await dialog.accept()});
 await page.locator('[data-delete-type="delete-type"]').click();
 assert(deleteMessage.includes('will become Custom'),'Delete confirmation does not clearly say bookings become Custom');
 assert(deleteMessage.includes('current title and colour will be kept'),'Delete confirmation does not explain what is preserved');
 const deletedBooking=await page.evaluate(()=>state.bookings.find(booking=>booking.id==='delete-booking'));
 assert(deletedBooking.sessionTypeId===''&&deletedBooking.sessionTypeName==='Custom','Deleting an in-use type did not convert its booking to Custom');
 assert(deletedBooking.activity==='Keep this title'&&deletedBooking.colourHex==='#336699','Deleting a type changed an existing booking title or colour');

 console.log('Booking type safety regression test passed');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
