import {useState} from "react";
import {sendMessage} from "../services/chat";

type Message={sender:"user"|"sentinel";text:string};

export default function AIChat(){
 const [messages,setMessages]=useState<Message[]>([
  {sender:"sentinel",text:"Welcome to Sentinel. How can I help?"}
 ]);
 const [input,setInput]=useState("");

 async function handleSend(){
  if(!input.trim()) return;
  const text=input;
  setMessages(m=>[...m,{sender:"user",text}]);
  setInput("");
  const reply=await sendMessage(text);
  setMessages(m=>[...m,{sender:"sentinel",text:reply}]);
 }

 return(
  <section className="chat-panel">
   <h2>AI Conversation</h2>
   <div className="chat-window">
    {messages.map((m,i)=>(
      <div key={i} className={`message ${m.sender}`}>{m.text}</div>
    ))}
   </div>
   <div className="chat-input">
    <input value={input} onChange={e=>setInput(e.target.value)}
      onKeyDown={e=>e.key==="Enter"&&handleSend()}
      placeholder="Type a command..." />
    <button onClick={handleSend}>Send</button>
   </div>
  </section>
 );
}
