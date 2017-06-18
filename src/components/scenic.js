import {Children, Component} from 'react'
import {has, toPairs} from 'lodash/fp'

export const View = props => <div />
export const Thing = props => <div />

const getSizing = (a, b, size) => props => {
  if (has(size, props)) {
    if (has(a, props)) {
      return {[a]: props[a], [b]: props.size[size] - props[a] - props[size]}
    } else if (has(b, props)) {
      return {[b]: props[b], [a]: props.size[size] - props[b] - props[size]}
    }
    return {[a]: 0, [b]: props.size[size] - props[size]}
  }
  return props
}

const renderView = props => {
  const {ctx, size, pixel, aspectRatio, children} = props
  const {top = 0, bottom = 0} = getSizing('top', 'bottom', 'height')(props)
  const {left = 0, right = 0} = getSizing('left', 'right', 'width')(props)

  // Transform
  ctx.save()
  ctx.translate(left / size.width * 1e3, top / size.height * aspectRatio * 1e3)
  const contentWidth = size.width - left - right
  const contentHeight = size.height - top - bottom
  const widthScale = contentWidth / size.width
  ctx.scale(widthScale, widthScale)

  const scaledPixel = pixel * widthScale
  const scaledAspect = contentHeight / contentWidth

  // Render things and views
  Children.toArray(children).forEach(child => {
    const childProps = {
      ...child.props,
      ctx,
      size: {width: contentWidth, height: contentHeight},
      pixel: scaledPixel, aspectRatio: scaledAspect,
    }
    if (child.type === Thing) child.props.render(childProps)
    else if (child.type === View) renderView(childProps)
    else throw new Error('View should have only Things and other Views as children')
  })

  ctx.restore()
}

export class Scene extends Component {
  componentWillMount() {
    this.draw()
  }

  draw = () => {
    requestAnimationFrame(this.draw)
    if (!this._ctx) return
    const ctx = this._ctx
    const [width, height] = [innerWidth, innerHeight]

    // Reset frame
    if (this._cvs.width !== width || this._cvs.height !== height) {
      this._cvs.width = width
      this._cvs.height = height
    }
    ctx.clearRect(0, 0, width, height)

    ctx.save()
    ctx.scale(width / 1e3, width / 1e3)

    const view = this.props.children
    if (view && view.type === View) {
      renderView({
        ...view.props,
        ctx,
        size: {width, height},
        pixel: 1 / width * 1e3, aspectRatio: height / width,
      })
    } else {
      throw new Error('Scene should have a View as its only child')
    }

    ctx.restore()
  }

  getContext = cvs => {
    this._cvs = cvs
    this._ctx = cvs.getContext('2d')
    if (this.props.listeners) {
      toPairs(this.props.listeners).forEach(
        ([evt, cb]) => cvs.addEventListener(evt, cb, false)
      )
    }
  }

  render() {
    return <canvas ref={this.getContext} />
  }
}
