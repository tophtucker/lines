import {withState, withProps} from 'recompose'
import {fromPairs, zipWith, map, max, min, get, compose, keyBy, sortedIndex, zip} from 'lodash/fp'
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

  path = (opts, cb) => {
    Object.assign(this._ctx, opts)
    this._ctx.beginPath()
    cb(this._ctx)
    if (opts.strokeStyle) {
      this._ctx.stroke()
    }
    this._ctx.closePath()
  }

  draw = () => {
    if (this._ctx) {
      const ctx = this._ctx
      const {width, height, rows, row} = this.props
      if (this._cvs.width !== width || this._cvs.height !== height) {
        this._cvs.width = width
        this._cvs.height = height
      }
      ctx.clearRect(0, 0, width, height)

      const xScale = scaleLinear().domain([
        min(map('ix.parsed', rows)), max(map('ix.parsed', rows)),
      ]).range([0, width])
      const makeScale = key => scaleLinear().domain([
        min(map(get([key, 'parsed']), rows)), max(map(get([key, 'parsed']), rows)),
      ]).range([height, 0])

      const rowLookup = keyBy('ix.raw', rows)
      const lines = table.columns.slice(1).map(({key}) => {
        const yScale = makeScale(key)
        return rows.map(row => [xScale(row.ix.parsed), yScale(get([key, 'parsed'], row))])
      })

      if (row) {
        const date = row.ix.parsed
        this.path({strokeStyle: 'white'}, c => {
          c.moveTo(xScale(date), 0)
          c.lineTo(xScale(date), height)
        })
      }

      const colors = ['blue', 'red']
      zip(lines, table.columns.slice(1)).forEach(([points, {key}], i) => {
        this.path({strokeStyle: colors[i]}, c => {
          points.forEach(([x, y]) => c.lineTo(x, y))
        })
        if (row) {
          const yScale = makeScale(key)
          const y = yScale(get([key, 'parsed'], row))
          this.path({strokeStyle: colors[i]}, c => {
            c.moveTo(0, y)
            c.lineTo(width, y)
          })
        }
      })
    }
    requestAnimationFrame(() => this.draw())
  }

  getContext = cvs => {
    this._cvs = cvs
    this._ctx = cvs.getContext('2d');
    cvs.addEventListener('mouseover', ({pageX: x, pageY: y}) => {
      this.props.setCursor({x, y})
    }, false)
    cvs.addEventListener('mousemove', ({pageX: x, pageY: y}) => {
      this.props.setCursor({x, y})
    }, false)
    cvs.addEventListener('mouseout', () => {
      this.props.setCursor(null)
    }, false)
  }

  render() {
    return (
      <canvas ref={this.getContext} />
    )
  }
}

export default compose(
  withState('rows', 'setRows', []),
  withState('cursor', 'setCursor', null),
  withProps(props => {
    const [width, height] = [innerWidth, innerHeight]
    const rows = props.rows
    const xScale = scaleLinear().domain([
      min(map('ix.parsed', rows)), max(map('ix.parsed', rows)),
    ]).range([0, width])
    if (!props.cursor) return {width, height}

    const {x, y} = props.cursor
    const index = sortedIndex(toYmd(new Date(xScale.invert(x))), map('ix.raw', rows))
    const row = rows[index]
    return {width, height, row}
  }),
)(Lines)
