// ===== 注文の取り消し・選択モーダル・PIN =====
//  ORDER CANCELLATION
async function deleteDayRecord(dayId){
  const day=Object.values(S.daysSnap||{}).find(d=>String(d.id)===String(dayId));
  if(!day){showToast('記録が見つかりません','error');return;}
  const date=new Date(day.date).toLocaleDateString('ja-JP',{month:'long',day:'numeric'});
  const orderCount=Object.values(S.ordersSnap||{}).filter(o=>String(o.dayId)===String(dayId)).length;
  if(!confirm(`Day ${day.dayNumber}（${date}）の記録を削除しますか？\n\n売上: ¥${(day.totalSales||0).toLocaleString()}\n取引件数: ${orderCount} 件\n\nこの操作は元に戻せません。`)) return;
  showLoading(true);
  try{
    // その日の注文を全削除
    const dayOrders=Object.entries(S.ordersSnap||{}).filter(([,o])=>String(o.dayId)===String(dayId));
    await Promise.all(dayOrders.map(([oid])=>db.ref(`${ROOT}/orders/${oid}`).remove()));
    // 日次記録を削除
    const dayEntry=Object.entries(S.daysSnap||{}).find(([,d])=>String(d.id)===String(dayId));
    if(dayEntry) await db.ref(`${ROOT}/days/${dayEntry[0]}`).remove();
    showToast(`Day ${day.dayNumber} の記録を削除しました`,'success');
  }catch(e){console.error(e);showToast('削除中にエラーが発生しました','error');}
  showLoading(false);
}

