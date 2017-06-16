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

const PADDING = 40
const COLORS = ['blue', 'red']

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
    this.draw()
  }

  path = (strokeStyle, cb) => {
    Object.assign(this._ctx, {strokeStyle})
    this._ctx.lineWidth = 1 / this.props.width
    this._ctx.beginPath()
    cb(this._ctx)
    this._ctx.stroke()
    this._ctx.closePath()
  }

  makeScale = key => scaleLinear().domain([
    min(this.props.rows.map(get(key))),
    max(this.props.rows.map(get(key))),
  ]).range([1, 0])

  zoomContext = cb => {
    this._ctx.save()
    this._ctx.translate(PADDING, PADDING)
    const {width, height} = this.props
    this._ctx.scale(width - PADDING * 2, height - PADDING * 2)
    cb()
    this._ctx.restore()
  }

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

    this.zoomContext(() => {
      if (row) {
        // Draw cursor
        this.path('white', c => {
          c.moveTo(xScale(row.ix), 0)
          c.lineTo(xScale(row.ix), 1)
        })
      }

      table.columns.slice(1).forEach(({key}, i) => {
        // Draw line
        const yScale = this.makeScale(key)
        const values = rows.map(get(key))
        const points = zip(indexes.map(xScale), values.map(yScale))
        this.path(
          COLORS[i],
          c => points.forEach(([x, y]) => c.lineTo(x, y)),
        )

        if (row) {
          // Draw horizontal line orthogonal to cursor
          this.path(COLORS[i], c => {
            c.moveTo(0, yScale(get(key, row))),
            c.lineTo(1, yScale(get(key, row)))
          })
        }
      })
    })
  }

  getContext = cvs => {
    this._cvs = cvs
    this._ctx = cvs.getContext('2d')
    const {width, height} = this.props

    const updateCursor = ({pageX, pageY}) => {
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
    toPairs({
      'mouseover': updateCursor,
      'mousemove': updateCursor,
      'mouseout': () => this.props.setCursor(null),
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
    const indexes = map('ix', props.rows)
    const indexRange = [min(indexes), max(indexes)]
    const [width, height] = [innerWidth, innerHeight]
    const xScale = scaleLinear().domain(indexRange).range([0, 1])
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
