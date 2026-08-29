(()=>{
  const API="http://localhost:3001";
  let loading=false;
  let cachedWorld=null;
  async function getWorld(){
    if(cachedWorld)return cachedWorld;
    const response=await fetch(`${API}/world`);
    cachedWorld=await response.json();
    return cachedWorld;
  }
  async function addWeatherBadge(card){
    if(!card)return;
    const header=card.querySelector(".widget-header");
    if(!header||header.querySelector(".radar-current-mini")||loading)return;
    loading=true;
    try{
      const world=await getWorld();
      const current=world?.weather?.current,city=world?.location?.city||"Current location";
      if(current){
        const badge=document.createElement("div");badge.className="radar-current-mini";
        const icon=String(current.icon||"");
        const temperature=Math.round(Number(current.temperature)||0),feelsLike=Math.round(Number(current.feelsLike)||0);
        badge.innerHTML=`<img src="${icon.startsWith("//")?`https:${icon}`:icon}" alt=""><strong>${temperature}\u00b0 \u00b7 ${String(current.condition||"")}</strong><span>${city} \u00b7 feels like ${feelsLike}\u00b0</span>`;
        header.append(badge);
      }
    }catch{}finally{loading=false}
  }
  async function mount(){
    const radar=document.querySelector(".weather-radar-card"),weekly=document.querySelector(".weekly-forecast-card");
    await addWeatherBadge(radar||weekly);
    if(!radar)return;
    const range=radar.querySelector('.weather-radar-timeline input[type="range"]');
    if(range&&!range.dataset.sentinelLatest){
      range.dataset.sentinelLatest="true";
      requestAnimationFrame(()=>{
        range.value=range.min;
        range.dispatchEvent(new Event("change",{bubbles:true}));
        range.dispatchEvent(new Event("input",{bubbles:true}));
      });
    }
    const actions=radar.querySelector(".weather-radar-actions");
    if(actions&&!actions.querySelector(".radar-latest-frame")){
      const button=document.createElement("button");button.className="radar-latest-frame";button.type="button";button.textContent="Now";
      button.onclick=()=>{const range=radar.querySelector('.weather-radar-timeline input[type="range"]');if(!range)return;range.value=range.min;range.dispatchEvent(new Event("change",{bubbles:true}));range.dispatchEvent(new Event("input",{bubbles:true}))};
      actions.prepend(button);
    }
    const existingOutlooks=[...radar.querySelectorAll(".radar-six-hour-outlook")];
    existingOutlooks.slice(1).forEach(item=>item.remove());
    if(!existingOutlooks.length&&!radar.dataset.sentinelOutlookLoading){
      radar.dataset.sentinelOutlookLoading="true";
      try{
        const world=await getWorld();
        const hourly=world?.weather?.hourly||world?.weather?.forecast?.hourly||[];
        const now=Date.now();
        const upcoming=hourly.filter(item=>{
          const value=item.time||item.timestamp||item.dateTime;
          const stamp=typeof value==="number"?(value<1e12?value*1000:value):Date.parse(value);
          return Number.isFinite(stamp)&&stamp>=now-30*60*1000;
        }).slice(0,6);
        if(upcoming.length){
          const outlook=document.createElement("section");outlook.className="radar-six-hour-outlook";
          outlook.innerHTML=`<header><strong>Next 6 hours</strong><span>Forecast precipitation outlook</span></header><div>${upcoming.map(item=>{
            const value=item.time||item.timestamp||item.dateTime,stamp=typeof value==="number"?(value<1e12?value*1000:value):Date.parse(value);
            const rain=Math.round(Number(item.chanceOfRain??item.rainChance??item.precipitationChance??0));
            const temp=Math.round(Number(item.temperature??item.tempC??item.temp_c??0));
            return `<article><b>${new Date(stamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</b><strong>${rain}% rain</strong><span>${temp}\u00b0</span></article>`;
          }).join("")}</div>`;
          radar.append(outlook);
        }
      }catch{}finally{delete radar.dataset.sentinelOutlookLoading}
    }
  }
  new MutationObserver(()=>void mount()).observe(document.documentElement,{childList:true,subtree:true});
  void mount();
})();
