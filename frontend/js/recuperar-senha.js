btn.onclick=async()=>{
  const r=await fetch('/api/auth/solicitar-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value})});
  const d=await r.json();msg.className=r.ok?'notice success':'notice error';msg.replaceChildren();
  const text=document.createTextNode(d.mensagem||d.erro||'Solicitação processada.');msg.appendChild(text);
  if(d.link_dev){try{const u=new URL(d.link_dev,location.origin);if(['http:','https:'].includes(u.protocol)&&u.origin===location.origin){msg.appendChild(document.createElement('br'));const a=document.createElement('a');a.href=u.href;a.textContent='Abrir link de desenvolvimento';msg.appendChild(a)}}catch{}}
};
