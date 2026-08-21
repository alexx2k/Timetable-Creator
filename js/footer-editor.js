/* Quick footer fields and optional modal Markdown editing. */

const TIMETABLE_EDITING_KEYS=new Set(['ArrowLeft','ArrowRight','Delete']);
document.addEventListener('keydown',event=>{
 if(!TIMETABLE_EDITING_KEYS.has(event.key)||!isEditingText(event.target))return;
 event.stopImmediatePropagation();
});

let footerEditorReturnFocus=null;

function footerPolicyWithRatioBreak(value=''){
 const text=String(value||'').replace(/\r\n?/g,'\n');
 const marker='Parent/child ratios:';
 const markerIndex=text.toLowerCase().indexOf(marker.toLowerCase());
 if(markerIndex<=0)return text;
 const before=text.slice(0,markerIndex).replace(/[ \t]+$/,'');
 if(before.endsWith('\n'))return text;
 return `${before}\n${text.slice(markerIndex)}`;
}

function footerNormalizePolicyLayout(current=state){
 current.admissionsPolicy=footerPolicyWithRatioBreak(current.admissionsPolicy||'');
 uiEnsureFooterMarkdownState(current);
 current.footerPolicyMarkdown=footerPolicyWithRatioBreak(current.footerPolicyMarkdown||'');
 return current;
}

function footerQuickContactMarkdown(){
 const name=$('venueNameInput').value.trim();
 const details=$('venueAddressInput').value.trim();
 return [name?`**${name}**`:'',details].filter(Boolean).join('\n');
}

function footerQuickPolicyMarkdown(){
 const policy=footerPolicyWithRatioBreak($('admissionsPolicyInput').value.trim());
 return ['**Admission policy**',policy].filter(Boolean).join('\n');
}

function footerPlainLine(value=''){
 return String(value)
  .replace(/^\s*[-*]\s+/,'')
  .replace(/^\s*\d+[.)]\s+/,'')
  .replace(/\*\*(.+?)\*\*/g,'$1')
  .replace(/__(.+?)__/g,'$1')
  .replace(/~~(.+?)~~/g,'$1')
  .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g,'$1$2')
  .replace(/(^|[^_])_([^_]+)_(?!_)/g,'$1$2')
  .trim();
}

function footerStateFromMarkdown(current=state){
 footerNormalizePolicyLayout(current);
 const contactLines=String(current.footerContactMarkdown||'')
  .replace(/\r\n?/g,'\n')
  .split('\n')
  .map(footerPlainLine)
  .filter(Boolean);
 const policyLines=String(current.footerPolicyMarkdown||'')
  .replace(/\r\n?/g,'\n')
  .split('\n')
  .map(footerPlainLine);

 current.venueName=contactLines.shift()||'';
 current.venueAddress=contactLines.join(' · ');
 if((policyLines[0]||'').toLowerCase()==='admission policy')policyLines.shift();
 while(policyLines.length&&!policyLines[0])policyLines.shift();
 while(policyLines.length&&!policyLines[policyLines.length-1])policyLines.pop();
 current.admissionsPolicy=policyLines.join('\n');
 return current;
}

function footerSyncQuickInputs(){
 if($('venueNameInput'))$('venueNameInput').value=state.venueName||'';
 if($('venueAddressInput'))$('venueAddressInput').value=state.venueAddress||'';
 if($('admissionsPolicyInput'))$('admissionsPolicyInput').value=state.admissionsPolicy||'';
}

function footerSyncMarkdownFromQuick(event){
 if(event.target.id==='venueNameInput'||event.target.id==='venueAddressInput'){
  state.footerContactMarkdown=footerQuickContactMarkdown();
 }
 if(event.target.id==='admissionsPolicyInput'){
  state.footerPolicyMarkdown=footerQuickPolicyMarkdown();
 }
}

function footerOpenMarkdownEditor(){
 footerNormalizePolicyLayout();
 footerEditorReturnFocus=document.activeElement;
 $('footerContactMarkdownInput').value=state.footerContactMarkdown||'';
 $('footerPolicyMarkdownInput').value=state.footerPolicyMarkdown||'';
 const overlay=$('footerMarkdownOverlay');
 overlay.classList.add('open');
 overlay.setAttribute('aria-hidden','false');
 document.body.classList.add('footer-editor-open');
 setTimeout(()=>$('footerContactMarkdownInput').focus(),0);
}

function footerCloseMarkdownEditor(){
 const overlay=$('footerMarkdownOverlay');
 overlay.classList.remove('open');
 overlay.setAttribute('aria-hidden','true');
 document.body.classList.remove('footer-editor-open');
 $('footerContactMarkdownInput').value=state.footerContactMarkdown||'';
 $('footerPolicyMarkdownInput').value=state.footerPolicyMarkdown||'';
 if(footerEditorReturnFocus?.focus)footerEditorReturnFocus.focus();
 footerEditorReturnFocus=null;
}

function footerApplyMarkdownEditor(){
 state.footerContactMarkdown=$('footerContactMarkdownInput').value;
 state.footerPolicyMarkdown=$('footerPolicyMarkdownInput').value;
 footerStateFromMarkdown();
 footerSyncQuickInputs();
 saveAndRender();
 footerCloseMarkdownEditor();
}

function footerBindMarkdownToolbar(){
 document.querySelectorAll('[data-footer-md-action]').forEach(button=>button.addEventListener('click',()=>{
  uiApplyMarkdown(button.dataset.footerMdTarget,button.dataset.footerMdAction);
 }));
}

footerNormalizePolicyLayout();
footerStateFromMarkdown();

const normalizeStateBeforeFooterEditor=normalizeState;
normalizeState=function(candidate={}){
 const result=normalizeStateBeforeFooterEditor(candidate);
 footerStateFromMarkdown(state);
 return result;
};

const makeNewStateFromWizardBeforeFooterEditor=makeNewStateFromWizard;
makeNewStateFromWizard=function(){
 const next=makeNewStateFromWizardBeforeFooterEditor();
 footerStateFromMarkdown(next);
 return next;
};

const toV2FileBeforeFooterEditor=toV2File;
toV2File=function(current=state){
 footerNormalizePolicyLayout(current);
 const file=toV2FileBeforeFooterEditor(current);
 file.app.version='2.2';
 return file;
};

const bindBeforeFooterEditor=bind;
bind=function(){
 bindBeforeFooterEditor();

 ['venueNameInput','venueAddressInput','admissionsPolicyInput'].forEach(id=>{
  $(id).addEventListener('input',footerSyncMarkdownFromQuick,{capture:true});
 });

 ['footerContactMarkdownInput','footerPolicyMarkdownInput'].forEach(id=>{
  $(id).addEventListener('input',event=>event.stopImmediatePropagation(),{capture:true});
 });

 $('editFooterMarkdownBtn').addEventListener('click',footerOpenMarkdownEditor);
 $('closeFooterMarkdownBtn').addEventListener('click',footerCloseMarkdownEditor);
 $('cancelFooterMarkdownBtn').addEventListener('click',footerCloseMarkdownEditor);
 $('applyFooterMarkdownBtn').addEventListener('click',footerApplyMarkdownEditor);
 $('footerMarkdownOverlay').addEventListener('click',event=>{
  if(event.target===$('footerMarkdownOverlay'))footerCloseMarkdownEditor();
 });
 footerBindMarkdownToolbar();
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('footerMarkdownOverlay').classList.contains('open')){
   event.preventDefault();
   footerCloseMarkdownEditor();
  }
 });
};
