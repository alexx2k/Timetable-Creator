const DEFAULT_DAYS=[
 {name:'Monday',open:'08:00',close:'22:00'},
 {name:'Tuesday',open:'07:00',close:'21:00'},
 {name:'Wednesday',open:'08:00',close:'21:00'},
 {name:'Thursday',open:'07:00',close:'22:00'},
 {name:'Friday',open:'08:30',close:'20:30'},
 {name:'Saturday',open:'08:00',close:'14:30'},
 {name:'Sunday',open:'08:00',close:'14:30'}
];

const LEGACY_COLOURS={
 'Public Swimming':'#86b6d8','Lane Swimming':'#b9dff5','Lessons':'#e69a73','Club Booking':'#d79aca','Aqua Class':'#91c9a8','Closed':'#c9ced2','Other':'#b4c4d2'
};

const DEFAULT_SESSION_TYPES=[
 {id:'public-swimming',name:'Public Swimming',defaultTitle:'Public Swimming',colour:'#86b6d8'},
 {id:'lane-swimming',name:'Lane Swimming',defaultTitle:'Lane Swimming',colour:'#b9dff5'},
 {id:'lessons',name:'Lessons',defaultTitle:'Swimming Lessons',colour:'#e69a73'},
 {id:'club-booking',name:'Club Booking',defaultTitle:'Club Booking',colour:'#d79aca'},
 {id:'aqua-class',name:'Aqua Class',defaultTitle:'Aqua Class',colour:'#91c9a8'},
 {id:'closure',name:'Pool Closure',defaultTitle:'CLOSED',colour:'#c9ced2'}
];

const SNAP=15;

const CENTRES={
 'east-sands':{subtitle:'East Sands Leisure Centre',venueName:'East Sands Leisure Centre',address:'St Mary Street, St Andrews, KY16 8LH',phone:'01334 659473',venueAddress:'St Mary Street, St Andrews, KY16 8LH · 01334 659473'},
 'cupar':{subtitle:'Cupar Sports Centre',venueName:'Cupar Sports Centre',address:'Carslogie Road, Cupar, KY15 4HY',phone:'01334 659324',venueAddress:'Carslogie Road, Cupar, KY15 4HY · 01334 659324'},
 'leven':{subtitle:'Leven Leisure Centre',venueName:'Leven Leisure Centre',address:'Promenade, Leven, KY8 4PA',phone:'01334 659325',venueAddress:'Promenade, Leven, KY8 4PA · 01334 659325'},
 'kirkcaldy':{subtitle:'Kirkcaldy Leisure Centre',venueName:'Kirkcaldy Leisure Centre',address:'Esplanade, Kirkcaldy, KY1 1HR',phone:'01592 583306',venueAddress:'Esplanade, Kirkcaldy, KY1 1HR · 01592 583306'},
 'michael-woods':{subtitle:'Michael Woods Sports and Leisure Centre',venueName:'Michael Woods Sports and Leisure Centre',address:'Viewfield, Glenrothes, KY6 2RD',phone:'01592 583305',venueAddress:'Viewfield, Glenrothes, KY6 2RD · 01592 583305'},
 'beacon':{subtitle:'Beacon Leisure Centre',venueName:'Beacon Leisure Centre',address:'Lammerlaws Road, Burntisland, KY3 9BS',phone:'01592 583383',venueAddress:'Lammerlaws Road, Burntisland, KY3 9BS · 01592 583383'},
 'bowhill':{subtitle:'Bowhill Swimming Pool',venueName:'Bowhill Swimming Pool',address:'Station Road, Cardenden, Lochgelly, KY5 0BW',phone:'01592 583304',venueAddress:'Station Road, Cardenden, Lochgelly, KY5 0BW · 01592 583304'},
 'carnegie':{subtitle:'Carnegie Leisure Centre',venueName:'Carnegie Leisure Centre',address:'46 Pilmuir Street, Dunfermline, KY12 0QE',phone:'01383 602304',venueAddress:'46 Pilmuir Street, Dunfermline, KY12 0QE · 01383 602304'},
 'cowdenbeath':{subtitle:'Cowdenbeath Leisure Centre',venueName:'Cowdenbeath Leisure Centre',address:'Pit Road, Cowdenbeath, KY4 9NN',phone:'01383 602305',venueAddress:'Pit Road, Cowdenbeath, KY4 9NN · 01383 602305'},
 'custom':{subtitle:'Custom centre',venueName:'Custom centre',address:'',phone:'',venueAddress:''}
};

const freshState=()=>({
 projectId:uid(),projectName:'Untitled timetable',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
 centreId:'east-sands',title:'Main Pool Timetable',subtitle:'East Sands Leisure Centre',venueName:'East Sands Leisure Centre',venueAddress:'St Mary Street, St Andrews, KY16 8LH · 01334 659473',admissionsPolicy:'Children under 8 years must be accompanied by an adult aged 16 or over in the same water. Parent/child ratios: 1 adult to 2 children under 5 years, or 1 adult to 3 children aged 5–7 years.',laneCount:4,interval:15,
 viewStart:'07:00',viewEnd:'22:00',days:DEFAULT_DAYS.map(day=>({...day})),
 sessionTypes:DEFAULT_SESSION_TYPES.map(type=>({...type})),bookings:[]
});

let state=freshState();
let editId=null;
let selectedId=null;
let drag=null;
let sessionTypeEditId=null;
let pendingDeleteId=null;
let bookingLabelFitFrame=0;

const $=id=>document.getElementById(id);

function mins(time){
 const [hours,minutes]=String(time||'00:00').split(':').map(Number);
 return hours*60+minutes;
}

