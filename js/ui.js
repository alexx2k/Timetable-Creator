/* User-facing interface, startup flow and printable footer editing. */

function uiContactMarkdown(current=state){
 const parts=String(current.venueAddress||'').split('·').map(part=>part.trim()).filter(Boolean);
 const lines=[];
 const name=String(current.venueName||current.subtitle||'').trim();
 if(name)lines.push(`**${name}**`);
 lines.push(...parts);
 return lines.join('\n');
}

function uiPolicyMarkdown(current=state){
 const policy=String(current.admissionsPolicy||'').trim();
 return ['**Admission policy**',policy].filter(Boolean).join('\n');
}

function uiEnsureFooterMarkdownState(current=state){
 if(!Object.prototype.hasOwnProperty.call(current,'footerContactMarkdown'))current.footerContactMarkdown=uiContactMarkdown(current);
 if(!Object.prototype.hasOwnProperty.call(current,'footerPolicyMarkdown'))current.footerPolicyMarkdown=uiPolicyMarkdown(current);
 return current;
}

function uiInlineMarkdown(value){
 let text=escapeHtml(value);
 text=text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
 text=text.replace(/__(.+?)__/g,'<strong>$1</strong>');
 text=text.replace(/~~(.+?)~~/g,'<del>$1</del>');
 text=text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
 text=text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g,'$1<em>$2</em>');
 return text;
}

function uiRenderMarkdown(markdown){
 const lines=String(markdown||'').replace(/\r\n?/g,'\n').split('\n');
 let html='';
 let list=null;
 const closeList=()=>{
  if(!list)return;
  html+=`</${list}>`;
  list=null;
 };
 for(const rawLine of lines){
  const bullet=rawLine.match(/^\s*[-*]\s+(.+)$/);
  const numbered=rawLine.match(/^\s*\d+[.)]\s+(.+)$/);
  if(bullet||numbered){
   const nextList=bullet?'ul':'ol';
   if(list!==nextList){closeList();list=nextList;html+=`<${list}>`}
   html+=`<li>${uiInlineMarkdown((bullet||numbered)[1])}</li>`;
   continue;
  }
  closeList();
  if(!rawLine.trim())html+='<div class="markdown-spacer"></div>';
  else html+=`<div class="markdown-line">${uiInlineMarkdown(rawLine)}</div>`;
 }
 closeList();
 return html;
}

function uiMarkdownToolbar(textareaId){
 const toolbar=document.createElement('div');
 toolbar.className='markdown-toolbar';
 toolbar.innerHTML=`
  <button type="button" data-md="bold" title="Bold" aria-label="Bold"><strong>B</strong></button>
  <button type="button" data-md="italic" title="Italic" aria-label="Italic"><em>I</em></button>
  <button type="button" data-md="list" title="Bulleted list" aria-label="Bulleted list">• List</button>`;
 toolbar.querySelectorAll('[data-md]').forEach(button=>button.addEventListener('click',()=>uiApplyMarkdown(textareaId,button.dataset.md)));
 return toolbar;
}

function uiApplyMarkdown(textareaId,action){
 const textarea=$(textareaId);
 if(!textarea)return;
 const start=textarea.selectionStart;
 const end=textarea.selectionEnd;
 const value=textarea.value;
 let selected=value.slice(start,end);
 let replacement='';
 if(action==='bold')replacement=`**${selected||'text'}**`;
 else if(action==='italic')replacement=`*${selected||'text'}*`;
 else if(action==='list'){
  selected=selected||'item';
  replacement=selected.split('\n').map(line=>`- ${line.replace(/^\s*[-*]\s+/,'')}`).join('\n');
 }
 textarea.setRangeText(replacement,start,end,'select');
 textarea.focus();
 textarea.dispatchEvent(new Event('input',{bubbles:true}));
}

