# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.0](https://github.com/stevenwcarter/which-key/compare/v0.1.1...v0.2.0) (2026-08-22)


### ⚠ Behavioral Changes

* `parseKey` now rejects a modifier word in the base position — `'Ctrl+shift'`,
  `'Mod+alt'` and `'Alt+cmd'` throw instead of returning an unfireable binding.
  No modifier-alias word was ever a bindable key, so nothing that could fire is
  lost; the failure is now loud rather than silent. Note that in React this
  surfaces at the nearest error boundary, since `useShortcut` registers inside
  `useEffect`.
* The which-key popup no longer renders keystrokes typed into a text or password
  field. Modifier-prefixed leaders (`Ctrl+k …`) still show it; bare printable
  keys do not.

### Bug Fixes

* **api-surface:** point require conditions at the emitted .d.cts declarations [B12] ([256151d](https://github.com/stevenwcarter/which-key/commit/256151dbc5eeb99125265005037ce1ee89b4e8a0))
* **caching:** add allocation-free hasCandidates for the keystroke hot path [B6] ([f899327](https://github.com/stevenwcarter/which-key/commit/f899327c625805f948e941d74cad97b123d0f9c4))
* **caching:** skip no-op snapshot emissions on unmatched keystrokes [B5] ([4f15eaf](https://github.com/stevenwcarter/which-key/commit/4f15eaf046eff861331f883106336de447a623c1))
* **correctness:** accept modifier names case-insensitively as documented [B11] ([b446549](https://github.com/stevenwcarter/which-key/commit/b44654938dea83db3a3d0b8e51e750d56427e3d1))
* **correctness:** resolve keydown target lazily so SSR does not crash [B1] ([69ad112](https://github.com/stevenwcarter/which-key/commit/69ad1123de580a3f7f992a944e2f9f4657d66043))
* **correctness:** warn when Shift is dropped from punctuation keys [B2] ([b362efc](https://github.com/stevenwcarter/which-key/commit/b362efccbcb42427244fd88bbe5d23c24146e4fb))
* **frontend:** announce the leader popup as a polite live region [B7] ([02d83ce](https://github.com/stevenwcarter/which-key/commit/02d83ce7af7291683b58cdf7a71fa56db768a2f7))
* **frontend:** correct and complete the documented CSS class contract [B13] ([156079e](https://github.com/stevenwcarter/which-key/commit/156079e7ba168466eb7505ba0f692c89c3578548))
* **frontend:** trap and restore focus in the cheatsheet dialog [B3] ([45489fe](https://github.com/stevenwcarter/which-key/commit/45489fe234919b42ba7b4bcbb88b8fe3ffc382a4))
* **matcher:** narrow input-echo latch to character-echoing keystrokes [Findings 1, 3] ([885d214](https://github.com/stevenwcarter/which-key/commit/885d214e6a77607faf49434457b88af88e96ce43))
* **observability:** contain handler exceptions and reset matcher state [B4] ([0467eb9](https://github.com/stevenwcarter/which-key/commit/0467eb96462bb8d33d64fdd02f68c6ef097de888))
* **observability:** warn only on genuine same-level shortcut collisions [B8] ([ae2b58f](https://github.com/stevenwcarter/which-key/commit/ae2b58f44a8e59a3cb5b1e18b7d4fbba9809b569))
* **security:** latch the input-touched flag on every buffer commit [B9] ([0e18d55](https://github.com/stevenwcarter/which-key/commit/0e18d55580454426d8714c913d234e5c847b3e0a))
* **security:** never render buffered keystrokes typed into text fields [B9] ([89487db](https://github.com/stevenwcarter/which-key/commit/89487db8228b0ac9f33319fa6244429a69cd15f6))
* **security:** resolve the composed event target so shadow-DOM inputs are guarded [B10] ([6a8b94d](https://github.com/stevenwcarter/which-key/commit/6a8b94de58c286efd758f5b08ad876c9a211be11))
* **security:** suppress popup display for buffers touched inside text fields [B9] ([27f43cf](https://github.com/stevenwcarter/which-key/commit/27f43cf9180068b578d37cbdb4a61b5d22576396))

## 0.1.1 (2026-06-18)


### Features

* **engine:** pushLayer handle, activateLayer, global help ([464eefc](https://github.com/stevenwcarter/which-key/commit/464eefc68b304a316be78702482ded2b1d422b86))
* **engine:** registry layer state + reachability resolution ([3cb820f](https://github.com/stevenwcarter/which-key/commit/3cb820f61e03ec32c34724c7470f192990114645))
* **react:** <WhichKeyLayer> and level-aware hooks ([29f2d69](https://github.com/stevenwcarter/which-key/commit/29f2d698fe3ff6da8f52001c60554e229d63d712))
* **which-key:** add framework-agnostic createWhichKey engine controller ([1056108](https://github.com/stevenwcarter/which-key/commit/10561084f4fbdf211ff604717eb460eab64e320c))
* **which-key:** React binding (provider + hooks) over the engine ([3a59bf9](https://github.com/stevenwcarter/which-key/commit/3a59bf9a34ff2a08f36d4692108b2527b33f7741))
* **which-key:** React popup + cheatsheet UI with prebuilt wk-* stylesheet ([7aa5b76](https://github.com/stevenwcarter/which-key/commit/7aa5b7602d8389ff0840e85e568056cb4c929736))
* **which-key:** zero-dependency vanilla-DOM renderer ([b7fcc88](https://github.com/stevenwcarter/which-key/commit/b7fcc88e317ce7d146da294e4287645aee464ad0))


### Bug Fixes

* **which-key:** add getServerSnapshot for SSR; document mount-time props + client-only UI; CI node matrix ([d264371](https://github.com/stevenwcarter/which-key/commit/d2643710d80c8f52c04d54a3560dae6581e62023))
* **which-key:** address final-review nits (this-free pushLayer, ?-toggle + StrictMode tests, vanilla example guard) ([985b594](https://github.com/stevenwcarter/which-key/commit/985b594f0a3d6388fbf1cd7384dd629bef603c1b))
* **which-key:** defensive-copy currentSequence into snapshot; test registerGroup unregister thunk ([9ea0ccb](https://github.com/stevenwcarter/which-key/commit/9ea0ccbc9d824634b7ff77facd4bac7e5724dd41))
* **which-key:** drop static gridAutoFlow inline style; assert help-entry excluded from cheatsheet ([80632d6](https://github.com/stevenwcarter/which-key/commit/80632d6ae3020963fb723bdedcde7e08b32a9125))
* **which-key:** make React provider tests reactive; assert group unregister; merge import ([61f3d52](https://github.com/stevenwcarter/which-key/commit/61f3d52725cff943284b36106e1ed228a9259b30))
