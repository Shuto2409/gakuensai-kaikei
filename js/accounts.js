// ===== ログイン・アカウント =====
//  ACCOUNTS / LOGIN (簡易アカウント。type: 'real'=本番データ / 'debug'=デバッグ用の別データ)
const LOGIN_KEY='festival_login_v1';
function getAccounts(){return _getAtPath(_treeCache,['accounts'])||{};}
function _saveLogin(v){try{if(v)localStorage.setItem(LOGIN_KEY,JSON.stringify(v));else localStorage.removeItem(LOGIN_KEY);}catch(e){}}
function _loadLogin(){try{return JSON.parse(localStorage.getItem(LOGIN_KEY)||'null');}catch(e){return null;}}
function enterAccount(id,acc){
  S.account={id,name:acc.name,type:acc.type==='debug'?'debug':'real'};
  ROOT=S.account.type==='debug'?DEBUG_ROOT:REAL_ROOT;
  _saveLogin({id,pin:acc.pin});
  document.getElementById('debug-pill').style.display=S.account.type==='debug'?'block':'none';
  const box=document.getElementById('role-account');
  box.style.display='flex';
  document.getElementById('role-account-name').textContent='👤 '+acc.name+(S.account.type==='debug'?'（デバッグ）':'');
  startApp();
}
function doLogin(){
  const name=document.getElementById('login-name').value.trim();
  const pin=document.getElementById('login-pin').value;
  const hit=Object.entries(getAccounts()).find(([,a])=>a&&a.name===name&&String(a.pin)===pin);
  if(!hit){showToast('アカウント名かPINが違います','error');return;}
  enterAccount(hit[0],hit[1]);
}
function doLogout(){_saveLogin(null);location.reload();}
async function addAccount(){
  const name=document.getElementById('ac-name').value.trim();
  const pin=document.getElementById('ac-pin').value.trim();
  let type=document.getElementById('ac-type').value==='debug'?'debug':'real';
  const accts=getAccounts();
  if(!name){showToast('アカウント名を入力してください','error');return;}
  if(!/^\d{4,}$/.test(pin)){showToast('PINは4桁以上の数字にしてください','error');return;}
  if(Object.values(accts).some(a=>a&&a.name===name)){showToast('同じ名前のアカウントがあります','error');return;}
  const first=Object.keys(accts).length===0;
  if(first) type='real';
  const id='ac'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  await db.ref(`accounts/${id}`).set({name,pin,type,createdAt:new Date().toISOString()});
  if(first){
    _saveLogin({id,pin});
    S.account={id,name,type:'real'};
    showToast('最初のアカウントを作成しました。次回からログインが必要です','success');
  } else showToast('アカウントを追加しました','success');
  renderSettingsContent();
}
async function deleteAccount(id){
  const accts=getAccounts(), a=accts[id];
  if(!a) return;
  const own=S.account&&S.account.id===id;
  const left=Object.keys(accts).length-1;
  let msg=`アカウント「${a.name}」を削除しますか？`;
  if(own) msg+='\n（ログイン中のアカウントです。削除後はログアウトします）';
  if(left===0) msg+='\n最後のアカウントなので、削除するとログイン不要の状態に戻ります。';
  else if(a.type!=='debug'&&!Object.entries(accts).some(([k,x])=>k!==id&&x.type!=='debug')) msg+='\n⚠️ 本番アカウントが無くなります。デバッグアカウントしか残りません。';
  if(!confirm(msg)) return;
  await db.ref(`accounts/${id}`).remove();
  if(own){ _saveLogin(null); location.reload(); return; }
  showToast('アカウントを削除しました','success');
  renderSettingsContent();
}
async function copyRealToDebug(){
  if(!confirm('本番データをデバッグ用データにコピーします。\n今のデバッグデータは上書きされます。よろしいですか？')) return;
  showLoading(true);
  try{
    const src={};
    ['menu','orders','days','currentDay','settings','tickets','voucherColors','shifts','members','gradeColors'].forEach(k=>{
      const v=_getAtPath(_treeCache,[k]); if(v!=null) src[k]=v;
    });
    await db.ref(DEBUG_ROOT).remove();
    if(Object.keys(src).length) await db.ref(DEBUG_ROOT).set(JSON.parse(JSON.stringify(src)));
    showToast('本番データをコピーしました','success');
  }catch(e){console.error(e);showToast('コピーに失敗しました','error');}
  showLoading(false);
}
function renderAccountCard(){
  const accts=Object.entries(getAccounts());
  const isDebug=S.account&&S.account.type==='debug';
  const dbgCard=isDebug?`<div class="card"><h3>🧪 デバッグデータ</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:10px;">いまはデバッグ用の別データを使っています。本番の売上・メニューには影響しません。</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-ghost" onclick="copyRealToDebug()">📥 本番データをコピー</button>
      </div></div>`:'';
  const rows=accts.map(([id,a])=>`<div class="acct-row"><span style="flex:1;font-weight:700;">${esc(a.name)}${S.account&&S.account.id===id?' <small style="color:#16a34a;">（ログイン中）</small>':''}</span><span class="acct-type ${a.type==='debug'?'debug':''}">${a.type==='debug'?'デバッグ':'本番'}</span><button class="btn btn-danger" style="padding:4px 10px;font-size:12px;" onclick="deleteAccount(${JSON.stringify(id).replace(/"/g,'&quot;')})">削除</button></div>`).join('');
  return dbgCard+`<div class="card"><h3>🔐 ログインアカウント</h3>
    <p style="font-size:12px;color:#64748b;margin-bottom:10px;">${accts.length===0?'アカウントが無いので、今はログイン不要です。最初に作る1件は本番用になり、以降はログインが必要になります。':'「デバッグ」アカウントでログインすると、本番とは完全に別のデータで試せます。'}</p>
    ${rows}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <input id="ac-name" type="text" placeholder="アカウント名" style="flex:1;min-width:110px;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;">
      <input id="ac-pin" type="text" inputmode="numeric" placeholder="PIN(4桁以上)" style="width:110px;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;">
      <select id="ac-type" style="padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;"><option value="real">本番</option><option value="debug">デバッグ</option></select>
      <button class="btn btn-success" onclick="addAccount()">追加</button>
    </div></div>`;
}
