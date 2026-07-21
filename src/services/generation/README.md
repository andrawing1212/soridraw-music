# SORIDRAW generation engines

Each generation version owns its creative assembly, lyric style, rules, examples,
and output normalization. Version-specific creative modules must not be shared.

- `v1/`: current Classic five-line engine. The first Gemini response owns one locked
  Section Performance Plan and one locked Style Intent Plan. Every selected Style item is routed by
  function: Hybrid stays in Genre identity; Vocal Line and Special Effects control vocal execution;
  Era Texture is protected in Genre/Arrangement; Transition, Space, Narrative, Hook Line, and Rhythm
  each control their proper prompt and lyric destinations. Korean and secondary-language cards share
  one role-linked Hook Blueprint. It resolves the current structure's Chorus, Hook, Refrain, Main Theme,
  Theme, Final Hook, or Climax chain before applying slogan, anchor, response, preview, variation,
  anti-chorus, Drop Hook, or negative-space design, so the feature follows the selected structure instead
  of assuming Stable Chorus names. Rhythm choices control breath groups, stress,
  line length, pause, and repeated cells without becoming lyric subject matter. The visible [Arrangement]
  still summarizes only signature identity, decisive transition, and final payoff; local section sound
  cues remain in the lyrics. Genre identity remains capped at three identities and two mood accents, and
  the Suno budget guard preserves protected era/style anchors while keeping the final five-line prompt at
  or below 1,000 characters. The public-output guard also repairs malformed cue conjunctions, keeps guitar-amp tone attached to guitar, removes arrangement-only groove labels from [Instruments], limits each section to one local production cue, rejects Outro-like fade events misplaced under Intro, rejoins pathological Korean micro-fragments, and removes empty trailing section skeletons. The 21 Hook Line controls show the actual role-linked target chain and validation status. Literal lyric examples and stock lyric phrase pools are not passed into generation; the real hook comes only from the current Story Context. Stable mode is now a hard public contract: it always renders Intro → Verse 1 → Pre-Chorus 1 → Chorus 1 → Verse 2 → Pre-Chorus 2 → Chorus 2 → Bridge → Final Chorus → Outro. Rap roles may own rhythmic Verse 2 delivery but can no longer replace the section with Rap Section. Blank-line paragraphs are never reclassified as missing sections. Missing/extra/out-of-order numbered V1 sections trigger the targeted structure repair instead. The large legacy body remains in `geminiService.ts` until a later safe migration.
- `v2/`: existing V2 song, prompt, and lyric implementation now lives inside
  this folder.
- `v3/`: isolated high-freedom single-call engine under construction.
- `shared/`: routing and non-creative technical types only.

Shared code must never decide story, scene, mood interpretation, lyric style,
prompt wording, or post-generation creative rewriting.

## Engine map

See `docs/SORIDRAW_ENGINE_MAP.md` for the current active engines, application order,
and ownership boundaries.

## 43 Vocal Layer + Hook Line rebuild (40 Stable baseline)

The 41/42 hook experiments are superseded. This rebuild starts from the 40 Stable hard-lock baseline and
keeps the exact public structure contract unchanged.

Sound category `Vocal Effects` is renamed to `Vocal Layers` (`보컬 레이어`). Its IDs stay unchanged for
saved-data compatibility. Vocal Layers provide auxiliary voices—humming, choir, chant, harmony, shouts,
and vocal samples—but they do not write the chorus lyric structure by themselves.

The Hook Line menu exposes 21 controls across five independent dimensions:

- form: Short Hook Repeat, Repeated Slogan, One-line Hook, One-word Hook, Melody Hook;
- placement: First-line Anchor, End-line Anchor, Hook Preview, Post-Chorus Tag, Circular Refrain;
- repetition: Fixed Chorus, Progressive Repeat, Variation Repeat;
- vocal structure: Chant Hook, Call-response Hook, Echo-response Hook, Easy-sing Chorus;
- chorus structure: A/B Split Chorus, Drop Hook, Anti-chorus, Negative-space Hook.

