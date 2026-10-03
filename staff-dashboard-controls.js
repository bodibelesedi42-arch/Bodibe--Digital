/* Bodibe Digital — dashboard utility controls */
(function(window,document){
  'use strict';
  var Portal=window.BodibePortal;if(!Portal)return;
  var notifBtn=document.getElementById('dashNotificationsBtn');
  var notifPanel=document.getElementById('dashNotificationsPanel');
  var notifList=document.getElementById('dashNotificationsList');
  var notifBadge=document.getElementById('dashNotificationBadge');
  var helpBtn=document.getElementById('dashHelpBtn');
  var helpPanel=document.getElementById('dashHelpPanel');
  var focusBtn=document.getElementById('dashFocusBtn');
  var searchInput=document.getElementById('dashPortalSearch');
  var searchResults=document.getElementById('dashSearchResults');

  function setOpen(button,panel,open){if(!button||!panel)return;panel.hidden=!open;button.setAttribute('aria-expanded',open?'true':'false')}
  function closePanels(){setOpen(notifBtn,notifPanel,false);setOpen(helpBtn,helpPanel,false);closeSearch()}
  function toggle(button,panel,otherButton,otherPanel){var open=panel.hidden;if(otherButton&&otherPanel)setOpen(otherButton,otherPanel,false);closeSearch();setOpen(button,panel,open)}
  if(notifBtn)notifBtn.addEventListener('click',function(e){e.stopPropagation();toggle(notifBtn,notifPanel,helpBtn,helpPanel)});
  if(helpBtn)helpBtn.addEventListener('click',function(e){e.stopPropagation();toggle(helpBtn,helpPanel,notifBtn,notifPanel)});
  [notifPanel,helpPanel].forEach(function(panel){if(panel)panel.addEventListener('click',function(e){e.stopPropagation()})});
  document.addEventListener('click',closePanels);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closePanels()});

  /* -------------------------------------------------------------- search */
  function searchableLinks(){
    var seen={};
    return Array.prototype.slice.call(document.querySelectorAll('#navPrimary a.portal-nav-link,#navModules a.portal-nav-link')).filter(function(link){
      var href=link.getAttribute('href')||'';if(!href||seen[href])return false;seen[href]=true;return true;
    }).map(function(link){
      var label=(link.querySelector('.portal-nav-label')||link).textContent.trim();
      var group='Portal';
      var previous=link.closest('li')&&link.closest('li').previousElementSibling;
      while(previous){if(previous.classList&&previous.classList.contains('portal-nav-group-heading')){group=previous.textContent.trim();break}previous=previous.previousElementSibling}
      var icon=link.querySelector('i');
      return{label:label,href:link.getAttribute('href'),group:group,icon:icon?icon.className:'fa-solid fa-arrow-right'};
    });
  }
  function closeSearch(){if(!searchResults||!searchInput)return;searchResults.hidden=true;searchInput.setAttribute('aria-expanded','false')}
  function renderSearch(){
    if(!searchInput||!searchResults)return;
    var q=searchInput.value.trim().toLowerCase();if(!q){closeSearch();return}
    var matches=searchableLinks().filter(function(item){return(item.label+' '+item.group).toLowerCase().indexOf(q)!==-1}).slice(0,8);
    searchResults.innerHTML=matches.length?matches.map(function(item){return '<a class="dash-search-result" href="'+item.href+'"><i class="'+Portal.escapeHtml(item.icon)+'" aria-hidden="true"></i><span><strong>'+Portal.escapeHtml(item.label)+'</strong><small>'+Portal.escapeHtml(item.group)+'</small></span></a>'}).join(''):'<div class="dash-search-empty">No portal module matches “'+Portal.escapeHtml(searchInput.value.trim())+'”.</div>';
    searchResults.hidden=false;searchInput.setAttribute('aria-expanded','true');
  }
  if(searchInput){
    searchInput.addEventListener('click',function(e){e.stopPropagation();renderSearch()});
    searchInput.addEventListener('input',renderSearch);
    searchInput.addEventListener('keydown',function(e){
      if(e.key==='Enter'){
        var first=searchResults&&searchResults.querySelector('a.dash-search-result');
        if(first){e.preventDefault();window.location.href=first.href}
      }
    });
  }
  if(searchResults)searchResults.addEventListener('click',function(e){e.stopPropagation()});

  /* ------------------------------------------------------- notifications */
  function dateOnly(value){if(!value)return null;var d=new Date(value);if(isNaN(d.getTime()))return null;return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
  function dayLabel(value){var d=dateOnly(value);return d?d.toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):'No date'}
  function buildNotifications(work){
    var tasks=Array.isArray(work&&work.openTasks)?work.openTasks:[];
    var projects=Array.isArray(work&&work.activeProjects)?work.activeProjects:[];
    var today=new Date();today=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    var items=[];
    tasks.forEach(function(t){var due=dateOnly(t.dueDate);if(!due)return;if(due<today)items.push({urgent:true,icon:'fa-triangle-exclamation',title:(t.name||t.taskId||'Task')+' is overdue',detail:'Due '+dayLabel(t.dueDate),href:'staff-tasks.html'});else if(due.getTime()===today.getTime())items.push({urgent:false,icon:'fa-clock',title:(t.name||t.taskId||'Task')+' is due today',detail:'Open My Tasks to update progress.',href:'staff-tasks.html'})});
    projects.forEach(function(p){var health=String(p.health||'').toLowerCase();if(health.indexOf('overdue')!==-1||health.indexOf('risk')!==-1)items.push({urgent:health.indexOf('overdue')!==-1,icon:'fa-diagram-project',title:(p.client||p.projectId||'Project')+' needs attention',detail:p.health||'Project risk detected',href:'staff-projects.html'})});
    return items.slice(0,8);
  }
  function renderNotifications(work){
    if(!notifList||!notifBadge)return;var items=buildNotifications(work);var urgent=items.filter(function(x){return x.urgent}).length;
    notifBadge.textContent=String(items.length);notifBadge.hidden=!items.length;notifBtn&&notifBtn.classList.toggle('has-alerts',urgent>0);
    if(!items.length){notifList.innerHTML='<p class="dash-popover-empty"><i class="fa-regular fa-circle-check"></i><br>No urgent work notifications right now.</p>';return}
    notifList.innerHTML=items.map(function(x){return '<a class="dash-popover-item'+(x.urgent?' is-urgent':'')+'" href="'+x.href+'"><i class="fa-solid '+x.icon+'" aria-hidden="true"></i><span><strong>'+Portal.escapeHtml(x.title)+'</strong><small>'+Portal.escapeHtml(x.detail)+'</small></span></a>'}).join('');
  }

  /* ---------------------------------------------------------- full screen */
  function focusState(on){
    document.body.classList.toggle('portal-focus-mode',on);
    if(!focusBtn)return;
    focusBtn.classList.toggle('is-active',on);
    focusBtn.setAttribute('aria-pressed',on?'true':'false');
    focusBtn.setAttribute('aria-label',on?'Exit full screen workspace':'Enter full screen workspace');
    focusBtn.setAttribute('title',on?'Exit full screen workspace':'Full screen workspace');
  }
  async function enterFocus(){focusState(true);try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch(e){/* browser fullscreen is optional; sidebar-free focus remains */}}
  async function exitFocus(){focusState(false);try{if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen()}catch(e){}}
  if(focusBtn)focusBtn.addEventListener('click',function(e){e.stopPropagation();document.body.classList.contains('portal-focus-mode')?exitFocus():enterFocus()});
  document.addEventListener('fullscreenchange',function(){if(!document.fullscreenElement&&document.body.classList.contains('portal-focus-mode'))focusState(false)});

  Portal.onReady(async function(){
    try{
      var res=await Portal.authedFetch('/staff/my-work');
      if(!res.ok)return renderNotifications({});
      var data=await res.json();renderNotifications(data&&data.success?data:{});
    }catch(e){if(e.sessionExpired)return Portal.goToLogin();renderNotifications({})}
  });
})(window,document);
