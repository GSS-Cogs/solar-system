/*
   Copyright 2017-2021 Alex Tucker

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

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const urlparse = require('url');

const topicvis = require('./routes/topicvis');
const fdpvis = require('./routes/fdpvis');
const familyvis = require('./routes/familyvis');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('strict routing', true);

// make client side JS libraries available
app.use('/lib',
        express.static(path.resolve(require.resolve('d3'), '..')));
app.use('/lib',
  express.static(path.resolve(require.resolve('d3-scale-chromatic'), '..')));
app.use('/lib',
        express.static(path.resolve(require.resolve('d3-textwrap'), '..')));
app.use('/lib',
  express.static(path.resolve(require.resolve('d3plus-common'), '..')));
app.use('/lib',
  express.static(path.resolve(require.resolve('d3plus-text'), '..')));
app.use('/bootstrap',
        express.static(path.resolve(require.resolve('bootstrap'), '../..')));
app.use('/lib',
        express.static(path.resolve(require.resolve('file-saver'), '..')));
app.use('/lib',
  express.static(path.resolve(require.resolve('respond.js/dest/respond.src.js'), '..')));
app.use('/lib',
  express.static(path.resolve(require.resolve('html5shiv'), '..')));
app.use('/lib',
  express.static(path.resolve(require.resolve('jquery'), '..')));

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
const fullPath = function(req) { return urlparse.parse(req.originalUrl).path; };
app.use(['/sparql', '/snorql/', '/dataset', '/all', '/directory/', '/resource/', '/page/'],
        createProxyMiddleware('http://d2r:2020'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
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
