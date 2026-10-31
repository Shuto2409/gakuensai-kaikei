// ===== ダッシュボード（誰でも見られる簡易集計）。PIN不要 =====
function enterDash(){
  S.currentRole='dash';
  saveScreen('dash');
  showScreen('dash');
}
// 表示する日の選択: 'cur'=営業中の日 / 日のid / 'all'=全期間
function dashOptions(){
  const days=Object.values(S.daysSnap||{}).sort((x,y)=>y.dayNumber-x.dayNumber);
  const opts=[];
  if(S.isDayOpen&&S.currentDay) opts.push(['cur',`Day ${S.currentDay.dayNumber}（本日）`]);
  days.forEach(d=>{ if(!(S.isDayOpen&&S.currentDay&&String(d.id)===String(S.currentDay.id))) opts.push([String(d.id),`Day ${d.dayNumber}`]); });
  opts.push(['all','全期間']);
  return opts;
}
function setDashDay(v){ S.dashSel=v; renderDashboard(); }
function dashOrders(){
  const sel=S.dashSel||'cur';
  const all=Object.values(S.ordersSnap||{}).filter(o=>o.status!=='cancelled');
  if(sel==='all') return all;
  if(sel==='cur'||(S.isDayOpen&&S.currentDay&&String(S.currentDay.id)===String(sel))){
    return (S.isDayOpen&&S.currentDay)?all.filter(o=>String(o.dayId)===String(S.currentDay.id)):[];
  }
  return all.filter(o=>String(o.dayId)===String(sel));
}
function renderDashboard(){
  const box=document.getElementById('dash-content');
  if(!box) return;
  const opts=dashOptions();
  // 営業中でなければ、最新の営業日を自動で選ぶ
  if(!S.dashSel||!opts.some(o=>o[0]===S.dashSel)) S.dashSel=opts[0][0]==='all'?'all':opts[0][0];
  const isLive=S.dashSel==='cur';
  const sel=`<div class="dash-days">${opts.map(([v,l])=>`<button class="dash-day-btn ${S.dashSel===v?'active':''}" onclick="setDashDay(this.dataset.v)" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  const orders=dashOrders();

  const total=orders.reduce((s,o)=>s+(o.total||0),0);
  const cnt=k=>orders.filter(o=>(o.status||'pending')===k).length;
  const avg=orders.length?Math.round(total/orders.length):0;
  const sc=(v,l)=>`<div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`;
  let h=sel+`<div class="dash-stats">${sc('¥'+total.toLocaleString(),(isLive?'本日の売上':'売上'))}${sc(orders.length,'注文数')}${sc('¥'+avg.toLocaleString(),'客単価')}</div>
  <div class="dash-stats">${sc(cnt('pending'),'調理待ち')}${sc(cnt('cooked'),'お渡し待ち')}${sc(cnt('completed'),'受渡済')}</div>`;

  // 時間帯別
  const hours={};
  orders.forEach(o=>{
    const t=new Date(o.timestamp); if(isNaN(t)) return;
    const hr=t.getHours(); (hours[hr]=hours[hr]||{sales:0,n:0}); hours[hr].sales+=o.total||0; hours[hr].n++;
  });
  const hk=Object.keys(hours).map(Number).sort((a,b)=>a-b);
  const maxS=Math.max(1,...hk.map(k=>hours[k].sales));
  h+=`<div class="card"><div class="sec-hdr"><h3>🕐 時間帯別の売上</h3></div>`;
  if(!hk.length) h+='<div class="done-feed-empty">まだ注文がありません</div>';
  else{
    const lo=hk[0],hi=hk[hk.length-1];
    for(let k=lo;k<=hi;k++){
      const d=hours[k]||{sales:0,n:0};
      h+=`<div class="dash-bar-row"><div class="dash-bar-label">${k}時台</div><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round(d.sales/maxS*100)}%"></div></div><div class="dash-bar-val">¥${d.sales.toLocaleString()}<small> ${d.n}件</small></div></div>`;
    }
  }
  h+='</div>';

  // 商品別（出数）
  const map=buildItemMap(orders);
  const tops={};
  orders.forEach(o=>(o.items||[]).forEach(it=>(it.choices||[]).forEach(c=>{
    if(c.none) return;
    const m=S.menu[c.id]||S.menu[String(c.id)];
    if(m&&isToppingItem(m)||c.extra>0||/トッピング/.test(c.label||'')) tops[c.name]=(tops[c.name]||0)+it.qty;
  })));
  const ent=Object.entries(map).sort((a,b)=>b[1].qty-a[1].qty);
  const maxQ=Math.max(1,...ent.map(([,d])=>d.qty));
  h+=`<div class="card"><div class="sec-hdr"><h3>🍟 商品別の出数</h3></div>`;
  if(!ent.length) h+='<div class="done-feed-empty">まだ注文がありません</div>';
  ent.forEach(([n,d])=>{
    h+=`<div class="dash-bar-row"><div class="dash-bar-label wide">${esc(n)}</div><div class="dash-bar-track"><div class="dash-bar-fill alt" style="width:${Math.round(d.qty/maxQ*100)}%"></div></div><div class="dash-bar-val">${d.qty}個<small> ¥${d.revenue.toLocaleString()}</small></div></div>`;
  });
  h+='</div>';
  const te=Object.entries(tops).sort((a,b)=>b[1]-a[1]);
  const tTotal=te.reduce((x,[,q])=>x+q,0);
  const withTop=orders.reduce((n,o)=>n+((o.items||[]).some(it=>(it.choices||[]).some(c=>!c.none&&(c.extra>0||/トッピング/.test(c.label||''))))?1:0),0);
  h+=`<div class="card"><div class="sec-hdr"><h3>🧂 トッピングの配分</h3></div>`;
  if(!te.length) h+='<div class="done-feed-empty">トッピングの注文はまだありません</div>';
  else{
    const mx=Math.max(1,...te.map(([,q])=>q));
    te.forEach(([n,q])=>{
      h+=`<div class="dash-bar-row"><div class="dash-bar-label wide">${esc(n)}</div><div class="dash-bar-track"><div class="dash-bar-fill top" style="width:${Math.round(q/mx*100)}%"></div></div><div class="dash-bar-val">${q}回<small> ${Math.round(q/tTotal*100)}%</small></div></div>`;
    });
    h+=`<div class="dash-tops">トッピング合計 ${tTotal}回 ／ トッピング付きの注文 ${withTop}件（全${orders.length}件中 ${orders.length?Math.round(withTop/orders.length*100):0}%）</div>`;
  }
  h+='</div>';

  // 最近の注文（取消はPIN不要）
  const recent=[...orders].sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,15);
  h+=`<div class="card"><div class="sec-hdr"><h3>🧾 最近の注文</h3></div>`;
  if(!recent.length) h+='<div class="done-feed-empty">まだ注文がありません</div>';
  recent.forEach(o=>{
    const time=new Date(o.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
    const st=o.status==='completed'?'✅受渡済':o.status==='cooked'?'🛎️お渡し待ち':'🍳調理待ち';
    h+=`<div class="hist-row"><div class="hist-main"><div class="hist-top"><b>${o.ticketNum!=null?'整理券 '+o.ticketNum:'整理券なし'}</b> <span class="hist-sub">注文#${o.orderNum||'-'} ・ ${time} ・ ${st}</span></div><div class="hist-items">${esc(orderSummaryText(o))}</div><div class="hist-total">¥${(o.total||0).toLocaleString()}</div></div>${isLive?`<button class="btn btn-danger" style="padding:6px 12px;font-size:12px;flex-shrink:0;" onclick="cancelOrder('${o.id}')">取消</button>`:''}</div>`;
  });
  h+='</div>';
  box.innerHTML=h;
}
