// ===== 役割選択・リアルタイム購読（リスナー） =====
//  ROLE SELECTION
function updateRoleScreen(){
  const sn=document.getElementById('role-store-name');
  const badge=document.getElementById('role-day-badge');
  const notice=document.getElementById('role-closed-notice');
  const cashierCard=document.getElementById('role-cashier');
  const kitchenCard=document.getElementById('role-kitchen');
  const handoffCard=document.getElementById('role-handoff');
  sn.textContent=S.settings.storeName||'じゃがバター屋';
  if(S.isDayOpen && S.currentDay){
    badge.textContent=`Day ${S.currentDay.dayNumber} 営業中 ✅`;
    badge.className='role-day-badge role-day-open';
    cashierCard.classList.remove('disabled');
    kitchenCard.classList.remove('disabled');
    handoffCard.classList.remove('disabled');
    notice.style.display='none';
  } else {
    badge.textContent='クローズ中';
    badge.className='role-day-badge role-day-closed';
    cashierCard.classList.add('disabled');
    kitchenCard.classList.add('disabled');
    handoffCard.classList.add('disabled');
    notice.style.display='block';
  }
}

const SCREEN_KEY='festival_screen_v1';
function saveScreen(name){try{if(name)localStorage.setItem(SCREEN_KEY,name);else localStorage.removeItem(SCREEN_KEY);}catch(e){}}
function restoreScreen(){
  let n=null;try{n=localStorage.getItem(SCREEN_KEY);}catch(e){}
  if(n==='cashier') enterCashier();
  else if(n==='kitchen') enterKitchen();
  else if(n==='handoff') enterHandoff();
  else if(n==='pos') enterPos();
  else if(n==='dash') enterDash();
  else if(n==='admin') enterAdmin();
}
function enterCashier(){
  if(!S.isDayOpen){showToast('まだオープンしていません','warning');return;}
  S.currentRole='cashier';
  saveScreen('cashier');
  showScreen('cashier');
}

function enterKitchen(){
  if(!S.isDayOpen){showToast('まだオープンしていません','warning');return;}
  S.currentRole='kitchen';
  saveScreen('kitchen');
  showScreen('kitchen');
}

function enterHandoff(){
  if(!S.isDayOpen){showToast('まだオープンしていません','warning');return;}
  S.currentRole='handoff';
  saveScreen('handoff');
  showScreen('handoff');
}

function enterPos(){
  S.currentRole='pos';
  saveScreen('pos');
  showScreen('pos');
}

function switchPosTab(tab){
  S.activePosTab=tab;
  document.querySelectorAll('.pos-tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.pos-tab-content').forEach(c=>c.classList.remove('active'));
  document.getElementById('ptab-'+tab).classList.add('active');
  document.getElementById('pcontent-'+tab).classList.add('active');
  renderPosTab(tab);
}

function renderPosTab(tab){
  if(tab==='menu') renderPosMenuContent();
  if(tab==='inventory') renderPosInventoryContent();
}