`Singalong Point` is no longer a Hook Line item. Older saved values migrate to Sound > Vocal Layers >
Group Chant. Call-response requires either two or more declared vocalists or a responsive Vocal Layer such
as Group Chant, Crowd Chant, or choir. In an unsupported solo setup it is blocked in the selector and is
reported as incompatible rather than silently inventing a second singer.

Each selected control owns a separate generation contract and verifier. Call-response requires a distinct
call, a meaningfully different answer, and an explicit second-vocalist or responsive-layer cue. Echo-response
uses a shorter fragment of the primary hook and cannot satisfy call-response. Easy-sing rejects unfinished
English dependent clauses. One-word Hook passes only when its micro-hook appears as a standalone repeated
line. Text validation, structural availability, vocal compatibility, and audio-only confirmation are shown
separately inside Applied Keywords > Hook Design.

Stable never invents Drop, Post-Chorus, or Refrain section tags. Drop Hook becomes one embedded vocal-drop
event at the end of the first suitable existing core target, and Circular Refrain returns the same phrase through existing
Intro, Chorus, Final Chorus, and Outro sections. Post-Chorus Tag remains inside the available hook section.
Only a structure with no usable core target is marked `target-missing`. Lyric Preserve mode remains untouched.

## 45 Fixed Chorus + evolving chorus contract

- Default V1 behavior is no longer full Chorus-body duplication. Chorus 1 introduces the hook, Chorus 2 keeps only the selected hook/anchor while updating at least one surrounding line from Verse 2, and Final Chorus keeps recognition while updating at least one surrounding line from the Bridge/payoff.
- `Fixed Chorus` is the only control that copies the complete Chorus 1 sung lyric body into Chorus 2 and Final Chorus. Section tags, local cues, vocal layers, harmony, ad-libs, and production energy may still grow.
- One-line Hook, First-line Anchor, and End-line Anchor lock only their named line positions. They never imply a full-chorus copy.
- The same-call Hook Blueprint now returns Chorus 2 and Final Chorus shift lines so the final guard can repair an accidentally duplicated chorus without a second Gemini request.

### 46차 Hook plan public summary
- Hook Blueprint의 공개 요약은 모델 자유 텍스트가 아니라 선택 기능 기반 결정값을 사용한다.
- Fixed Chorus: 적용 위치는 Chorus 1/2/Final, 가사 반복은 세 후렴 전체 동일 반복으로 고정한다.
- 훅 호흡과 가창 구조는 해당 기능을 실제 선택했을 때만 표시한다.

## 47 Common core-section role engine

- Hook Line no longer assumes `Chorus 1 → Chorus 2 → Final Chorus`. The V1 section blueprint is resolved into a core hook family: `Chorus`, `Hook`, `Refrain`, `Main Theme`, or `Theme → Climax`.
- Stable keeps its exact ten public sections. Drop Hook is embedded once at the end of Chorus 1, the first suitable core target, and never creates `[Drop]`. Circular Refrain reuses the same Story Context hook across existing Intro, Chorus returns, Final Chorus, and Outro without creating `[Refrain]`.
- Recommended and Experimental use an existing `Drop`, `Refrain`, `Final Hook`, or `Climax` when their selected blueprint contains it. Otherwise they use an embedded target only when a valid core hook chain exists.
- Custom preserves the user's section order and tags. Existing Hook/Refrain/Drop targets are respected; a custom structure with no core target returns `target-missing` rather than receiving an invented section.
- Public Hook Design now exposes deterministic `structure mode`, `core target sections`, `structure condition`, and `vocal condition`. Statuses distinguish applied, failed, vocal-incompatible, comparison-not-required, audio-check, and target-missing.
- Fixed Chorus, evolving returns, anchors, preview, Circular Refrain, and Drop Hook all use the same resolved role plan. Lyric Preserve mode, Firebase data, and API call count are unchanged.
- Deterministic tests cover all 21 public Hook Line contracts, Stable/Recommended/Experimental/Custom routing, real and embedded Drop behavior, Refrain and Theme/Climax chains, unsupported solo call-response, Preserve mode, and custom user-named section boundaries.

## 48 Hook output formatting guard