function timeStr(total){
 total=Math.max(0,Math.min(1439,Math.round(total)));
 return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

function fmt(time){
 const [hours,minutes]=time.split(':').map(Number);
 const suffix=hours>=12?'pm':'am';
 const displayHour=((hours+11)%12)+1;
 return minutes?`${displayHour}:${String(minutes).padStart(2,'0')}${suffix}`:`${displayHour}${suffix}`;
}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function validHex(value){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toLowerCase():'#b4c4d2'}

function formatPolicyForFooter(value){
 const text=String(value||'').trim();
 if(!text)return '';
 const marker='Parent/child ratios:';
 const markerIndex=text.toLowerCase().indexOf(marker.toLowerCase());
 if(markerIndex>=0){
  const introduction=text.slice(0,markerIndex).trim();
  const ratios=text.slice(markerIndex+marker.length).trim();
  return `${introduction?`<span class="policy-introduction">${escapeHtml(introduction)}</span>`:''}<span class="policy-ratios"><b>${escapeHtml(marker)}</b> ${escapeHtml(ratios)}</span>`;
 }
 const sentenceBreak=text.indexOf('. ');
 if(sentenceBreak>=0){
  return `<span class="policy-introduction">${escapeHtml(text.slice(0,sentenceBreak+1))}</span><span class="policy-ratios">${escapeHtml(text.slice(sentenceBreak+2))}</span>`;
 }
 return `<span class="policy-introduction">${escapeHtml(text)}</span>`;
}

function laneRange(lanes){
 const clean=[...new Set((lanes||[]).map(Number).filter(lane=>lane>=1&&lane<=state.laneCount))].sort((a,b)=>a-b);
 if(!clean.length)return [];
 return Array.from({length:clean[clean.length-1]-clean[0]+1},(_,index)=>clean[0]+index);
}

function coverageMode(booking){
 return ['all','half-first','half-second','lanes'].includes(booking?.coverageMode)?booking.coverageMode:'lanes';
}

function coverageBounds(booking){
 const mode=coverageMode(booking);
 if(mode==='all')return [0,100];
 if(mode==='half-first')return [0,50];
 if(mode==='half-second')return [50,100];
 const lanes=laneRange(booking?.lanes||[]);
 if(!lanes.length)return [0,100];
 return [(lanes[0]-1)/state.laneCount*100,lanes[lanes.length-1]/state.laneCount*100];
}

function selected(){return state.bookings.find(booking=>booking.id===selectedId)||null}
function sessionTypeById(id){return state.sessionTypes.find(type=>type.id===id)||null}
function bookingColour(booking){return validHex(booking.colourHex||sessionTypeById(booking.sessionTypeId)?.colour||LEGACY_COLOURS[booking.colour]||'#b4c4d2')}
function bookingTypeName(booking){return sessionTypeById(booking.sessionTypeId)?.name||booking.sessionTypeName||booking.colour||'Custom'}

function textColour(hex){
 const value=validHex(hex).slice(1);
 const red=parseInt(value.slice(0,2),16);
 const green=parseInt(value.slice(2,4),16);
 const blue=parseInt(value.slice(4,6),16);
 return (red*299+green*587+blue*114)/1000>160?'#17212b':'#ffffff';
}

function normalizeState(candidate={}){
 const base=freshState();
 const savedDays=Array.isArray(candidate.days)?candidate.days:DEFAULT_DAYS;
 const days=DEFAULT_DAYS.map((day,index)=>({name:day.name,open:savedDays[index]?.open||day.open,close:savedDays[index]?.close||day.close}));
 const importedTypes=Array.isArray(candidate.sessionTypes)&&candidate.sessionTypes.length?candidate.sessionTypes:DEFAULT_SESSION_TYPES;
 let sessionTypes=importedTypes.map((type,index)=>({
  id:String(type.id||`session-${index+1}-${uid()}`),
  name:String(type.name||type.defaultTitle||`Session ${index+1}`).trim(),
  defaultTitle:String(type.defaultTitle||type.name||`Session ${index+1}`).trim(),
  colour:validHex(type.colour)
 })).filter(type=>type.name);
 if(!sessionTypes.some(type=>type.id==='closure'||type.name.toLowerCase()==='pool closure'))sessionTypes.push({...DEFAULT_SESSION_TYPES.find(type=>type.id==='closure')});
 const normalized={...base,...candidate,days,sessionTypes:sessionTypes.length?sessionTypes:DEFAULT_SESSION_TYPES.map(type=>({...type}))};
 normalized.laneCount=clamp(Number(normalized.laneCount)||4,1,12);
 normalized.interval=[15,30].includes(Number(normalized.interval))?Number(normalized.interval):15;
 normalized.viewStart=normalized.viewStart||timeStr(Math.min(...days.map(day=>mins(day.open))));
 if(!/^\d{2}:\d{2}$/.test(normalized.viewStart))normalized.viewStart='07:00';
 normalized.viewEnd=normalized.viewEnd||'22:00';
 if(!/^\d{2}:\d{2}$/.test(normalized.viewEnd))normalized.viewEnd='22:00';
 if(mins(normalized.viewEnd)<=mins(normalized.viewStart)){normalized.viewStart='07:00';normalized.viewEnd='22:00'}
 normalized.centreId=CENTRES[normalized.centreId]?normalized.centreId:(String(normalized.venueName||'').toLowerCase().includes('cupar')?'cupar':'east-sands');
 state=normalized;
 state.bookings=Array.isArray(candidate.bookings)?candidate.bookings.map(booking=>{
  let typeId=booking.sessionTypeId;
  if(!typeId&&booking.colour)typeId=state.sessionTypes.find(type=>type.name===booking.colour)?.id||'';
  const type=sessionTypeById(typeId);
  const mode=['all','half-first','half-second','lanes'].includes(booking.coverageMode)?booking.coverageMode:'lanes';
  const lanes=mode==='lanes'?laneRange(booking.lanes):Array.from({length:state.laneCount},(_,index)=>index+1);
  return {...booking,id:booking.id||uid(),day:clamp(Number(booking.day)||0,0,6),lanes,coverageMode:mode,sessionTypeId:typeId||'',sessionTypeName:booking.sessionTypeName||type?.name||booking.colour||'Custom',colourHex:validHex(booking.colourHex||type?.colour||LEGACY_COLOURS[booking.colour])};
 }).filter(booking=>booking.lanes.length):[];
 return state;
}

function init(){
 bind();
 loadAutosave();
 syncInputs();
 renderLanePicker();
 renderSessionTypeControls();
 resetForm();
 renderAll();
}

function bind(){
 ['titleInput','subtitleInput','venueNameInput','venueAddressInput','admissionsPolicyInput'].forEach(id=>$(id).addEventListener('input',syncSettings));
 $('centreInput').addEventListener('change',applyCentrePreset);
 $('laneCountInput').addEventListener('change',()=>{
  state.laneCount=clamp(Number($('laneCountInput').value)||1,1,12);
  $('laneCountInput').value=state.laneCount;
  state.bookings.forEach(booking=>booking.lanes=laneRange(booking.lanes));
  renderLanePicker();
  saveAndRender();
 });
 $('intervalInput').addEventListener('change',()=>{state.interval=Number($('intervalInput').value);saveAndRender()});
 ['viewStartInput','viewEndInput'].forEach(id=>$(id).addEventListener('change',updateViewRange));
 document.querySelectorAll('.day-open,.day-close').forEach(input=>input.addEventListener('change',updateDayHours));
 $('selectAllBtn').addEventListener('click',()=>document.querySelectorAll('#lanePicker input').forEach(input=>input.checked=true));
 $('clearLanesBtn').addEventListener('click',()=>document.querySelectorAll('#lanePicker input').forEach(input=>input.checked=false));
 $('sessionTypeInput').addEventListener('change',applySelectedSessionType);
 $('coverageModeInput').addEventListener('change',updateCoverageModeUI);
 $('saveSessionTypeBtn').addEventListener('click',saveSessionType);
 $('cancelSessionTypeBtn').addEventListener('click',resetSessionTypeForm);
 $('saveBookingBtn').addEventListener('click',saveBooking);
 $('cancelEditBtn').addEventListener('click',resetForm);
 $('downloadBtn').addEventListener('click',downloadJson);
 $('uploadInput').addEventListener('change',uploadJson);
 $('printBtn').addEventListener('click',printTimetable);
 $('newBtn').addEventListener('click',openCreatorWizard);
 $('cancelDeleteBtn').addEventListener('click',closeDeleteConfirm);
 $('confirmDeleteBtn').addEventListener('click',confirmDeleteBooking);
 $('deleteConfirmOverlay').addEventListener('click',event=>{if(event.target===$('deleteConfirmOverlay'))closeDeleteConfirm()});
 window.addEventListener('beforeprint',prepareForPrint);
 window.addEventListener('afterprint',scheduleBookingLabelFit);
 window.addEventListener('resize',scheduleBookingLabelFit);
 document.addEventListener('pointermove',onPointerMove,{passive:false});
 document.addEventListener('pointerup',endPointerDrag);
 document.addEventListener('pointercancel',endPointerDrag);
 document.addEventListener('keydown',event=>{
  if(!selected())return;
  if(event.key==='ArrowLeft'){event.preventDefault();nudgeTime(-SNAP)}
  else if(event.key==='ArrowRight'){event.preventDefault();nudgeTime(SNAP)}
  else if(event.key==='Delete')removeBooking(selectedId);
  else if(event.key==='Escape'&&$('deleteConfirmOverlay').classList.contains('open'))closeDeleteConfirm();
 });
}

function applyCentrePreset(){
 const id=$('centreInput').value;
 const preset=CENTRES[id];
 if(!preset)return;
 state.centreId=id;
 state.subtitle=preset.subtitle;
 state.venueName=preset.venueName;
 state.venueAddress=preset.venueAddress;
 $('subtitleInput').value=preset.subtitle;
 $('venueNameInput').value=preset.venueName;
 $('venueAddressInput').value=preset.venueAddress;
 saveAndRender();
}

function syncSettings(){
 state.centreId=$('centreInput').value;
 state.title=$('titleInput').value;
 state.subtitle=$('subtitleInput').value;
 state.venueName=$('venueNameInput').value;
 state.venueAddress=$('venueAddressInput').value;
 state.admissionsPolicy=$('admissionsPolicyInput').value;
 saveAndRender();
}

function updateViewRange(){
 const proposedStart=$('viewStartInput').value;
 const proposedEnd=$('viewEndInput').value;
 if(!proposedStart||!proposedEnd||mins(proposedEnd)<=mins(proposedStart)){
  alert('The timetable view finish must be later than its start.');
  syncInputs();
  return;
 }
 state.viewStart=proposedStart;
 state.viewEnd=proposedEnd;
 saveAndRender();
}

function updateDayHours(event){
 const dayIndex=Number(event.target.dataset.day);
 const open=$(`open-${dayIndex}`).value;
 const close=$(`close-${dayIndex}`).value;
 if(!open||!close||mins(close)<=mins(open)){
  alert(`${state.days[dayIndex].name}'s closing time must be later than its opening time.`);
  syncInputs();
  return;
 }
 const affected=state.bookings.filter(booking=>booking.day===dayIndex&&(mins(booking.start)<mins(open)||mins(booking.end)>mins(close)));
 if(affected.length&&!confirm(`${affected.length} existing booking${affected.length===1?' is':'s are'} outside these new opening hours. Keep the new hours anyway?`)){
  syncInputs();
  return;
 }
 state.days[dayIndex].open=open;
 state.days[dayIndex].close=close;
 autoFitView();
 saveAndRender();
}

function updateRangeWarning(){
 const outside=state.days.filter(day=>mins(day.open)<mins(state.viewStart)||mins(day.close)>mins(state.viewEnd));
 const warning=$('rangeWarning');
 if(outside.length){
  warning.style.display='block';
  warning.textContent=`The view range hides part of the opening hours for: ${outside.map(day=>day.name).join(', ')}. Bookings there still exist but will be clipped from the timetable display.`;
 }else{
  warning.style.display='none';
  warning.textContent='';
 }
}

function renderSessionTypeControls(selectedValue){
 const select=$('sessionTypeInput');
 const current=selectedValue!==undefined?selectedValue:select?.value;
 select.innerHTML=state.sessionTypes.map(type=>`<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`).join('')+'<option value="">Custom / no type</option>';
 if([...select.options].some(option=>option.value===current))select.value=current;
 else select.value=state.sessionTypes[0]?.id||'';
 renderSessionTypesList();
}

function applySelectedSessionType(){
 const type=sessionTypeById($('sessionTypeInput').value);
 if(!type)return;
 $('activityInput').value=type.defaultTitle;
 $('bookingColourInput').value=type.colour;
}

function renderSessionTypesList(){
 const list=$('sessionTypesList');
 if(!state.sessionTypes.length){list.innerHTML='<div class="empty-note">No reusable session types yet.</div>';return}
 list.innerHTML=state.sessionTypes.map(type=>`<div class="session-type-row"><span class="session-type-swatch" style="background:${type.colour}"></span><div class="session-type-copy"><strong>${escapeHtml(type.name)}</strong><small>Default title: ${escapeHtml(type.defaultTitle)}</small></div><div class="session-type-actions"><button type="button" data-edit-type="${escapeHtml(type.id)}">Edit</button><button type="button" class="danger" data-delete-type="${escapeHtml(type.id)}">Delete</button></div></div>`).join('');
 list.querySelectorAll('[data-edit-type]').forEach(button=>button.addEventListener('click',()=>editSessionType(button.dataset.editType)));
 list.querySelectorAll('[data-delete-type]').forEach(button=>button.addEventListener('click',()=>deleteSessionType(button.dataset.deleteType)));
}

function saveSessionType(){
 const name=$('sessionTypeNameInput').value.trim();
 const defaultTitle=$('sessionTypeTitleInput').value.trim();
 const colour=validHex($('sessionTypeColourInput').value);
 if(!name)return alert('Enter a session type name.');
 if(!defaultTitle)return alert('Enter a default booking title.');
 const duplicate=state.sessionTypes.find(type=>type.name.toLowerCase()===name.toLowerCase()&&type.id!==sessionTypeEditId);
 if(duplicate)return alert('A session type with that name already exists.');
 if(sessionTypeEditId)state.sessionTypes=state.sessionTypes.map(type=>type.id===sessionTypeEditId?{...type,name,defaultTitle,colour}:type);
 else state.sessionTypes.push({id:uid(),name,defaultTitle,colour});
 const selectedType=sessionTypeEditId||state.sessionTypes[state.sessionTypes.length-1].id;
 resetSessionTypeForm();
 renderSessionTypeControls(selectedType);
 saveAndRender();
}

function editSessionType(id){
 const type=sessionTypeById(id);
 if(!type)return;
 sessionTypeEditId=id;
 $('sessionTypesPanel').open=true;
 $('sessionTypeNameInput').value=type.name;
 $('sessionTypeTitleInput').value=type.defaultTitle;
 $('sessionTypeColourInput').value=type.colour;
 $('saveSessionTypeBtn').textContent='Update session type';
 $('cancelSessionTypeBtn').style.display='inline-block';
}

function resetSessionTypeForm(){
 sessionTypeEditId=null;
 $('sessionTypeNameInput').value='';
 $('sessionTypeTitleInput').value='';
 $('sessionTypeColourInput').value='#86b6d8';
 $('saveSessionTypeBtn').textContent='Add session type';
 $('cancelSessionTypeBtn').style.display='none';
}

function deleteSessionType(id){
 const type=sessionTypeById(id);
 if(!type)return;
 const used=state.bookings.filter(booking=>booking.sessionTypeId===id).length;
 const message=used?`Delete ${type.name}? ${used} existing booking${used===1?'':'s'} will keep their current title and colour but become Custom.`:`Delete ${type.name}?`;
 if(!confirm(message))return;
 state.bookings=state.bookings.map(booking=>booking.sessionTypeId===id?{...booking,sessionTypeId:'',sessionTypeName:type.name}:booking);
 state.sessionTypes=state.sessionTypes.filter(type=>type.id!==id);
 if(sessionTypeEditId===id)resetSessionTypeForm();
 renderSessionTypeControls();
 saveAndRender();
}

function renderLanePicker(selectedLanes=[]){
 const box=$('lanePicker');
 box.innerHTML='';
 for(let lane=1;lane<=state.laneCount;lane++){
  const label=document.createElement('label');
  label.className='lane-check';
  label.innerHTML=`<input type="checkbox" value="${lane}" ${selectedLanes.includes(lane)?'checked':''}> Lane ${lane}`;
  box.appendChild(label);
 }
}

function updateCoverageModeUI(){
 const mode=$('coverageModeInput').value;
 const laneMode=mode==='lanes';
 $('lanePickerField').style.display=laneMode?'block':'none';
 $('lanePickerActions').style.display=laneMode?'flex':'none';
 document.querySelectorAll('#lanePicker input').forEach(input=>{
  input.disabled=!laneMode;
  if(!laneMode)input.checked=false;
 });
}

function saveBooking(){
 const day=Number($('dayInput').value);
 const start=$('startInput').value;
 const end=$('endInput').value;
 const activity=$('activityInput').value.trim();
 const sessionTypeId=$('sessionTypeInput').value;
 const mode=$('coverageModeInput').value;
 let lanes=mode==='lanes'?[...document.querySelectorAll('#lanePicker input:checked')].map(input=>Number(input.value)):Array.from({length:state.laneCount},(_,index)=>index+1);
 lanes=laneRange(lanes);
 if(!activity)return alert('Enter a booking title.');
 if(mins(end)<=mins(start))return alert('The end time must be later than the start time.');
 if(mode==='lanes'&&!lanes.length)return alert('Select at least one lane.');
 const dayState=state.days[day];
 if(mins(start)<mins(dayState.open)||mins(end)>mins(dayState.close))return alert(`This booking must be within ${dayState.name}'s opening hours (${dayState.open}–${dayState.close}).`);
 const type=sessionTypeById(sessionTypeId);
 const booking={id:editId||uid(),day,start,end,activity,lanes,coverageMode:mode,sessionTypeId:sessionTypeId||'',sessionTypeName:type?.name||'Custom',colourHex:validHex($('bookingColourInput').value)};
 if(editId){
  state.bookings=state.bookings.map(existing=>existing.id===editId?booking:existing);
  selectedId=booking.id;
 }else{
  state.bookings.push(booking);
  selectedId=booking.id;
 }
 resetForm();
 saveAndRender();
}

function resetForm(){
 editId=null;
 $('saveBookingBtn').textContent='Add booking';
 $('cancelEditBtn').style.display='none';
 $('coverageModeInput').value='lanes';
 renderLanePicker();
 updateCoverageModeUI();
 renderSessionTypeControls(state.sessionTypes[0]?.id||'');
 const type=sessionTypeById($('sessionTypeInput').value);
 $('activityInput').value=type?.defaultTitle||'';
 $('bookingColourInput').value=type?.colour||'#b4c4d2';
}

function editBooking(id){
 const booking=state.bookings.find(item=>item.id===id);
 if(!booking)return;
 selectBooking(id);
 $('bookingPanel').open=true;
 editId=id;
 $('dayInput').value=booking.day;
 $('startInput').value=booking.start;
 $('endInput').value=booking.end;
 renderSessionTypeControls(booking.sessionTypeId||'');
 $('sessionTypeInput').value=booking.sessionTypeId||'';
 $('activityInput').value=booking.activity;
 $('bookingColourInput').value=bookingColour(booking);
 $('coverageModeInput').value=coverageMode(booking);
 renderLanePicker(booking.lanes);
 updateCoverageModeUI();
 $('saveBookingBtn').textContent='Update booking';
 $('cancelEditBtn').style.display='inline-block';
 $('bookingPanel').scrollIntoView({behavior:'smooth',block:'start'});
}

function requestDeleteBooking(id){
 if(!id)return;
 const booking=state.bookings.find(item=>item.id===id);
 if(!booking)return;
 pendingDeleteId=id;
 $('deleteConfirmTitle').textContent='Delete '+booking.activity+'?';
 $('deleteConfirmText').textContent=state.days[booking.day].name+' · '+booking.start+'–'+booking.end+' will be permanently removed from the timetable.';
 $('deleteConfirmOverlay').classList.add('open');
 setTimeout(()=>$('cancelDeleteBtn').focus(),0);
}

function closeDeleteConfirm(){pendingDeleteId=null;$('deleteConfirmOverlay').classList.remove('open')}

function confirmDeleteBooking(){
 const id=pendingDeleteId;
 if(!id)return closeDeleteConfirm();
 state.bookings=state.bookings.filter(booking=>booking.id!==id);
 if(selectedId===id)selectedId=null;
 if(editId===id)resetForm();
 closeDeleteConfirm();
 saveAndRender();
}

function removeBooking(id){requestDeleteBooking(id)}
function selectBooking(id){selectedId=id;renderAll()}
function deselectBooking(){if(selectedId===null)return;selectedId=null;renderAll()}

function prepareForPrint(){
 const printing=window.matchMedia('print').matches;
 if(printing){selectedId=null;applyPrintSafeBookingLabels();return}
 if(selectedId!==null){selectedId=null;renderAll()}
 fitBookingLabels();
}

function printTimetable(){prepareForPrint();requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))}
function updateBooking(id,patch,save=true){state.bookings=state.bookings.map(booking=>booking.id===id?{...booking,...patch}:booking);if(save)saveAndRender();else renderAll()}

