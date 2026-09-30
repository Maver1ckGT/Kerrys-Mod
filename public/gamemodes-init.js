// Compatibility bootstrap for the comprehensive gamemode suite.
(() => {
  let tries=0;
  const boot=()=>{
    const s=window.KerrysGamemodeSuite;
    if(!s){ if(tries++<80)setTimeout(boot,250); return; }
    // The suite context exposes modeId as a function for compatibility; use the actual suite field here.
    s.voting.eligible=()=>s.modeId!=='gm_sandbox';
    // Start the default Sandbox rules immediately; the existing menu can switch modes later.
    const current=s.modes.get(s.modeId);
    if(current && !current.running) current.start();
    const gm=document.getElementById('gm');
    if(gm && !gm.dataset.kmSuiteInit){ gm.dataset.kmSuiteInit='1'; gm.value=s.modeId; }
    const mp=document.getElementById('mp');
    if(mp && !mp.dataset.kmSuiteInit){ mp.dataset.kmSuiteInit='1'; mp.value=s.currentMapId; }
  };
  boot();
})();
