/* EVE contact standings are a presentation scale, not a new rules mechanic. */
(function expose(root) {
  function appraisal(verdict) {
    if (!verdict.valid || !Number.isFinite(verdict.gain)) return { valid:false, score:0, label:'NO APPRAISAL', color:'#a5afb8', reaction:'AWAITING TERMS' };
    // A coarse reaction, not an explanation, valuation readout or guaranteed answer.
    let warmth = Math.max(-10,Math.min(10,5+5*(verdict.gain-verdict.premium)/Math.max(100,verdict.premium)));
    if(!verdict.liquidityOK || !verdict.transferSolvent) warmth=Math.min(0,warmth);
    const [score,label,color,reaction] = warmth < -5 ? [-10,'TERRIBLE · RED','#ec7476','HOSTILE CONTACT'] : warmth < 0 ? [-5,'BAD · ORANGE','#eda566','COLD COMMS'] : warmth < 5 ? [0,'NEUTRAL','#b1bdc5','DIPLOMATIC CHANNEL OPEN'] : warmth < 8 ? [5,'GOOD · LIGHT BLUE','#76cce8','LIGHT BLUE RESPONSE'] : [10,'EXCELLENT · BLUE','#6e96f0','BLUE RESPONSE'];
    return { valid:true,score,label,color,reaction };
  }
  root.TradeStanding = { appraisal };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TradeStanding;
})(typeof globalThis !== 'undefined' ? globalThis : this);
