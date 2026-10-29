// ===== 管理: 整理券・バザー券・営業開始/終了・設定・売上・在庫 =====
//  ADMIN: 整理券管理
function renderAdminTickets(){
  const el=document.getElementById('acontent-tickets');
  if(!el) return;
  const tickets=Object.values(S.ticketsSnap).sort((a,b)=>a.num-b.num);
  const maxNum=tickets.length>0?Math.max(...tickets.map(t=>t.num)):0;
  const cntAvail=tickets.filter(t=>t.status==='available').length;
  const cntUse=tickets.filter(t=>t.status==='in_use').length;

  let html=`<div class="card">
    <div class="sec-hdr"><h3>🎫 整理券一覧</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="addTicket()">＋ 追加</button>
        <button class="btn btn-ghost" onclick="showBulkAddTickets()">📋 まとめて</button>
      </div>
    </div>
    <div id="bulk-add-area" style="display:none;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:12px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:800;color:#0369a1;margin-bottom:9px;">📋 まとめて発行</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:13px;font-weight:700;">No.</span>
          <input type="number" id="bulk-from" min="1" value="${maxNum+1}" style="width:72px;padding:6px 8px;border:1.5px solid #bae6fd;border-radius:7px;font-size:14px;text-align:center;outline:none;">
          <span style="font-size:13px;font-weight:700;">〜 No.</span>
          <input type="number" id="bulk-to" min="1" value="${maxNum+10}" style="width:72px;padding:6px 8px;border:1.5px solid #bae6fd;border-radius:7px;font-size:14px;text-align:center;outline:none;">
        </div>
        <button class="btn btn-primary" style="background:#0369a1;" onclick="bulkAddTickets()">発行</button>
        <button class="btn btn-ghost" onclick="document.getElementById('bulk-add-area').style.display='none'">閉じる</button>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:10px 12px;background:#f8fafc;border-radius:10px;align-items:center;">
      <span style="font-size:12px;color:var(--gray);">✅ 空き <b style="color:#15803d;">${cntAvail}</b></span>
      <span style="font-size:12px;color:var(--gray);">🍳 使用中 <b style="color:#c2410c;">${cntUse}</b></span>
      <span style="font-size:12px;color:var(--gray);">合計 <b>${tickets.length}</b> 枚</span>
    </div>`;

  if(tickets.length===0){
    html+=`<div class="empty-state"><div class="icon">🎫</div><p>整理券がありません<br>「追加」から発行してください</p></div>`;
  }else{
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;">`;
    tickets.forEach(t=>{
      const isUsed=t.status!=='available';
      const order=isUsed&&t.orderId?S.ordersSnap[t.orderId]:null;
      const orderLabel=order?`注文#${order.orderNum}`:'';
      html+=`<div style="text-align:center;padding:12px 6px 8px;border-radius:12px;border:2px solid ${isUsed?'#fdba74':'#86efac'};background:${isUsed?'#fff7ed':'#f0fdf4'};">
        <div style="font-size:24px;font-weight:900;color:${isUsed?'#c2410c':'#15803d'};">${t.num}</div>
        <div style="font-size:10px;font-weight:700;color:${isUsed?'#c2410c':'#15803d'};margin-top:2px;">${isUsed?'使用中':'空き'}</div>
        ${orderLabel?`<div style="font-size:10px;color:var(--gray);margin-top:1px;">${orderLabel}</div>`:''}
        <button type="button" onclick="deleteTicket(${t.id})" ${isUsed?'disabled':''} style="margin-top:6px;background:none;border:none;font-size:14px;cursor:${isUsed?'not-allowed':'pointer'};opacity:${isUsed?'.3':'1'};">🗑️</button>
      </div>`;
    });
    html+=`</div>`;
  }
  html+=`</div>`;
  el.innerHTML=html;
}

