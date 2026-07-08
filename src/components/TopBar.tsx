import { useEffect, useState } from "react";

export default function TopBar() {
  const [time,setTime]=useState("");

  useEffect(()=>{
    const update=()=>setTime(new Date().toLocaleTimeString());
    update();
    const id=setInterval(update,1000);
    return ()=>clearInterval(id);
  },[]);

  return (
    <header className="topbar">
      <div className="logo">🛡 SENTINEL</div>
      <div className="status">
        <span>🕒 {time}</span>
        <span>🟢 Online</span>
        <span>🔋100%</span>
      </div>
    </header>
  );
}
