/*
   Copyright 2017 Alex Tucker

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var basicAuth = require('basic-auth');
var proxy = require('http-proxy-middleware');
var urlparse = require('url');

var topicvis = require('./routes/topicvis');
var fdpvis = require('./routes/fdpvis');
var familyvis = require('./routes/familyvis');

/* var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Visual reports');
    return res.send(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === '<<someuser>>' && user.pass === '<<somepassword>>') {
    return next();
  } else {
    return unauthorized(res);
  };
}; */

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('strict routing', true);

// make client side JS libraries available
app.use('/d3',
        express.static(path.resolve(require.resolve('d3'), '..')));
app.use('/d3-textwrap',
        express.static(path.resolve(require.resolve('d3-textwrap'), '..')));
app.use('/bootstrap',
        express.static(path.resolve(require.resolve('bootstrap'), '../..')));
app.use('/file-saver',
        express.static(path.resolve(require.resolve('file-saver'), '..')));

app.get('/topics', function(req, res) {
  res.redirect(301, '/gss/');
});
app.use('/gss/', topicvis);
app.get('/fdp', function(req, res) {
  res.redirect(301, '/ons/');
});
app.use('/ons/', fdpvis);
app.use('/family/', familyvis)
app.get('/', function(req, res) {
  res.render('index', {title: 'Solar System of Statistics'});
});

// Forward D2R paths
var fullPath = function(req) { return urlparse.parse(req.originalUrl).path; };
app.use(['/sparql', '/snorql/', '/dataset', '/all', '/directory/', '/resource/', '/page/'],
        proxy({target: 'http://d2r:2020'}));
/*          proxy('d2r:2020', {
           https: false,
           forwardPath: fullPath,
           parseReqBody: false
         })); */

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
