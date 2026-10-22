// ===== 調理画面・受け渡し画面 =====
//  KITCHEN（調理：未調理 → 調理完了）
function setKitchenFilter(f){
  S.kitchenFilter=f;
  document.getElementById('kf-pending').classList.toggle('active',f==='pending');
  document.getElementById('kf-all').classList.toggle('active',f==='all');
  renderKitchen();
}

function renderOrderTicketCard(order,opts){
  // opts: {isDone, elapsedFromTs, actionLabel, actionFn, doneLabel}
  const time=new Date(order.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  let urgencyClass='done',headerClass='ticket-header';
  let elapsedHtml='';
  if(!opts.isDone){
    const elapsedMs=Date.now()-opts.elapsedFromTs;
    const elapsedMin=Math.floor(elapsedMs/60000);
    const elapsedSec=Math.floor((elapsedMs%60000)/1000);
    const isUrgent=elapsedMin>=5&&elapsedMin<10;
    const isCritical=elapsedMin>=10;
    urgencyClass=isCritical?'new critical':isUrgent?'new urgent':'new';
    headerClass=isCritical?'ticket-header critical-header':isUrgent?'ticket-header urgent-header':'ticket-header';
    elapsedHtml=`<div class="ticket-elapsed">${isCritical?'🔴':isUrgent?'🟡':'🟢'} <span class="elapsed-display" data-ts="${opts.elapsedFromTs}">${elapsedMin}分${elapsedSec}秒</span></div>`;
  }
  const card=document.createElement('div');
  card.className='order-ticket '+urgencyClass+(opts.compact?' compact':'');
  card.dataset.orderId=order.id;
  card.innerHTML=`
    <div class="${headerClass}">
      <div>
        ${order.ticketNum!=null
          ?`<div class="ticket-big-no"><small>整理券</small>${order.ticketNum}</div>`
          :`<div class="ticket-big-no none"><small>整理券なし</small># ${order.orderNum||'?'}</div>`}
        ${elapsedHtml}
      </div>
      <div class="ticket-time">${time}${order.ticketNum!=null?`<div class="ticket-ordno">注文 #${order.orderNum||'?'}</div>`:''}</div>
    </div>
    <div class="ticket-items">
      ${orderLines(order).map(g=>{
        const ck=opts.checkKind&&!opts.isDone;
        const head=g.setName?`<div class="ticket-set-head">📦 ${esc(String(g.setName).replace(/[（(].*$/,''))} × ${g.setQty}</div>`:'';
        return head+g.lines.map(ln=>{
          const on=ck&&order[opts.checkKind]&&order[opts.checkKind][ln.key];
          const cooked=opts.showCooked&&order.itemsDone&&order.itemsDone[ln.key];
          return `
        <label class="ticket-item-row${ck?' chk':''}${on?' checked':''}${g.setName?' in-set':''}">
          ${ck?`<input type="checkbox" class="item-chk" ${on?'checked':''} onchange="toggleItemCheck('${order.id}','${opts.checkKind}','${ln.key}',this.checked)">`:''}
          <span class="ticket-item-name">${esc(ln.name)}${cooked?' <small class="cooked-tag">済</small>':''}${ln.sub?`<span class="ln-sub">${tempBadge(ln.sub)}</span>`:''}</span>
          <span class="ticket-item-qty">× ${ln.qty}</span>
        </label>`;
        }).join('')+(g.toppings&&g.toppings.length?`<div class="ln-top">＋ ${Object.entries(g.toppings.reduce((m,t)=>{m[t.name]=(m[t.name]||0)+t.qty;return m;},{})).map(([n,q])=>esc(n)+(q>1?' ×'+q:'')).join(' ／ ')}</div>`:'');
      }).join('')}
    </div>
    ${opts.noAction?'':`<div class="ticket-footer">
      ${opts.isDone
        ? `<div class="done-label">${opts.doneLabel}</div>`
        : `<button class="complete-btn" onclick="${opts.actionFn}(${JSON.stringify(order.id).replace(/"/g,'&quot;')})">${opts.actionLabel}</button>`
      }
    </div>`}
  `;
  return card;
}