- Wrapped structural tags such as `[Verse\n1 : cue]` are collapsed before every final V1 lyric cleanup.
- Pathological Korean hard-wrapping is reflowed only when a sustained run is clearly fragmented; normal short hook lines remain untouched.
- Circular Refrain verification compares normalized text across adjacent lyric lines, then restores an exactly split refrain phrase to one visible line.
- Embedded Drop Hook cues remain directly attached to their owned final hook line. Chorus-evolution repair now replaces sung slots in place instead of hoisting all standalone cues to the section top.
- Duplicate cue-only Intro headers and trailing bare Outro skeletons are removed again at the true public-output boundary.
- No additional Gemini call, section insertion, Firebase change, or storage migration is introduced.

## 49 Embedded Drop block + lyric line preservation

- Stable embedded Drop Hook is normalized only at the final public-output boundary. If Gemini places
  `[brief beat drop under the vocal hook]` at the top of Chorus, the formatter removes that occurrence
  and relocates the cue directly before the final repeated hook line at the end of the first core section.
- The Drop Hook verifier now requires the cue and repeated hook to be adjacent at the section end. A cue
  anywhere else in Chorus no longer passes merely because the final hook line also exists.
- Generated Korean and mixed-language lyric lines are no longer split by a 24-character formatter rule.
  Existing model line boundaries are preserved. Only a clearly pathological run of many micro-fragments
  is repaired, and the recovered phrase remains one line instead of being split again by character count.
- Combined Hook Line controls keep independent validation statuses, so Circular Refrain may pass while
  Drop Hook fails when its owned cue/hook block is misplaced.
- No extra Gemini call, section insertion, Firebase change, storage migration, or API-count change is added.

## 50 Absolute V1 return boundary for embedded Drop Hook

- `generateSongLegacy()` keeps the resolved Hook Blueprint only as a temporary internal field until the
  public `generateSong()` wrapper finishes the shared hard-ban pass and its final section repair.
- V1 lyrics now pass through one absolute return boundary in this order: structural safety -> section
  blueprint guard -> public lyric integrity -> embedded Drop Hook final slot -> verification -> return.
- For Stable embedded Drop Hook, the last two non-empty lines of Chorus 1 are deterministically forced to
  `[brief beat drop under the vocal hook]` followed by the repeated hook line. Any earlier copy of the cue
  is removed, and no later normalizer is allowed to move the block again.
- Applied Keywords > Hook Design is recalculated from the exact Korean/secondary lyric strings returned to
  the UI. A pre-final result can no longer show Drop Hook as applied when the returned lyric block is wrong.
- No additional Gemini request, structural section, Firebase change, storage migration, or API-count change
  is introduced.

## 68 Language Mix quality rollback

- Current UI, design, language selectors, ratio selector, section structure, saved data shape, and Firebase integration remain unchanged.
- The V52–V67 deterministic Language Mix repair stack is retired from the active source. The following files are removed:
  - `src/services/generation/v1/language/index.ts`
  - `src/services/generation/v1/language/languageArrangementDirector.ts`
  - `src/services/generation/v1/language/languageMixEngine.ts`
  - `src/services/generation/v1/sections/oneWordHookGuard.ts`
- `geminiService.ts` returns to the V50 one-pass lyric ownership model: the first Gemini response owns language placement and ratio direction. Existing pre-V52 catastrophic sparse-structure repair, hard-ban correction, tag cleanup, and public-output safety may still run, but none of them receives a language-ratio quota or stock replacement phrases.
- Post-generation phrase injection, fixed fallback lyric pools, line-by-line language replacement, ratio convergence loops, same-call repair slots, exact-position repair calls, and Language Mix audit mutation are removed.
- The selected ratio is still sent to Gemini as an approximate whole-song direction. It is not an exact quota and cannot override Story Context, character voice, natural diction, section progression, hook identity, or singability.
- No literal lyric-content example is used to explain repetition or language mixing. Format-only section-tag examples remain allowed because they describe syntax rather than song content.
- Stable section recovery and exact public section naming added after V50 remain active in `sectionGuard.ts`; they do not rewrite lyric meaning.
- The existing Language Mix audit UI stays hidden when no audit payload exists. No Firestore/Auth/Functions migration or existing-user data change is required.

