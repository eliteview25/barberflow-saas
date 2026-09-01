(function(){
  'use strict';

  const STORAGE_KEY='bf_theme_preference';
  const OPTIONS=new Set(['light','dark','system']);
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  let preference='system';

  function readPreference(){
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      return OPTIONS.has(saved)?saved:'system';
    }catch{return 'system'}
  }

  function resolvedTheme(value){
    if(value==='light'||value==='dark')return value;
    return media?.matches?'dark':'light';
  }

  function updateThemeColor(theme){
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='dark'?'#080a0d':'#f4f6f8');
  }

  function syncControls(){
    document.querySelectorAll('[data-bf-theme-select]').forEach(select=>{
      if(select.value!==preference)select.value=preference;
    });
  }

  function applyTheme(value,{persist=false,notify=false}={}){
    preference=OPTIONS.has(value)?value:'system';
    const theme=resolvedTheme(preference);
    const root=document.documentElement;
    root.dataset.bfThemePreference=preference;
    root.dataset.bfTheme=theme;
    root.style.colorScheme=theme;
    if(persist){try{localStorage.setItem(STORAGE_KEY,preference)}catch{}}
    updateThemeColor(theme);
    syncControls();
    if(notify)window.dispatchEvent(new CustomEvent('bf:themechange',{detail:{preference,theme}}));
    return theme;
  }

  function controlElement(location){
    const control=document.createElement('label');
    control.className=`bf-theme-control bf-theme-control-${location}`;
    control.innerHTML=`<span class="bf-theme-control-icon" aria-hidden="true">◐</span><span class="bf-theme-control-copy"><strong>Aparência</strong><small>Claro, escuro ou sistema</small></span><select data-bf-theme-select aria-label="Escolher aparência do BarberFlow"><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Sistema</option></select>`;
    const select=control.querySelector('select');
    select.value=preference;
    select.addEventListener('change',()=>applyTheme(select.value,{persist:true,notify:true}));
    return control;
  }

  function mountThemeControl(){
    const body=document.body;
    if(!body||body.matches('.public-bg,.storefront-body')||document.querySelector('.bf-theme-control'))return;
    const sidebarBottom=document.querySelector('.sidebar-bottom');
    if(sidebarBottom){
      const control=controlElement('sidebar');
      const before=sidebarBottom.querySelector('.sidebar-user,a[data-click*="logout"]');
      sidebarBottom.insertBefore(control,before||sidebarBottom.firstChild);
      body.classList.remove('bf-has-floating-theme');
      return;
    }
    body.appendChild(controlElement('floating'));
    body.classList.add('bf-has-floating-theme');
  }

  preference=readPreference();
  applyTheme(preference);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountThemeControl,{once:true});
  else mountThemeControl();

  const observer=new MutationObserver(()=>mountThemeControl());
  const observe=()=>document.body&&observer.observe(document.body,{childList:true,subtree:true});
  if(document.body)observe();else document.addEventListener('DOMContentLoaded',observe,{once:true});

  const systemChanged=()=>{if(preference==='system')applyTheme('system',{notify:true})};
  if(media?.addEventListener)media.addEventListener('change',systemChanged);
  else media?.addListener?.(systemChanged);

  window.addEventListener('storage',event=>{
    if(event.key===STORAGE_KEY)applyTheme(OPTIONS.has(event.newValue)?event.newValue:'system',{notify:true});
  });

  window.BFTheme={getPreference:()=>preference,getTheme:()=>resolvedTheme(preference),set:value=>applyTheme(value,{persist:true,notify:true})};
})();