// 調理・受け渡しの全カードを、一番高いカードに合わせて同じ高さにそろえる（スクロール無し）
function equalizeTickets(){
  const cards=[...document.querySelectorAll('#kitchen-grid .order-ticket,#handoff-grid .order-ticket,#handoff-cooking-grid .order-ticket')];
  if(!cards.length) return;
  cards.forEach(c=>{c.style.minHeight='';});
  let max=0;
  cards.forEach(c=>{
    if(!c.offsetParent) return;
    const h=[...c.children].reduce((a,el)=>a+el.offsetHeight,0)+4;
    if(h>max) max=h;
  });
  if(max>0) cards.forEach(c=>{c.style.minHeight=max+'px';});
}
window.addEventListener('resize',()=>{try{equalizeTickets();}catch(e){}});
function renderKitchen(){
  const grid=document.getElementById('kitchen-grid');
  if(!grid) return;
  if(!S.isDayOpen){grid.innerHTML='';renderDoneFeed('kitchen-done-feed',[],'timestamp');return;}

  const dayOrders=Object.values(S.ordersSnap)
    .filter(o=>o.dayId===S.currentDay.id)
    .sort((a,b)=>a.timestamp.localeCompare(b.timestamp));

  const pending=dayOrders.filter(o=>(o.status||'pending')==='pending');
  const cookedOrLater=dayOrders.filter(o=>o.status==='cooked'||o.status==='completed');

  document.getElementById('kitchen-title').textContent=
    `調理待ちの注文${pending.length>0?` (${pending.length}件)`:''}`;

  const statsEl=document.getElementById('kitchen-stats');
  if(statsEl){
    const urgentCount=pending.filter(o=>{const m=Math.floor((Date.now()-new Date(o.timestamp).getTime())/60000);return m>=5&&m<10;}).length;
    const critCount=pending.filter(o=>Math.floor((Date.now()-new Date(o.timestamp).getTime())/60000)>=10).length;
    statsEl.innerHTML=`
      <div class="k-stat">📋 待機 ${pending.length}</div>
      <div class="k-stat">🍳 調理完了 ${cookedOrLater.length}</div>
      ${urgentCount>0?`<div class="k-stat urgent">🟡 遅延 ${urgentCount}</div>`:''}
      ${critCount>0?`<div class="k-stat critical">🔴 超過 ${critCount}</div>`:''}
    `;
  }

  renderDoneFeed('kitchen-done-feed',cookedOrLater,'cookedAt','まだ調理完了した注文はありません','調理完了');

  if(pending.length===0){
    grid.innerHTML=`<div class="kitchen-empty"><div class="icon">✅</div><p>調理待ちの注文はありません！</p></div>`;
    return;
  }

  grid.innerHTML='';
  pending.forEach(order=>{
    const card=renderOrderTicketCard(order,{
      isDone:false,
      elapsedFromTs:new Date(order.timestamp).getTime(),
      compact:true,
      actionLabel:'✓ 調理完了',
      actionFn:'completeCooking',
      checkKind:'itemsDone'
    });
    grid.appendChild(card);
  });
  equalizeTickets();
  startElapsedTimer();
}

const DONE_FEED_MAX=10;

function renderDoneFeed(feedId,doneOrders,tsField,emptyText,doneWord){
  emptyText=emptyText||'まだ完了した注文はありません';
  doneWord=doneWord||'完了';
  const feed=document.getElementById(feedId);
  if(!feed) return;

  const sorted=[...doneOrders]
    .sort((a,b)=>(b[tsField]||b.timestamp).localeCompare(a[tsField]||a.timestamp))
    .slice(0,DONE_FEED_MAX);

  if(sorted.length===0){
    feed.innerHTML=`<div class="done-feed-empty">${emptyText}</div>`;
    return;
  }

  const existingIds=new Set([...feed.querySelectorAll('.done-feed-item')].map(el=>el.dataset.id));
  const newIds=new Set(sorted.map(o=>String(o.id)));

  feed.querySelectorAll('.done-feed-item').forEach(el=>{
    if(!newIds.has(el.dataset.id)){
      el.classList.add('removing');
      setTimeout(()=>el.remove(),400);
    }
  });

  sorted.forEach(order=>{
    if(!existingIds.has(String(order.id))){
      const time=new Date(order[tsField]||order.timestamp)
        .toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
      const itemsText=(order.items||[]).map(i=>`${i.name}×${i.qty}`).join('・');
      const el=document.createElement('div');
      el.className='done-feed-item';
      el.dataset.id=String(order.id);
      el.innerHTML=`
        <div class="done-feed-num">${order.ticketNum!=null?'🎫'+order.ticketNum:'#'+(order.orderNum||'?')}</div>
        <div class="done-feed-items">${esc(itemsText)}</div>
        <div class="done-feed-time">${doneWord} ${time}</div>
      `;
      if(feed.firstChild&&!feed.firstChild.classList?.contains('done-feed-empty')){
        feed.insertBefore(el,feed.firstChild);
      } else {
        feed.innerHTML='';
        feed.appendChild(el);
      }
    }
  });
}

