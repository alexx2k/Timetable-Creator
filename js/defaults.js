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
