// ===== カート・会計（バザー券・おつり・整理券） =====
//  CART
function addToCart(item){
  if(isDrinkItem(item)){ showChoiceModal(item); return; }
  // 選択式コンポーネントがあれば選択モーダルを先に表示
  if(item.isSet&&item.components&&item.components.some(c=>c.isChoice)){
    showChoiceModal(item); return;
  }
  const ex=S.cart.find(c=>c.id===item.id&&!c._choiceKey);
  if(ex){
    if(item.isSet){
      const avail=getSetAvailability(item);
      if(avail!==null&&ex.qty>=avail){showToast('在庫が足りません','error');return;}
    } else if(item.stock>0&&ex.qty>=(item.currentStock!=null?item.currentStock:item.stock)){
      showToast('在庫が足りません','error');return;
    }
    ex.qty++;
  }else{S.cart.push({...item,qty:1});}
  renderCart();
}
function addToCartWithTemp(item,temp){
  const key='t:'+temp;
  const ex=S.cart.find(c=>c.id===item.id&&c._choiceKey===key);
  if(ex){
    const av=item.isSet?getSetAvailability(item):(item.stock>0?(item.currentStock!=null?item.currentStock:item.stock):null);
    if(av!==null&&ex.qty>=av){showToast('在庫が足りません','error');return;}
    ex.qty++;
  } else S.cart.push({...item,qty:1,temp,_choiceKey:key});
  renderCart();
}
function addToCartWithChoices(item,choices){
  const choiceKey=choices.map(c=>c.id+(c.temp?':'+c.temp:'')).join('|');
  const ex=S.cart.find(c=>c.id===item.id&&c._choiceKey===choiceKey);
  if(ex){
    const avail=getSetAvailability(item);
    if(avail!==null&&ex.qty>=avail){showToast('在庫が足りません','error');return;}
    ex.qty++;
  }else{
    const extra=choices.reduce((s,c)=>s+(Number(c.extra)||0),0);
    S.cart.push({...item,price:(Number(item.price)||0)+extra,qty:1,choices,_choiceKey:choiceKey});
  }
  renderCart();
}
function removeFromCart(id,choiceKey=''){
  const sid=String(id);
  const i=S.cart.findIndex(c=>String(c.id)===sid&&(c._choiceKey||'')===(choiceKey||''));
  if(i===-1) return;
  if(S.cart[i].qty>1)S.cart[i].qty--;else S.cart.splice(i,1);
  renderCart();
}
function addCartQty(id,choiceKey=''){
  const sid=String(id);
  const ci=S.cart.find(c=>String(c.id)===sid&&(c._choiceKey||'')===(choiceKey||''));
  if(!ci) return;
  const mi=S.menu[id]||S.menu[sid];
  if(mi){
    let avail=null;
    if(mi.isSet){
      avail=getSetAvailability(mi);
    }else if(mi.stock>0){
      avail=mi.currentStock!=null?mi.currentStock:mi.stock;
    }
    if(avail!==null&&ci.qty>=avail){showToast('在庫が足りません','error');return;}
  }
  ci.qty++;
  renderCart();
}
function clearCart(){if(!S.cart.length)return;S.cart=[];renderCart();}

