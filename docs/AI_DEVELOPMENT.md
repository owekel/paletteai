# How I used AI to build PaletteAI

I built PaletteAI with AI coding tools, mainly through Codex and ChatGPT Work. I want to be clear about what that means because it's a big part of how this project came together.

**I did not personally write most of the React/TypeScript code.** AI tools generated and revised significant parts of the implementation, including features, fixes, and tests. My role was to figure out what the product should do, describe the problems I was seeing, make decisions about features, test the app, and keep pushing for changes until the experience made sense.

I think it's worth showing that process rather than just saying “built with AI.”

## What the process actually looked like

It wasn't one prompt that somehow produced a finished website.

A lot of my development process went something like this:

1. **Try the app.** I would test a feature myself or get informal feedback from someone trying it.
2. **Find something that wasn't working.** Maybe the results changed too much under different lighting, a camera flow felt frustrating, or clothing recolouring looked unnatural.
3. **Explain the problem and what I wanted instead.** I used conversations and instructions to describe the user experience, important constraints, and what I didn't want the AI to break.
4. **Have an AI coding tool work on it.** The tool could inspect the source, write or change code, run tests, and explain how it approached the problem.
5. **Test the new version.** I checked what actually happened in the app. If a change technically passed but made the experience worse, I asked for another approach or a rollback.
6. **Repeat.** Some features went through several rounds of changes before I was happy with them.

My prompts became more specific over time. Instead of only asking for a new feature, I started including why it mattered, what behaviour I expected, what edge cases worried me, and how I wanted the result checked.

## Example 1: Making the camera easier to use

One problem I ran into was that the quality of the photo could affect the result. I didn't want users to be responsible for perfectly positioning themselves and taking the photo at exactly the right moment.

After testing early versions and considering feedback from an early tester, I wanted the camera to guide people and take a suitable photo automatically.

The direction I gave the AI tools was essentially:

- Tell the user what's wrong with their framing or lighting instead of just saying the photo isn't good.
- Wait until conditions look stable rather than taking the first frame that passes.
- Prefer the best *photographic* frame, not whichever frame produces the most confident colour season.
- Keep manual capture available.

The technical implementation ended up including live checks, a short frame buffer, image-quality ranking, and cleanup when the camera is closed. I didn't hand-code all of that, but I was involved in deciding the behaviour and evaluating it.

See [Guided Capture](guided-capture.md).

## Example 2: Getting more consistent results from multiple photos

Early on, I found that one photo wasn't giving me the kind of consistency I wanted. That led to Precision Analysis, which collects several separate photos.

A key distinction I wanted was **not** to have the app analyze each photo, assign three seasons, and take whichever one got the most votes. I wanted the measurements themselves to be combined, with attention to their reliability.

I worked with AI coding tools to build and refine that flow. The implementation now uses robust aggregation, considers disagreement between photos, and checks for repeated lighting problems.

I also wanted the experience to stay practical: if someone has two good photos but struggles to get a third, the app can offer a two-photo fallback under certain conditions instead of leaving them stuck.

That doesn't mean I proved three photos are always more accurate. They can share the same lighting or camera bias. The goal was to have more information to work with and to be more honest about its limits.

See [Precision Analysis](precision-analysis.md).

## Example 3: Fixing clothing-colour try-on

The try-on feature was one of the more visual parts of development. A code change could work technically while still looking bad in an actual photo.

I reviewed results where bits of the original clothing colour remained near edges, and where stronger corrections risked making the boundary around a person look unnatural.

What mattered to me was the end result. I wanted a believable recolour that kept the original shading and garment shape, even if that meant accepting a tiny bit of colour fringe in difficult areas.

AI tools investigated the image-processing side and implemented the fixes and regression checks. My job was to evaluate the trade-off, compare how it looked, and direct changes when the image stopped looking natural.

See [Garment boundary matting](garment-boundary-matting.md).

## Example 4: Getting it ready for people to use

The final stretch wasn't just about adding features. It was also about making the interface feel more polished and checking how it behaved outside a development preview.

I pushed for a more distinctive, fashion-inspired design, then tested the app on Mac and iPhone. Some issues were small but noticeable, like the spacing of footer links and the way the front-camera preview was mirrored.

I used AI coding tools to investigate and fix those issues, with a particular constraint: mirroring what I see on screen shouldn't accidentally change the photo pixels used for analysis.

The launch review included automated checks, browser testing, security/privacy review, and my own device testing. The website launched in October 2026. The [launch record](final-launch-2026-10-22.md) also documents what hadn't been fully tested, so I don't want to oversell the verification.

## What my prompting looked like

A lot of the process was conversational. I didn't always write polished software specifications. I would often describe something that felt wrong, ask for a fix, inspect the result, and then clarify what I'd meant.

Over time I found it helpful to include four things:

- **The problem:** What happened when I tried the app?
- **The goal:** What should happen from the user's point of view?
- **The limits:** What shouldn't be changed or broken while fixing it?
- **The check:** How would I know the change actually worked?

Here are a few **reconstructed examples** of that style. They're summaries of directions discussed during development, **not copied-and-pasted historical prompts**:

> The results change a lot depending on the lighting. Can we improve the photo-taking experience rather than just changing the classification? Keep it easy for users and tell them what needs fixing.

> For Precision Analysis, combine the underlying colour measurements from each photo before classifying. Don't just have the photos vote on a season. Make sure unreliable photos don't dominate the result.

> The clothing recolour still has some weird edges. I'd rather keep a bit of the original colour than mess up the outline of the person or the clothing.

> The selfie camera should look mirrored like people expect, but the actual saved photo and analysis shouldn't be flipped. Make sure rear cameras aren't affected.

If I ever publish exact historical prompt excerpts, I'll verify them against the original conversation or task log first. I don't want to pass off reconstructed examples as exact quotes.

## How I checked the AI's work

I tried to judge changes by whether the app actually became more useful, not just whether a test suite passed.

That included trying real photos, comparing results under different conditions, checking the look of the try-on, using the app on different devices, and noticing when a supposedly helpful change introduced a new problem.

The codebase also has automated regression tests, TypeScript checks, and a production build process. The October 2026 launch review recorded **135 passing checks across 11 suites**, alongside browser and device verification.

Those checks are meaningful, but they don't prove the colour-season predictions are scientifically correct or that every possible device/lighting scenario has been covered. In particular, the launch report notes that a complete fresh anonymous post-analysis network/storage trace wasn't finished.

## What I learned

The part I enjoyed most was figuring out **what should be built and why**.

AI made it possible for me to build a much more involved application than I could have coded on my own at the time. But it didn't automatically decide which user problems mattered, whether a design felt right, or when an implementation had missed the point. Those were decisions I had to keep making through testing, feedback, and iteration.

I also know there's a difference between directing a working product and independently understanding every line of its code. I'm comfortable being honest about that, and I want to keep strengthening the technical side as I work on new projects.

For a breakdown of the product choices themselves, see [The decisions behind PaletteAI](DESIGN_DECISIONS.md).

