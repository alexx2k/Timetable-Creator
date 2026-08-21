/* Refined editor: history, multi-selection, overlaps, context menus and file state. */
const FILE_RECORDS_KEY='timetableCreatorFileRecordsV1';
const HISTORY_LIMIT=80;

let selectedIds=new Set(selectedId?[selectedId]:[]);
let undoStack=[];
let redoStack=[];
let historyCurrentFull='';
let historyCurrentKey='';
let historyProjectId='';
let historyApplying=false;
let preserveMultiSelectionForId=null;
let pendingDeleteIds=[];
let quickTypePoint=null;
let contextBookingId=null;
let fileRecords={};

try{fileRecords=JSON.parse(localStorage.getItem(FILE_RECORDS_KEY)||'{}')||{}}catch(_){fileRecords={}}

function cloneState(value=state){return JSON.parse(JSON.stringify(value))}

function historyKey(value=state){
 const copy=cloneState(value);
 delete copy.updatedAt;
 return JSON.stringify(copy);
}

function stateFull(value=state){return JSON.stringify(cloneState(value))}

function hashString(value){
 let hash=2166136261;
 for(let index=0;index<value.length;index++){
  hash^=value.charCodeAt(index);
  hash=Math.imul(hash,16777619);
 }
 return (hash>>>0).toString(36);
}

function projectFingerprint(value=state){return hashString(historyKey(value))}
function persistFileRecords(){try{localStorage.setItem(FILE_RECORDS_KEY,JSON.stringify(fileRecords))}catch(_){}}

function markCurrentProjectSaved(filename='Timetable file'){
 if(!state?.projectId)return;
 fileRecords[state.projectId]={fingerprint:projectFingerprint(),filename,at:new Date().toISOString()};
 persistFileRecords();
 updateFileStateIndicator();
}

function updateFileStateIndicator(){
 const badge=$('fileState');
 const label=$('fileStateText');
 if(!badge||!label||!state?.projectId)return;
 const record=fileRecords[state.projectId];
 const saved=Boolean(record&&record.fingerprint===projectFingerprint());
 badge.classList.toggle('saved',saved);
 badge.classList.toggle('dirty',!saved);
 label.textContent=saved?'Saved to file':record?'Changes not saved':'Not saved to file';
 badge.title=saved?`Matches ${record.filename||'the last saved timetable file'}. Browser autosave is also active.`:'Browser autosave is active, but these changes are not in the last timetable file you saved.';
}

function resetHistory(){
 undoStack=[];
 redoStack=[];
 historyProjectId=state?.projectId||'';
 historyCurrentFull=stateFull();
 historyCurrentKey=historyKey();
 updateHistoryButtons();
}

function updateHistoryButtons(){
 if($('undoBtn'))$('undoBtn').disabled=!undoStack.length;
 if($('redoBtn'))$('redoBtn').disabled=!redoStack.length;
}

function commitHistoryBeforeSave(){
 const projectId=state?.projectId||'';
 const nextKey=historyKey();
 if(!historyCurrentFull||historyProjectId!==projectId){
  historyProjectId=projectId;
  historyCurrentFull=stateFull();
  historyCurrentKey=nextKey;
  undoStack=[];
  redoStack=[];
  return;
 }
 if(nextKey!==historyCurrentKey){
  undoStack.push(historyCurrentFull);
  if(undoStack.length>HISTORY_LIMIT)undoStack.shift();
  redoStack=[];
 }
}

function finishHistorySave(){
 historyProjectId=state?.projectId||'';
 historyCurrentFull=stateFull();
 historyCurrentKey=historyKey();
 updateHistoryButtons();
 updateFileStateIndicator();
}

function restoreHistorySnapshot(snapshot){
 historyApplying=true;
 hideBookingContextMenu();
 hideQuickTypeBar();
 if(copiedBooking)cancelCopyBooking('Copy cancelled');
 state=JSON.parse(snapshot);
 autoFitView();
 selectedId=null;
 selectedIds.clear();
 editId=null;
 syncInputs();
 renderLanePicker();
 resetForm();
 saveAndRender();
 historyApplying=false;
 historyCurrentFull=stateFull();
 historyCurrentKey=historyKey();
 historyProjectId=state.projectId||'';
 updateHistoryButtons();
 updateFileStateIndicator();
}

function undoEdit(){
 if(!undoStack.length)return;
 const previous=undoStack.pop();
 redoStack.push(historyCurrentFull||stateFull());
 restoreHistorySnapshot(previous);
}

