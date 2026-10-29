// ===== レジのメニュー表示（セット/単品/ドリンク） =====
//  CATEGORY FILTER (Cashier)
function renderCategoryFilter(){
  // 食材はカテゴリフィルターに含めない
  const cats=[...new Set(Object.values(S.menu).filter(i=>!i.isMaterial).map(i=>i.category).filter(Boolean))];
  const el=document.getElementById('cat-filter');
  if(!el) return;
  const area=document.getElementById('cashier-menu-area');
  // カテゴリが1つも無いときは左のカテゴリ欄ごと隠してメニューを広く使う
  el.style.display=cats.length===0?'none':'';
  if(area) area.style.gridTemplateColumns=cats.length===0?'1fr':'';
  el.innerHTML=`<button class="cat-btn ${S.selCat==='all'?'active':''}" onclick="filterCat('all')" data-c="all">すべて</button>`;
  cats.forEach(c=>{el.innerHTML+=`<button class="cat-btn ${S.selCat===c?'active':''}" onclick="filterCat(this.dataset.c)" data-c="${esc(c)}">${esc(c)}</button>`;});
}
function filterCat(cat){
  S.selCat=cat;
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.c===cat));
  renderMenu();
}

//  MENU (Cashier)
function renderMenu(){
  const all=Object.values(S.menu).filter(i=>i.active!==false&&!i.isMaterial);
  const grid=document.getElementById('menu-grid');
  if(!grid) return;

  const mkBtn=(item)=>{
    let isOut=false,isLow=false,stockLabel='';
    if(item.isSet){
      const avail=getSetAvailability(item);
      if(avail!==null){isOut=avail<=0;isLow=avail>0&&avail<=3;stockLabel=isOut?'在庫切れ':`残り ${avail} ${isSetItem(item)?'セット':'個'}`;}
    }else{
      const hasStock=item.stock>0;
      const cur=hasStock?(item.currentStock!=null?item.currentStock:item.stock):null;
      if(hasStock){isOut=cur<=0;isLow=cur>0&&cur<=5;stockLabel=isOut?'在庫切れ':`残り ${cur} 個`;}
    }
    const btn=document.createElement('button');
    btn.className='menu-btn'+(isSetItem(item)?' is-set':'')+(isOut?' out-of-stock':isLow?' low-stock':'');
    btn.disabled=isOut;
    btn.onclick=()=>addToCart(item);
    btn.innerHTML=`<div class="mname">${esc(item.name)}</div><div class="mprice">¥${item.price.toLocaleString()}</div>${stockLabel?`<div class="mstock">${stockLabel}</div>`:''}`;
    return btn;
  };

  grid.innerHTML='';
  if(all.length===0){
    grid.innerHTML=`<div class="empty-state"><div class="icon">📋</div><p>メニューがありません<br>管理画面から追加してください</p></div>`;
    return;
  }
  // POSレジ風: セット／単品／ドリンクを段に分け、同じ大きさのタイルを並べる
  const base=S.selCat==='all'?all:all.filter(i=>(i.category||'')===S.selCat);
  if(base.length===0){grid.innerHTML=`<div class="empty-state"><div class="icon">📋</div><p>このカテゴリの商品はありません</p></div>`;return;}
  const sections=[
    ['セット','set',base.filter(i=>isSetItem(i))],
    ['単品','single',base.filter(i=>!isSetItem(i)&&!isDrinkItem(i)&&!isToppingItem(i))],
    ['ドリンク','drink',base.filter(i=>isDrinkItem(i))],
    ['トッピング','topping',base.filter(i=>isToppingItem(i))],
  ];
  sections.forEach(([label,cls,items])=>{
    if(items.length===0) return;
    const sec=document.createElement('div');
    sec.className='pos-sec '+cls;
    const lb=document.createElement('div');lb.className='pos-sec-label';lb.textContent=label;
    const tiles=document.createElement('div');tiles.className='pos-tiles';
    items.forEach(it=>{const b=mkBtn(it);b.classList.add('pos-tile');tiles.appendChild(b);});
    sec.appendChild(lb);sec.appendChild(tiles);grid.appendChild(sec);
  });
}

//  種別: 単品でも構成品（バンズ・パティ等）を持てる。isSet=構成品あり(在庫連動)、displayType==='single' なら見た目は単品
// 在庫は小数（0.5個など）も扱うので、計算誤差を丸める
function r2(n){return Math.round(n*100)/100;}
// 選択式の選択肢ごとの消費量（トッピングごとにg数が違う場合は qtys で個別指定）
function choiceQty(comp,id){
  const q=comp&&comp.qtys?comp.qtys[String(id)]:null;
  return (q!=null&&q!=='')?Number(q):((comp&&comp.qty)||1);
}
function isSetItem(i){return !!(i&&i.isSet)&&i.displayType!=='single';}
//  DRINK
const DRINK_NAME_RE=/ドリンク|飲み物|ジュース|茶|コーラ|ファンタ|サイダー|ソーダ|ラムネ|コーヒー|珈琲|カルピス|レモネード|ウォーター|スポーツ|オレンジ|グレープ|アップル|ミネラル|水$/;
// トッピング: レジのドリンクの下に別の段で並べる。管理画面のチェックが最優先、無ければカテゴリ名で判定
function isToppingItem(mi){
  if(!mi||isSetItem(mi)||mi.isMaterial) return false;
  if(mi.isTopping===true||mi.isTopping===false) return mi.isTopping;
  return /トッピング|topping/i.test(mi.category||'');
}
function isDrinkItem(mi){
  if(!mi||isSetItem(mi)) return false;
  if(mi.isDrink===true||mi.isDrink===false) return mi.isDrink;
  if(mi.isTopping===true) return false;       // 管理画面で明示した設定が最優先
  if(/ドリンク|飲み物|drink/i.test(mi.category||'')) return true;
  if(DRINK_NAME_RE.test(mi.name||'')) return true;
  // セットの「ドリンク」選択肢に入っている商品もドリンク扱い
  const id=String(mi.id);
  return Object.values(S.menu||{}).some(m=>m.isSet&&(m.components||[]).some(c=>c.isChoice&&/ドリンク|飲/.test(c.label||'')&&(c.choiceIds||[]).map(String).includes(id)));
}
const TEMP_OPTS=[['常温','room'],['冷蔵','cold']];
function tempLabel(t){return t||'';}
// 温度は色つきの小さなバッジで表示（常温=橙 / 冷蔵=青）
function tempBadge(t){return t?`<span class="temp-badge ${t==='冷蔵'?'cold':'room'}">${esc(t)}</span>`:'';}

