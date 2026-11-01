// Shared business rules; browser-local bookkeeping, never initiates a bank payment.
globalThis.WorkRules = {
  taskTiming(task, today) {
    if (!task.due_date || task.status === '已完成') return {label:'',overdue:false};
    const days = Math.round((Date.parse(task.due_date+'T00:00:00Z') - Date.parse(today+'T00:00:00Z')) / 86400000);
    if (!Number.isFinite(days)) return {label:'',overdue:false};
    return {label:days<0 ? `逾期 ${-days} 天` : days===0 ? '今天截止' : days===1 ? '明天截止' : '',overdue:days<0};
  },
  sortTasks(tasks, mode) {
    const rank = x => ({'紧急':0,'高':1,'普通':2,'低':3}[x.priority] ?? 2);
    return [...tasks].sort((a,b) => {
      if (mode==='priority') return rank(a)-rank(b) || (a.due_date||'9999').localeCompare(b.due_date||'9999');
      if (mode==='due') return (a.due_date||'9999').localeCompare(b.due_date||'9999') || rank(a)-rank(b);
      return 0;
    });
  },
  validBackup(payload) {
    const object = x => x && typeof x === 'object' && !Array.isArray(x);
    const rows = x => Array.isArray(x) && x.every(object);
    const main = payload?.main, work = payload?.work;
    return payload?.format === 'zhiliu-demo-backup' && payload.version === 1 &&
      object(main) && object(main.user) && typeof main.user.name === 'string' &&
      object(main.workspace) && typeof main.workspace.name === 'string' &&
      object(main.capabilities) && object(main.integrations) &&
      ['approvals','tasks','documents','members','audit','notifications'].every(k => rows(main[k])) &&
      main.approvals.every(x => Array.isArray(x.history) && x.history.every(object)) &&
      object(work) && ['clients','meetings','finance'].every(k => rows(work[k])) &&
      (work.expenses === undefined || rows(work.expenses)) &&
      [...work.clients,...work.meetings,...work.finance,...(work.expenses || [])].every(x => typeof x.id === 'string' && (x.history === undefined || (Array.isArray(x.history) && x.history.every(object))));
  },
  amount(value) {
    const text = String(value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text) || Number(text) <= 0 || Number(text) > 999999999)
      throw new Error('金额须大于 0、最多两位小数，且不超过 999999999 元');
    return Number(text).toFixed(2);
  },
  transition(records, id, action, note, date) {
    const next = JSON.parse(JSON.stringify(records));
    const item = next.expenses.find(x => x.id === id);
    if (!item) throw new Error('报销记录不存在');
    const target = ({approve:'已通过',reject:'已拒绝',resubmit:'待审批',pay:'已报销'})[action];
    const required = ({approve:'待审批',reject:'待审批',resubmit:'已拒绝',pay:'已通过'})[action];
    if (!target || item.status !== required) throw new Error('状态已变化，请重新打开记录');
    if (action === 'reject' && !note.trim()) throw new Error('请填写拒绝原因，方便修改后重新提交');
    if (action === 'pay') {
      if (next.finance.some(x => x.expense_id === id)) throw new Error('此报销已记账，请勿重复登记');
      const amount = this.amount(item.amount);
      next.finance.unshift({id:'expense-'+id,expense_id:id,title:'报销：'+item.title,type:'支出',category:item.category,
        amount,date,notes:'申请人：'+item.applicant+(note ? '；'+note : '')});
      item.paid_date = date;
    }
    item.status = target;
    item.history = [...(item.history || []),{action:target,note,date}];
    return next;
  },
};