function redoEdit(){
 if(!redoStack.length)return;
 const next=redoStack.pop();
 undoStack.push(historyCurrentFull||stateFull());
 restoreHistorySnapshot(next);
}

const saveAndRenderBeforeProfessionalEditor=saveAndRender;
saveAndRender=function(){
 if(!historyApplying)commitHistoryBeforeSave();
 saveAndRenderBeforeProfessionalEditor();
 finishHistorySave();
};

function selectionArray(){return [...selectedIds].map(id=>state.bookings.find(booking=>booking.id===id)).filter(Boolean)}

function setSingleSelection(id,render=true){
 selectedIds.clear();
 if(id){selectedIds.add(id);selectedId=id}
 else selectedId=null;
 if(render)renderAll();
}

function toggleBookingSelection(id){
 hideBookingContextMenu();
 hideQuickTypeBar();
 if(selectedIds.has(id)){
  selectedIds.delete(id);
  if(selectedId===id)selectedId=[...selectedIds][0]||null;
 }else{
  selectedIds.add(id);
  selectedId=id;
 }
 renderAll();
}

function clearBookingSelection(render=true){
 selectedIds.clear();
 selectedId=null;
 if(render)renderAll();
}

const selectBookingBeforeMultiSelect=selectBooking;
selectBooking=function(id){
 if(preserveMultiSelectionForId===id&&selectedIds.has(id)){
  preserveMultiSelectionForId=null;
  selectedId=id;
  renderAll();
  return;
 }
 setSingleSelection(id,false);
 return selectBookingBeforeMultiSelect(id);
};

const deselectBookingBeforeMultiSelect=deselectBooking;
deselectBooking=function(){selectedIds.clear();return deselectBookingBeforeMultiSelect()};

const prepareForPrintBeforeMultiSelect=prepareForPrint;
prepareForPrint=function(){
 selectedIds.clear();
 hideBookingContextMenu();
 hideQuickTypeBar();
 return prepareForPrintBeforeMultiSelect();
};

function coverageInterval(booking){
 const bounds=coverageBounds(booking);
 return {start:bounds[0],end:bounds[1]};
}

function bookingsOverlap(first,second){
 if(!first||!second||first.id===second.id||Number(first.day)!==Number(second.day))return false;
 if(mins(first.start)>=mins(second.end)||mins(second.start)>=mins(first.end))return false;
 const a=coverageInterval(first);
 const b=coverageInterval(second);
 return a.start<b.end&&b.start<a.end;
}

function conflictMap(){
 const map=new Map(state.bookings.map(booking=>[booking.id,new Set()]));
 for(let firstIndex=0;firstIndex<state.bookings.length;firstIndex++){
  for(let secondIndex=firstIndex+1;secondIndex<state.bookings.length;secondIndex++){
   const first=state.bookings[firstIndex];
   const second=state.bookings[secondIndex];
   if(bookingsOverlap(first,second)){
    map.get(first.id).add(second.id);
    map.get(second.id).add(first.id);
   }
  }
 }
 return map;
}

function updateOverlapIndicator(map=conflictMap()){
 const ids=[...map.entries()].filter(([,others])=>others.size).map(([id])=>id);
 const pairCount=[...map.values()].reduce((sum,set)=>sum+set.size,0)/2;
 const badge=$('overlapState');
 if(!badge)return;
 badge.hidden=false;
 badge.classList.toggle('has-overlaps',pairCount>0);
 badge.textContent=pairCount?`${pairCount} overlap${pairCount===1?'':'s'}`:'No overlaps';
 badge.title=pairCount?`${ids.length} bookings are involved in ${pairCount} overlap${pairCount===1?'':'s'}. Overlaps are warnings only.`:'No booking overlaps detected.';
}

function applySelectionAndConflictStyles(){
 const conflicts=conflictMap();
 document.querySelectorAll('.booking-block[data-booking-id]').forEach(block=>{
  const id=block.dataset.bookingId;
  block.classList.toggle('multi-selected',selectedIds.has(id));
  const others=conflicts.get(id)||new Set();
  block.classList.toggle('booking-conflict',others.size>0);
  if(others.size){
   const names=[...others].map(otherId=>state.bookings.find(booking=>booking.id===otherId)?.activity).filter(Boolean);
   block.title=`${block.title||''}\nWarning: overlaps ${names.join(', ')}`.trim();
  }
 });
 updateOverlapIndicator(conflicts);
 return conflicts;
}

