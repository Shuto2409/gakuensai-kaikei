// ===== 起動処理 =====
//  START APP
function showAppVersion(){
  const el=document.getElementById('app-version');
  if(el) el.textContent='v'+APP_VERSION;
}
function startApp(){
  showAppVersion();
  setupListeners();
  showScreen('role');
  restoreScreen();
}



//  BOOT
(async function boot(){
  await _initTree();
  if(Object.keys(getAccounts()).length===0){ startApp(); return; }   // アカウント未作成＝従来どおりログイン不要
  const saved=_loadLogin();
  if(saved){
    const a=getAccounts()[saved.id];
    if(a&&String(a.pin)===String(saved.pin)){ enterAccount(saved.id,a); return; }
  }
  showScreen('login');
})();