function nudgeTime(delta){
 const booking=selected();
 if(!booking)return;
 const day=state.days[booking.day];
 const duration=mins(booking.end)-mins(booking.start);
 let start=mins(booking.start)+delta;
 start=clamp(start,mins(day.open),mins(day.close)-duration);
 updateBooking(booking.id,{start:timeStr(start),end:timeStr(start+duration)});
}

function moveLane(delta){
 const booking=selected();
 if(!booking||coverageMode(booking)!=='lanes')return;
 const span=booking.lanes.length;
 const first=clamp(booking.lanes[0]+delta,1,state.laneCount-span+1);
 updateBooking(booking.id,{lanes:Array.from({length:span},(_,index)=>first+index)});
}

function saveAndRender(){
 try{localStorage.setItem('poolTimetableCreatorV11',JSON.stringify(state))}catch(_){}
 renderAll();
 $('status').textContent='Saved in this browser';
}

function loadAutosave(){
 let raw=null;
 try{
  raw=localStorage.getItem('poolTimetableCreatorV11')||localStorage.getItem('poolTimetableCreatorV9')||localStorage.getItem('poolTimetableCreatorV8')||localStorage.getItem('poolTimetableCreatorV7')||localStorage.getItem('poolTimetableCreatorV6')||localStorage.getItem('poolTimetableCreatorV5')||localStorage.getItem('poolTimetableCreatorV4')||localStorage.getItem('poolTimetableCreatorV3')||localStorage.getItem('poolTimetableCreator');
 }catch(_){}
 if(!raw)return;
 try{
  const saved=JSON.parse(raw);
  if(saved&&Array.isArray(saved.bookings)){normalizeState(saved);$('status').textContent='Restored saved timetable'}
 }catch(_){}
}

