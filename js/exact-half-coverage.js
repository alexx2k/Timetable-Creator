/* Exact half-pool booking support, including odd lane counts. */
function updateExactHalfLabels(){
 document.querySelectorAll('option[value="half-first"]').forEach(option=>option.textContent='Top half');
 document.querySelectorAll('option[value="half-second"]').forEach(option=>option.textContent='Bottom half');

 $('fineCoverageNote')?.remove();
 $('wizardHalfCoverageHint')?.remove();
 document.querySelector('#coverageModeInput + .pool-area-note')?.remove();

 document.querySelectorAll('.booking-block[data-booking-id]').forEach(block=>{
  const booking=state.bookings.find(item=>item.id===block.dataset.bookingId);
  if(!booking)return;
  if(coverageMode(booking)==='half-first')block.title=(block.title||'').replace('Lane 1 side half','Top half');
  if(coverageMode(booking)==='half-second')block.title=(block.title||'').replace('Opposite side half','Bottom half');
 });
}

function applyExactCoverageToSelection(mode){
 if(!['all','half-first','half-second'].includes(mode))return;
 const ids=selectedIds.size?new Set(selectedIds):new Set(selectedId?[selectedId]:[]);
 if(!ids.size)return;
 const allLanes=Array.from({length:state.laneCount},(_,index)=>index+1);
 state.bookings=state.bookings.map(booking=>ids.has(booking.id)?{...booking,coverageMode:mode,lanes:[...allLanes]}:booking);
 hideBookingContextMenu();
 saveAndRender();
}

const renderSelectionPanelBeforeExactHalfCoverage=renderSelectionPanel;
renderSelectionPanel=function(){
 const result=renderSelectionPanelBeforeExactHalfCoverage();
 updateExactHalfLabels();
 return result;
};

const renderAllBeforeExactHalfCoverage=renderAll;
renderAll=function(){
 const result=renderAllBeforeExactHalfCoverage();
 updateExactHalfLabels();
 return result;
};

const openCreatorWizardBeforeExactHalfCoverage=openCreatorWizard;
openCreatorWizard=function(){
 const result=openCreatorWizardBeforeExactHalfCoverage();
 updateExactHalfLabels();
 return result;
};

const showBookingContextMenuBeforeExactHalfCoverage=showBookingContextMenu;
showBookingContextMenu=function(event,id){
 showBookingContextMenuBeforeExactHalfCoverage(event,id);
 const menu=$('bookingContextMenu');
 if(!menu||menu.hidden)return;
 const deleteButton=menu.querySelector('[data-menu-delete]');
 if(!deleteButton)return;

 const divider=document.createElement('div');
 divider.className='context-menu-divider';
 const heading=document.createElement('div');
 heading.className='context-menu-title';
 heading.textContent='Pool area';
 deleteButton.before(divider,heading);

 const options=[
  ['all','Whole pool','▰'],
  ['half-first','Top half','⬒'],
  ['half-second','Bottom half','⬓']
 ];
 options.forEach(([mode,label,icon])=>{
  const button=document.createElement('button');
  button.className='context-menu-item';
  button.type='button';
  button.innerHTML=`<span class="menu-icon" aria-hidden="true">${icon}</span>${label}`;
  button.addEventListener('click',()=>applyExactCoverageToSelection(mode));
  deleteButton.before(button);
 });
};
