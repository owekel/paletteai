import SiteHeader from './SiteHeader'

export default function PrivacyPage() {
  return <main className="page-shell page-shell-narrow">
    <SiteHeader />
    <a href="/" className="ui-text-action">← Back to PaletteAI</a>
    <p className="ui-eyebrow mt-8">Your photo, considered.</p>
    <h1 className="ui-title mt-4">Photo privacy</h1>
    <div className="grid gap-8 mt-8">
      <section><h2 className="ui-heading">Processed on your device.</h2><p className="ui-copy mt-3">Your photos, facial measurements and colour results are processed in this browser. PaletteAI does not upload them to a server, save a photo history, or send them to analytics services. There is no account to create.</p></section>
      <section><h2 className="ui-heading">Only for this session.</h2><p className="ui-copy mt-3">Photos and results stay in memory while you use the app, including for clothing try-on. Starting a new analysis or reloading the page discards the session. The camera is stopped when you leave capture or finish a photo. Your browser manages when unused memory is reclaimed; this is not a secure-erasure guarantee.</p></section>
      <section><h2 className="ui-heading">What the site downloads.</h2><p className="ui-copy mt-3">PaletteAI downloads its interface, fonts and computer-vision models from this website. The hosting provider, Vercel, receives ordinary connection details such as your IP address and requested asset URLs. Your photos and measurements are not part of those requests. Browser caching may retain the public app files and models, but the app does not store your photos in browser storage.</p></section>
      <section><h2 className="ui-heading">A guide, not a verdict.</h2><p className="ui-copy mt-3">This is an experimental personal styling tool. Lighting, camera processing and visible features can affect the result. The analysis is not a medical assessment or a scientifically validated prediction, and a preview cannot reproduce the exact appearance of a fabric.</p></section>
    </div>
    <footer className="ui-footer"><p>No photo uploads. No saved profiles.</p><nav className="ui-footer-links" aria-label="Privacy page links"><a href="/third-party-notices.txt" className="ui-text-action">Open-source notices</a><a href="/" className="ui-text-action">Start a colour analysis →</a></nav></footer>
  </main>
}