async function addTicket(){
  const existing=Object.values(S.ticketsSnap);
  const maxNum=existing.length>0?Math.max(...existing.map(t=>t.num)):0;
  const id=Date.now();
  const ticket={id,num:maxNum+1,status:'available',createdAt:new Date().toISOString()};
  await db.ref(`${ROOT}/tickets/${id}`).set(ticket);
  showToast(`🎫 整理券 No.${ticket.num} を発行しました`,'success');
}
function showBulkAddTickets(){
  const area=document.getElementById('bulk-add-area');
  if(area) area.style.display='block';
}
async function bulkAddTickets(){
  const from=parseInt(document.getElementById('bulk-from')?.value);
  const to=parseInt(document.getElementById('bulk-to')?.value);
  if(isNaN(from)||isNaN(to)||from>to||from<1){showToast('正しい範囲を入力してください','error');return;}
  if(to-from>50){showToast('一度に51枚以上は発行できません','error');return;}
  const existing=Object.values(S.ticketsSnap);
  const existNums=new Set(existing.map(t=>t.num));
  const updates={};
  let added=0;
  for(let n=from;n<=to;n++){
    if(!existNums.has(n)){
      const id=Date.now()+added;
      updates[`${ROOT}/tickets/${id}`]={id,num:n,status:'available',createdAt:new Date().toISOString()};
      added++;
    }
  }
  if(added===0){showToast('指定範囲はすべて発行済みです','info');return;}
  await db.ref('/').update(updates);
  document.getElementById('bulk-add-area').style.display='none';
  showToast(`🎫 ${added}枚の整理券を発行しました`,'success');
}
async function deleteTicket(id){
  if(!confirm('この整理券を削除しますか？'))return;
  await db.ref(`${ROOT}/tickets/${id}`).remove();
  showToast('整理券を削除しました');
}

//  ADMIN: バザー券（色）管理
const VOUCHER_FACE_VALUE=100;
const VOUCHER_DEFAULT_COLORS=[
  {label:'赤',hex:'#ef4444'},{label:'青',hex:'#3b82f6'},{label:'黄',hex:'#eab308'},
  {label:'緑',hex:'#22c55e'},{label:'紫',hex:'#a855f7'},{label:'桃',hex:'#ec4899'},{label:'橙',hex:'#f97316'}
];
function renderAdminVouchers(){
  const el=document.getElementById('acontent-vouchers');
  if(!el) return;
  const colors=Object.entries(S.voucherColorsSnap||{}).sort((a,b)=>(a[1].order||0)-(b[1].order||0));
  let html=`<div class="card">
    <div class="sec-hdr"><h3>🎟️ バザー券の色</h3></div>
    <p style="font-size:12px;color:var(--gray);margin:-6px 0 12px;">1枚 ¥${VOUCHER_FACE_VALUE} 分として会計で使えます。色を登録しておくと、会計画面で色ごとに枚数を入力できるようになります。</p>`;
  if(colors.length===0){
    html+=`<div class="empty-state"><div class="icon">🎟️</div><p>まだ色が登録されていません</p></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="addDefaultVoucherColors()">✨ よく使う7色をまとめて登録</button>`;
  }else{
    html+=`<div style="display:flex;flex-direction:column;gap:8px;">`;
    colors.forEach(([id,c])=>{
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;">
        <div style="width:22px;height:22px;border-radius:50%;background:${esc(c.hex)};border:1.5px solid rgba(0,0,0,.15);flex-shrink:0;"></div>
        <div style="flex:1;font-weight:700;font-size:14px;">${esc(c.label)}</div>
        <button class="btn btn-danger" style="padding:5px 10px;font-size:12px;" onclick="deleteVoucherColor('${id}')">🗑️</button>
      </div>`;
    });
    html+=`</div>`;
  }
  html+=`
    <div style="display:flex;gap:8px;margin-top:14px;align-items:center;">
      <input type="text" id="vc-label" placeholder="色の名前（例：黄）" style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;">
      <input type="color" id="vc-hex" value="#ef4444" style="width:44px;height:36px;border:none;border-radius:8px;cursor:pointer;padding:0;">
      <button class="btn btn-primary" onclick="addVoucherColor()">＋ 追加</button>
    </div>
  </div>`;

  // 本日の集計（精算用）
  const dayOrders=S.isDayOpen&&S.currentDay?Object.values(S.ordersSnap||{}).filter(o=>o.dayId===S.currentDay.id):[];
  const totals={};
  dayOrders.forEach(o=>Object.entries(o.vouchers||{}).forEach(([cid,n])=>{ totals[cid]=(totals[cid]||0)+n; }));
  html+=`<div class="card"><h3>📊 本日のバザー券集計</h3>`;
  const anyVoucher=Object.keys(totals).length>0;
  if(!anyVoucher){
    html+=`<div class="empty-state"><div class="icon">🎟️</div><p>本日はまだバザー券の利用がありません</p></div>`;
  }else{
    html+=`<div class="table-wrap"><table class="data-table"><thead><tr><th>色</th><th>枚数</th><th>金額</th></tr></thead><tbody>`;
    let grandCount=0;
    colors.forEach(([id,c])=>{
      const n=totals[id]||0;
      if(n===0) return;
      grandCount+=n;
      html+=`<tr><td><span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:50%;background:${esc(c.hex)};display:inline-block;border:1px solid rgba(0,0,0,.15);"></span>${esc(c.label)}</span></td><td>${n} 枚</td><td>¥${(n*VOUCHER_FACE_VALUE).toLocaleString()}</td></tr>`;
    });
    html+=`<tr style="font-weight:800;"><td>合計</td><td>${grandCount} 枚</td><td>¥${(grandCount*VOUCHER_FACE_VALUE).toLocaleString()}</td></tr>`;
    html+=`</tbody></table></div>`;
  }
  html+=`</div>`;
  el.innerHTML=html;
}
async function addVoucherColor(){
  const label=(document.getElementById('vc-label').value||'').trim();
  const hex=document.getElementById('vc-hex').value||'#ef4444';
  if(!label){showToast('色の名前を入力してください','error');return;}
  const id=Date.now();
  const order=Object.keys(S.voucherColorsSnap||{}).length;
  await db.ref(`${ROOT}/voucherColors/${id}`).set({id,label,hex,order});
  showToast(`「${label}」を追加しました`,'success');
}
async function addDefaultVoucherColors(){
  const updates={};
  VOUCHER_DEFAULT_COLORS.forEach((c,i)=>{
    const id=Date.now()+i;
    updates[`${ROOT}/voucherColors/${id}`]={id,label:c.label,hex:c.hex,order:i};
  });
  await db.ref('/').update(updates);
  showToast('7色を登録しました 🎉','success');
}
async function deleteVoucherColor(id){
  if(!confirm('この色を削除しますか？'))return;
  await db.ref(`${ROOT}/voucherColors/${id}`).remove();
  showToast('削除しました');
}

