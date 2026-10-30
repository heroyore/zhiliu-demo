const state = {
  data: null,
  page: 'dashboard',
  workFilter: 'all',
  docCategory: '',
  csrfToken: '',
  toastTimer: null,
};

const taskStates = ['待开始', '进行中', '待审核', '已完成'];
const pageMeta = {
  dashboard: ['今日工作', '工作台'], approvals: ['流程与决策', '审批中心'],
  tasks: ['协同执行', '项目与任务'], knowledge: ['信息资产', '知识与资料'],
  assistant: ['企业智能', '智能助手'], organization: ['组织管理', '组织与成员'],
  audit: ['安全与合规', '审计记录'], settings: ['工作空间设置', '系统与集成'],
};
const auditLabels = {
  created: '已创建', approve: '审批通过', reject: '审批拒绝', updated: '已更新',
  admin_created: '管理员已创建', 'moved:进行中': '推进至进行中',
  'moved:待审核': '推进至待审核', 'moved:已完成': '任务已完成',
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.csrfToken && !['GET', 'HEAD'].includes(method) ? { 'X-CSRF-Token': state.csrfToken } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
  return body;
}

function formatDate(value, includeTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', includeTime
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function initials(name) {
  return esc(String(name || '用').trim().slice(0, 1).toUpperCase());
}

function empty(text) {
  return `<div class="empty-state">${esc(text)}</div>`;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('show'), 2200);
}

