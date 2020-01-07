const { ipcRenderer, remote } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const winLocation = window.location;
  if (winLocation.hostname === 'app.singlewindow.cn' && winLocation.pathname === '/cas/login') {
    let loginBtn = document.getElementById('submit');
    if (winLocation.search.indexOf('_swCardF=1') >= 0) {
      loginBtn = document.getElementById('loginbutton');
    }
    if (loginBtn) {
      const pwInput = document.getElementById('password');
      loginBtn.addEventListener('click', () => {
        const cardpw = pwInput.value;
        ipcRenderer.send('swapp-channel', {
          action: 'did-swlogin-click',
          payload: { cardpw },
        });
      }, false);
      if (!loginBtn.disabled) {
        const userConfData = remote.getGlobal('g_sharedUserConf');
        const { cardpw } = userConfData.swapp;
        if (cardpw) {
          pwInput.value = cardpw;
          loginBtn.click();
        }
      }
    }
  }
});
