# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.1](https://github.com/stevenwcarter/which-key/compare/v0.2.0...v0.2.1) (2026-08-22)

### Features

- **styling:** follow prefers-color-scheme with a data-wk-theme override [D2] ([638b4d3](https://github.com/stevenwcarter/which-key/commit/638b4d353776533a216c71c80b4440bcd0240624))

### Bug Fixes

- **api-surface:** canonicalize the registerGroup prefix [B22] ([62d8f90](https://github.com/stevenwcarter/which-key/commit/62d8f90323d532a3ca82ffea31b86ac9fd3854d3))
- **api-surface:** clamp a non-finite or negative timeoutMs to the default [B30] ([21135bd](https://github.com/stevenwcarter/which-key/commit/21135bd572ef5928d8c7076e69ed5be0f02caa79))
- **api-surface:** export PopupOptions and WhichKeyMountHandle from which-key/vanilla [B25] ([e911d0b](https://github.com/stevenwcarter/which-key/commit/e911d0b9017849bd696d109a12928cfc65b646b6))
- **api-surface:** make clamp01 and clampRows total over NaN and share one copy [B29] ([12476a7](https://github.com/stevenwcarter/which-key/commit/12476a775b3d985ce8ab9d999e8d035573045518))
- **api-surface:** reject an overflowing timeoutMs, which setTimeout coerces to 0 [B30] ([1338315](https://github.com/stevenwcarter/which-key/commit/1338315790e31f185347b032907794bef3fb5fb3))
- **api-surface:** soft-fail an invalid helpKey instead of throwing from the factory [B23] ([1450713](https://github.com/stevenwcarter/which-key/commit/1450713bf569a70ae38d5845b40bc862f197c3a4))
- **api-surface:** soft-fail register() on an invalid key string or non-function handler [B14] ([7b2d5bc](https://github.com/stevenwcarter/which-key/commit/7b2d5bcfb450faa3000208e3b8f670a169536a0a))
- **api-surface:** validate an explicit level on register and registerGroup [B45] ([1d4cba4](https://github.com/stevenwcarter/which-key/commit/1d4cba4bd245ebab94cf1d952b9c24a58ce99e33))
- **api-surface:** validate an explicit pushLayer level [B34] ([fdfa47a](https://github.com/stevenwcarter/which-key/commit/fdfa47af3fbd1378bc57a325d538a365cc75ea46))
- **api-surface:** validate classPrefix and fall back to "wk" [B36] ([bdbcf8a](https://github.com/stevenwcarter/which-key/commit/bdbcf8af3718b2b4746cc034a53ef542b1575919))
- **api-surface:** warn and no-op on a duplicate mountWhichKey for one container [B32] ([72d085a](https://github.com/stevenwcarter/which-key/commit/72d085a59bb445386d78e2acdebf47258649f1b2))
- **api-surface:** warn when helpKey is an empty string [B47] ([623ed14](https://github.com/stevenwcarter/which-key/commit/623ed14f2d898d86080b48287b06423ea556bd3e))
- **correctness:** accept case-insensitive special-key aliases and warn on unknown bases [B15] ([24a434a](https://github.com/stevenwcarter/which-key/commit/24a434a6f9e8178b3cc52a82a7455006ff787d68))
- **correctness:** guard isMacPlatform against an absent navigator [B31] ([c7f8195](https://github.com/stevenwcarter/which-key/commit/c7f81953532ce2aef4f84bf800a35b3d85fac0dc))
- **correctness:** hide a stale popup when a leaf-and-prefix keystroke taints the buffer [B44] ([c866b4e](https://github.com/stevenwcarter/which-key/commit/c866b4ef94e39d25c7b2486fb852c0ff66343b5a))
- **correctness:** keep a group label on a single-entry cheatsheet prefix [B37] ([0fa77df](https://github.com/stevenwcarter/which-key/commit/0fa77dfcb391613a2aa380bc785983c65a819614))
- **correctness:** merge colliding leaf and deeper-sequence candidates [B20] ([0f20152](https://github.com/stevenwcarter/which-key/commit/0f20152f26dfa7dc302ba08a7f505386e87cf2f8))
- **correctness:** pass the real triggering event to a timed-out leaf-and-prefix handler [B17] ([4cea130](https://github.com/stevenwcarter/which-key/commit/4cea130143143d4c08e6f503cd51cb62904f508d))
- **correctness:** refresh the popup when a leaf-and-prefix keystroke commits [B21] ([35e4447](https://github.com/stevenwcarter/which-key/commit/35e4447c72b9cfe935cc0e01a04ac075f8d5ab00))
- **correctness:** stop warning for real event.key names the alias table did not list [B15] ([b57b12a](https://github.com/stevenwcarter/which-key/commit/b57b12a1f512710178d2b213b41c2821d38c4e7a))
- **frontend:** correct the vanilla example's cheatsheet selectors [B39] ([0264bff](https://github.com/stevenwcarter/which-key/commit/0264bff6a9fd46f370154bfdb01689c2ede16404))
- **frontend:** define the missing wk-cheatsheet\_\_section rule [B40] ([0345773](https://github.com/stevenwcarter/which-key/commit/03457739ab28851dc36203371703116167d2f6d4))
- **frontend:** expose the overlay z-index as a CSS custom property [B26] ([54ff1a2](https://github.com/stevenwcarter/which-key/commit/54ff1a21f97bd02b9a9af28c2ffab32fad9afa4a))
- **frontend:** keep a stable vanilla popup host instead of rebuilding it per emit [B18] ([af0a28f](https://github.com/stevenwcarter/which-key/commit/af0a28f53e56ffbce113a10ebd4e4ddd6180f3f6))
- **matcher:** clear the fired timer handle in the popup-show callback [B42] ([b7b1231](https://github.com/stevenwcarter/which-key/commit/b7b12313ba01becefd7b138853bfeb0004c0fef2))
- **observability:** warn once when a renderer is mounted outside WhichKeyProvider [B24] ([d00fa2f](https://github.com/stevenwcarter/which-key/commit/d00fa2faa9e9c82c5e0cf2edc1e824f03e6c3e97))
- **test:** make the class-contract rule guard discriminate hyphenated modifiers ([a13302f](https://github.com/stevenwcarter/which-key/commit/a13302fb225bcfa7cc33ae6801f6dede52989e13))

## [0.2.0](https://github.com/stevenwcarter/which-key/compare/v0.1.1...v0.2.0) (2026-08-22)

### ⚠ Behavioral Changes

- `parseKey` now rejects a modifier word in the base position — `'Ctrl+shift'`,
  `'Mod+alt'` and `'Alt+cmd'` throw instead of returning an unfireable binding.
  No modifier-alias word was ever a bindable key, so nothing that could fire is
  lost; the failure is now loud rather than silent. Note that in React this
  surfaces at the nearest error boundary, since `useShortcut` registers inside
  `useEffect`.
- The which-key popup no longer renders keystrokes typed into a text or password
  field. Modifier-prefixed leaders (`Ctrl+k …`) still show it; bare printable
  keys do not.

### Bug Fixes

- **api-surface:** point require conditions at the emitted .d.cts declarations [B12] ([256151d](https://github.com/stevenwcarter/which-key/commit/256151dbc5eeb99125265005037ce1ee89b4e8a0))
- **caching:** add allocation-free hasCandidates for the keystroke hot path [B6] ([f899327](https://github.com/stevenwcarter/which-key/commit/f899327c625805f948e941d74cad97b123d0f9c4))
- **caching:** skip no-op snapshot emissions on unmatched keystrokes [B5] ([4f15eaf](https://github.com/stevenwcarter/which-key/commit/4f15eaf046eff861331f883106336de447a623c1))
- **correctness:** accept modifier names case-insensitively as documented [B11] ([b446549](https://github.com/stevenwcarter/which-key/commit/b44654938dea83db3a3d0b8e51e750d56427e3d1))
- **correctness:** resolve keydown target lazily so SSR does not crash [B1] ([69ad112](https://github.com/stevenwcarter/which-key/commit/69ad1123de580a3f7f992a944e2f9f4657d66043))
- **correctness:** warn when Shift is dropped from punctuation keys [B2] ([b362efc](https://github.com/stevenwcarter/which-key/commit/b362efccbcb42427244fd88bbe5d23c24146e4fb))
- **frontend:** announce the leader popup as a polite live region [B7] ([02d83ce](https://github.com/stevenwcarter/which-key/commit/02d83ce7af7291683b58cdf7a71fa56db768a2f7))
- **frontend:** correct and complete the documented CSS class contract [B13] ([156079e](https://github.com/stevenwcarter/which-key/commit/156079e7ba168466eb7505ba0f692c89c3578548))
- **frontend:** trap and restore focus in the cheatsheet dialog [B3] ([45489fe](https://github.com/stevenwcarter/which-key/commit/45489fe234919b42ba7b4bcbb88b8fe3ffc382a4))
- **matcher:** narrow input-echo latch to character-echoing keystrokes [Findings 1, 3] ([885d214](https://github.com/stevenwcarter/which-key/commit/885d214e6a77607faf49434457b88af88e96ce43))
- **observability:** contain handler exceptions and reset matcher state [B4] ([0467eb9](https://github.com/stevenwcarter/which-key/commit/0467eb96462bb8d33d64fdd02f68c6ef097de888))
- **observability:** warn only on genuine same-level shortcut collisions [B8] ([ae2b58f](https://github.com/stevenwcarter/which-key/commit/ae2b58f44a8e59a3cb5b1e18b7d4fbba9809b569))
- **security:** latch the input-touched flag on every buffer commit [B9] ([0e18d55](https://github.com/stevenwcarter/which-key/commit/0e18d55580454426d8714c913d234e5c847b3e0a))
- **security:** never render buffered keystrokes typed into text fields [B9] ([89487db](https://github.com/stevenwcarter/which-key/commit/89487db8228b0ac9f33319fa6244429a69cd15f6))
- **security:** resolve the composed event target so shadow-DOM inputs are guarded [B10] ([6a8b94d](https://github.com/stevenwcarter/which-key/commit/6a8b94de58c286efd758f5b08ad876c9a211be11))
- **security:** suppress popup display for buffers touched inside text fields [B9] ([27f43cf](https://github.com/stevenwcarter/which-key/commit/27f43cf9180068b578d37cbdb4a61b5d22576396))

## 0.1.1 (2026-06-18)

### Features

- **engine:** pushLayer handle, activateLayer, global help ([464eefc](https://github.com/stevenwcarter/which-key/commit/464eefc68b304a316be78702482ded2b1d422b86))
- **engine:** registry layer state + reachability resolution ([3cb820f](https://github.com/stevenwcarter/which-key/commit/3cb820f61e03ec32c34724c7470f192990114645))
- **react:** <WhichKeyLayer> and level-aware hooks ([29f2d69](https://github.com/stevenwcarter/which-key/commit/29f2d698fe3ff6da8f52001c60554e229d63d712))
- **which-key:** add framework-agnostic createWhichKey engine controller ([1056108](https://github.com/stevenwcarter/which-key/commit/10561084f4fbdf211ff604717eb460eab64e320c))
- **which-key:** React binding (provider + hooks) over the engine ([3a59bf9](https://github.com/stevenwcarter/which-key/commit/3a59bf9a34ff2a08f36d4692108b2527b33f7741))
- **which-key:** React popup + cheatsheet UI with prebuilt wk-\* stylesheet ([7aa5b76](https://github.com/stevenwcarter/which-key/commit/7aa5b7602d8389ff0840e85e568056cb4c929736))
- **which-key:** zero-dependency vanilla-DOM renderer ([b7fcc88](https://github.com/stevenwcarter/which-key/commit/b7fcc88e317ce7d146da294e4287645aee464ad0))

### Bug Fixes

- **which-key:** add getServerSnapshot for SSR; document mount-time props + client-only UI; CI node matrix ([d264371](https://github.com/stevenwcarter/which-key/commit/d2643710d80c8f52c04d54a3560dae6581e62023))
- **which-key:** address final-review nits (this-free pushLayer, ?-toggle + StrictMode tests, vanilla example guard) ([985b594](https://github.com/stevenwcarter/which-key/commit/985b594f0a3d6388fbf1cd7384dd629bef603c1b))
- **which-key:** defensive-copy currentSequence into snapshot; test registerGroup unregister thunk ([9ea0ccb](https://github.com/stevenwcarter/which-key/commit/9ea0ccbc9d824634b7ff77facd4bac7e5724dd41))
- **which-key:** drop static gridAutoFlow inline style; assert help-entry excluded from cheatsheet ([80632d6](https://github.com/stevenwcarter/which-key/commit/80632d6ae3020963fb723bdedcde7e08b32a9125))
- **which-key:** make React provider tests reactive; assert group unregister; merge import ([61f3d52](https://github.com/stevenwcarter/which-key/commit/61f3d52725cff943284b36106e1ed228a9259b30))
