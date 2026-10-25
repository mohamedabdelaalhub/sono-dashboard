/* Header presentation and keyboard access. Existing actions and role gates remain in app.js. */
(function(root){
'use strict';
function init(){
  const header=document.querySelector('.swnw-header');
  if(!header||header.dataset.headerReady)return;
  header.dataset.headerReady='true';
  const pairs=[['btnNotif','notifMenu'],['btnUser','userMenu']].map(([button,menu])=>({button:document.getElementById(button),menu:document.getElementById(menu)})).filter(p=>p.button&&p.menu);
  const syncPosition=()=>{const bottom=header.getBoundingClientRect().bottom;if(bottom>0){header.style.setProperty('--swnw-header-bottom',Math.ceil(bottom+10)+'px');pairs.forEach(p=>p.menu.style.setProperty('--swnw-menu-gap',Math.max(10,Math.ceil(bottom-p.button.getBoundingClientRect().bottom+10))+'px'));}};
  const sync=()=>pairs.forEach(p=>p.button.setAttribute('aria-expanded',String(!p.menu.classList.contains('hide'))));
  const close=(p,focus)=>{p.menu.classList.add('hide');p.button.setAttribute('aria-expanded','false');if(focus)p.button.focus();};
  const items=p=>Array.from(p.menu.querySelectorAll('button')).filter(b=>!b.hidden&&!b.disabled&&root.getComputedStyle(b).display!=='none');
  pairs.forEach(p=>{
    new MutationObserver(sync).observe(p.menu,{attributes:true,attributeFilter:['class']});
    p.button.addEventListener('click',()=>{pairs.filter(other=>other!==p).forEach(other=>close(other,false));syncPosition();},true);
    p.button.addEventListener('keydown',event=>{if(event.key!=='ArrowDown')return;event.preventDefault();if(p.menu.classList.contains('hide'))p.button.click();const first=items(p)[0];if(first)first.focus();});
    if(p.menu.id==='userMenu')p.menu.addEventListener('keydown',event=>{
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const buttons=items(p);if(!buttons.length)return;event.preventDefault();
      const index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
      buttons[next].focus();
    });
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const page=document.getElementById('notifPage');
    if(page&&!page.classList.contains('hide')){page.classList.add('hide');document.getElementById('btnNotif').focus();event.preventDefault();return;}
    const open=pairs.find(p=>!p.menu.classList.contains('hide'));if(open){close(open,true);event.preventDefault();}
  });
  root.addEventListener('resize',syncPosition,{passive:true});
  if(root.ResizeObserver)new root.ResizeObserver(syncPosition).observe(header);
  syncPosition();sync();
}
root.SonoHeader={init};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