function appendSingleOverlapWarning(booking){
 const body=$('selectionBody');
 if(!body||!booking)return;
 const conflicts=state.bookings.filter(other=>bookingsOverlap(booking,other));
 if(!conflicts.length)return;
 const box=document.createElement('div');
 box.className='overlap-warning';
 box.innerHTML=`<strong>Overlap warning</strong>This booking overlaps ${conflicts.length===1?escapeHtml(conflicts[0].activity):`${conflicts.length} other bookings`} in the same pool area and time.`;
 body.prepend(box);
}

function renderMultiSelectionPanel(bookings){
 const body=$('selectionBody');
 const badge=$('selectionBadge');
 badge.textContent=`${bookings.length} selected`;
 const selectedConflictCount=bookings.filter(booking=>state.bookings.some(other=>bookingsOverlap(booking,other))).length;
 body.innerHTML=`
  ${selectedConflictCount?`<div class="overlap-warning"><strong>Overlap warning</strong>${selectedConflictCount} selected booking${selectedConflictCount===1?' is':'s are'} involved in an overlap.</div>`:''}
  <div class="multi-selection-summary"><strong>${bookings.length} bookings selected.</strong><br>Drag any selected booking to move the group together. Shift-click or Ctrl-click bookings to add or remove them.</div>
  <div class="field"><label for="bulkSessionType">Change session type</label><select id="bulkSessionType"><option value="">Choose a session type…</option>${state.sessionTypes.map(type=>`<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`).join('')}</select></div>
  <label class="bulk-check"><input id="bulkUseTitle" type="checkbox" checked> Use the session type’s default title</label>
  <label class="bulk-check"><input id="bulkUseColour" type="checkbox" checked> Use the session type’s colour</label>
  <div class="form-actions"><button id="bulkApplyType" type="button">Apply to selection</button><button id="bulkCopyPrimary" type="button" class="secondary">Copy primary</button><button id="bulkClear" type="button" class="secondary">Clear selection</button><button id="bulkDelete" type="button" class="danger">Delete selection</button></div>
  <div class="multi-help">Only moving is grouped. Resize handles continue to adjust the primary booking so accidental bulk resizing is avoided.</div>`;
 $('bulkApplyType').addEventListener('click',()=>{
  const type=sessionTypeById($('bulkSessionType').value);
  if(!type)return alert('Choose a session type first.');
  const useTitle=$('bulkUseTitle').checked;
  const useColour=$('bulkUseColour').checked;
  const ids=new Set(selectedIds);
  state.bookings=state.bookings.map(booking=>ids.has(booking.id)?{...booking,sessionTypeId:type.id,sessionTypeName:type.name,activity:useTitle?type.defaultTitle:booking.activity,colourHex:useColour?validHex(type.colour):booking.colourHex}:booking);
  saveAndRender();
 });
 $('bulkCopyPrimary').addEventListener('click',()=>beginCopyBooking(selectedId));
 $('bulkClear').addEventListener('click',()=>clearBookingSelection());
 $('bulkDelete').addEventListener('click',()=>requestDeleteBooking(selectedId));
}

const renderSelectionPanelBeforeMultiSelect=renderSelectionPanel;
renderSelectionPanel=function(){
 const bookings=selectionArray();
 if(bookings.length>1){renderMultiSelectionPanel(bookings);return}
 renderSelectionPanelBeforeMultiSelect();
 if(bookings.length===1)appendSingleOverlapWarning(bookings[0]);
};

function clampFloatingMenu(menu,x,y){
 if(!menu)return;
 const margin=10;
 const offset=10;
 menu.style.left=`${Math.max(margin,x+offset)}px`;
 menu.style.top=`${Math.max(margin,y+offset)}px`;
 requestAnimationFrame(()=>{
  const rect=menu.getBoundingClientRect();
  const left=clamp(x+offset,margin,Math.max(margin,window.innerWidth-rect.width-margin));
  const preferredTop=y+offset;
  const top=preferredTop+rect.height<=window.innerHeight-margin?preferredTop:Math.max(margin,y-rect.height-offset);
  menu.style.left=`${left}px`;
  menu.style.top=`${clamp(top,margin,Math.max(margin,window.innerHeight-rect.height-margin))}px`;
 });
}

