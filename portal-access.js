/* Bodibe Digital portal access compatibility + logout audit hook. */
(function(window,document){
  'use strict';
  var API='https://bodibedigital-backend.onrender.com';
  var TOKEN_KEY='bd_staff_token';

  // The main shell still owns logout and clears the local token immediately.
  // This capture-phase hook sends an authenticated, keepalive audit request first
  // so management can see explicit sign-outs without slowing staff navigation.
  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('[data-portal-action="logout"],#logoutBtn,#logoutBtnTop'):null;
    if(!target)return;
    var token='';
    try{token=sessionStorage.getItem(TOKEN_KEY)||'';}catch(e){}
    if(!token)return;
    try{
      fetch(API+'/auth/logout',{
        method:'POST',
        headers:{Authorization:'Bearer '+token},
        keepalive:true,
        cache:'no-store'
      }).catch(function(){});
    }catch(e){}
  },true);
})(window,document);
