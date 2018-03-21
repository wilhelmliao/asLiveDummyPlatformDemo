;(function(global) {
  var _app;
  var _i18n = {
    MustLoginMessage: '請先登入',
    CannotStartAppMessage: '操作失敗'
  };
  var REVOKE_SESSION_URL = 'http://127.0.0.1:30083/RevokeSession';
  var MAIN_APP_URL       = 'http://127.0.0.1:30083/Demo.html';

  function M(opt) {
    this.apiKey = opt.apiKey;
    this.i18n   = Object.assign({}, _i18n);

    Object.assign(this.i18n, (opt.i18n || {}));

    return this;
  }

  M.prototype.getGrantCode = function(callback) {
    ajax({
      method : 'GET',
      url    : '/GrantCode',
      success: function(result) {
        if (result) {
          var data = JSON.parse(result);
          callback(data)
        }
      },
      error: function(xhr, status, err) {
        callback({
          message: 'ERROR'
        });
      }
    });
  };
  M.prototype.run = function() {
    _app = openAppWindow('about:blank');
    if (_app) {
      this.getGrantCode((result) => {
        if (result) {
          if (result.message == 'OK' && result.data && result.data.grant_code) {
            _app = openAppWindow(MAIN_APP_URL + '?code=' + encodeURIComponent(result.data.grant_code));
            _app.focus();
          } else if (result.message == 'NOT_AUTHORIZED') {
            _app.close();
            window.alert(this.i18n.MustLoginMessage);
          } else {
            _app.close();
            window.alert(this.i18n.CannotStartAppMessage + '(' + (result.message || '') +')');
          }
        } else {
          _app.close();
          window.alert(this.i18n.CannotStartAppMessage);
        }
      })
    } else {
      console.error('asLive:CANNOT_OPEN_APP_WINDOW');
    }
  };
  M.prototype.revokeSession = function() {
    // 302 ? ajax revokeSession
    ajax({
      method : 'GET',
      url    : REVOKE_SESSION_URL + '?appid=' + encodeURIComponent(this.apiKey),
      success: function(result) {
        if (result) {
          var data = JSON.parse(result);
          callback(data)
        }
      },
      error: function(xhr, status, err) {
        callback({
          message: 'ERROR'
        });
      }
    });
  };
  M.prototype.exit = function() {
    if (_app) {
      _app.close();
    }
  };

  function ajax(opt) {
    var r20 = /%20/g;
    var xhr = (window.ActiveXObject) ? new ActiveXObject("Microsoft.XMLHTTP") : (XMLHttpRequest && new XMLHttpRequest()) || null;
    var resolve = function(data, textStatus, xhr) {
      if (opt.success  &&  typeof(opt.success) == 'function') {
        opt.success(data, xhr);
      }
    }
    var reject = function(xhr, textStatus, errorThrown) {
      if (opt.error  &&  typeof(opt.error) == 'function') {
        opt.error(xhr, textStatus, errorThrown);
      }
    }
    var callback = function(type) {
      if (opt.complete  &&  typeof(opt.complete) == 'function') {
        opt.complete(xhr, type);
      }
    }
    xhr.onerror = xhr.ontimeout = callback( "error" );
    xhr.onreadystatechange = function() {
      var isSuccess, success, error, statusText, 
          type,
          status = xhr.status;
      if (xhr.readyState === 4) {
        isSuccess = status >= 200 && status < 300 || status === 304;
        if (isSuccess) {
          // if no content
          if ( status === 204 || type === "HEAD" ) {
            statusText = "nocontent";
          } else if ( status === 304 ) {
            statusText = "notmodified";
          } else {
            statusText = xhr.statusText;
            success    = xhr.response;
            error      = xhr.error;
            isSuccess  = !error;
          }
        } else {
          // Extract error from statusText and normalize for non-aborts
          error = statusText;
          if ( status || !statusText ) {
            statusText = "error";
            if ( status < 0 ) {
              status = 0;
            }
          }
        }
        if (isSuccess) {
          resolve(success, statusText, xhr);
        } else {
          reject(xhr, statusText, error);
        }
      }
    }
    var contentType = null;
    var method  = opt.method || 'GET';
    var url     = opt.url  || location.href;
    var headers = opt.headers;
    if (headers && typeof(headers) === 'object') {
      for (name in headers) {
        xhr.setRequestHeader(name, headers[name]);
      }
      contentType = headers['Content-Type'];
    }
    var data    = opt.data || null;
    if (data && typeof(data) === 'object') {
      var kv = []
      for (name in data) {
        kv[kv.length] = encodeURIComponent(name) + '=' + encodeURIComponent( value == null ? "" : value );
      }
      data = kv.join('&');
      if (opt.processData && (contentType || '').indexOf('application/x-www-form-urlencoded') === 0) {
        data.replace( r20, '+')
      }
    }
    xhr.open(method.toUpperCase(), url, true);
    xhr.send(data);
  }

  function openAppWindow(url, width, height) {
    width  = width  || 567;
    height = height || 600;

    var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : window.screenX;
    var dualScreenTop  = window.screenTop  != undefined ? window.screenTop  : window.screenY;

    var parentWidth  = window.innerWidth  ? window.innerWidth  : document.documentElement.clientWidth  ? document.documentElement.clientWidth  : screen.width;
    var parentHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

    var left = ((parentWidth  / 2) - (width  / 2)) + dualScreenLeft;
    var top  = ((parentHeight / 2) - (height / 2)) + dualScreenTop;

    return window.open(url, "asLive", "width="+width.toString()+",height="+height.toString()+",top=" +top.toString()+ ",left="+left.toString());
  }

  // exports
  global.asLive = M;
  global.asLive.ajax = ajax;

})(window || this);