function uiCreateMarkdownField(id,label){
 const field=document.createElement('div');
 field.className='field footer-field markdown-field';
 field.innerHTML=`<label for="${id}">${label}</label><textarea id="${id}" spellcheck="true"></textarea>`;
 field.insertBefore(uiMarkdownToolbar(id),field.querySelector('textarea'));
 return field;
}

function uiEnsureFooterEditors(){
 if($('footerContactMarkdownInput')&&$('footerPolicyMarkdownInput'))return;
 uiEnsureFooterMarkdownState();
 const footerHeading=[...document.querySelectorAll('.settings-subheading')].find(node=>node.textContent.trim()==='Printed footer details');
 if(footerHeading)footerHeading.textContent='Footer';
 const venueNameField=$('venueNameInput')?.closest('.field');
 const venueAddressField=$('venueAddressInput')?.closest('.field');
 const policyField=$('admissionsPolicyInput')?.closest('.field');
 if(venueNameField)venueNameField.hidden=true;
 if(venueAddressField)venueAddressField.hidden=true;
 if(policyField)policyField.hidden=true;
 const anchor=policyField||venueAddressField||venueNameField||footerHeading;
 if(!anchor)return;
 const contact=uiCreateMarkdownField('footerContactMarkdownInput','Contact details (Markdown)');
 const policy=uiCreateMarkdownField('footerPolicyMarkdownInput','Admission policy (Markdown)');
 anchor.after(contact,policy);
 contact.querySelector('textarea').value=state.footerContactMarkdown||'';
 policy.querySelector('textarea').value=state.footerPolicyMarkdown||'';
}

function uiSyncFooterEditors(){
 uiEnsureFooterMarkdownState();
 uiEnsureFooterEditors();
 if($('footerContactMarkdownInput')&&document.activeElement!==$('footerContactMarkdownInput'))$('footerContactMarkdownInput').value=state.footerContactMarkdown||'';
 if($('footerPolicyMarkdownInput')&&document.activeElement!==$('footerPolicyMarkdownInput'))$('footerPolicyMarkdownInput').value=state.footerPolicyMarkdown||'';
}

function uiRenderFooter(){
 uiEnsureFooterMarkdownState();
 const policy=$('sheet')?.querySelector('.policy-block');
 const contact=$('sheet')?.querySelector('.address-block');
 if(policy)policy.innerHTML=uiRenderMarkdown(state.footerPolicyMarkdown);
 if(contact)contact.innerHTML=uiRenderMarkdown(state.footerContactMarkdown);
}

function uiSimplifyStaticInterface(){
 $('startScreen')?.setAttribute('aria-hidden','true');
 if($('homeBtn'))$('homeBtn').hidden=true;
 const settingsSummary=$('settingsPanel')?.querySelector('summary');
 if(settingsSummary)settingsSummary.textContent='Settings';
 const printedTitleLabel=document.querySelector('label[for="titleInput"]');
 if(printedTitleLabel)printedTitleLabel.textContent='Timetable title';
 const subtitleLabel=document.querySelector('label[for="subtitleInput"]');
 if(subtitleLabel)subtitleLabel.textContent='Subtitle';
 const projectLabel=document.querySelector('label[for="projectNameInput"]');
 if(projectLabel)projectLabel.textContent='Timetable name';
 const openingHeading=[...document.querySelectorAll('.settings-subheading')].find(node=>node.textContent.trim()==='Opening hours by day');
 if(openingHeading)openingHeading.textContent='Opening hours';
 const rangeTitle=document.querySelector('.auto-range-card strong');
 if(rangeTitle)rangeTitle.textContent='Timetable range';
 document.querySelector('.auto-range-card > div > span')?.setAttribute('hidden','');
 document.querySelectorAll('.editor-panel .help').forEach(node=>node.hidden=true);
 const sessionName=document.querySelector('label[for="sessionTypeNameInput"]');
 if(sessionName)sessionName.textContent='Name';
 const sessionTitle=document.querySelector('label[for="sessionTypeTitleInput"]');
 if(sessionTitle)sessionTitle.textContent='Default title';
 const sessionColour=document.querySelector('label[for="sessionTypeColourInput"]');
 if(sessionColour)sessionColour.textContent='Colour';
 const selectionTitle=$('selectionPanel')?.querySelector('.panel-title');
 if(selectionTitle?.firstChild)selectionTitle.firstChild.textContent='Booking ';
 const previewTitle=document.querySelector('.preview-panel > .panel-title');
 if(previewTitle)previewTitle.textContent='Timetable';
 const quickCopy=$('quickTypeBar')?.querySelector('.floating-menu-heading span');
 if(quickCopy)quickCopy.hidden=true;
 if($('wizardTitle'))$('wizardTitle').textContent='New timetable';
 document.querySelectorAll('.wizard-step > .step-copy').forEach(node=>node.hidden=true);
 if($('printBtn'))$('printBtn').textContent='Print / PDF';
}

