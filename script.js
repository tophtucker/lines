const toYmd = d3.timeFormat('%Y-%m-%d')
const PADDING = 40
const COLORS = [
  '#5CB8E6',
  '#CF5CE6',
  '#7961F2',
  '#E65C73',
  '#e5b85c',
  '#78e65c',

  '#91D2F2',
  '#E291F2',
  '#A090F1',
  '#F291A1',
  '#f2d391',
  '#a5f291',

  '#3D7B99',
  '#8A3D99',
  '#5747A7',
  '#993D4D',
  '#997b3d',
  '#50993d',
]

const svg = d3.select("svg")
  .call(load)

window.addEventListener("resize", () => svg.call(render));

async function load(sel) {
  var data = await fetch('data.csv')
    .then(d => d.text())
    .then(d => d3.transpose(d3.csvParse(d, d => [
      [new Date(d.date), +d.aapl],
      [new Date(d.date), +d.amzn]
    ])))

  sel
    .datum(data)
    .call(render)
}

function render(selection) {
  selection.each(function(data, index) {

    console.log("resize")

    const sel = d3.select(this),
        bb = this.getBoundingClientRect(),
        width = bb.width - 2 * PADDING,
        height = bb.height - 2 * PADDING,
        x = d3.scaleTime()
          .domain(d3.extent(d3.merge(data).map(d => d[0])))
          .range([0, width]),
        y = d3.scaleLinear()
          .domain(d3.extent(d3.merge(data).map(d => d[1])))
          .range([height, 0]),
        line = d3.line()
          .x(d => x(d[0]))
          .y(d => y(d[1]))

    var g = sel.selectAll("g").data([data])
    var gEnter = g.enter()
      .append("g")
      .attr("transform", `translate(${PADDING}, ${PADDING})`)

    gEnter.append("g").attr("class", "lines")

    var cursorEnter = gEnter.append("g").attr("class", "cursor")
    cursorEnter.append("line")
      .attr("class", "cursor-x")
      .attr("y1", 0)
    cursorEnter.append("line")
      .attr("class", "cursor-y")
      .attr("x1", 0)
    cursorEnter.append("circle")
      .attr("class", "cursor-point")
      .attr("r", 5)
    cursorEnter.append("g")
      .attr("class", "crosshairs")

    gEnter.append("g").attr("class", "labels")
      .datum(data.map(d => d[d.length-1][1]))
      .call(renderLabels)
    gEnter.append("g").attr("class", "labels-hover")
    gEnter.append("rect").attr("class", "click-capture")

    g = g.merge(gEnter)

    g.select(".labels")
      .attr("transform", `translate(${width+PADDING*.2}, 0)`)
    g.select(".labels-hover")
      .attr("transform", `translate(${width+PADDING*.2}, 0)`)

    g.select(".click-capture")
      .attr("width", width)
      .attr("height", height)
    g.select(".cursor-x")
      .attr("y2", height)
    g.select(".cursor-y")
      .attr("x2", width)

    var path = g.select(".lines").selectAll("path")
      .data(data)
    path = path.merge(path.enter()
      .append("path")
      .attr("class", "line"))
      .attr("d", line)
      .style("stroke", (d,i) => COLORS[i])

    var crosshair = g.select(".cursor").select(".crosshairs").selectAll("line")
      .data(data)
    crosshair = crosshair.merge(crosshair.enter()
      .append("line")
      .attr("class", "crosshair"))
      .style("stroke", (d,i) => COLORS[i])
      .attr("x2", width)



    g.on("mousemove", function(d) {
      var pt = d3.mouse(this)

      g.select(".cursor-point")
        .attr("cx", pt[0])
        .attr("cy", pt[1])
      g.select(".cursor-x")
        .attr("x1", pt[0])
        .attr("x2", pt[0])
      g.select(".cursor-y")
        .attr("x1", pt[0])
        .attr("y1", pt[1])
        .attr("y2", pt[1])

      var hoverLabels = []
      crosshair
        .attr("x1", pt[0])
        .each(function(d,i) {
          var y0 = y(d[d3.bisect(d.map(d => d[0]), x.invert(pt[0]))][1])
          hoverLabels.push(y.invert(y0))
          d3.select(this)
            .attr("y1", y0)
            .attr("y2", y0)
        })

      g.select(".labels-hover")
        .datum(hoverLabels)
        .call(renderLabels)
    })

    function renderLabels(selection) {
      selection.each(function(data, index) {
        var labels = d3.select(this)
          .selectAll(".label")
          .data(data)

        var labelsEnter = labels.enter()
          .append("g")
          .attr("class", "label")
        labelsEnter.append("rect")
          .attr("width", PADDING)
          .attr("height", PADDING/2)
        labelsEnter.append("text")
          .style("fill", "white")
          .attr("dy", "1.2em")
          .attr("dx", ".25em")
        labels = labels.merge(labelsEnter)
          .attr("transform", d => `translate(0,${y(d) - PADDING/4})`)
        labels.select("rect")
          .style("fill", (d,i) => COLORS[i])
        labels.select("text")
          .text(d => d.toFixed(2))
      })
    }

  })
}
