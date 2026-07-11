# 1.0.0 (2026-07-11)


### Bug Fixes

* **accounts:** stop edits resetting cash account category ([4755c69](https://github.com/merendamattia/ledgerly/commit/4755c69453105181d292488b5cec3b8cb0ed2b30))
* **backend:** copy workspace node_modules in Docker ([53a074d](https://github.com/merendamattia/ledgerly/commit/53a074dbffe3a4993c6076a4a84df3b6f7c42da3))
* **charts:** pad net worth y-axis symmetrically ([67c192e](https://github.com/merendamattia/ledgerly/commit/67c192e6d68b5567f74aa123ff4f367847b75e69))
* **charts:** tighten net worth y-axis bounds ([6c3c1f8](https://github.com/merendamattia/ledgerly/commit/6c3c1f85bd811c9e5eb18b8646e122fe44807f97))
* **ci:** satisfy TypeScript and React lint checks ([3d3f5c9](https://github.com/merendamattia/ledgerly/commit/3d3f5c988ece52a4adde0dc1ede8f9d9f919d9a7))
* **cron:** run nightly price update at 02:20 ([818703a](https://github.com/merendamattia/ledgerly/commit/818703a3853438161c51040cc20cfc4c8e958c33))
* **cron:** update persisted nightly price schedule ([99fe44a](https://github.com/merendamattia/ledgerly/commit/99fe44a573dd349d0778bc3dde7c28aeaf7b8266))
* fix privacy mode state initialization ([1ee2907](https://github.com/merendamattia/ledgerly/commit/1ee2907bc53a9ec309ec1af4a1bacb0ca9061793))
* **frontend:** align period performance display across overview and investments ([1b32183](https://github.com/merendamattia/ledgerly/commit/1b321831f7aa2289f17c56396025872d393eafdb))
* **investments:** make snapshot panel legible on mobile ([22a696e](https://github.com/merendamattia/ledgerly/commit/22a696eb8eab13bd612bffbfda3efbc2f620b50b))
* **layout:** widen bottom padding to clear fixed nav bar ([ffb5617](https://github.com/merendamattia/ledgerly/commit/ffb561776beb11434b180cbe0269ad62d3916a0c))
* separate future movements from current totals ([1796e27](https://github.com/merendamattia/ledgerly/commit/1796e27f4b8c850cafb67c15b8b9ff197657f71b))
* **ui:** keep detail popups bound to live query data ([2cda071](https://github.com/merendamattia/ledgerly/commit/2cda071e4acee1173f537c468e7465ae51aee495))
* update Button component to include nativeButton prop ([50afd39](https://github.com/merendamattia/ledgerly/commit/50afd39f5ed81c03dd39f6cd8997a2eb968644e0))


### Features

* activity list pages 10 (desktop) / 5 (mobile) with a primary Load more. ([b25437d](https://github.com/merendamattia/ledgerly/commit/b25437da5a6b8ba9ec92c129aa6ec9f9074f1f45))
* add asset matrix dashboard ([049791c](https://github.com/merendamattia/ledgerly/commit/049791c490aa9b9abee5cc035dadd821758b8956))
* add bulk snapshot deletion by category ([1ec309d](https://github.com/merendamattia/ledgerly/commit/1ec309d743f8ad89f1f295ebbb89b23cf422969d))
* add investment transaction management components and hooks ([308bf79](https://github.com/merendamattia/ledgerly/commit/308bf79d75cdf710ded95f84966ae3ffbf512931))
* **assets:** rename a tracked asset ([64e72cc](https://github.com/merendamattia/ledgerly/commit/64e72cca0454cd0f06024ab1ec9e6185a0e7f134))
* **bonds:** anchor back-dated bond history at purchase price ([ae4a876](https://github.com/merendamattia/ledgerly/commit/ae4a8768945b9095e4ab2ea46cb4b5f2f92ee172))
* **bonds:** price bonds nightly via Yahoo live quote ([22b51fa](https://github.com/merendamattia/ledgerly/commit/22b51faabf102f9c921a896d2a330ab1cea8bccb))
* **cashflow:** rebuild cash flow page with period picker and analytics ([0fb421e](https://github.com/merendamattia/ledgerly/commit/0fb421ec35c11ecf9d33e8a082a2e0c7a1f8fcc2))
* **cashflow:** split investments from spending, stack in charts ([7f7c9a3](https://github.com/merendamattia/ledgerly/commit/7f7c9a3935b1bfefb8b4af22382173ef3e81a89a))
* **categories:** add per-category emoji ([53669d6](https://github.com/merendamattia/ledgerly/commit/53669d6b46c3583c6a828a4863c8fe0da28d8eb0))
* **cron:** split nightly job into prices, fx, snapshots ([da4b0db](https://github.com/merendamattia/ledgerly/commit/da4b0db79e73f9e0f853e083f468b016379432f3))
* **expenses:** add cached hashtag endpoint ([bdb64a2](https://github.com/merendamattia/ledgerly/commit/bdb64a267a5c475005b884e788619f5014860745))
* **frontend:** add branded app icons ([1c8bd45](https://github.com/merendamattia/ledgerly/commit/1c8bd458798b6e932399d3176e4b6e400227355d))
* **frontend:** add persistent privacy mode for financial values ([d80bbe7](https://github.com/merendamattia/ledgerly/commit/d80bbe7a49bc3057941447aa064d734c0b1e0335))
* **frontend:** dynamic chart axis, trim cents, mobile bars ([cc9be01](https://github.com/merendamattia/ledgerly/commit/cc9be01f267a73bc59dd4339037e7bb7fe2bc1c9))
* **frontend:** group movements by day in a reusable list ([e5da470](https://github.com/merendamattia/ledgerly/commit/e5da470dae33d43b50ea7d7176cb22253f79828d))
* **frontend:** mobile-first responsive overhaul ([9e1e8e1](https://github.com/merendamattia/ledgerly/commit/9e1e8e10f6239456a3dbbb5e1cfe633c96870293))
* **frontend:** mobile-first responsive overhaul ([08b7d2a](https://github.com/merendamattia/ledgerly/commit/08b7d2ac0dbea0d0037baede7edc960c48e6c539))
* **frontend:** reskin UI to "Modern Ledger" design ([3ca70f8](https://github.com/merendamattia/ledgerly/commit/3ca70f82ace87cc3cef896e99999939eb05b844e))
* **investments:** add rebalancing and 4-pillars cards ([8877682](https://github.com/merendamattia/ledgerly/commit/88776822476f92138b8ad213846d8e8025a51d1c))
* **investments:** configurable CSV column mapping on import ([7ddfde9](https://github.com/merendamattia/ledgerly/commit/7ddfde93d8dc8057863794104bfccf8755266814))
* **investments:** persist notes for snapshot fields ([b5f6977](https://github.com/merendamattia/ledgerly/commit/b5f697769cdcbfa6ec80039a2c7a6dcd74c2bb0e))
* **investments:** position metrics, movement drawer, rail sidebar ([6a311ae](https://github.com/merendamattia/ledgerly/commit/6a311ae3f7c17317549f99a53dc2f5515480ba97))
* **investments:** redesign portfolio page + slide-in add ([9592c26](https://github.com/merendamattia/ledgerly/commit/9592c2609878b6af8138640d982057fd9c79ea34)), closes [#5b7d10](https://github.com/merendamattia/ledgerly/issues/5b7d10)
* **investments:** timeframe-synced charts + dashboard ([5e5f590](https://github.com/merendamattia/ledgerly/commit/5e5f590693f7f0a38e3ba4edfbafb2d83cf80571))
* **matrix:** add cash-flow matrix with view selector ([89b840c](https://github.com/merendamattia/ledgerly/commit/89b840c47792306da18fa285028f1523ef64cc73))
* optimize ledger workflows and self-host app fonts ([9279481](https://github.com/merendamattia/ledgerly/commit/9279481d5e5b9bf8a88155c485e7990f7c990f24))
* **rebalance:** row detail popup + rebalance-now plan ([68bed72](https://github.com/merendamattia/ledgerly/commit/68bed723366d6221a3e0c29a62d0a32c80b9eac9))
* remove cashAccountId references and related functionality ([fbcdeb7](https://github.com/merendamattia/ledgerly/commit/fbcdeb7bb52e7c98206be4f108083d9973fcb2e9))
* remove category color and add database browsing functionality ([911245d](https://github.com/merendamattia/ledgerly/commit/911245d8c773fb88055e27568b424b540574bd53))
* remove CoinGecko integration and update related documentation ([b350108](https://github.com/merendamattia/ledgerly/commit/b3501085893066b39fcc1300e2afb47b69efb057))
* snapshot CSV import, cash categories, bond/commodity tickers ([79c319b](https://github.com/merendamattia/ledgerly/commit/79c319b6aa722e6b7be4cfac44bfc4ebbb3324a3))
* **transactions:** recurring movements and note hashtag tags ([f009f0b](https://github.com/merendamattia/ledgerly/commit/f009f0b46b6b29db885acabca2473c6c58ecd5c5))


### Performance Improvements

* **frontend:** lazy-load heavy dialogs, cache formatters ([f10492b](https://github.com/merendamattia/ledgerly/commit/f10492b66d2bd193d41e6eeb17666986272bc610))
* **import:** scope dedupe to imported date/ticker range ([fba2d4a](https://github.com/merendamattia/ledgerly/commit/fba2d4a11c4cb83177cfa0566a202cfa92646444))
* **prices:** batch latest quotes Redis-first ([d3104ba](https://github.com/merendamattia/ledgerly/commit/d3104ba03ed60c27e02271ffb5a9afff33942021))
