// ===== アプリ全体の状態(S)・画面切り替え =====
//  STATE
const S={
  cart:[],isDayOpen:false,currentDay:null,
  menu:{},settings:{adminPin:'0000',storeName:'じゃがバター屋'},
  ordersSnap:{},daysSnap:{},ticketsSnap:{},voucherColorsSnap:{},voucherInput:{},shiftsSnap:{},membersSnap:{},gradeColors:{},editingShiftId:null,shiftViewDate:(()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`})(),
  pinBuf:'',pinCb:null,editingMenuId:null,selCat:'all',
  kitchenFilter:'pending',activeAdminTab:'settings',activePosTab:'menu',
  currentRole:null, // 'cashier'|'kitchen'|'admin'
};

//  SHARE (single self-contained file — nothing to configure per device)
function downloadShareFile(){
  showToast('このファイル自体が配布用ファイルです。同じリンク／ファイルをそのまま共有してください 📤','success');
}

//  SCREEN MANAGEMENT
function showScreen(name){
  ['setup-screen','share-screen','login-screen','role-screen','cashier-screen','kitchen-screen','handoff-screen','pos-screen','admin-screen']
    .forEach(id=>{
      const el=document.getElementById(id);
      if(id==='setup-screen'||id==='share-screen'||id==='login-screen'){
        el.classList.remove('show');
        if(id==='login-screen') el.style.display='none';
      } else {
        el.classList.remove('show');
        el.style.display='none';
      }
    });

  if(name==='login'){
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('login-screen').classList.add('show');
  } else if(name==='setup'){
    document.getElementById('setup-screen').style.display='flex';
    document.getElementById('setup-screen').classList.add('show');
  } else if(name==='share'){
    document.getElementById('share-screen').classList.add('show');
  } else if(name==='role'){
    document.getElementById('role-screen').style.display='flex';
    document.getElementById('role-screen').classList.add('show');
    updateRoleScreen();
    startClock();
  } else if(name==='cashier'){
    stopClock();
    document.getElementById('cashier-screen').style.display='block';
    document.getElementById('cashier-screen').classList.add('show');
    updateCashierOverlay();
    renderCategoryFilter();
    renderMenu();
    renderCart();
  } else if(name==='kitchen'){
    document.getElementById('kitchen-screen').style.display='block';
    document.getElementById('kitchen-screen').classList.add('show');
    updateKitchenOverlay();
    renderKitchen();
    renderKitchenTickets();
  } else if(name==='handoff'){
    document.getElementById('handoff-screen').style.display='block';
    document.getElementById('handoff-screen').classList.add('show');
    updateHandoffOverlay();
    renderHandoff();
    renderHandoffTickets();
  } else if(name==='pos'){
    document.getElementById('pos-screen').style.display='block';
    document.getElementById('pos-screen').classList.add('show');
    renderPosTab(S.activePosTab||'menu');
  } else if(name==='admin'){
    document.getElementById('admin-screen').style.display='block';
    document.getElementById('admin-screen').classList.add('show');
    renderAdminTab(S.activeAdminTab);
    updateAdminDayStatus();
  }
}

