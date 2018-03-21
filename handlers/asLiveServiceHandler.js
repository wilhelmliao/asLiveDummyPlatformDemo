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
  /**
   * The nodejs convert the header name to lower case letters after parsing.
   */
  X_API_ClientID : 'x-api-clientid',
  X_API_Signature: 'x-api-signature',
  X_API_Timestamp: 'x-api-timestamp'
}

/** generate API Signature
 *
 * @param {Number} timestamp
 * @param {Object} data
 */
function createSignature(timestamp, data) {
  let string = ClientID + ClientSecret + timestamp + data
  return crypto.createHash('md5').update(string).digest('hex')
}

/** validate API Signature
 *
 * @param {String} clientID
 * @param {Number} timestamp
 * @param {Object} data
 * @param {String} signature
 */
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
    console.log(client_signature)
    return false
  }
  return true
}

/** validate required arguments
 *
 * @param {Object} obj
 * @param {Array} names
 */
function validateRequiredArgs(obj, names) {
  var data = obj || {}
  if (names) {
    if (!Array.isArray(names))
      return false

    return names.every((key, index, array) => {
      if (typeof data[key] == 'undefined'  ||  data[key] == null) {
        return false
      }
      return true
    })
    return true
  }
  return true
}


/** formating the date to ISO 8601 string
 * 
 * @param {Date} date 
 */
function getISODateTimeString(date) {
  function pad(number) {
    if (number < 10) {
      return '0' + number;
    }
    return number;
  }

  return date.getUTCFullYear() +
  '-' + pad(date.getUTCMonth() + 1) +
  '-' + pad(date.getUTCDate()) +
  'T' + pad(date.getUTCHours()) +
  ':' + pad(date.getUTCMinutes()) +
  ':' + pad(date.getUTCSeconds()) +
  'Z';
}


module.exports.Auth = {

  /** Gets the grant code.
   *
   *  NOTE:
   *    The /GrantCode will be called by client browser scripts.
   */
  GrantCode: (ctx, req, res) => {
    const url = parseurl(req)

    // add CROS header ( https://www.w3.org/TR/cors/#syntax )
    if (req.headers['origin']) {
      res.setHeader('Access-Control-Allow-Origin', req.headers['origin'])
      res.setHeader('Access-Control-Allow-Methods', 'GET')
      res.setHeader('Access-Control-Max-Age', '86400')
    }

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
         * The user have not logged in yet.
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


  /** Gets the access token.
   *
   *  NOTE:
   *    If the asLive service need access resource, it will get
   *    the access token first.
   *
   *  @arg {String} grant_code
   */
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
        if (!validateRequiredArgs(args, ['grant_code'])) {
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


  /** Refresh the access token.
   *
   *  NOTE:
   *    If the asLive service need long-lived access tokens.
   *
   *  @arg {String} access_token
   */
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
        if (!validateRequiredArgs(args, ['access_token'])) {
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


  /** Revoke the access token.
   *
   *  NOTE:
   *    Revoke the access tokens when the token won't be used anymore.
   *
   *  @arg {String} access_token
   */
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
        if (!validateRequiredArgs(args, ['access_token'])) {
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

module.exports.Routines  = {
  /** Gets the player information.
   *
   *  @arg {String} access_token
   */
  Player: (ctx, req, res) => {
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
        if (!validateRequiredArgs(args, ['access_token'])) {
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
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.write(
              JSON.stringify({
                message: 'OK',
                data: {
                  player_id    : data.user,
                  player_name  : data.user,
                  player_avatar: 'http://'+'image-server/player_' +data.user+ '_avatar.png'
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


  /** Process the reward.
   *
   *  @arg {String} access_token
   *  @arg {String} anchor
   *  @arg {String} gift
   *  @arg {Number} points
   */
  Reward: (ctx, req, res) => {
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
        if (!validateRequiredArgs(args, ['access_token', 'anchor', 'gift', 'points'])) {
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
            let balance = Math.floor((Math.random() * 100000)) + 10
            let orderID = "R180300" + Math.floor(Math.random() * 100000).toString()
            let amount  = parseInt(args.points, 10)

            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            if (balance >= amount) {
              res.write(
                JSON.stringify({
                  message: 'OK',
                  data: {
                    balance: balance - amount,
                    id     : orderID,
                    date   : getISODateTimeString(new Date())
                  },
                  timestamp: Math.floor(Date.now() / 1000)
                })
              )
            } else {
              res.write(
                JSON.stringify({
                  message: 'BALANCE_INSUFFICIENT',
                  timestamp: Math.floor(Date.now() / 1000)
                })
              )
            }
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