function navigate(page) {
  const target = $(`#page-${page}`);
  if (!target) return;
  state.page = page;
  $$('.page').forEach(element => element.classList.toggle('active', element === target));
  $$('.nav-item').forEach(element => element.classList.toggle('active', element.dataset.page === page));
  const [eyebrow, title] = pageMeta[page] || ['', ''];
  $('#pageEyebrow').textContent = eyebrow;
  $('#pageTitle').textContent = title;
  $('#sidebar').classList.remove('open');
  closeCreateMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderUser() {
  const { user, workspace } = state.data;
  $('#sidebarUserName').textContent = user.name;
  $('#sidebarUserEmail').textContent = `${user.employee_no || '未设置工号'} · ${user.product_view === 'management' ? '主管视角' : '员工视角'}`;
  $('#sidebarAvatar').textContent = user.name.slice(0, 1);
  $('#topAvatar').textContent = user.name.slice(0, 1);
  $('#workspaceName').textContent = workspace.name;
  $('#workspaceLogo').textContent = workspace.name.slice(0, 1);
  const hour = new Date().getHours();
  const greeting = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  $('#welcomeTitle').textContent = `${greeting}，${user.name}`;
  $('#todayBadge').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
}

function renderMetrics() {
  const { approvals, tasks, documents } = state.data;
  const pending = approvals.filter(item => item.status === '待审批').length;
  const openTasks = tasks.filter(item => item.status !== '已完成').length;
  const urgent = tasks.filter(item => ['紧急', '高'].includes(item.priority) && item.status !== '已完成').length;
  $('#metricApprovals').textContent = pending;
  $('#metricTasks').textContent = openTasks;
  $('#metricUrgent').textContent = urgent;
  $('#metricDocs').textContent = documents.length;
  $('#approvalNavCount').textContent = pending;
  $('#welcomeText').textContent = pending || openTasks
    ? `你有 ${pending} 项申请待审批，${openTasks} 项任务尚未完成。`
    : '目前没有待审批的申请或未完成的任务。';
}

function workItems() {
  const approvals = state.data.approvals
    .filter(item => item.status === '待审批')
    .map(item => ({ type: 'approval', id: item.id, title: item.title, detail: `${item.applicant} · ${item.amount}`, urgent: item.urgent, date: item.created_at }));
  const tasks = state.data.tasks
    .filter(item => item.status !== '已完成')
    .map(item => ({ type: 'task', id: item.id, title: item.title, detail: `${item.project} · ${item.owner}`, urgent: ['紧急', '高'].includes(item.priority), date: item.created_at }));
  return [...approvals, ...tasks].sort((a, b) => Number(b.urgent) - Number(a.urgent) || String(b.date).localeCompare(String(a.date)));
}

function renderDashboardWork() {
  const filtered = workItems().filter(item => state.workFilter === 'all'
    || (state.workFilter === 'urgent' && item.urgent)
    || (state.workFilter === 'approval' && item.type === 'approval'));
  $('#dashboardWork').innerHTML = filtered.length ? filtered.slice(0, 7).map(item => `
    <div class="work-item ${item.type === 'task' ? 'task' : ''}">
      <span class="work-icon">${item.type === 'approval' ? '✓' : '▦'}</span>
      <div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}${item.urgent ? ' · 高优先级' : ''}</small></div>
      <button data-open-type="${item.type}" data-open-id="${esc(item.id)}">${item.type === 'approval' && state.data.capabilities.decide_approvals ? '处理审批' : item.type === 'approval' ? '查看申请' : '查看任务'} →</button>
    </div>`).join('') : empty('当前筛选下没有待办');
}

function renderProjects() {
  const groups = new Map();
  state.data.tasks.forEach(task => {
    const project = task.project || '日常工作';
    if (!groups.has(project)) groups.set(project, []);
    groups.get(project).push(task);
  });
  const rows = [...groups.entries()].map(([name, tasks]) => {
    const complete = tasks.filter(task => task.status === '已完成').length;
    const progress = Math.round((complete / tasks.length) * 100);
    const risk = tasks.some(task => ['紧急', '高'].includes(task.priority) && task.status !== '已完成');
    const owners = [...new Set(tasks.map(task => task.owner))];
    return `<div class="project-row">
      <div><strong>${esc(name)}</strong><small>${tasks.length} 项任务 · ${owners.map(esc).join('、')}</small></div>
      <span class="status-pill ${risk ? '已拒绝' : progress === 100 ? '已完成' : '进行中'}">${risk ? '需关注' : progress === 100 ? '已完成' : '推进中'}</span>
      <div class="project-progress"><span><i>完成</i><b>${progress}%</b></span><div class="progress"><i style="width:${progress}%"></i></div></div>
    </div>`;
  });
  $('#projectOverview').innerHTML = rows.length ? rows.join('') : empty('新建任务后，这里会按项目汇总进度');
}

function describeAudit(item) {
  const type = { approval: '审批', task: '任务', document: '资料', member: '成员', member_import: '成员导入', user: '账户' }[item.entity_type] || item.entity_type;
  const action = auditLabels[item.action] || (item.action?.startsWith('imported:') ? `导入 ${item.action.split(':')[1]} 人` : item.action);
  return { type, action };
}

function renderActivity() {
  const items = state.data.audit.slice(0, 6);
  $('#recentActivity').innerHTML = items.length ? items.map(item => {
    const label = describeAudit(item);
    return `<div class="activity-item"><span class="activity-icon">${label.type.slice(0, 1)}</span><div><strong>${esc(label.type)} · ${esc(label.action)}</strong><small>${esc(item.entity_id)}</small></div><time>${formatDate(item.created_at)}</time></div>`;
  }).join('') : empty('完成关键操作后，动态会显示在这里');
}

function approvalFilter() {
  const query = $('#approvalSearch').value.trim().toLowerCase();
  const status = $('#approvalStatus').value;
  const kind = $('#approvalType').value;
  return state.data.approvals.filter(item => {
    const haystack = `${item.title} ${item.applicant} ${item.id}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!status || item.status === status) && (!kind || item.kind === kind);
  });
}

function renderApprovals() {
  const approvals = approvalFilter();
  $('#approvalTable').innerHTML = `<div class="table-row approval-row header"><span>申请事项</span><span>流程</span><span>部门</span><span>金额</span><span>状态</span></div>` + (approvals.length ? approvals.map(item => `
    <div class="table-row approval-row" data-open-type="approval" data-open-id="${esc(item.id)}">
      <div class="cell-main"><span class="tiny-avatar">${initials(item.applicant)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.id)} · ${esc(item.applicant)}</small></div></div>
      <span>${esc(item.kind)}${item.urgent ? '<br><span class="priority 紧急">紧急</span>' : ''}</span>
      <span>${esc(item.department)}</span><strong>${esc(item.amount)}</strong>
      <span class="status-pill ${esc(item.status)}">${esc(item.status)}</span>
    </div>`).join('') : empty('未找到匹配的审批，请调整搜索或筛选条件'));
  const pending = state.data.approvals.filter(item => item.status === '待审批');
  const today = new Date().toDateString();
  $('#approvalPendingStat').textContent = pending.length;
  $('#approvalDoneStat').textContent = state.data.approvals.filter(item => item.decided_at && new Date(item.decided_at).toDateString() === today).length;
  $('#approvalUrgentStat').textContent = pending.filter(item => item.urgent).length;
}

function taskFilter() {
  const query = $('#taskSearch').value.trim().toLowerCase();
  const priority = $('#taskPriority').value;
  const owner = $('#taskOwner').value;
  const due = $('#taskDue').value;
  const today = new Date();
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayText = localDate(today);
  const week = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
  return state.data.tasks.filter(item => {
    const haystack = `${item.title} ${item.description} ${item.project} ${item.owner}`.toLowerCase();
    const mine = item.owner_user_id ? item.owner_user_id === state.data.user.id : item.owner === state.data.user.name;
    const date = item.due_date || '';
    const dueMatch = !due || (due === 'none' ? !date : item.status !== '已完成' && !!date && (due === 'overdue' ? date < todayText : due === 'today' ? date === todayText : date >= todayText && date <= localDate(week)));
    return (!query || haystack.includes(query)) && (!priority || item.priority === priority) && (!owner || mine) && dueMatch;
  });
}

function renderTasks() {
  const filtered = taskFilter();
  $('#kanban').innerHTML = taskStates.map(column => {
    const tasks = filtered.filter(item => item.status === column);
    return `<section class="kanban-column"><div class="kanban-head"><i></i><strong>${column}</strong><span>${tasks.length}</span></div>${tasks.length ? tasks.map(task => `
      <article class="task-card" data-open-type="task" data-open-id="${esc(task.id)}">
        <div class="task-card-top"><span class="task-tag">${esc(task.tag)}</span><span class="priority ${esc(task.priority)}">${esc(task.priority || '普通')}</span></div>
        <h3>${esc(task.title)}</h3><p>${esc(task.description || '暂无说明')}</p><span class="task-project">${esc(task.project || '日常工作')}</span>
        <div class="task-meta"><time>${esc(task.due_date || task.due_text || '待安排')}</time><span class="task-owner">${initials(task.owner)}</span></div>
      </article>`).join('') : `<div class="empty-state compact">当前阶段暂无任务</div>`}</section>`;
  }).join('');
}

function documentFilter() {
  const query = $('#docSearch').value.trim().toLowerCase();
  const sorted = state.data.documents.filter(item => {
    const haystack = `${item.title} ${item.description} ${(item.tags || []).join(' ')}`.toLowerCase();
    const matchesCategory = !state.docCategory || (state.docCategory === '__favorite' ? !!item.favorite : state.docCategory === '__recent' ? !!item.visited_at : item.category === state.docCategory || item.tags?.includes(state.docCategory));
    return (!query || haystack.includes(query)) && matchesCategory;
  });
  if (state.docCategory === '__recent') sorted.sort((a, b) => b.visited_at.localeCompare(a.visited_at));
  else if ($('#docSort').value === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  return sorted;
}

function renderDocuments() {
  const documents = documentFilter();
  $('#docAllCount').textContent = state.data.documents.length;
  $('#documentGrid').innerHTML = documents.length ? documents.map((item, index) => `
    <article class="doc-card" data-open-type="document" data-open-id="${esc(item.id)}">
      <div class="doc-head"><span class="doc-icon ${['violet', 'cyan', 'amber', 'green'][index % 4]}">文</span><span class="status-pill">${esc(item.category || '知识文档')}</span></div>
      <h3>${esc(item.title)}</h3><p>${esc(item.description || '暂无摘要')}</p>
      <div class="tag-row">${(item.tags || []).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
      <div class="doc-footer"><span>${esc(item.author)}</span><time>${formatDate(item.created_at, false)}</time></div>
    </article>`).join('') : empty('未找到匹配的资料，请调整搜索或分类');
}

function memberFilter() {
  const query = $('#memberSearch').value.trim().toLowerCase();
  const department = $('#memberDepartment').value;
  return state.data.members.filter(item => {
    const haystack = `${item.name} ${item.email} ${item.department} ${item.position || ''}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!department || item.department === department);
  });
}

