const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname,'../dist',name),'utf8');
const rulesContext = vm.createContext({});
vm.runInContext(source('work-rules.js'),rulesContext);
const rules = rulesContext.WorkRules;
test('task deadlines exclude completed tasks and correctly cross month/year boundaries',()=>{
  assert.equal(rules.taskTiming({due_date:'2026-12-31',status:'进行中'},'2027-01-01').label,'逾期 1 天');
  assert.equal(rules.taskTiming({due_date:'2026-12-31',status:'已完成'},'2027-01-01').overdue,false);
  assert.equal(rules.taskTiming({due_date:'2027-01-01'},'2027-01-01').label,'今天截止');
  assert.equal(rules.taskTiming({due_date:''},'2027-01-01').label,'');
});
test('task sorting keeps undated tasks last and preserves stored ordering',()=>{
  const tasks=[{id:'none',priority:'紧急'},{id:'later',due_date:'2026-11-03',priority:'高'},{id:'first',due_date:'2026-11-01',priority:'普通'}];
  assert.equal(rules.sortTasks(tasks,'due').map(x=>x.id).join(','),'first,later,none');
  assert.equal(rules.sortTasks(tasks,'priority')[0].id,'none');
  assert.equal(tasks[0].id,'none');
});
test('backup validation rejects damaged rows before replacing existing data',()=>{
  const payload={format:'zhiliu-demo-backup',version:1,main:{user:{name:'演示'},workspace:{name:'公司'},capabilities:{},integrations:{},approvals:[{history:[]}],tasks:[],documents:[],members:[],audit:[],notifications:[]},work:{clients:[],meetings:[],finance:[]}};
  assert.ok(rules.validBackup(payload));
  payload.work.finance.push(null); assert.ok(!rules.validBackup(payload));
  payload.work.finance=[]; payload.main.approvals[0].history=null; assert.ok(!rules.validBackup(payload));
  payload.main.approvals[0].history=[]; payload.work.expenses=[{id:'e',history:[null]}]; assert.ok(!rules.validBackup(payload));
});
test('expense approval → payment creates exactly one matching ledger entry and retains history',()=>{
  const original={expenses:[{id:'e1',title:'交通',applicant:'甲',amount:'12.50',status:'待审批'}],finance:[]};
  const approved=rules.transition(original,'e1','approve','','2026-10-31');
  const paid=rules.transition(approved,'e1','pay','现金报销','2026-10-31');
  assert.equal(original.expenses[0].status,'待审批');
  assert.equal(paid.finance.length,1);
  assert.equal(paid.finance[0].amount,'12.50');
  assert.equal(paid.finance[0].expense_id,'e1');
  assert.equal(paid.expenses[0].history.length,2);
  assert.throws(()=>rules.transition(paid,'e1','pay','','2026-10-31'));
  paid.expenses[0].status='已通过';
  assert.throws(()=>rules.transition(paid,'e1','pay','','2026-10-31'),/重复/);
});
test('reject requires reason, rejected expenses must resubmit before approval; invalid money blocked',()=>{
  let records={expenses:[{id:'e',status:'待审批'}],finance:[]};
  assert.throws(()=>rules.transition(records,'e','reject','','2026-10-31'));
  records=rules.transition(records,'e','reject','补充说明','2026-10-31');
  assert.throws(()=>rules.transition(records,'e','approve','','2026-10-31'));
  assert.equal(rules.transition(records,'e','resubmit','','2026-10-31').expenses[0].status,'待审批');
  for(const invalid of ['0','-1','1.001','NaN','Infinity','1000000000','1e3','']) assert.throws(()=>rules.amount(invalid));
  assert.equal(rules.amount('0.01'),'0.01');
});
function apiHarness() {
  const storage=new Map(); let blocked=false;
  const context=vm.createContext({window:{},Response,crypto:require('node:crypto').webcrypto,
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(blocked)throw new Error('QuotaExceeded');storage.set(k,v);}}});
  vm.runInContext(source('demo-api.js'),context);
  return {storage,block:()=>blocked=true,unblock:()=>blocked=false,fetch:context.window.fetch};
}
test('meeting follow-up creates one linked task even after a retry, preserving existing records',async()=>{
  const h=apiHarness(); await h.fetch('/api/bootstrap');
  h.storage.set('zhiliu_demo_work_content_v1',JSON.stringify({meetings:[{id:'m1',title:'启动会'}]}));
  const body=JSON.stringify({source_meeting_id:'m1',title:'整理会议方案',owner:'演示主管',description:'整理结论',due_date:'2026-11-05'});
  const first=await (await h.fetch('/api/tasks',{method:'POST',body})).json();
  const second=await (await h.fetch('/api/tasks',{method:'POST',body})).json();
  assert.equal(first.id,second.id);
  assert.equal(first.source_meeting_title,'启动会');
  const current=await (await h.fetch('/api/bootstrap')).json();
  assert.equal(current.tasks.length,2);
  assert.equal(current.audit.length,1);
  assert.equal(current.notifications.length,1);
});
test('meeting task rejects missing source and failed saves can be retried without duplicate tasks',async()=>{
  const h=apiHarness(); await h.fetch('/api/bootstrap');
  const body=JSON.stringify({source_meeting_id:'m1',title:'跟进',owner:'演示主管'});
  assert.equal((await h.fetch('/api/tasks',{method:'POST',body})).status,409);
  h.storage.set('zhiliu_demo_work_content_v1',JSON.stringify({meetings:[{id:'m1',title:'会议'}]}));
  h.block(); assert.equal((await h.fetch('/api/tasks',{method:'POST',body})).status,507);
  h.unblock(); assert.equal((await h.fetch('/api/tasks',{method:'POST',body})).status,200);
  assert.equal((await (await h.fetch('/api/bootstrap')).json()).tasks.length,2);
});
test('failed saves never appear in later reads or overwrite durable state',async()=>{
  const h=apiHarness(); await h.fetch('/api/bootstrap');
  const before=h.storage.get('zhiliu_public_demo_v1'); h.block();
  const response=await h.fetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'should not save'})});
  assert.equal(response.status,507);
  assert.equal(h.storage.get('zhiliu_public_demo_v1'),before);
  assert.equal((await (await h.fetch('/api/bootstrap')).json()).tasks.length,1);
  h.unblock(); await h.fetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'saved'})});
  assert.equal((await (await h.fetch('/api/bootstrap')).json()).tasks.length,2);
});
test('corrupt existing data is preserved and reports failure rather than reseeding',async()=>{
  const h=apiHarness(); h.storage.set('zhiliu_public_demo_v1','broken');
  assert.equal((await h.fetch('/api/bootstrap')).status,503);
  assert.equal(h.storage.get('zhiliu_public_demo_v1'),'broken');
});
test('each request reads latest persisted records from other tabs',async()=>{
  const h=apiHarness(); await h.fetch('/api/bootstrap');
  const data=JSON.parse(h.storage.get('zhiliu_public_demo_v1')); data.tasks.push({id:'another-tab',title:'other'});
  h.storage.set('zhiliu_public_demo_v1',JSON.stringify(data));
  await h.fetch('/api/tasks',{method:'POST',body:JSON.stringify({title:'new'})});
  const current=await (await h.fetch('/api/bootstrap')).json();
  assert.equal(current.tasks.length,3);
  assert.ok(current.tasks.some(x=>x.id==='another-tab'));
});
