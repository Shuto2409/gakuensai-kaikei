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



// ===== ファイルの取り違え・古いファイルの検出 =====
// GitHubで一部のファイルだけ上げ忘れ・取り違えがあると「〇〇 is not defined」で画面が動かなくなる。
// 各ファイルに本来あるはずの関数を調べ、足りなければ原因のファイル名を画面に出す。
const _EXPECT_FUNCS={
  'js/db.js':['_initTree'],
  'js/state.js':['showScreen'],
  'js/roles.js':['enterCashier','setupListeners','backToRole'],
  'js/menu.js':['renderMenu','isSetItem','r2'],
  'js/cart-payment.js':['addToCart','renderCart','confirmPayment','addToCartWithChoices'],
  'js/kitchen-handoff.js':['renderKitchen','renderHandoff','orderLines'],
  'js/admin-core.js':['renderSalesContent','addStock'],
  'js/menu-admin.js':['saveMenuItem','getSetAvailability'],
  'js/orders-modals.js':['cancelOrder','showChoiceModal','showAdminPin'],
  'js/dashboard.js':['renderDashboard','enterDash'],
  'js/export-utils.js':['esc'],
  'js/shift.js':['renderShiftDisplay'],
  'js/accounts.js':['getAccounts']
};
function checkAppFiles(){
  const bad=[];
  Object.entries(_EXPECT_FUNCS).forEach(([f,fns])=>{
    const miss=fns.filter(n=>{try{return typeof (0,eval)(n)!=='function';}catch(e){return true;}});
    if(miss.length) bad.push(f);
  });
  if(!bad.length) return true;
  const d=document.createElement('div');
  d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:#7f1d1d;color:white;padding:14px 16px;font-size:14px;font-weight:700;line-height:1.6;';
  d.innerHTML='⚠️ 次のファイルが古い、または別のファイルと取り違えられています。GitHubに正しいファイルを上げ直し、Ctrl+Shift+R で再読み込みしてください。<br>'+bad.map(f=>'・'+f).join('<br>')+'<br><span style="font-weight:400;font-size:12px;">（アプリ v'+(typeof APP_VERSION!=='undefined'?APP_VERSION:'?')+'）</span>';
  document.body.appendChild(d);
  return false;
}

// ===== タブレットのダブルタップ拡大・ピンチ拡大を止める =====
(function(){
  let last=0;
  document.addEventListener('touchend',e=>{
    const now=Date.now();
    if(now-last<350){
      const t=e.target;
      if(!(t&&t.closest&&t.closest('input,textarea,select'))) e.preventDefault();
    }
    last=now;
  },{passive:false});
  ['gesturestart','gesturechange','gestureend'].forEach(n=>document.addEventListener(n,e=>e.preventDefault()));
})();

//  BOOT
(async function boot(){
  if(!checkAppFiles()) return;
  await _initTree();
  if(Object.keys(getAccounts()).length===0){ startApp(); return; }   // アカウント未作成＝従来どおりログイン不要
  const saved=_loadLogin();
  if(saved){
    const a=getAccounts()[saved.id];
    if(a&&String(a.pin)===String(saved.pin)){ enterAccount(saved.id,a); return; }
  }
  showScreen('login');
})();
