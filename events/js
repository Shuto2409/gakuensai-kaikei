// ===== イベント（学園祭など、イベントごとにデータを分けて記録する） =====
// データの置き場所: 最初から使っているデータ(既存)＝イベント 'ev_legacy' ／ 新しいイベント＝ events/{id}/ 以下
// 使うイベントは全端末で共通（activeEvent）。切り替えると全端末が自動で読み込み直す。
const LEGACY_EVENT_ID='ev_legacy';
const EVENT_COPY_KEYS=[
  ['menu','メニュー・構成品（在庫は初期値に戻す）',['menu']],
  ['voucherColors','バザー券の色',['voucherColors']],
  ['settings','店舗設定・管理PIN',['settings']],
  ['tickets','整理券（番号のみ・未使用に戻す）',['tickets']],
  ['members','メンバー・学年色',['members','gradeColors']]
];
function eventRoot(id){ return (!id||id===LEGACY_EVENT_ID)?REAL_ROOT:`events/${id}`; }
function getEvents(){ return _getAtPath(_treeCache,['eventList'])||{}; }
function activeEventId(){ return _getAtPath(_treeCache,['activeEvent'])||LEGACY_EVENT_ID; }
function eventName(id){ const e=getEvents()[id]; return e?e.name:'（不明）'; }
function _evSorted(){ return Object.values(getEvents()).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))); }

// 起動時: イベント一覧が無ければ、今のデータを「学園祭」として登録する（データの移動はしない）
async function ensureEvents(){
  if(Object.keys(getEvents()).length===0){
    await db.ref(`eventList/${LEGACY_EVENT_ID}`).set({id:LEGACY_EVENT_ID,name:'学園祭',createdAt:'2000-01-01T00:00:00.000Z'});
  }
  if(!_getAtPath(_treeCache,['activeEvent'])) await db.ref('activeEvent').set(LEGACY_EVENT_ID);
}
// ログイン後に、使うイベントを決めて ROOT を切り替える（デバッグアカウントは従来どおり別データ）
function applyEventRoot(isDebug){
  S.eventId=activeEventId();
  if(!getEvents()[S.eventId]) S.eventId=LEGACY_EVENT_ID;
  ROOT=isDebug?DEBUG_ROOT:eventRoot(S.eventId);
  updateEventChip();
}
function updateEventChip(){
  const el=document.getElementById('event-chip-name'); if(!el) return;
  const dbg=S.account&&S.account.type==='debug';
  el.textContent=dbg?'デバッグ用データ':eventName(S.eventId);
}
function watchActiveEvent(){
  db.ref('activeEvent').on('value',snap=>{
    const v=snap.val();
    if(S.account&&S.account.type==='debug') return;
    if(v&&S.eventId&&v!==S.eventId&&getEvents()[v]){
      showToast(`イベントが「${eventName(v)}」に切り替わりました。読み込み直します`,'warning');
      setTimeout(()=>location.reload(),900);
    }
  });
  db.ref('eventList').on('value',()=>{ updateEventChip(); if(document.getElementById('event-modal-overlay').classList.contains('show')) renderEventModal(); });
}