function renderCart(){
  const el=document.getElementById('cart-items');
  if(!el) return;
  const total=S.cart.reduce((s,i)=>s+(Number(i.price)||0)*i.qty,0);
  const count=S.cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cart-count').textContent=`${count} 点`;
  document.getElementById('total-display').textContent=`¥${total.toLocaleString()}`;
  document.getElementById('pay-btn').disabled=S.cart.length===0;
  // モバイル下バー更新
  const mcbCount=document.getElementById('mcb-count');
  const mcbTotal=document.getElementById('mcb-total');
  const mcbPay=document.getElementById('mcb-pay-btn');
  if(mcbCount) mcbCount.textContent=count>0?`${count}点`:'';
  if(mcbTotal) mcbTotal.textContent=`¥${total.toLocaleString()}`;
  if(mcbPay) mcbPay.disabled=S.cart.length===0;
  if(S.cart.length===0){el.innerHTML=`<div class="empty-state"><div class="icon">🛒</div><p>商品ボタンを<br>タップして追加</p></div>`;return;}
  el.innerHTML='';
  S.cart.forEach(item=>{
    const ck=item._choiceKey||'';
    const choiceTag=item.choices&&item.choices.length>0
      ?item.choices.map(c=>`<span class="cart-choice-tag">🔸 ${esc(c.label||c.compLabel||'')}: ${esc(c.name||'')}${c.extra>0?' +'+c.extra+'円':''}${c.temp?' '+tempBadge(c.temp):''}</span>`).join('')
      :(item.temp?`<span class="cart-choice-tag">${tempBadge(item.temp)}</span>`:'');
    const d=document.createElement('div');
    d.className='cart-item';
    const price=Number(item.price)||0;
    d.innerHTML=`<div class="ci-info"><div class="ci-name">${esc(item.name)}</div>${choiceTag?`<div style="margin-top:3px;">${choiceTag}</div>`:''}<div class="ci-price">¥${price.toLocaleString()} × ${item.qty} = ¥${(price*item.qty).toLocaleString()}</div></div><div class="qty-controls"><button class="qty-btn qty-minus">−</button><span class="qty-num">${item.qty}</span><button class="qty-btn qty-plus">＋</button></div>`;
    d.querySelector('.qty-minus').addEventListener('click',()=>removeFromCart(item.id,ck));
    d.querySelector('.qty-plus').addEventListener('click',()=>addCartQty(item.id,ck));
    el.appendChild(d);
  });
}

