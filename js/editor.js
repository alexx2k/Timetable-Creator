/* Direct timetable booking creation */
let createDrag=null;
let suppressNextSheetClick=false;

const baseSyncInputsForDirectEditor=syncInputs;
syncInputs=function(){
 baseSyncInputsForDirectEditor();
 if($('projectNameInput'))$('projectNameInput').value=state.projectName||'';
};

const baseSyncSettingsForDirectEditor=syncSettings;
syncSettings=function(){
 if($('projectNameInput'))state.projectName=$('projectNameInput').value.trim()||'Untitled timetable';
 baseSyncSettingsForDirectEditor();
};

function laneAtPointer(clientY,rect){
 const ratio=clamp((clientY-rect.top)/Math.max(rect.height,1),0,.999999);
 return clamp(Math.floor(ratio*state.laneCount)+1,1,state.laneCount);
}

function minuteAtPointer(clientX,rect,day){
 const viewStart=mins(state.viewStart);
 const viewEnd=mins(state.viewEnd);
 const range=Math.max(state.interval,viewEnd-viewStart);
 const raw=viewStart+clamp((clientX-rect.left)/Math.max(rect.width,1),0,1)*range;
 const snapped=Math.round(raw/state.interval)*state.interval;
 return clamp(snapped,mins(day.open),mins(day.close));
}

function updateCreateDraft(event){
 if(!createDrag)return;
 const {track,rect,day,anchorMinute,anchorLane}=createDrag;
 let edgeMinute=minuteAtPointer(event.clientX,rect,day);
 if(edgeMinute===anchorMinute)edgeMinute=event.clientX>=createDrag.startX?anchorMinute+state.interval:anchorMinute-state.interval;
 edgeMinute=clamp(edgeMinute,mins(day.open),mins(day.close));
 let start=Math.min(anchorMinute,edgeMinute);
 let end=Math.max(anchorMinute,edgeMinute);
 if(end-start<state.interval){
  if(anchorMinute+state.interval<=mins(day.close)){start=anchorMinute;end=anchorMinute+state.interval}
  else{start=anchorMinute-state.interval;end=anchorMinute}
 }
 const edgeLane=laneAtPointer(event.clientY,rect);
 const firstLane=Math.min(anchorLane,edgeLane);
 const lastLane=Math.max(anchorLane,edgeLane);
 const viewStart=mins(state.viewStart);
 const viewEnd=mins(state.viewEnd);
 const range=viewEnd-viewStart;
 const left=(start-viewStart)/range*100;
 const width=(end-start)/range*100;
 const top=(firstLane-1)/state.laneCount*100;
 const height=(lastLane-firstLane+1)/state.laneCount*100;
 Object.assign(createDrag,{start,end,firstLane,lastLane});
 createDrag.draft.style.left=`${left}%`;
 createDrag.draft.style.width=`${width}%`;
 createDrag.draft.style.top=`${top}%`;
 createDrag.draft.style.height=`${height}%`;
 createDrag.draft.textContent=`${timeStr(start)}–${timeStr(end)}`;
 track.classList.add('dragging');
}

function startCreateBookingDrag(event){
 if(event.button!==0||drag||createDrag||event.target.closest('.booking-block'))return;
 hideQuickTypeBar();
 const track=event.currentTarget;
 const dayIndex=Number(track.dataset.day);
 const day=state.days[dayIndex];
 if(!day)return;
 const rect=track.getBoundingClientRect();
 let anchorMinute=minuteAtPointer(event.clientX,rect,day);
 if(anchorMinute>=mins(day.close))anchorMinute=mins(day.close)-state.interval;
 if(anchorMinute<mins(day.open)||anchorMinute>=mins(day.close))return;
 const anchorLane=laneAtPointer(event.clientY,rect);
 const draft=document.createElement('div');
 draft.className='booking-draft';
 draft.setAttribute('aria-hidden','true');
 track.appendChild(draft);
 createDrag={track,rect,day,dayIndex,anchorMinute,anchorLane,startX:event.clientX,startY:event.clientY,draft,start:anchorMinute,end:anchorMinute+state.interval,firstLane:anchorLane,lastLane:anchorLane};
 event.preventDefault();
 event.stopPropagation();
 try{track.setPointerCapture(event.pointerId)}catch(_){}
 updateCreateDraft(event);
}

