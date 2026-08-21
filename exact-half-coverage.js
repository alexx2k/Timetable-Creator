/* Exact half-pool booking support, including odd lane counts. */
function exactHalfCoverageNote(laneCount=state.laneCount){
 const count=clamp(Number(laneCount)||1,1,12);
 return count%2
  ? `With ${count} lanes, the centre lane is split at its midpoint so Top half and Bottom half each cover exactly 50% of the pool.`
  : 'Top half and Bottom half each cover exactly 50% of the pool.';
}

function updateExactHalfHints(){
 document.querySelectorAll('option[value="half-first"]').forEach(option=>option.textContent='Top half — exactly 50%');
 document.querySelectorAll('option[value="half-second"]').forEach(option=>option.textContent='Bottom half — exactly 50%');

 const fineSelect=$('fineCoverageMode');
 if(fineSelect){
  let note=$('fineCoverageNote');
  if(!note){
   note=document.createElement('div');
   note.id='fineCoverageNote';
   note.className='pool-area-note';
   fineSelect.closest('.field')?.appendChild(note);
  }
  if(note)note.textContent=exactHalfCoverageNote();
 }

 const formNote=document.querySelector('#coverageModeInput + .pool-area-note');
 if(formNote)formNote.textContent=exactHalfCoverageNote();

 const laneField=$('wizardLaneCount')?.closest('.field');
 if(laneField){
  let hint=$('wizardHalfCoverageHint');
  if(!hint){
   hint=document.createElement('div');
   hint.id='wizardHalfCoverageHint';
   hint.className='pool-area-note';
   laneField.appendChild(hint);
  }
  hint.textContent=exactHalfCoverageNote($('wizardLaneCount').value);
 }

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
 updateExactHalfHints();
 return result;
};

const renderAllBeforeExactHalfCoverage=renderAll;
renderAll=function(){
 const result=renderAllBeforeExactHalfCoverage();
 updateExactHalfHints();
 return result;
};

const openCreatorWizardBeforeExactHalfCoverage=openCreatorWizard;
openCreatorWizard=function(){
 const result=openCreatorWizardBeforeExactHalfCoverage();
 updateExactHalfHints();
 return result;
};

$('wizardLaneCount')?.addEventListener('input',updateExactHalfHints);

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
  ['half-first','Top half — exactly 50%','⬒'],
  ['half-second','Bottom half — exactly 50%','⬓']
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

renderAll();
