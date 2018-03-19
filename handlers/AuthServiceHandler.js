const parseurl    = require('parseurl')
const querystring = require('querystring')
const cookie      = require('cookie')

// encrypt and decrypt the grant_code and access_token
const fs          = require('fs');
const jwt         = require('jsonwebtoken')
const GRANT_CODE_PRIV = fs.readFileSync('live_grant_code.pem')
const GRANT_CODE_PUB  = fs.readFileSync('live_grant_code.pub')
const CERT_PRIV   = fs.readFileSync('live_auth.pem')
const CERT_PUB    = fs.readFileSync('live_auth.pub')

// encrypt the api signature
const crypto       = require('crypto')
const ClientID     = '3df82c9b0af2'
const ClientSecret = 'p@ssw0rd'


const API_HEADER = {
  X_API_ClientID : 'x-api-clientid',
  X_API_Signature: 'x-api-signature',
  X_API_Timestamp: 'x-api-timestamp'
}

function createSignature(timestamp, data) {
  let string = ClientID + ClientSecret + timestamp + data
  return crypto.createHash('md5').update(string).digest('hex')
}

function validateClientSignature(clientID, timestamp, data, signature) {
  if (!clientID || clientID != ClientID) {
    return false
  }
  if (!timestamp || 
      timestamp < (Math.floor(Date.now() / 1000) - 300) ||
      timestamp > (Math.floor(Date.now() / 1000) + 300) ) {
    return false
  }
  let client_signature = createSignature(timestamp, data || '')
  if (!signature || signature != client_signature) {
    return false
  }
  return true
}


