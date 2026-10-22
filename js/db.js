// ===== Supabase接続と、Firebase互換のデータベース層（db.ref(...)） =====
//  SUPABASE (replaces Firebase Realtime Database)
const SUPABASE_URL = "https://xwbpulfedlriuayzuxww.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3YnB1bGZlZGxyaXVheXp1eHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NTM2OTEsImV4cCI6MjEwNTEyOTY5MX0.XGysaD48oEeNQn9BDgyIYvBFqBTBDULNsVvmORNzr60";
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const REAL_ROOT='festival', DEBUG_ROOT='debug_data';
let ROOT=REAL_ROOT;

// --- Firebase-Realtime-Database-compatible shim, backed by a single JSONB
//     row in Supabase (table kv_store, id=1). All db.ref(path).set/update/
//     remove/on/once/transaction calls throughout this file work unchanged.
let _treeCache={}, _treeLoaded=false, _treeLoadedResolvers=[];
const _listeners=[]; // {arr, cb}
const _connCallbacks=[];

function _pathToArray(path){
  if(path==='/') return [];
  let p=String(path);
  if(p===REAL_ROOT||p.startsWith(REAL_ROOT+'/')) p=p.slice(REAL_ROOT.length);
  p=p.replace(/^\/+/,'');
  return p===''?[]:p.split('/');
}
function _getAtPath(tree,arr){
  let cur=tree;
  for(const seg of arr){ if(cur==null) return null; cur=cur[seg]; }
  return cur===undefined?null:cur;
}
function _notifyAll(){
  _listeners.forEach(l=>{
    const val=_getAtPath(_treeCache,l.arr);
    const json=JSON.stringify(val);
    if(l.last===json) return;   // 自分の担当データが変わっていなければ何もしない
    l.last=json;
    l.cb({val:()=>val});
  });
}
async function _refreshTree(){
  const {data,error}=await _sb.from('kv_store').select('value').eq('id',1).single();
  if(!error&&data){ _treeCache=data.value||{}; _notifyAll(); }
}
function _showFatal(msg){
  let b=document.getElementById('fatal-banner');
  if(!b){ b=document.createElement('div'); b.id='fatal-banner';
    b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#991b1b;color:#fff;padding:12px 16px;font-size:13px;font-weight:700;line-height:1.6;';
    document.body.appendChild(b); }
  b.textContent=msg;
}
async function _healthCheck(){
  const r=await _sb.rpc('kv_get_path',{p:['_health']});
  if(r.error){
    _showFatal('⚠️ データベースの準備ができていません。SupabaseのSQL Editorで、最新のセットアップSQLを実行してください。（'+r.error.message+'）');
    return false;
  }
  const t=await _sb.rpc('kv_set_path',{p:['_health','a','b'],val:1});
  const g=await _sb.rpc('kv_get_path',{p:['_health','a','b']});
  await _sb.rpc('kv_remove_path',{p:['_health']});
  if(t.error||g.data!==1){
    _showFatal('⚠️ データベース関数が古いままです。最新のセットアップSQLをもう一度実行してください（途中の階層を作れない古い版です）。');
    return false;
  }
  return true;
}
async function _initTree(){
  const {data,error}=await _sb.from('kv_store').select('value').eq('id',1).single();
  if(error){ _showFatal('⚠️ Supabaseに接続できません: '+error.message); }
  else { await _healthCheck(); }
  _treeCache=(!error&&data&&data.value)?data.value:{};
  _treeLoaded=true;
  _treeLoadedResolvers.forEach(r=>r()); _treeLoadedResolvers=[];
  _notifyAll();
  _sb.channel('kv_store_changes')
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'kv_store',filter:'id=eq.1'},payload=>{
      _treeCache=(payload.new&&payload.new.value)?payload.new.value:{};
      _notifyAll();
    })
    .subscribe(status=>{
      const online=status==='SUBSCRIBED';
      _connCallbacks.forEach(cb=>cb({val:()=>online}));
    });
  // リアルタイムが切れても動くよう、4秒ごとに最新状態を確認（保険）
  setInterval(()=>{ _refreshTree().catch(()=>{}); },4000);
}
function _whenTreeLoaded(){ return _treeLoaded?Promise.resolve():new Promise(r=>_treeLoadedResolvers.push(r)); }

function _makeRef(path){
  const isRoot=(path==='/');
  return {
    async set(val){
      const arr=_pathToArray(path);
      if(arr.length===0||val===null||val===undefined){
        await _sb.rpc(arr.length===0?'kv_reset':'kv_remove_path',arr.length===0?{}:{p:arr});
      } else {
        const {error}=await _sb.rpc('kv_set_path',{p:arr,val});
        if(error) throw new Error(error.message);
      }
      await _refreshTree();
    },
    async update(partial){
      if(isRoot){
        for(const [fullPath,val] of Object.entries(partial)){
          const {error}=await _sb.rpc('kv_set_path',{p:_pathToArray(fullPath),val});
          if(error) throw new Error(error.message);
        }
        await _refreshTree();
        return;
      }
      const arr=_pathToArray(path);
      const {error}=await _sb.rpc('kv_update_path',{p:arr,val:partial});
      if(error) throw new Error(error.message);
      await _refreshTree();
    },
    async remove(){
      const arr=_pathToArray(path);
      if(arr.length===0){ await _sb.rpc('kv_reset'); }
      else { await _sb.rpc('kv_remove_path',{p:arr}); }
      await _refreshTree();
    },
    on(eventType,cb){
      if(path==='.info/connected'){ _connCallbacks.push(cb); if(_treeLoaded) cb({val:()=>true}); return; }
      const arr=_pathToArray(path);
      const entry={arr,cb,last:undefined};
      _listeners.push(entry);
      if(_treeLoaded){ const v=_getAtPath(_treeCache,arr); entry.last=JSON.stringify(v); cb({val:()=>v}); }
    },
    async once(eventType){
      await _whenTreeLoaded();
      const arr=_pathToArray(path);
      return {val:()=>_getAtPath(_treeCache,arr)};
    },
    async transaction(updateFn){
      const arr=_pathToArray(path);
      for(let i=0;i<6;i++){
        const {data:cur}=await _sb.rpc('kv_get_path',{p:arr});
        const curVal=cur===undefined?null:cur;
        const next=updateFn(curVal);
        if(next===undefined) return {committed:false,snapshot:{val:()=>curVal}};
        const {data:ok}=await _sb.rpc('kv_cas_path',{p:arr,old_val:curVal,new_val:next});
        if(ok){ await _refreshTree(); return {committed:true,snapshot:{val:()=>next}}; }
        await new Promise(r=>setTimeout(r,80*(i+1)));
      }
      throw new Error('同時更新が競合しました。もう一度お試しください');
    }
  };
}
const db={ ref(path){ return _makeRef(path); } };

window.addEventListener('unhandledrejection',e=>{
  try{ showToast('エラー: '+((e.reason&&e.reason.message)||e.reason),'error'); }catch(_){}
});