// ── 注文履歴（会計・調理・受け渡しの各画面から開く）。受け渡し済みの注文も取り消せる ──
function orderSummaryText(o){
  return (o.items||[]).map(i=>{
    const extra=[];
    if(i.temp) extra.push(i.temp);
    if(i.choices&&i.choices.length) i.choices.forEach(c=>extra.push(c.name+(c.temp?'('+c.temp+')':'')));
    return `${i.name}${extra.length?'［'+extra.join('・')+'］':''}×${i.qty}`;
  }).join('、');
}
function renderOrderHistory(){
  const box=document.getElementById('history-list');
  if(!box) return;
  if(!S.isDayOpen||!S.currentDay){box.innerHTML='<div class="done-feed-empty">営業中の注文がありません</div>';return;}
  const list=Object.values(S.ordersSnap||{}).filter(o=>String(o.dayId)===String(S.currentDay.id))
    .sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  if(list.length===0){box.innerHTML='<div class="done-feed-empty">まだ注文がありません</div>';return;}
  const stMap={pending:['#d97706','🍳 調理待ち'],cooked:['#db2777','🛎️ お渡し待ち'],completed:['#16a34a','✅ 受渡済']};
  box.innerHTML=list.map(o=>{
    const st=stMap[o.status||'pending']||stMap.pending;
    const time=new Date(o.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
    return `<div class="hist-row">
      <div class="hist-main">
        <div class="hist-top"><b>${o.ticketNum!=null?'🎫 '+o.ticketNum:'整理券なし'}</b><span>注文 #${o.orderNum||'?'}</span><span>${time}</span><span style="color:${st[0]};font-weight:800;">${st[1]}</span></div>
        <div class="hist-items">${esc(orderSummaryText(o))}</div>
        <div class="hist-total">¥${(o.total||0).toLocaleString()}</div>
      </div>
      <button class="btn btn-danger" style="padding:6px 12px;font-size:12px;flex-shrink:0;" onclick="requestCancelOrder('${o.id}')">取消</button>
    </div>`;
  }).join('');
}
function showOrderHistory(){
  renderOrderHistory();
  document.getElementById('history-modal-overlay').classList.add('show');
}
function closeOrderHistory(){document.getElementById('history-modal-overlay').classList.remove('show');}
function requestCancelOrder(orderId){
  // 誤操作防止: 管理PINを確認してから取り消す
  showAdminPin(()=>cancelOrder(orderId));
}
async function cancelOrder(orderId){
  const order=S.ordersSnap[orderId];
  if(!order){showToast('注文が見つかりません','error');return;}
  const itemsText=(order.items||[]).map(i=>`${i.name}×${i.qty}`).join('、');
  if(!confirm(`注文 #${order.orderNum||'?'} を取り消しますか？\n\n${itemsText}\n\n在庫と整理券は自動で戻されます。`)) return;
  showLoading(true);
  try{
    // 在庫を戻す
    for(const ci of (order.items||[])){
      const mi=S.menu[ci.id]||S.menu[String(ci.id)];
      if(!mi) continue;
      if(mi.isSet&&mi.components){
        for(const comp of mi.components){
          if(comp.isChoice){
            if(ci.choices){
              for(const choice of ci.choices){
                const choiceItem=S.menu[choice.id]||S.menu[String(choice.id)];
                if(choiceItem&&choiceItem.stock>0){
                  await db.ref(`${ROOT}/menu/${choice.id}/currentStock`).transaction(cur=>{
                    if(cur===null)return cur;
                    return cur+(comp.qty||1)*ci.qty;
                  });
                }
              }
            }
          }else{
            const compItem=S.menu[comp.id]||S.menu[String(comp.id)];
            if(compItem&&compItem.stock>0){
              await db.ref(`${ROOT}/menu/${comp.id}/currentStock`).transaction(cur=>{
                if(cur===null)return cur;
                return cur+(comp.qty||1)*ci.qty;
              });
            }
          }
        }
      }else if(mi.stock>0){
        await db.ref(`${ROOT}/menu/${ci.id}/currentStock`).transaction(cur=>{
          if(cur===null)return cur;
          return cur+ci.qty;
        });
      }
    }
    // 整理券を空きに戻す
    if(order.ticketNum!=null){
      const tk=Object.values(S.ticketsSnap).find(t=>t.num===order.ticketNum);
      // 受け渡し済みの注文では、整理券がすでに別のお客さんに使われていることがある → 自分の注文に紐づいているときだけ戻す
      if(tk&&String(tk.orderId)===String(order.id)) await db.ref(`${ROOT}/tickets/${tk.id}`).update({status:'available',orderId:null});
    }
    // 注文を削除
    await db.ref(`${ROOT}/orders/${orderId}`).remove();
    showToast(`注文 #${order.orderNum||'?'} を取り消しました ✅`,'success');
    renderSalesContent();
    if(document.getElementById('history-modal-overlay').classList.contains('show')) renderOrderHistory();
  }catch(e){console.error(e);showToast('エラーが発生しました','error');}
  showLoading(false);
}

//  CHOICE MODAL
let _choiceItem=null;
function tempRadiosHtml(name,hidden){
  return `<span class="temp-opts" style="${hidden?'display:none;':''}">${TEMP_OPTS.map(([t,k])=>`<label class="temp-opt ${k}"><input type="radio" name="${name}" value="${t}"><span>${t}</span></label>`).join('')}</span>`;
}
function showChoiceModal(item){
  _choiceItem=item;
  // 単品ドリンク: 常温/冷蔵だけ選ぶ
  if(isDrinkItem(item)&&!(item.components||[]).some(c=>c.isChoice)){
    document.getElementById('choice-modal-title').textContent=`🥤 ${esc(item.name)}`;
    document.getElementById('choice-modal-content').innerHTML=`<div style="font-size:14px;font-weight:800;margin-bottom:8px;">温度を選んでください</div><div class="temp-big">${TEMP_OPTS.map(([t,k])=>`<label class="temp-opt big ${k}"><input type="radio" name="temp-single" value="${t}"><span>${t}</span></label>`).join('')}</div>`;
    document.getElementById('choice-modal-overlay').classList.add('show');
    return;
  }
  document.getElementById('choice-modal-title').textContent=`🔸 ${esc(item.name)} のオプション`;
  const choiceComps=(item.components||[]).filter(c=>c.isChoice);
  let html='';
  choiceComps.forEach((comp,ci)=>{
    html+=`<div style="margin-bottom:16px;">
      <div style="font-size:14px;font-weight:800;color:#1e293b;margin-bottom:8px;">${esc(comp.label||'選択してください')}</div>`;
    (comp.choiceIds||[]).forEach(cid=>{
      const choiceItem=S.menu[cid]||S.menu[String(cid)];
      if(!choiceItem) return;
      const hasStock=choiceItem.stock>0;
      const cur=hasStock?(choiceItem.currentStock!=null?choiceItem.currentStock:choiceItem.stock):null;
      const isOut=hasStock&&cur<=0;
      const dr=isDrinkItem(choiceItem);
      html+=`<div class="choice-opt${isOut?' out':''}" style="flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:10px;flex:1;min-width:120px;cursor:pointer;">
          <input type="radio" name="choice-${ci}" value="${cid}" data-comp-idx="${ci}" data-comp-label="${esc(comp.label||'')}" data-name="${esc(choiceItem.name)}" data-drink="${dr?1:0}" ${isOut?'disabled':''} onchange="onChoicePick(${ci})" style="accent-color:var(--primary);width:18px;height:18px;flex-shrink:0;">
          <span class="choice-opt-name">${esc(choiceItem.name)}</span>
          ${hasStock?`<span class="choice-opt-stock">${isOut?'在庫切れ':`残${cur}`}</span>`:''}
        </label>
        ${dr?tempRadiosHtml(`temp-${ci}-${cid}`,true):''}
      </div>`;
    });
    html+=`</div>`;
  });
  document.getElementById('choice-modal-content').innerHTML=html;
  document.getElementById('choice-modal-overlay').classList.add('show');
}
// 選んだドリンクの温度ボタンだけ表示
function onChoicePick(ci){
  document.querySelectorAll(`input[name="choice-${ci}"]`).forEach(r=>{
    const box=r.closest('.choice-opt'); const t=box&&box.querySelector('.temp-opts');
    if(t) t.style.display=r.checked?'inline-flex':'none';
  });
}
function closeChoiceModal(){
  document.getElementById('choice-modal-overlay').classList.remove('show');
  _choiceItem=null;
}
function confirmChoice(){
  if(!_choiceItem) return;
  if(isDrinkItem(_choiceItem)&&!(_choiceItem.components||[]).some(c=>c.isChoice)){
    const t=document.querySelector('input[name="temp-single"]:checked');
    if(!t){showToast('常温か冷蔵を選んでください','error');return;}
    const it=_choiceItem;
    closeChoiceModal();
    addToCartWithTemp(it,t.value);
    return;
  }
  const choiceComps=(_choiceItem.components||[]).filter(c=>c.isChoice);
  const choices=[];
  for(let ci=0;ci<choiceComps.length;ci++){
    const comp=choiceComps[ci];
    const sel=document.querySelector(`input[name="choice-${ci}"]:checked`);
    if(!sel){showToast(`「${esc(comp.label||'オプション')}」を選択してください`,'error');return;}
    const ch={id:sel.value,name:sel.dataset.name||'',label:sel.dataset.compLabel||comp.label||'',compLabel:comp.label||''};
    if(sel.dataset.drink==='1'){
      const tr=document.querySelector(`input[name="temp-${ci}-${sel.value}"]:checked`);
      if(!tr){showToast(`「${esc(ch.name)}」は常温か冷蔵を選んでください`,'error');return;}
      ch.temp=tr.value;
    }
    choices.push(ch);
  }
  const choiceTarget=_choiceItem;
  closeChoiceModal();
  addToCartWithChoices(choiceTarget,choices);
}

//  PIN
function showAdminPin(cb){
  S.pinBuf='';S.pinCb=cb||null;
  updatePinDisp();
  document.getElementById('pin-error').style.display='none';
  document.getElementById('pin-modal-overlay').classList.add('show');
}
function closePinModal(){document.getElementById('pin-modal-overlay').classList.remove('show');S.pinBuf='';}
function pinInput(d){if(S.pinBuf.length<4){S.pinBuf+=d;updatePinDisp();}}
function pinDelete(){S.pinBuf=S.pinBuf.slice(0,-1);updatePinDisp();}
function updatePinDisp(){document.getElementById('pin-display').textContent='●'.repeat(S.pinBuf.length)+'＿'.repeat(4-S.pinBuf.length);}
function pinConfirm(){
  if(S.pinBuf===(S.settings.adminPin||'0000')){
    closePinModal();
    if(S.pinCb){S.pinCb();S.pinCb=null;}
  }else{
    document.getElementById('pin-error').style.display='block';
    S.pinBuf='';updatePinDisp();
    setTimeout(()=>document.getElementById('pin-error').style.display='none',3000);
  }
}

