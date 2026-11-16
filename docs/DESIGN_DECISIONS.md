# PaletteAI — The decisions behind the app

A lot of PaletteAI came from testing something, noticing that it wasn't quite right, and then figuring out what would actually make the experience better.

I wanted to document those decisions because I think they say more about the project than a list of features does. The app didn't start out with all of these solutions. I made changes as I tried early versions, got feedback, and saw where the experience was falling short.

I put this together after development using my discussions and the actual codebase. It's a reconstruction of my reasoning, **not** a diary of exact conversations or proof that I came up with every technical implementation detail myself. AI coding tools implemented much of the code. I guided the product, tested the results, and asked for changes.

## 1. Fixing unreliable results started with better photos

**The issue:** One of my biggest frustrations with the earlier versions was that the analysis could change depending on lighting. Even when the app produced a nice-looking season result, that didn't mean I trusted it.

My first instinct could have been to keep adjusting the classifier. But I realised the photos going *into* the system were a big part of the problem. If someone takes a photo with uneven lighting, there's only so much the analysis can reliably infer from it.

**What I decided:** Make taking a usable photo part of the product, not something the user has to figure out on their own.

The camera now checks framing, pose, movement, exposure and lighting, and can explain what needs to change. It also runs more detailed checks before accepting an automatically selected frame.

**The trade-off:** Stricter capture means extra friction. I didn't want people getting stuck waiting for perfect conditions, so the app keeps manual capture and upload as options. And if the photo is technically fine but the season is uncertain, the app should say it's uncertain—not make the person retake it over and over.

**Where it shows up:** [Guided Capture](guided-capture.md) and [Precision Analysis](precision-analysis.md).

## 2. Why I added automatic capture

**The issue:** Getting users to position their face, watch for good lighting, and press the shutter at the right time is asking a lot. Feedback from someone testing an early version helped push me toward a more guided approach.

I liked the idea that the camera could do some of that work instead of expecting everyone to know what a “good” analysis photo looks like.

**What I decided:** Let the camera wait for stable conditions and choose a suitable frame automatically, while still allowing someone to take a photo manually.

The implementation checks a small buffer of recent frames and picks based on **photo quality**, not on which frame gives the strongest season classification. That's important: I don't want the app cherry-picking a result.

**The trade-off:** Waiting for the right moment can feel slower than a normal camera. But a slightly longer capture is worth considering if it means fewer unusable photos, as long as the person can still take control.

**Where it shows up:** [Guided Capture](guided-capture.md).

## 3. Why Precision Analysis uses multiple photos

**The issue:** A single photo is just one moment, under one set of lighting and camera conditions. When I was trying to improve consistency, relying on that one moment felt like a limitation.

**What I decided:** Introduce a recommended three-photo option and look at the combined evidence rather than treating any one photo as the whole answer.

An important requirement was to **combine the actual colour measurements before deciding on a season**. I didn't want three individually assigned seasons and a simple majority vote. That would lose information about photo quality, reliability, and how much the measurements agree.

The current implementation combines measurements with a robust method, checks for repeated lighting issues, and classifies the combined profile. It also offers a deliberate two-photo fallback in certain situations so users aren't trapped trying to obtain a perfect third shot.

**The trade-off:** It's more work than one photo, and three photos taken in the same lighting can all share the same problem. This was a decision to get *more evidence*, not to claim that more photos guarantee the correct answer.

**Where it shows up:** [Precision Analysis](precision-analysis.md).

## 4. I'd rather show uncertainty than make up confidence

**The issue:** During testing, nearby seasons could compete with one another. I didn't want the website confidently telling someone they're a very specific season when the evidence wasn't strong enough.

This was an important shift in how I thought about the product. The goal wasn't to make the output look impressive; it was to help someone explore colours they'd actually want to wear.

**What I decided:** Have different kinds of results depending on how much the analysis supports:

- A specific season when the evidence is strong enough under the app's rules.
- A few possible seasons when things are close.
- A broader profile when only some colour qualities are clear.
- A general exploration palette when the evidence isn't enough to personalize it.

For uncertain cases, the app can suggest colours shared by plausible palettes and offer side-by-side comparisons. That makes an incomplete answer useful instead of turning it into a dead end.

**The trade-off:** “You might be one of these seasons” isn't as satisfying as a confident label. But I think it's better than giving false precision.

The current rules are still **provisional heuristics**, not scientifically validated probabilities.

**Where it shows up:** [README results flow](../README.md#results-flow), [Precision Analysis](precision-analysis.md), and `src/components/ResultsPage.tsx`.

## 5. Making clothing try-on look natural

**The issue:** Recolouring clothing sounds straightforward until you see what happens around collars, shoulders, seams and skin. Some experiments left bits of the original colour around edges; more aggressive fixes could make the clothes or the person look cut out.

**What I decided:** Prioritize a believable image over perfectly eliminating every last trace of the old clothing colour.

I wanted the fabric shading and garment shape to stay recognisable. The implementation uses garment segmentation and conservative edge correction, only applying certain fixes when the image provides enough evidence.

**The trade-off:** You can sometimes see a little remaining source colour at difficult edges. I preferred that over changing skin, background pixels or garment boundaries just to make an enlarged comparison look cleaner.

**Where it shows up:** [Garment boundary matting](garment-boundary-matting.md) and `src/services/clothingRecolor.ts`.

## 6. Making it feel like a product, not a school demo

**The issue:** At one point, the interface was functional but didn't feel particularly distinctive. I tried cleaner layouts, but some felt a bit plain. I wanted the app to feel closer to something someone would use while exploring clothes and personal style.

**What I decided:** Go with a restrained, slightly editorial design: warm neutrals, stronger photography, carefully used typography, and colour swatches that actually stand out.

I also wanted the important parts to be obvious. People should see their result, understand what it means, find some colours, and try those colours on their photo without digging through technical information.

**The trade-off:** A more polished interface can accidentally make an uncertain result feel more authoritative. I tried to keep the explanations straightforward and give diagnostic detail its own separate place.

**Where it shows up:** [Consumer design](consumer-design.md) and `src/components/ResultsPage.tsx`.

## 7. Keeping people's photos on their own device

**The issue:** Asking someone for a personal portrait is a bigger trust decision than asking for a normal preference. I didn't want people to need an account or wonder where their photos ended up.

**What I decided:** Make the analysis and try-on work in the browser instead of sending portraits to a separate AI service.

The current app uses local image processing and browser-based vision models, without an application photo-upload endpoint or saved profile database. Images are kept in application memory for the active session.

**The trade-off:** The device has to handle the processing and model downloads. It also doesn't mean the website is magically invisible to the hosting provider: normal web requests still create connection metadata, and clearing application state isn't the same as guaranteed secure erasure.

**Where it shows up:** [Privacy architecture](privacy-architecture.md) and [Launch verification](final-launch-2026-10-22.md). The original launch review left a complete anonymous post-analysis network/storage trace unfinished, so I don't claim the privacy audit covered every possible case.

## What I took away from building PaletteAI

The biggest lesson for me was that **building more features wasn't always the same as making the product better**.

Often, the useful work was noticing where the experience broke down, deciding what mattered most, figuring out the trade-offs, and testing whether the next version actually solved the problem. That's the part of development I found particularly interesting.

I built the project with significant AI coding assistance, and I wanted to be upfront about that. The code matters, but so do the decisions behind it. I describe that workflow in [How I used AI to build PaletteAI](AI_DEVELOPMENT.md).

I also haven't run a controlled study showing that PaletteAI can accurately classify colour seasons across different people and devices. The October 2026 release record reports functional tests and device checks, not scientific validation. If I revisit the project, structured repeatability tests and more user feedback would be the next things I'd want to work on.
