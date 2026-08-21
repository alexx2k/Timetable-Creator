const APP_STORAGE_KEY='timetableCreatorV2:lastProject';
const FILE_FORMAT='fslt-pool-timetable';
const FILE_VERSION=2;
const OLD_STORAGE_KEYS=['poolTimetableCreatorV11','poolTimetableCreatorV9','poolTimetableCreatorV8','poolTimetableCreatorV7','poolTimetableCreatorV6','poolTimetableCreatorV5','poolTimetableCreatorV4','poolTimetableCreatorV3','poolTimetableCreator'];

let wizardStep=0;
let wizardCentreId='east-sands';
let lastImportWasLegacy=false;

const legacyNormalizeState=normalizeState;
const legacyBind=bind;

function splitContactLine(line=''){
 const parts=String(line).split('·').map(part=>part.trim()).filter(Boolean);
 return {address:parts[0]||'',phone:parts.slice(1).join(' · ')||''};
}

function autoFitView(target=state){
 const interval=[15,30].includes(Number(target.interval))?Number(target.interval):15;
 const opens=(target.days||[]).map(day=>mins(day.open)).filter(Number.isFinite);
 const closes=(target.days||[]).map(day=>mins(day.close)).filter(Number.isFinite);
 if(!opens.length||!closes.length)return;
 const start=Math.floor(Math.min(...opens)/interval)*interval;
 const end=Math.ceil(Math.max(...closes)/interval)*interval;
 target.viewStart=timeStr(start);
 target.viewEnd=timeStr(Math.max(end,start+interval));
}

function centreIdFromText(value=''){
 const needle=String(value).toLowerCase();
 return Object.entries(CENTRES).find(([id,centre])=>id!=='custom'&&(needle.includes(id.replace(/-/g,' '))||needle.includes(centre.venueName.toLowerCase())))?.[0]||'custom';
}

function fromV2File(file){
 const venue=file.venue||{};
 const timetable=file.timetable||{};
 const project=file.project||{};
 const contact=[venue.address,venue.phone].filter(Boolean).join(' · ');
 return {
  projectId:project.id||uid(),
  projectName:project.name||timetable.title||'Imported timetable',
  createdAt:project.createdAt||new Date().toISOString(),
  updatedAt:project.updatedAt||new Date().toISOString(),
  centreId:venue.id||centreIdFromText(venue.name||venue.subtitle),
  title:timetable.title||'Main Pool Timetable',
  subtitle:venue.subtitle||venue.name||'',
  venueName:venue.name||venue.subtitle||'',
  venueAddress:contact,
  admissionsPolicy:timetable.admissionsPolicy||freshState().admissionsPolicy,
  laneCount:timetable.laneCount||4,
  interval:timetable.interval||15,
  days:timetable.days||DEFAULT_DAYS,
  sessionTypes:Array.isArray(file.sessionTypes)?file.sessionTypes:DEFAULT_SESSION_TYPES,
  bookings:Array.isArray(file.bookings)?file.bookings:[]
 };
}

normalizeState=function(candidate={}){
 const isV2=candidate&&candidate.format===FILE_FORMAT&&Number(candidate.formatVersion)>=2;
 const source=isV2?fromV2File(candidate):candidate;
 legacyNormalizeState(source);
 state.projectId=source.projectId||state.projectId||uid();
 state.projectName=String(source.projectName||source.title||'Untitled timetable').trim()||'Untitled timetable';
 state.createdAt=source.createdAt||state.createdAt||new Date().toISOString();
 state.updatedAt=source.updatedAt||new Date().toISOString();
 if(!CENTRES[state.centreId])state.centreId=centreIdFromText(`${state.venueName} ${state.subtitle}`);
 if(state.centreId==='custom'&&!state.venueName)state.venueName=state.subtitle||'Custom centre';
 autoFitView();
 lastImportWasLegacy=!isV2;
 return state;
};

