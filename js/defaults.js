const CURRENT_DEFAULT_SESSION_TYPES=[
 {id:'public-swimming',name:'Public Swimming',defaultTitle:'Public Swimming',colour:'#b6defb'},
 {id:'lane-swimming',name:'Lane Swimming',defaultTitle:'Lane Swimming',colour:'#7cbbdf'},
 {id:'lessons',name:'Lessons',defaultTitle:'Swimming Lessons',colour:'#0071db'},
 {id:'club-booking',name:'Club Booking',defaultTitle:'Club Booking',colour:'#f4e32a'},
 {id:'aqua-class',name:'Aqua Class',defaultTitle:'Aqua Class',colour:'#91c9a8'},
 {id:'closure',name:'Pool Closure',defaultTitle:'CLOSED',colour:'#c9ced2'},
 {id:'pool-party',name:'Pool Party',defaultTitle:'Pool Party',colour:'#ff24f8'}
];

DEFAULT_SESSION_TYPES.splice(0,DEFAULT_SESSION_TYPES.length,...CURRENT_DEFAULT_SESSION_TYPES.map(type=>({...type})));
Object.assign(LEGACY_COLOURS,{
 'Public Swimming':'#b6defb',
 'Lane Swimming':'#7cbbdf',
 'Lessons':'#0071db',
 'Club Booking':'#f4e32a',
 'Aqua Class':'#91c9a8',
 'Closed':'#c9ced2',
 'Pool Party':'#ff24f8'
});
state.sessionTypes=CURRENT_DEFAULT_SESSION_TYPES.map(type=>({...type}));

function ensureBookingTypeResetButton(){
 if($('resetBookingTypesBtn'))return;
 const list=$('sessionTypesList');
 if(!list)return;
 const actions=document.createElement('div');
 actions.className='form-actions booking-type-reset-actions';
 const button=document.createElement('button');
 button.id='resetBookingTypesBtn';
 button.type='button';
 button.className='secondary';
 button.textContent='Reset to defaults';
 button.addEventListener('click',resetBookingTypesToDefaults);
 actions.appendChild(button);
 list.after(actions);
}

function resetBookingTypesToDefaults(){
 const defaultIds=new Set(CURRENT_DEFAULT_SESSION_TYPES.map(type=>type.id));
 const removedIds=new Set(state.sessionTypes.filter(type=>!defaultIds.has(type.id)).map(type=>type.id));
 const customTypeCount=removedIds.size;
 const affectedBookings=state.bookings.filter(booking=>removedIds.has(booking.sessionTypeId)).length;

 let message='Reset booking types to the seven defaults?\n\nAny changes to the standard booking types will be replaced.';
 if(customTypeCount)message+=`\n\n${customTypeCount} booking type${customTypeCount===1?'':'s'} you created will be removed.`;
 if(affectedBookings)message+=`\n\n${affectedBookings} existing booking${affectedBookings===1?'':'s'} using those removed types will become Custom. Their current title and colour will be kept.`;
 if(!confirm(message))return;

 state.bookings=state.bookings.map(booking=>removedIds.has(booking.sessionTypeId)?{...booking,sessionTypeId:'',sessionTypeName:'Custom'}:booking);
 state.sessionTypes=CURRENT_DEFAULT_SESSION_TYPES.map(type=>({...type}));
 resetSessionTypeForm();
 renderSessionTypeControls();
 saveAndRender();
 if($('status'))$('status').textContent='Booking types reset to defaults';
}

deleteSessionType=function(id){
 const type=sessionTypeById(id);
 if(!type)return;
 const used=state.bookings.filter(booking=>booking.sessionTypeId===id).length;
 const message=used
  ?`Delete the “${type.name}” booking type?\n\n${used} existing booking${used===1?'':'s'} will become Custom. Their current title and colour will be kept, but they will no longer use this reusable booking type.`
  :`Delete the “${type.name}” booking type?`;
 if(!confirm(message))return;
 state.bookings=state.bookings.map(booking=>booking.sessionTypeId===id?{...booking,sessionTypeId:'',sessionTypeName:'Custom'}:booking);
 state.sessionTypes=state.sessionTypes.filter(type=>type.id!==id);
 if(sessionTypeEditId===id)resetSessionTypeForm();
 renderSessionTypeControls();
 saveAndRender();
};

const bindBeforeBookingTypeSafety=bind;
bind=function(){
 bindBeforeBookingTypeSafety();
 ensureBookingTypeResetButton();
};
