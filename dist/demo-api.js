// Shareable demonstration: browser-local sample data only, no network backend.
(() => {
  const key = 'zhiliu_public_demo_v1';
  const now = () => new Date().toISOString();
  const id = () => crypto.randomUUID();
  const user = {id:'demo-user',name:'演示主管',email:'demo@example.invalid',employee_no:'DEMO001',role:'admin',product_view:'management'};
  const initial = () => ({user,product_view:'management',workspace:{name:'示例企业',tenant_code:'DEMO'},capabilities:{decide_approvals:true,manage_organization:true,view_audit:true,manage_settings:true},csrf_token:'demo',integrations:{openai:false,stripe:false},subscription:null,audit_count:0,audit:[],notifications:[],members:[{id:'member-1',user_id:'demo-user',name:'演示主管',email:user.email,department:'管理部',role:'管理员',position:'主管',status:'有效',created_at:now()}],approvals:[{id:'SP-DEMO-001',title:'办公设备采购申请',applicant:'演示主管',department:'管理部',kind:'采购申请',amount:'¥ 5,000',urgent:true,status:'待审批',description:'用于新增办公设备',current_step:'主管审批',created_at:now(),history:[{action:'提交申请',actor:'演示主管',note:'示例申请',created_at:now()}]}],tasks:[{id:'task-1',title:'准备项目启动会议',description:'确认项目范围和负责人',tag:'项目',due_text:'待安排',due_date:'',owner:'演示主管',owner_user_id:'demo-user',status:'待开始',project:'示例项目',priority:'高',created_at:now()}],documents:[{id:'doc-1',title:'采购流程说明',description:'提交采购申请后，由主管审批并跟踪执行。',category:'公司制度',author:'管理部',tags:['采购'],created_at:now(),favorite:0,visited_at:null}]});
  let data;
  function read() {
    const raw = localStorage.getItem(key);
    if (raw === null) return initial();
    const value = JSON.parse(raw);
    if (!value || !value.user || !value.workspace || !value.capabilities || !value.integrations ||
      !['approvals','tasks','documents','members','audit','notifications'].every(k => Array.isArray(value[k]) && value[k].every(x => x && typeof x === 'object')))
      throw new Error('已有数据格式异常，请先导出原始数据备份');
    return value;
  }
  const save=()=>localStorage.setItem(key,JSON.stringify(data));
  const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  const addAudit=(type,entity,action)=>{data.audit.unshift({id:Date.now(),entity_type:type,entity_id:entity,action,created_at:now()});data.audit_count=data.audit.length;};
  const notify=(type,entity,title)=>data.notifications.unshift({id:id(),kind:type,title,message:'点击查看详情',target_type:type,target_id:entity,is_read:0,created_at:now()});
  window.fetch = async (path, options={}) => {
    const method=(options.method || 'GET').toUpperCase(); const url=String(path); let body={};
    try { data=read(); } catch { return response({error:'无法读取浏览器数据，请勿清除浏览器数据；请在数据备份中导出原始数据。'},503); }
    const before=JSON.stringify(data);
    try { if (typeof options.body==='string') body=JSON.parse(options.body); } catch {}
    let result={}; let status=200;
    if(url==='/api/bootstrap') result=data;
    else if(url==='/api/auth/status') result={needs_setup:false,demo:false};
    else if(url==='/api/auth/logout') result={logged_out:true};
    else if(url==='/api/chat') result={answer:`演示数据：待审批 ${data.approvals.filter(x=>x.status==='待审批').length} 项，未完成任务 ${data.tasks.filter(x=>x.status!=='已完成').length} 项，共 ${data.documents.length} 份资料。此演示不连接外部 AI。`};
    else if(url==='/api/approvals' && method==='POST') { const x={...body,id:'SP-'+id().slice(0,8),applicant:user.name,status:'待审批',created_at:now(),history:[{action:'提交申请',actor:user.name,note:body.description||'申请已提交',created_at:now()}]};data.approvals.unshift(x);addAudit('approval',x.id,'created');notify('approval',x.id,'新审批已提交');result=x; }
    else if(url.startsWith('/api/approvals/')) {const x=data.approvals.find(v=>v.id===decodeURIComponent(url.split('/').pop()));if(!x)return response({error:'审批不存在'},404); if(method==='PATCH'){if(x.status!=='待审批')return response({error:'审批已经处理'},409);x.status=body.action==='approve'?'已通过':'已拒绝';x.decided_at=now();x.history.push({action:x.status,actor:user.name,note:body.note||'已处理',created_at:now()});addAudit('approval',x.id,body.action);notify('approval',x.id,'审批'+x.status);}result=x; }
    else if(url==='/api/tasks' && method==='POST') {const x={...body,id:id(),owner_user_id:body.owner===user.name?user.id:null,status:'待开始',created_at:now()};data.tasks.unshift(x);addAudit('task',x.id,'created');notify('task',x.id,'新任务');result=x;}
    else if(url.startsWith('/api/tasks/')) {const x=data.tasks.find(v=>v.id===decodeURIComponent(url.split('/').pop()));if(!x)return response({error:'任务不存在'},404);if(body.action==='advance'){const states=['待开始','进行中','待审核','已完成'];x.status=states[Math.min(states.indexOf(x.status)+1,3)];}else Object.assign(x,body);addAudit('task',x.id,'updated');result=x;}
    else if(url==='/api/documents' && method==='POST'){const x={...body,id:id(),tags:body.tags||[],created_at:now(),favorite:0,visited_at:null};data.documents.unshift(x);addAudit('document',x.id,'created');result=x;}
    else if(url.startsWith('/api/documents/') && url.endsWith('/preference')){const x=data.documents.find(v=>v.id===decodeURIComponent(url.split('/')[3]));if(!x)return response({error:'资料不存在'},404);if(body.action==='visit')x.visited_at=now();else x.favorite=body.action==='favorite'?1:0;result={ok:true};}
    else if(url.startsWith('/api/contracts/') && method==='PATCH'){const x=data.documents.find(v=>v.id===decodeURIComponent(url.split('/').pop())&&v.category==='合同草稿');if(!x)return response({error:'合同不存在'},404);x.title=body.title;x.description=body.description;addAudit('document',x.id,'updated');result=x;}
    else if(url==='/api/members' && method==='POST'){const x={...body,id:id(),status:'有效',created_at:now(),user_id:null};data.members.unshift(x);addAudit('member',x.id,'created');result=x;}
    else if(url==='/api/notifications/read'){data.notifications.forEach(x=>{if(!body.id||body.id===x.id)x.is_read=1;});result={updated:1};}
    else return response({error:'该功能需要正式系统；此分享版仅用于独立演示。'},503);
    try { if (JSON.stringify(data)!==before || (url==='/api/bootstrap' && localStorage.getItem(key)===null)) save(); }
    catch { data=JSON.parse(before); return response({error:'保存失败，修改未生效。浏览器存储已满或被禁用，请先备份数据。'},507); }
    return response(result,status);
  };
})();