## 69 Circular Refrain absolute-return repair

- The root cause was ordering, not the role plan: Circular Refrain was bound before the shared hard-ban,
  structural guard, section-performance plan, and public-output cleanup, while only Embedded Drop Hook
  was rebound at the absolute return boundary.
- The final V1 boundary now rechecks only the already selected `circular-refrain` contract, using the
  current song's resolved Hook Blueprint phrase. It does not contain a stock lyric phrase or example.
- Missing returns are restored only inside existing sections already chosen by `hookRoleEngine.ts`.
  No Refrain, Chorus, Intro, Outro, or other structural tag is invented, and Lyric Preserve mode is untouched.
- Refrain/core-hook targets receive the resolved phrase as a sung line; opening/closing targets receive the
  same resolved phrase as a parenthetical return. Existing valid returns are not duplicated.
- The circular repair runs immediately before the existing Embedded Drop absolute-slot repair, so Drop Hook
  keeps ownership of the final cue-plus-hook pair in its target section.
- Other Hook Line controls, non-circular structures, UI, Firebase/Auth/Firestore/Functions, storage shape,
  API-call count, and language-mix rollback behavior are unchanged.

## 70 Language Mix ratio-contract restoration

- Restores the pre-repair-stack language-mix ownership rule that was accidentally weakened in V68: the selected ratio is again a mandatory first-generation contract for actual sung lyric body lines.
- Supports the full active UI range independently: 10%, 20%, 30%, 40%, 50%, 60%, and 70%. Values are not collapsed into a few broad presets.
- Section tags and standalone production/sound cues are excluded from ratio counting. A mixed line counts only when it contains a meaningful phrase or complete short lyric thought in the selected target language; isolated fillers and repeated micro-tokens do not satisfy the contract.
- The first Gemini response writes the complete mixed lyric from the start. No stock lyric phrase, fixed translation pool, per-line replacement candidate, or convergence loop is restored.
- A read-only script-aware audit checks the generated lyric card. When a measurable ratio misses the selected target beyond one practical lyric-line step, the complete affected card may be regenerated once with the same Story Context, Hook Blueprint, section sequence, vocal ownership, and approximate line count.
- The one-pass retry is accepted only when it preserves the exact structural section sequence, keeps lyric length within a narrow range, and moves the measured ratio closer to the selected target. Otherwise the first lyric is preserved.
- Same-script language pairs that cannot be reliably distinguished by Unicode script are not mechanically rewritten by the audit; their ratio remains governed by the mandatory initial Gemini contract.
- Circular Refrain and Embedded Drop Hook absolute-return guards, all other Hook Line controls, UI/design, Firebase/Auth/Firestore/Functions, and saved data shape are unchanged.

## 71차 Language Mix section-skeleton guard

- The 70차 whole-lyric ratio retry is now forbidden from redistributing lyric mass between sections.
- Each retry receives a dynamic skeleton taken from the first generated lyric card: exact section order and the exact number of sung lyric lines inside every existing section.
- A retry candidate is rejected when it adds untagged lyric lines, changes any per-section sung-line count, adds/removes/merges/splits a structural section, or introduces a new Section Role Engine issue such as an Outro restarting the story.
- This is not a fixed lyric template or stock-content rule. The locked counts come from the current song itself, and lyric wording/language placement remains free inside those existing slots.
- When the retry cannot improve the selected 10–70% ratio without preserving the section skeleton, the first generated lyric is kept. Section integrity takes priority over accepting a structurally damaged ratio correction.
- No stock lyric phrase, translation pool, line-by-line replacement, extra section, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 72차 Language Mix quality-first regression fix