const hideQuickTypeBarBeforeFloating=hideQuickTypeBar;
hideQuickTypeBar=function(){quickTypePoint=null;return hideQuickTypeBarBeforeFloating()};

showQuickTypeBar=function(id,point){
 const booking=state.bookings.find(item=>item.id===id);
 if(!booking)return;
 quickTypeBookingId=id;
 quickTypePoint=point||quickTypePoint||{x:window.innerWidth/2,y:window.innerHeight/2};
 selectedIds.clear();
 selectedIds.add(id);
 selectedId=id;
 renderQuickTypeActions();
 const menu=$('quickTypeBar');
 if(!menu)return;
 menu.hidden=false;
 clampFloatingMenu(menu,quickTypePoint.x,quickTypePoint.y);
};

function hideBookingContextMenu(){
 const menu=$('bookingContextMenu');
 if(menu)menu.hidden=true;
 contextBookingId=null;
 document.body.classList.remove('context-menu-open');
}

function applyTypeToSelection(typeId){
 const type=sessionTypeById(typeId);
 if(!type)return;
 const ids=new Set(selectedIds);
 state.bookings=state.bookings.map(booking=>ids.has(booking.id)?{...booking,sessionTypeId:type.id,sessionTypeName:type.name,activity:type.defaultTitle,colourHex:validHex(type.colour)}:booking);
 hideBookingContextMenu();
 saveAndRender();
}

function showBookingContextMenu(event,id){
 event.preventDefault();
 event.stopPropagation();
 hideQuickTypeBar();
 if(!selectedIds.has(id))setSingleSelection(id,false);
 selectedId=id;
 contextBookingId=id;
 renderAll();
 const booking=state.bookings.find(item=>item.id===id);
 const count=selectedIds.size;
 const menu=$('bookingContextMenu');
 if(!booking||!menu)return;
 const title=count>1?`${count} selected`:booking.activity;
 menu.innerHTML=`<div class="context-menu-title">${escapeHtml(title)}</div>
  <button class="context-menu-item" data-menu-copy type="button"><span class="menu-icon">⧉</span>${count>1?'Copy primary booking':'Copy booking'}</button>
  ${count>1?'<button class="context-menu-item" data-menu-only type="button"><span class="menu-icon">●</span>Keep only this booking selected</button>':'<button class="context-menu-item" data-menu-add type="button"><span class="menu-icon">＋</span>Add another with Shift-click</button>'}
  <div class="context-menu-divider"></div>
  <div class="context-menu-title">Change session type</div>
  ${state.sessionTypes.map(type=>`<button class="context-menu-item context-menu-type" data-menu-type="${escapeHtml(type.id)}" type="button"><span class="context-menu-swatch" style="background:${validHex(type.colour)}"></span>${escapeHtml(type.name)}</button>`).join('')}
  <div class="context-menu-divider"></div>
  <button class="context-menu-item danger" data-menu-delete type="button"><span class="menu-icon">⌫</span>${count>1?'Delete selection':'Delete booking'}</button>`;
 menu.querySelector('[data-menu-copy]').addEventListener('click',()=>{hideBookingContextMenu();beginCopyBooking(id)});
 menu.querySelector('[data-menu-only]')?.addEventListener('click',()=>{hideBookingContextMenu();setSingleSelection(id)});
 menu.querySelector('[data-menu-add]')?.addEventListener('click',()=>hideBookingContextMenu());
 menu.querySelectorAll('[data-menu-type]').forEach(button=>button.addEventListener('click',()=>applyTypeToSelection(button.dataset.menuType)));
 menu.querySelector('[data-menu-delete]').addEventListener('click',()=>{hideBookingContextMenu();requestDeleteBooking(id)});
 menu.hidden=false;
 document.body.classList.add('context-menu-open');
 clampFloatingMenu(menu,event.clientX,event.clientY);
}

function bindProfessionalSheetInteractions(){
 const sheet=$('sheet');
 if(!sheet)return;
 sheet.addEventListener('pointerdown',event=>{
  const block=event.target.closest('.booking-block[data-booking-id]');
  if(!block)return;
  const id=block.dataset.bookingId;
  if(event.shiftKey||event.ctrlKey||event.metaKey){
   event.preventDefault();
   event.stopImmediatePropagation();
   toggleBookingSelection(id);
   return;
  }
  if(selectedIds.size>1&&selectedIds.has(id))preserveMultiSelectionForId=id;
  else if(!selectedIds.has(id)){
   selectedIds.clear();
   selectedIds.add(id);
   selectedId=id;
  }
 },true);
 sheet.addEventListener('contextmenu',event=>{
  const block=event.target.closest('.booking-block[data-booking-id]');
  if(block)showBookingContextMenu(event,block.dataset.bookingId);
  else hideBookingContextMenu();
 });
}

