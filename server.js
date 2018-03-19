// Forked workers will run this code when found to not be
// the master of the cluster.

const http     = require('http');
const parseurl = require('parseurl'); // faster than native nodejs url package
const fs       = require('fs');
const path     = require('path');

// you can pass the parameter in the command line. e.g. node server.js 3000
const port = process.argv[2] || CONFIG.SERVER_PORT || 80;

const modules = require('./modules');
// Initialize routes & their handlers (once)
const routing = require('./routing');
const requestHandler  = routing.RequestHandler;
// const routeNotImplemented = require('./helper').responses.routeNotImplemented;

module.exports = http.createServer(function (req, res) {
  const url   = parseurl(req);
  const route = url.pathname;

  res.setHeader('Server'      , CONFIG.SERVER_NAME);
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');

  //configure context
  var context = {
    request : req,
    response: res
  };

  //configure context.identity
  context.identity = modules.Identity(context, RES);
  //configure context.session
  context.session  = modules.Session(context, RES);
  if (context.identity.isAuthenticated()) {
    var session = context.session;
    if (session.getId() && !session.isAlive()) {
      res.writeHead(302, {
        'Location'  : CONFIG.LOGIN_URL,
        'Set-Cookie': CONFIG.SESSION_NAME + '=; path=/; expires=0; httpOnly'
      });
      res.end();
      return;
    }
  }
  if (context.endResponse) {
    return;
  }

  var httpHandler = requestHandler.getHandler(route);
  if (httpHandler) {
    httpHandler(context, req, res);
  } else {
    var pathname = `./public${route}`;

    const mimeType = {
      '.ico'  : 'image/x-icon',
      '.html' : 'text/html',
      '.js'   : 'text/javascript',
      '.json' : 'application/json',
      '.css'  : 'text/css',
      '.png'  : 'image/png',
      '.jpg'  : 'image/jpeg',
      '.wav'  : 'audio/wav',
      '.mp3'  : 'audio/mpeg',
      '.svg'  : 'image/svg+xml',
      '.pdf'  : 'application/pdf',
      '.doc'  : 'application/msword',
      '.eot'  : 'appliaction/vnd.ms-fontobject',
      '.ttf'  : 'aplication/font-sfnt'
    };

    fs.exists(pathname, function (exist) {
      if(!exist) {
        // if the file is not found, return 404
        res.statusCode = 404;
        res.end();
        return;
      }
      // if is a directory, then look for index.html
      if (fs.statSync(pathname).isDirectory()) {
        pathname += '/index.html';
      }
      // read file from file system
      fs.readFile(pathname, function(err, data){
        if(err){
          res.statusCode = 500;
          res.end(`Error getting the file: ${err}.`);
          return;
        } else {
          // based on the URL path, extract the file extention. e.g. .js, .doc, ...
          const ext = path.parse(pathname).ext;
          // if the file is found, set Content-type and send data
          res.writeHead(200, {
            'Content-type': mimeType[ext] || 'text/plain'
          });
          res.end(data);
          return;
        }
      });
    });
  }
}).listen(port, () => console.log(`Server listening on port ${port}`));
