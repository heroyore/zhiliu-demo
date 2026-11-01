// 独立展示版的客户、会议和收支记录；仅存储在本浏览器。
(() => {
  const key = 'zhiliu_demo_work_content_v1';
  const seed = {
    clients: [{id:'c1',name:'星河科技（示例）',contact:'李女士',phone:'',status:'跟进中',next:'准备介绍产品方案',notes:'对团队协作工具感兴趣。'}],
    meetings: [{id:'m1',title:'项目启动会（示例）',date:'',people:'项目组成员',status:'待召开',notes:'讨论目标、分工与时间安排。'}],
    finance: [{id:'f1',title:'办公用品（示例）',type:'支出',category:'办公费用',amount:'300.00',date:'',notes:'示例记录，不代表真实交易。'}],
    expenses: [{id:'e1',title:'客户拜访交通费（示例）',applicant:'演示主管',category:'交通费',amount:'120.00',date:'',status:'待审批',notes:'用于演示报销流程。'}],
  };
  let records, snapshot, storageError = false;
  try {
    snapshot = localStorage.getItem(key);
    records = snapshot === null ? structuredClone(seed) : JSON.parse(snapshot);
    if (!records || typeof records !== 'object' || Array.isArray(records) ||
      Object.keys(seed).some(name => records[name] !== undefined && (!Array.isArray(records[name]) || records[name].some(x => !x || typeof x !== 'object')))) throw new Error('数据格式异常');
  } catch { records = {clients:[],meetings:[],finance:[],expenses:[]}; storageError = true; }
  for (const name of Object.keys(seed)) if (!Array.isArray(records[name])) records[name] = [];
  function commit(updated) {
    if (storageError) throw new Error('已有数据无法读取，请先在数据备份中导出原始数据');
    if (localStorage.getItem(key) !== snapshot) throw new Error('其他标签页已修改数据，请刷新页面后再操作');
    const serialized = JSON.stringify(updated);
    localStorage.setItem(key, serialized);
    snapshot = serialized; records = updated;
  }
  const today = () => new Date().toLocaleDateString('sv-SE');
  const names = {clients:'客户管理',meetings:'会议记录',finance:'收支记录',expenses:'报销报账',backup:'数据备份'};
  window.workSearchRecords = () => Object.keys(seed).flatMap(type => records[type].map(item => ({extra:true,type,id:item.id,title:item.name||item.title,detail:`${names[type]} · ${item.status||item.type||''} · ${item.contact||item.applicant||item.people||item.category||''}`})));
  const filters = {clients:['全部状态','待联系','跟进中','已合作','暂停跟进'], meetings:['全部状态','待召开','已完成','已取消'], finance:['全部类型','收入','支出'], expenses:['全部状态','待审批','已通过','已拒绝','已报销']};
  const columns = {clients:[['客户名称','name'],['联系人','contact'],['联系方式','phone'],['状态','status'],['下一步','next'],['备注','notes']],meetings:[['会议名称','title'],['日期','date'],['参与人','people'],['状态','status'],['会议内容','notes']],finance:[['收支项目','title'],['类型','type'],['金额','amount'],['日期','date'],['分类','category'],['说明','notes']],expenses:[['报销项目','title'],['申请人','applicant'],['费用类型','category'],['金额','amount'],['日期','date'],['状态','status'],['说明','notes']]};
  Object.entries(names).forEach(([key, name]) => { pageMeta[key] = ['日常工作', name]; });
  const safe = value => esc(value ?? '');
  const money = value => Number(value || 0).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2});
  const stat = (label, value) => `<div class="extra-stat"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`;
  function render(type) {
    const query = document.getElementById(type + 'Search').value.trim().toLowerCase();
    const all = records[type];
    const selected = document.getElementById(type + 'Filter').value;
    const rows = all.filter(item => (!selected || (type==='finance' ? item.type : item.status)===selected) && Object.values(item).some(value => String(value).toLowerCase().includes(query)));
    const stats = type === 'clients' ? [stat('客户总数',all.length),stat('跟进中',all.filter(x=>x.status==='跟进中').length),stat('已合作',all.filter(x=>x.status==='已合作').length)] : type === 'meetings' ? [stat('会议总数',all.length),stat('待召开',all.filter(x=>x.status==='待召开').length),stat('已完成',all.filter(x=>x.status==='已完成').length)] : type === 'expenses' ? [stat('待审批',all.filter(x=>x.status==='待审批').length),stat('待报销','¥ '+money(all.filter(x=>x.status==='已通过').reduce((a,x)=>a+Number(x.amount||0),0))),stat('已报销','¥ '+money(all.filter(x=>x.status==='已报销').reduce((a,x)=>a+Number(x.amount||0),0)))] : [stat('收入合计','¥ '+money(all.filter(x=>x.type==='收入').reduce((a,x)=>a+Number(x.amount||0),0))),stat('支出合计','¥ '+money(all.filter(x=>x.type==='支出').reduce((a,x)=>a+Number(x.amount||0),0))),stat('记录数量',all.length)];
    document.getElementById(type + 'Stats').innerHTML = stats.join('');
    document.getElementById(type + 'List').innerHTML = rows.length ? rows.map(item => {
      let title, detail, extra;
      if (type === 'clients') { title=item.name; detail=`联系人：${item.contact || '未填写'} · ${item.status}`; extra=`下一步：${item.next || '待安排'}`; }
      else if (type === 'meetings') { title=item.title; detail=`${item.date || '时间待定'} · ${item.status} · ${item.people || '参与人待定'}`; extra=item.notes || '暂无会议内容'; }
      else if(type==='expenses') { title=item.title; detail=`¥ ${money(item.amount)} · ${item.status} · ${item.applicant || '申请人未填写'}`; extra=`${item.category || '未分类'} · ${item.date || '日期未填写'}${item.notes ? ' · '+item.notes : ''}`; }
      else { title=item.title; detail=`${item.type} ¥ ${money(item.amount)} · ${item.category || '未分类'} · ${item.date || '日期未填写'}`; extra=item.notes || '暂无说明'; }
      return `<article class="extra-row"><div class="extra-row-main"><h3>${safe(title)}</h3><p>${safe(detail)}</p><p>${safe(extra)}</p></div><button class="button secondary" data-extra-edit="${type}" data-id="${safe(item.id)}">查看 / 修改</button></article>`;
    }).join('') : empty(storageError ? '数据读取失败，原始数据已保留。请到数据备份导出原始数据。' : query || selected ? '没有匹配记录，请清空搜索或选择全部状态' : '还没有记录，点击右上角新增');
  }
  function exportCsv(type) {
    const query=document.getElementById(type+'Search').value.trim().toLowerCase();
    const selected=document.getElementById(type+'Filter').value;
    const rows=records[type].filter(item=>(!selected || (type==='finance'?item.type:item.status)===selected) && Object.values(item).some(value=>String(value).toLowerCase().includes(query)));
    const cell=value=>{ let text=String(value ?? ''); if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text="'"+text; return '"'+text.replace(/"/g,'""')+'"'; };
    const csv=[columns[type].map(x=>cell(x[0])).join(','),...rows.map(row=>columns[type].map(x=>cell(row[x[1]])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a'); link.href=url; link.download=names[type]+'.csv'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast(`已导出 ${rows.length} 条记录`);
  }
  function field(label,name,value,options={}) {
    const required=options.required?' required':'';
    const input = options.options ? `<select name="${name}">${options.options.map(x=>`<option ${x===value?'selected':''}>${safe(x)}</option>`).join('')}</select>` : options.multiline ? `<textarea name="${name}"${required}>${safe(value)}</textarea>` : `<input name="${name}" type="${options.type || 'text'}" value="${safe(value)}"${required}${options.type==='number'?' min="0.01" step="0.01" max="999999999"':''}>`;
    return `<label class="field"><span>${safe(label)}</span>${input}</label>`;
  }
  function edit(type, recordId) {
    const item = records[type].find(x=>x.id===recordId) || {};
    if (type === 'expenses' && recordId) { expenseDetail(item); return; }
    let fields;
    if(type==='clients') fields=field('客户名称','name',item.name,{required:true})+field('联系人','contact',item.contact)+field('联系方式','phone',item.phone)+field('跟进状态','status',item.status||'待联系',{options:['待联系','跟进中','已合作','暂停跟进']})+field('下一步要做什么','next',item.next)+field('备注','notes',item.notes,{multiline:true});
    else if(type==='meetings') fields=field('会议名称','title',item.title,{required:true})+field('会议日期','date',item.date,{type:'date'})+field('参与人','people',item.people)+field('会议状态','status',item.status||'待召开',{options:['待召开','已完成','已取消']})+field('会议内容或结论','notes',item.notes,{multiline:true});
    else if(type==='expenses') fields=expenseFields(item);
    else fields=field('收支项目','title',item.title,{required:true})+field('类型','type',item.type||'支出',{options:['收入','支出']})+field('金额（元）','amount',item.amount,{type:'number',required:true})+field('日期','date',item.date,{type:'date'})+field('分类','category',item.category)+field('说明','notes',item.notes,{multiline:true});
    const locked = type==='finance' && item.expense_id;
    showDrawer('',''+(recordId?'查看 / 修改':'新增')+({clients:'客户',meetings:'会议记录',finance:'收支记录',expenses:'报销'}[type]),`<form id="extraWorkForm" class="extra-form" data-type="${type}" data-id="${safe(recordId)}"><fieldset ${locked?'disabled':''}>${fields}</fieldset>${locked ? '<p class="extra-note">这笔支出由报销自动生成，保留原始记账内容，不可单独修改或删除。</p>' : `<button class="button primary full" type="submit">${type==='expenses'?'保存并提交审批':'保存'}</button>${recordId ? `<button class="button secondary full" type="button" data-extra-delete="${type}" data-id="${safe(recordId)}">删除记录</button>` : ''}`}</form>`);
  }
  function expenseFields(item) {
    return field('报销项目','title',item.title,{required:true})+field('申请人','applicant',item.applicant||'演示主管',{required:true})+field('费用类型','category',item.category||'其他费用',{options:['交通费','差旅费','餐饮费','办公费用','其他费用']})+field('金额（元）','amount',item.amount,{type:'number',required:true})+field('发生日期','date',item.date||today(),{type:'date',required:true})+field('用途和说明','notes',item.notes,{multiline:true});
  }
  function expenseDetail(item) {
    const editable = ['待审批','已拒绝'].includes(item.status);
    const actions = item.status==='待审批' ? [['approve','通过审批'],['reject','拒绝并填写原因']] : item.status==='已通过' ? [['pay','登记已报销并生成支出']] : item.status==='已拒绝' ? [['resubmit','重新提交审批']] : [];
    showDrawer('报销记录',item.title,`<p class="extra-note">当前状态：${safe(item.status)} · 所有操作仅保存在本浏览器</p><form id="extraWorkForm" class="extra-form" data-type="expenses" data-id="${safe(item.id)}"><fieldset ${editable?'':'disabled'}>${expenseFields(item)}</fieldset>${editable?'<button class="button secondary full" type="submit">保存修改</button>':''}</form><section class="detail-section"><h3>处理报销</h3><p class="extra-note">先保存修改，再处理审批。登记已报销仅记账，不会转账；请确认实际付款已完成。</p>${actions.length?field('处理说明 / 拒绝原因','expenseActionNote','',{multiline:true}):''}${item.status==='已通过'?'<label class="checkbox-field"><input type="checkbox" id="expensePaidConfirmed">我已核对实际付款，本次只登记账目</label>':''}<div class="expense-actions">${actions.map(([action,label])=>`<button class="button ${action==='reject'?'secondary':'primary'}" data-expense-action="${action}" data-id="${safe(item.id)}">${label}</button>`).join('')}</div></section><section class="detail-section"><h3>处理记录</h3>${(item.history||[]).map(x=>`<p>${safe(x.date)} · ${safe(x.action)}${x.note?' · '+safe(x.note):''}</p>`).join('')||'<p class="extra-note">旧记录暂无处理历史，后续操作将自动记录。</p>'}</section>`);
  }
  document.addEventListener('click', event => {
    if(event.target.closest('[data-backup-raw]')) {
      try {
        const payload={format:'zhiliu-raw-recovery',created_at:new Date().toISOString(),main:localStorage.getItem('zhiliu_public_demo_v1'),work:localStorage.getItem(key)};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
        const link=document.createElement('a'); link.href=url; link.download='智流原始数据恢复副本.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      } catch { alert('浏览器禁止读取存储，无法导出；请恢复此网站的存储权限后重试。'); }
      return;
    }
    const action=event.target.closest('[data-expense-action]');
    if(action) {
      const form=document.getElementById('extraWorkForm');
      if(form?.dataset.dirty==='true') { toast('请先保存表单修改，再处理报销'); return; }
      if(action.dataset.expenseAction==='pay' && !document.getElementById('expensePaidConfirmed')?.checked) { toast('请先勾选已核对实际付款，再登记账目'); return; }
      try {
        commit(WorkRules.transition(records,action.dataset.id,action.dataset.expenseAction,document.querySelector('[name="expenseActionNote"]')?.value.trim()||'',today()));
        render('expenses'); render('finance'); expenseDetail(records.expenses.find(x=>x.id===action.dataset.id)); toast('已保存处理记录');
      } catch(error) { toast(error.message); }
      return;
    }
    const exportButton=event.target.closest('[data-extra-export]');
    if(exportButton) exportCsv(exportButton.dataset.extraExport);
    const button=event.target.closest('[data-extra-create],[data-extra-edit]');
    if(button) { closeSearch(); edit(button.dataset.extraCreate || button.dataset.extraEdit,button.dataset.id || ''); }
    const remove=event.target.closest('[data-extra-delete]');
    if(remove && confirm('确定删除这条记录？建议先在数据备份中导出。')) {
      const type=remove.dataset.extraDelete;
      const item=records[type].find(x=>x.id===remove.dataset.id);
      if(type==='expenses' || item?.expense_id) { toast('已进入报销流程的记录需保留，不可直接删除'); return; }
      const updated={...records,[type]:records[type].filter(item=>item.id!==remove.dataset.id)};
      try { commit(updated); render(type); closeDrawer(); toast('记录已删除'); }
      catch(error) { toast('删除失败：'+error.message); }
    }
  });
  document.getElementById('drawerBody').addEventListener('input', event => {
    if(event.target.closest('#extraWorkForm')) event.target.closest('form').dataset.dirty='true';
  });
  document.getElementById('drawerBody').addEventListener('submit', event => {
    if(event.target.id!=='extraWorkForm') return;
    event.preventDefault();
    const form=event.target, type=form.dataset.type, values=Object.fromEntries(new FormData(form));
    for(const name of Object.keys(values)) values[name]=values[name].trim();
    if(!(values.title || values.name) || (type==='expenses' && !values.applicant)) { toast('请填写名称和必填信息，不能只输入空格'); return; }
    try { if(['finance','expenses'].includes(type)) values.amount=WorkRules.amount(values.amount); } catch(error) { toast(error.message); return; }
    const existing=records[type].find(x=>x.id===form.dataset.id);
    if(existing?.expense_id || (type==='expenses' && existing && !['待审批','已拒绝'].includes(existing.status))) { toast('已审批的报销及关联支出不可修改'); return; }
    if(type==='expenses') {
      values.status=existing?.status || '待审批';
      values.history=[...(existing?.history||[]),{action:existing?'修改报销内容':'提交审批',note:'',date:today()}];
    }
    const updated={...records,[type]:existing ? records[type].map(item=>item.id===form.dataset.id ? {...item,...values} : item) : [{id:crypto.randomUUID(),...values},...records[type]]};
    try { commit(updated); } catch(error) { toast('保存失败：'+error.message); return; }
    render(type); if(type==='expenses' && existing) expenseDetail(records.expenses.find(x=>x.id===existing.id)); else closeDrawer(); toast('已保存到当前浏览器');
  });
  Object.keys(seed).forEach(type=>{
    const search=document.getElementById(type+'Search');
    const select=document.createElement('select'); select.id=type+'Filter'; select.setAttribute('aria-label',filters[type][0]);
    filters[type].forEach((label,index)=>{const option=document.createElement('option');option.textContent=label;option.value=index?label:'';select.append(option);});
    const button=document.createElement('button'); button.className='button secondary';button.type='button';button.dataset.extraExport=type;button.textContent='导出 CSV';
    search.closest('.toolbar').append(select,button);
    search.addEventListener('input',()=>render(type));select.addEventListener('change',()=>render(type));render(type);
  });
  const mainKey = 'zhiliu_public_demo_v1';
  document.getElementById('backupExport').addEventListener('click', () => {
    try {
      if(storageError) throw new Error('部分数据无法读取，请使用“导出原始数据”保留恢复副本');
      if(localStorage.getItem(key)!==snapshot) throw new Error('其他标签页已修改数据，请刷新页面后重新备份');
      const main=JSON.parse(localStorage.getItem(mainKey));
      if(!main) throw new Error('工作台数据尚未加载');
      const payload={format:'zhiliu-demo-backup',version:1,created_at:new Date().toISOString(),main,work:records};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      const a=document.createElement('a'); a.href=url; a.download=`智流演示备份-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast('备份文件已生成，请保留下载文件');
    } catch(error) { toast(`备份失败：${error.message}`); }
  });
  document.getElementById('backupImport').addEventListener('click',()=>document.getElementById('backupFile').click());
  document.getElementById('backupFile').addEventListener('change',async event=>{
    const file=event.target.files[0]; if(!file) return;
    try {
      if(file.size>5*1024*1024) throw new Error('备份文件不能超过 5 MB');
      const payload=JSON.parse(await file.text()), main=payload.main, work=payload.work;
      if(!WorkRules.validBackup(payload)) throw new Error('备份内容不完整或格式有误，当前数据未被修改');
      if(!confirm('恢复会替换当前浏览器中的全部演示数据。建议先下载当前备份。确定继续？')) return;
      const oldMain=localStorage.getItem(mainKey),oldWork=localStorage.getItem(key);
      try { localStorage.setItem(mainKey,JSON.stringify(main));localStorage.setItem(key,JSON.stringify(work)); }
      catch(error) { if(oldMain===null)localStorage.removeItem(mainKey);else localStorage.setItem(mainKey,oldMain);if(oldWork===null)localStorage.removeItem(key);else localStorage.setItem(key,oldWork);throw error; }
      location.reload();
    } catch(error) { alert(`无法恢复备份：${error.message}`); }
    finally { event.target.value=''; }
  });
})();
