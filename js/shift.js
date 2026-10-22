// ===== シフト表示・シフト管理（ガント/時間帯別） =====
//  SHIFT DISPLAY (role screen)
function getGradeColor(grade){
  const defaults={'1年':'#86efac','2年':'#93c5fd','3年':'#fde68a','4年':'#fca5a5','スタッフ':'#e9d5ff'};
  return (S.gradeColors&&S.gradeColors[grade])||defaults[grade]||'#e2e8f0';
}
function renderShiftDisplay(){
  const el=document.getElementById('role-shift-display');
  if(!el) return;
  const now=new Date();
  const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const hhmm=now.getHours()*60+now.getMinutes();
  const all=Object.values(S.shiftsSnap);
  const active=all.filter(s=>{
    if(s.date&&s.date!==today) return false;
    const [sh,sm]=(s.startTime||'00:00').split(':').map(Number);
    const [eh,em]=(s.endTime||'23:59').split(':').map(Number);
    const st=sh*60+sm, et=eh*60+em;
    return hhmm>=st&&hhmm<et;
  });
  if(active.length===0){el.innerHTML='';return;}
  // 学年でグループ化
  const byGrade=new Map();
  active.forEach(s=>{
    const g=s.grade||s.type||'その他';
    if(!byGrade.has(g)) byGrade.set(g,[]);
    byGrade.get(g).push(s);
  });
  // 学年を降順（4年→3年→2年→1年→スタッフ→その他）にソート
  const gradeOrder=['4年','3年','2年','1年','スタッフ'];
  const sortedGrades=[...byGrade.keys()].sort((a,b)=>{
    const ai=gradeOrder.indexOf(a);
    const bi=gradeOrder.indexOf(b);
    if(ai>=0&&bi>=0) return ai-bi;
    if(ai>=0) return -1;
    if(bi>=0) return 1;
    return a.localeCompare(b,'ja');
  });
  let html='';
  sortedGrades.forEach(grade=>{
    const members=byGrade.get(grade);
    const col=getGradeColor(grade);
    html+=`<div class="shift-group"><div class="shift-group-label" style="color:#374151;">${grade}</div><div class="shift-names">${members.map(s=>`<span class="grade-tag" style="background:${col}20;color:#374151;border:1px solid ${col};">${s.name}</span>`).join('')}</div></div>`;
  });
  el.innerHTML=html;
}

//  ADMIN: SHIFT MANAGEMENT
const GANTT_H_START=8, GANTT_H_END=22;
const GANTT_TOTAL_MINS=(GANTT_H_END-GANTT_H_START)*60;

