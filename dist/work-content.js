// 独立展示版的客户、会议和收支记录；仅存储在本浏览器。
(() => {
  const key = 'zhiliu_demo_work_content_v1';
  const seed = {
    clients: [{id:'c1',name:'星河科技（示例）',contact:'李女士',phone:'',status:'跟进中',next:'准备介绍产品方案',notes:'对团队协作工具感兴趣。'}],
    meetings: [{id:'m1',title:'项目启动会（示例）',date:'',people:'项目组成员',status:'待召开',notes:'讨论目标、分工与时间安排。'}],
    finance: [{id:'f1',title:'办公用品（示例）',type:'支出',category:'办公费用',amount:'300.00',date:'',notes:'示例记录，不代表真实交易。'}],
    expenses: [{id:'e1',title:'客户拜访交通费（示例）',applicant:'演示主管',category:'交通费',amount:'120.00',date:'',status:'待审批',notes:'用于演示报销流程。'}],
  };
  let records;
  try { records = JSON.parse(localStorage.getItem(key)) || seed; } catch { records = seed; }
  for (const name of Object.keys(seed)) if (!Array.isArray(records[name])) records[name] = [];
  const names = {clients:'客户管理',meetings:'会议记录',finance:'收支记录',expenses:'报销报账',backup:'数据备份'};
  Object.entries(names).forEach(([key, name]) => { pageMeta[key] = ['日常工作', name]; });
  const safe = value => esc(value ?? '');
  const money = value => Number(value || 0).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2});
  const stat = (label, value) => `<div class="extra-stat"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`;
  function render(type) {
    const query = document.getElementById(type + 'Search').value.trim().toLowerCase();
    const all = records[type];
    const rows = all.filter(item => Object.values(item).some(value => String(value).toLowerCase().includes(query)));
    const stats = type === 'clients' ? [stat('客户总数',all.length),stat('跟进中',all.filter(x=>x.status==='跟进中').length),stat('已合作',all.filter(x=>x.status==='已合作').length)] : type === 'meetings' ? [stat('会议总数',all.length),stat('待召开',all.filter(x=>x.status==='待召开').length),stat('已完成',all.filter(x=>x.status==='已完成').length)] : type === 'expenses' ? [stat('待审批',all.filter(x=>x.status==='待审批').length),stat('待报销','¥ '+money(all.filter(x=>x.status==='已通过').reduce((a,x)=>a+Number(x.amount||0),0))),stat('已报销','¥ '+money(all.filter(x=>x.status==='已报销').reduce((a,x)=>a+Number(x.amount||0),0)))] : [stat('收入合计','¥ '+money(all.filter(x=>x.type==='收入').reduce((a,x)=>a+Number(x.amount||0),0))),stat('支出合计','¥ '+money(all.filter(x=>x.type==='支出').reduce((a,x)=>a+Number(x.amount||0),0))),stat('记录数量',all.length)];
    document.getElementById(type + 'Stats').innerHTML = stats.join('');
    document.getElementById(type + 'List').innerHTML = rows.length ? rows.map(item => {
      let title, detail, extra;
      if (type === 'clients') { title=item.name; detail=`联系人：${item.contact || '未填写'} · ${item.status}`; extra=`下一步：${item.next || '待安排'}`; }
      else if (type === 'meetings') { title=item.title; detail=`${item.date || '时间待定'} · ${item.status} · ${item.people || '参与人待定'}`; extra=item.notes || '暂无会议内容'; }
      else if(type==='expenses') { title=item.title; detail=`¥ ${money(item.amount)} · ${item.status} · ${item.applicant || '申请人未填写'}`; extra=`${item.category || '未分类'} · ${item.date || '日期未填写'}${item.notes ? ' · '+item.notes : ''}`; }
      else { title=item.title; detail=`${item.type} ¥ ${money(item.amount)} · ${item.category || '未分类'} · ${item.date || '日期未填写'}`; extra=item.notes || '暂无说明'; }
      return `<article class="extra-row"><div class="extra-row-main"><h3>${safe(title)}</h3><p>${safe(detail)}</p><p>${safe(extra)}</p></div><button class="button secondary" data-extra-edit="${type}" data-id="${safe(item.id)}">查看 / 修改</button></article>`;
    }).join('') : empty(query ? '没有找到匹配记录，请换个关键词' : '还没有记录，点击右上角新增');
  }
  function field(label,name,value,options={}) {
    const required=options.required?' required':'';
    const input = options.options ? `<select name="${name}">${options.options.map(x=>`<option ${x===value?'selected':''}>${safe(x)}</option>`).join('')}</select>` : options.multiline ? `<textarea name="${name}"${required}>${safe(value)}</textarea>` : `<input name="${name}" type="${options.type || 'text'}" value="${safe(value)}"${required}${options.type==='number'?' min="0.01" step="0.01" max="999999999"':''}>`;
    return `<label class="field"><span>${safe(label)}</span>${input}</label>`;
  }
  function edit(type, recordId) {
    const item = records[type].find(x=>x.id===recordId) || {};
    let fields;
    if(type==='clients') fields=field('客户名称','name',item.name,{required:true})+field('联系人','contact',item.contact)+field('联系方式','phone',item.phone)+field('跟进状态','status',item.status||'待联系',{options:['待联系','跟进中','已合作','暂停跟进']})+field('下一步要做什么','next',item.next)+field('备注','notes',item.notes,{multiline:true});
    else if(type==='meetings') fields=field('会议名称','title',item.title,{required:true})+field('会议日期','date',item.date,{type:'date'})+field('参与人','people',item.people)+field('会议状态','status',item.status||'待召开',{options:['待召开','已完成','已取消']})+field('会议内容或结论','notes',item.notes,{multiline:true});
    else if(type==='expenses') fields=field('报销项目','title',item.title,{required:true})+field('申请人','applicant',item.applicant||'演示主管',{required:true})+field('费用类型','category',item.category||'其他费用',{options:['交通费','差旅费','餐饮费','办公费用','其他费用']})+field('金额（元）','amount',item.amount,{type:'number',required:true})+field('发生日期','date',item.date,{type:'date'})+field('处理状态（手动更新）','status',item.status||'待审批',{options:['待审批','已通过','已拒绝','已报销']})+field('用途和说明','notes',item.notes,{multiline:true});
    else fields=field('收支项目','title',item.title,{required:true})+field('类型','type',item.type||'支出',{options:['收入','支出']})+field('金额（元）','amount',item.amount,{type:'number',required:true})+field('日期','date',item.date,{type:'date'})+field('分类','category',item.category)+field('说明','notes',item.notes,{multiline:true});
    showDrawer('',''+(recordId?'查看 / 修改':'新增')+({clients:'客户',meetings:'会议记录',finance:'收支记录',expenses:'报销'}[type]),`<form id="extraWorkForm" class="extra-form" data-type="${type}" data-id="${safe(recordId)}">${fields}<button class="button primary full" type="submit">保存</button></form>`);
  }
  document.addEventListener('click', event => {
    const button=event.target.closest('[data-extra-create],[data-extra-edit]');
    if(button) edit(button.dataset.extraCreate || button.dataset.extraEdit,button.dataset.id || '');
  });
  document.getElementById('drawerBody').addEventListener('submit', event => {
    if(event.target.id!=='extraWorkForm') return;
    event.preventDefault();
    const form=event.target, type=form.dataset.type, values=Object.fromEntries(new FormData(form));
    if(['finance','expenses'].includes(type) && (!Number.isFinite(Number(values.amount)) || Number(values.amount)<=0)) { toast('请输入大于零的金额'); return; }
    const existing=records[type].find(x=>x.id===form.dataset.id);
    if(existing) Object.assign(existing,values); else records[type].unshift({id:crypto.randomUUID(),...values});
    try { localStorage.setItem(key,JSON.stringify(records)); } catch { toast('保存失败：浏览器存储不可用'); return; }
    render(type); closeDrawer(); toast('已保存到当前浏览器');
  });
  Object.keys(seed).forEach(type=>{document.getElementById(type+'Search').addEventListener('input',()=>render(type));render(type);});
  const mainKey = 'zhiliu_public_demo_v1';
  document.getElementById('backupExport').addEventListener('click', () => {
    try {
      const main=JSON.parse(localStorage.getItem(mainKey));
      if(!main) throw new Error('工作台数据尚未加载');
      const payload={format:'zhiliu-demo-backup',version:1,created_at:new Date().toISOString(),main,work:records};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      const a=document.createElement('a'); a.href=url; a.download=`智流演示备份-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error) { toast(`备份失败：${error.message}`); }
  });
  document.getElementById('backupImport').addEventListener('click',()=>document.getElementById('backupFile').click());
  document.getElementById('backupFile').addEventListener('change',async event=>{
    const file=event.target.files[0]; if(!file) return;
    try {
      if(file.size>5*1024*1024) throw new Error('备份文件不能超过 5 MB');
      const payload=JSON.parse(await file.text()), main=payload.main, work=payload.work;
      if(payload.format!=='zhiliu-demo-backup'||payload.version!==1||!main||!main.user||!main.workspace||!main.capabilities||!main.integrations||!['approvals','tasks','documents','members','audit','notifications'].every(k=>Array.isArray(main[k]))||!work||!['clients','meetings','finance'].every(k=>Array.isArray(work[k]))||(work.expenses&&!Array.isArray(work.expenses))) throw new Error('文件不是可用的智流演示备份');
      if(!confirm('恢复会替换当前浏览器中的全部演示数据。建议先下载当前备份。确定继续？')) return;
      const oldMain=localStorage.getItem(mainKey),oldWork=localStorage.getItem(key);
      try { localStorage.setItem(mainKey,JSON.stringify(main));localStorage.setItem(key,JSON.stringify(work)); }
      catch(error) { if(oldMain===null)localStorage.removeItem(mainKey);else localStorage.setItem(mainKey,oldMain);if(oldWork===null)localStorage.removeItem(key);else localStorage.setItem(key,oldWork);throw error; }
      location.reload();
    } catch(error) { alert(`无法恢复备份：${error.message}`); }
    finally { event.target.value=''; }
  });
})();
