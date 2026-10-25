const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'..'),app=fs.readFileSync(base+'/assets/js/app.js','utf8');
const notificationCode=app.slice(app.indexOf('function initNotifCenter()'),app.indexOf('/* ---------- نظرة سريعة'));
const userStart=app.indexOf("  const um = $('userMenu');"),userCode=app.slice(userStart,app.indexOf('\n}',userStart));
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(role='مدير'){
 const dom=new JSDOM(fs.readFileSync(base+'/index.html','utf8'),{runScripts:'outside-only',url:'https://header.test/'}),w=dom.window,d=w.document;
 let seen='2026-10-25T00:00:00.000Z',marks=0,purges=0;
 w.SonoAuth={user:()=>({id:'preview',name:'مستخدم المعاينة',role}),mode:()=> 'supabase',client:()=>({})};
 w.SonoRoles={normalize:r=>r,isSuper:u=>u.role==='سوبر أدمن'};
 w.SonoNotify={list:async()=>[{actor_name:'معاينة',message:'إشعار معاينة <script> وليس كودًا',created_at:'2026-10-26T00:00:00.000Z'}],lastSeen:()=>seen,markSeen:()=>{marks++;seen='2026-10-26T01:00:00.000Z';},subscribe(){},purge:async()=>{purges++;return {deleted:0};},getRetention:()=>({mode:'days',value:90})};
 w.eval('(function(root){const AU=root.SonoAuth,RO=root.SonoRoles,$=id=>document.getElementById(id);'+userCode+notificationCode+';initNotifCenter();})(window)');
 w.eval(fs.readFileSync(base+'/assets/js/header-ui.js','utf8'));w.SonoHeader.init();
 return {dom,w,d,counts:()=>({marks,purges})};
}
(async()=>{
 const {dom,w,d,counts}=fixture();await tick();
 const bell=d.getElementById('btnNotif'),menu=d.getElementById('notifMenu'),user=d.getElementById('btnUser');
 assert(bell.querySelector('svg'));assert(!bell.textContent.includes('🔔'));
 assert.equal(d.getElementById('notifWrap').hidden,false);assert.equal(d.getElementById('notifBadge').textContent,'1');assert(bell.getAttribute('aria-label').includes('1'));
 bell.click();await tick();assert.equal(bell.getAttribute('aria-expanded'),'true');assert.equal(counts().marks,1);assert(d.getElementById('notifBadge').classList.contains('hide'),'opening hides the counter after async refresh');
 assert.equal(menu.querySelectorAll('script').length,0);assert(menu.textContent.includes('<script>'),'notification text stays escaped');assert(menu.querySelector('.notifItem.unread'),'opening does not erase unread highlight');
 user.click();await tick();assert(menu.classList.contains('hide'));assert.equal(bell.getAttribute('aria-expanded'),'false');assert.equal(user.getAttribute('aria-expanded'),'true');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.activeElement,user);assert.equal(user.getAttribute('aria-expanded'),'false');
 bell.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await tick();assert.equal(d.activeElement,d.getElementById('btnNotifAll'));
 d.getElementById('btnNotifAll').click();await tick();assert(!d.getElementById('notifPage').classList.contains('hide'));
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(d.getElementById('notifPage').classList.contains('hide'));assert.equal(d.activeElement,bell);
 user.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await tick();assert.equal(d.activeElement,d.getElementById('btnPass'));
 d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(d.activeElement,d.getElementById('btnOut'));
 d.body.click();await tick();assert.equal(user.getAttribute('aria-expanded'),'false');assert.equal(d.getElementById('btnAdmin').hidden,true,'styling does not grant admin access');
 assert.equal(counts().purges,1,'existing retention behavior is unchanged');dom.window.close();
 const denied=fixture('محاسب');await tick();assert.equal(denied.d.getElementById('notifWrap').hidden,true);assert.equal(denied.counts().purges,0);denied.dom.window.close();
 console.log('PASS header notification role gate, unread state, escaped content, exclusive menus, keyboard access, Escape/focus and unchanged retention');
})().catch(e=>{console.error(e);process.exit(1)});