- The failure was caused by the 71차 retry acceptance guard, not by the language selector or ratio value. A valid mixed-language retry was being discarded whenever its per-section sung-line count differed by even one line or any unrelated new Section Role issue appeared, so the first single-language lyric was returned unchanged.
- The pre-existing whole-lyric Language Mix method remains in place. The first Gemini response still writes the complete lyric, and only a missing or severely underrepresented selected language can trigger one whole-card retry.
- Ratio values from 10% through 70% are approximate musical directions. Story Context, natural diction, section role, hook identity, and singability take priority over exact percentage matching.
- The 71차 exact per-section line-count lock is removed. Retry safety returns to the existing section sequence and approximate total-length check, with only critical section-shape regressions blocked: overgrown Intro/Outro, weakened Final payoff, damaged Refrain identity, and overgrown compact sections.
- Untagged lyric text before the first section is rejected. Stock phrases, fixed translations, line-by-line replacement, ratio convergence loops, new section architecture, and user-data changes remain absent.

## 73차 Section Blueprint final ownership and numbered-section recovery

- Root cause 1: legacy public lyric cleanup runs after the V1 Section Blueprint Guard and flattens chronological labels for matching, so exact engine names such as `Verse 1`, `Verse 2`, `Pre-Chorus 1`, and `Chorus 2` can disappear before the lyric reaches the UI.
- Root cause 2: Language Mix retry validation compared the retry only with the first lyric. When the first lyric was already missing a required section, the retry could preserve the same broken map and still pass.
- Root cause 3: the V1 catastrophic repair could accept a full rewritten lyric based mainly on retained lyric mass without rechecking the exact active blueprint.
- The public cleanup now runs first at the absolute return boundary. The Section Blueprint Guard runs after every legacy cleanup and becomes the final structural owner; hook-slot binding remains after it.
- Recommended, Stable, Experimental, and Custom Language Mix retries must satisfy the active numbered engine blueprint itself. User-created nonstandard Custom names remain unchanged.
- Missing required sections are repaired in place. Only the missing section body is requested from Gemini; all existing lyrics, hook lines, section order, singer ownership, production cues, and language-mix style remain untouched.
- The missing-section repair contains no fixed lyric, scene, language phrase, or line quota. It is activated only for a catastrophic engine-owned structure failure.
- Stable and other auto-numbered structures keep the exact chronological labels defined by the blueprint. Firebase/Auth/Firestore/Functions and saved-data formats are unchanged.



## 76차 Numbered section ownership contract

- Recommended, Stable, Experimental, and Custom now use one public numbering rule for chronological lyric families: `Verse 1/2`, `Pre-Chorus 1/2`, `Chorus 1/2`, and the same 1-based rule for Hook, Refrain, and Rap Section when present. Unique Intro, Bridge, Final Chorus, and Outro remain unnumbered.
- Stable is fixed as `Intro → Verse 1 → Pre-Chorus 1 → Chorus 1 → Verse 2 → Pre-Chorus 2 → Chorus 2 → Bridge → Final Chorus → Outro`.
- Custom structures may still use user-created nonstandard section names, but every standard chronological family is numbered at generation time even when it appears only once, so no public Verse/Pre-Chorus/Chorus/Hook/Refrain/Rap Section remains bare.
- Exact numbered names, not flattened family names, are now used by catastrophic structure validation and Language Mix retry compatibility. The V2 sanitizer follows the same public numbering contract instead of stripping numbers from valid tags.
- The Section Guard no longer guesses section boundaries from blank-line paragraphs, copies a neighbouring Chorus into a missing slot, moves lyrics out of instrumental sections, or pours unknown/third-duplicate blocks into the nearest Chorus, Bridge, Final Chorus, or Outro.
- A bare Gemini tag such as `[Chorus]` may be sequentially matched to the next available numbered Chorus, but a third duplicate has no owner and is discarded rather than contaminating another section. Generic Chorus can never be matched to Final Chorus.
- Missing required bodies remain owned by the existing targeted missing-section Gemini repair. No stock lyric, fixed scene, phrase pool, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 77차 Section density, Outro, and final hard-ban guard

