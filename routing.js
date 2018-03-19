const Parseurl = require('parseurl');

const ControlPanel = require('./handlers/ControlPanelHandler');
const Auth         = require('./handlers/AuthServiceHandler');

module.exports.RequestHandler = ((() => {
  const self = {};

  self.routes = {
    '/'            : ControlPanel.Home,
    '/Login'       : ControlPanel.Login,
    '/Logout'      : ControlPanel.Logout,
  

    '/GrantCode'   : Auth.GrantCode,
    '/AccessToken' : Auth.AccessToken,
    '/RefreshToken': Auth.RefreshToken,
    '/RevokeToken' : Auth.RevokeToken,

    '/Player' : null,
    '/Reward' : null,
  };

  self.getHandler = (path) => {
    //if (/^\/manual\//.test(path)) {
    //  return ControlPanel.Manual;
    //}
    return self.routes[path]
  };

  return self;
})());