function finishCreateBookingDrag(event){
 if(!createDrag)return false;
 updateCreateDraft(event||{clientX:createDrag.startX,clientY:createDrag.startY});
 const draftState=createDrag;
 createDrag=null;
 draftState.track.classList.remove('dragging');
 draftState.draft.remove();
 const id=uid();
 const lanes=Array.from({length:draftState.lastLane-draftState.firstLane+1},(_,index)=>draftState.firstLane+index);
 state.bookings.push({
  id,
  day:draftState.dayIndex,
  start:timeStr(draftState.start),
  end:timeStr(draftState.end),
  activity:'New booking',
  lanes,
  coverageMode:'lanes',
  sessionTypeId:'',
  sessionTypeName:'Custom',
  colourHex:'#b4c4d2'
 });
 selectedId=id;
 suppressNextSheetClick=true;
 saveAndRender();
 showQuickTypeBar(id,{x:event?.clientX??draftState.startX,y:event?.clientY??draftState.startY});
 setTimeout(()=>{suppressNextSheetClick=false},250);
 return true;
}

const basePointerMoveForDirectEditor=onPointerMove;
onPointerMove=function(event){
 if(createDrag){event.preventDefault();updateCreateDraft(event);return}
 return basePointerMoveForDirectEditor(event);
};

const basePointerEndForDirectEditor=endPointerDrag;
endPointerDrag=function(event){
 if(createDrag){finishCreateBookingDrag(event);return}
 return basePointerEndForDirectEditor(event);
};

const baseRenderSheetForDirectEditor=renderSheet;
renderSheet=function(){
 const result=baseRenderSheetForDirectEditor();
 document.querySelectorAll('.day-track[data-day]').forEach(track=>{
  track.classList.add('booking-create-zone');
  track.addEventListener('pointerdown',startCreateBookingDrag);
 });
 const sheet=$('sheet');
 sheet.onclick=event=>{
  if(suppressNextSheetClick){suppressNextSheetClick=false;return}
  if(!event.target.closest('.booking-block'))deselectBooking();
 };
 return result;
};

const baseBindForDirectEditor=bind;
bind=function(){
 baseBindForDirectEditor();
 $('projectNameInput').addEventListener('input',syncSettings);
};

/* Quick session-type choice after drawing a booking. */
let quickTypeBookingId=null;

function hideQuickTypeBar(){
 quickTypeBookingId=null;
 const bar=$('quickTypeBar');
 if(bar)bar.hidden=true;
}

function quickTypeBooking(){return state.bookings.find(booking=>booking.id===quickTypeBookingId)||null}

function renderQuickTypeActions(){
 const actions=$('quickTypeActions');
 if(!actions)return;
 actions.innerHTML=state.sessionTypes.map(type=>`<button type="button" class="quick-type-button" data-quick-type="${escapeHtml(type.id)}"><span class="quick-type-swatch" style="background:${validHex(type.colour)}"></span>${escapeHtml(type.name)}</button>`).join('')+
  '<button type="button" class="quick-type-button custom" data-quick-custom>Custom</button>'+
  '<button type="button" class="quick-type-button undo" data-quick-undo>Undo</button>';
 actions.querySelectorAll('[data-quick-type]').forEach(button=>button.addEventListener('click',()=>applyQuickType(button.dataset.quickType)));
 actions.querySelector('[data-quick-custom]')?.addEventListener('click',keepQuickBookingCustom);
 actions.querySelector('[data-quick-undo]')?.addEventListener('click',undoQuickBooking);
}