const self = module.exports = {

  /**
   * The /GrantCode will be called by client browser scripts
   */
  GrantCode: (ctx, req, res) => {
    const url = parseurl(req)
    switch(req.method) {
    case 'GET':
      // is authenticated?
      if (ctx.identity.isAuthenticated()) {
        // generate grant code
           /**
            * The example using the JWT to create grant_code token
            */
        let grant_code = jwt.sign({
          user: ctx.identity.getAuthticationTicket().user
        }, GRANT_CODE_PRIV, { algorithm: 'RS256', expiresIn: 320 });

        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.write(
          JSON.stringify({
            message: 'OK',
            data : {
              grant_code: grant_code
            },
            timestamp: Math.floor(Date.now() / 1000)
          })
        )
        res.end()
      } else {
        /**
         * When the user is not
         */
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.write(
          JSON.stringify({
            message: 'NOT_AUTHORIZED',
            timestamp: Math.floor(Date.now() / 1000)
          })
        )
        res.end()
      }
      break

    default:
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.write(
        JSON.stringify({
          message: 'ACCESS_REFUSED',
          timestamp: Math.floor(Date.now() / 1000)
        })
      )
      res.end()
      break
    }
  },

  AccessToken: (ctx, req, res) => {
    const url = parseurl(req)
    switch(req.method) {
    case 'POST':
      req.setEncoding('utf-8')
      let postData = ''
      req.addListener('data', function (postDataChunk) {
        postData += postDataChunk
      })
      req.addListener('end', function () {
        let args = querystring.parse(postData)
        // check required arguments
        if (!args.grant_code) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.write(
            JSON.stringify({
              message: 'ILLEGAL_ARGUMENT',
              timestamp: Math.floor(Date.now() / 1000)
            })
          )
          res.end()
          return
        }
        // validata api signagure
        let clientID  = req.headers[API_HEADER.X_API_ClientID]
        let signature = req.headers[API_HEADER.X_API_Signature]
        let timestamp = req.headers[API_HEADER.X_API_Timestamp]
        if (!validateClientSignature(clientID, timestamp, postData || '', signature)) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.write(
            JSON.stringify({
              message: 'INVALID_SIGNATURE',
              timestamp: Math.floor(Date.now() / 1000)
            })
          )
          res.end()
          return
        }
        // process and respond requests
        let token = args.grant_code.trim()
        jwt.verify(token, GRANT_CODE_PUB, { algorithm: 'RS256' }, function(err, data){
          if (err) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.write(
              JSON.stringify({
                message: 'INVALID_TOKEN',
                timestamp: Math.floor(Date.now() / 1000)
              })
            )
            res.end()
          } else {
            let access_token = jwt.sign({
              user: data.user
            }, CERT_PRIV, { algorithm: 'RS256', expiresIn: 3360 });
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.write(
              JSON.stringify({
                message: 'OK',
                data   : {
                  access_token: access_token,
                  expires_in: 3360
                },
                timestamp: Math.floor(Date.now() / 1000)
              })
            )
            res.end()
          }
        })
      })
      req.addListener('error', function(err) {
        res.statusCode = 503
        res.end()
      })
      break

    default:
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.write(
        JSON.stringify({
          message: 'ACCESS_REFUSED',
          timestamp: Math.floor(Date.now() / 1000)
        })
      )
      res.end()
      break
    }
  },

  RefreshToken: (ctx, req, res) => {
    const url = parseurl(req)
    switch(req.method) {
    case 'POST':
      req.setEncoding('utf-8')
      let postData = ''
      req.addListener('data', function (postDataChunk) {
        postData += postDataChunk
      })
      req.addListener('end', function () {
        let args = querystring.parse(postData)
        // check required arguments
        if (!args.access_token) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.write(
            JSON.stringify({
              message: 'ILLEGAL_ARGUMENT',
              timestamp: Math.floor(Date.now() / 1000)
            })
          )
          res.end()
          return
        }
        // validata api signagure
        let clientID  = req.headers[API_HEADER.X_API_ClientID]
        let signature = req.headers[API_HEADER.X_API_Signature]
        let timestamp = req.headers[API_HEADER.X_API_Timestamp]
        if (!validateClientSignature(clientID, timestamp, postData || '', signature)) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.write(
            JSON.stringify({
              message: 'INVALID_SIGNATURE',
              timestamp: Math.floor(Date.now() / 1000)
            })
          )
          res.end()
          return
        }
        // process and respond requests
        let token = args.access_token.trim()
        jwt.verify(token, CERT_PUB, { algorithm: 'RS256' }, function(err, data){
          if (err) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.write(
              JSON.stringify({
                message: 'INVALID_TOKEN',
                timestamp: Math.floor(Date.now() / 1000)
              })
            )
            res.end()
          } else {
            let access_token = jwt.sign({
              user: data.user
            }, CERT_PRIV, { algorithm: 'RS256', expiresIn: 864000 });
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.write(
              JSON.stringify({
                message: 'OK',
                data   : {
                  access_token: access_token,
                  expires_in: 864000
                },
                timestamp: Math.floor(Date.now() / 1000)
              })
            )
            res.end()
          }
        })
      })
      req.addListener('error', function(err) {
        res.statusCode = 503
        res.end()
      })
      break

    default:
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.write(
        JSON.stringify({
          message: 'ACCESS_REFUSED',
          timestamp: Math.floor(Date.now() / 1000)
        })
      )
      res.end()
      break
    }
  },

  RevokeToken: (ctx, req, res) => {
    const url = parseurl(req)
    switch(req.method) {
    case 'POST':
      req.setEncoding('utf-8')
      let postData = ''
      req.addListener('data', function (postDataChunk) {
        postData += postDataChunk
      })
      req.addListener('end', function () {
        let args = querystring.parse(postData)
        // check required arguments
        if (!args.access_token) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.write(
            JSON.stringify({
              message: 'ILLEGAL_ARGUMENT',
              timestamp: Math.floor(Date.now() / 1000)
            })
          )
          res.end()
          return
        }
        // validata api signagure
        let clientID  = req.headers[API_HEADER.X_API_ClientID]
        let signature = req.headers[API_HEADER.X_API_Signature]
        let timestamp = req.headers[API_HEADER.X_API_Timestamp]
        if (!validateClientSignature(clientID, timestamp, postData || '', signature)) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.write(
            JSON.stringify({
              message: 'INVALID_SIGNATURE',
              timestamp: Math.floor(Date.now() / 1000)
            })
          )
          res.end()
          return
        }
        // process and respond requests
        let token = args.access_token.trim()
        jwt.verify(token, CERT_PUB, { algorithm: 'RS256' }, function(err, data){
          if (err) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.write(
              JSON.stringify({
                message: 'INVALID_TOKEN',
                timestamp: Math.floor(Date.now() / 1000)
              })
            )
            res.end()
          } else {
            /**
             * Implement your token clearing code here...
             */
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.write(
              JSON.stringify({
                message: 'OK',
                timestamp: Math.floor(Date.now() / 1000)
              })
            )
            res.end()
          }
        })
      })
      req.addListener('error', function(err) {
        res.statusCode = 503
        res.end()
      })
      break

    default:
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.write(
        JSON.stringify({
          message: 'ACCESS_REFUSED',
          timestamp: Math.floor(Date.now() / 1000)
        })
      )
      res.end()
      break
    }
  },
}