let _kitchenTimer=null;
function startElapsedTimer(){
  if(_kitchenTimer) return;
  _kitchenTimer=setInterval(()=>{
    document.querySelectorAll('.elapsed-display').forEach(el=>{
      const ts=parseInt(el.dataset.ts);
      const elapsed=Date.now()-ts;
      const min=Math.floor(elapsed/60000);
      const sec=Math.floor((elapsed%60000)/1000);
      el.textContent=`${min}分${sec}秒`;
      const ticket=el.closest('.order-ticket');
      if(!ticket)return;
      const header=ticket.querySelector('[class*="ticket-header"]');
      // compact など他のクラスを消さないよう、classListで状態クラスだけ切り替える
      if(min>=10){
        ticket.classList.remove('urgent');ticket.classList.add('new','critical');
        if(header){header.classList.remove('urgent-header');header.classList.add('critical-header');}
        el.previousElementSibling.textContent='🔴';
      } else if(min>=5){
        ticket.classList.remove('critical');ticket.classList.add('new','urgent');
        if(header){header.classList.remove('critical-header');header.classList.add('urgent-header');}
        el.previousElementSibling.textContent='🟡';
      }
    });
    if(document.querySelectorAll('.elapsed-display').length===0){
      clearInterval(_kitchenTimer);_kitchenTimer=null;
    }
  },1000);
}

