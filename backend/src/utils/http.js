function externalTimeoutMs(){
  const n=Number(process.env.EXTERNAL_HTTP_TIMEOUT_MS||10000);
  return Number.isFinite(n)?Math.max(1000,Math.min(30000,Math.trunc(n))):10000;
}
function externalSignal(){return AbortSignal.timeout(externalTimeoutMs())}
module.exports={externalTimeoutMs,externalSignal};