function syncInputs(){
 $('centreInput').value=CENTRES[state.centreId]?state.centreId:'east-sands';
 $('titleInput').value=state.title;
 $('subtitleInput').value=state.subtitle;
 $('venueNameInput').value=state.venueName;
 $('venueAddressInput').value=state.venueAddress;
 $('admissionsPolicyInput').value=state.admissionsPolicy;
 $('laneCountInput').value=state.laneCount;
 $('intervalInput').value=state.interval;
 $('viewStartInput').value=state.viewStart;
 $('viewEndInput').value=state.viewEnd;
 state.days.forEach((day,index)=>{$(`open-${index}`).value=day.open;$(`close-${index}`).value=day.close});
 renderSessionTypeControls();
 updateRangeWarning();
}

function renderAll(){
 updateRangeWarning();
 renderSessionTypesList();
 renderList();
 renderSelectionPanel();
 renderSheet();
}

function renderList(){
 const list=$('bookingsList');
 const bookings=[...state.bookings].sort((a,b)=>a.day-b.day||mins(a.start)-mins(b.start));
 if(!bookings.length){list.innerHTML='<div class="empty-note">No bookings added yet.</div>';return}
 list.innerHTML=bookings.map(booking=>`<div class="booking-row" style="border-left-color:${bookingColour(booking)}"><strong>${escapeHtml(state.days[booking.day].name)} · ${escapeHtml(booking.activity)}</strong><small>${escapeHtml(bookingTypeName(booking))} · ${booking.start}–${booking.end} · ${coverageMode(booking)==='lanes'?`Lane${booking.lanes.length>1?'s':''} ${booking.lanes[0]}${booking.lanes.length>1?'–'+booking.lanes[booking.lanes.length-1]:''}`:coverageMode(booking)==='all'?'Whole pool':coverageMode(booking)==='half-first'?'Lane 1 side half':'Opposite side half'}</small><div class="booking-row-actions"><button type="button" data-select="${booking.id}">Select</button><button type="button" data-edit="${booking.id}">Edit form</button><button type="button" class="danger" data-delete="${booking.id}">Delete</button></div></div>`).join('');
 list.querySelectorAll('[data-select]').forEach(button=>button.addEventListener('click',()=>selectBooking(button.dataset.select)));
 list.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>editBooking(button.dataset.edit)));
 list.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',()=>removeBooking(button.dataset.delete)));
}