function uiSimplifySelectionPanel(){
 const empty=$('selectionBody')?.querySelector('.selection-empty');
 if(empty)empty.textContent='Drag on the timetable to add a booking, or select one to edit it.';
 const activity=document.querySelector('label[for="fineActivity"]');
 if(activity)activity.textContent='Title';
 document.querySelectorAll('#selectionBody .interaction-help,#selectionBody .multi-help,#selectionBody .color-field .help').forEach(node=>node.remove());
 const summary=$('selectionBody')?.querySelector('.multi-selection-summary');
 if(summary&&selectedIds?.size>1)summary.innerHTML=`<strong>${selectedIds.size} bookings selected.</strong><br>Drag a selected booking to move the group.`;
 document.querySelectorAll('#selectionBody .overlap-warning strong').forEach(node=>node.textContent='Overlap');
}

uiEnsureFooterMarkdownState();
uiSimplifyStaticInterface();

const normalizeStateBeforeUi=normalizeState;
normalizeState=function(candidate={}){
 const result=normalizeStateBeforeUi(candidate);
 const footer=candidate?.timetable?.footer||candidate?.footer||{};
 const contact=footer.contactMarkdown??candidate?.footerContactMarkdown;
 const policy=footer.policyMarkdown??candidate?.footerPolicyMarkdown;
 if(contact!==undefined)state.footerContactMarkdown=String(contact);
 else state.footerContactMarkdown=uiContactMarkdown(state);
 if(policy!==undefined)state.footerPolicyMarkdown=String(policy);
 else state.footerPolicyMarkdown=uiPolicyMarkdown(state);
 return result;
};

const toV2FileBeforeUi=toV2File;
toV2File=function(current=state){
 uiEnsureFooterMarkdownState(current);
 const file=toV2FileBeforeUi(current);
 file.app.version='2.1';
 file.timetable.footer={contactMarkdown:current.footerContactMarkdown||'',policyMarkdown:current.footerPolicyMarkdown||''};
 return file;
};

const makeNewStateFromWizardBeforeUi=makeNewStateFromWizard;
makeNewStateFromWizard=function(){
 const next=makeNewStateFromWizardBeforeUi();
 next.footerContactMarkdown=uiContactMarkdown(next);
 next.footerPolicyMarkdown=uiPolicyMarkdown(next);
 return next;
};

const applyCentrePresetBeforeUi=applyCentrePreset;
applyCentrePreset=function(){
 const id=$('centreInput')?.value;
 const preset=CENTRES[id];
 if(preset&&id!=='custom'){
  state.footerContactMarkdown=[`**${preset.venueName}**`,preset.address,preset.phone].filter(Boolean).join('\n');
 }
 return applyCentrePresetBeforeUi();
};

const showStartScreenBeforeUi=showStartScreen;
showStartScreen=function(){
 document.body.classList.remove('startup-mode');
 $('setupWizard')?.classList.remove('open');
 openCreatorWizard();
};