function toV2File(current=state){
 const contact=splitContactLine(current.venueAddress);
 const preset=CENTRES[current.centreId]||{};
 const now=new Date().toISOString();
 return {
  format:FILE_FORMAT,
  formatVersion:FILE_VERSION,
  app:{name:'Timetable Creator',version:'2.0'},
  project:{id:current.projectId||uid(),name:current.projectName||current.title||'Untitled timetable',createdAt:current.createdAt||now,updatedAt:now},
  venue:{id:current.centreId||'custom',name:current.venueName||current.subtitle||'Venue',subtitle:current.subtitle||current.venueName||'',address:contact.address||preset.address||'',phone:contact.phone||preset.phone||''},
  timetable:{title:current.title||'Main Pool Timetable',laneCount:Number(current.laneCount)||4,interval:Number(current.interval)||15,days:(current.days||[]).map(day=>({name:day.name,open:day.open,close:day.close})),admissionsPolicy:current.admissionsPolicy||''},
  sessionTypes:(current.sessionTypes||[]).map(type=>({id:type.id,name:type.name,defaultTitle:type.defaultTitle,colour:validHex(type.colour)})),
  bookings:(current.bookings||[]).map(booking=>({id:booking.id,day:Number(booking.day),start:booking.start,end:booking.end,activity:booking.activity,coverageMode:coverageMode(booking),lanes:[...(booking.lanes||[])],sessionTypeId:booking.sessionTypeId||'',sessionTypeName:booking.sessionTypeName||bookingTypeName(booking),colourHex:bookingColour(booking)}))
 };
}

function populateCentreSelect(){
 const select=$('centreInput');
 select.innerHTML=Object.entries(CENTRES).map(([id,centre])=>`<option value="${id}">${escapeHtml(centre.venueName)}</option>`).join('');
}

function updateProjectChrome(){
 const range=`${state.viewStart}–${state.viewEnd}`;
 $('headerProjectName').textContent=state.projectName||'Untitled timetable';
 $('headerProjectMeta').textContent=`${state.venueName||state.subtitle||'Custom venue'} · ${range}`;
 $('appCentreSubtitle').textContent=state.venueName||state.subtitle||'Pool timetable workspace';
 if($('projectChip'))$('projectChip').textContent='';
 $('autoRangeValue').textContent=range;
 document.title=`${state.projectName||'Timetable'} · Timetable Creator`;
}

function showWorkspace(){
 document.body.classList.remove('startup-mode');
 $('setupWizard').classList.remove('open');
 updateProjectChrome();
}

function showStartScreen(){
 document.body.classList.add('startup-mode');
 $('setupWizard').classList.remove('open');
}

function showImportNotice(){
 const box=$('importNotice');
 box.classList.remove('show');
 box.textContent='';
}

function makeNewStateFromWizard(){
 const centre=CENTRES[wizardCentreId]||CENTRES.custom;
 const custom=wizardCentreId==='custom';
 const venueName=custom?$('wizardCustomName').value.trim():centre.venueName;
 const address=custom?$('wizardCustomAddress').value.trim():centre.address;
 const phone=custom?$('wizardCustomPhone').value.trim():centre.phone;
 const next=freshState();
 next.projectId=uid();
 next.projectName=$('wizardProjectName').value.trim();
 next.createdAt=new Date().toISOString();
 next.updatedAt=next.createdAt;
 next.centreId=wizardCentreId;
 next.title=$('wizardPrintedTitle').value.trim()||'Main Pool Timetable';
 next.subtitle=venueName;
 next.venueName=venueName;
 next.venueAddress=[address,phone].filter(Boolean).join(' · ');
 next.laneCount=clamp(Number($('wizardLaneCount').value)||4,1,12);
 next.interval=Number($('wizardInterval').value)||15;
 next.days=DEFAULT_DAYS.map((day,index)=>({name:day.name,open:$(`wizardOpen-${index}`).value,close:$(`wizardClose-${index}`).value}));
 autoFitView(next);
 return next;
}

function renderWizardCentres(){
 $('wizardCentreGrid').innerHTML=Object.entries(CENTRES).map(([id,centre])=>`<button type="button" class="centre-option${id===wizardCentreId?' selected':''}" data-centre-id="${id}"><strong>${escapeHtml(centre.venueName)}</strong><small>${id==='custom'?'Enter your own centre details':escapeHtml(centre.address)}</small></button>`).join('');
 $('wizardCentreGrid').querySelectorAll('[data-centre-id]').forEach(button=>button.addEventListener('click',()=>{
  wizardCentreId=button.dataset.centreId;
  renderWizardCentres();
  $('customCentreFields').style.display=wizardCentreId==='custom'?'grid':'none';
 }));
}