//  DAY MANAGEMENT
function openDay(){
  const dayCount=Object.keys(S.daysSnap||{}).length;
  const day={id:Date.now(),dayNumber:dayCount+1,date:new Date().toISOString(),openTime:new Date().toISOString()};
  db.ref(`${ROOT}/currentDay`).set(day);
  showToast(`✅ Day ${day.dayNumber} オープンしました！`,'success');
}
function showCloseDayModal(){
  if(!S.isDayOpen) return;
  const orders=getOrdersForDay(S.currentDay.id);
  const total=orders.reduce((s,o)=>s+o.total,0);
  const itemMap=buildItemMap(orders);
  let html=`
    <div class="sum-row"><span class="lbl">営業日</span><span class="val">Day ${S.currentDay.dayNumber}</span></div>
    <div class="sum-row"><span class="lbl">取引件数</span><span class="val">${orders.length} 件</span></div>
    <div class="sum-row"><span class="lbl">売上合計</span><span class="val" style="color:var(--primary);font-size:18px;">¥${total.toLocaleString()}</span></div>
  `;
  if(Object.keys(itemMap).length>0){
    html+=`<div style="margin-top:12px;font-size:13px;font-weight:800;color:var(--gray);">商品別</div>`;
    Object.entries(itemMap).forEach(([n,d])=>{html+=`<div class="sum-row"><span class="lbl">${esc(n)}</span><span class="val">${d.qty}個 / ¥${d.revenue.toLocaleString()}</span></div>`;});
  }
  document.getElementById('close-day-summary').innerHTML=html;
  document.getElementById('close-day-modal-overlay').classList.add('show');
}
function closeCloseDayModal(){document.getElementById('close-day-modal-overlay').classList.remove('show');}
async function confirmCloseDay(){
  const orders=getOrdersForDay(S.currentDay.id);
  const total=orders.reduce((s,o)=>s+o.total,0);
  const closed={...S.currentDay,closeTime:new Date().toISOString(),totalSales:total,totalOrders:orders.length,itemSummary:buildItemMap(orders)};
  showLoading(true);
  try{
    await db.ref(`${ROOT}/days/${closed.id}`).set(closed);
    await db.ref(`${ROOT}/currentDay`).remove();
    closeCloseDayModal();
    showDaySummaryModal(closed,true);
  }catch(e){showToast('エラーが発生しました','error');}
  showLoading(false);
}
function buildItemMap(orders){
  const m={};
  orders.forEach(o=>(o.items||[]).forEach(item=>{
    if(!m[item.name])m[item.name]={qty:0,revenue:0};
    m[item.name].qty+=item.qty;
    m[item.name].revenue+=item.price*item.qty;
  }));
  return m;
}
function getOrdersForDay(dayId){return Object.values(S.ordersSnap||{}).filter(o=>o.dayId===dayId);}
function showDaySummaryModal(day,isJustClosed=false){
  const date=new Date(day.date).toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'});
  document.getElementById('day-summary-title').textContent=isJustClosed?'🎉 お疲れさまでした！':`📋 Day ${day.dayNumber} サマリー`;
  let html=`
    <div style="background:#f0fdf4;border-radius:14px;padding:16px;text-align:center;margin-bottom:14px;border:2px solid #bbf7d0;">
      <div style="font-size:12px;color:var(--gray);font-weight:700;">Day ${day.dayNumber} 売上合計</div>
      <div style="font-size:34px;font-weight:800;color:var(--success);">¥${(day.totalSales||0).toLocaleString()}</div>
    </div>
    <div class="sum-row"><span class="lbl">日付</span><span class="val">${date}</span></div>
    <div class="sum-row"><span class="lbl">取引件数</span><span class="val">${day.totalOrders||0} 件</span></div>
  `;
  if(day.itemSummary){
    html+=`<div style="margin-top:12px;font-size:13px;font-weight:800;color:var(--gray);">商品別売上</div>`;
    Object.entries(day.itemSummary).sort((a,b)=>b[1].revenue-a[1].revenue).forEach(([n,d])=>{
      html+=`<div class="sum-row"><span class="lbl">${esc(n)}</span><span class="val">${d.qty}個 / ¥${d.revenue.toLocaleString()}</span></div>`;
    });
  }
  document.getElementById('day-summary-content').innerHTML=html;
  document.getElementById('day-summary-modal-overlay').classList.add('show');
}
function closeDaySummaryModal(){document.getElementById('day-summary-modal-overlay').classList.remove('show');}

