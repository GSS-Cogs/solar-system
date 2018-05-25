/*
   Copyright 2018 Alex Tucker

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
var sparql = require('sparql');
var fs = require('fs');
var path = require('path');

dsDimsQuery = fs.readFileSync(path.resolve(__dirname, 'queries/dataset-dimensions.sparql')).toString();
dsCodesQuery = fs.readFileSync(path.resolve(__dirname, 'queries/dataset-codelist.sparql')).toString();

router.get('/', function(req, res, next) {
  if (req.originalUrl.slice(-1) != '/') {
    res.redirect(301, req.originalUrl + '/');
  } else {
    res.render('family', {title: 'GSS Dataset Families'});
  }
});

router.get('/dsdims', function(req, res, next) {
  var client = new sparql.Client('https://production-drafter-ons-alpha.publishmydata.com/v1/sparql/live');
  client.rows(dsDimsQuery, function(error, rows) {
    if (error) {
      res.render('error', {message: 'Error running SPARQL', error: error[1]});
    } else {
      var datasets = {};
      var dimensions = {};
      rows.forEach(function(row) {
        if (!datasets.hasOwnProperty(row.dataset.value)) {
          datasets[row.dataset.value] = {
            label: row.datalabel.value,
            dimensions: [row.dimension.value],
            family: 'Trade'
          };
        } else {
          datasets[row.dataset.value].dimensions.push(row.dimension.value);
        }
        dimensions[row.dimension.value] = row.dimlabel.value;
      });
      res.json({datasets: datasets, dimensions: dimensions});
    }
  });
});

router.get('/dscodes', function(req, res, next) {
  var client = new sparql.Client('https://production-drafter-ons-alpha.publishmydata.com/v1/sparql/live');
  client.rows(dsCodesQuery, function(error, rows) {
    if (error) {
      res.render('error', {message: 'Error running SPARQL', error: error[1]});
    } else {
      var datasets = {};
      var codelists = {};
      rows.forEach(function(row) {
        if (!datasets.hasOwnProperty(row.dataset.value)) {
          datasets[row.dataset.value] = {
            codelists: [row.codelist.value]
          };
        } else {
          datasets[row.dataset.value].codelists.push(row.codelist.value);
        }
        codelists[row.codelist.value] = row.codelistlabel.value;
      });
      res.json({datasets: datasets, codelists: codelists});
    }
  });
});

module.exports = router;
