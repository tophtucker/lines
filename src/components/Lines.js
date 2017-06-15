import {withState} from 'recompose'
import {fromPairs, zipWith, map, max, min, get, compose, keyBy, sortedIndex} from 'lodash/fp'
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

  draw = () => {
    if (this._ctx) {
      const ctx = this._ctx
      const [width, height] = [innerWidth, innerHeight]
      if (this._cvs.width !== width || this._cvs.height !== height) {
        this._cvs.width = width
        this._cvs.height = height
      }
      ctx.clearRect(0, 0, width, height)

      const rows = this.props.rows
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

      let date = null
      let row = null
      if (this.props.cursor) {
        const {x, y} = this.props.cursor
        const index = sortedIndex(toYmd(new Date(xScale.invert(x))), map('ix.raw', rows))
        row = rows[index]
        date = rows[index].ix.parsed

        ctx.beginPath()
        ctx.moveTo(xScale(date), 0)
        ctx.lineTo(xScale(date), height)
        ctx.strokeStyle = 'white'
        ctx.stroke()
        ctx.closePath()
      }
      const colors = ['blue', 'red']
      lines.forEach((points, i) => {
        ctx.beginPath()
        points.map(([x, y]) => ctx.lineTo(x, y))
        ctx.strokeStyle = colors[i]
        ctx.stroke()
        ctx.closePath()
      })
      if (row) {
        table.columns.slice(1).map(({key}, i) => {
          const yScale = makeScale(key)
          const y = yScale(get([key, 'parsed'], row))
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
          ctx.strokeStyle = colors[i]
          ctx.stroke()
          ctx.closePath()
        })
      }
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
)(Lines)
