/* Keep timetable keyboard shortcuts out of editable controls. */

const TIMETABLE_EDITING_KEYS=new Set(['ArrowLeft','ArrowRight','Delete']);

document.addEventListener('keydown',event=>{
 if(!TIMETABLE_EDITING_KEYS.has(event.key)||!isEditingText(event.target))return;
 event.stopImmediatePropagation();
});
