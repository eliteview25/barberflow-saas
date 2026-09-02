(()=>{
  const params=new URLSearchParams(location.search),sent=Number(params.get('emails')||0),total=Number(params.get('total')||0),status=document.getElementById('deletionEmailStatus');
  if(total>0&&sent===total){status.textContent=sent===1?'O link individual de recuperação foi enviado ao e-mail do dono.':`Os links individuais de recuperação foram enviados aos ${sent} donos.`;status.className='notice success';return}
  status.textContent='Não foi possível entregar todos os e-mails de recuperação. A conta ainda pode ser restaurada pelo Supermaster durante os próximos 30 dias.';status.className='notice warning';
})();
