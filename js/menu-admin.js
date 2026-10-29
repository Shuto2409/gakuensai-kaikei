// ===== POS管理: メニュー登録・編集 =====
//  MENU MANAGEMENT
function showMenuAddModal(){
  S.editingMenuId=null;
  document.getElementById('e-is-drink').checked=false;
  document.getElementById('e-is-topping').checked=false;
  document.getElementById('menu-edit-title').textContent='📋 商品を追加';
  ['e-name','e-price','e-cat'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('e-stock').value='0';
  document.getElementById('e-components-list').innerHTML='';
  document.querySelectorAll('input[name="e-item-mode"]').forEach(r=>r.checked=r.value==='normal');
  updateMenuMode();
  document.getElementById('menu-edit-modal-overlay').classList.add('show');
}
function showMenuEditModal(id){
  const item=S.menu[id];if(!item)return;
  S.editingMenuId=id;
  document.getElementById('menu-edit-title').textContent='✏️ 商品を編集';
  document.getElementById('e-name').value=item.name;
  document.getElementById('e-price').value=item.price||0;
  document.getElementById('e-cat').value=item.category||'';
  document.getElementById('e-stock').value=item.stock||0;
  document.getElementById('e-is-drink').checked=isDrinkItem(item);
  document.getElementById('e-is-topping').checked=isToppingItem(item);
  document.getElementById('e-components-list').innerHTML='';
  const mode=isSetItem(item)?'set':item.isMaterial?'material':'normal';
  document.querySelectorAll('input[name="e-item-mode"]').forEach(r=>r.checked=false);
  const radio=document.querySelector(`input[name="e-item-mode"][value="${mode}"]`);
  if(radio) radio.checked=true;
  updateMenuMode();
  if(item.components&&item.components.length){
    item.components.forEach(comp=>{
      if(comp.isChoice){
        addComponentRow(true,{label:comp.label,choiceIds:(comp.choiceIds||[]).map(String),qty:comp.qty||1,qtys:comp.qtys||{},optional:!!comp.optional,extra:comp.extra||0});
      }else{
        addComponentRow(false,{id:String(comp.id),qty:comp.qty||1});
      }
    });
  }
  document.getElementById('menu-edit-modal-overlay').classList.add('show');
}
function closeMenuEditModal(){document.getElementById('menu-edit-modal-overlay').classList.remove('show');}

function autoDrinkFromCat(){
  const c=document.getElementById('e-cat').value;
  if(/ドリンク|飲み物|drink/i.test(c)){document.getElementById('e-is-drink').checked=true;document.getElementById('e-is-topping').checked=false;}
  if(/トッピング|topping/i.test(c)){document.getElementById('e-is-topping').checked=true;document.getElementById('e-is-drink').checked=false;}
}
function updateMenuMode(){
  let chk=document.querySelector('input[name="e-item-mode"]:checked');
  if(!chk){chk=document.querySelector('input[name="e-item-mode"][value="normal"]');if(chk)chk.checked=true;}
  const mode=chk?.value||'normal';
  const dg=document.getElementById('e-drink-group'); if(dg) dg.style.display=(mode==='set')?'none':'flex';
  const tg=document.getElementById('e-topping-group'); if(tg) tg.style.display=(mode==='normal')?'flex':'none';
  document.getElementById('e-price-group').style.display=mode==='material'?'none':'block';
  document.getElementById('e-stock-group').style.display=mode==='set'?'none':'block';
  document.getElementById('e-set-group').style.display=(mode==='set'||mode==='normal')?'block':'none';
  const ct=document.getElementById('e-comp-title');
  if(ct) ct.innerHTML=mode==='set'?'構成品 <span style="color:var(--danger)">*</span>':'構成品（任意）<span style="font-weight:500;font-size:11px;color:var(--gray);"> 例: ハンバーガー = バンズ＋パティ＋ピクルス。入れると在庫が連動し、単品のまま販売できます</span>';
  const mn=document.getElementById('e-material-note');
  if(mn) mn.style.display=mode==='material'?'block':'none';
  ['mode-normal-label','mode-set-label','mode-material-label'].forEach(lbl=>{
    const el=document.getElementById(lbl);
    if(el) el.style.background=mode===lbl.replace('mode-','').replace('-label','')?'#eff6ff':'#fff';
  });
}

function getSetAvailability(item){
  if(!item.isSet||!item.components||item.components.length===0) return null;
  let min=Infinity;
  let hasFixed=false;
  for(const comp of item.components){
    if(comp.isChoice) continue;
    const compItem=S.menu[comp.id]||S.menu[String(comp.id)];
    if(!compItem||!compItem.stock) continue;
    hasFixed=true;
    const cur=compItem.currentStock!=null?compItem.currentStock:compItem.stock;
    const perSet=comp.qty||1;
    min=Math.min(min,Math.floor(cur/perSet+1e-9));
  }
  return hasFixed?(min===Infinity?null:min):null;
}

function addComponentRow(isChoiceMode=false, savedData=null, rowId=null){
  const list=document.getElementById('e-components-list');
  if(!list) return;
  const rid=rowId||('comp-'+Date.now()+'x'+Math.floor(Math.random()*9999));
  let row=document.getElementById(rid);
  if(!row){
    row=document.createElement('div');
    row.id=rid;
    row.style.cssText='background:white;border:1.5px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;';
    list.appendChild(row);
  }
  const allItems=Object.values(S.menu).filter(i=>i.active!==false&&!i.isSet);

  if(isChoiceMode){
    const label=(savedData?.label)||'ドリンク';
    const qty=(savedData?.qty)||1;
    const checkedIds=new Set((savedData?.choiceIds||[]).map(String));
    const itemOptions=allItems.map(i=>
      `<label style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;cursor:pointer;background:white;margin-bottom:2px;">
        <input type="checkbox" class="comp-choice-item" data-id="${i.id}" ${checkedIds.has(String(i.id))?'checked':''} style="accent-color:var(--primary);width:15px;height:15px;flex-shrink:0;">
        <span style="font-size:13px;font-weight:600;">${esc(i.name)}</span>
        ${i.stock>0?`<span style="font-size:11px;color:var(--gray);">(在庫:${i.currentStock!=null?i.currentStock:i.stock})</span>`:''}
        <span style="margin-left:auto;display:inline-flex;align-items:center;gap:3px;" onclick="event.stopPropagation()"><input type="number" class="comp-opt-qty" min="0" step="any" placeholder="${qty}" value="${(savedData?.qtys&&savedData.qtys[String(i.id)]!=null)?savedData.qtys[String(i.id)]:''}" style="width:56px;padding:3px 5px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;text-align:center;"><span style="font-size:11px;color:var(--gray);">消費</span></span>
      </label>`
    ).join('');
    row.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:5px;">
          <button type="button" class="comp-mode-btn" onclick="addComponentRow(false,null,'${rid}')">固定</button>
          <button type="button" class="comp-mode-btn active">選択式</button>
        </div>
        <button type="button" style="background:none;border:none;color:var(--danger);font-size:18px;cursor:pointer;padding:0;" onclick="document.getElementById('${rid}').remove()">✕</button>
      </div>
      <div style="font-size:11px;color:#0369a1;font-weight:700;margin-bottom:9px;background:#f0f9ff;padding:5px 8px;border-radius:6px;">🔀 会計時にお客さんが選択します</div>
      <div style="display:flex;gap:10px;margin-bottom:9px;">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:700;margin-bottom:4px;">選択ラベル（例：ドリンク）</div>
          <input type="text" class="comp-choice-label" placeholder="ドリンク" value="${esc(label)}" style="width:100%;padding:7px 10px;font-size:14px;border:1.5px solid var(--border);border-radius:8px;outline:none;">
        </div>
        <div style="flex-shrink:0;">
          <div style="font-size:12px;font-weight:700;margin-bottom:4px;">消費数/セット</div>
          <div style="display:flex;align-items:center;gap:4px;">
            <input type="number" class="comp-qty-input" min="0.1" step="any" value="${qty}" style="width:58px;padding:7px 6px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;text-align:center;outline:none;">
            <span style="font-size:12px;color:var(--gray);">個</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:9px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;"><input type="checkbox" class="comp-optional" ${savedData?.optional?'checked':''} style="width:16px;height:16px;"> 「なし」を選べる</label>
        <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;">追加料金 <input type="number" class="comp-extra" min="0" value="${savedData?.extra||0}" style="width:64px;padding:5px;border:1.5px solid var(--border);border-radius:8px;text-align:center;"> 円</label>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--gray);margin-bottom:5px;">選択できる商品（複数選択可・右の数字＝その商品の1回あたり消費量。空欄なら上の消費数）：</div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px;max-height:150px;overflow-y:auto;">
        ${itemOptions||'<div style="color:var(--gray);font-size:12px;">商品がありません</div>'}
      </div>
      <input type="hidden" class="comp-is-choice" value="true">
    `;
  }else{
    const selId=(savedData?.id)||'';
    const qty=(savedData?.qty)||1;
    const opts=allItems.map(i=>
      `<option value="${i.id}" ${String(i.id)===String(selId)?'selected':''}>${esc(i.name)}${i.stock>0?` (在庫:${i.currentStock!=null?i.currentStock:i.stock})`:'（在庫管理なし）'}</option>`
    ).join('');
    row.innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <button type="button" class="comp-mode-btn active">固定</button>
          <button type="button" class="comp-mode-btn" onclick="addComponentRow(true,null,'${rid}')">選択式</button>
        </div>
        <select class="comp-item-select" style="flex:1;padding:7px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;">
          <option value="">-- 商品を選択 --</option>
          ${opts}
        </select>
        <input type="number" class="comp-qty-input" min="0.1" step="any" value="${qty}" style="width:60px;padding:7px 6px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;text-align:center;outline:none;">
        <span style="font-size:12px;color:var(--gray);flex-shrink:0;">個</span>
        <button type="button" style="background:none;border:none;color:var(--danger);font-size:18px;cursor:pointer;padding:0;" onclick="document.getElementById('${rid}').remove()">✕</button>
      </div>
      <input type="hidden" class="comp-is-choice" value="false">
    `;
  }
}

async function saveMenuItem(){
  const name=document.getElementById('e-name').value.trim();
  const priceRaw=parseInt(document.getElementById('e-price').value);
  const category=document.getElementById('e-cat').value.trim();
  const stock=parseFloat(document.getElementById('e-stock').value)||0;
  const mode=document.querySelector('input[name="e-item-mode"]:checked')?.value||'normal';

  if(!name){showToast('商品名を入力してください','error');return;}
  if(mode!=='material'&&(isNaN(priceRaw)||priceRaw<0)){showToast('正しい価格を入力してください','error');return;}

  const price=isNaN(priceRaw)?0:priceRaw;
  const isSet=mode==='set';
  const isMaterial=mode==='material';
  let components=[];
  const readComps=()=>{
    const out=[];
    document.querySelectorAll('#e-components-list > div').forEach(row=>{
      const isChoice=row.querySelector('.comp-is-choice')?.value==='true';
      if(isChoice){
        const label=row.querySelector('.comp-choice-label')?.value.trim()||'ドリンク';
        const choiceIds=[...row.querySelectorAll('.comp-choice-item:checked')].map(cb=>cb.dataset.id);
        const choiceQty=parseFloat(row.querySelector('.comp-qty-input')?.value)||1;
        const qtys={}; row.querySelectorAll('.comp-choice-item:checked').forEach(cb=>{
          const v=cb.closest('label').querySelector('.comp-opt-qty')?.value;
          if(v!==''&&v!=null&&!isNaN(Number(v))) qtys[cb.dataset.id]=Number(v);
        });
        const optional=!!row.querySelector('.comp-optional')?.checked;
        const extra=parseInt(row.querySelector('.comp-extra')?.value)||0;
        if(choiceIds.length>0) out.push({isChoice:true,label,choiceIds,qty:choiceQty,qtys,optional,extra});
      }else{
        const id=row.querySelector('.comp-item-select')?.value;
        const qty=parseFloat(row.querySelector('.comp-qty-input')?.value)||1;
        if(id) out.push({id,qty});
      }
    });
    return out;
  };

  if(mode!=='material') components=readComps();
  if(mode==='set'&&components.length===0){showToast('構成品を1つ以上追加してください','error');return;}
  // 構成品を持つ = 在庫連動。単品でも構成品を持てる（見た目は単品のまま）
  const composite=(mode==='set'||mode==='normal')&&components.length>0;

  showLoading(true);
  try{
    const isTopping=mode==='normal'&&document.getElementById('e-is-topping').checked;
    const isDrink=!isSet&&!isTopping&&document.getElementById('e-is-drink').checked;
    const data={name,price,category,stock:composite?0:stock,currentStock:composite?0:stock,active:true,isSet:composite,isMaterial,isDrink,isTopping,
      displayType:mode==='set'?'set':(composite?'single':'')};
    data.components=composite?components:[];
    if(S.editingMenuId){
      const prev=S.menu[S.editingMenuId]||{};
      if(!composite){
        const curStock=stock!==(prev.stock||0)?stock:(prev.currentStock!=null?prev.currentStock:stock);
        data.currentStock=curStock;
      }
      await db.ref(`${ROOT}/menu/${S.editingMenuId}`).set({...prev,...data,id:S.editingMenuId});
    }else{
      const id=Date.now();
      await db.ref(`${ROOT}/menu/${id}`).set({...data,id});
    }
    closeMenuEditModal();
    showToast(S.editingMenuId?'商品を更新しました ✅':'商品を追加しました ✅','success');
  }catch(e){showToast('エラーが発生しました','error');}
  showLoading(false);
}
async function toggleItem(id,active){await db.ref(`${ROOT}/menu/${id}/active`).set(active);}
async function deleteItem(id){
  if(!confirm('この商品を削除しますか？'))return;
  await db.ref(`${ROOT}/menu/${id}`).remove();
  showToast('商品を削除しました');
}

