import {withState, withProps} from 'recompose'
import {fromPairs, zipWith, map, max, min, get, compose, sortedIndex, toPairs} from 'lodash/fp'
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

  makeScale = key => scaleLinear().domain([
    min(map(get([key, 'parsed']), this.props.rows)),
    max(map(get([key, 'parsed']), this.props.rows)),
  ]).range([this.props.height, 0])

  draw = () => {
    if (this._ctx) {
      const ctx = this._ctx
      const {width, height, rows, row, xScale} = this.props
      if (this._cvs.width !== width || this._cvs.height !== height) {
        this._cvs.width = width
        this._cvs.height = height
      }
      ctx.clearRect(0, 0, width, height)

      if (row) {
        const date = row.ix.parsed
        this.path({strokeStyle: 'white'}, c => {
          c.moveTo(xScale(date), 0)
          c.lineTo(xScale(date), height)
        })
      }

      const colors = ['blue', 'red']
      table.columns.slice(1).forEach(({key}, i) => {
        const yScale = this.makeScale(key)
        const points = rows.map(row => [
          xScale(row.ix.parsed),
          yScale(get([key, 'parsed'], row)),
        ])
        this.path({strokeStyle: colors[i]}, c => {
          points.forEach(([x, y]) => c.lineTo(x, y))
        })

        if (row) {
          const yScale = this.makeScale(key)
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
    this._ctx = cvs.getContext('2d')
    const updateCursor = ({pageX: x, pageY: y}) => this.props.setCursor({x, y})
    toPairs({
      'mouseover': updateCursor,
      'mousemove': updateCursor,
      'mouseout': setCursor(null),
    }).forEach(([evt, cb]) => cvs.addEventListener(evt, cb, false))
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
    const xScale = scaleLinear().domain([
      min(map('ix.parsed', props.rows)), max(map('ix.parsed', props.rows)),
    ]).range([0, width])
    return {width, height, xScale}
  }),
  withProps(props => {
    const {rows, xScale, width, height, cursor} = props
    if (!props.cursor) return {}
    const {x, y} = cursor
    const index = sortedIndex(toYmd(new Date(xScale.invert(x))), map('ix.raw', rows))
    return {row: rows[index]}
  }),
)(Lines)