function renderSelectionPanel(){
 const booking=selected();
 const body=$('selectionBody');
 const badge=$('selectionBadge');
 if(!booking){
  badge.textContent='None selected';
  body.innerHTML='<div class="selection-empty">Drag across an empty part of the timetable to create a booking. Select an existing booking to edit its title, times, lanes, session type and colour here.</div>';
  return;
 }
 badge.textContent='Selected';
 body.innerHTML=`
  <div class="field"><label for="fineActivity">Activity</label><input id="fineActivity" value="${escapeHtml(booking.activity)}"></div>
  <div class="field"><label for="fineDay">Day</label><select id="fineDay">${state.days.map((day,index)=>`<option value="${index}" ${index===booking.day?'selected':''}>${day.name}</option>`).join('')}</select></div>
  <div class="field"><label for="fineCoverageMode">Pool area</label><select id="fineCoverageMode"><option value="lanes" ${coverageMode(booking)==='lanes'?'selected':''}>Selected lanes</option><option value="all" ${coverageMode(booking)==='all'?'selected':''}>Whole pool</option><option value="half-first" ${coverageMode(booking)==='half-first'?'selected':''}>Lane 1 side — exactly half</option><option value="half-second" ${coverageMode(booking)==='half-second'?'selected':''}>Opposite side — exactly half</option></select></div>
  <div class="adjust-grid">
   <div class="field"><label for="fineStart">Start time</label><input id="fineStart" type="time" step="900" value="${booking.start}"></div>
   <div class="field"><label for="fineEnd">Finish time</label><input id="fineEnd" type="time" step="900" value="${booking.end}"></div>
   <div class="field fine-lane-field"><label for="fineFirstLane">First lane</label><input id="fineFirstLane" type="number" min="1" max="${state.laneCount}" value="${booking.lanes[0]}"></div>
   <div class="field fine-lane-field"><label for="fineLastLane">Last lane</label><input id="fineLastLane" type="number" min="1" max="${state.laneCount}" value="${booking.lanes[booking.lanes.length-1]}"></div>
  </div>
  <div class="field"><label for="fineSessionType">Session type</label><select id="fineSessionType">${state.sessionTypes.map(type=>`<option value="${escapeHtml(type.id)}" ${type.id===booking.sessionTypeId?'selected':''}>${escapeHtml(type.name)}</option>`).join('')}<option value="" ${!booking.sessionTypeId?'selected':''}>Custom / no type</option></select></div>
  <div class="field"><label for="fineColour">Colour</label><div class="color-field"><input id="fineColour" type="color" value="${bookingColour(booking)}"><span class="help" style="margin:0">Fine-tune this booking’s colour.</span></div></div>
  <div class="adjust-row"><button type="button" id="timeBack">←</button><div class="adjust-value">Move 15 minutes</div><button type="button" id="timeForward">→</button></div>
  <div class="adjust-row" style="margin-top:7px"><button type="button" id="laneUp">↑</button><div class="adjust-value">Move lane range</div><button type="button" id="laneDown">↓</button></div>
  <div class="form-actions"><button type="button" id="fineApply">Apply changes</button><button type="button" id="fineCopy" class="secondary">Copy booking</button><button type="button" id="fineDelete" class="danger">Delete</button></div>
  <div class="interaction-help"><strong>On the timetable:</strong> drag an empty area to create a booking. Drag a selected booking to move it, or use its edge handles to resize it. Press <strong>Ctrl+C</strong> or use Copy booking, then click elsewhere to place the copy. Press Esc to cancel.</div>`;
 $('timeBack').addEventListener('click',()=>nudgeTime(-SNAP));
 $('timeForward').addEventListener('click',()=>nudgeTime(SNAP));
 $('laneUp').addEventListener('click',()=>moveLane(-1));
 $('laneDown').addEventListener('click',()=>moveLane(1));
 $('fineCopy').addEventListener('click',()=>beginCopyBooking(booking.id));
 $('fineDelete').addEventListener('click',()=>removeBooking(booking.id));
 const updateFineCoverageUI=()=>{
  const laneMode=$('fineCoverageMode').value==='lanes';
  document.querySelectorAll('.fine-lane-field').forEach(field=>field.style.display=laneMode?'block':'none');
  ['fineFirstLane','fineLastLane'].forEach(id=>$(id).disabled=!laneMode);
  $('laneUp').disabled=!laneMode;
  $('laneDown').disabled=!laneMode;
 };
 $('fineCoverageMode').addEventListener('change',updateFineCoverageUI);
 updateFineCoverageUI();
 $('fineSessionType').addEventListener('change',()=>{
  const type=sessionTypeById($('fineSessionType').value);
  if(type){$('fineActivity').value=type.defaultTitle;$('fineColour').value=type.colour}
 });
 $('fineApply').addEventListener('click',()=>{
  const day=Number($('fineDay').value);
  const start=$('fineStart').value;
  const end=$('fineEnd').value;
  const first=clamp(Number($('fineFirstLane').value)||1,1,state.laneCount);
  const last=clamp(Number($('fineLastLane').value)||first,first,state.laneCount);
  const mode=$('fineCoverageMode').value;
  const dayState=state.days[day];
  if(mins(end)<=mins(start))return alert('Finish time must be after start time.');
  if(mins(start)<mins(dayState.open)||mins(end)>mins(dayState.close))return alert(`Times must be within ${dayState.name}'s opening hours.`);
  const sessionTypeId=$('fineSessionType').value;
  const type=sessionTypeById(sessionTypeId);
  updateBooking(booking.id,{activity:$('fineActivity').value.trim()||booking.activity,day,start,end,coverageMode:mode,lanes:mode==='lanes'?Array.from({length:last-first+1},(_,index)=>first+index):Array.from({length:state.laneCount},(_,index)=>index+1),sessionTypeId,sessionTypeName:type?.name||'Custom',colourHex:validHex($('fineColour').value)});
 });
}