function renderWizardHours(days=DEFAULT_DAYS){
 $('wizardHours').innerHTML=DEFAULT_DAYS.map((day,index)=>`<div class="wizard-hours-row"><strong>${day.name}</strong><label>Opens<input id="wizardOpen-${index}" type="time" step="900" value="${days[index]?.open||day.open}"></label><label>Closes<input id="wizardClose-${index}" type="time" step="900" value="${days[index]?.close||day.close}"></label></div>`).join('');
}

function setWizardStep(step){
 wizardStep=clamp(step,0,2);
 document.querySelectorAll('.wizard-step').forEach((panel,index)=>panel.classList.toggle('active',index===wizardStep));
 document.querySelectorAll('.wizard-dot').forEach((dot,index)=>{
  dot.classList.toggle('active',index===wizardStep);
  dot.classList.toggle('complete',index<wizardStep);
 });
 const labels=['Project and centre','Timetable basics','Opening times'];
 $('wizardSubtitle').textContent=labels[wizardStep];
 $('wizardFooterCopy').textContent=`Step ${wizardStep+1} of 3`;
 $('wizardBackBtn').style.display=wizardStep?'inline-block':'none';
 $('wizardNextBtn').textContent=wizardStep===2?'Create timetable':'Continue';
}

function openCreatorWizard(){
 wizardCentreId=state?.centreId&&CENTRES[state.centreId]?state.centreId:'east-sands';
 $('wizardProjectName').value='';
 $('wizardPrintedTitle').value='Main Pool Timetable';
 $('wizardLaneCount').value=state?.laneCount||4;
 $('wizardInterval').value=state?.interval||15;
 $('wizardCustomName').value='';
 $('wizardCustomAddress').value='';
 $('wizardCustomPhone').value='';
 $('customCentreFields').style.display=wizardCentreId==='custom'?'grid':'none';
 renderWizardCentres();
 renderWizardHours(state?.days||DEFAULT_DAYS);
 setWizardStep(0);
 $('setupWizard').classList.add('open');
 setTimeout(()=>$('wizardProjectName').focus(),0);
}

function validateWizardStep(){
 if(wizardStep===0){
  if(!$('wizardProjectName').value.trim()){alert('Enter a project name.');return false}
  if(wizardCentreId==='custom'&&!$('wizardCustomName').value.trim()){alert('Enter the custom centre name.');return false}
 }
 if(wizardStep===1){
  const lanes=Number($('wizardLaneCount').value);
  if(!Number.isFinite(lanes)||lanes<1||lanes>12){alert('Enter between 1 and 12 lanes.');return false}
 }
 if(wizardStep===2){
  for(let index=0;index<7;index++){
   const open=$(`wizardOpen-${index}`).value;
   const close=$(`wizardClose-${index}`).value;
   if(!open||!close||mins(close)<=mins(open)){alert(`${DEFAULT_DAYS[index].name}'s closing time must be later than its opening time.`);return false}
  }
 }
 return true;
}

function completeWizard(){
 state=makeNewStateFromWizard();
 selectedId=null;
 editId=null;
 lastImportWasLegacy=false;
 $('importNotice').classList.remove('show');
 populateCentreSelect();
 syncInputs();
 renderLanePicker();
 resetForm();
 saveAndRender();
 showWorkspace();
 $('status').textContent='New timetable created';
}

function handleWizardNext(){
 if(!validateWizardStep())return;
 if(wizardStep<2)setWizardStep(wizardStep+1);
 else completeWizard();
}

function handleFile(file,input){
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const data=JSON.parse(reader.result);
   const isV2=data&&data.format===FILE_FORMAT&&Number(data.formatVersion)>=2;
   if(!isV2&&!Array.isArray(data.bookings))throw new Error('Unrecognised timetable structure');
   normalizeState(data);
   selectedId=null;
   editId=null;
   populateCentreSelect();
   syncInputs();
   renderLanePicker();
   resetForm();
   saveAndRender();
   showWorkspace();
   showImportNotice(file.name);
   $('status').textContent=`Opened ${file.name}`;
  }catch(error){
   console.error(error);
   alert('That file is not a recognised timetable file.');
  }
 };
 reader.readAsText(file);
 if(input)input.value='';
}

loadAutosave=function(){
 let raw=null;
 let legacy=false;
 try{
  raw=localStorage.getItem(APP_STORAGE_KEY);
  if(!raw){
   for(const key of OLD_STORAGE_KEYS){
    raw=localStorage.getItem(key);
    if(raw){legacy=true;break}
   }
  }
 }catch(_){}
 if(!raw)return false;
 try{
  const saved=JSON.parse(raw);
  normalizeState(saved);
  lastImportWasLegacy=legacy||lastImportWasLegacy;
  return true;
 }catch(error){
  console.warn('Could not restore autosave',error);
  return false;
 }
};

