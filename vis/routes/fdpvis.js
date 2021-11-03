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

var express = require('express');
var router = express.Router();
var datasets = require('../data/WDAfloopscrape.json');
var labels = require('../data/labels.json');

router.get('/', function(req, res, next) {
  if (req.originalUrl.slice(-1) != '/') {
    res.redirect(301, req.originalUrl + '/');
  } else {
    res.render('ons', {title: 'Office for National Statistics datasets'});
  }
});

router.get('/datasets', function(req, res, next) {
  res.json(datasets);
});

router.get('/labels', function(req, res, next) {
  res.json(labels);
});

module.exports = router;
