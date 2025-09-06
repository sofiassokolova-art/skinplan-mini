import React from "react";
export default function Pill({active, children, onClick}:{active?:boolean; children:React.ReactNode; onClick?:()=>void}){
  return (
    <button onClick={onClick}
      className={[
        "px-3 py-1 rounded-full border text-sm transition",
        active ? "bg-black text-white border-black" : "bg-white/70 border-zinc-300 hover:border-zinc-500"
      ].join(" ")}
    >{children}</button>
  );
}
