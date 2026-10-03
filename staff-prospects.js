/* Bodibe Digital — Prospect Bank */
(function(window,document){
  'use strict';
  var Portal=window.BodibePortal;if(!Portal)return;
  var esc=Portal.escapeHtml;
  var state={prospects:[],summary:{},salesStaff:[],next15:[],status:'',search:'',industry:'',selected:new Set()};
  var rows=document.getElementById('prospectRows'),count=document.getElementById('prospectCount'),bulkbar=document.getElementById('prospectBulkbar'),selectedCount=document.getElementById('selectedCount');
  var dialog=document.getElementById('prospectDialog'),queueDialog=document.getElementById('queueDialog'),releaseDialog=document.getElementById('releaseDialog');

  function notify(message,kind){var el=document.getElementById('portalNotice');if(!el)return;el.textContent=message;el.classList.toggle('is-warning',kind==='error');el.hidden=false;if(kind!=='error')setTimeout(function(){el.hidden=true},4500)}
  async function json(path,options){var opts=options||{};opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});var res=await Portal.authedFetch(path,opts),data={};try{data=await res.json()}catch(e){}if(!res.ok||data.success===false)throw new Error(data.message||('Request failed ('+res.status+')'));return data}
  function statusClass(value){return String(value||'new').toLowerCase().replace(/\s+/g,'-')}
  function staffName(id){var p=state.salesStaff.find(function(s){return String(s.staffId)===String(id)});return p?p.name:(id||'—')}
  function channel(p){var bits=[];if(p.email&&p.email!=='Unknown')bits.push(p.email);if(p.phone)bits.push(p.phone);if(p.websiteSocial)bits.push(p.websiteSocial);return bits.join(' · ')||'No contact route yet'}
  function editable(p){return !p.importedLeadId&&p.status!=='Released'}

  function updateSummary(){
    var s=state.summary||{};
    document.getElementById('kpiTotal').textContent=s.total||0;document.getElementById('kpiReady').textContent=s.ready||0;document.getElementById('kpiQueued').textContent=s.queued||0;document.getElementById('kpiReleased').textContent=s.released||0;
    document.getElementById('next15Count').textContent=(state.next15||[]).length;
  }
  function industries(){var values=Array.from(new Set(state.prospects.map(function(p){return p.industry}).filter(Boolean))).sort();var select=document.getElementById('industryFilter'),current=select.value;select.innerHTML='<option value="">All industries</option>'+values.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>'}).join('');select.value=current&&values.indexOf(current)>=0?current:''}
  function filtered(){var q=state.search.toLowerCase();return state.prospects.filter(function(p){if(state.status&&p.status!==state.status)return false;if(state.industry&&p.industry!==state.industry)return false;if(!q)return true;return [p.prospectId,p.businessName,p.contactName,p.email,p.phone,p.websiteSocial,p.industry,p.location,p.source].join(' ').toLowerCase().indexOf(q)>=0})}
  function syncBulk(){var n=state.selected.size;selectedCount.textContent=n+' selected';bulkbar.hidden=!n;var all=document.getElementById('selectAllProspects');var visible=filtered().filter(editable);all.checked=visible.length>0&&visible.every(function(p){return state.selected.has(p.prospectId)});all.indeterminate=!all.checked&&visible.some(function(p){return state.selected.has(p.prospectId)})}
  function render(){
    var data=filtered();count.textContent=data.length+' prospect'+(data.length===1?'':'s');
    if(!data.length){rows.innerHTML='<tr><td colspan="10" class="prospect-empty">No prospects match these filters.</td></tr>';return syncBulk()}
    rows.innerHTML=data.map(function(p){var next=state.next15.indexOf(p.prospectId)>=0;return '<tr'+(next?' data-next="true"':'')+'>'+
      '<td class="check">'+(editable(p)?'<input class="prospect-check" type="checkbox" data-id="'+esc(p.prospectId)+'" '+(state.selected.has(p.prospectId)?'checked':'')+' aria-label="Select '+esc(p.businessName)+'" />':'')+'</td>'+
      '<td><span class="prospect-id">'+esc(p.prospectId)+'</span><span class="prospect-muted">'+esc(p.dateAdded||'')+(next?' · Next batch':'')+'</span></td>'+
      '<td><span class="prospect-primary">'+esc(p.businessName||'—')+'</span><span class="prospect-muted">'+esc(p.source||'No source')+'</span></td>'+
      '<td><span class="prospect-primary">'+esc(p.contactName||'Unknown')+'</span><span class="prospect-muted" title="'+esc(channel(p))+'">'+esc(channel(p))+'</span></td>'+
      '<td>'+esc(p.industry||'—')+'</td><td>'+esc(p.location||'—')+'</td>'+
      '<td><span class="prospect-pill '+statusClass(p.status)+'">'+esc(p.status||'New')+'</span></td>'+
      '<td>'+esc(p.scheduledReleaseDate||'—')+'</td><td>'+esc(staffName(p.assignedTo))+'</td>'+
      '<td><button class="prospect-row-btn" data-open="'+esc(p.prospectId)+'" type="button" aria-label="Open prospect"><i class="fa-solid fa-chevron-right"></i></button></td></tr>'}).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.prospect-check'),function(cb){cb.addEventListener('change',function(){if(cb.checked)state.selected.add(cb.dataset.id);else state.selected.delete(cb.dataset.id);syncBulk()})});
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'),function(btn){btn.addEventListener('click',function(){openDrawer(btn.dataset.open)})});
    syncBulk();
  }
  function renderStaff(){var options='<option value="">Choose Sales staff</option>'+state.salesStaff.map(function(s){return '<option value="'+esc(s.staffId)+'">'+esc(s.name)+' · '+esc(s.role)+'</option>'}).join('');document.getElementById('queueAssignee').innerHTML=options;document.getElementById('releaseAssignee').innerHTML=options;var lloyd=state.salesStaff.find(function(s){return s.staffId==='EMP002'});if(lloyd){document.getElementById('queueAssignee').value=lloyd.staffId;document.getElementById('releaseAssignee').value=lloyd.staffId}}

  async function load(){try{var data=await json('/staff/prospects');state.prospects=data.prospects||[];state.summary=data.summary||{};state.salesStaff=data.salesStaff||[];state.next15=data.next15||[];state.selected.clear();updateSummary();industries();renderStaff();render()}catch(e){rows.innerHTML='<tr><td colspan="10" class="prospect-empty">'+esc(e.message)+'</td></tr>';notify(e.message,'error')}}

  function openProspectForm(p){p=p||{};document.getElementById('editProspectId').value=p.prospectId||'';document.getElementById('prospectDialogTitle').textContent=p.prospectId?'Edit prospect':'Add prospect';document.getElementById('pBusiness').value=p.businessName||'';document.getElementById('pContact').value=p.contactName==='Unknown'?'':(p.contactName||'');document.getElementById('pEmail').value=p.email==='Unknown'?'':(p.email||'');document.getElementById('pPhone').value=p.phone||'';document.getElementById('pWebsite').value=p.websiteSocial||'';document.getElementById('pIndustry').value=p.industry||'';document.getElementById('pLocation').value=p.location||'';document.getElementById('pSource').value=p.source||'';document.getElementById('pReference').value=p.screenshotReference||'';document.getElementById('pNotes').value=p.opportunityNotes||'';dialog.showModal()}
  function formPayload(){return {businessName:document.getElementById('pBusiness').value,contactName:document.getElementById('pContact').value||'Unknown',email:document.getElementById('pEmail').value||'Unknown',phone:document.getElementById('pPhone').value,websiteSocial:document.getElementById('pWebsite').value,industry:document.getElementById('pIndustry').value,location:document.getElementById('pLocation').value,source:document.getElementById('pSource').value,opportunityNotes:document.getElementById('pNotes').value,screenshotReference:document.getElementById('pReference').value}}
  document.getElementById('prospectForm').addEventListener('submit',async function(e){e.preventDefault();var id=document.getElementById('editProspectId').value,btn=document.getElementById('saveProspect');btn.disabled=true;try{await json(id?'/staff/prospects/'+encodeURIComponent(id):'/staff/prospects',{method:id?'PATCH':'POST',body:JSON.stringify(formPayload())});dialog.close();notify(id?'Prospect updated.':'Prospect added to the bank.');await load()}catch(err){notify(err.message,'error')}finally{btn.disabled=false}});
  Array.prototype.forEach.call(document.querySelectorAll('[data-close-prospect]'),function(b){b.addEventListener('click',function(){dialog.close()})});

  function detail(label,value,wide){return '<div class="prospect-detail'+(wide?' wide':'')+'"><span>'+esc(label)+'</span><strong>'+esc(value||'—')+'</strong></div>'}
  function openDrawer(id){var p=state.prospects.find(function(x){return x.prospectId===id});if(!p)return;document.getElementById('drawerProspectId').textContent=p.prospectId;document.getElementById('drawerTitle').textContent=p.businessName;document.getElementById('prospectDrawerBody').innerHTML='<div class="prospect-detail-grid">'+detail('Contact',p.contactName)+detail('Email',p.email)+detail('Phone',p.phone)+detail('Industry',p.industry)+detail('Location',p.location)+detail('Source',p.source)+detail('Website / social',p.websiteSocial,true)+detail('Opportunity notes',p.opportunityNotes,true)+detail('Status',p.status)+detail('Ready for Sales',p.readyForSales)+detail('Release date',p.scheduledReleaseDate)+detail('Assigned to',staffName(p.assignedTo))+detail('Imported Lead ID',p.importedLeadId)+detail('Duplicate check',p.duplicateCheck)+detail('Screenshot / reference',p.screenshotReference,true)+'</div>'+(editable(p)?'<div class="prospect-drawer-actions"><button class="prospect-btn prospect-btn-primary" id="editFromDrawer" type="button"><i class="fa-solid fa-pen"></i>Edit prospect</button></div>':'');document.getElementById('prospectBackdrop').hidden=false;document.getElementById('prospectDrawer').hidden=false;var edit=document.getElementById('editFromDrawer');if(edit)edit.addEventListener('click',function(){closeDrawer();openProspectForm(p)})}
  function closeDrawer(){document.getElementById('prospectBackdrop').hidden=true;document.getElementById('prospectDrawer').hidden=true}
  document.getElementById('closeProspectDrawer').addEventListener('click',closeDrawer);document.getElementById('prospectBackdrop').addEventListener('click',closeDrawer);

  async function bulk(action,extra){var ids=Array.from(state.selected);if(!ids.length)return;try{await json('/staff/prospects/bulk',{method:'POST',body:JSON.stringify(Object.assign({ids:ids,action:action},extra||{}))});notify('Prospect queue updated.');await load()}catch(e){notify(e.message,'error')}}
  document.getElementById('markReady').addEventListener('click',function(){bulk('ready')});document.getElementById('markResearch').addEventListener('click',function(){bulk('research')});
  document.getElementById('queueSelected').addEventListener('click',function(){var d=new Date();d.setDate(d.getDate()+1);document.getElementById('queueDate').value=d.toISOString().slice(0,10);queueDialog.showModal()});
  document.getElementById('queueForm').addEventListener('submit',async function(e){e.preventDefault();queueDialog.close();await bulk('queue',{releaseDate:document.getElementById('queueDate').value,assignedTo:document.getElementById('queueAssignee').value})});
  Array.prototype.forEach.call(document.querySelectorAll('[data-close-queue]'),function(b){b.addEventListener('click',function(){queueDialog.close()})});
  document.getElementById('releaseSelected').addEventListener('click',function(){releaseDialog.showModal()});
  document.getElementById('releaseForm').addEventListener('submit',async function(e){e.preventDefault();var ids=Array.from(state.selected),assignee=document.getElementById('releaseAssignee').value;releaseDialog.close();try{var data=await json('/staff/prospects/release',{method:'POST',body:JSON.stringify({ids:ids,assignedTo:assignee,limit:ids.length})});var failed=(data.results||[]).filter(function(r){return r.status!=='Released'&&r.status!=='Already released'});notify(data.released+' prospect'+(data.released===1?'':'s')+' released to the CRM.'+(failed.length?' '+failed.length+' need review.':''),failed.length?'error':null);await load()}catch(err){notify(err.message,'error')}});
  Array.prototype.forEach.call(document.querySelectorAll('[data-close-release]'),function(b){b.addEventListener('click',function(){releaseDialog.close()})});

  document.getElementById('newProspect').addEventListener('click',function(){openProspectForm()});document.getElementById('refreshProspects').addEventListener('click',load);
  document.getElementById('prospectSearch').addEventListener('input',function(e){state.search=e.target.value||'';render()});document.getElementById('industryFilter').addEventListener('change',function(e){state.industry=e.target.value;render()});
  document.getElementById('prospectTabs').addEventListener('click',function(e){var b=e.target.closest('button[data-status]');if(!b)return;Array.prototype.forEach.call(document.querySelectorAll('#prospectTabs button'),function(x){x.classList.toggle('is-active',x===b)});state.status=b.dataset.status;render()});
  document.getElementById('selectAllProspects').addEventListener('change',function(e){filtered().filter(editable).forEach(function(p){if(e.target.checked)state.selected.add(p.prospectId);else state.selected.delete(p.prospectId)});render()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDrawer()});

  Portal.onReady(load);
})(window,document);