function renderPosMenuContent(){
  const allItems=Object.values(S.menu);
  const materials=allItems.filter(i=>i.isMaterial);
  const regularItems=allItems.filter(i=>!i.isMaterial);

  // ---- 食材セクション ----
  let html='';
  if(materials.length>0){
    html+=`<div class="card" style="border:2px solid #fcd34d;background:#fffdf0;">
      <div class="sec-hdr"><h3>🥚 食材・原料</h3><button class="btn btn-primary" onclick="showMenuAddModal()" style="background:#f59e0b;border-color:#f59e0b;">＋ 追加</button></div>
      <p style="font-size:12px;color:#92400e;margin:-4px 0 12px;padding:0 2px;">レジ非表示。セット商品の構成品として使用される材料です。</p>`;
    materials.forEach(item=>{
      const isActive=item.active!==false;
      const cur=item.currentStock!=null?item.currentStock:item.stock;
      const pct=item.stock>0?Math.min(100,Math.round(cur/item.stock*100)):null;
      const barColor=cur<=0?'#ef4444':cur<=item.stock*0.2?'#f59e0b':'#22c55e';
      // このアイテムを参照しているセット商品を探して販売可能数を表示
      const linkedSets=Object.values(S.menu).filter(s=>s.isSet&&s.components&&s.components.some(c=>String(c.id)===String(item.id)));
      const linkedHtml=linkedSets.map(s=>{
        const comp=s.components.find(c=>String(c.id)===String(item.id));
        const avail=item.stock>0?Math.floor(cur/comp.qty):null;
        return `<span style="font-size:11px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:2px 7px;color:#0369a1;">${esc(s.name)}: ${avail!=null?avail+'セット販売可':'在庫管理なし'}</span>`;
      }).join(' ');
      html+=`<div class="menu-row" style="flex-wrap:wrap;gap:8px;">
        <div class="menu-row-info" style="flex:1;min-width:0;">
          <div class="menu-row-name" style="display:flex;align-items:center;gap:6px;${!isActive?'color:var(--gray);':''}">🥚 ${esc(item.name)}</div>
          <div class="menu-row-sub">在庫: <strong>${cur}個</strong> / 初期: ${item.stock}個${pct!=null?` (${pct}%)`:''}${item.category?' · '+item.category:''}</div>
          ${pct!=null?`<div style="height:4px;background:#e5e7eb;border-radius:4px;margin-top:5px;"><div style="height:4px;border-radius:4px;background:${barColor};width:${pct}%;transition:width .3s;"></div></div>`:''}
          ${linkedHtml?`<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${linkedHtml}</div>`:''}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <label class="toggle-switch"><input type="checkbox" ${isActive?'checked':''} onchange="toggleItem(${JSON.stringify(item.id).replace(/"/g,'&quot;')},this.checked)"><span class="toggle-slider"></span></label>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="showMenuEditModal(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">✏️</button>
          <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="deleteItem(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">🗑️</button>
        </div>
      </div>`;
    });
    html+=`</div>`;
  }

  // ---- 通常メニューセクション ----
  html+=`<div class="card">
    <div class="sec-hdr"><h3>📋 メニュー管理</h3><button class="btn btn-primary" onclick="showMenuAddModal()">＋ 商品追加</button></div>
    <div id="pos-menu-list">`;
  if(regularItems.length===0){html+=`<div class="empty-state"><div class="icon">📋</div><p>まだ商品がありません</p></div>`;}
  else{
    regularItems.forEach(item=>{
      const isActive=item.active!==false;
      const hasStock=item.stock>0;
      const cur=hasStock?(item.currentStock!=null?item.currentStock:item.stock):null;
      let stockStr=hasStock?`在庫:${cur}個`:'在庫管理なし';
      if(item.isSet){
        const avail=getSetAvailability(item);
        stockStr=avail!=null?`${isSetItem(item)?'セット残り':'構成品から計算 残り'}:${avail}個`:'在庫管理なし';
      }
      html+=`<div class="menu-row">
        <div class="menu-row-info">
          <div class="menu-row-name" style="${!isActive?'color:var(--gray);':''}">${isSetItem(item)?'📦 ':''}${esc(item.name)}</div>
          <div class="menu-row-sub">¥${item.price.toLocaleString()}${item.category?' / '+item.category:''} / ${stockStr}</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" ${isActive?'checked':''} onchange="toggleItem(${JSON.stringify(item.id).replace(/"/g,'&quot;')},this.checked)"><span class="toggle-slider"></span></label>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="showMenuEditModal(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="deleteItem(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">🗑️</button>
      </div>`;
    });
  }
  html+=`</div></div>`;
  document.getElementById('pos-menu-content').innerHTML=html;
}