function renderMembers() {
  const members = memberFilter();
  const departments = [...new Set(state.data.members.map(item => item.department))].sort();
  const selected = $('#memberDepartment').value;
  $('#memberDepartment').innerHTML = '<option value="">全部部门</option>' + departments.map(item => `<option ${item === selected ? 'selected' : ''}>${esc(item)}</option>`).join('');
  $('#memberTable').innerHTML = `<div class="table-row member-row header"><span>成员</span><span>部门</span><span>岗位</span><span>角色</span><span>状态</span></div>` + (members.length ? members.map(item => `
    <div class="table-row member-row" data-open-type="member" data-open-id="${esc(item.id)}">
      <div class="cell-main"><span class="tiny-avatar">${initials(item.name)}</span><div><strong>${esc(item.name)}</strong><small>${esc(item.email)}</small></div></div>
      <span>${esc(item.department)}</span><span>${esc(item.position || '员工')}</span><span>${esc(item.role)}</span><span class="status-pill connected">${esc(item.status)}</span>
    </div>`).join('') : empty('未找到匹配的成员，请调整搜索或部门筛选'));
  $('#memberCount').textContent = state.data.members.filter(item => item.status === '有效').length;
  $('#departmentCount').textContent = departments.length;
  $('#managerCount').textContent = state.data.members.filter(item => /负责人|管理员/.test(item.role)).length;
}

