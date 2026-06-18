# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
