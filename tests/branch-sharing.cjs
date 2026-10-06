const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..'),uids=[1,2,3,4,5,6].map(n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'));
(async()=>{
 const pg=new PGlite();await pg.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create table public.admins(user_id uuid,name text,email text,role text,active boolean);create table reports(id uuid primary key,created_by uuid,created_name text,payload jsonb,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.is_super() returns boolean language sql as $$select exists(select 1 from admins where user_id=auth.uid() and role='سوبر أدمن' and active is not false)$$;`);
 for(let i=0;i<uids.length;i++){await pg.query('insert into auth.users values($1)',[uids[i]]);await pg.query('insert into admins values($1,$2,$3,$4,true)',[uids[i],'user'+i,'u'+i+'@test',i===5?'سوبر أدمن':i===0?'مدير':'مستخدم']);}
 const legacyId='10000000-0000-4000-8000-000000000001', legacyDoc={id:'legacy',name:'قديم',sections:[]};
 await pg.query('insert into reports(id,created_by,created_name,payload) values($1,$2,$3,$4)',[legacyId,uids[0],'user0',{kind:'branch-study',study:legacyDoc}]);
 await pg.exec(fs.readFileSync(base+'/supabase/migration-branch-sharing.sql','utf8'));
 assert.equal((await pg.query('select id from branch_studies')).rows[0].id,legacyId);
 assert.equal((await pg.query('select * from reports')).rows.length,0);
 await pg.exec(fs.readFileSync(base+'/supabase/migration-branch-sharing.sql','utf8'));
 await assert.rejects(()=>pg.query('insert into reports(id,payload) values($1,$2)',['10000000-0000-4000-8000-000000000002',{kind:'branch-study',study:legacyDoc}]),/use branch study functions/);
 await pg.query('delete from branch_studies where id=$1',[legacyId]);
 const uid=async i=>pg.query("select set_config('test.uid',$1,false)",[uids[i]]);
 const doc={id:'study',name:'فرع',sections:[{id:'s1',name:'أجهزة',items:[{id:'i1',name:'جهاز',qty:2,unit:100}]}]};
 const call=async (name,args=[])=> (await pg.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
 await uid(0);let r=await call('branch_study_save',[null,doc,null]);const sid=r.id;assert.equal(Number(r.total),200);assert.equal(r.permission,'owner');
 for(const [i,p] of [[1,'view'],[2,'add'],[3,'edit'],[4,'full']])await call('branch_study_share',[sid,uids[i],p]);
 await uid(1);assert.equal((await call('branch_studies_list')).length,1);await assert.rejects(()=>call('branch_study_save',[sid,doc,1]),/permission denied/);await assert.rejects(()=>call('branch_study_delete',[sid]),/permission denied/);
 await uid(2);let added=structuredClone(doc);added.sections[0].items.push({id:'i2',name:'كرسي',qty:1,unit:50});let bad=structuredClone(added);bad.sections[0].items[0].unit=1;await assert.rejects(()=>call('branch_study_save',[sid,bad,1]),/permission denied/);r=await call('branch_study_save',[sid,added,1]);assert.equal(Number(r.total),250);
 await uid(3);bad=structuredClone(added);bad.sections[0].items.pop();await assert.rejects(()=>call('branch_study_save',[sid,bad,2]),/permission denied/);let edited=structuredClone(added);edited.sections[0].items[0].unit=200;r=await call('branch_study_save',[sid,edited,2]);assert.equal(Number(r.total),450);await assert.rejects(()=>call('branch_study_save',[sid,edited,2]),/version conflict/);
 await uid(4);bad=structuredClone(edited);bad.sections=[];await call('branch_study_save',[sid,bad,3]);await assert.rejects(()=>call('branch_study_share',[sid,uids[1],'full']),/permission denied/);await assert.rejects(()=>call('branch_study_delete',[sid]),/permission denied/);
 await uid(5);assert.equal((await call('branch_studies_list'))[0].permission,'owner');await call('branch_study_share',[sid,uids[1],null]);await uid(1);assert.equal((await call('branch_studies_list')).length,0);
 await pg.query('update admins set active=false where user_id=$1',[uids[2]]);await uid(2);assert.equal((await call('branch_studies_list')).length,0);await assert.rejects(()=>call('branch_study_save',[null,doc,null]),/permission denied/);
 await uid(0);for(const broken of [{},{name:'x',sections:[{id:'x',name:'x',items:[{id:'i',name:'x',qty:-1,unit:1}]}]}, {name:'x',sections:[{id:'x',name:'x',items:[]},{id:'x',name:'x',items:[]}]}])assert.equal(await call('branch_study_valid',[broken]),false);
 await uid(5);assert.equal(await call('branch_study_delete',[sid]),true);assert.equal((await call('branch_studies_list')).length,0);
 await pg.exec('set role authenticated');await assert.rejects(()=>pg.query('select * from branch_studies'),/permission denied/);await pg.exec('reset role');
 await pg.close();console.log('PASS SQL migration, totals, owner/super, view/add/edit/full, revocation, conflict and direct-table denial');
})().catch(e=>{console.error(e);process.exitCode=1;});
