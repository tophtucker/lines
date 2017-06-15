import {Component} from 'react'
import {render} from 'react-dom'
import Lines from './components/Lines'

import cs from './styles.css'

class App extends Component {
  render () {
    return <Lines />
  }
}

render(<App/>, document.getElementById('app'))