const setWizardStepBeforeUi=setWizardStep;
setWizardStep=function(step){
 const result=setWizardStepBeforeUi(step);
 const labels=['Project','Pool','Opening hours'];
 if($('wizardSubtitle'))$('wizardSubtitle').textContent=labels[wizardStep];
 if($('wizardFooterCopy'))$('wizardFooterCopy').textContent=`${wizardStep+1} / 3`;
 if($('wizardNextBtn'))$('wizardNextBtn').textContent=wizardStep===2?'Create':'Next';
 return result;
};

const syncInputsBeforeUi=syncInputs;
syncInputs=function(){
 const result=syncInputsBeforeUi();
 uiSyncFooterEditors();
 return result;
};

const renderSheetBeforeUi=renderSheet;
renderSheet=function(){
 const result=renderSheetBeforeUi();
 uiRenderFooter();
 return result;
};

const renderListBeforeUi=renderList;
renderList=function(){
 const result=renderListBeforeUi();
 document.querySelectorAll('#bookingsList [data-edit]').forEach(button=>button.textContent='Edit');
 return result;
};

const renderSelectionPanelBeforeUi=renderSelectionPanel;
renderSelectionPanel=function(){
 const result=renderSelectionPanelBeforeUi();
 uiSimplifySelectionPanel();
 return result;
};

const renderAllBeforeUi=renderAll;
renderAll=function(){
 const result=renderAllBeforeUi();
 uiSimplifyStaticInterface();
 uiSyncFooterEditors();
 return result;
};

const renderQuickTypeActionsBeforeUi=renderQuickTypeActions;
renderQuickTypeActions=function(){
 const result=renderQuickTypeActionsBeforeUi();
 const heading=$('quickTypeBar')?.querySelector('.floating-menu-heading strong');
 if(heading)heading.textContent='Booking type';
 return result;
};

const showBookingContextMenuBeforeUi=showBookingContextMenu;
showBookingContextMenu=function(event,id){
 const result=showBookingContextMenuBeforeUi(event,id);
 const menu=$('bookingContextMenu');
 menu?.querySelector('[data-menu-add]')?.remove();
 const only=menu?.querySelector('[data-menu-only]');
 if(only)only.lastChild.textContent='Select only this';
 const copy=menu?.querySelector('[data-menu-copy]');
 if(copy&&selectedIds.size>1)copy.lastChild.textContent='Copy booking';
 return result;
};

const updateFileStateIndicatorBeforeUi=updateFileStateIndicator;
updateFileStateIndicator=function(){
 const result=updateFileStateIndicatorBeforeUi();
 const badge=$('fileState');
 const label=$('fileStateText');
 if(!badge||!label)return result;
 const record=fileRecords[state.projectId];
 const saved=Boolean(record&&record.fingerprint===projectFingerprint());
 label.textContent=saved?'Saved':record?'Unsaved changes':'Not saved';
 badge.title='';
 return result;
};

const updateOverlapIndicatorBeforeUi=updateOverlapIndicator;
updateOverlapIndicator=function(map=conflictMap()){
 const result=updateOverlapIndicatorBeforeUi(map);
 if($('overlapState'))$('overlapState').title='';
 return result;
};

const bindBeforeUi=bind;
bind=function(){
 uiSimplifyStaticInterface();
 uiEnsureFooterEditors();
 bindBeforeUi();
 $('footerContactMarkdownInput')?.addEventListener('input',event=>{
  state.footerContactMarkdown=event.target.value;
  saveAndRender();
 });
 $('footerPolicyMarkdownInput')?.addEventListener('input',event=>{
  state.footerPolicyMarkdown=event.target.value;
  state.admissionsPolicy=event.target.value;
  if($('admissionsPolicyInput'))$('admissionsPolicyInput').value=event.target.value;
  saveAndRender();
 });
};
