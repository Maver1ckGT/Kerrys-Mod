// Kerry's Mod — gamemode suite compatibility bootstrap.
(() => {
  let tries = 0;
  const boot = () => {
    const suite = window.KerrysGamemodeSuite;
    if (!suite) { if (++tries < 120) setTimeout(boot, 200); return; }
    const gm = document.getElementById('gm');
    const mp = document.getElementById('mp');
    if (gm) gm.value = suite.modeId;
    if (mp) {
      const map = suite.currentMapId;
      const meta = (window.KM_GAMEMODES?.CORE_MAPS || []).concat(window.KM_GAMEMODES?.SANDBOX_MAPS || []).find(x => x.id === map);
      if (meta) mp.value = String(meta.legacy);
    }
  };
  boot();
})();