// 注文の中身を「チェックできる最小単位（セットなら中身ごと）」に展開する
function orderLines(order){
  const groups=[];
  let lastMain=-1;            // 直前の「トッピング以外・ドリンク以外」のグループ
  const earlyToppings=[];     // 先にトッピングが来た場合の待機
  (order.items||[]).forEach((it,i)=>{
    const mi=S.menu[it.id]||S.menu[String(it.id)];
    const comps=mi&&isSetItem(mi)&&Array.isArray(mi.components)?mi.components:null;
    // トッピングは追加のものなので、単品/セットの下に小さく付ける（チェック対象にしない）
    if(isToppingItem(mi)&&!it.temp){
      const tp={name:it.name,qty:it.qty,key:`${i}`};
      if(lastMain>=0) (groups[lastMain].toppings=groups[lastMain].toppings||[]).push(tp);
      else earlyToppings.push(tp);
      return;
    }
    if(!comps||comps.length===0){
      const dr=isDrinkItem(mi);
      const tops=(it.choices||[]).filter(c=>!c.none).map(c=>({name:c.name,qty:it.qty,key:`${i}_t`}));
      groups.push({setName:null,lines:[{key:`${i}`,name:it.name,qty:it.qty,sub:it.temp?tempLabel(it.temp):'',drink:dr}],...(tops.length?{toppings:tops}:{})});
      if(!dr) lastMain=groups.length-1;
      return;
    }
    const lines=[];
    let myTops=null, choiceIdx=0, matQty=0, matNames=[], matAt=-1;
    comps.forEach((c,ci)=>{
      if(c.isChoice){
        const ch=(it.choices||[])[choiceIdx++];
        if(ch&&ch.none) return;
        const cref=ch?(S.menu[ch.id]||S.menu[String(ch.id)]):null;
        if(ch&&cref&&!isDrinkItem(cref)&&(isToppingItem(cref)||c.extra>0||/トッピング/.test(c.label||''))){ (myTops=myTops||[]).push({name:ch.name,qty:it.qty,key:`${i}_${ci}`}); return; }
        lines.push({key:`${i}_${ci}`,name:ch?ch.name||ch.label||'':(c.label||'選択'),qty:(c.qty||1)*it.qty,sub:ch&&ch.temp?tempLabel(ch.temp):'',drink:isDrinkItem(cref)});
      } else {
        const ref=S.menu[c.id]||S.menu[String(c.id)];
        if(ref&&ref.isMaterial&&!isDrinkItem(ref)){
          // 食材（じゃがいも・バターなど）は分けず、まとめて1行にする
          if(matAt<0){matAt=lines.length;lines.push(null);}
          matQty=Math.max(matQty,(c.qty||1)*it.qty);
          matNames.push(ref.name);
        } else {
          lines.push({key:`${i}_${ci}`,name:ref?ref.name:'(削除済み)',qty:(c.qty||1)*it.qty,drink:isDrinkItem(ref)});
        }
      }
    });
    if(matAt>=0){
      // 名前はセット名のかっこ内（例: Cセット(じゃがバター×2,ドリンク×1)）から、選択式の項目以外を採用
      const choiceLabels=comps.filter(c=>c.isChoice).map(c=>c.label||'');
      const m=String(it.name).match(/[（(]([^）)]*)[）)]/);
      let nm='';
      if(m){
        const seg=m[1].split(/[,、，]/).map(x=>x.replace(/[×xX＊*]\s*\d+\s*$/,'').trim()).filter(Boolean)
          .filter(x=>!choiceLabels.includes(x));
        if(seg.length===1) nm=seg[0];
      }
      lines[matAt]={key:`${i}_m`,name:nm||matNames.join('・'),qty:matQty};
    }
    // 同じセットの中でもドリンクは一番下に
    const ordered=[...lines.filter(l=>!l.drink),...lines.filter(l=>l.drink)];
    groups.push({setName:it.name,setQty:it.qty,lines:ordered,...(myTops?{toppings:myTops}:{})});
    lastMain=groups.length-1;
  });
  // 先に入力されたトッピングは、最初の単品/セットに付ける。付け先が無ければ単独の行にする
  if(earlyToppings.length){
    const firstMain=groups.findIndex(g=>g.setName||!g.lines[0].drink);
    if(firstMain>=0) groups[firstMain].toppings=[...earlyToppings,...(groups[firstMain].toppings||[])];
    else earlyToppings.forEach(t=>groups.unshift({setName:null,lines:[{key:t.key,name:t.name,qty:t.qty,drink:false}]}));
  }
  // ドリンクだけの行は、セット・単品より下（カードの一番下）に並べる
  const isDrinkGroup=g=>!g.setName&&g.lines.length===1&&g.lines[0].drink;
  return [...groups.filter(g=>!isDrinkGroup(g)),...groups.filter(isDrinkGroup)];
}
function allLinesChecked(order,kind){
  const keys=orderLines(order).flatMap(g=>g.lines.map(l=>l.key));
  const chk=order[kind]||{};
  return keys.length>0&&keys.every(k=>chk[k]);
}
async function toggleItemCheck(orderId,kind,idx,on){
  if(kind!=='itemsDone'&&kind!=='itemsHanded') return;
  const order=S.ordersSnap[orderId];
  if(!order) return;
  await db.ref(`${ROOT}/orders/${orderId}/${kind}/${idx}`).set(on?true:null);
  const checks={...(order[kind]||{})};
  if(on) checks[idx]=true; else delete checks[idx];
  const all=allLinesChecked({...order,[kind]:checks},kind);
  if(!all) return;
  const st=order.status||'pending';
  if(kind==='itemsDone'&&st==='pending'){
    await completeCooking(orderId);
  } else if(kind==='itemsHanded'&&st==='cooked'){
    await completeHandoff(orderId);
  }
}
async function completeCooking(orderId){
  const order=S.ordersSnap[orderId];
  await db.ref(`${ROOT}/orders/${orderId}/status`).set('cooked');
  await db.ref(`${ROOT}/orders/${orderId}/cookedAt`).set(new Date().toISOString());
  // 整理券があれば「呼び出し中」にする（受け渡し待ちの合図）
  if(order?.ticketNum!=null){
    const tk=Object.values(S.ticketsSnap).find(t=>t.num===order.ticketNum);
    if(tk) await db.ref(`${ROOT}/tickets/${tk.id}`).update({status:'called'});
  }
  showToast('調理完了にしました 🍳','success');
  // すでに全品お渡し済み（ドリンクなど先渡し）なら、そのまま受け渡し完了へ
  const fresh=S.ordersSnap[orderId]||order;
  if(fresh&&allLinesChecked(fresh,'itemsHanded')) await completeHandoff(orderId);
}

//  KITCHEN: 整理券パネル表示（調理待ち = in_use のみ）
function renderKitchenTickets(){
  const panel=document.getElementById('kitchen-ticket-panel');
  if(!panel) return;
  const tickets=Object.values(S.ticketsSnap)
    .filter(t=>t.status==='in_use')
    .sort((a,b)=>a.num-b.num);
  if(tickets.length===0){
    panel.innerHTML=`<div class="kt-empty">調理待ちの整理券はありません</div>`;
    return;
  }
  panel.innerHTML=tickets.map(t=>{
    const order=t.orderId?S.ordersSnap[t.orderId]:null;
    const orderLabel=order?`注文 #${order.orderNum}`:'' ;
    return `<div class="kt-item">
      <div class="kt-num">No.${t.num}</div>
      <div style="flex:1;min-width:0;">
        <div class="kt-status in_use">🍳 調理中</div>
        ${orderLabel?`<div style="font-size:11px;color:var(--gray);margin-top:2px;">${orderLabel}</div>`:''}
      </div>
      <div class="kt-badge in_use">🍳</div>
    </div>`;
  }).join('');
}

