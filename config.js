const fs  = require('fs');
const LRU = require('./libs/lru-cache/lru-cache')

const config = {
  SERVER_NAME         : 'AsLiveDummyPlatform',
  SERVER_PORT         : 30084,

  AUTH_TOKEN_KEY      : fs.readFileSync('liveapp.auth.pem'),
  AUTH_TOKEN_PUB_KEY  : fs.readFileSync('liveapp.auth.pub'),
  AUTH_TOKEN_ALGORITHM: 'RS256',

  COOKIE_AUTH_NAME    : '.AUTHSESSION',
  COOKIE_AUTH_MAX_AGE : 3600 * 24 * 7,  /* (sec) */
  COOKIE_AUTH_PATH    : '/',

  SESSION_NAME        : 'session',
  SESSION_TIMEOUT     : 1200,  /* (sec) */

  LOGIN_URL           : '/Login'
};

module.exports.config = config
module.exports.res = {
  SessionContainer: LRU({
    maxAge: config.SESSION_TIMEOUT * 1000,
    itemManager: LRU.SessionItemManager
  })
};