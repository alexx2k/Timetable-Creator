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
 }catch(_){
  response.writeHead(404);
  response.end('Not found');
 }
});

function assert(condition,message){if(!condition)throw new Error(message)}

await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();

try{
 await page.goto('http://127.0.0.1:4174/',{waitUntil:'networkidle'});
 await page.locator('#wizardProjectName').fill('Keyboard Regression');
 await page.locator('#wizardNextBtn').click();
 await page.locator('#wizardNextBtn').click();
 await page.locator('#wizardNextBtn').click();
 await page.waitForFunction(()=>!document.getElementById('setupWizard').classList.contains('open'));

 const bookingId=await page.evaluate(()=>{
  const type=sessionTypeById('lane-swimming');
  const id=uid();
  state.bookings.push({id,day:0,start:'10:00',end:'11:00',activity:'Lane Swimming',lanes:[1],coverageMode:'lanes',sessionTypeId:type.id,sessionTypeName:type.name,colourHex:type.colour});
  selectedId=id;
  selectedIds.clear();
  selectedIds.add(id);
  saveAndRender();
  return id;
 });

 const title=page.locator('#fineActivity');
 await title.focus();
 await title.evaluate(input=>input.setSelectionRange(5,5));
 const startBefore=await page.evaluate(id=>state.bookings.find(booking=>booking.id===id).start,bookingId);

 await page.keyboard.press('ArrowLeft');
 const afterLeft=await page.evaluate(id=>({
  start:state.bookings.find(booking=>booking.id===id).start,
  activeId:document.activeElement?.id,
  caret:document.getElementById('fineActivity')?.selectionStart
 }),bookingId);
 assert(afterLeft.start===startBefore,'ArrowLeft moved the booking while editing its title');
 assert(afterLeft.activeId==='fineActivity','ArrowLeft removed focus from the booking title');
 assert(afterLeft.caret===4,'ArrowLeft did not move the text caret normally');

 await page.keyboard.press('ArrowRight');
 const afterRight=await page.evaluate(id=>({
  start:state.bookings.find(booking=>booking.id===id).start,
  activeId:document.activeElement?.id,
  caret:document.getElementById('fineActivity')?.selectionStart
 }),bookingId);
 assert(afterRight.start===startBefore,'ArrowRight moved the booking while editing its title');
 assert(afterRight.activeId==='fineActivity','ArrowRight removed focus from the booking title');
 assert(afterRight.caret===5,'ArrowRight did not move the text caret normally');

 await title.evaluate(input=>input.blur());
 await page.keyboard.press('ArrowRight');
 const startAfterShortcut=await page.evaluate(id=>state.bookings.find(booking=>booking.id===id).start,bookingId);
 assert(startAfterShortcut==='10:15','ArrowRight no longer nudges a selected booking outside an editor');

 console.log('Keyboard editing regression test passed');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
