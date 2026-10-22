// ===== エクスポート・共通ユーティリティ =====
//  EXPORT
async function fetchAllData(){
  const[menu,orders,days,settings]=await Promise.all([
    db.ref(`${ROOT}/menu`).once('value').then(s=>s.val()||{}),
    db.ref(`${ROOT}/orders`).once('value').then(s=>s.val()||{}),
    db.ref(`${ROOT}/days`).once('value').then(s=>s.val()||{}),
    db.ref(`${ROOT}/settings`).once('value').then(s=>s.val()||{}),
  ]);
  return {menu,orders,days,settings};
}
async function exportData(){
  showLoading(true);
  try{
    const d=await fetchAllData();
    const blob=new Blob([JSON.stringify({...d,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`festival_${new Date().toISOString().slice(0,10)}.json`;
    a.click();URL.revokeObjectURL(url);
    showToast('JSONをエクスポートしました 📤');
  }catch(e){showToast('エクスポートに失敗しました','error');}
  showLoading(false);
}
async function exportExcel(){
  showLoading(true);
  try{
    const {menu,orders,days}=await fetchAllData();
    const allOrders=Object.values(orders).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
    const allDays=[...Object.values(days)].sort((a,b)=>a.dayNumber-b.dayNumber);
    const wb=XLSX.utils.book_new();
    const dateStr=new Date().toISOString().slice(0,10);

    const summaryRows=[['Day','日付','オープン時刻','クローズ時刻','取引件数','売上合計（円）']];
    allDays.forEach(d=>{
      summaryRows.push([`Day ${d.dayNumber}`,new Date(d.date).toLocaleDateString('ja-JP'),
        d.openTime?new Date(d.openTime).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'',
        d.closeTime?new Date(d.closeTime).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'',
        d.totalOrders||0,d.totalSales||0]);
    });
    if(S.isDayOpen&&S.currentDay){
      const to=allOrders.filter(o=>o.dayId===S.currentDay.id);
      summaryRows.push([`Day ${S.currentDay.dayNumber}（営業中）`,new Date(S.currentDay.date).toLocaleDateString('ja-JP'),
        S.currentDay.openTime?new Date(S.currentDay.openTime).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'','（営業中）',to.length,to.reduce((s,o)=>s+o.total,0)]);
    }
    const wsSum=XLSX.utils.aoa_to_sheet(summaryRows);
    wsSum['!cols']=[{wch:18},{wch:14},{wch:12},{wch:12},{wch:10},{wch:14}];
    XLSX.utils.book_append_sheet(wb,wsSum,'日別売上サマリー');

    const txRows=[['注文番号','日付','時刻','Day','商品（数量）','合計（円）','お預かり','お釣り','調理状態']];
    allOrders.forEach(o=>{
      const dt=new Date(o.timestamp);
      const dayNum=allDays.find(d=>d.id===o.dayId)?.dayNumber||(S.currentDay?.id===o.dayId?S.currentDay.dayNumber:'');
      txRows.push([`#${o.orderNum||'-'}`,dt.toLocaleDateString('ja-JP'),
        dt.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
        dayNum?`Day ${dayNum}`:'',
        (o.items||[]).map(i=>`${i.name}×${i.qty}`).join(' / '),
        o.total||0,o.payment||0,o.change||0,(o.status==='completed'?'受渡済':o.status==='cooked'?'お渡し待ち':'調理待ち')]);
    });
    const wsTx=XLSX.utils.aoa_to_sheet(txRows);
    wsTx['!cols']=[{wch:10},{wch:14},{wch:12},{wch:10},{wch:40},{wch:12},{wch:12},{wch:10},{wch:8}];
    XLSX.utils.book_append_sheet(wb,wsTx,'取引履歴');

    const itemMap={};
    allOrders.forEach(o=>(o.items||[]).forEach(i=>{
      if(!itemMap[i.name])itemMap[i.name]={qty:0,revenue:0,orders:0};
      itemMap[i.name].qty+=i.qty;itemMap[i.name].revenue+=i.price*i.qty;itemMap[i.name].orders++;
    }));
    const itemRows=[['商品名','販売数（個）','売上金額（円）','注文回数']];
    Object.entries(itemMap).sort((a,b)=>b[1].revenue-a[1].revenue).forEach(([name,d])=>{itemRows.push([name,d.qty,d.revenue,d.orders]);});
    const wsItem=XLSX.utils.aoa_to_sheet(itemRows);
    wsItem['!cols']=[{wch:24},{wch:12},{wch:14},{wch:10}];
    XLSX.utils.book_append_sheet(wb,wsItem,'商品別売上');

    const menuItems=Object.values(menu);
    const menuRows=[['商品名','価格（円）','カテゴリー','在庫管理','現在の在庫','公開状態']];
    menuItems.forEach(m=>{menuRows.push([m.name,m.price,m.category||'',m.stock>0?'あり':'なし',m.stock>0?(m.currentStock!=null?m.currentStock:m.stock):'無制限',m.active!==false?'公開中':'非公開']);});
    const wsMenu=XLSX.utils.aoa_to_sheet(menuRows);
    wsMenu['!cols']=[{wch:24},{wch:10},{wch:16},{wch:10},{wch:12},{wch:10}];
    XLSX.utils.book_append_sheet(wb,wsMenu,'メニュー一覧');

    XLSX.writeFile(wb,`festival_売上_${dateStr}.xlsx`);
    showToast('Excelをエクスポートしました 📊','success');
  }catch(e){console.error(e);showToast('エクスポートに失敗しました','error');}
  showLoading(false);
}
async function exportCsv(){
  showLoading(true);
  try{
    const {orders}=await fetchAllData();
    const allOrders=Object.values(orders).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
    const rows=[['注文番号','日付','時刻','商品','合計（円）','お預かり','お釣り','調理状態']];
    allOrders.forEach(o=>{
      const dt=new Date(o.timestamp);
      rows.push([`#${o.orderNum||'-'}`,dt.toLocaleDateString('ja-JP'),
        dt.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
        (o.items||[]).map(i=>`${i.name}×${i.qty}`).join(' / '),o.total||0,o.payment||0,o.change||0,(o.status==='completed'?'受渡済':o.status==='cooked'?'お渡し待ち':'調理待ち')]);
    });
    const csv='﻿'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`festival_取引履歴_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();URL.revokeObjectURL(url);
    showToast('CSVをエクスポートしました 📄','success');
  }catch(e){showToast('エクスポートに失敗しました','error');}
  showLoading(false);
}
async function confirmResetSalesOnly(){
  if(!confirm('⚠️ 営業実績（注文・営業日の記録）だけを消去しますか？\n\nメニュー・在庫設定・店舗設定・整理券番号・バザー券の色・シフト・メンバーはそのまま残ります。'))return;
  if(!confirm('本当に削除しますか？この操作は取り消せません。'))return;
  showLoading(true);
  try{
    await db.ref(`${ROOT}/orders`).remove();
    await db.ref(`${ROOT}/days`).remove();
    await db.ref(`${ROOT}/currentDay`).remove();
    // 整理券は番号ごと消さず、使用状況だけ「空き」に戻す
    for(const [id,t] of Object.entries(S.ticketsSnap||{})){
      if(t.status!=='available'){
        await db.ref(`${ROOT}/tickets/${id}`).update({status:'available',orderId:null});
      }
    }
    S.cart=[];
    showToast('営業実績を消去しました（メニューなどはそのまま残っています）','success');
  }catch(e){console.error(e);showToast('エラーが発生しました','error');}
  showLoading(false);
}
async function confirmReset(){
  if(!confirm('⚠️ すべてのデータ（メニュー・在庫・設定・シフトも含めて）をリセットしますか？'))return;
  if(!confirm('本当に削除しますか？この操作は取り消せません。'))return;
  showLoading(true);
  if(ROOT===REAL_ROOT){
    for(const k of ['menu','orders','days','currentDay','settings','tickets','voucherColors','shifts','members','gradeColors']) await db.ref(`${ROOT}/${k}`).remove();
  } else await db.ref(ROOT).remove();
  S.cart=[];
  showLoading(false);
  showToast('データをリセットしました');
}
//  UTILS
function showLoading(show){document.getElementById('loading').className='loading-overlay'+(show?' show':'');}
let _tt;
function showToast(msg,type=''){
  const el=document.getElementById('toast');
  el.textContent=msg;el.className=`show ${type}`;
  clearTimeout(_tt);_tt=setTimeout(()=>{el.className='';},3200);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape') document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('show'));
  if(e.key==='Enter'&&document.getElementById('pin-modal-overlay').classList.contains('show')) pinConfirm();
});

