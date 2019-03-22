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

var chart = document.getElementById("chart");
var svg = d3.select(chart).append("svg");
var radius = 4;

var svgCss = ".links line {\
  stroke: #999;\
  stroke-opacity: 0.1;\
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
forceManyBodySubset.initialize = function(nodes) {
  forceManyBodyInitialize(nodes.filter(function(n, i) {
    return n.type === 'topic';
  }));
}

var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function(d) { return d.id; }).distance(16))
    .force("charge", forceManyBodySubset)
    .force("collide", d3.forceCollide(4))
    .force("center", d3.forceCenter(width / 2, height / 2));

var tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

var nodes = [];
var links = [];
var topics = d3.set();
var contexts = d3.set();

d3.json('datasets').then(function(datasets) {
  for (dataset in datasets) {
    nodes.push({
      id: dataset,
      name: datasets[dataset].name,
      context: datasets[dataset].context,
      type: 'dataset'
    });
    datasets[dataset].topics.forEach(function(topic) {
      topics.add(topic);
      links.push({
        source: dataset,
        target: topic
      });
    });
    contexts.add(datasets[dataset].context);
  }

  d3.json('labels').then( function(labels) {
    topics.each(function(topic) {
      nodes.push({
        id: topic,
        type: 'topic',
        label: labels[topic]
      });
    });

    var svgLegend = svg.append("g")
        .attr("class", "legend")
        .attr('x', 0)
        .attr('y', 0)
        .selectAll(".category")
        .data(contexts.values().sort().map(function(c) {return {id: c};}))
        .enter().append('g')
        .attr('class', 'category')

    svgLegend.append('rect')
      .attr('x', 10)
      .attr('y', function(d, i) { return 30 + i * 15; })
      .attr('height', 12)
      .attr('width', 12)
      .attr("fill", function(d) { return color(d.id); });
    //      .attr("stroke", function(d) { return color(d.id).darker(0.3); })

    svgLegend.append('text')
      .attr('x', 30)
      .attr('y', function(d, i) { return 40 + i * 15; })
      .text(function(d) { return d.id; });

    var svgNodes = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes.filter(function(n, i) {
          return n.type !== 'topic';
        }))
        .enter().append("circle")
        .attr("r", 3)
        .attr("fill", function(n) { return color(n.context); })
        .on("mouseover", function(d) {
          tooltip.transition()
            .duration(200)
            .style("opacity", .9);
          tooltip.html(d.name)
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
          tooltip.transition()
            .duration(500)
            .style("opacity", 0);
        })
        .call(d3.drag()
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended));

    var svgLinks = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter().append("line");

    var svgTopics = svg.append("g")
        .attr("class", "topics")
        .selectAll("text")
        .data(nodes.filter(function(n, i) {return n.type === 'topic';}))
        .enter().append("text").text(function(n) {return n.label;})

    var wrap = d3.textwrap()
        .bounds({height: 40, width: 80})
        .method('tspans');
    d3.selectAll('.topics text').call(wrap);

    simulation
      .nodes(nodes)
      .on("tick", ticked);

    simulation
      .force("link")
      .links(links);

    function ticked() {
      svgLinks
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

      svgNodes
        .attr("cx", function(d) {return d.x = Math.max(radius, Math.min(width - radius, d.x))})
        .attr("cy", function(d) {return d.y = Math.max(radius, Math.min(height - radius, d.y));});

      svgTopics
        .attr("x", function(d) {return d.x = Math.max(radius, Math.min(width - radius, d.x))})
        .attr("y", function(d) {return d.y = Math.max(radius, Math.min(height - radius, d.y));});
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
};