const startPointerDragBeforeGroupMove=startPointerDrag;
startPointerDrag=function(event){
 const block=event.currentTarget;
 const id=block?.dataset.bookingId;
 const mode=event.target.dataset.mode||'move';
 if(mode==='move'&&id&&selectedIds.size>1&&selectedIds.has(id)){
  const track=block.closest('.day-track');
  const rect=track.getBoundingClientRect();
  event.preventDefault();
  selectedId=id;
  drag={multi:true,id,mode:'move',startX:event.clientX,startY:event.clientY,rect,lastStepX:0,lastStepY:0,originals:selectionArray().map(booking=>({...booking,lanes:[...(booking.lanes||[])]}))};
  try{block.setPointerCapture(event.pointerId)}catch(_){}
  track.classList.add('dragging');
  renderSelectionPanel();
  return;
 }
 return startPointerDragBeforeGroupMove(event);
};

const onPointerMoveBeforeGroupMove=onPointerMove;
onPointerMove=function(event){
 if(!drag?.multi)return onPointerMoveBeforeGroupMove(event);
 event.preventDefault();
 const viewRange=mins(state.viewEnd)-mins(state.viewStart);
 const deltaX=event.clientX-drag.startX;
 const deltaY=event.clientY-drag.startY;
 const timeSteps=Math.round((deltaX/drag.rect.width*viewRange)/SNAP);
 let laneSteps=Math.round(deltaY/(drag.rect.height/state.laneCount));
 if(timeSteps===drag.lastStepX&&laneSteps===drag.lastStepY)return;
 const originals=drag.originals;
 const minTimeDelta=Math.max(...originals.map(booking=>mins(state.days[booking.day].open)-mins(booking.start)));
 const maxTimeDelta=Math.min(...originals.map(booking=>mins(state.days[booking.day].close)-mins(booking.end)));
 let timeDelta=clamp(timeSteps*SNAP,minTimeDelta,maxTimeDelta);
 timeDelta=Math.round(timeDelta/SNAP)*SNAP;
 const laneBookings=originals.filter(booking=>coverageMode(booking)==='lanes');
 if(laneBookings.length){
  const minLaneDelta=Math.max(...laneBookings.map(booking=>1-(booking.lanes[0]||1)));
  const maxLaneDelta=Math.min(...laneBookings.map(booking=>state.laneCount-(booking.lanes[booking.lanes.length-1]||state.laneCount)));
  laneSteps=clamp(laneSteps,minLaneDelta,maxLaneDelta);
 }else laneSteps=0;
 drag.lastStepX=timeSteps;
 drag.lastStepY=Math.round(deltaY/(drag.rect.height/state.laneCount));
 const originalMap=new Map(originals.map(booking=>[booking.id,booking]));
 state.bookings=state.bookings.map(booking=>{
  const original=originalMap.get(booking.id);
  if(!original)return booking;
  const moved={...booking,start:timeStr(mins(original.start)+timeDelta),end:timeStr(mins(original.end)+timeDelta)};
  if(coverageMode(original)==='lanes')moved.lanes=original.lanes.map(lane=>lane+laneSteps);
  return moved;
 });
 renderAll();
};

const endPointerDragBeforeGroupMove=endPointerDrag;
endPointerDrag=function(event){
 if(!drag?.multi)return endPointerDragBeforeGroupMove(event);
 document.querySelectorAll('.day-track.dragging').forEach(track=>track.classList.remove('dragging'));
 drag=null;
 preserveMultiSelectionForId=selectedId;
 saveAndRender();
};

requestDeleteBooking=function(id){
 if(!id)return;
 pendingDeleteIds=selectedIds.size>1&&selectedIds.has(id)?[...selectedIds]:[id];
 const bookings=pendingDeleteIds.map(itemId=>state.bookings.find(booking=>booking.id===itemId)).filter(Boolean);
 if(!bookings.length)return;
 $('deleteConfirmTitle').textContent=bookings.length>1?`Delete ${bookings.length} bookings?`:`Delete ${bookings[0].activity}?`;
 $('deleteConfirmText').textContent=bookings.length>1?'The selected bookings will be permanently removed from the timetable.':`${state.days[bookings[0].day].name} · ${bookings[0].start}–${bookings[0].end} will be permanently removed from the timetable.`;
 $('deleteConfirmOverlay').classList.add('open');
 setTimeout(()=>$('cancelDeleteBtn').focus(),0);
};