//  PAYMENT
function voucherTotalYen(){
  return Object.values(S.voucherInput||{}).reduce((s,n)=>s+(n||0),0)*VOUCHER_FACE_VALUE;
}
function renderQuickCashBtns(cashNeeded){
  const qb=document.getElementById('quick-cash-btns');
  qb.innerHTML='';
  const amounts=[500,1000,2000,5000,10000].filter(a=>a>=cashNeeded);
  if(cashNeeded===0||!amounts.includes(cashNeeded))amounts.unshift(cashNeeded);
  amounts.slice(0,6).forEach(a=>{
    const btn=document.createElement('button');
    btn.className='qc-btn';
    btn.textContent=a===cashNeeded?`ちょうど ¥${a.toLocaleString()}`:`¥${a.toLocaleString()}`;
    btn.onclick=()=>{document.getElementById('cash-input').value=a;calcChange();};
    qb.appendChild(btn);
  });
}
function renderVoucherGroup(){
  const group=document.getElementById('voucher-group');
  const list=document.getElementById('voucher-color-list');
  if(!group) return;
  const colors=Object.entries(S.voucherColorsSnap||{}).sort((a,b)=>(a[1].order||0)-(b[1].order||0));
  if(colors.length===0){ group.style.display='none'; return; }
  group.style.display='block';
  list.style.display=S.voucherOpen?'grid':'none';
  list.style.gridTemplateColumns='repeat(auto-fill,minmax(150px,1fr))';
  list.style.gap='8px';
  const chev=document.getElementById('voucher-chev'); if(chev) chev.textContent=S.voucherOpen?'▲':'▼';
  list.innerHTML=colors.map(([id,c])=>{
    const n=S.voucherInput[id]||0;
    const max=Math.max(20,n);
    let opts='';
    for(let i=0;i<=max;i++) opts+=`<option value="${i}"${i===n?' selected':''}>${i}枚</option>`;
    return `<label style="display:flex;align-items:center;gap:7px;padding:4px 6px;border:1px solid #fbcfe8;border-radius:10px;">
      <span style="width:14px;height:14px;border-radius:50%;background:${esc(c.hex)};display:inline-block;border:1px solid rgba(0,0,0,.15);flex-shrink:0;"></span>
      <span style="flex:1;font-size:13px;font-weight:700;">${esc(c.label)}</span>
      <select onchange="setVoucherQty('${id}',this.value)" style="padding:4px 2px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-weight:700;background:#fff;">${opts}</select>
    </label>`;
  }).join('');
  updateVoucherTotals();
}
function toggleVoucherList(){S.voucherOpen=!S.voucherOpen;renderVoucherGroup();}
function setVoucherQty(id,v){
  S.voucherInput[id]=Math.max(0,parseInt(v)||0);
  renderVoucherGroup();
  calcChange();
}
function changeVoucherQty(id,delta){
  const n=(S.voucherInput[id]||0)+delta;
  S.voucherInput[id]=Math.max(0,n);
  renderVoucherGroup();
  calcChange();
}
function updateVoucherTotals(){
  const vt=voucherTotalYen();
  const lbl=document.getElementById('voucher-total-label');
  const cnt=voucherTotalYen()/VOUCHER_FACE_VALUE;
  if(lbl) lbl.textContent=cnt>0?`${cnt}枚 ¥${vt.toLocaleString()}`:'なし';
  const total=S.cart.reduce((s,i)=>s+(Number(i.price)||0)*i.qty,0);
  const warn=document.getElementById('voucher-warning');
  if(warn){
    warn.style.display = vt>total ? 'block':'none';
    const overEl=document.getElementById('voucher-over-amount');
    if(overEl) overEl.textContent=(vt-total).toLocaleString();
  }
  renderQuickCashBtns(Math.max(0,total-vt));
}
function showPaymentModal(){
  if(!S.cart.length) return;
  const total=S.cart.reduce((s,i)=>s+(Number(i.price)||0)*i.qty,0);
  document.getElementById('pay-items').innerHTML=S.cart.map(i=>{
    const ch=i.choices&&i.choices.length>0?' ('+i.choices.map(c=>`${esc(c.label||c.compLabel||'')}: ${esc(c.name||'')}`).join(', ')+')':'';
    return `<div class="pay-item-row"><span>${esc(i.name)}${ch} × ${i.qty}</span><span style="font-weight:700;">¥${(i.price*i.qty).toLocaleString()}</span></div>`;
  }).join('');
  document.getElementById('pay-total').textContent=`¥${total.toLocaleString()}`;
  S.voucherInput={};
  S.voucherOpen=false;
  renderVoucherGroup();
  renderQuickCashBtns(total);
  document.getElementById('cash-input').value='';
  document.getElementById('cash-input-label').textContent='お預かり金額';
  calcChange();
  // 整理券ボタン（全番号表示・使用中は薄く）
  const allTickets=Object.values(S.ticketsSnap).sort((a,b)=>a.num-b.num);
  const tg=document.getElementById('ticket-assign-group');
  const tqb=document.getElementById('ticket-quick-btns');
  const tni=document.getElementById('ticket-num-input');
  const noMsg=document.getElementById('ticket-no-tickets-msg');
  if(tg){
    tg.style.display='block';
    if(tni) tni.value='';
    const dispEl=document.getElementById('ticket-selected-display');
    if(dispEl) dispEl.textContent='';
    if(allTickets.length===0){
      if(tqb) tqb.innerHTML='';
      if(noMsg) noMsg.style.display='block';
    } else {
      if(noMsg) noMsg.style.display='none';
      if(tqb) tqb.innerHTML=allTickets.map(t=>{
        const isUsed=t.status!=='available';
        return `<button type="button" id="tqb-${t.num}"
          ${isUsed?'':'onclick="selectTicketNum('+t.num+')"'}
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;
            padding:8px 4px;border-radius:10px;border:2px solid;
            font-size:15px;font-weight:900;line-height:1.2;cursor:${isUsed?'default':'pointer'};
            min-height:54px;transition:all .15s;
            ${isUsed?'background:#f8fafc;border-color:#e2e8f0;color:#cbd5e1;':'background:#f0fdf4;border-color:#86efac;color:#166534;'}">
          <span>${t.num}</span>
          <span style="font-size:9px;font-weight:700;margin-top:2px;">${isUsed?'使用中':'空き'}</span>
        </button>`;
      }).join('');
    }
  }
  document.getElementById('payment-modal-overlay').classList.add('show');
  setTimeout(()=>document.getElementById('cash-input').focus(),100);
}
function closePaymentModal(){
  document.getElementById('payment-modal-overlay').classList.remove('show');
  const tni=document.getElementById('ticket-num-input');
  if(tni) tni.value='';
}
function selectTicketNum(num){
  const tni=document.getElementById('ticket-num-input');
  if(tni) tni.value=num;
  highlightTicketBtn();
}
function highlightTicketBtn(){
  const val=String(document.getElementById('ticket-num-input')?.value||'');
  const dispEl=document.getElementById('ticket-selected-display');
  if(dispEl) dispEl.textContent=val?`✅ No.${val} を選択中`:'';
  document.querySelectorAll('[id^="tqb-"]').forEach(b=>{
    const n=b.id.replace('tqb-','');
    const isSelected=n===val;
    const isUsed=b.style.cursor==='default';
    if(!isUsed){
      b.style.background=isSelected?'#16a34a':'#f0fdf4';
      b.style.color=isSelected?'white':'#166534';
      b.style.borderColor=isSelected?'#16a34a':'#86efac';
      b.style.transform=isSelected?'scale(1.08)':'scale(1)';
      b.style.boxShadow=isSelected?'0 4px 12px rgba(22,163,74,.35)':'none';
    }
  });
}
function clearTicketNum(){
  const tni=document.getElementById('ticket-num-input');
  if(tni) tni.value='';
  highlightTicketBtn();
}

