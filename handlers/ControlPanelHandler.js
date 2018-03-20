const parseurl    = require('parseurl')
const querystring = require('querystring')
const cookie      = require('cookie')
const view        = require('./viewHelper')
//const markdown    = require('./markdownHelper')
//const SR          = require('./resourceHelper')

const self = module.exports = {

  Home: (ctx, req, res) => {
    const url = parseurl(req)
    let args = querystring.parse(url.query)

    let model = {}   
    if (ctx.identity.isAuthenticated()) {
      model['isAuthenticated'  ] = true
      model['authenticatedUser'] = ctx.identity.getAuthticationTicket().user
    }

    let output = view.renderView('ControlPanelLayout', model,  'Home')
    res.write(output)
    res.end()
  },

  Login: (ctx, req, res) => {
    const url = parseurl(req)
    switch(req.method) {
    case 'GET':
      let args = querystring.parse(url.query)
      let output = view.renderView('ControlPanelLayout', {}, 'Login')
      res.write(output)
      res.end()
      break

    case 'POST':
      req.setEncoding('utf-8')
      let postData = ''
      req.addListener("data", function (postDataChunk) {
        postData += postDataChunk
      })
      req.addListener("end", function () {
        let args = querystring.parse(postData)
        if (args.username && args.password) {
          if (args.password.length > 8) {
            ctx.session.set('_', '')
            let token = ctx.identity.setAuthticationTicket({
              user      : args.username,
              session_id: ctx.session.getId()
            })
            ctx.session.set('token', token)
            let qs  = querystring.parse(url.query)
            let returnUrl = '/'
            if (qs.returnUrl) {
              returnUrl = qs.returnUrl + '?grant_code' + ctx.session.getId()
            }
            res.writeHead(302, {
              'Location'  : returnUrl,
            })
            res.end()
          } else {
            let output = view.renderView('ControlPanelLayout', {
              errorMsg: 'invalid username or password!'
            }, 'Login')
            res.write(output)
            res.end()
          }
        }
      })
      req.addListener('error', function(err) {
        res.statusCode = 503
        res.end()
      })
      break

    default:
      res.statusCode = 405
      res.end()
      break
    }
  },

  Logout: (ctx, req, res) => {
    const url = parseurl(req)
    let args = querystring.parse(url.query)

    if (ctx.identity.isAuthenticated()) {
      ctx.identity.revoke();
      ctx.session.clear()
    }

    res.writeHead(302, {
      'Location'  : req.headers.referer || '/',
    })
    res.end()
  },

  About: (ctx, req, res) => {
    const url = parseurl(req)
    let args = querystring.parse(url.query)

    let model = {}   
    if (ctx.identity.isAuthenticated()) {
      model['isAuthenticated'  ] = true
      model['authenticatedUser'] = ctx.identity.getAuthticationTicket().user
    } 

    let output = view.renderView('ControlPanelLayout', model,  'About')
    res.write(output)
    res.end()
  }, 
}