closeDeleteConfirm=function(){
 pendingDeleteIds=[];
 pendingDeleteId=null;
 $('deleteConfirmOverlay').classList.remove('open');
};

confirmDeleteBooking=function(){
 if(!pendingDeleteIds.length)return closeDeleteConfirm();
 const removeIds=new Set(pendingDeleteIds);
 state.bookings=state.bookings.filter(booking=>!removeIds.has(booking.id));
 selectedIds=new Set([...selectedIds].filter(id=>!removeIds.has(id)));
 if(selectedId&&removeIds.has(selectedId))selectedId=[...selectedIds][0]||null;
 if(editId&&removeIds.has(editId))resetForm();
 closeDeleteConfirm();
 saveAndRender();
};

const handleFileBeforeFileIndicator=handleFile;
handleFile=function(file,input){
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const data=JSON.parse(reader.result);
   const isV2=data&&data.format===FILE_FORMAT&&Number(data.formatVersion)>=2;
   if(!isV2&&!Array.isArray(data.bookings))throw new Error('Unrecognised timetable structure');
   normalizeState(data);
   selectedId=null;
   selectedIds.clear();
   editId=null;
   populateCentreSelect();
   syncInputs();
   renderLanePicker();
   resetForm();
   historyApplying=true;
   saveAndRender();
   historyApplying=false;
   resetHistory();
   markCurrentProjectSaved(file.name);
   showWorkspace();
   showImportNotice(file.name);
  }catch(error){
   console.error(error);
   alert('That file is not a recognised timetable file.');
  }
 };
 reader.readAsText(file);
 if(input)input.value='';
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
   markCurrentProjectSaved(handle.name);
   return;
  }
 }catch(error){
  if(error?.name==='AbortError')return;
  console.warn('Using browser download fallback',error);
 }
 let filename=prompt('Name this timetable file:',suggestedName);
 if(filename===null)return;
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
 markCurrentProjectSaved(filename);
};

const completeWizardBeforeFileIndicator=completeWizard;
completeWizard=function(){
 completeWizardBeforeFileIndicator();
 selectedIds.clear();
 resetHistory();
 updateFileStateIndicator();
};

const renderSheetBeforeProfessionalEditor=renderSheet;
renderSheet=function(){
 const result=renderSheetBeforeProfessionalEditor();
 applySelectionAndConflictStyles();
 bindProfessionalSheetInteractions();
 return result;
};

const bindBeforeProfessionalEditor=bind;
bind=function(){
 bindBeforeProfessionalEditor();
 $('undoBtn')?.addEventListener('click',undoEdit);
 $('redoBtn')?.addEventListener('click',redoEdit);
 document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('#bookingContextMenu'))hideBookingContextMenu();
  if(quickTypeBookingId&&!event.target.closest('#quickTypeBar')&&!event.target.closest('.booking-block[data-booking-id]'))hideQuickTypeBar();
 },true);
 document.addEventListener('keydown',event=>{
  if(isEditingText(event.target))return;
  const modifier=event.ctrlKey||event.metaKey;
  if(modifier&&event.key.toLowerCase()==='z'){
   event.preventDefault();
   event.stopImmediatePropagation();
   event.shiftKey?redoEdit():undoEdit();
   return;
  }
  if(modifier&&event.key.toLowerCase()==='y'){
   event.preventDefault();
   event.stopImmediatePropagation();
   redoEdit();
   return;
  }
  if(event.key==='Delete'&&selectedIds.size>1){
   event.preventDefault();
   event.stopImmediatePropagation();
   requestDeleteBooking(selectedId);
   return;
  }
  if(event.key==='Escape'&&!$('bookingContextMenu')?.hidden){
   event.preventDefault();
   hideBookingContextMenu();
  }
 },true);
 window.addEventListener('resize',()=>{
  hideBookingContextMenu();
  if(quickTypeBookingId&&quickTypePoint)clampFloatingMenu($('quickTypeBar'),quickTypePoint.x,quickTypePoint.y);
 });
};