function auditFilter() {
  const query = $('#auditSearch').value.trim().toLowerCase();
  const type = $('#auditType').value;
  return state.data.audit.filter(item => {
    const label = describeAudit(item);
    const haystack = `${item.entity_type} ${item.entity_id} ${item.action} ${label.type} ${label.action}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!type || item.entity_type === type);
  });
}

function renderAudit() {
  const records = auditFilter();
  $('#auditTable').innerHTML = `<div class="table-row audit-row header"><span>业务类型</span><span>动作</span><span>实体编号</span><span>时间</span></div>` + (records.length ? records.map(item => {
    const label = describeAudit(item);
    return `<div class="table-row audit-row" data-open-type="audit" data-open-id="${item.id}"><span>${esc(label.type)}</span><strong>${esc(label.action)}</strong><code>${esc(item.entity_id)}</code><time>${formatDate(item.created_at)}</time></div>`;
  }).join('') : empty('未找到匹配的记录，请调整搜索或类型筛选'));
}

function renderNotifications() {
  const notifications = state.data.notifications;
  const unread = notifications.filter(item => !Number(item.is_read)).length;
  $('#notificationCount').textContent = unread;
  $('#notificationCount').hidden = unread === 0;
  $('#notificationList').innerHTML = notifications.length ? notifications.map(item => `
    <div class="notification-item ${Number(item.is_read) ? '' : 'unread'}" data-notification-id="${esc(item.id)}" data-target-type="${esc(item.target_type || '')}" data-target-id="${esc(item.target_id || '')}">
      <span class="work-icon">${item.kind === 'approval' ? '✓' : item.kind === 'task' ? '▦' : '!'}</span>
      <div><strong>${esc(item.title)}</strong><span>${esc(item.message)}</span><time>${formatDate(item.created_at)}</time></div>
    </div>`).join('') : empty('当前没有通知');
}

function renderIntegrations() {
  const { integrations, subscription, audit_count: auditCount } = state.data;
  $('#liveStatus').innerHTML = `<i></i>独立演示`;
  $('#liveStatus').classList.add('online');
  $('#openaiStatus').textContent = integrations.openai ? '已配置' : '待配置';
  $('#openaiStatus').className = `status-pill ${integrations.openai ? 'connected' : ''}`;
  $('#aiConnection').textContent = integrations.openai ? 'OpenAI 已配置' : '本地工作概况';
  $('#aiDot').classList.toggle('connected', integrations.openai);
  $('#stripeStatus').textContent = integrations.stripe ? (subscription ? `订阅${subscription.status}` : '已配置') : '待配置';
  $('#stripeStatus').className = `status-pill ${integrations.stripe ? 'connected' : ''}`;
  $('[data-checkout]').disabled = !integrations.stripe;
  $('[data-checkout]').title = integrations.stripe ? '' : '请先配置 Stripe';
  $('#auditCountSetting').textContent = `${auditCount} 条审计记录`;
}

function applyCapabilities() {
  const management = state.data.product_view === 'management';
  $$('.management-only').forEach(element => { element.hidden = !management; });
  if (!management && ['organization', 'audit', 'settings'].includes(state.page)) navigate('dashboard');
}

function renderAll() {
  applyCapabilities(); renderUser(); renderMetrics(); renderDashboardWork(); renderProjects(); renderActivity();
  renderApprovals(); renderTasks(); renderDocuments(); renderMembers(); renderAudit();
  renderNotifications(); renderIntegrations();
}

async function loadData() {
  state.data = await api('/api/bootstrap');
  state.csrfToken = state.data.csrf_token;
  renderAll();
  $('#appShell').hidden = false;
  $('#authScreen').hidden = true;
}

function closeDrawer() {
  $('#sideDrawer').classList.remove('open');
  $('#sideDrawer').setAttribute('aria-hidden', 'true');
}

function showDrawer(eyebrow, title, body) {
  $('#drawerEyebrow').textContent = eyebrow;
  $('#drawerTitle').textContent = title;
  $('#drawerBody').innerHTML = body;
  $('#sideDrawer').classList.add('open');
  $('#sideDrawer').setAttribute('aria-hidden', 'false');
  closeNotifications();
}

async function openApproval(id) {
  showDrawer('APPROVAL', '加载审批…', '<div class="empty-state">正在读取流程记录</div>');
  try {
    const item = await api(`/api/approvals/${encodeURIComponent(id)}`);
    const decision = item.status === '待审批' && state.data.capabilities.decide_approvals ? `<div class="decision-box"><label class="field"><span>审批意见</span><textarea id="decisionNote" placeholder="填写意见，便于申请人了解决策依据"></textarea></label><div class="decision-actions"><button class="button secondary" data-decide-id="${esc(id)}" data-action="reject">拒绝申请</button><button class="button primary" data-decide-id="${esc(id)}" data-action="approve">通过申请</button></div></div>` : '';
    showDrawer('APPROVAL DETAIL', item.title, `
      <div class="detail-grid"><div><span>申请编号</span><strong>${esc(item.id)}</strong></div><div><span>当前状态</span><strong>${esc(item.status)}</strong></div><div><span>申请人</span><strong>${esc(item.applicant)}</strong></div><div><span>所属部门</span><strong>${esc(item.department)}</strong></div><div><span>流程类型</span><strong>${esc(item.kind)}</strong></div><div><span>金额 / 数量</span><strong>${esc(item.amount)}</strong></div><div><span>当前节点</span><strong>${esc(item.current_step)}</strong></div><div><span>提交时间</span><strong>${formatDate(item.created_at)}</strong></div></div>
      <section class="detail-section"><h3>申请说明</h3><p>${esc(item.description || '未填写说明')}</p></section>
      <section class="detail-section"><h3>流程记录</h3><div class="timeline">${item.history.map(entry => `<div class="timeline-item"><strong>${esc(entry.action)} · ${esc(entry.actor)}</strong><small>${esc(entry.note)} · ${formatDate(entry.created_at)}</small></div>`).join('')}</div></section>${decision}`);
  } catch (error) {
    showDrawer('APPROVAL', '读取失败', empty(error.message));
  }
}

function openTask(id) {
  const item = state.data.tasks.find(task => task.id === id);
  if (!item) return;
  const nextIndex = taskStates.indexOf(item.status) + 1;
  showDrawer('TASK DETAIL', item.title, `
    <form id="taskDetailForm" data-task-id="${esc(item.id)}">
      <div class="detail-grid"><div><span>任务编号</span><strong>${esc(item.id.slice(0, 8))}</strong></div><div><span>当前状态</span><strong>${esc(item.status)}</strong></div></div>
      <label class="field"><span>任务标题</span><input name="title" required value="${esc(item.title)}"></label>
      <label class="field"><span>任务说明</span><textarea name="description">${esc(item.description)}</textarea></label>
      <label class="field"><span>所属项目</span><input name="project" value="${esc(item.project)}"></label>
      <div class="detail-grid"><label class="field"><span>负责人</span>${ownerSelect(item.owner)}</label><label class="field"><span>优先级</span><select name="priority">${['紧急', '高', '普通', '低'].map(value => `<option ${value === item.priority ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <div class="detail-grid"><label class="field"><span>分类标签</span><input name="tag" value="${esc(item.tag)}"></label><label class="field"><span>截止日期</span><input name="due_date" type="date" value="${esc(item.due_date)}"></label></div>
      <div class="decision-actions"><button class="button secondary" type="submit">保存修改</button>${nextIndex < taskStates.length ? `<button class="button primary" type="button" data-advance-task="${esc(item.id)}">推进至${taskStates[nextIndex]}</button>` : ''}</div>
    </form>`);
}

async function openDocument(id) {
  const item = state.data.documents.find(document => document.id === id);
  if (!item) return;
  showDrawer('KNOWLEDGE', item.title, `<div class="detail-grid"><div><span>分类</span><strong>${esc(item.category)}</strong></div><div><span>作者</span><strong>${esc(item.author)}</strong></div><div><span>创建时间</span><strong>${formatDate(item.created_at, false)}</strong></div><div><span>资料编号</span><strong>${esc(item.id.slice(0, 8))}</strong></div></div>${item.category === '合同草稿' ? `<p class="security-note">草稿仅供起草，签署前请结合交易情况审核。</p><form id="contractEditForm" data-id="${esc(item.id)}"><label class="field"><span>合同标题</span><input name="title" required value="${esc(item.title)}"></label><label class="field"><span>合同正文</span><textarea name="description" required rows="18">${esc(item.description)}</textarea></label><div class="decision-actions"><button class="button primary" type="submit">保存修改</button><button class="button secondary" type="button" data-download-contract="${esc(item.id)}">下载文本</button></div></form>` : `<section class="detail-section"><h3>内容摘要</h3><p>${esc(item.description || '暂无摘要')}</p></section><section class="detail-section"><h3>标签</h3><div class="tag-row">${(item.tags || []).map(tag => `<span class="tag">${esc(tag)}</span>`).join('') || '<span class="tag">未分类</span>'}</div></section>`}<button class="button secondary" data-favorite-id="${esc(item.id)}">${item.favorite ? '取消收藏' : '收藏资料'}</button>`);
  try { await api(`/api/documents/${encodeURIComponent(id)}/preference`, { method: 'POST', body: JSON.stringify({ action: 'visit' }) }); await loadData(); }
  catch (error) { toast(`访问记录未保存：${error.message}`); }
}

function openMember(id) {
  const item = state.data.members.find(member => member.id === id);
  if (!item) return;
  showDrawer('MEMBER PROFILE', item.name, `<div class="detail-grid"><div><span>邮箱</span><strong>${esc(item.email)}</strong></div><div><span>状态</span><strong>${esc(item.status)}</strong></div><div><span>部门</span><strong>${esc(item.department)}</strong></div><div><span>岗位</span><strong>${esc(item.position || '员工')}</strong></div><div><span>档案角色</span><strong>${esc(item.role)}</strong></div><div><span>加入时间</span><strong>${formatDate(item.created_at, false)}</strong></div></div><section class="detail-section"><h3>账户状态</h3><p>${item.user_id ? '已关联登录账户。实际权限以账户设置为准。' : '仅有成员档案，尚未关联登录账户；可通过批量导入创建激活信息。'}</p></section>`);
}

function openAudit(id) {
  const item = state.data.audit.find(record => String(record.id) === String(id));
  if (!item) return;
  const label = describeAudit(item);
  showDrawer('AUDIT EVENT', label.action, `<div class="detail-grid"><div><span>事件编号</span><strong>#${esc(item.id)}</strong></div><div><span>业务类型</span><strong>${esc(label.type)}</strong></div><div><span>实体编号</span><strong>${esc(item.entity_id)}</strong></div><div><span>记录时间</span><strong>${formatDate(item.created_at)}</strong></div></div><section class="detail-section"><h3>原始动作</h3><p><code>${esc(item.action)}</code></p></section><p class="security-note">审计事件由服务端在关键写入完成时自动生成，前端不提供修改或删除入口。</p>`);
}

function openProfile() {
  const user = state.data.user;
  showDrawer('DEMO', '演示身份', `<p>当前为虚构的主管身份，操作仅保存在本浏览器，不与其他访问者共享。</p>`);
}

function openEntity(type, id) {
  closeSearch();
  if (type === 'approval') return openApproval(id);
  if (type === 'task') return openTask(id);
  if (type === 'document') return openDocument(id);
  if (type === 'member') return openMember(id);
  if (type === 'audit') return openAudit(id);
}

function ownerSelect(selected) {
  if (state.data.product_view !== 'management') return `<input name="owner" value="${esc(selected)}" readonly>`;
  const names = [...new Set(state.data.members.filter(member => member.user_id && member.status === '有效').map(member => member.name))];
  if (!names.includes(selected)) names.unshift(selected);
  return `<select name="owner">${names.map(name => `<option ${name === selected ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
}

const formDefinitions = {
  contract: {
    eyebrow: 'CONTRACT DRAFT', title: '制作合同草稿', submit: '保存草稿', path: '/api/documents', success: '合同草稿已保存到知识与资料',
    body: () => `<p class="security-note span-2">这是通用起草框架，不包含完整交易条款。请核对主体、税费、交付、付款、违约和争议解决条款，签署前由专业人员审核。</p><label class="field span-2"><span>合同标题</span><input name="title" required placeholder="例如：设备采购合同"></label><label class="field"><span>甲方</span><input name="party_a" placeholder="甲方全称"></label><label class="field"><span>乙方</span><input name="party_b" placeholder="乙方全称"></label><label class="field span-2"><span>交易内容</span><input name="subject" placeholder="例如：设备采购与交付"></label><label class="field"><span>合同金额</span><input name="amount" placeholder="例如：人民币 100,000 元"></label><label class="field"><span>履行期限</span><input name="term" placeholder="例如：2026 年 12 月 31 日前"></label><button class="button secondary span-2" type="button" data-generate-contract>根据填写内容生成草稿</button><label class="field span-2"><span>合同正文（可编辑）</span><textarea name="description" rows="14" required placeholder="点击生成草稿，或自行输入正文"></textarea></label><input type="hidden" name="category" value="合同草稿"><input type="hidden" name="author" value="${esc(state.data.user.name)}">`,
  },
  approval: {
    eyebrow: 'NEW WORKFLOW', title: '发起审批', submit: '提交审批', path: '/api/approvals', success: '审批已提交并进入流程',
    body: () => `<label class="field span-2"><span>申请事项</span><input name="title" required placeholder="例如：采购设计团队工作站"></label><label class="field"><span>流程类型</span><select name="kind"><option>采购申请</option><option>费用报销</option><option>合同审批</option><option>通用审批</option></select></label><label class="field"><span>所属部门</span><input name="department" required placeholder="例如：研发中心"></label><label class="field"><span>金额 / 数量</span><input name="amount" required placeholder="例如：¥ 48,600"></label><label class="field"><span>当前审批节点</span><input name="current_step" value="直属主管审批"></label><label class="field span-2"><span>申请说明</span><textarea name="description" placeholder="说明业务背景、用途与预期结果"></textarea></label><label class="checkbox-field span-2"><input name="urgent" type="checkbox"> 标记为紧急申请</label><input type="hidden" name="applicant" value="${esc(state.data.user.name)}">`,
  },
  task: {
    eyebrow: 'NEW TASK', title: '新建任务', submit: '创建任务', path: '/api/tasks', success: '任务已创建并分配',
    body: () => `<label class="field span-2"><span>任务标题</span><input name="title" required placeholder="明确描述要交付的结果"></label><label class="field"><span>所属项目</span><input name="project" required value="日常工作"></label><label class="field"><span>负责人（已激活账户）</span>${ownerSelect(state.data.user.name)}</label><label class="field"><span>优先级</span><select name="priority"><option>紧急</option><option>高</option><option selected>普通</option><option>低</option></select></label><label class="field"><span>截止日期</span><input name="due_date" type="date"></label><label class="field"><span>分类标签</span><input name="tag" value="任务"></label><label class="field"><span>时间提示</span><input name="due_text" value="待安排"></label><label class="field span-2"><span>任务说明</span><textarea name="description" placeholder="补充验收标准、依赖项和交付要求"></textarea></label>`,
  },
  document: {
    eyebrow: 'NEW KNOWLEDGE', title: '新建资料', submit: '保存资料', path: '/api/documents', success: '资料已保存到知识库',
    body: () => `<label class="field span-2"><span>资料标题</span><input name="title" required placeholder="便于团队搜索的清晰标题"></label><label class="field"><span>分类</span><select name="category"><option>公司制度</option><option>项目文档</option><option>合同模板</option><option>培训资料</option><option>知识文档</option></select></label><label class="field"><span>作者 / 维护人</span><input name="author" value="${esc(state.data.user.name)}"></label><label class="field span-2"><span>标签</span><input name="tags" placeholder="多个标签用逗号分隔，例如：制度, 财务, 重要"></label><label class="field span-2"><span>内容摘要</span><textarea name="description" placeholder="概述资料范围、使用场景和注意事项"></textarea></label>`,
  },
  member: {
    eyebrow: 'NEW MEMBER', title: '添加成员档案', submit: '保存档案', path: '/api/members', success: '成员档案已保存；登录账户需通过批量导入激活',
    body: () => `<p class="security-note span-2">此处创建成员档案。需要登录时，请使用批量导入生成激活码；档案角色不会自动授予系统权限。</p><label class="field"><span>姓名</span><input name="name" required placeholder="成员姓名"></label><label class="field"><span>工作邮箱</span><input name="email" type="email" required placeholder="name@company.com"></label><label class="field"><span>部门</span><input name="department" required placeholder="例如：产品部"></label><label class="field"><span>岗位</span><input name="position" required placeholder="例如：产品经理"></label><label class="field span-2"><span>档案角色</span><select name="role"><option>普通成员</option><option>流程负责人</option><option>部门负责人</option><option>管理员</option></select></label>`,
  },
};

function openForm(type) {
  const definition = formDefinitions[type];
  if (!definition) return;
  $('#modalEyebrow').textContent = definition.eyebrow;
  $('#modalTitle').textContent = definition.title;
  $('#modalSubmit').textContent = definition.submit;
  $('#modalBody').innerHTML = definition.body();
  $('#entityForm').dataset.formType = type;
  $('#modalLayer').hidden = false;
  closeCreateMenu();
  setTimeout(() => $('#modalBody input:not([type="hidden"])')?.focus(), 0);
}

function closeModal() {
  $('#modalLayer').hidden = true;
  $('#entityForm').reset();
}

function formPayload(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach(input => { payload[input.name] = input.checked; });
  if ('tags' in payload) payload.tags = payload.tags.split(/[,，]/).map(value => value.trim()).filter(Boolean);
  return payload;
}

function openSearch() {
  $('#searchPalette').hidden = false;
  $('#globalSearch').value = '';
  $('#globalResults').innerHTML = '<div class="empty-state compact">输入关键词开始搜索</div>';
  setTimeout(() => $('#globalSearch').focus(), 0);
}

function closeSearch() { $('#searchPalette').hidden = true; }

function renderGlobalSearch(query) {
  const key = query.trim().toLowerCase();
  if (!key) {
    $('#globalResults').innerHTML = '<div class="empty-state compact">输入关键词开始搜索</div>';
    return;
  }
  const groups = [
    ...state.data.approvals.map(item => ({ type: 'approval', id: item.id, title: item.title, detail: `审批 · ${item.applicant} · ${item.status}` })),
    ...state.data.tasks.map(item => ({ type: 'task', id: item.id, title: item.title, detail: `任务 · ${item.project} · ${item.status}` })),
    ...state.data.documents.map(item => ({ type: 'document', id: item.id, title: item.title, detail: `资料 · ${item.category}` })),
    ...state.data.members.map(item => ({ type: 'member', id: item.id, title: item.name, detail: `成员 · ${item.department} · ${item.email}` })),
  ].filter(item => `${item.title} ${item.detail} ${item.id}`.toLowerCase().includes(key)).slice(0, 12);
  $('#globalResults').innerHTML = groups.length ? groups.map(item => `<div class="search-result" data-open-type="${item.type}" data-open-id="${esc(item.id)}"><span class="work-icon">${item.type === 'approval' ? '✓' : item.type === 'task' ? '▦' : item.type === 'document' ? '◇' : '◎'}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div></div>`).join('') : empty('没有找到匹配结果');
}

function toggleCreateMenu() { $('#createMenu').hidden = !$('#createMenu').hidden; }
function closeCreateMenu() { $('#createMenu').hidden = true; }

function openNotifications() {
  renderNotifications();
  $('#notificationDrawer').classList.add('open');
  $('#notificationDrawer').setAttribute('aria-hidden', 'false');
  closeDrawer(); closeCreateMenu();
}

function closeNotifications() {
  $('#notificationDrawer').classList.remove('open');
  $('#notificationDrawer').setAttribute('aria-hidden', 'true');
}

function addChat(text, role) {
  const container = $('#chatMessages');
  container.querySelector('.chat-empty')?.remove();
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.innerHTML = role === 'user' ? `<p>${esc(text)}</p>` : `<div class="assistant-avatar">✦</div><div><p>${esc(text)}</p></div>`;
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

async function askAssistant(question) {
  addChat(question, 'user');
  $('#chatForm').classList.add('loading');
  try {
    const result = await api('/api/chat', { method: 'POST', body: JSON.stringify({ question }) });
    addChat(result.answer, 'assistant');
  } catch (error) {
    addChat(`暂时无法调用外部模型：${error.message}。请在“系统与集成”中检查配置。`, 'assistant');
  } finally { $('#chatForm').classList.remove('loading'); }
}

async function refresh(message) {
  await loadData();
  if (message) toast(message);
}

document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-page]');
  if (nav) navigate(nav.dataset.page);
  const formButton = event.target.closest('[data-open-form]');
  if (formButton) openForm(formButton.dataset.openForm);
  const entity = event.target.closest('[data-open-type]');
  if (entity) openEntity(entity.dataset.openType, entity.dataset.openId);
  if (event.target.closest('[data-close-drawer]')) closeDrawer();
  if (event.target.closest('[data-close-notifications]')) closeNotifications();
  if (event.target.closest('[data-close-modal]')) closeModal();
  if (event.target === $('#modalLayer')) closeModal();
  if (event.target === $('#searchPalette')) closeSearch();
  if (!event.target.closest('#createMenu') && !event.target.closest('#quickCreate')) closeCreateMenu();

  const workFilter = event.target.closest('[data-work-filter]');
  if (workFilter) {
    state.workFilter = workFilter.dataset.workFilter;
    $$('#workTabs button').forEach(button => button.classList.toggle('active', button === workFilter));
    renderDashboardWork();
  }
  const category = event.target.closest('[data-category]');
  if (category) {
    state.docCategory = category.dataset.category;
    $$('[data-category]').forEach(button => button.classList.toggle('active', button === category));
    renderDocuments();
  }
  const question = event.target.closest('[data-question]');
  if (question) { navigate('assistant'); askAssistant(question.dataset.question); }

  const decision = event.target.closest('[data-decide-id]');
  const advance = event.target.closest('[data-advance-task]');
  const notification = event.target.closest('[data-notification-id]');
  const checkout = event.target.closest('[data-checkout]');
  const favorite = event.target.closest('[data-favorite-id]');
  const download = event.target.closest('[data-download-contract]');
  if (event.target.closest('[data-generate-contract]')) {
    const form = $('#entityForm');
    const field = name => form.elements[name].value.trim() || '【待填写】';
    const target = form.elements.description;
    if (target.value.trim() && !window.confirm('生成草稿会替换当前正文，是否继续？')) return;
    target.value = `${field('title')}\n\n甲方：${field('party_a')}\n乙方：${field('party_b')}\n\n一、交易内容\n${field('subject')}。具体范围、规格和验收标准：【待双方确认】。\n\n二、合同价款与支付\n合同金额：${field('amount')}。税费、发票、付款节点及账户：【待双方确认】。\n\n三、履行与验收\n履行期限：${field('term')}。交付地点、方式和验收程序：【待双方确认】。\n\n四、双方权利义务\n【结合具体交易填写】\n\n五、违约责任及合同解除\n【结合具体交易填写】\n\n六、争议解决\n【明确协商、诉讼或仲裁方式及具体地点】\n\n七、其他约定\n【填写生效条件、份数及附件】\n\n甲方（签章）：____________    日期：____________\n乙方（签章）：____________    日期：____________`;
  }
  if (download) {
    const form = $('#contractEditForm');
    const blob = new Blob([form.elements.description.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${form.elements.title.value.replace(/[\\/:*?"<>|]/g, '_') || '合同草稿'}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  try {
    if (decision) {
      decision.closest('.decision-actions').classList.add('loading');
      await api(`/api/approvals/${encodeURIComponent(decision.dataset.decideId)}`, { method: 'PATCH', body: JSON.stringify({ action: decision.dataset.action, note: $('#decisionNote').value.trim() }) });
      closeDrawer();
      await refresh(decision.dataset.action === 'approve' ? '审批已通过，流程记录已更新' : '审批已拒绝，申请人将收到通知');
    }
    if (advance) {
      await api(`/api/tasks/${encodeURIComponent(advance.dataset.advanceTask)}`, { method: 'PATCH', body: JSON.stringify({ action: 'advance' }) });
      closeDrawer(); await refresh('任务已推进到下一阶段');
    }
    if (notification) {
      await api('/api/notifications/read', { method: 'POST', body: JSON.stringify({ id: notification.dataset.notificationId }) });
      const target = notification.dataset.targetId === 'projects' ? 'tasks' : notification.dataset.targetId;
      await loadData();
      if (notification.dataset.targetType === 'page' && pageMeta[target]) navigate(target);
      closeNotifications();
      if (['approval', 'task', 'document'].includes(notification.dataset.targetType)) openEntity(notification.dataset.targetType, notification.dataset.targetId);
    }
    if (favorite) {
      const item = state.data.documents.find(document => document.id === favorite.dataset.favoriteId);
      if (item) { await api(`/api/documents/${encodeURIComponent(item.id)}/preference`, { method: 'POST', body: JSON.stringify({ action: item.favorite ? 'unfavorite' : 'favorite' }) }); await loadData(); favorite.textContent = item.favorite ? '收藏资料' : '取消收藏'; toast(item.favorite ? '已取消收藏' : '已收藏'); }
    }
    if (checkout) {
      checkout.classList.add('loading');
      const result = await api('/api/billing/checkout', { method: 'POST', body: '{}' });
      window.location.assign(result.url);
    }
    if (event.target.closest('[data-logout]')) {
      await api('/api/auth/logout', { method: 'POST', body: '{}' });
      window.location.reload();
    }
  } catch (error) {
    toast(error.message);
    decision?.closest('.decision-actions')?.classList.remove('loading');
    checkout?.classList.remove('loading');
  }
});

$('#entityForm').addEventListener('submit', async event => {
  event.preventDefault();
  const definition = formDefinitions[event.currentTarget.dataset.formType];
  $('#modalSubmit').classList.add('loading');
  $('#modalSubmit').disabled = true;
  try {
    await api(definition.path, { method: 'POST', body: JSON.stringify(formPayload(event.currentTarget)) });
    closeModal(); await refresh(definition.success);
  } catch (error) { toast(error.message); }
  finally { $('#modalSubmit').classList.remove('loading'); $('#modalSubmit').disabled = false; }
});

$('#drawerBody').addEventListener('submit', async event => {
  if (event.target.id === 'contractEditForm') {
    event.preventDefault();
    try { await api(`/api/contracts/${encodeURIComponent(event.target.dataset.id)}`, { method: 'PATCH', body: JSON.stringify(formPayload(event.target)) }); await loadData(); toast('合同草稿已保存'); }
    catch (error) { toast(error.message); }
    return;
  }
  if (event.target.id !== 'taskDetailForm') return;
  event.preventDefault();
  const form = event.target;
  form.classList.add('loading');
  try {
    await api(`/api/tasks/${encodeURIComponent(form.dataset.taskId)}`, { method: 'PATCH', body: JSON.stringify(formPayload(form)) });
    closeDrawer(); await refresh('任务信息已保存');
  } catch (error) { toast(error.message); form.classList.remove('loading'); }
});

$('#chatForm').addEventListener('submit', event => {
  event.preventDefault();
  const question = $('#chatInput').value.trim();
  if (!question) return;
  $('#chatInput').value = '';
  askAssistant(question);
});

$('#chatInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#chatForm').requestSubmit(); }
});

$('#newChat').addEventListener('click', () => {
  $('#chatMessages').innerHTML = '<div class="chat-empty"><div class="assistant-avatar large">✦</div><h2>新对话已准备好</h2><p>你可以继续查询当前工作区的审批、任务和资料概况。</p></div>';
});

$('#quickCreate').addEventListener('click', event => { event.stopPropagation(); toggleCreateMenu(); });
$('#globalSearchButton').addEventListener('click', openSearch);
$('#globalSearch').addEventListener('input', event => renderGlobalSearch(event.target.value));
$('#notificationButton').addEventListener('click', openNotifications);
$('#profileButton').addEventListener('click', openProfile);
$('#userMenu').addEventListener('click', openProfile);
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

$('#markAllRead').addEventListener('click', async () => {
  try { await api('/api/notifications/read', { method: 'POST', body: '{}' }); await loadData(); toast('所有通知已标记为已读'); }
  catch (error) { toast(error.message); }
});

$('#activationModeButton').addEventListener('click', () => { activationMode = true; setupMode = false; initialize(); });

$('#importMembers').addEventListener('click', () => $('#memberCsv').click());
$('#memberCsv').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  $('#importMembers').classList.add('loading');
  try {
    const preview = await api('/api/import/members/preview', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: await file.arrayBuffer() });
    let result;
    if (preview.replayed) {
      result = preview;
    } else {
      const errors = preview.rows.filter(row => !row.valid).slice(0, 10).map(row => `第 ${row.line} 行：${row.errors.join('；')}`).join('\n');
      if (!preview.valid) { window.alert(`没有可导入的成员。\n${errors}`); return; }
      if (!window.confirm(`已校验 ${preview.total} 行：${preview.valid} 行可导入，${preview.invalid} 行有错误。${errors ? `\n\n${errors}${preview.invalid > 10 ? '\n其余错误请检查文件' : ''}` : ''}\n\n确认导入有效行？`)) return;
      result = await api('/api/import/members/confirm', { method: 'POST', body: JSON.stringify({ job_id: preview.job_id }) });
    }
    await refresh(`${preview.replayed ? '已返回原导入结果：' : ''}新增 ${result.imported} 人、更新 ${result.updated} 人，失败 ${result.failed} 人`);
    if (result.activation_codes?.length) {
      showDrawer('EMPLOYEE ACTIVATION', '员工激活信息', `<p class="security-note">激活码 15 分钟内有效，只展示本次结果。</p><div class="timeline">${result.activation_codes.map(item => `<div class="timeline-item"><strong>${esc(item.name)} · ${esc(item.employee_no)}</strong><small>激活码：<code>${esc(item.activation_code)}</code></small></div>`).join('')}</div>`);
    }
  } catch (error) { toast(error.message); }
  finally { event.target.value = ''; $('#importMembers').classList.remove('loading'); }
});

['approvalSearch', 'approvalStatus', 'approvalType'].forEach(id => $(`#${id}`).addEventListener(id === 'approvalSearch' ? 'input' : 'change', renderApprovals));
['taskSearch', 'taskOwner', 'taskDue', 'taskPriority'].forEach(id => $(`#${id}`).addEventListener(id === 'taskSearch' ? 'input' : 'change', renderTasks));
['docSearch', 'docSort'].forEach(id => $(`#${id}`).addEventListener(id === 'docSearch' ? 'input' : 'change', renderDocuments));
['memberSearch', 'memberDepartment'].forEach(id => $(`#${id}`).addEventListener(id === 'memberSearch' ? 'input' : 'change', renderMembers));
['auditSearch', 'auditType'].forEach(id => $(`#${id}`).addEventListener(id === 'auditSearch' ? 'input' : 'change', renderAudit));

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
  if (event.key === 'Escape') { closeSearch(); closeModal(); closeDrawer(); closeNotifications(); closeCreateMenu(); }
});

