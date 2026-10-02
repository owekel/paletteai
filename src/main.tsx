import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'capture') {
  void import('./dev/CapturePreview').then(({ default: CapturePreview }) => {
    root.render(<React.StrictMode><CapturePreview /></React.StrictMode>)
  })
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'recolor') {
  void import('./dev/RecolorPreview').then(({ default: RecolorPreview }) => {
    root.render(<React.StrictMode><RecolorPreview /></React.StrictMode>)
  })
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'results') {
  void import('./dev/ResultsPreview').then(({ default: ResultsPreview }) => {
    root.render(<React.StrictMode><ResultsPreview /></React.StrictMode>)
  })
} else {
  root.render(<React.StrictMode><App /></React.StrictMode>)
}