//  ADMIN TABS
function switchAdminTab(tab){
  S.activeAdminTab=tab;
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c=>c.classList.remove('active'));
  document.getElementById('atab-'+tab).classList.add('active');
  document.getElementById('acontent-'+tab).classList.add('active');
  renderAdminTab(tab);
}
function renderAdminTab(tab){
  if(tab==='settings') renderSettingsContent();
  if(tab==='sales') renderSalesContent();
  if(tab==='tickets') renderAdminTickets();
  if(tab==='vouchers') renderAdminVouchers();
  if(tab==='shifts') renderAdminShifts();
}

//  ADMIN: SETTINGS
function renderSettingsContent(){
  const items=Object.values(S.menu);
  let html=`
    <div class="share-banner">
      <div class="sb-icon">📤</div>
      <div style="flex:1;"><h3>メンバーへ配布</h3><p>設定済みファイルを生成してLINE等で送るだけ</p></div>
      <button class="sb-btn" onclick="downloadShareFile()">配布用ファイル生成</button>
    </div>
    <div class="card">
      <h3>🗓️ 営業管理</h3>
      <div style="text-align:center;padding:8px;">
        ${S.isDayOpen
          ?`<p style="color:var(--success);font-weight:800;margin-bottom:12px;">✅ Day ${S.currentDay.dayNumber} 営業中</p>
            <button class="day-mgmt-btn day-close-btn" onclick="showCloseDayModal()">🔒 本日クローズ（営業終了）</button>`
          :`<p style="color:var(--gray);font-weight:700;margin-bottom:12px;">現在クローズ中</p>
            <button class="day-mgmt-btn day-open-btn" onclick="openDay()">🟢 オープン（営業開始）</button>`}
      </div>
    </div>
    <div class="card">
      <h3>🏪 店舗設定</h3>
      <div class="form-group"><label>店舗名</label><input type="text" id="s-name" value="${esc(S.settings.storeName||'')}" placeholder="店舗名"></div>
      <button class="btn btn-primary" onclick="saveStoreSettings()">💾 保存</button>
    </div>
    <div class="card">
      <h3>🔐 管理者PINコード変更</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group" style="margin-bottom:0;"><label>新しいPIN（4桁）</label><input type="password" id="new-pin" placeholder="0000" maxlength="4" inputmode="numeric"></div>
        <div class="form-group" style="margin-bottom:0;"><label>確認</label><input type="password" id="new-pin2" placeholder="0000" maxlength="4" inputmode="numeric"></div>
      </div>
      <div style="margin-top:11px;"><button class="btn btn-warning" onclick="changePin()">🔑 PINを変更</button></div>
    </div>
    <div class="card">
      <div class="sec-hdr"><h3>📋 メニュー管理</h3><button class="btn btn-primary" onclick="showMenuAddModal()">＋ 商品追加</button></div>
      <div id="admin-menu-list">`;

  if(items.length===0){html+=`<div class="empty-state"><div class="icon">📋</div><p>まだ商品がありません</p></div>`;}
  else{
    items.forEach(item=>{
      const isActive=item.active!==false;
      const hasStock=item.stock>0;
      const cur=hasStock?(item.currentStock!=null?item.currentStock:item.stock):null;
      const setTag=isSetItem(item)?'<span style="font-size:10px;background:#ede9fe;color:#7c3aed;border-radius:4px;padding:1px 5px;font-weight:700;">セット</span> ':'';
      const topTag=isToppingItem(item)?'<span style="font-size:10px;background:#dcfce7;color:#166534;border-radius:4px;padding:1px 5px;font-weight:700;">トッピング</span> ':'';
      const matTag=item.isMaterial?'<span style="font-size:10px;background:#fef9c3;color:#92400e;border-radius:4px;padding:1px 5px;font-weight:700;">レジ非表示</span> ':'';
      html+=`<div class="menu-row">
        <div class="menu-row-info">
          <div class="menu-row-name" style="${!isActive?'color:var(--gray);':''}">${setTag}${matTag}${topTag}${esc(item.name)}</div>
          <div class="menu-row-sub">¥${item.price.toLocaleString()}${item.category?' / '+esc(item.category):''} / ${isSetItem(item)?'セット':item.isSet?'構成品から在庫計算':hasStock?`在庫:${cur}個`:'在庫管理なし'}</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" ${isActive?'checked':''} onchange="toggleItem(${JSON.stringify(item.id).replace(/"/g,'&quot;')},this.checked)"><span class="toggle-slider"></span></label>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="showMenuEditModal(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="deleteItem(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">🗑️</button>
      </div>`;
    });
  }
  html+=`</div></div>
    ${renderAccountCard()}
    <div class="card">
      <h3>💾 データ管理</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-success" onclick="exportExcel()">📊 Excel出力</button>
        <button class="btn btn-ghost" onclick="exportCsv()">📄 CSV出力</button>
        <button class="btn btn-ghost" onclick="exportData()">💾 JSON出力</button>
        <button class="btn btn-warning" onclick="confirmResetSalesOnly()">🧹 営業実績だけ消去</button>
        <button class="btn btn-danger" onclick="confirmReset()">⚠️ 全データリセット</button>
      </div>
    </div>`;
  document.getElementById('settings-content').innerHTML=html;
}
async function saveStoreSettings(){
  const name=document.getElementById('s-name').value.trim()||'じゃがバター屋';
  await db.ref(`${ROOT}/settings/storeName`).set(name);
  showToast('設定を保存しました','success');
}
async function changePin(){
  const p1=document.getElementById('new-pin').value;
  const p2=document.getElementById('new-pin2').value;
  if(!/^\d{4}$/.test(p1)){showToast('4桁の数字を入力してください','error');return;}
  if(p1!==p2){showToast('PINが一致しません','error');return;}
  await db.ref(`${ROOT}/settings/adminPin`).set(p1);
  document.getElementById('new-pin').value='';
  document.getElementById('new-pin2').value='';
  showToast('PINを変更しました ✅','success');
}

