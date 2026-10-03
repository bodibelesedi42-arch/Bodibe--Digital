/* Bodibe Digital — Commission dashboard */
(function(window,document){
  'use strict';
  var Portal=window.BodibePortal;if(!Portal)return;
  var state={data:null,charts:{},selectedSale:null};
  var rows=document.getElementById('commissionRows');
  var payoutRows=document.getElementById('payoutRows');
  var filterAgent=document.getElementById('filterAgent');
  var filterMonth=document.getElementById('filterMonth');
  var filterStatus=document.getElementById('filterStatus');
  var searchInput=document.getElementById('commissionSearch');
  var payoutDialog=document.getElementById('payoutDialog');

  function esc(v){return Portal.escapeHtml(v==null?'':v);}
  function key(v){return String(v==null?'':v).trim().toLowerCase();}
  function money(v){var n=Number(v||0);return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',minimumFractionDigits:2}).format(isFinite(n)?n:0);}
  function prettyDate(v){if(!v)return '—';var d=new Date(String(v).slice(0,10)+'T00:00:00Z');return Number.isFinite(d.getTime())?d.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):v;}
  function saleMonth(v){var s=String(v||'');if(/^\d{4}-\d{2}/.test(s))return s.slice(0,7);var m=/^\d{1,2}\/(\d{1,2})\/(\d{4})$/.exec(s);return m?m[2]+'-'+m[1].padStart(2,'0'):'Undated';}
  function prettyMonth(v){if(!/^\d{4}-\d{2}$/.test(v||''))return v||'Undated';return new Date(v+'-01T00:00:00Z').toLocaleDateString('en-ZA',{month:'short',year:'numeric',timeZone:'UTC'});}
  function payoutClass(status){return 'commission-status-'+key(status).replace(/\s+/g,'-');}
  function isPaidInvoice(status){var s=key(status);return s==='paid'||s==='processed'||s==='verified';}
  async function json(path,options){var res=await Portal.authedFetch(path,options||{});var data=await res.json().catch(function(){return {};});if(!res.ok||!data.success)throw new Error(data.message||'Commission request failed.');return data;}

  function filteredSales(){
    var list=(state.data&&state.data.sales)||[];
    var agent=filterAgent.value,month=filterMonth.value,status=filterStatus.value,q=key(searchInput.value);
    return list.filter(function(s){
      if(agent&&s.staffId!==agent)return false;
      if(month&&saleMonth(s.saleDate)!==month)return false;
      if(status&&s.payoutStatus!==status)return false;
      if(q&&![s.quoteId,s.leadId,s.clientName,s.project,s.invoiceId,s.paymentStatus,s.staffId].some(function(v){return key(v).indexOf(q)!==-1;}))return false;
      return true;
    });
  }

  function renderFilters(){
    var data=state.data||{},sales=data.sales||[];
    var agents=[...new Set(sales.map(function(s){return s.staffId;}).filter(Boolean))].sort();
    var months=[...new Set(sales.map(function(s){return saleMonth(s.saleDate);}).filter(Boolean))].sort().reverse();
    filterAgent.innerHTML='<option value="">All agents</option>'+agents.map(function(a){return '<option value="'+esc(a)+'">'+esc(a)+'</option>';}).join('');
    filterMonth.innerHTML='<option value="">All months</option>'+months.map(function(m){return '<option value="'+esc(m)+'">'+esc(prettyMonth(m))+'</option>';}).join('');
    if(!data.owner){filterAgent.value=agents[0]||'';filterAgent.closest('select').hidden=true;}
  }

  function renderSummary(){
    var sales=filteredSales();
    var totalSales=sales.reduce(function(n,s){return n+Number(s.saleAmount||0);},0);
    var estimated=sales.reduce(function(n,s){return n+Number(s.commissionAmount||0);},0);
    var paid=sales.reduce(function(n,s){return n+Number(s.paid||0);},0);
    var outstanding=sales.reduce(function(n,s){return n+Number(s.outstanding||0);},0);
    document.getElementById('kpiSales').textContent=money(totalSales);
    document.getElementById('kpiEstimated').textContent=money(estimated);
    document.getElementById('kpiPaid').textContent=money(paid);
    document.getElementById('kpiOutstanding').textContent=money(outstanding);
    document.getElementById('kpiRate').textContent='At '+Number((state.data&&state.data.ratePercent)||0)+'%';
  }

  function renderTable(){
    var list=filteredSales(),owner=Boolean(state.data&&state.data.owner);
    document.getElementById('commissionCount').textContent=list.length+(list.length===1?' sale':' sales');
    if(!list.length){rows.innerHTML='<tr><td colspan="12" class="commission-empty">No accepted sales match these filters.</td></tr>';return;}
    rows.innerHTML=list.map(function(s){
      var action=owner&&Number(s.outstanding)>0?'<button type="button" class="commission-row-btn" data-payout-quote="'+esc(s.quoteId)+'" data-payout-staff="'+esc(s.staffId)+'" aria-label="Record payout"><i class="fa-solid fa-money-bill-transfer"></i></button>':'';
      var invoiceCls=isPaidInvoice(s.paymentStatus)?' is-paid':'';
      return '<tr>'+
        '<td><span class="commission-primary">'+esc(s.quoteId||'—')+'</span><span class="commission-muted">'+esc(s.leadId||'')+'</span></td>'+
        '<td><span class="commission-primary">'+esc(s.clientName||'—')+'</span><span class="commission-muted">'+esc(s.project||'')+'</span></td>'+
        '<td>'+esc(s.staffId||'—')+'</td>'+
        '<td>'+esc(prettyDate(s.saleDate))+'</td>'+
        '<td><span class="commission-money">'+esc(money(s.saleAmount))+'</span></td>'+
        '<td>'+Number(s.ratePercent||0)+'%</td>'+
        '<td><span class="commission-money">'+esc(money(s.commissionAmount))+'</span></td>'+
        '<td><span class="commission-money">'+esc(money(s.paid))+'</span></td>'+
        '<td><span class="commission-money">'+esc(money(s.outstanding))+'</span></td>'+
        '<td><span class="commission-status '+payoutClass(s.payoutStatus)+'">'+esc(s.payoutStatus||'Pending')+'</span></td>'+
        '<td><span class="commission-status commission-status-invoice'+invoiceCls+'">'+esc(s.paymentStatus||'Unknown')+'</span><span class="commission-muted">'+esc(s.invoiceId||'')+'</span></td>'+
        '<td>'+action+'</td></tr>';
    }).join('');
  }

  function renderPayouts(){
    var list=((state.data&&state.data.payouts)||[]).slice().sort(function(a,b){return String(b.paidDate).localeCompare(String(a.paidDate));});
    document.getElementById('payoutCount').textContent=list.length+(list.length===1?' payout':' payouts');
    if(!list.length){payoutRows.innerHTML='<tr><td colspan="5" class="commission-empty">No payouts recorded yet.</td></tr>';return;}
    payoutRows.innerHTML=list.map(function(p){return '<tr><td>'+esc(prettyDate(p.paidDate))+'</td><td><span class="commission-primary">'+esc(p.quoteId||'—')+'</span></td><td>'+esc(p.staffId||'—')+'</td><td><span class="commission-money">'+esc(money(p.amount))+'</span></td><td>'+esc(p.reference||'—')+'</td></tr>';}).join('');
  }

  function destroy(name){if(state.charts[name]){state.charts[name].destroy();state.charts[name]=null;}}
  function renderDoughnut(name,canvasId,groups){if(!window.Chart)return;destroy(name);var labels=Object.keys(groups),values=labels.map(function(k){return groups[k];});if(!labels.length){labels=['No data'];values=[1];}
    state.charts[name]=new Chart(document.getElementById(canvasId),{type:'doughnut',data:{labels:labels,datasets:[{data:values,backgroundColor:['#2563eb','#60a5fa','#14b8a6','#8b5cf6','#f59e0b','#cbd5e1'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{boxWidth:8,boxHeight:8,usePointStyle:true,pointStyle:'circle',color:'#64748b',font:{family:'Poppins',size:8},padding:11}}}}});}
  function renderCharts(){
    var sales=filteredSales();
    var payoutGroups={},paymentGroups={};
    sales.forEach(function(s){var p=s.payoutStatus||'Pending',i=s.paymentStatus||'Unknown';payoutGroups[p]=(payoutGroups[p]||0)+1;paymentGroups[i]=(paymentGroups[i]||0)+1;});
    renderDoughnut('payout','payoutStatusChart',payoutGroups);renderDoughnut('payment','paymentStatusChart',paymentGroups);
    if(!window.Chart)return;destroy('trend');
    var monthly=((state.data&&state.data.monthly)||[]).filter(function(x){return /^\d{4}-\d{2}$/.test(x.month||'');}).sort(function(a,b){return a.month.localeCompare(b.month);}).slice(-6);
    state.charts.trend=new Chart(document.getElementById('commissionTrendChart'),{type:'bar',data:{labels:monthly.map(function(x){return prettyMonth(x.month).replace(/\s\d{4}$/,'');}),datasets:[{label:'Estimated',data:monthly.map(function(x){return Number(x.estimated||0);}),backgroundColor:'#2563eb',borderRadius:5,maxBarThickness:32},{label:'Paid',data:monthly.map(function(x){return Number(x.paid||0);}),backgroundColor:'#93c5fd',borderRadius:5,maxBarThickness:32}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ' '+ctx.dataset.label+': '+money(ctx.raw);}}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#7c879a',font:{family:'Poppins',size:8}}},y:{beginAtZero:true,border:{display:false},grid:{color:'rgba(148,163,184,.16)'},ticks:{color:'#7c879a',font:{family:'Poppins',size:8},callback:function(v){return 'R'+Number(v).toLocaleString('en-ZA');}}}}}});
  }

  function renderAll(){renderSummary();renderTable();renderPayouts();renderCharts();}

  async function loadCommission(){
    var button=document.getElementById('refreshCommission');button.disabled=true;button.querySelector('span').textContent='Loading';Portal.clearNotice();
    rows.innerHTML='<tr><td colspan="12" class="commission-empty">Loading commission&hellip;</td></tr>';
    try{state.data=await json('/staff/commission');renderFilters();renderAll();if((state.data.warnings||[]).length)Portal.showNotice(state.data.warnings.join(' '),'warning');}
    catch(err){console.error(err);Portal.showNotice(err.message||'Commission could not be loaded.','warning');rows.innerHTML='<tr><td colspan="12" class="commission-empty">Commission could not be loaded.</td></tr>';}
    finally{button.disabled=false;button.querySelector('span').textContent='Refresh';}
  }

  function findSale(quoteId,staffId){return ((state.data&&state.data.sales)||[]).find(function(s){return s.quoteId===quoteId&&s.staffId===staffId;})||null;}
  function openPayout(sale){
    if(!sale||!(state.data&&state.data.owner))return;state.selectedSale=sale;
    document.getElementById('payoutTitle').textContent=sale.quoteId+' · '+(sale.clientName||'Client');
    document.getElementById('payoutSummary').innerHTML='<div><span>Estimated commission</span><strong>'+esc(money(sale.commissionAmount))+'</strong></div><div><span>Outstanding</span><strong>'+esc(money(sale.outstanding))+'</strong></div><div><span>Agent</span><strong>'+esc(sale.staffId||'—')+'</strong></div><div><span>Invoice</span><strong>'+esc(sale.paymentStatus||'—')+'</strong></div>';
    document.getElementById('payoutAmount').value=Number(sale.outstanding||0).toFixed(2);
    document.getElementById('payoutDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('payoutReference').value='';
    payoutDialog.showModal();
  }
  function closePayout(){state.selectedSale=null;payoutDialog.close();}
  async function recordPayout(event){event.preventDefault();var sale=state.selectedSale;if(!sale)return;var amount=document.getElementById('payoutAmount').value.trim(),date=document.getElementById('payoutDate').value,reference=document.getElementById('payoutReference').value.trim(),button=document.getElementById('confirmPayout');button.disabled=true;
    try{var id='PAYOUT-'+(window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2,12));state.data=await json('/staff/commission/payouts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,quoteId:sale.quoteId,staffId:sale.staffId,amount:amount,paidDate:date,reference:reference})});closePayout();Portal.showNotice('Commission payout recorded.');renderFilters();renderAll();}
    catch(err){Portal.showNotice(err.message||'Could not record payout.','warning');}finally{button.disabled=false;}}

  [filterAgent,filterMonth,filterStatus].forEach(function(el){el.addEventListener('change',renderAll);});
  searchInput.addEventListener('input',renderAll);
  document.getElementById('clearCommissionFilters').addEventListener('click',function(){filterAgent.value='';filterMonth.value='';filterStatus.value='';searchInput.value='';renderAll();});
  document.getElementById('refreshCommission').addEventListener('click',loadCommission);
  rows.addEventListener('click',function(event){var b=event.target.closest('[data-payout-quote]');if(!b)return;openPayout(findSale(b.getAttribute('data-payout-quote'),b.getAttribute('data-payout-staff')));});
  document.getElementById('closePayoutDialog').addEventListener('click',closePayout);document.getElementById('cancelPayout').addEventListener('click',closePayout);document.getElementById('payoutForm').addEventListener('submit',recordPayout);
  Portal.onReady(loadCommission);
})(window,document);