function renderPosInventoryContent(){
  const allItems=Object.values(S.menu);
  const materials=allItems.filter(i=>i.isMaterial);
  const regularItems=allItems.filter(i=>!i.isMaterial);
  let html='';

  // 食材在庫セクション（最優先表示）
  if(materials.length>0){
    html+=`<div class="card" style="border:2px solid #fcd34d;background:#fffdf0;">
      <div class="sec-hdr"><h3>🥚 食材在庫</h3></div>
      <p style="font-size:12px;color:#92400e;margin:-4px 0 12px;">食材の在庫を変更すると、セット商品の販売可能数に即時反映されます。</p>`;
    materials.forEach(item=>{
      const cur=item.currentStock!=null?item.currentStock:item.stock;
      const isActive=item.active!==false;
      // 連動するセット商品と販売可能数
      const linkedSets=Object.values(S.menu).filter(s=>s.isSet&&s.components&&s.components.some(c=>String(c.id)===String(item.id)));
      const linkedHtml=linkedSets.map(s=>{
        const comp=s.components.find(c=>String(c.id)===String(item.id));
        const avail=item.stock>0?Math.floor(cur/comp.qty):null;
        const color=avail<=0?'#ef4444':avail<=3?'#f59e0b':'#16a34a';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f0f9ff;border-radius:8px;margin-bottom:5px;">
          <span style="font-size:13px;font-weight:600;">📦 ${esc(s.name)}</span>
          <span style="font-size:13px;font-weight:800;color:${color};">${avail!=null?avail+'セット販売可':'∞'}</span>
        </div>`;
      }).join('');
      const pct=item.stock>0?Math.min(100,Math.round(cur/item.stock*100)):null;
      const barColor=cur<=0?'#ef4444':cur<=item.stock*0.2?'#f59e0b':'#22c55e';
      html+=`<div class="inv-item" style="flex-wrap:wrap;gap:8px;${!isActive?'opacity:.5;':''}">
        <div class="inv-info" style="flex:1;min-width:160px;">
          <div class="inv-name">🥚 ${esc(item.name)}</div>
          <div class="inv-sub">${item.category||'食材'}・初期在庫 ${item.stock}個</div>
          ${pct!=null?`<div style="height:6px;background:#e5e7eb;border-radius:4px;margin-top:6px;"><div style="height:6px;border-radius:4px;background:${barColor};width:${pct}%;transition:width .3s;"></div></div>`:''}
        </div>
        <span class="stk-badge ${cur<=0?'stk-zero':cur<=item.stock*0.2?'stk-low':'stk-ok'}" style="font-size:15px;padding:6px 14px;">${cur} 個</span>
        <div class="stk-ctrl">
          <input type="number" id="psi-${item.id}" placeholder="個数" min="0" style="width:70px;">
          <button class="btn btn-success" style="padding:6px 9px;font-size:12px;" onclick="addStockPos(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">補充</button>
          <button class="btn btn-ghost" style="padding:6px 9px;font-size:12px;" onclick="setStockPos(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">設定</button>
        </div>
        ${linkedHtml?`<div style="width:100%;margin-top:4px;">${linkedHtml}</div>`:''}
      </div>`;
    });
    html+=`</div>`;
  }

  // 通常在庫セクション
  html+=`<div class="card"><div class="sec-hdr"><h3>📦 在庫管理</h3></div>`;
  if(regularItems.length===0){html+=`<div class="empty-state"><div class="icon">📦</div><p>メニューがありません</p></div>`;}
  else{
    regularItems.forEach(item=>{
      if(item.isSet){
        // セット商品は参照表示のみ
        const avail=getSetAvailability(item);
        html+=`<div class="inv-item"><div class="inv-info"><div class="inv-name">📦 ${esc(item.name)}</div><div class="inv-sub">¥${item.price.toLocaleString()} · セット商品（構成品の在庫が自動反映）</div></div><span class="stk-badge ${avail===0?'stk-zero':avail!=null&&avail<=3?'stk-low':avail!=null?'stk-ok':'stk-unlimited'}">${avail!=null?avail+' セット':'∞'}</span></div>`;
        return;
      }
      const hasStock=item.stock>0;
      const cur=hasStock?(item.currentStock!=null?item.currentStock:item.stock):null;
      const isActive=item.active!==false;
      let badge=hasStock?`<span class="stk-badge ${cur<=0?'stk-zero':cur<=5?'stk-low':'stk-ok'}">${cur} 個</span>`:`<span class="stk-badge stk-unlimited">無制限</span>`;
      let ctrl=hasStock?`<div class="stk-ctrl"><input type="number" id="psi-${item.id}" placeholder="数量" min="0"><button class="btn btn-success" style="padding:6px 9px;font-size:12px;" onclick="addStockPos(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">補充</button><button class="btn btn-ghost" style="padding:6px 9px;font-size:12px;" onclick="setStockPos(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">設定</button></div>`:'';
      html+=`<div class="inv-item" style="${!isActive?'opacity:.5;':''}"><div class="inv-info"><div class="inv-name">${esc(item.name)}</div><div class="inv-sub">¥${item.price.toLocaleString()}${item.category?' / '+item.category:''}</div></div>${badge}${ctrl}</div>`;
    });
  }
  html+=`</div>`;
  document.getElementById('pos-inventory-content').innerHTML=html;
}

async function addStockPos(id){
  const inp=document.getElementById(`psi-${id}`);
  const amt=parseInt(inp.value);
  if(!amt||amt<=0){showToast('補充数を入力してください','error');return;}
  const item=S.menu[id];if(!item)return;
  await db.ref(`${ROOT}/menu/${id}/currentStock`).transaction(cur=>(cur!=null?cur:(item.stock||0))+amt);
  inp.value='';showToast(`${item.name} を ${amt}個補充しました`,'success');
}
async function setStockPos(id){
  const inp=document.getElementById(`psi-${id}`);
  const amt=parseInt(inp.value);
  if(isNaN(amt)||amt<0){showToast('在庫数を入力してください','error');return;}
  const item=S.menu[id];if(!item)return;
  await db.ref(`${ROOT}/menu/${id}/currentStock`).set(amt);
  inp.value='';showToast(`${item.name} の在庫を ${amt}個に設定しました`,'success');
}

function enterAdmin(){
  S.currentRole='admin';
  showAdminPin(()=>{saveScreen('admin');showScreen('admin');});
}

let _clockTimer=null;
function startClock(){
  if(_clockTimer) return;
  const weekdays=['日','月','火','水','木','金','土'];
  function tick(){
    const now=new Date();
    const h=String(now.getHours()).padStart(2,'0');
    const m=String(now.getMinutes()).padStart(2,'0');
    const s=String(now.getSeconds()).padStart(2,'0');
    const el=document.getElementById('role-clock');
    const del=document.getElementById('role-date');
    if(el) el.textContent=`${h}:${m}:${s}`;
    if(del){
      const dateStr=now.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'});
      del.textContent=`${dateStr}（${weekdays[now.getDay()]}）`;
    }
  }
  tick();
  _clockTimer=setInterval(tick,1000);
}
function stopClock(){
  if(_clockTimer){clearInterval(_clockTimer);_clockTimer=null;}
}

function backToRole(){
  S.currentRole=null;
  saveScreen(null);
  if(_kitchenTimer){clearInterval(_kitchenTimer);_kitchenTimer=null;}
  showScreen('role');
}

//  FIREBASE LISTENERS
function setupListeners(){
  // Connection status (broadcast to all visible dots)
  db.ref('.info/connected').on('value',snap=>{
    const on=snap.val()===true;
    const cls='conn-dot '+(on?'online':'offline');
    const lbl=on?'リアルタイム同期中':'オフライン（再接続待ち）';
    ['role','cashier','kitchen','handoff','pos','admin'].forEach(r=>{
      const dot=document.getElementById(r+'-conn-dot');
      const label=document.getElementById(r+'-conn-label');
      if(dot) dot.className=cls;
      if(label) label.textContent=lbl;
    });
  });

  db.ref(`${ROOT}/settings`).on('value',snap=>{
    const v=snap.val();
    if(v){S.settings=v;}
    if(S.currentRole===null) updateRoleScreen();
  });

  db.ref(`${ROOT}/menu`).on('value',snap=>{
    S.menu=snap.val()||{};
    if(S.currentRole==='cashier'){renderCategoryFilter();renderMenu();}
    if(S.currentRole==='pos') renderPosTab(S.activePosTab||'menu');
    if(S.currentRole==='admin') renderAdminTab(S.activeAdminTab);
  });

  db.ref(`${ROOT}/currentDay`).on('value',snap=>{
    S.currentDay=snap.val();
    S.isDayOpen=S.currentDay!==null;
    updateDayStatusBadges();
    if(S.currentRole===null) updateRoleScreen();
    if(S.currentRole==='cashier') updateCashierOverlay();
    if(S.currentRole==='kitchen'){updateKitchenOverlay();renderKitchen();}
    if(S.currentRole==='handoff'){updateHandoffOverlay();renderHandoff();}
    if(S.currentRole==='dash') renderDashboard();
    if(S.currentRole==='admin'){renderAdminTab(S.activeAdminTab);updateAdminDayStatus();}
  });

  db.ref(`${ROOT}/orders`).on('value',snap=>{
    S.ordersSnap=snap.val()||{};
    if(S.currentRole==='kitchen') renderKitchen();
    if(S.currentRole==='handoff') renderHandoff();
    if(S.currentRole==='dash') renderDashboard();
    if(S.currentRole==='admin'&&S.activeAdminTab==='sales') renderSalesContent();
    if(S.currentRole==='admin'&&S.activeAdminTab==='vouchers') renderAdminVouchers();
  });

  db.ref(`${ROOT}/days`).on('value',snap=>{
    S.daysSnap=snap.val()||{};
    if(S.currentRole==='admin'&&S.activeAdminTab==='sales') renderSalesContent();
  });

  db.ref(`${ROOT}/shifts`).on('value',snap=>{
    S.shiftsSnap=snap.val()||{};
    renderShiftDisplay();
    if(S.currentRole==='admin'&&S.activeAdminTab==='shifts') renderAdminShifts();
  });
  db.ref(`${ROOT}/members`).on('value',snap=>{
    S.membersSnap=snap.val()||{};
    if(S.currentRole==='admin'&&S.activeAdminTab==='shifts') renderAdminShifts();
  });
  db.ref(`${ROOT}/gradeColors`).on('value',snap=>{
    S.gradeColors=snap.val()||{};
    if(S.currentRole==='admin'&&S.activeAdminTab==='shifts') renderAdminShifts();
    renderShiftDisplay();
  });
  db.ref(`${ROOT}/tickets`).on('value',snap=>{
    S.ticketsSnap=snap.val()||{};
    if(S.currentRole==='kitchen') renderKitchenTickets();
    if(S.currentRole==='handoff') renderHandoffTickets();
    if(S.currentRole==='admin'&&S.activeAdminTab==='tickets') renderAdminTickets();
  });
  db.ref(`${ROOT}/voucherColors`).on('value',snap=>{
    S.voucherColorsSnap=snap.val()||{};
    if(S.currentRole==='admin'&&S.activeAdminTab==='vouchers') renderAdminVouchers();
  });
}

function updateDayStatusBadges(){
  const txt=S.isDayOpen && S.currentDay ? `Day ${S.currentDay.dayNumber} 営業中` : 'クローズ中';
  const cls=S.isDayOpen ? 'status-open' : 'status-closed';
  ['cashier','kitchen','handoff'].forEach(r=>{
    const el=document.getElementById(`day-status-${r}`);
    if(el){el.textContent=txt;el.className=cls;}
  });
}

function updateAdminDayStatus(){
  const el=document.getElementById('day-status-admin');
  if(!el) return;
  if(S.isDayOpen && S.currentDay){
    el.textContent=`Day ${S.currentDay.dayNumber} 営業中`;
    el.className='status-open';
    el.style.cssText='font-size:12px;padding:5px 11px;border-radius:20px;font-weight:700;';
  } else {
    el.textContent='クローズ中';
    el.className='status-closed';
    el.style.cssText='font-size:12px;padding:5px 11px;border-radius:20px;font-weight:700;';
  }
}

function updateCashierOverlay(){
  const ov=document.getElementById('cashier-closed');
  S.isDayOpen ? ov.classList.remove('show') : ov.classList.add('show');
}

function updateKitchenOverlay(){
  const ov=document.getElementById('kitchen-closed');
  S.isDayOpen ? ov.classList.remove('show') : ov.classList.add('show');
}

function updateHandoffOverlay(){
  const ov=document.getElementById('handoff-closed');
  S.isDayOpen ? ov.classList.remove('show') : ov.classList.add('show');
}