//  ADMIN: SALES
function renderSalesContent(){
  const days=Object.values(S.daysSnap||{});
  const allOrders=Object.values(S.ordersSnap||{});
  const todayOrders=S.isDayOpen?allOrders.filter(o=>o.dayId===S.currentDay?.id):[];
  const todayTotal=todayOrders.reduce((s,o)=>s+o.total,0);
  const allTotal=allOrders.reduce((s,o)=>s+o.total,0);
  const todayMap=buildItemMap(todayOrders);

  let html=`<div class="stats-grid">
    <div class="stat-card"><div class="stat-value">¥${todayTotal.toLocaleString()}</div><div class="stat-label">本日の売上</div></div>
    <div class="stat-card"><div class="stat-value">${todayOrders.length}</div><div class="stat-label">本日の取引数</div></div>
    <div class="stat-card"><div class="stat-value">¥${allTotal.toLocaleString()}</div><div class="stat-label">累計売上</div></div>
    <div class="stat-card"><div class="stat-value">${days.length+(S.isDayOpen?1:0)}</div><div class="stat-label">営業日数</div></div>
  </div>`;

  const allDaysForTrend=[...days].sort((a,b)=>a.dayNumber-b.dayNumber);
  if(S.isDayOpen&&S.currentDay) allDaysForTrend.push({dayNumber:S.currentDay.dayNumber,totalSales:todayTotal,_live:true});

  html+=`<div class="card">
    <div class="sec-hdr"><h3>📈 売上分析</h3></div>
    <div style="display:grid;grid-template-columns:1fr;gap:18px;">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--gray);margin-bottom:6px;">商品別売上（本日）</div>
        <div style="position:relative;height:220px;"><canvas id="salesItemChart"></canvas></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--gray);margin-bottom:6px;">営業日別売上の推移</div>
        <div style="position:relative;height:220px;"><canvas id="salesTrendChart"></canvas></div>
      </div>
    </div>
  </div>`;

  html+=`<div class="card"><div class="sec-hdr"><h3>📊 本日の商品別売上</h3></div>`;
  if(Object.keys(todayMap).length===0){html+=`<div class="empty-state"><div class="icon">📊</div><p>まだ売上がありません</p></div>`;}
  else{
    html+=`<div class="table-wrap"><table class="data-table"><thead><tr><th>商品名</th><th>販売数</th><th>売上金額</th></tr></thead><tbody>`;
    Object.entries(todayMap).sort((a,b)=>b[1].revenue-a[1].revenue).forEach(([n,d])=>{
      html+=`<tr><td>${esc(n)}</td><td>${d.qty} 個</td><td>¥${d.revenue.toLocaleString()}</td></tr>`;
    });
    html+=`</tbody></table></div>`;
  }
  html+=`</div>`;

  if(days.length>0){
    html+=`<div class="card"><h3>📅 過去の営業記録</h3>`;
    [...days].sort((a,b)=>b.dayNumber-a.dayNumber).forEach(day=>{
      const date=new Date(day.date).toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
      const dayIdStr=String(day.id).replace(/'/g,'');
      html+=`<div class="day-card" style="display:flex;align-items:center;gap:8px;" onclick='showDaySummaryModal(${JSON.stringify(day)})'>
        <div style="flex:1;">
          <h4>Day ${day.dayNumber}（${date}）</h4>
          <div class="ds"><span>💰 ¥${(day.totalSales||0).toLocaleString()}</span><span>📝 ${day.totalOrders||0} 件</span></div>
        </div>
        <button onclick="event.stopPropagation();deleteDayRecord('${dayIdStr}')" style="flex-shrink:0;background:#fee2e2;color:#991b1b;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;">🗑️ 削除</button>
      </div>`;
    });
    html+=`</div>`;
  }

  if(todayOrders.length>0){
    html+=`<div class="card"><h3>🧾 本日の取引履歴</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>時刻</th><th>商品</th><th>金額</th><th></th></tr></thead><tbody>`;
    [...todayOrders].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).forEach(o=>{
      const time=new Date(o.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
      const stLabel=o.status==='completed'?['#16a34a','✅ 受渡済']:o.status==='cooked'?['#db2777','🛎️ お渡し待ち']:['var(--warning)','🍳 調理待ち'];
      const status=`<span style="color:${stLabel[0]};font-size:11px;">${stLabel[1]}</span>`;
      const isCancellable=o.status!=='cancelled';html+=`<tr style="${o.status==='cancelled'?'opacity:.45;':''}"><td>#${o.orderNum||'-'} ${status}</td><td>${time}</td><td style="font-size:12px;">${esc((o.items||[]).map(i=>`${i.name}×${i.qty}`).join('、'))}</td><td style="font-weight:700;">¥${o.total.toLocaleString()}</td><td>${isCancellable?`<button class="btn btn-danger" style="padding:4px 8px;font-size:11px;" onclick="cancelOrder(${JSON.stringify(o.id).replace(/"/g,'&quot;')})">🗑️ 取消</button>`:''}</td></tr>`;
    });
    html+=`</tbody></table></div></div>`;
  }
  document.getElementById('sales-content').innerHTML=html;
  renderSalesCharts(todayMap,allDaysForTrend);
}

