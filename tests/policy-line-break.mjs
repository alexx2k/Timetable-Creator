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

await new Promise(resolve=>server.listen(4175,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();

try{
 await page.goto('http://127.0.0.1:4175/index.html',{waitUntil:'networkidle'});

 const initial=await page.evaluate(()=>({
  policy:state.admissionsPolicy,
  markdown:state.footerPolicyMarkdown,
  lines:[...document.querySelectorAll('.policy-block .markdown-line')].map(node=>node.textContent.trim()).filter(Boolean)
 }));
 assert(initial.policy.includes('\nParent/child ratios:'),'Default policy does not store the ratios on a new line');
 assert(initial.markdown.includes('\nParent/child ratios:'),'Default footer Markdown does not store the ratios on a new line');
 assert(initial.lines.some(line=>line.startsWith('Parent/child ratios:')),'Printed footer does not render Parent/child ratios on its own line');

 const compatibility=await page.evaluate(()=>{
  const oneLine='Children under 8 years must be accompanied by an adult aged 16 or over in the same water. Parent/child ratios: 1 adult to 2 children under 5 years, or 1 adult to 3 children aged 5–7 years.';
  normalizeState({...state,admissionsPolicy:oneLine,footerPolicyMarkdown:`**Admission policy**\n${oneLine}`});
  renderAll();
  return {
   policy:state.admissionsPolicy,
   markdown:state.footerPolicyMarkdown,
   lines:[...document.querySelectorAll('.policy-block .markdown-line')].map(node=>node.textContent.trim()).filter(Boolean)
  };
 });
 assert(compatibility.policy.includes('\nParent/child ratios:'),'Existing one-line policy was not normalised on load');
 assert(compatibility.markdown.includes('\nParent/child ratios:'),'Existing one-line Markdown policy was not normalised on load');
 assert(compatibility.lines.some(line=>line.startsWith('Parent/child ratios:')),'Normalised policy did not print the ratios on their own line');

 console.log('Admission policy line-break test passed');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
