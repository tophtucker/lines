import {withState, withProps} from 'recompose'
import {fromPairs, zip, zipWith, map, max, min, get, compose, sortedIndex, toPairs} from 'lodash/fp'
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
    const {ctx, pixel, aspectRatio, rows, indexes, row, xScale} = props

    if (row) {
      // Draw cursor
      ctx.lineWidth = 2 * pixel
      ctx.strokeStyle = 'white'
      ctx.beginPath()
      ctx.moveTo(xScale(row.ix), 0)
      ctx.lineTo(xScale(row.ix), 1000 * aspectRatio)
      ctx.stroke()
      ctx.closePath()
    }

    table.columns.slice(1).forEach(({key}, i) => {
      // Draw line
      const yScale = this.makeScale(key, 1000 * aspectRatio)
      const values = rows.map(get(key))
      const points = zip(indexes.map(xScale), values.map(yScale))
      ctx.strokeStyle = COLORS[i]
      ctx.lineWidth = 2 * pixel
      ctx.beginPath()
      points.forEach(([x, y]) => ctx.lineTo(x, y)),
      ctx.stroke()
      ctx.closePath()

      if (row) {
        // Draw horizontal line orthogonal to cursor
        ctx.strokeStyle = COLORS[i]
        ctx.lineWidth = 2 * pixel
        ctx.beginPath()
        ctx.moveTo(0, yScale(get(key, row))),
        ctx.lineTo(1000, yScale(get(key, row)))
        ctx.stroke()
        ctx.closePath()
      }
    })
  }

  updateCursor = ({pageX, pageY}) => {
    const {width, height} = this.props
    const inX = pageX >= PADDING && pageX <= width - PADDING
    const inY = pageY >= PADDING && pageY <= height - PADDING
    if (inX && inY) {
      this.props.setCursor({
        x: (pageX - PADDING) / (width - PADDING * 2) * 1000,
        y: (pageY - PADDING) / (height - PADDING * 2) * 1000,
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
        <View top={PADDING} left={PADDING} bottom={PADDING} right={PADDING}>
          <Thing {...this.props} render={this.draw} />
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
    const cursorDate = new Date(xScale.invert(cursor.x))
    const index = sortedIndex(cursorDate, indexes)
    return {row: rows[index]}
  }),
)(Lines)