//  SALES ANALYTICS CHARTS (Chart.js)
S.charts=S.charts||{};
function renderSalesCharts(itemMap,dayTrend){
  if(typeof Chart==='undefined') return;
  setTimeout(()=>{
    // 商品別売上（本日）棒グラフ
    const itemCtx=document.getElementById('salesItemChart');
    if(itemCtx){
      if(S.charts.item){S.charts.item.destroy();}
      const entries=Object.entries(itemMap||{}).sort((a,b)=>b[1].revenue-a[1].revenue);
      if(entries.length>0){
        S.charts.item=new Chart(itemCtx,{
          type:'bar',
          data:{
            labels:entries.map(([n])=>n),
            datasets:[{label:'売上（円）',data:entries.map(([,d])=>d.revenue),backgroundColor:'#2563eb',borderRadius:6}]
          },
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
        });
      }
    }
    // 営業日別売上推移
    const trendCtx=document.getElementById('salesTrendChart');
    if(trendCtx){
      if(S.charts.trend){S.charts.trend.destroy();}
      const days=(dayTrend||[]);
      if(days.length>0){
        S.charts.trend=new Chart(trendCtx,{
          type:'line',
          data:{
            labels:days.map(d=>`Day ${d.dayNumber}${d._live?'（営業中）':''}`),
            datasets:[{label:'売上（円）',data:days.map(d=>d.totalSales||0),borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,.12)',fill:true,tension:.25,pointRadius:4}]
          },
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
        });
      }
    }
  },50);
}

//  ADMIN: INVENTORY
function renderInventoryContent(){
  const items=Object.values(S.menu);
  let html=`<div class="card"><div class="sec-hdr"><h3>📦 在庫管理</h3></div>`;
  if(items.length===0){html+=`<div class="empty-state"><div class="icon">📦</div><p>メニューがありません</p></div>`;}
  else{
    items.filter(i=>!i.isSet).forEach(item=>{
      const hasStock=item.stock>0;
      const cur=hasStock?(item.currentStock!=null?item.currentStock:item.stock):null;
      const isActive=item.active!==false;
      let badge=hasStock?`<span class="stk-badge ${cur<=0?'stk-zero':cur<=5?'stk-low':'stk-ok'}">${cur} 個</span>`:`<span class="stk-badge stk-unlimited">無制限</span>`;
      let ctrl=hasStock?`<div class="stk-ctrl"><input type="number" id="si-${item.id}" placeholder="数量" min="0" step="any"><button class="btn btn-success" style="padding:6px 9px;font-size:12px;" onclick="addStock(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">補充</button><button class="btn btn-ghost" style="padding:6px 9px;font-size:12px;" onclick="setStock(${JSON.stringify(item.id).replace(/"/g,'&quot;')})">設定</button></div>`:'';
      html+=`<div class="inv-item" style="${!isActive?'opacity:.5;':''}"><div class="inv-info"><div class="inv-name">${esc(item.name)}${item.isMaterial?' <span style="font-size:10px;background:#fef9c3;color:#92400e;border-radius:4px;padding:1px 5px;">レジ非表示</span>':''}</div><div class="inv-sub">¥${item.price.toLocaleString()}${item.category?' / '+esc(item.category):''}</div></div>${badge}${ctrl}</div>`;
    });
  }
  html+=`</div>`;
  document.getElementById('inventory-content').innerHTML=html;
}
async function addStock(id){
  const inp=document.getElementById(`si-${id}`);
  const amt=parseFloat(inp.value);
  if(!amt||amt<=0){showToast('補充数を入力してください','error');return;}
  const item=S.menu[id];if(!item)return;
  await db.ref(`${ROOT}/menu/${id}/currentStock`).transaction(cur=>r2((cur!=null?cur:(item.stock||0))+amt));
  inp.value='';showToast(`${item.name} を ${amt}個補充しました`,'success');
}
async function setStock(id){
  const inp=document.getElementById(`si-${id}`);
  const amt=parseFloat(inp.value);
  if(isNaN(amt)||amt<0){showToast('在庫数を入力してください','error');return;}
  const item=S.menu[id];if(!item)return;
  await db.ref(`${ROOT}/menu/${id}/currentStock`).set(amt);
  inp.value='';showToast(`${item.name} の在庫を ${amt}個に設定しました`,'success');
}

