// ─── Scroll-to-top + floating search visibility ───
window.addEventListener('scroll', function(){
  const scrolled = window.scrollY > 400;
  const topBtn = document.getElementById('scrollTopBtn');
  if(topBtn) topBtn.classList.toggle('visible', scrolled);
  const searchBtn = document.getElementById('fabSearchBtn');
  if(searchBtn) searchBtn.classList.toggle('visible', scrolled);
}, {passive:true});

function focusSearchInput(){
  const input = document.getElementById('searchInput');
  if(!input) return;
  window.scrollTo({top:0, behavior:'smooth'});
  setTimeout(() => { input.focus(); input.scrollIntoView({behavior:'smooth', block:'center'}); }, 350);
}

// ─── Dark mode ───
function toggleDarkMode(){
  document.body.classList.toggle('dark-mode');
  const icon = document.getElementById('darkIcon');
  const isDark = document.body.classList.contains('dark-mode');
  if(icon){ icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon'; }
  try{ localStorage.setItem('dp_dark', isDark?'1':'0'); }catch(e){}
}
(function initDark(){
  try{
    if(localStorage.getItem('dp_dark')==='1'){
      document.body.classList.add('dark-mode');
      const icon = document.getElementById('darkIcon');
      if(icon) icon.className = 'fas fa-sun';
    }
  }catch(e){}
})();

// ─── Mobile drawer menu ───
function toggleMobileDrawer(){
  const drawer = document.getElementById('mobileDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if(!drawer || !overlay) return;
  drawer.classList.toggle('open');
  overlay.classList.toggle('open');
  document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
}

// ─── Animated counter ───
function animateCounter(el, target, suffix){
  let start=0, duration=1800, startTime=null;
  function step(ts){
    if(!startTime) startTime=ts;
    const progress=Math.min((ts-startTime)/duration,1);
    const eased=1-Math.pow(1-progress,3);
    const val=Math.floor(eased*target);
    el.textContent=(val>=1000?(val/1000).toFixed(1)+'K':val)+suffix;
    if(progress<1) requestAnimationFrame(step);
    else el.textContent=(target>=1000?(target/1000).toFixed(1)+'K':target)+suffix;
  }
  requestAnimationFrame(step);
}

// ─── Insert Stats Section after hero ───
// ─── Insert Brands Marquee ───
function insertBrandsSection(){
  const featuresSection = document.querySelector('.features-section');
  if(!featuresSection || document.getElementById('brandsSection')) return;
  const brands = [
    {icon:'🇩🇪', name:'Dentsply Sirona'},{icon:'🇺🇸', name:'3M ESPE'},
    {icon:'🇯🇵', name:'GC Corporation'},{icon:'🇩🇪', name:'Ivoclar Vivadent'},
    {icon:'🇺🇸', name:'Kerr Dental'},{icon:'🇩🇪', name:'KaVo Kerr'},
    {icon:'🇨🇭', name:'Straumann'},{icon:'🇺🇸', name:'Ultradent'},
    {icon:'🇧🇪', name:'SDI Limited'},{icon:'🇺🇸', name:'DENTSPLY'},
  ];
  const trackHtml = [...brands,...brands].map(b =>
    `<div class="brand-item"><span class="brand-icon">${b.icon}</span>${b.name}</div>`
  ).join('');
  const section = document.createElement('div');
  section.id = 'brandsSection';
  section.className = 'brands-section';
  section.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <span class="section-tag">شركاؤنا</span>
    </div>
    <div class="brands-track" id="brandsTrack">${trackHtml}</div>`;
  featuresSection.insertAdjacentElement('afterend', section);
}

// ─── Add quick-view button to product cards ───

// ─── Notification bell shake when unread ───
function updateBellState(){
  const badge = document.getElementById('notifBadge');
  const btn = document.getElementById('notifBtn');
  if(badge && btn){
    const count = parseInt(badge.textContent)||0;
    btn.classList.toggle('has-unread', count>0);
  }
}

// ─── Run all enhancements after page loads ───
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(updateBellState, 2000);

  // Re-enhance after products render
  const observer = new MutationObserver(() => {
    // إعادة تفعيل عرض شارة الجرس عند أي تحديث للمنتجات
    // (تم حذف enableCardTilt من هنا لأنها مكررة مع المراقب الثاني بالأسفل)
    updateBellState();
  });
  const grid = document.getElementById('productsGrid');
  if(grid) observer.observe(grid, {childList:true, subtree:false});
});

// ─── 3D tilt effect on product cards ───
function enableCardTilt(){
  document.querySelectorAll('.product-card').forEach(card => {
    if(card.dataset.tilt) return;
    card.dataset.tilt = '1';
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const cx = rect.width/2, cy = rect.height/2;
      const dx = (x - cx)/cx, dy = (y - cy)/cy;
      card.style.transform = `perspective(700px) rotateY(${dx*8}deg) rotateX(${-dy*8}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

// Hook everything into DOMContentLoaded
(function(){
  const old = document.querySelectorAll('.product-card');
  if(old.length) enableCardTilt();
  const grid = document.getElementById('productsGrid');
  if(grid){
    const mo = new MutationObserver(() => { enableCardTilt(); updateBellState(); });
    mo.observe(grid, {childList:true, subtree:false});
  }
})();