function showQuickTypeBar(id){
 const booking=state.bookings.find(item=>item.id===id);
 if(!booking)return;
 quickTypeBookingId=id;
 renderQuickTypeActions();
 const bar=$('quickTypeBar');
 if(bar){bar.hidden=false;bar.scrollIntoView({behavior:'smooth',block:'nearest'})}
}

function applyQuickType(typeId){
 const booking=quickTypeBooking();
 const type=sessionTypeById(typeId);
 if(!booking||!type)return hideQuickTypeBar();
 const id=booking.id;
 hideQuickTypeBar();
 updateBooking(id,{activity:type.defaultTitle,sessionTypeId:type.id,sessionTypeName:type.name,colourHex:validHex(type.colour)});
 selectedId=id;
}

function keepQuickBookingCustom(){
 const booking=quickTypeBooking();
 hideQuickTypeBar();
 if(!booking)return;
 selectedId=booking.id;
 renderAll();
 requestAnimationFrame(()=>{
  const input=$('fineActivity');
  if(input){input.focus();input.select()}
 });
}

function undoQuickBooking(){
 const booking=quickTypeBooking();
 hideQuickTypeBar();
 if(!booking)return;
 state.bookings=state.bookings.filter(item=>item.id!==booking.id);
 if(selectedId===booking.id)selectedId=null;
 saveAndRender();
}

const selectBookingBeforeQuickType=selectBooking;
selectBooking=function(id){
 if(quickTypeBookingId&&quickTypeBookingId!==id)hideQuickTypeBar();
 return selectBookingBeforeQuickType(id);
};

const showStartScreenBeforeQuickType=showStartScreen;
showStartScreen=function(){hideQuickTypeBar();return showStartScreenBeforeQuickType()};

/* Copy a selected booking and place it directly on the timetable. */
let copiedBooking=null;
let copyPreview=null;
let copyPreviewTrack=null;
let copyPlacement=null;

function isEditingText(target){return Boolean(target&&target.closest&&target.closest('input, textarea, select, [contenteditable="true"]'))}

function clearCopyPreview(){
 if(copyPreview){copyPreview.remove();copyPreview=null}
 copyPreviewTrack=null;
 copyPlacement=null;
}

function cancelCopyBooking(message='Copy cancelled'){
 if(!copiedBooking)return;
 copiedBooking=null;
 clearCopyPreview();
 document.body.classList.remove('copy-booking-mode');
 if($('status'))$('status').textContent=message;
}

function beginCopyBooking(id=selectedId){
 hideQuickTypeBar();
 const source=state.bookings.find(booking=>booking.id===id);
 if(!source){
  if($('status'))$('status').textContent='Select a booking to copy';
  return;
 }
 copiedBooking={...source,lanes:[...(source.lanes||[])]};
 clearCopyPreview();
 document.body.classList.add('copy-booking-mode');
 if($('status'))$('status').textContent=`Copying ${source.activity} — click the timetable to place it`;
}

function copyPlacementAtPointer(track,clientX,clientY){
 if(!copiedBooking)return null;
 const dayIndex=Number(track.dataset.day);
 const day=state.days[dayIndex];
 if(!day)return null;
 const rect=track.getBoundingClientRect();
 const duration=Math.max(state.interval,mins(copiedBooking.end)-mins(copiedBooking.start));
 const open=mins(day.open);
 const close=mins(day.close);
 if(duration>close-open)return {valid:false,dayIndex,rect,day};
 let start=minuteAtPointer(clientX,rect,day);
 start=clamp(start,open,close-duration);
 const end=start+duration;
 const mode=coverageMode(copiedBooking);
 let lanes;
 if(mode==='lanes'){
  const span=clamp((copiedBooking.lanes||[]).length||1,1,state.laneCount);
  const pointedLane=laneAtPointer(clientY,rect);
  const firstLane=clamp(pointedLane,1,state.laneCount-span+1);
  lanes=Array.from({length:span},(_,index)=>firstLane+index);
 }else{
  lanes=Array.from({length:state.laneCount},(_,index)=>index+1);
 }
 return {valid:true,dayIndex,day,rect,start,end,lanes,mode};
}

