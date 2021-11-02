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

const chart = document.getElementById("chart");
const svg = d3.select(chart).append("svg");
const radius = 20;

const svgDoc = svg.attr("title", "Solar System")
    .attr("version", 1.1)
    .attr("xmlns", "http://www.w3.org/2000/svg");

d3.text("/stylesheets/family.css").then(function (svgCss) {
    svgDoc
        .append("style").text(svgCss);
});

let width, height;

function redraw() {
    width = chart.clientWidth;
    height = chart.clientHeight;
    svg
        .attr("width", width)
        .attr("height", height);
}

redraw();

window.addEventListener("resize", redraw);

const color = d3.scaleOrdinal(d3.schemeDark2);

const forceManyBodySubset = d3.forceManyBody().strength(-100);
const forceManyBodyInitialize = forceManyBodySubset.initialize;
forceManyBodySubset.initialize = function (nodes) {
    forceManyBodyInitialize(nodes.filter(function (n, i) {
        return n.type === 'dataset';
    }));
};

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function (d) {return d.id;}))
    .force("charge", d3.forceManyBody().strength(-30))
    .force("collide", d3.forceCollide(20))
    .force("center", d3.forceCenter(width / 2, height / 2));

const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

const nodes = [];
const links = [];
const dimensions = d3.set();
const datasets = d3.set();
const contexts = d3.set();
let elementId = 1;

d3.json('dsdims').then(function (dsdims) {
    for (let dimension in dsdims.dimensions) {
        dimensions.add(dimension);
        nodes.push({
            id: dimension,
            label: dsdims.dimensions[dimension],
            type: 'dimension',
            super: false,
            elementId: 'node' + elementId++
        });
    }
    for (let dataset in dsdims.datasets) {
        nodes.push({
            id: dataset,
            label: dsdims.datasets[dataset].label,
            context: dsdims.datasets[dataset].theme,
            type: 'dataset',
            elementId: 'node' + elementId++
        });
        datasets.add(dataset);
        dsdims.datasets[dataset].dimensions.forEach(function (dimension) {
            if (!dimensions.has(dimension)) {
                console.error("Missing dim: <" + dimension + '>');
            } else {
                links.push({
                    source: dataset,
                    target: dimension,
                    distance: 25
                });
            }
        });
        contexts.add(dsdims.datasets[dataset].theme);
    }
    for (let dimension in dsdims.supers) {
        dsdims.supers[dimension].forEach(function(sup) {
            if (dimensions.has(sup)) {
                let dimNode = nodes.find(function(n) {return n.id === sup;});
                if (dimNode) {
                    dimNode['super'] = true
                }
                links.push({
                    source: dimension, target: sup, distance: 200
                });
            } else {
                console.error('Invalid super dimension: <' + sup + '>');
            }
        });
    }

    const svgLegend = svg.append("g")
        .attr("class", "legend")
        .attr('x', 0)
        .attr('y', 0)
        .selectAll(".category")
        .data(contexts.values().sort().map(function (c) {
            return {id: c};
        }))
        .enter().append('g')
        .attr('class', 'category');

    svgLegend.append('rect')
        .attr('x', 10)
        .attr('y', function (d, i) {
            return 30 + i * 15;
        })
        .attr('height', 10)
        .attr('width', 14)
        .attr("rx", 2).attr("ry", 2)
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

    const svgDimensionLegend = svg.selectAll('.legend')
        .append('g').attr('class', 'category')
        .append('ellipse').attr('class', 'dimension')
        .attr('cx', 17).attr('cy', 40 + contexts.size() * 15).attr('rx', 7).attr('ry', 5)
        .append('text').attr('x', 30).attr('y', 45 + contexts.size() * 15).text('Dimension')

    const svgConceptLegend = svg.selectAll('.legend')
        .append('g').attr('class', 'category')
        .append('rect').attr('class', 'concept')
        .attr('x', 10).attr('y', 50 + contexts.size() * 15)
        .attr('width', 14).attr('height', 10)
        .append('text').attr('x', 30).attr('y', 60 + contexts.size() * 15).text('Codelist')

    const svgLinks = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter().append("line");

    const svgAllNodes = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .enter().append("g").attr("id", function (n) {
            return n.elementId;
        })
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    const svgDatasetNodes = svgAllNodes.filter(function (n) {return n.type === 'dataset';})
        .append("rect")
        .attr("class", "dataset").attr("x", -50).attr("y", -20)
        .attr("width", 100).attr("height", 40).attr("rx", 10).attr("ry", 10)
        .attr("fill", function (n) {
            return color(n.context);
        })
        .attr("stroke", "#555555")
        .each(function (n) {
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

    const svgDimensionNodes = svgAllNodes.filter(function (n) {return n.type === 'dimension';})
        .append("ellipse")
        .attr("class", "dimension").attr("x", -25).attr("y", -10)
        .attr("cx", 0).attr("cy", 0).attr("rx", 30).attr("ry", 15)
        .attr("fill", function(n) {if (n.super) {return "#ffffdd";} else {return "#ddffff";}})
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
    svgAllNodes.filter(function (n) {return (n.type === 'dimension') && n.super;})
        .raise();

    simulation
        .nodes(nodes)
        .on("tick", ticked);

    simulation
        .force("link")
        .distance(function (d) {return d.distance;})
        .links(links);

    function ticked() {
        svgLinks
            .attr("x1", function (d) {
                return d.source.x;
            })
            .attr("y1", function (d) {
                return d.source.y;
            })
            .attr("x2", function (d) {
                return d.target.x;
            })
            .attr("y2", function (d) {
                return d.target.y;
            });
        svgAllNodes
            .attr("transform", function (d) {
                return "translate(" + Math.max(50, Math.min(width - 50, d.x))
                    + "," + Math.max(40, Math.min(height - 40, d.y)) + ")";
            })
    }
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
    const svg = d3.select("svg")
        .attr("title", "Solar System")
        .attr("version", 1.1)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .node().parentNode.innerHTML;
    const blob = new Blob([svg], {type: "image/svg+xml"});
    saveAs(blob, "ons-solar-system.svg");
}
