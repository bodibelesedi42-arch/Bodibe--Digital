(function(window){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
  function fields(data){
    data=data||{};
    if(!data.management){
      return '<div class="crm-edit-field"><span>Ownership</span><p class="crm-drawer-hint">This self-sourced lead will be assigned to you automatically.</p><input type="hidden" name="ownershipType" value="ASSIGNED"></div>';
    }
    var staff=(data.staff||[]).map(function(p){return '<option value="'+esc(p.staffId)+'">'+esc(p.name||p.staffId)+' · '+esc(p.role||'Sales')+'</option>'}).join('');
    var supervisors=(data.supervisors||[]).map(function(p){return '<option value="'+esc(p.staffId)+'">'+esc(p.name||p.staffId)+'</option>'}).join('');
    var html='<label class="crm-edit-field"><span>Lead destination</span><select name="ownershipType" id="leadOwnershipType"><option value="CLAIM_POOL">Put up for claim</option><option value="MANAGEMENT">Owner / management</option>';
    if(staff)html+='<option value="ASSIGNED">Assign to specific person</option>';
    if(supervisors)html+='<option value="TEAM_POOL">Team pool</option>';
    html+='</select></label>';
    if(staff)html+='<label class="crm-edit-field" id="leadOwnerWrap" hidden><span>Assign to</span><select name="ownerStaffId"><option value="">Choose staff member</option>'+staff+'</select></label>';
    if(supervisors)html+='<label class="crm-edit-field" id="leadSupervisorWrap" hidden><span>Team supervisor</span><select name="supervisorId"><option value="">Choose supervisor</option>'+supervisors+'</select></label>';
    setTimeout(function(){var type=document.getElementById('leadOwnershipType'),ow=document.getElementById('leadOwnerWrap'),sw=document.getElementById('leadSupervisorWrap');if(!type)return;function sync(){if(ow)ow.hidden=type.value!=='ASSIGNED';if(sw)sw.hidden=type.value!=='TEAM_POOL'}type.addEventListener('change',sync);sync()},0);
    return html;
  }
  function read(form){
    var type=(form.elements.ownershipType&&form.elements.ownershipType.value)||'ASSIGNED';
    var out={ownershipType:type};
    if(type==='ASSIGNED'&&form.elements.ownerStaffId&&form.elements.ownerStaffId.value)out.ownerStaffId=form.elements.ownerStaffId.value;
    if(type==='TEAM_POOL'&&form.elements.supervisorId&&form.elements.supervisorId.value)out.supervisorId=form.elements.supervisorId.value;
    return out;
  }
  window.BodibeAllocation={fields:fields,read:read};
})(window);