- Generated lyric line breaks are authoritative. The Korean fragmentation repair no longer joins consecutive short hook, chant, echo-response, or breathing lines into one long Chorus sentence; it only repairs malformed multiline bracket cues and redundant nested parentheses.
- Whole-line nested ad-libs such as double-wrapped echo responses are normalized to one parenthesis layer before hook matching, so echo formatting cannot grow additional wrappers at the final return boundary.
- In normal vocal songs, Outro is a required lyric-bearing closing section. A lyric-free Outro is allowed only when the user explicitly requests an instrumental/no-vocal ending; otherwise an empty Outro is a targeted missing-section repair target and cannot pass the final structural assertion.
- Verse and Rap Section are development sections. When one is severely underdeveloped relative to another section in the same family and the user did not explicitly request a one-line/very short section, only that section body is regenerated in place. Existing section tags, cues, hook identity, language style, and all other lyrics remain untouched.
- The exact final visible lyric now receives the dynamic admin/user hard-ban check after final hook and section binding. Hard-ban cleanup is fail-closed: a forbidden term cannot be silently returned when cleanup fails, and no old Hook Blueprint text is rebound after the final hard-ban pass.
- No fixed lyric phrase, scene, replacement pool, fixed section line count, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 78차 Section repair fail-open completion fix

- The 77차 failure dialog was caused by a soft section-quality condition being promoted to a fatal public-return assertion. A one-line Verse or another relative-density issue could remain after the single local repair attempt, and the completed song was then discarded.
- Relative Verse/Rap density remains eligible for one targeted in-place repair, but it is no longer classified as catastrophic. If the repair keeps the section compact, the completed song is preserved instead of launching a whole-lyric rewrite or failing generation.
- The post-hard-ban stage no longer reruns destructive empty-section cleanup. Hard-ban edits lyric-body lines only, so the exact numbered section ownership already fixed at the absolute-return boundary is preserved.
- Final section diagnostics are fail-open: true ownership/order warnings are logged for inspection, but a completed title, prompt, and lyric are not converted into a generation failure.
- Exact numbered section order, missing required-section repair, Outro repair attempt, hard-ban inspection, hook binding, language mixing, Firebase/Auth/Firestore/Functions, and saved-data shape remain unchanged.

## 79차 Custom Section performance parity fix

- Custom structure keeps the user's exact numbered section order, custom names, Stop/Break/Instrumental ownership, and explicit custom cues, but no longer bypasses the V1 Section Performance Plan at the public return boundary.
- The same current-song performance contract now applies to Custom and built-in structures: every sung or vocal-ad-lib section with a real body must receive a valid local performance cue, and multi-vocal sections must retain an active singer anchor.
- Custom/nonstandard sung section names are resolved through the active Section Blueprint instead of a fixed standard-name list. Transition and instrumental entries remain lyric-free and are excluded from vocal-cue enforcement.
- Section-role diagnostics for Main/Lead/Rap ownership and shared final payoff now also inspect Custom songs. Existing user/director overrides still suppress only the specific default role rule they explicitly replace.
- No stock performance phrase, fixed singer assignment, lyric rewrite, section reorder, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 80차 Section cue independent visibility toggles

- Adds two compact controls directly below Section Structure: `보컬 큐` and `악기 큐`. Both default to ON for backward compatibility, and the visible row contains only the label and ON/OFF switch; detailed guidance is shown through the existing help popup.
- The switches control only the public lyric notation layer. Section Role Engine, numbered Section Blueprint ownership, multi-vocal assignment, Section Performance Plan, Hook Blueprint, and internal Arrangement planning remain active in all four combinations.
- Vocal cue OFF removes visible delivery/phrasing/register wording from section tags. Multi-vocal songs still retain the singer/role anchor required for ownership, while solo songs may use the bare numbered section tag.
- Instrument cue OFF removes standalone instrument, production, transition, and arrangement cue lines from the public lyric. It does not disable the internal musical plan or future cue-quality improvements.
- The four combinations are supported independently: ON/ON keeps both cue types, ON/OFF keeps vocal cues only, OFF/ON keeps instrument cues plus required singer ownership, and OFF/OFF keeps only structural tags, required singer ownership, lyrics, and ad-libs.
- The selected flags are stored in `appliedKeywords.sectionCueOptions`, restored when prior settings/templates are reapplied, and passed through V1 generation, V2 generation, and lyric-only regeneration. Missing legacy values resolve to ON/ON.
- No Firebase/Auth/Firestore/Functions/Rules change, storage migration, API-count change, or existing lyric-content hardcoding is introduced.