//  HANDOFF（受け渡し：調理完了 → 受け渡し完了）
function renderHandoff(){
  const grid=document.getElementById('handoff-grid');
  const cgrid=document.getElementById('handoff-cooking-grid');
  if(!grid||!cgrid) return;
  if(!S.isDayOpen){grid.innerHTML='';cgrid.innerHTML='';renderDoneFeed('handoff-done-feed',[],'completedAt','まだ受け渡し完了した注文はありません','受け渡し完了');return;}

  const dayOrders=Object.values(S.ordersSnap)
    .filter(o=>o.dayId===S.currentDay.id)
    .sort((a,b)=>(a.cookedAt||a.timestamp).localeCompare(b.cookedAt||b.timestamp));

  const cooking=dayOrders.filter(o=>(o.status||'pending')==='pending').sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const waiting=dayOrders.filter(o=>o.status==='cooked');
  const handedOff=dayOrders.filter(o=>o.status==='completed');

  document.getElementById('handoff-title').textContent='注文の状況';
  document.getElementById('handoff-cooking-count').textContent=cooking.length>0?`(${cooking.length}件)`:'';
  document.getElementById('handoff-ready-count').textContent=waiting.length>0?`(${waiting.length}件)`:'';

  const statsEl=document.getElementById('handoff-stats');
  if(statsEl){
    statsEl.innerHTML=`
      <div class="k-stat">🍳 調理中 ${cooking.length}</div>
      <div class="k-stat">🛎️ お渡し待ち ${waiting.length}</div>
      <div class="k-stat">✅ 受け渡し完了 ${handedOff.length}</div>
    `;
  }

  renderDoneFeed('handoff-done-feed',handedOff,'completedAt','まだ受け渡し完了した注文はありません','受け渡し完了');

  cgrid.innerHTML='';
  if(cooking.length===0){
    cgrid.innerHTML=`<div class="kitchen-empty"><div class="icon">🍳</div><p>調理中の注文はありません</p></div>`;
  } else cooking.forEach(order=>{
    cgrid.appendChild(renderOrderTicketCard(order,{
      isDone:false,compact:true,noAction:true,showCooked:true,
      elapsedFromTs:new Date(order.timestamp).getTime()
    }));
  });

  grid.innerHTML='';
  if(waiting.length===0){
    grid.innerHTML=`<div class="kitchen-empty"><div class="icon">🛎️</div><p>お渡し待ちの注文はありません</p></div>`;
  } else waiting.forEach(order=>{
    grid.appendChild(renderOrderTicketCard(order,{
      isDone:false,compact:true,checkKind:'itemsHanded',
      elapsedFromTs:new Date(order.cookedAt||order.timestamp).getTime(),
      actionLabel:'✓ 受け渡し完了',
      actionFn:'completeHandoff'
    }));
  });
  equalizeTickets();
  startElapsedTimer();
}

async function completeHandoff(orderId){
  const order=S.ordersSnap[orderId];
  await db.ref(`${ROOT}/orders/${orderId}/status`).set('completed');
  await db.ref(`${ROOT}/orders/${orderId}/completedAt`).set(new Date().toISOString());
  // 整理券があれば「空き」に戻す（次のお客さんが使えるよう再利用）
  if(order?.ticketNum!=null){
    const tk=Object.values(S.ticketsSnap).find(t=>t.num===order.ticketNum);
    if(tk) await db.ref(`${ROOT}/tickets/${tk.id}`).update({status:'available',orderId:null});
  }
  showToast('受け渡し完了にしました ✅','success');
}

//  HANDOFF: 呼び出し中の整理券パネル
function renderHandoffTickets(){
  const panel=document.getElementById('handoff-ticket-panel');
  if(!panel) return;
  const tickets=Object.values(S.ticketsSnap)
    .filter(t=>t.status==='called')
    .sort((a,b)=>a.num-b.num);
  if(tickets.length===0){
    panel.innerHTML=`<div class="kt-empty">呼び出し中の整理券はありません</div>`;
    return;
  }
  panel.innerHTML=tickets.map(t=>{
    const order=t.orderId?S.ordersSnap[t.orderId]:null;
    const orderLabel=order?`注文 #${order.orderNum}`:'' ;
    return `<div class="kt-item">
      <div class="kt-num">No.${t.num}</div>
      <div style="flex:1;min-width:0;">
        <div class="kt-status called">📢 呼び出し中</div>
        ${orderLabel?`<div style="font-size:11px;color:var(--gray);margin-top:2px;">${orderLabel}</div>`:''}
      </div>
      <div class="kt-badge called">📢</div>
    </div>`;
  }).join('');
}