saveAndRender=function(){
 autoFitView();
 state.updatedAt=new Date().toISOString();
 try{localStorage.setItem(APP_STORAGE_KEY,JSON.stringify(toV2File(state)))}catch(_){}
 renderAll();
 updateProjectChrome();
 $('status').textContent='Saved in this browser';
};

syncSettings=function(){
 state.centreId=$('centreInput').value;
 state.title=$('titleInput').value;
 state.subtitle=$('subtitleInput').value;
 state.venueName=$('venueNameInput').value;
 state.venueAddress=$('venueAddressInput').value;
 state.admissionsPolicy=$('admissionsPolicyInput').value;
 saveAndRender();
};

applyCentrePreset=function(){
 const id=$('centreInput').value;
 const preset=CENTRES[id];
 if(!preset)return;
 state.centreId=id;
 if(id!=='custom'){
  state.subtitle=preset.subtitle;
  state.venueName=preset.venueName;
  state.venueAddress=preset.venueAddress;
  $('subtitleInput').value=preset.subtitle;
  $('venueNameInput').value=preset.venueName;
  $('venueAddressInput').value=preset.venueAddress;
 }
 saveAndRender();
};

updateRangeWarning=function(){
 const warning=$('rangeWarning');
 warning.style.display='none';
 warning.textContent='';
 $('autoRangeValue').textContent=`${state.viewStart}–${state.viewEnd}`;
};

const legacyRenderSheet=renderSheet;
renderSheet=function(){autoFitView();return legacyRenderSheet()};

suggestedTimetableFilename=function(){
 const project=safeFilenamePart(state.projectName||state.title||'Timetable');
 const venue=safeFilenamePart(state.venueName||state.subtitle||'Venue');
 return `${venue||'Venue'}-${project||'Timetable'}.json`;
};

downloadJson=async function(){
 const exportData=toV2File(state);
 const data=JSON.stringify(exportData,null,2);
 const blob=new Blob([data],{type:'application/json'});
 const suggestedName=suggestedTimetableFilename();
 try{
  if('showSaveFilePicker' in window){
   const handle=await window.showSaveFilePicker({suggestedName,types:[{description:'Timetable file',accept:{'application/json':['.json']}}]});
   const writable=await handle.createWritable();
   await writable.write(blob);
   await writable.close();
   $('status').textContent=`Saved ${handle.name}`;
   lastImportWasLegacy=false;
   $('importNotice').classList.remove('show');
   return;
  }
 }catch(error){
  if(error?.name==='AbortError'){$('status').textContent='Save cancelled';return}
 }
 let filename=prompt('Name this timetable file:',suggestedName);
 if(filename===null){$('status').textContent='Save cancelled';return}
 filename=safeFilenamePart(filename)||suggestedName;
 if(!filename.toLowerCase().endsWith('.json'))filename+='.json';
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');
 anchor.href=url;
 anchor.download=filename;
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('status').textContent=`Downloaded ${filename}`;
 lastImportWasLegacy=false;
 $('importNotice').classList.remove('show');
};

uploadJson=function(event){handleFile(event.target.files[0],event.target)};

bind=function(){
 legacyBind();
 $('homeBtn').addEventListener('click',showStartScreen);
 $('startCreateBtn').addEventListener('click',openCreatorWizard);
 $('startOpenInput').addEventListener('change',event=>handleFile(event.target.files[0],event.target));
 $('wizardCancelBtn').addEventListener('click',()=>{
  $('setupWizard').classList.remove('open');
  if(!state?.projectName)showStartScreen();
 });
 $('wizardBackBtn').addEventListener('click',()=>setWizardStep(wizardStep-1));
 $('wizardNextBtn').addEventListener('click',handleWizardNext);
 $('setupWizard').addEventListener('click',event=>{
  if(event.target===$('setupWizard')&&state?.projectName)$('setupWizard').classList.remove('open');
 });
};

init=function(){
 populateCentreSelect();
 bind();
 const restored=loadAutosave();
 syncInputs();
 renderLanePicker();
 renderSessionTypeControls();
 resetForm();
 renderAll();
 updateProjectChrome();
 if(restored){showWorkspace();$('status').textContent='Restored last project'}
 else showStartScreen();
};