let setupMode = false;
let activationMode = false;
async function initialize() {
  try { await loadData(); return; }
  catch (error) { if (!/登录|失效/.test(error.message)) throw error; }
  const status = await api('/api/auth/status');
  if (status.demo) {
    await api('/api/auth/demo', { method: 'POST', headers: { 'X-CWM-Demo': '1' }, body: '{}' });
    await loadData();
    return;
  }
  setupMode = status.needs_setup;
  $('#authTitle').textContent = setupMode ? '创建首个主管' : activationMode ? '激活员工账号' : '登录智流工作台';
  $('#authEyebrow').textContent = setupMode ? '首次安全配置' : activationMode ? '首次登录激活' : '安全登录';
  $('#authHint').textContent = setupMode ? '创建企业工作空间及首位主管，系统将根据工号授予管理视角。' : '填写公司名称或租户编码、员工工号和安全密码。';
  $('#authSubmit').textContent = setupMode ? '创建账户并进入' : activationMode ? '设置密码并激活' : '登录工作台';
  $$('.setup-only').forEach(element => { element.hidden = !setupMode; });
  $$('.login-only').forEach(element => { element.hidden = setupMode || activationMode; });
  $$('.non-setup-only').forEach(element => { element.hidden = setupMode; });
  $$('.activation-only').forEach(element => { element.hidden = !activationMode; });
  $('#authWorkspace').required = setupMode;
  $('#authTenantCode').required = setupMode;
  $('#authName').required = setupMode;
  $('#authEmail').required = setupMode;
  $('#authCompany').required = !setupMode;
  $('#authActivationCode').required = activationMode;
  $('#authPassword').autocomplete = setupMode ? 'new-password' : 'current-password';
  $('#authScreen').hidden = false;
}

