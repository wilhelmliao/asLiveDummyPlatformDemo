const uuid   = require('uuid/v4')
const cookie = require('cookie');
const jwt    = require('jsonwebtoken');

const COOKIE_AUTH_NAME     = CONFIG.COOKIE_AUTH_NAME
    , COOKIE_AUTH_MAX_AGE  = CONFIG.COOKIE_AUTH_MAX_AGE
    , AUTH_TOKEN_KEY       = CONFIG.AUTH_TOKEN_KEY
    , AUTH_TOKEN_PUB_KEY   = CONFIG.AUTH_TOKEN_PUB_KEY
    , AUTH_TOKEN_ALGORITHM = CONFIG.AUTH_TOKEN_ALGORITHM
    , SESSION_NAME         = CONFIG.SESSION_NAME;

function getAuthticationTicket(ctx) {
  let token = getCookieItem(ctx, COOKIE_AUTH_NAME)
  if (token) {
    let result = null
    jwt.verify(token, AUTH_TOKEN_PUB_KEY, { algorithm: AUTH_TOKEN_ALGORITHM },
      function(err, data) {
        if (!err) {
          result = data
        }
      })
    return result
  }
}

function setAuthticationTicket(ctx, data, maxAge) {
  let token = jwt.sign(data, AUTH_TOKEN_KEY, { algorithm: AUTH_TOKEN_ALGORITHM, expiresIn: COOKIE_AUTH_MAX_AGE })
  let cookieItem = cookie.serialize(COOKIE_AUTH_NAME, token, { httpOnly: true , maxAge: maxAge || COOKIE_AUTH_MAX_AGE })
  ctx.response.setHeader('Set-Cookie', cookieItem)
  return token
}

function clearAuthticationTicket(ctx) {
  let cookieItem = cookie.serialize(COOKIE_AUTH_NAME, '', { httpOnly: true , expires:new Date(0) })
  ctx.response.setHeader('Set-Cookie', cookieItem)
}

function getSessionID(ctx) {
  return getCookieItem(ctx, SESSION_NAME)
}

function setSessionID(ctx, value) {
  let cookieItem = cookie.serialize(SESSION_NAME, value, { httpOnly: true })
  ctx.response.setHeader('Set-Cookie', cookieItem)
}

function clearSessionID(ctx) {
  let cookieItem = cookie.serialize(SESSION_NAME, '', { httpOnly: true, expires:new Date(0) })
  ctx.response.setHeader('Set-Cookie', cookieItem)
}

function getCookieItem(ctx, name) {
  let cookies = ctx.cookies;
  if (!cookies) {
    if (ctx.request.headers.cookie) {
      cookies = cookie.parse(ctx.request.headers.cookie)
      // exports to context
      ctx.cookies = cookies
    }
  }
  if (cookies) {
    return cookies[name]
  }
}

module.exports.Identity = function(ctx, res) {
  let ticket = getAuthticationTicket(ctx)
  if (ticket  &&  ticket.user  &&  (ticket.user.length > 0)) {
    ticket.isAuthenticated = true
  }

  this.isAuthenticated = function() {
    if (ticket) {
      return ticket.isAuthenticated
    }
    return false
  }
  this.getAuthticationTicket = function() {
    return ticket
  }
  this.setAuthticationTicket = function(data, maxAge) {
    return setAuthticationTicket(ctx, data, maxAge)
  }
  this.revoke = function() {
    clearAuthticationTicket(ctx)
  }
  return this
};

module.exports.Session = function (ctx, res) {
  let _ctx       = ctx
  let _id        = getSessionID(ctx)
  let _container = res.SessionContainer
  let _isLoaded  = (_id) ? true : false

  this.getId = function() {
    return _id
  }

  this.get = function(name) {
    if (_id) {
      let item = _container.get(_id)
      if (item) {
        return item[name]
      }
    }
  }

  this.isAlive = function() {
    if (_id && _container.peek(_id)) {
      return true
    }
    return false
  }

  this.isNew = function() {
    if (_id) {
      return (_isLoaded == false)
    }
    return false
  }

  this.set = function(name, value) {
    if (!_id) {
      for(let i = 0; i < 64; i++) {
        let newId = uuid()
        if (!_container.peek(newId)) {
          _container.set(newId, { [name]: value })
          setSessionID(_ctx, newId)
          _id = newId
          return true
        }
      }
      console.log('fail to generate new session id')
      return false
    } else {
      let item = _container.get(_id)
      if (item) {
        item[name] = value;
        return true
      } else {
        // back to life
        _container.set(_id, { [name]: value })
        return true
      }
      return false
    }
  }

  this.touch = function() {
    if (_id) {
      if (_container.get(_id)) {
        return true
      }
    }
    return false
  }

  this.clear = function() {
    if (_id) {
      _container.del(_id)
      clearSessionID(_ctx)
    }
  }
  return this
};
