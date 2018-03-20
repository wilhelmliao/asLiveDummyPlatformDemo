const Parseurl = require('parseurl');

const ControlPanel = require('./handlers/ControlPanelHandler');
const asLive       = require('./handlers/asLiveServiceHandler');

module.exports.RequestHandler = ((() => {
  const self = {};

  self.routes = {
    '/'            : ControlPanel.Home,
    '/Login'       : ControlPanel.Login,
    '/Logout'      : ControlPanel.Logout,
    '/About'       : ControlPanel.About,
  

    '/GrantCode'   : asLive.Auth.GrantCode,
    '/AccessToken' : asLive.Auth.AccessToken,
    '/RefreshToken': asLive.Auth.RefreshToken,
    '/RevokeToken' : asLive.Auth.RevokeToken,

    '/Player' : asLive.Routines.Player,
    '/Reward' : asLive.Routines.Reward,
  };

  self.getHandler = (path) => {
    //if (/^\/manual\//.test(path)) {
    //  return ControlPanel.Manual;
    //}
    return self.routes[path]
  };

  return self;
})());