function showCopyPreview(track,event){
 if(!copiedBooking)return;
 const placement=copyPlacementAtPointer(track,event.clientX,event.clientY);
 if(!placement)return;
 if(copyPreviewTrack!==track){
  clearCopyPreview();
  copyPreview=document.createElement('div');
  copyPreview.className='booking-copy-preview';
  copyPreview.setAttribute('aria-hidden','true');
  track.appendChild(copyPreview);
  copyPreviewTrack=track;
 }
 copyPlacement=placement;
 if(!placement.valid){
  copyPreview.classList.add('invalid');
  copyPreview.style.cssText='left:0;right:0;top:0;height:100%;';
  copyPreview.textContent='Does not fit within these opening hours';
  return;
 }
 const viewStart=mins(state.viewStart);
 const range=Math.max(state.interval,mins(state.viewEnd)-viewStart);
 const left=(placement.start-viewStart)/range*100;
 const width=(placement.end-placement.start)/range*100;
 const previewBooking={...copiedBooking,day:placement.dayIndex,start:timeStr(placement.start),end:timeStr(placement.end),lanes:placement.lanes};
 const [top,bottom]=coverageBounds(previewBooking);
 const colour=bookingColour(copiedBooking);
 copyPreview.classList.remove('invalid');
 copyPreview.style.left=`${left}%`;
 copyPreview.style.width=`${width}%`;
 copyPreview.style.top=`${top}%`;
 copyPreview.style.height=`${bottom-top}%`;
 copyPreview.style.backgroundColor=colour;
 copyPreview.style.color=textColour(colour);
 copyPreview.textContent=copiedBooking.activity;
}

function placeCopiedBooking(track,event){
 if(!copiedBooking)return false;
 const placement=copyPlacementAtPointer(track,event.clientX,event.clientY);
 if(!placement?.valid){
  if($('status'))$('status').textContent='That booking does not fit within this day’s opening hours';
  return true;
 }
 const newId=uid();
 const duplicate={...copiedBooking,id:newId,day:placement.dayIndex,start:timeStr(placement.start),end:timeStr(placement.end),lanes:[...placement.lanes]};
 state.bookings.push(duplicate);
 selectedId=newId;
 copiedBooking=null;
 clearCopyPreview();
 document.body.classList.remove('copy-booking-mode');
 suppressNextSheetClick=true;
 saveAndRender();
 if($('status'))$('status').textContent=`Copied ${duplicate.activity}`;
 setTimeout(()=>{suppressNextSheetClick=false},250);
 return true;
}

function bindCopyPlacementTargets(){
 document.querySelectorAll('.day-track[data-day]').forEach(track=>{
  track.addEventListener('pointermove',event=>showCopyPreview(track,event));
  track.addEventListener('pointerleave',()=>{if(copyPreviewTrack===track)clearCopyPreview()});
  track.addEventListener('pointerdown',event=>{
   if(!copiedBooking||event.button!==0)return;
   event.preventDefault();
   event.stopPropagation();
   event.stopImmediatePropagation();
   placeCopiedBooking(track,event);
  },true);
 });
}

const renderSheetBeforeCopyPlacement=renderSheet;
renderSheet=function(){
 const result=renderSheetBeforeCopyPlacement();
 bindCopyPlacementTargets();
 return result;
};

const bindBeforeCopyShortcut=bind;
bind=function(){
 bindBeforeCopyShortcut();
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'&&!isEditingText(event.target)){
   event.preventDefault();
   beginCopyBooking();
   return;
  }
  if(event.key==='Escape'&&copiedBooking){
   event.preventDefault();
   cancelCopyBooking();
   return;
  }
  if(event.key==='Escape'&&quickTypeBookingId){
   event.preventDefault();
   hideQuickTypeBar();
  }
 });
};