function showEventModal(){
  document.getElementById('event-modal-overlay').classList.add('show');
  renderEventModal();
}
function closeEventModal(){ document.getElementById('event-modal-overlay').classList.remove('show'); }
function renderEventModal(){
  const box=document.getElementById('event-modal-body'); if(!box) return;
  if(S.account&&S.account.type==='debug'){
    box.innerHTML='<p style="font-size:13px;color:var(--gray);">デバッグアカウントでは、イベントは切り替えられません（デバッグ用の別データを使っています）。</p>';
    return;
  }
  const act=S.eventId;
  const rows=_evSorted().map(e=>{
    const id=JSON.stringify(e.id).replace(/"/g,'&quot;');
    const on=e.id===act;
    return `<div class="ev-row ${on?'on':''}">
      <div class="ev-info"><div class="ev-name">${esc(e.name)} ${on?'<span class="ev-badge">使用中</span>':''}</div>
      <div class="ev-sub">${e.createdAt&&e.createdAt>'2001'?new Date(e.createdAt).toLocaleDateString('ja-JP'):'最初のデータ'}</div></div>
      <div class="ev-btns">
        ${on?'':`<button class="btn btn-primary" onclick="switchEvent(${id})">切り替え</button>`}
        <button class="btn btn-ghost" onclick="viewEventDash(${id})">📊 見る</button>
        <button class="btn btn-ghost" onclick="renameEvent(${id})">✏️</button>
        ${(on||e.id===LEGACY_EVENT_ID)?'':`<button class="btn btn-danger" onclick="deleteEvent(${id})">🗑️</button>`}
      </div></div>`;
  }).join('');
  const srcOpts=_evSorted().map(e=>`<option value="${esc(e.id)}" ${e.id===act?'selected':''}>${esc(e.name)}</option>`).join('');
  const chk=EVENT_COPY_KEYS.map(([k,l])=>`<label class="ev-chk"><input type="checkbox" class="ev-copy" value="${k}" ${(k==='menu'||k==='voucherColors'||k==='settings'||k==='tickets')?'checked':''}> ${esc(l)}</label>`).join('');
  box.innerHTML=`<div class="ev-list">${rows}</div>
  <div class="ev-new"><h3>＋ 新しいイベントを作る</h3>
    <input type="text" id="ev-new-name" placeholder="イベント名（例：2027 学園祭）" maxlength="40">
    <div class="ev-src">引き継ぐ元：<select id="ev-src">${srcOpts}</select></div>
    <div class="ev-chks">${chk}</div>
    <p class="ev-note">売上・注文・営業日・シフトは引き継がず、空から始まります。作ると、すぐそのイベントに切り替わります（管理PINが必要）。</p>
    <button class="btn btn-success" style="width:100%;justify-content:center;" onclick="addNewEvent()">作成して切り替える</button>
  </div>`;
}
function _needPin(fn){ showAdminPin(fn); }
async function addNewEvent(){
  const name=(document.getElementById('ev-new-name').value||'').trim();
  if(!name){ showToast('イベント名を入力してください','error'); return; }
  if(_evSorted().some(e=>e.name===name)){ showToast('同じ名前のイベントがあります','error'); return; }
  const src=document.getElementById('ev-src').value;
  const keys=[...document.querySelectorAll('.ev-copy:checked')].map(c=>c.value);
  _needPin(async()=>{
    showLoading(true);
    try{
      const id='ev'+Date.now().toString(36);
      const base=_pathToArray(eventRoot(src));
      for(const [k,,paths] of EVENT_COPY_KEYS){
        if(!keys.includes(k)) continue;
        for(const p of paths){
          let v=_getAtPath(_treeCache,base.concat(p));
          if(v==null) continue;
          v=JSON.parse(JSON.stringify(v));
          if(p==='menu') Object.values(v).forEach(m=>{ if(m&&m.stock>0) m.currentStock=m.stock; });
          if(p==='tickets') Object.values(v).forEach(t=>{ if(t){ t.status='available'; t.orderId=null; } });
          await db.ref(`events/${id}/${p}`).set(v);
        }
      }
      await db.ref(`eventList/${id}`).set({id,name,createdAt:new Date().toISOString()});
      await db.ref('activeEvent').set(id);
      showToast(`「${name}」を作成しました`,'success');
      setTimeout(()=>location.reload(),600);
    }catch(e){ console.error(e); showToast('作成に失敗しました','error'); showLoading(false); }
  });
}
function switchEvent(id){
  if(id===S.eventId) return;
  let msg=`イベントを「${eventName(id)}」に切り替えますか？\nすべての端末が切り替わります。`;
  if(S.isDayOpen) msg='⚠️ いま営業中の日があります。\n'+msg;
  if(!confirm(msg)) return;
  _needPin(async()=>{
    await db.ref('activeEvent').set(id);
    showToast('切り替えました','success');
    setTimeout(()=>location.reload(),500);
  });
}
function renameEvent(id){
  const nn=(prompt('新しいイベント名',eventName(id))||'').trim();
  if(!nn) return;
  _needPin(async()=>{ await db.ref(`eventList/${id}/name`).set(nn); showToast('名前を変更しました','success'); });
}
function deleteEvent(id){
  if(!confirm(`イベント「${eventName(id)}」を削除しますか？\nそのイベントの売上・メニューなど、記録がすべて消えます。取り消せません。`)) return;
  if(!confirm('本当に削除しますか？')) return;
  _needPin(async()=>{
    await db.ref(`events/${id}`).remove();
    await db.ref(`eventList/${id}`).remove();
    showToast('削除しました','success');
  });
}
function viewEventDash(id){
  S.dashEvent=id; S.dashSel=null;
  closeEventModal();
  if(typeof enterDash==='function') enterDash(true);
}