function localDateStr(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function shiftDateNav(delta){
  const d=new Date(S.shiftViewDate+'T00:00:00');
  d.setDate(d.getDate()+delta);
  S.shiftViewDate=localDateStr(d);
  renderAdminShifts();
}

function setShiftViewMode(m){
  S.shiftViewMode=m;
  renderAdminShifts();
}

function renderAdminShifts(){
  const el=document.getElementById('shifts-content');
  if(!el) return;
  const _tn=new Date();
  const viewDate=S.shiftViewDate||`${_tn.getFullYear()}-${String(_tn.getMonth()+1).padStart(2,'0')}-${String(_tn.getDate()).padStart(2,'0')}`;
  const today=`${_tn.getFullYear()}-${String(_tn.getMonth()+1).padStart(2,'0')}-${String(_tn.getDate()).padStart(2,'0')}`;
  const isToday=viewDate===today;
  const d=new Date(viewDate+'T00:00:00');
  const dateLabel=`${d.getMonth()+1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]})`;

  // ── メンバー一覧 ──
  const memberEntries=Object.entries(S.membersSnap).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ja'));
  const memberListHtml=memberEntries.length===0
    ?'<p style="color:#94a3b8;font-size:13px;text-align:center;padding:8px;">メンバーが登録されていません</p>'
    :memberEntries.map(([mid,m])=>{
      const col=getGradeColor(m.grade);
      return `<div class="member-list-item">
        <span class="mli-grade" style="background:${col}30;color:#374151;border:1px solid ${col};">${m.grade||'?'}</span>
        <span class="mli-name">${m.name}</span>
        <button onclick="deleteMember('${mid}')">削除</button>
      </div>`;
    }).join('');

  // ── 学年の一覧（既登録 + デフォルト）──
  const knownGrades=[...new Set([
    ...Object.values(S.membersSnap).map(m=>m.grade).filter(Boolean),
    ...Object.keys(S.gradeColors)
  ])].sort();

  // ── ガント ──
  const dayEntries=Object.entries(S.shiftsSnap)
    .filter(([,s])=>(s.date||'')===viewDate)
    .sort((a,b)=>(a[1].startTime||'').localeCompare(b[1].startTime||''));

  // グループ by memberId (同一人物を同一行に)
  const memberRows=new Map();
  dayEntries.forEach(([sid,s])=>{
    const key=s.memberId||sid;
    if(!memberRows.has(key)) memberRows.set(key,{s,shifts:[]});
    memberRows.get(key).shifts.push([sid,s]);
  });

  const axisLabels=[];
  for(let h=GANTT_H_START;h<=GANTT_H_END;h++) axisLabels.push(`${h}`);
  const gridLines=axisLabels.map((_,i)=>(i/(GANTT_H_END-GANTT_H_START)*100).toFixed(2));
  const nowPct=isToday?(()=>{
    const n=new Date();
    const mins=n.getHours()*60+n.getMinutes()-GANTT_H_START*60;
    return Math.min(100,Math.max(0,(mins/GANTT_TOTAL_MINS)*100)).toFixed(2);
  })():null;
  const axisHtml=axisLabels.map((h,i)=>`<div class="gantt-axis-cell" style="left:${gridLines[i]}%;position:absolute;transform:translateX(-50%)">${h}</div>`).join('');

  const rowsHtml=memberRows.size===0
    ?`<div class="gantt-empty">この日のシフトはありません</div>`
    :[...memberRows.values()]
      .sort((a,b)=>{
        // 1st: 最も早いシフトの開始時刻（昇順）
        const aTime=(a.shifts[0]?.[1]?.startTime||'00:00');
        const bTime=(b.shifts[0]?.[1]?.startTime||'00:00');
        if(aTime!==bTime) return aTime.localeCompare(bTime);
        // 2nd: 学年の数字（大きい＝上の学年 → 上に表示）
        const aG=parseInt(a.s.grade)||0;
        const bG=parseInt(b.s.grade)||0;
        return bG-aG;
      })
      .map(({s,shifts})=>{
      const grade=s.grade||s.type||'';
      const col=getGradeColor(grade);
      const firstId=shifts[0][0];
      const barsHtml=shifts.map(([sid,sh])=>{
        const [sh2,sm]=(sh.startTime||'08:00').split(':').map(Number);
        const [eh,em]=(sh.endTime||'09:00').split(':').map(Number);
        const left=Math.max(0,((sh2*60+sm-GANTT_H_START*60)/GANTT_TOTAL_MINS)*100).toFixed(2);
        const width=Math.max(1,(((eh*60+em)-(sh2*60+sm))/GANTT_TOTAL_MINS)*100).toFixed(2);
        return `<div class="gantt-bar" style="left:${left}%;width:${width}%;background:${col};border:1px solid ${col};color:#374151;" title="${sh.startTime}〜${sh.endTime}">${sh.startTime}〜${sh.endTime}</div>`;
      }).join('');
      return `<div class="gantt-row" id="grow-${firstId}">
        <div class="gantt-name-col">
          <span class="gnbadge-dyn" style="background:${col}40;color:#374151;">${grade}</span>
          <span class="gname" title="${s.name}">${s.name}</span>
        </div>
        <div class="gantt-bar-area">
          ${gridLines.map(p=>`<div class="grid-line" style="left:${p}%"></div>`).join('')}
          ${nowPct!==null?`<div class="gantt-now-line" style="left:${nowPct}%"></div>`:''}
          ${barsHtml}
        </div>
        <div class="gantt-btn-group">
          <button class="gantt-row-edit" onclick="startEditShift('${firstId}')" title="編集">✏️</button>
          <button class="gantt-row-del" onclick="deleteShift('${firstId}')" title="削除">✕</button>
        </div>
      </div>`;
    }).join('');

  // ── 時間帯別 ──
  const _tm=t=>{const [a,b]=(t||'0:0').split(':').map(Number);return a*60+(b||0)};
  const slotsHtml=(()=>{
    if(dayEntries.length===0) return `<div class="gantt-empty">この日のシフトはありません</div>`;
    let rows='';
    for(let h=GANTT_H_START;h<GANTT_H_END;h++){
      const a=h*60,b=(h+1)*60;
      const on=dayEntries.filter(([,sh])=>_tm(sh.startTime)<b&&_tm(sh.endTime)>a)
        .sort((x,y)=>(parseInt(y[1].grade)||0)-(parseInt(x[1].grade)||0)||(x[1].name||'').localeCompare(y[1].name||'','ja'));
      const nowCls=isToday&&_tn.getHours()===h?' slot-now':'';
      const chips=on.length===0?'<span style="color:#94a3b8;font-size:12px;">—</span>':on.map(([sid,sh])=>{
        const col=getGradeColor(sh.grade||sh.type||'');
        const partial=_tm(sh.startTime)>a||_tm(sh.endTime)<b;
        const note=partial?`<small style="opacity:.7;margin-left:3px;">${sh.startTime}〜${sh.endTime}</small>`:'';
        return `<span class="slot-chip" style="background:${col}55;border:1px solid ${col};" onclick="startEditShift('${sid}')" title="${sh.name} ${sh.startTime}〜${sh.endTime}"><b>${sh.grade||'?'}</b> ${sh.name}${note}</span>`;
      }).join('');
      rows+=`<div class="slot-row${nowCls}"><div class="slot-time">${String(h).padStart(2,'0')}:00</div><div class="slot-count">${on.length}人</div><div class="slot-chips">${chips}</div></div>`;
    }
    return `<div class="slot-wrap">${rows}</div>`;
  })();
  const viewMode=S.shiftViewMode==='slots'?'slots':'gantt';

  // ── 学年凡例 ──
  const legendHtml=knownGrades.map(g=>{
    const col=getGradeColor(g);
    return `<span style="display:flex;align-items:center;gap:3px;font-size:11px;font-weight:700;"><div style="width:12px;height:12px;border-radius:3px;background:${col};"></div>${g}</span>`;
  }).join('');

  // ── 色設定 ──
  const allGrades=[...new Set([
    '1年','2年','3年','4年',
    ...Object.values(S.membersSnap).map(m=>m.grade).filter(Boolean)
  ])].sort();
  const colorSettingsHtml=allGrades.map(g=>{
    const col=getGradeColor(g);
    return `<div class="grade-color-row">
      <label style="display:flex;align-items:center;gap:6px;"><span class="gnbadge-dyn" style="background:${col}40;color:#374151;">${g}</span>${g}</label>
      <input type="color" value="${col}" onchange="updateGradeColor('${g}',this.value)">
    </div>`;
  }).join('');

  // ── シフト追加フォーム（メンバー選択） ──
  const memberOptions=memberEntries.map(([mid,m])=>
    `<option value="${mid}">${m.name}（${m.grade||'?'}）</option>`
  ).join('');

  el.innerHTML=`
  <div style="padding:12px;">

    <!-- メンバー管理 -->
    <div class="card" style="margin-bottom:12px;">
      <h3>👤 メンバー管理</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:10px;">一度登録すればシフトで選択できます</p>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input id="nm-name" type="text" placeholder="名前" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;">
        <input id="nm-grade" type="text" placeholder="学年（例: 2年）" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;" list="grade-list">
        <datalist id="grade-list">${allGrades.map(g=>`<option value="${g}">`).join('')}</datalist>
        <button onclick="addMember()" style="padding:8px 14px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;white-space:nowrap;">追加</button>
      </div>
      <div id="member-list">${memberListHtml}</div>
    </div>

    <!-- 学年カラー設定 -->
    <details class="card" style="margin-bottom:12px;">
      <summary style="font-weight:700;font-size:14px;cursor:pointer;padding:4px 0;">🎨 学年カラー設定</summary>
      <div style="margin-top:10px;">${colorSettingsHtml||'<p style="color:#94a3b8;font-size:13px;">メンバーを登録すると色を設定できます</p>'}</div>
    </details>

    <!-- ガントチャート -->
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="margin:0;">📊 シフト表</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${legendHtml}</div>
      </div>
      <div class="gantt-date-nav">
        <button onclick="shiftDateNav(-1)">◀</button>
        <div class="gdlabel">${dateLabel}${isToday?' 🟢 今日':''}</div>
        <button onclick="shiftDateNav(1)">▶</button>
      </div>
      <div class="shift-mode-toggle">
        <button class="${viewMode==='gantt'?'on':''}" onclick="setShiftViewMode('gantt')">📊 ガント</button>
        <button class="${viewMode==='slots'?'on':''}" onclick="setShiftViewMode('slots')">🕐 時間帯別</button>
      </div>
      ${viewMode==='slots'?slotsHtml:`<div class="gantt-wrap">
        <div class="gantt-table">
          <div class="gantt-axis-row">
            <div style="width:130px;flex-shrink:0;"></div>
            <div style="flex:1;position:relative;height:18px;">${axisHtml}</div>
            <div style="width:50px;flex-shrink:0;"></div>
          </div>
          ${rowsHtml}
        </div>
      </div>`}
    </div>

    <!-- シフト追加/編集 -->
    <div class="card" id="shift-form-card">
      <h3 id="sf-form-title">＋ シフト追加</h3>
      <div class="shift-form" style="margin-top:10px;">
        <input id="sf-date" type="date" value="${viewDate}" style="grid-column:1/-1;">
        <select id="sf-member" style="grid-column:1/-1;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;">
          <option value="">── メンバーを選択 ──</option>
          ${memberOptions}
        </select>
        <div style="display:flex;gap:6px;align-items:center;font-size:13px;color:#374151;font-weight:600;grid-column:1/-1;">
          <input id="sf-start" type="time" value="09:00" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;">
          <span>〜</span>
          <input id="sf-end" type="time" value="15:00" style="flex:1;padding:8px;border:1.5px solid var(--border);border-radius:8px;">
        </div>
        <button id="sf-submit-btn" onclick="submitShiftForm()" style="grid-column:1/-1;padding:10px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;">＋ 追加</button>
        <button id="sf-cancel-btn" onclick="cancelEditShift()" style="display:none;grid-column:1/-1;padding:10px;background:#f1f5f9;color:#374151;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;">キャンセル</button>
      </div>
    </div>

  </div>`;
}

function addMember(){
  const name=(document.getElementById('nm-name').value||'').trim();
  const grade=(document.getElementById('nm-grade').value||'').trim();
  if(!name){showToast('名前を入力してください','error');return;}
  if(!grade){showToast('学年を入力してください','error');return;}
  const id='m'+Date.now();
  db.ref(`${ROOT}/members/${id}`).set({name,grade})
    .then(()=>{
      showToast('追加しました','success');
      document.getElementById('nm-name').value='';
      document.getElementById('nm-grade').value='';
    });
}

function deleteMember(id){
  db.ref(`${ROOT}/members/${id}`).remove()
    .then(()=>showToast('削除しました','success'));
}

function updateGradeColor(grade,color){
  db.ref(`${ROOT}/gradeColors/${encodeURIComponent(grade).replace(/%/g,'_')}`).set(color);
  // also update in-memory immediately
  if(!S.gradeColors) S.gradeColors={};
  S.gradeColors[grade]=color;
}

function submitShiftForm(){
  const mid=document.getElementById('sf-member').value;
  if(!mid){showToast('メンバーを選択してください','error');return;}
  const member=S.membersSnap[mid];
  if(!member){showToast('メンバーが見つかりません','error');return;}
  const date=document.getElementById('sf-date').value||localDateStr(new Date());
  const startTime=document.getElementById('sf-start').value||'09:00';
  const endTime=document.getElementById('sf-end').value||'15:00';
  const data={memberId:mid,name:member.name,grade:member.grade||'',date,startTime,endTime};
  if(S.editingShiftId){
    db.ref(`${ROOT}/shifts/${S.editingShiftId}`).update(data)
      .then(()=>{showToast('更新しました','success');S.editingShiftId=null;S.shiftViewDate=date;});
  }else{
    const id='s'+Date.now();
    db.ref(`${ROOT}/shifts/${id}`).set(data)
      .then(()=>{showToast('追加しました','success');S.shiftViewDate=date;});
  }
}

function startEditShift(id){
  const s=S.shiftsSnap[id];
  if(!s) return;
  S.editingShiftId=id;
  const card=document.getElementById('shift-form-card');
  if(card) card.scrollIntoView({behavior:'smooth',block:'nearest'});
  const sel=document.getElementById('sf-member');
  if(sel&&s.memberId){sel.value=s.memberId;}
  document.getElementById('sf-date').value=s.date||'';
  document.getElementById('sf-start').value=s.startTime||'09:00';
  document.getElementById('sf-end').value=s.endTime||'15:00';
  document.getElementById('sf-form-title').textContent='✏️ シフト編集';
  document.getElementById('sf-submit-btn').textContent='更新';
  document.getElementById('sf-submit-btn').style.background='#0f766e';
  document.getElementById('sf-cancel-btn').style.display='';
  document.querySelectorAll('.gantt-row').forEach(r=>r.style.background='');
  const row=document.getElementById('grow-'+id);
  if(row) row.style.background='#eff6ff';
}

function cancelEditShift(){
  S.editingShiftId=null;
  document.getElementById('sf-form-title').textContent='＋ シフト追加';
  document.getElementById('sf-submit-btn').textContent='＋ 追加';
  document.getElementById('sf-submit-btn').style.background='';
  document.getElementById('sf-cancel-btn').style.display='none';
  document.querySelectorAll('.gantt-row').forEach(r=>r.style.background='');
}

function deleteShift(id){
  db.ref(`${ROOT}/shifts/${id}`).remove()
    .then(()=>showToast('削除しました','success'));
}

