import {withState, withProps} from 'recompose'
import {fromPairs, zip, zipWith, map, max, min, get, compose, sortedIndex, toPairs, last} from 'lodash/fp'
import {Component} from 'react'
import cx from 'classnames'
import {timeParse, timeFormat} from 'd3-time-format'
import {scaleLinear} from 'd3-scale'

import * as table from '../data'
import {Scene, View, Thing} from './scenic'

const fromYmd = timeParse('%Y-%m-%d')
const toYmd = timeFormat('%Y-%m-%d')
const parse = (unit, value) => {
  if (unit === 'date') return fromYmd(value)
  return parseFloat(value)
}

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

class Lines extends Component {
  componentWillMount() {
    const {data, columns} = table
    const rows = data.trim().split('\n').map(x => x.split(',')).map(xs =>
      fromPairs(zipWith(
        ({key, unit}, value) => [key, parse(unit, value)],
        columns, xs,
      )),
    )
    this.props.setRows(rows)
  }

  makeScale = (key, yMax) => scaleLinear().domain([
    min(this.props.rows.map(get(key))),
    max(this.props.rows.map(get(key))),
  ]).range([yMax, 0])

  draw = props => {
    const {ctx, pixel, aspectRatio, rows, indexes, row, xScale, cursor} = props

    table.columns.slice(1).forEach(({key}, i) => {
      // Draw line
      const yScale = this.makeScale(key, 1000 * aspectRatio)
      const values = rows.map(get(key))
      const points = zip(indexes.map(xScale), values.map(yScale))
      ctx.strokeStyle = COLORS[i]
      ctx.lineWidth = 4 * pixel
      ctx.beginPath()
      points.forEach(([x, y]) => ctx.lineTo(x, y)),
      ctx.stroke()
      ctx.closePath()

      if (row) {
        ctx.setLineDash([5 * pixel, 4 * pixel])
        ctx.lineWidth = 1 * pixel
        ctx.beginPath()
        ctx.moveTo(xScale(row.ix), yScale(get(key, row)))
        ctx.lineTo(1000, yScale(get(key, row)))
        ctx.stroke()
        ctx.closePath()
        ctx.setLineDash([])
      }
    })

    // Draw cursor
    const markedRow = row || rows[0]
    ctx.lineWidth = 2 * pixel
    ctx.setLineDash([5 * pixel, 4 * pixel])
    ctx.strokeStyle = 'lightgray'
    ctx.beginPath()
    ctx.moveTo(xScale(markedRow.ix), 0)
    const y = cursor ? 1000 * aspectRatio * cursor.y : 1000 * aspectRatio
    ctx.lineTo(xScale(markedRow.ix), 1000 * aspectRatio)
    ctx.moveTo(xScale(markedRow.ix), y)
    ctx.lineTo(1000, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.closePath()

    ctx.beginPath()
    ctx.fillStyle = '#19191a'
    ctx.strokeStyle = 'lightgray'
    ctx.lineWidth = 2 * pixel
    ctx.arc(xScale(markedRow.ix), y, pixel * 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.closePath()
  }

  drawLabels = props => {
    const {ctx, pixel, aspectRatio, rows, indexes, row, xScale, cursor} = props

    table.columns.slice(1).forEach(({key}, i) => {
      const yScale = this.makeScale(key, 1000 * aspectRatio)
      const x = 1000
      if (row) {
        const y = yScale(get(key, row))
        const label = get(key, row).toFixed(2)
        ctx.beginPath()
        ctx.fillStyle = COLORS[i]
        ctx.textBaseline = 'middle'
        ctx.fontStyle = `${14 * pixel}px Futura`
        ctx.fillRect(x - ctx.measureText(label).width - 10 * pixel, y - 10 * pixel, ctx.measureText(label).width + 10 * pixel, 20 * pixel)
        ctx.fillStyle = 'white'
        ctx.fillText(label, x - ctx.measureText(label).width - 5 * pixel, y)
        ctx.closePath()
      }

      const finalY = yScale(get(key, last(rows)))
      const finalLabel = get(key, last(rows)).toFixed(2)
      ctx.beginPath()
      ctx.fillStyle = COLORS[i]
      ctx.textBaseline = 'middle'
      ctx.fontStyle = `${14 * pixel}px Futura`
      ctx.fillRect(x - ctx.measureText(finalLabel).width - 10 * pixel, finalY - 10 * pixel, ctx.measureText(finalLabel).width + 10 * pixel, 20 * pixel)
      ctx.fillStyle = 'white'
      ctx.fillText(finalLabel, x - ctx.measureText(finalLabel).width - 5 * pixel, finalY)
      ctx.closePath()
    })
  }

  updateCursor = ({pageX, pageY}) => {
    const {width, height} = this.props
    const inX = pageX >= PADDING && pageX <= width - PADDING
    const inY = pageY >= PADDING && pageY <= height - PADDING
    if (inX && inY) {
      this.props.setCursor({
        x: (pageX - PADDING) / (width - PADDING * 2),
        y: (pageY - PADDING) / (height - PADDING * 2),
      })
    } else {
      this.props.setCursor(null)
    }
  }

  render() {
    return (
      <Scene
        listeners={{
          'mouseover': this.updateCursor,
          'mousemove': this.updateCursor,
          'mouseout': () => this.props.setCursor(null),
        }}
      >
        <View>
          <View top={PADDING} left={PADDING} right={PADDING} bottom={PADDING}>
            <Thing {...this.props} render={this.draw} />
          </View>
          <View top={PADDING} bottom={PADDING}>
            <Thing {...this.props} render={this.drawLabels} />
          </View>
        </View>
      </Scene>
    )
  }
}

export default compose(
  withState('rows', 'setRows', []),
  withState('cursor', 'setCursor', null),
  withProps(props => {
    const indexes = map('ix', props.rows)
    const indexRange = [min(indexes), max(indexes)]
    const [width, height] = [innerWidth, innerHeight]
    const xScale = scaleLinear().domain(indexRange).range([0, 1000])
    return {width, height, xScale, indexes}
  }),
  withProps(props => {
    const {rows, xScale, width, height, cursor, indexes} = props
    if (!cursor) return {}
    const cursorDate = new Date(xScale.invert(cursor.x * 1000))
    const index = sortedIndex(cursorDate, indexes)
    return {row: rows[index]}
  }),
)(Lines)
