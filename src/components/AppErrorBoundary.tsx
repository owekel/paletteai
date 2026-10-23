import { Component, type ReactNode } from 'react'
import SiteHeader from './SiteHeader'

/** No error-reporting service: exceptions and photos are not transmitted. */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="page-shell page-shell-narrow">
      <SiteHeader />
      <h1 className="ui-title">Let’s start fresh.</h1>
      <p role="alert" className="ui-copy mt-5">Something interrupted this session. Reload PaletteAI to try again. Your photo has not been uploaded.</p>
      <button className="ui-button ui-button-primary mt-6" onClick={() => window.location.assign('/')}>Restart PaletteAI</button>
    </main>
  }
}