$('#authForm').addEventListener('submit', async event => {
  event.preventDefault();
  const error = $('#authError');
  error.textContent = '';
  $('#authSubmit').disabled = true;
  $('#authSubmit').classList.add('loading');
  try {
    const payload = setupMode
      ? { workspace_name: $('#authWorkspace').value, tenant_code: $('#authTenantCode').value, name: $('#authName').value, email: $('#authEmail').value, employee_no: $('#authEmployeeNo').value, password: $('#authPassword').value }
      : activationMode
        ? { company: $('#authCompany').value, employee_no: $('#authEmployeeNo').value, activation_code: $('#authActivationCode').value, new_password: $('#authPassword').value }
        : { company: $('#authCompany').value, employee_no: $('#authEmployeeNo').value, password: $('#authPassword').value };
    const endpoint = setupMode ? '/api/auth/setup' : activationMode ? '/api/auth/activate' : '/api/auth/login';
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    if (activationMode) {
      activationMode = false; setupMode = false; await initialize(); toast('账号已激活，请使用新密码登录'); return;
    }
    state.csrfToken = result.csrf_token;
    await loadData();
  } catch (reason) { error.textContent = reason.message; }
  finally { $('#authSubmit').disabled = false; $('#authSubmit').classList.remove('loading'); }
});

if (location.protocol === 'file:') {
  $('#authError').textContent = '请运行“启动演示版.ps1”，然后打开 http://127.0.0.1:8081/，不要直接打开此文件。';
} else initialize().catch(error => {
  $('#authError').textContent = `服务未连接：${error.message}`;
  $('#authScreen').hidden = false;
});
