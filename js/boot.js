document.body.classList.remove('startup-mode');

const uiStylesheet=document.createElement('link');
uiStylesheet.rel='stylesheet';
uiStylesheet.href='css/ui.css';
document.head.appendChild(uiStylesheet);

const uiScript=document.createElement('script');
uiScript.src='js/ui.js';
uiScript.onload=()=>init();
uiScript.onerror=()=>init();
document.head.appendChild(uiScript);
