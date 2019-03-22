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

var chart = document.getElementById("chart");
var svg = d3.select(chart).append("svg");
var radius = 20;

var svgCss = ".links line {\
  stroke: #999;\
  stroke-opacity: 0.5;\
}\
\
.nodes circle {\
  stroke: #fff;\
  stroke-width: 1.5px;\
}\
\
.topics text {\
  color: #999;\
  font-size: x-small;\
  fill-opacity: 0.5;\
}\
\
text.dataset {\
  font-size: small;\
}\
text.dimension {\
  color: #bada55;\
  font-size: smaller;\
}\
\
.codelist {\
  fill: #5555da;\
}\
";

svg.attr("title", "Solar System")
  .attr("version", 1.1)
  .attr("xmlns", "http://www.w3.org/2000/svg")
  .append("style").text(svgCss);

var width, height;

function redraw() {
  width = chart.clientWidth;
  height = chart.clientHeight;
  svg
    .attr("width", width)
    .attr("height", height);
}

redraw();

window.addEventListener("resize", redraw);

var color = d3.scaleOrdinal(d3.schemeDark2);

var forceManyBodySubset = d3.forceManyBody();
var forceManyBodyInitialize = forceManyBodySubset.initialize;
forceManyBodySubset.initialize = function (nodes) {
  forceManyBodyInitialize(nodes.filter(function (n, i) {
    return n.type === 'dimension';
  }));
};

var simulation = d3.forceSimulation()
  .force("link", d3.forceLink().id(function (d) {
    return d.id;
  }))
  .force("charge", d3.forceManyBody().strength(-100))
  .force("collide", d3.forceCollide(20))
  .force("center", d3.forceCenter(width / 2, height / 2));

var tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

var nodes = [];
var links = [];
var dimensions = d3.set();
var contexts = d3.set();
var elementId = 1;

d3.json('dsdims').then(function (dsdims) {
  for (dataset in dsdims.datasets) {
    nodes.push({
      id: dataset,
      label: dsdims.datasets[dataset].label,
      context: dsdims.datasets[dataset].family,
      type: 'dataset',
      elementId: 'node' + elementId++
    });
    dsdims.datasets[dataset].dimensions.forEach(function (dimension) {
      dimensions.add(dimension);
      links.push({
        source: dataset,
        target: dimension,
        distance: 150
      });
    });
    contexts.add(dsdims.datasets[dataset].family);
  }

  for (dimension in dsdims.dimensions) {
    nodes.push({
      id: dimension,
      label: dsdims.dimensions[dimension],
      type: 'dimension',
      elementId: 'node' + elementId++
    });
  }

  d3.json('dimcodes').then(function (dimcodes) {
    for (dimension in dimcodes.dimensions) {
      dimcodes.dimensions[dimension].codelists.forEach(function (codelist) {
        links.push({
          source: dimension, target: codelist, distance: 30
        });
      });
    }
    for (codelist in dimcodes.codelists) {
      nodes.push({
        id: codelist,
        label: dimcodes.codelists[codelist],
        type: 'codelist',
        elementId: 'node' + elementId++
      });
    }

    var svgLegend = svg.append("g")
      .attr("class", "legend")
      .attr('x', 0)
      .attr('y', 0)
      .selectAll(".category")
      .data(contexts.values().sort().map(function (c) {
        return {id: c};
      }))
      .enter().append('g')
      .attr('class', 'category')

    svgLegend.append('rect')
      .attr('x', 10)
      .attr('y', function (d, i) {
        return 30 + i * 15;
      })
      .attr('height', 12)
      .attr('width', 12)
      .attr("fill", function (d) {
        return color(d.id);
      });

    svgLegend.append('text')
      .attr('x', 30)
      .attr('y', function (d, i) {
        return 40 + i * 15;
      })
      .text(function (d) {
        return d.id;
      });

    var svgLinks = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter().append("line");

    var svgAllNodes = svg.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g").attr("id", function(n) {return n.elementId;})
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    var svgConceptNodes = svgAllNodes.filter(function(n) { return n.type == 'codelist'; })
      .append("rect")
      .attr("class", "concept").attr("x", -25).attr("y", -10)
      .attr("width", 60).attr("height", 14)
      .attr("fill", "#ffffdd")
      .attr("stroke", "#555555")
      .each(function(n) {
        new d3plus.TextBox()
          .data([{
            "text": n.label,
            "height": 12,
            "width": 58,
            "x": -29, "y": -6,
            "id": "concept" + n.elementId
          }])
          .select("#" + n.elementId)
          .verticalAlign("middle")
          .textAnchor("middle")
          .render()
      });

    var svgDatasetNodes = svgAllNodes.filter(function(n) { return n.type == 'dataset'; })
      .append("rect")
      .attr("class", "dataset").attr("x", -50).attr("y", -20)
      .attr("width", 100).attr("height", 40).attr("rx", 10).attr("ry", 10)
      .attr("fill", function (n) { return color(n.context); })
      .attr("stroke", "#555555")
      .each(function(n) {
        new d3plus.TextBox()
          .data([{
            "text": n.label,
            "height": 36,
            "width": 80,
            "x": -40, "y": -18,
            "id": "dataset" + n.elementId
          }])
          .select("#" + n.elementId)
          .verticalAlign("middle")
          .textAnchor("middle")
          .render()
      });

    var svgDimensionNodes = svgAllNodes.filter(function(n) { return n.type == 'dimension'; })
      .append("ellipse")
      .attr("class", "dimension").attr("x", -25).attr("y", -10)
      .attr("cx", 0).attr("cy", 0).attr("rx", 30).attr("ry", 15)
      .attr("fill", "white")
      .attr("stroke", "#555555")
      .each(function (n) {
        new d3plus.TextBox()
          .data([{
            "text": n.label,
            "height": 28,
            "width": 58,
            "x": -29, "y": -14,
            "id": "dimension" + n.elementId
          }])
          .select("#" + n.elementId)
          .verticalAlign("middle")
          .textAnchor("middle")
          .render()
      });

    simulation
      .nodes(nodes)
      .on("tick", ticked);

    simulation
      .force("link")
      .distance(function(d){return d.distance;})
      .links(links);

    function ticked() {
      svgLinks
        .attr("x1", function (d) { return d.source.x; })
        .attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; })
        .attr("y2", function (d) { return d.target.y; });
      svgAllNodes
        .attr("transform", function(d) { return "translate(" + Math.max(50, Math.min(width - 50, d.x))
          + "," + Math.max(40, Math.min(height - 40, d.y)) + ")"; })
    }
  });
});

function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

d3.select('#generate').on('click', downloadSVG);

function downloadSVG() {
  var svg = d3.select("svg")
    .attr("title", "Solar System")
    .attr("version", 1.1)
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .node().parentNode.innerHTML;
  var blob = new Blob([svg], {type: "image/svg+xml"});
  saveAs(blob, "ons-solar-system.svg");
}
