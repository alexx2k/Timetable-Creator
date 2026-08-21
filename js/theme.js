const THEME_STORAGE_KEY='timetableCreatorTheme';

function applyAppTheme(theme,{persist=true}={}){
 const isDark=theme==='dark';
 document.documentElement.dataset.theme=isDark?'dark':'light';
 const toggle=$('themeToggle');
 if(toggle){
  toggle.setAttribute('aria-checked',String(isDark));
  toggle.setAttribute('aria-label',isDark?'Use light mode':'Use dark mode');
  toggle.title=isDark?'Use light mode':'Use dark mode';
 }
 if(persist){
  try{localStorage.setItem(THEME_STORAGE_KEY,isDark?'dark':'light')}catch(_){}
 }
}

function initThemeToggle(){
 let saved='light';
 try{saved=localStorage.getItem(THEME_STORAGE_KEY)==='dark'?'dark':'light'}catch(_){}
 applyAppTheme(saved,{persist:false});
 $('themeToggle')?.addEventListener('click',()=>applyAppTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
}

const initBeforeTheme=init;
init=function(){
 initBeforeTheme();
 initThemeToggle();
 if(selectedId)selectedIds.add(selectedId);
 resetHistory();
 updateFileStateIndicator();
 applySelectionAndConflictStyles();
};
