/*
   Copyright 2018-2021 Alex Tucker

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

let express = require('express');
let router = express.Router();
let sparql = require('sparql');
let fs = require('fs');
let path = require('path');

//var backupCodelists = require('./temp/codelists.json');
let dsDimsQuery = fs.readFileSync(path.resolve(__dirname, 'queries/dataset-dimensions.sparql')).toString();
let dimensionsQuery = fs.readFileSync(path.resolve(__dirname, 'queries/dimensions.sparql')).toString();

router.get('/', function(req, res, next) {
  if (req.originalUrl.slice(-1) !== '/') {
    res.redirect(301, req.originalUrl + '/');
  } else {
    res.render('family', {title: 'GSS Dataset Families'});
  }
});

router.get('/dsdims', function(req, res, next) {
  const client = new sparql.Client('https://staging.gss-data.org.uk/sparql');
  client.rows(dsDimsQuery, function(error, dsDimRows) {
    if (error) {
      res.render('error', {message: 'Error running SPARQL', error: error[1]});
    } else {
      let datasets = {};
      let dimensions = {};
      let supers = {};
      dsDimRows.forEach(function(dsDim) {
        const ds = dsDim.dataset.value;
        if (!datasets.hasOwnProperty(ds)) {
          datasets[ds] = {
            label: dsDim.datalabel.value,
            dimensions: [],
            themes: []
          };
        }
        datasets[ds].dimensions.push(dsDim.dimension.value);
        if (dsDim.hasOwnProperty('theme')) {
          datasets[ds].themes = [... new Set(datasets[ds].themes).add(dsDim.theme.value)];
        }
      });
      client.rows(dimensionsQuery, function(error, dimSuperRows) {
        dimSuperRows.forEach(function(dimSuper) {
          if (dimSuper.hasOwnProperty('label')) {
            dimensions[dimSuper.dimension.value] = dimSuper.label.value;
          } else {
            dimensions[dimSuper.dimension.value] = dimSuper.dimension.value;
          }
          if (dimSuper.hasOwnProperty('super')) {
            if (!supers.hasOwnProperty(dimSuper.dimension.value)) {
              supers[dimSuper.dimension.value] = [dimSuper.super.value];
            } else {
              supers[dimSuper.dimension.value].push(dimSuper.super.value);
            }
          }
        });
        res.json({datasets: datasets, dimensions: dimensions, supers: supers});
      });
    }
  });
});
/*
router.get('/dimcodes', function(req, res, next) {
  var client = new sparql.Client('https://staging.gss-data.org.uk/sparql');
  client.rows(dsCodesQuery, function(error, rows) {
    if (error) {
//      res.render('error', {message: 'Error running SPARQL', error: error[1]});
      res.json(backupCodelists);
    } else {
      var dimensions = {};
      var codelists = {};
      rows.forEach(function(row) {
        if (!dimensions.hasOwnProperty(row.dimension.value)) {
          dimensions[row.dimension.value] = {
            codelists: [row.codelist.value]
          };
        } else {
          dimensions[row.dimension.value].codelists.push(row.codelist.value);
        }
        codelists[row.codelist.value] = row.codelistlabel.value;
      });
      res.json({dimensions: dimensions, codelists: codelists});
    }
  });
}); */

module.exports = router;