function calcChange(){
  const total=S.cart.reduce((s,i)=>s+(Number(i.price)||0)*i.qty,0);
  const vt=voucherTotalYen();
  const cashNeeded=Math.max(0,total-vt);
  const cash=parseInt(document.getElementById('cash-input').value)||0;
  const diff=cash-cashNeeded;
  const cd=document.getElementById('change-display');
  const cb=document.getElementById('confirm-pay-btn');
  document.getElementById('cash-input-label').textContent = vt>0 ? `現金でのお預かり金額（残り ¥${cashNeeded.toLocaleString()}）` : 'お預かり金額';
  cd.style.display='block';
  const labelEl=cd.querySelector('.change-label');
  const amtEl=document.getElementById('change-amount');
  if(diff<0){
    cd.className='change-box short';
    if(labelEl) labelEl.textContent='不足';
    amtEl.textContent=`-¥${Math.abs(diff).toLocaleString()}`;
  } else {
    cd.className='change-box ok';
    if(labelEl) labelEl.textContent='お釣り';
    amtEl.textContent=`¥${diff.toLocaleString()}`;
  }
  cb.disabled = diff<0;
}

async function confirmPayment(){
  const total=S.cart.reduce((s,i)=>s+(Number(i.price)||0)*i.qty,0);
  const vt=voucherTotalYen();
  if(vt>total){
    const over=vt-total;
    const proceed=confirm(`バザー券が商品代金より ¥${over.toLocaleString()} 多いです。この分はお返しできません。\n\nお客様に確認しましたか？よろしければOKを押してください。`);
    if(!proceed) return;
  }
  {
    const tn=parseInt(document.getElementById('ticket-num-input')?.value);
    if(isNaN(tn)&&Object.keys(S.ticketsSnap||{}).length>0){
      if(!confirm('⚠️ 整理券が選択されていません。\n\n整理券なしで会計しますか？\n（順番管理ができなくなります。戻って整理券を選ぶ場合は「キャンセル」）')) return;
    }
  }
  const cashNeeded=Math.max(0,total-vt);
  const cash=parseInt(document.getElementById('cash-input').value)||0;
  const change=cash-cashNeeded;
  const vouchersUsed={};
  Object.entries(S.voucherInput||{}).forEach(([id,n])=>{ if(n>0) vouchersUsed[id]=n; });
  // 整理券番号取得
  const ticketNumRaw=parseInt(document.getElementById('ticket-num-input')?.value);
  const ticketNum=isNaN(ticketNumRaw)?null:ticketNumRaw;
  // order number within day
  const dayOrders=Object.values(S.ordersSnap).filter(o=>o.dayId===S.currentDay.id);
  const orderNum=dayOrders.length+1;
  const order={
    id:Date.now(),orderNum,dayId:S.currentDay.id,
    timestamp:new Date().toISOString(),
    items:S.cart.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,...(i.choices?{choices:i.choices}:{}),...(i.temp?{temp:i.temp}:{})})),
    total,payment:cash,change,status:'pending',
    ticketNum:ticketNum,
    vouchers:vouchersUsed,voucherTotal:vt,
  };
  // ドリンクは調理不要: 中身のチェックを最初から入れる。ドリンクだけの注文は調理を飛ばして受け渡しへ
  {
    const lines=orderLines(order).flatMap(g=>g.lines);
    const done={};
    lines.forEach(l=>{ if(l.drink) done[l.key]=true; });
    if(Object.keys(done).length>0) order.itemsDone=done;
    if(lines.length>0&&lines.every(l=>l.drink)){
      order.status='cooked';
      order.cookedAt=order.timestamp;
    }
  }
  showLoading(true);
  try{
    await db.ref(`${ROOT}/orders/${order.id}`).set(order);
    // 整理券を「使用中」に更新
    if(ticketNum!=null){
      const tk=Object.values(S.ticketsSnap).find(t=>t.num===ticketNum);
      if(tk) await db.ref(`${ROOT}/tickets/${tk.id}`).update({status:order.status==='cooked'?'called':'in_use',orderId:order.id});
    }
    for(const ci of S.cart){
      const mi=S.menu[ci.id];
      if(!mi) continue;
      if(mi.isSet&&mi.components){
        // セット: 固定構成品の在庫を減算、選択式は選ばれた商品の在庫を減算
        let cIdx=0;
        for(const comp of mi.components){
          if(comp.isChoice){
            const choice=(ci.choices||[])[cIdx++];
            if(choice&&!choice.none){
              const choiceItem=S.menu[choice.id]||S.menu[String(choice.id)];
              if(choiceItem&&choiceItem.stock>0){
                const q=choiceQty(comp,choice.id);
                await db.ref(`${ROOT}/menu/${choice.id}/currentStock`).transaction(cur=>{
                  if(cur===null)return cur;
                  return r2(Math.max(0,cur-q*ci.qty));
                });
              }
            }
          } else {
            const compItem=S.menu[comp.id];
            if(compItem&&compItem.stock>0){
              await db.ref(`${ROOT}/menu/${comp.id}/currentStock`).transaction(cur=>{
                if(cur===null)return cur;
                return r2(Math.max(0,cur-comp.qty*ci.qty));
              });
            }
          }
        }
      } else if(mi.stock>0){
        // 通常商品: 自身の在庫を減算
        await db.ref(`${ROOT}/menu/${ci.id}/currentStock`).transaction(cur=>{
          if(cur===null)return cur;
          return Math.max(0,cur-ci.qty);
        });
      }
    }
    const ch=change;
    clearCart();closePaymentModal();
    showToast(`お釣り ¥${ch.toLocaleString()} をお返しください`,'success');
  }catch(e){showToast('エラーが発生しました','error');}
  showLoading(false);
}

