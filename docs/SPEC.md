# PaletteAI — What I wanted to build

**Live site:** https://paletteai-sepia.vercel.app

I built PaletteAI as a way for people to explore their personal colour palette using a photo. The idea sounds simple: take a photo, get a colour season, and see which shades might suit you.

But while testing early versions, I kept running into a bigger question: **how do you make a result useful when the photo itself might not be reliable?** Lighting, camera settings, face positioning, and even the way the app presents uncertainty can make a difference. I didn't want to build something that confidently gave people an answer just because it could.

This is a look at what I wanted the product to do and what's actually implemented now. I wrote it after building the app, using our development discussions and the repository. It's not a day-one specification or a claim that I personally hand-coded every feature.

## Who it's for

Someone who's curious about personal colour analysis and wants a practical starting point for choosing clothing colours. They shouldn't need a professional camera, a technical background, or an understanding of colour science to try it.

**My main goals were to:**

- Make the photo-taking process as straightforward as possible.
- Improve consistency without pretending that a camera can measure someone's exact undertone.
- Give useful colours and comparisons, even when one specific season isn't clear.
- Let people actually see suggested colours on their clothing.
- Keep personal photos private and avoid accounts or uploads to an application server.
- Make the website feel like a real consumer product rather than a technical demo.

The app isn't meant to provide a scientifically validated colour diagnosis, guarantee the same result in every room or on every phone, or tell anyone which colours they're allowed to wear.

## How the experience should work

### 1. Take or upload a photo

I wanted more than a button that just says “Upload image.”

- **Precision Analysis** is the recommended camera experience. It asks for three separate usable photos to give the app more evidence to compare. There's an optional two-photo fallback if getting a third good capture becomes difficult.
- **Quick Analysis** uses a single camera photo for a faster experience.
- **Upload** allows someone to choose an existing JPG, PNG, or WebP portrait, subject to file and image-size limits.

During camera capture, the app gives feedback about framing, movement, exposure, pose, and uneven lighting. When conditions are stable, it can automatically choose a photo from a short buffer of recent frames. The user can still take a photo manually.

The important detail is that the camera should choose the **best usable photo**, not the one that happens to produce the most confident or flattering season result.

**What can go wrong:** Camera permission might be denied, a model might fail to load, or the photo might be technically unusable. The app should explain the problem, offer another attempt, and stop using the camera when the user leaves the flow.

For the exact implementation, see [Guided Capture](guided-capture.md).

### 2. Analyze the colour information

The app uses local browser-based vision models and image processing to estimate visible colour characteristics. These include dimensions such as temperature, value, chroma, and contrast.

For Precision Analysis, I wanted the app to **combine the underlying measurements from the photos before deciding on a season**. Simply classifying each image and taking a majority vote would ignore how reliable each measurement was and whether the photographs agreed.

The implemented flow accounts for technical photo quality, differences between captures, and recurring lighting problems. It can reject a Precision session when multiple captures show strong signs that the lighting is unsuitable.

More photos don't magically eliminate camera or lighting bias. They're another source of evidence, not a scientific guarantee.

Technical details: [Precision Analysis](precision-analysis.md).

### 3. Give an honest result

This became one of the biggest priorities as the project developed. I didn't want the app to force everyone into a specific season when the measurements couldn't support one.

Depending on the available evidence, results can show:

- **A specific season**, when the app's provisional rules distinguish one clearly enough.
- **A group of possible seasons**, when there are several plausible neighbours.
- **A broader colour profile**, when only some characteristics are supported.
- **An exploration palette**, clearly described as non-personalized when there's too little reliable evidence.
- **A retake request**, for actual technical image-quality problems rather than merely an uncertain season.

The numbers behind these decisions are heuristics. They're not validated probabilities of someone's true colour season, so the consumer result shouldn't present them as such.

Implementation: [README results flow](../README.md#results-flow) and `src/components/ResultsPage.tsx`.

### 4. Make the answer useful

A season label by itself isn't particularly helpful if the person doesn't know what to do with it.

I wanted PaletteAI to turn its results into:

- Suggested colours and everyday neutrals.
- Practical wardrobe colour ideas.
- Side-by-side comparisons for qualities the app couldn't confidently distinguish.
- A colour checker and clothing try-on using the **same palette** shown in the results.

If the season is uncertain, the suggestions should reflect the possible outcomes instead of pretending one exact answer was chosen.

### 5. Let people preview colours on their clothing

The try-on feature changes the appearance of clothing colours in the original portrait using local image segmentation and recolouring.

The goal is to keep the clothes looking like the same clothes: preserve fabric texture, shape, shadows, skin, and background while changing the colour. I would rather leave a small amount of the original colour at a tricky edge than have an obvious cutout around someone's body.

See [Garment boundary matting](garment-boundary-matting.md) for how that trade-off is handled.

### 6. Make it feel good to use

I wanted a clean, fashion-inspired look with the photo and recommended colours doing most of the visual work. The result should be easy to follow: here's what the photo supports, here are some colours to explore, and here's what they look like.

The shipped design uses warm neutrals, restrained typography, an editorial feel, responsive layouts, keyboard-accessible controls, and reduced-motion support. Technical diagnostic screens are kept out of the normal user experience.

See [Consumer design](consumer-design.md).

## Privacy was part of the product

Because people are trusting the website with a portrait, I wanted the processing to stay on their own device.

PaletteAI is a static React/TypeScript app built with Vite. The current implementation uses MediaPipe and local canvas/image processing in the browser, with **no application photo-upload endpoint, user accounts, remote inference API, or saved profile database**.

Photos and results stay in application memory for the session rather than being deliberately saved to browser storage. That doesn't mean a browser guarantees secure deletion, and the hosting provider still receives normal network metadata when serving the website.

Read [Privacy architecture](privacy-architecture.md) for the exact boundaries and caveats.

## What I've tested — and what I haven't proved

The October 2026 launch review recorded **135 passing automated checks across 11 suites**, production build checks, browser journeys, and my own Mac/iPhone testing. Those results are documented in the [launch record](final-launch-2026-10-22.md); they aren't a new test run for this document.

That evidence supports that the software works in the tested scenarios. It **doesn't** prove that its season classifications are scientifically accurate across different people, skin tones, phones, and lighting conditions. The original launch review also left a complete fresh anonymous post-analysis network/storage trace unfinished.

If I keep developing PaletteAI, I'd want to run more structured repeatability tests across different devices and lighting, and get feedback about whether the recommendations and try-on are genuinely helpful.

## The thinking behind the decisions

- [Design decisions](DESIGN_DECISIONS.md) — the actual problems and trade-offs that shaped the product.
- [How I used AI during development](AI_DEVELOPMENT.md) — my role in specifying, testing, and iterating on features, alongside AI coding tools.
- The existing engineering docs in this folder cover the more detailed algorithms, tests, and release decisions.

