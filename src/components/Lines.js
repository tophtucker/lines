import {withState, withProps} from 'recompose'
import {fromPairs, zip, zipWith, map, max, min, get, compose, sortedIndex, toPairs} from 'lodash/fp'
import {Component} from 'react'
import cx from 'classnames'
import {timeParse, timeFormat} from 'd3-time-format'
import {scaleLinear} from 'd3-scale'

import * as table from '../data'

const fromYmd = timeParse('%Y-%m-%d')
const toYmd = timeFormat('%Y-%m-%d')
const parse = (unit, value) => {
  if (unit === 'date') return fromYmd(value)
  return parseFloat(value)
}
const COLORS = ['blue', 'red']

class Lines extends Component {
  componentWillMount() {
    const {data, columns} = table
    const rows = data.trim().split('\n').map(x => x.split(',')).map(xs =>
      fromPairs(zipWith(
        ({key, unit}, value) => [key, {raw: value, parsed: parse(unit, value)}],
        columns, xs,
      )),
    )
    this.props.setRows(rows)
    this.draw()
  }

  path = (strokeStyle, cb) => {
    Object.assign(this._ctx, {strokeStyle})
    this._ctx.beginPath()
    cb(this._ctx)
    this._ctx.stroke()
    this._ctx.closePath()
  }

  makeScale = key => scaleLinear().domain([
    min(this.props.rows.map(get([key, 'parsed']))),
    max(this.props.rows.map(get([key, 'parsed']))),
  ]).range([this.props.height, 0])

  draw = () => {
    requestAnimationFrame(this.draw)
    if (!this._ctx) return

    const ctx = this._ctx
    const {width, height, rows, indexes, row, xScale} = this.props

    // Reset frame
    if (this._cvs.width !== width || this._cvs.height !== height) {
      this._cvs.width = width
      this._cvs.height = height
    }
    ctx.clearRect(0, 0, width, height)

    if (row) {
      // Draw cursor
      const date = row.ix.parsed
      this.path('white', c => {
        c.moveTo(xScale(date), 0)
        c.lineTo(xScale(date), height)
      })
    }

    table.columns.slice(1).forEach(({key}, i) => {
      // Draw line
      const yScale = this.makeScale(key)
      const values = rows.map(get([key, 'parsed']))
      const points = zip(indexes.map(xScale), values.map(yScale))
      this.path(COLORS[i], c => points.forEach(([x, y]) => c.lineTo(x, y)))

      if (row) {
        // Draw horizontal line orthogonal to cursor
        const y = yScale(get([key, 'parsed'], row))
        this.path(COLORS[i], c => {
          c.moveTo(0, y)
          c.lineTo(width, y)
        })
      }
    })
  }

  getContext = cvs => {
    this._cvs = cvs
    this._ctx = cvs.getContext('2d')
    const updateCursor = ({pageX: x, pageY: y}) => this.props.setCursor({x, y})
    toPairs({
      'mouseover': updateCursor,
      'mousemove': updateCursor,
      'mouseout': this.props.setCursor(null),
    }).forEach(([evt, cb]) => cvs.addEventListener(evt, cb, false))
  }

  render() {
    return <canvas ref={this.getContext} />
  }
}

export default compose(
  withState('rows', 'setRows', []),
  withState('cursor', 'setCursor', null),
  withProps(props => {
    const [width, height] = [innerWidth, innerHeight]
    const indexes = map('ix.parsed', props.rows)
    const indexRange = [min(indexes), max(indexes)]
    const xScale = scaleLinear().domain(indexRange).range([0, width])
    return {width, height, xScale, indexes}
  }),
  withProps(props => {
    const {rows, xScale, width, height, cursor} = props
    if (!props.cursor) return {}
    const {x, y} = cursor
    const index = sortedIndex(toYmd(new Date(xScale.invert(x))), map('ix.raw', rows))
    return {row: rows[index]}
  }),
)(Lines)