function renderSheet(){
 const viewStart=mins(state.viewStart);
 const viewEnd=mins(state.viewEnd);
 const range=viewEnd-viewStart;
 const slots=Math.max(1,Math.round(range/state.interval));
 const pct=value=>value/range*100;
 const slotLines=(headerOnly=false)=>{
  let lines='';
  for(let index=1;index<slots;index++){
   const time=viewStart+index*state.interval;
   const major=time%60===0;
   if(headerOnly&&!major)continue;
   lines+=`<span class="slot-line${major?' major':''}" style="left:${pct(index*state.interval)}%" aria-hidden="true"></span>`;
  }
  return lines;
 };
 const legend=[...new Map(state.bookings.map(booking=>{
  const colour=bookingColour(booking);
  const label=bookingTypeName(booking);
  return [`${label}|${colour}`,{label,colour}];
 })).values()];
 let html=`<div class="sheet-heading"><h2>${escapeHtml(state.title||'Pool Timetable')}</h2><div class="subtitle">${escapeHtml(state.subtitle||'')}</div></div>`;
 if(legend.length)html+=`<div class="legend">${legend.map(item=>`<div class="legend-item"><span class="legend-swatch" style="background:${item.colour}"></span>${escapeHtml(item.label)}</div>`).join('')}</div>`;
 html+=`<div class="timetable"><div class="time-header"><div class="corner">DAY</div><div class="time-track">${slotLines(true)}`;
 html+=`<div class="time-label start">${fmt(state.viewStart)}</div>`;
 const firstHour=Math.ceil((viewStart+1)/60)*60;
 for(let time=firstHour;time<viewEnd;time+=60)html+=`<div class="time-label" style="left:${pct(time-viewStart)}%">${fmt(timeStr(time))}</div>`;
 html+=`<div class="time-label end">${fmt(state.viewEnd)}</div></div></div>`;
 state.days.forEach((day,dayIndex)=>{
  const open=mins(day.open);
  const close=mins(day.close);
  const dayBookings=state.bookings.filter(booking=>booking.day===dayIndex);
  html+=`<div class="day-row"><div class="day-label">${day.name}<small>${day.open} – ${day.close}</small></div><div class="day-track" data-day="${dayIndex}">${slotLines(false)}`;
  const beforeEnd=clamp(open,viewStart,viewEnd);
  if(beforeEnd>viewStart)html+=`<div class="booking-block" style="left:0;width:${pct(beforeEnd-viewStart)}%;top:0;height:100%;background:#d7dcdf;color:#68737b;cursor:default;z-index:1">CLOSED</div>`;
  const afterStart=clamp(close,viewStart,viewEnd);
  if(afterStart<viewEnd)html+=`<div class="booking-block" style="left:${pct(afterStart-viewStart)}%;width:${pct(viewEnd-afterStart)}%;top:0;height:100%;background:#d7dcdf;color:#68737b;cursor:default;z-index:1">CLOSED</div>`;
  dayBookings.forEach(booking=>{
   const rawStart=mins(booking.start);
   const rawEnd=mins(booking.end);
   if(rawEnd<=viewStart||rawStart>=viewEnd)return;
   const visibleStart=Math.max(rawStart,viewStart);
   const visibleEnd=Math.min(rawEnd,viewEnd);
   const left=pct(visibleStart-viewStart);
   const width=pct(visibleEnd-visibleStart);
   const first=booking.lanes[0]||1;
   const last=booking.lanes[booking.lanes.length-1]||state.laneCount;
   const [top,bottom]=coverageBounds(booking);
   const height=bottom-top;
   const isSelected=booking.id===selectedId;
   const blockColour=bookingColour(booking);
   let bookingLines='';
   const firstBoundary=Math.ceil(visibleStart/state.interval)*state.interval;
   for(let time=firstBoundary;time<visibleEnd;time+=state.interval){
    if(time<=visibleStart)continue;
    const boundaryLeft=(time-visibleStart)/(visibleEnd-visibleStart)*100;
    bookingLines+=`<span class="booking-grid-line${time%60===0?' major':''}" style="left:${boundaryLeft}%" aria-hidden="true"></span>`;
   }
   html+=`<div class="booking-block${isSelected?' selected':''}" data-booking-id="${booking.id}" title="${escapeHtml(booking.activity)} | ${booking.start}-${booking.end} | ${coverageMode(booking)==='lanes'?`Lanes ${first}-${last}`:coverageMode(booking)==='all'?'Whole pool':coverageMode(booking)==='half-first'?'Lane 1 side half':'Opposite side half'}" style="left:${left}%;width:${width}%;top:${top}%;height:${height}%;background-color:${blockColour};color:${textColour(blockColour)}">${bookingLines}<span class="booking-content" data-full-label="${escapeHtml(booking.activity)}">${escapeHtml(booking.activity)}</span>${isSelected?'<span class="drag-handle left" data-mode="resize-start"></span><span class="drag-handle right" data-mode="resize-end"></span>'+ (coverageMode(booking)==='lanes'?'<span class="drag-handle top" data-mode="resize-top"></span><span class="drag-handle bottom" data-mode="resize-bottom"></span>':'') +'<button type="button" class="nudge-arrow prev" data-nudge="-15" aria-label="Move 15 minutes earlier">‹</button><button type="button" class="nudge-arrow next" data-nudge="15" aria-label="Move 15 minutes later">›</button><button type="button" class="booking-delete-btn" data-delete-booking="'+booking.id+'" aria-label="Delete '+escapeHtml(booking.activity)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg></button>':''}</div>`;
  });
  const laneLeft=pct(clamp(open,viewStart,viewEnd)-viewStart);
  const laneRight=pct(viewEnd-clamp(close,viewStart,viewEnd));
  for(let lane=1;lane<state.laneCount;lane++)html+=`<div style="position:absolute;left:${laneLeft}%;right:${laneRight}%;top:${lane/state.laneCount*100}%;border-top:1px dashed rgba(66,82,94,.28);pointer-events:none;z-index:1"></div>`;
  html+='</div></div>';
 });
 html+=`<div class="time-header bottom-time-header"><div class="corner">TIME</div><div class="time-track">${slotLines(true)}<div class="time-label start">${fmt(state.viewStart)}</div>`;
 for(let time=firstHour;time<viewEnd;time+=60)html+=`<div class="time-label" style="left:${pct(time-viewStart)}%">${fmt(timeStr(time))}</div>`;
 html+=`<div class="time-label end">${fmt(state.viewEnd)}</div></div></div></div><footer class="print-footer"><div class="policy-block"><strong>Admission policy</strong><div class="policy-copy">${formatPolicyForFooter(state.admissionsPolicy||'')}</div></div><div class="address-block"><strong>${escapeHtml(state.venueName||'Venue')}</strong>${escapeHtml(state.venueAddress||'')}</div><div class="fslt-logo" aria-label="Fife Sports and Leisure Trust"><img src="fslt-logo.png" alt="Fife Sports and Leisure Trust logo"></div></footer>`;
 $('sheet').innerHTML=html;
 $('sheet').querySelectorAll('.booking-block[data-booking-id]').forEach(block=>{
  block.addEventListener('click',event=>{if(event.target.closest('[data-nudge], [data-delete-booking]'))return;selectBooking(block.dataset.bookingId)});
  block.addEventListener('pointerdown',startPointerDrag);
 });
 $('sheet').querySelectorAll('[data-nudge]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();nudgeTime(Number(button.dataset.nudge))}));
 $('sheet').querySelectorAll('[data-delete-booking]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();requestDeleteBooking(button.dataset.deleteBooking)}));
 $('sheet').onclick=event=>{if(!event.target.closest('.booking-block'))deselectBooking()};
 scheduleBookingLabelFit();
}

function scheduleBookingLabelFit(){
 cancelAnimationFrame(bookingLabelFitFrame);
 bookingLabelFitFrame=requestAnimationFrame(()=>{bookingLabelFitFrame=0;fitBookingLabels()});
}

function fitBookingLabels(){
 document.querySelectorAll('.booking-block[data-booking-id] .booking-content').forEach(content=>{
  const block=content.closest('.booking-block');
  const fullLabel=content.dataset.fullLabel||'';
  content.textContent=fullLabel;
  content.style.fontSize='';
  content.style.lineHeight='';
  content.style.letterSpacing='';
  block.classList.remove('label-hidden');
  if(!fullLabel||block.clientWidth<3||block.clientHeight<3)return;
  const naturalSize=parseFloat(getComputedStyle(block).fontSize)||10;
  const minimumSize=window.matchMedia('print').matches?5.5:6.5;
  const fits=()=>content.scrollWidth<=content.clientWidth+0.5&&content.scrollHeight<=content.clientHeight+0.5;
  let size=naturalSize;
  while(size>minimumSize&&!fits()){
   size=Math.max(minimumSize,size-.5);
   content.style.fontSize=size+'px';
   content.style.lineHeight='1.02';
  }
  if(!fits()){
   content.textContent='';
   block.classList.add('label-hidden');
   content.dataset.printSafe='0';
  }else{
   content.dataset.printSafe='1';
  }
 });
}

function applyPrintSafeBookingLabels(){
 document.querySelectorAll('.booking-block[data-booking-id] .booking-content').forEach(content=>{
  const block=content.closest('.booking-block');
  if(content.dataset.printSafe==='1'){
   content.textContent=content.dataset.fullLabel||'';
   block.classList.remove('label-hidden');
  }else{
   content.textContent='';
   block.classList.add('label-hidden');
  }
 });
}

function startPointerDrag(event){
 const block=event.currentTarget;
 const id=block.dataset.bookingId;
 const booking=state.bookings.find(item=>item.id===id);
 if(!booking)return;
 const mode=event.target.dataset.mode||'move';
 if(event.target.closest('[data-nudge], [data-delete-booking]'))return;
 event.preventDefault();
 selectedId=id;
 const track=block.closest('.day-track');
 const rect=track.getBoundingClientRect();
 drag={id,mode,startX:event.clientX,startY:event.clientY,rect,original:{...booking,lanes:[...booking.lanes]},lastStepX:0,lastStepY:0};
 try{block.setPointerCapture(event.pointerId)}catch(_){}
 track.classList.add('dragging');
 renderSelectionPanel();
}

function onPointerMove(event){
 if(!drag)return;
 event.preventDefault();
 const booking=state.bookings.find(item=>item.id===drag.id);
 if(!booking)return;
 const day=state.days[drag.original.day];
 const viewRange=mins(state.viewEnd)-mins(state.viewStart);
 const deltaX=event.clientX-drag.startX;
 const deltaY=event.clientY-drag.startY;
 const stepX=Math.round((deltaX/drag.rect.width*viewRange)/SNAP);
 const stepY=Math.round(deltaY/(drag.rect.height/state.laneCount));
 if(stepX===drag.lastStepX&&stepY===drag.lastStepY)return;
 drag.lastStepX=stepX;
 drag.lastStepY=stepY;
 const original=drag.original;
 const duration=mins(original.end)-mins(original.start);
 const first=original.lanes[0];
 const last=original.lanes[original.lanes.length-1];
 const span=original.lanes.length;
 let patch={};
 if(drag.mode==='move'){
  const start=clamp(mins(original.start)+stepX*SNAP,mins(day.open),mins(day.close)-duration);
  const firstLane=clamp(first+stepY,1,state.laneCount-span+1);
  patch={start:timeStr(start),end:timeStr(start+duration),lanes:Array.from({length:span},(_,index)=>firstLane+index)};
 }else if(drag.mode==='resize-start')patch={start:timeStr(clamp(mins(original.start)+stepX*SNAP,mins(day.open),mins(original.end)-SNAP))};
 else if(drag.mode==='resize-end')patch={end:timeStr(clamp(mins(original.end)+stepX*SNAP,mins(original.start)+SNAP,mins(day.close)))};
 else if(drag.mode==='resize-top'){
  const firstLane=clamp(first+stepY,1,last);
  patch={lanes:Array.from({length:last-firstLane+1},(_,index)=>firstLane+index)};
 }else if(drag.mode==='resize-bottom'){
  const lastLane=clamp(last+stepY,first,state.laneCount);
  patch={lanes:Array.from({length:lastLane-first+1},(_,index)=>first+index)};
 }
 updateBooking(drag.id,patch,false);
}

function endPointerDrag(){
 if(!drag)return;
 document.querySelectorAll('.day-track.dragging').forEach(track=>track.classList.remove('dragging'));
 drag=null;
 saveAndRender();
}

function safeFilenamePart(value){
 return String(value||'')
  .replace(/[<>:\"/\\|?*\u0000-\u001F]/g,'-')
  .replace(/\s+/g,' ')
  .replace(/-+/g,'-')
  .trim()
  .replace(/[. ]+$/g,'');
}

function suggestedTimetableFilename(){
 const venue=safeFilenamePart(state.venueName||state.subtitle||'Pool');
 const printedTitle=safeFilenamePart(state.title||'Timetable');
 return `${venue||'Pool'}-${printedTitle||'Timetable'}.json`;
}

async function downloadJson(){
 const data=JSON.stringify(state,null,2);
 const blob=new Blob([data],{type:'application/json'});
 const suggestedName=suggestedTimetableFilename();
 try{
  if('showSaveFilePicker' in window){
   const handle=await window.showSaveFilePicker({suggestedName,types:[{description:'Pool timetable file',accept:{'application/json':['.json']}}]});
   const writable=await handle.createWritable();
   await writable.write(blob);
   await writable.close();
   $('status').textContent=`Timetable saved as ${handle.name}`;
   return;
  }
 }catch(error){
  if(error&&error.name==='AbortError'){$('status').textContent='Save cancelled';return}
  console.warn('Native save picker unavailable, using mobile/download fallback',error);
 }
 let filename=prompt('Name this timetable file:',suggestedName);
 if(filename===null){$('status').textContent='Save cancelled';return}
 filename=safeFilenamePart(filename)||suggestedName;
 if(!filename.toLowerCase().endsWith('.json'))filename+='.json';
 const file=new File([blob],filename,{type:'application/json'});
 try{
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
   await navigator.share({files:[file],title:'Save timetable'});
   $('status').textContent=`Timetable shared as ${filename}`;
   return;
  }
 }catch(error){
  if(error&&error.name==='AbortError'){$('status').textContent='Save cancelled';return}
  console.warn('Share sheet unavailable, using browser download',error);
 }
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');
 anchor.href=url;
 anchor.download=filename;
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('status').textContent=`Timetable downloaded as ${filename}`;
}

function uploadJson(event){
 const file=event.target.files[0];
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const data=JSON.parse(reader.result);
   if(!Array.isArray(data.bookings))throw new Error();
   normalizeState(data);
   selectedId=null;
   syncInputs();
   resetForm();
   saveAndRender();
   $('status').textContent=`Timetable uploaded: ${file.name}`;
  }catch(_){
   alert('That file is not a valid timetable file.');
  }
 };
 reader.readAsText(file);
 event.target.value='';
}
