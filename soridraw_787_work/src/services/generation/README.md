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
- Supports the full active UI range independently: 5%, 10%, 20%, 30%, 40%, 50%, and 60%. Values are not collapsed into a few broad presets.
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
- When the retry cannot improve the selected 5–60% ratio without preserving the section skeleton, the first generated lyric is kept. Section integrity takes priority over accepting a structurally damaged ratio correction.
- No stock lyric phrase, translation pool, line-by-line replacement, extra section, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 72차 Language Mix quality-first regression fix

- The failure was caused by the 71차 retry acceptance guard, not by the language selector or ratio value. A valid mixed-language retry was being discarded whenever its per-section sung-line count differed by even one line or any unrelated new Section Role issue appeared, so the first single-language lyric was returned unchanged.
- The pre-existing whole-lyric Language Mix method remains in place. The first Gemini response still writes the complete lyric, and only a missing or severely underrepresented selected language can trigger one whole-card retry.
- Ratio values from 5% through 60% are approximate musical directions. Story Context, natural diction, section role, hook identity, and singability take priority over exact percentage matching.
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


## 89차 Dynamic Section Blueprint slot contract

- Recommended, Stable, Experimental, and Custom resolve one song-specific V1 Section Blueprint before the first Gemini request. Random structure selection stops at that boundary and the same locked contract is reused through prompting, parsing, repair, rendering, and final validation.
- V1 lyric JSON now uses dynamic section arrays (`sectionId`, `sectionName`, `productionCues`, `bodyLines`) instead of a fixed pop-only key set. The application renders the exact resolved slots in order, so Experimental and Custom names remain valid without forcing Stable sections that were never selected.
- Each resolved slot carries one structural body policy from the existing Section Registry: required, optional, or forbidden. This reuses the existing format/safety policy rather than adding lyric-content hardcoding.
- Missing tags and order are application-owned. Only an actually empty required body may use the existing single targeted correction request. Whole-lyric regeneration and structure reroll are not used.
- Unselected language cards stay empty. No story phrase, scene, lyric sentence, genre-specific subject, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 90차 Development-section minimum-substance safety

- The dynamic 89차 Blueprint contract remains the structural owner. This change does not force Stable sections into Recommended, Experimental, or Custom songs; it only evaluates the development slots that the current song actually selected.
- The first V1 request now states a minimum-substance safety for `expansive` development roles such as Verse and Rap Section. A non-lexical parenthesized ad-lib plus one or two tiny fragments cannot satisfy the section's development role by itself.
- This safety is not a normal line-count template. A section passes when it has either enough distinct lexical thought units or enough total lexical substance. Long meaningful lines and short rhythmic lines are both valid.
- The internal emergency floor is adjusted by the selected lyric-length mode. Rap Section receives a slightly higher floor than Verse because its registered role is denser rhythmic development. These numeric floors are deliberately limited to detecting extreme collapse and are never exposed as target line counts in the generation prompt.
- Parenthesized non-lexical vocal sounds such as `(음, 음...)`, `(우-)`, and `(아...)` remain valid performance material but are excluded from development-substance counting. Lexical parenthetical thoughts remain eligible.
- When the first response still collapses a selected expansive development slot, the existing single correction allowance requests only concise new lines for that exact slot. Existing lyrics, singer ownership, cues, Hook Blueprint, section order, Story Context, and other sections remain untouched.
- User/director instructions explicitly requesting a one-line, minimal, brief, or short named development section override the safety floor. Direct-lyrics original-preserve mode remains immutable.
- No fixed lyric sentence, story scene, genre-specific subject, replacement phrase pool, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.
- The final hard-ban editor remains an output-safety request rather than a discretionary quality correction. It still shares the absolute three-request ceiling, but it is not blocked solely because the one allowed section-density correction already ran.

## 91차 Dynamic Blueprint exact-slot structured output

- V1 lyrics use the song-specific resolved Blueprint as a tuple-like structured-output contract.
- Each selected language card has exact array length, per-position `sectionId`, `sectionIndex`, and `sectionName` enums, plus required/forbidden body constraints.
- Unselected language cards are schema-locked to an empty array.
- Targeted body repair uses the same exact target tuple contract.
- One allowed correction operation may use one temporary-error model fallback; the fallback still counts toward the absolute three-request ceiling but does not consume a second correction allowance.
- This locks format and safety only. No lyric phrase, scene, genre story, or fixed universal section sequence is introduced.

## 92차 Supported dynamic-slot schema recovery

- Gemini runtime rejected the 91차 tuple keyword `prefixItems` before token generation, so every normal request fell into the simplified emergency path. The unsupported keyword is removed from both first-generation and targeted-repair schemas.
- Selected language cards still require the exact current Blueprint slot count through supported `minItems` and `maxItems`.
- Each returned slot is limited to the current Blueprint's allowed IDs, indexes, and names. Exact ID/index/name pairing, order, lyric policy, and completion are then verified by the existing application-owned renderer and final Blueprint contract inspector.
- Targeted repair follows the same supported schema and accepts only the current repair targets; invalid duplicates or mismatched triples are ignored rather than inserted into another section.
- This restores the normal one-call path. A second call is reserved only for a real missing/underdeveloped required slot or another existing permitted safety correction, under the absolute three-request ceiling.
- No lyric sentence, genre story, scene, universal section sequence, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 93차 Numeric-index schema compatibility and schema-error cost guard

- Gemini accepts string enums for the current Blueprint `sectionId` and `sectionName`, but rejected numeric values inside the `sectionIndex` enum before token generation.
- The numeric enum is removed from both first-generation and targeted section-body repair schemas. `sectionIndex` remains a required integer, while exact range, order, and ID/name/index pairing stay application-owned contract checks.
- String allow-lists, exact language-card slot count, dynamic Blueprint locking, and the final completion inspector remain unchanged.
- Request/response-schema configuration errors are now identified separately from creative-generation failures. A `400 INVALID_ARGUMENT` carrying response-schema markers is surfaced immediately and cannot launch the paid compact emergency generation path.
- Real temporary 429/5xx/unavailable failures still use the existing bounded model fallback. A genuine non-schema generation failure may still use the existing one-shot compact safety result under the absolute request budget.
- No lyric sentence, story scene, genre subject, universal section order, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced.

## 94차 Gemini temporary-error fallback and schema-surface reduction

- The 93차 targeted section repair could display a real `503 UNAVAILABLE` error but fail to start its bounded fallback because the retry classifier serialized native `Error` objects as `{}` and therefore lost `error.message`.
- Gemini error inspection now reads native `message`, `name`, numeric code, status, nested SDK error/cause/response/data/details fields, and a safe serialized form. Temporary `429/5xx/UNAVAILABLE/DEADLINE_EXCEEDED` failures can therefore use the existing one-time fallback, while `400 response_schema` development errors are explicitly blocked from any paid fallback.
- V1 first-generation and targeted-repair schemas no longer use dynamic string enums for `sectionId` or `sectionName`. The supported schema now enforces only types and exact array counts; the already-existing application contract validates the exact `sectionId + sectionIndex + sectionName` combination, order, duplicates, lyric policy, and final completeness before publishing.
- The initial dynamic Blueprint instruction adds a same-response self-audit for object count, order, identifiers, and non-blank required lyric bodies. This reduces missing Final Chorus/Outro-style bodies without adding another request.
- Targeted repair candidates are deduplicated and revalidated against the locked Blueprint before a repair schema is built. Invalid/duplicate targets cannot inflate item counts or be inserted into another section.
- No stock lyric, fixed scene, genre story, universal section order, Firebase/Auth/Firestore/Functions change, or saved-data migration is introduced. The absolute three-request ceiling and one correction-operation ceiling remain unchanged.

### V1 lyric architecture shadow foundation (111차)

- `v1/lyrics/lyricArchitecturePlan.ts`: active Section Blueprint와 장르·템포·보컬 신호를 상대적인 서사·밀도·호흡 계획으로 해석한다. 현재는 shadow 진단만 저장하며 가사 프롬프트를 바꾸지 않는다.
- `v1/language/languageMixAudit.ts`: 최종 가창 가사 문자만 사용해 언어혼합 비율과 분포 위험을 계산한다. 섹션·퍼포먼스·프로덕션 태그는 전부 제외한다.

### V1 lyric architecture active rollout (112차)

- `v1/lyrics/lyricArchitecturePlan.ts`의 111차 shadow 계획을 `v1-active-2`로 전환했다.
- 메인 장르는 곡 전체의 통일감을 유지하고, 보조 장르는 해당 프레이징이 자연스러운 섹션에만 `secondary-local` 영향으로 배정한다. 예: City Pop + Hip-hop은 City Pop이 전체/후렴 정체성을 유지하고 Hip-hop은 Verse 계열의 리듬 밀도와 라임을 담당한다.
- 장르 ID의 `_`/`/` 표기를 정상화하고 입력에 먼저 등장한 장르 신호를 우선하여, `city_pop + hip_hop`이 패턴 목록 순서 때문에 Hip-hop 중심으로 뒤집히지 않게 했다.
- 가사 생성 프롬프트에 섹션별 `narrativeJob`, 상대 밀도 0~4, 구절 길이, 호흡, 반복, 유지음, 라임, 지역 장르 영향을 전달한다.
- 이 수치는 정확한 줄 수·글자 수·음절 수가 아니다. 사용자 직접 지시와 자연스러운 가창성을 우선하면서 섹션 간 변화·균형·통일감을 만드는 상대 설계도다.
- 대상 섹션 보완 호출에도 동일한 섹션 설계를 전달하여, 최초 생성과 국소 보완이 서로 다른 밀도 기준을 사용하지 않게 했다.
- 언어혼합 passage plan과 실제 글자 비율 교정은 다음 전용 단계에서 변경한다. 112차는 기존 언어혼합 배치 로직을 그대로 유지한다.

## 113차 Recommended section paragraph ownership recovery

- 112차 실사용 테스트에서 Recommended dance 구조의 `Pre-Chorus 2`가 후렴 문단까지 소유하고, 빈 `Chorus 2` 태그가 최종 정리에서 제거되는 구조 누락을 확인했다.
- Section Guard는 이제 Recommended/Stable에서만, `Pre-Chorus 또는 Build-Up → Chorus/Hook/Drop` 및 `Bridge → Final payoff`의 바로 다음 필수 슬롯이 비어 있고 이전 슬롯 안에 명확한 빈줄 문단 경계가 있을 때만 후행 문단을 누락 슬롯으로 이동한다.
- 일반 Verse 문단, 한 문단뿐인 본문, Custom/Experimental 구조, 두 줄 미만의 불확실한 조각은 추정 분리하지 않고 기존 대상 섹션 Gemini 보완에 맡긴다.
- 영어 큐의 단어 앞글자 손상은 단어별 치환표로 복구하지 않는다. 현재 곡 안의 더 긴 정상형과 구조적으로 비교해 손상 후보 전체를 버리고 다른 섹션 소유 후보를 사용한다.
- 가사 문장·소재·고정 줄 수·고정 음절 수는 추가하지 않았고, 언어혼합 로직과 Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.


## 114차 — Written Ad-lib Auto Restraint

- Intro/Outro의 `(음...)`, `(우...)` 같은 비어휘 구음은 기본 채움값이 아니다.
- 사용자의 직접 입력, 가사 초안, 보컬/섹션 선택에 허밍·구음·애드리브 의도가 명확할 때만 유지한다.
- 자동 상태에서 근거가 없으면 Intro/Outro의 일반적인 비어휘 구음과 `humming` 관성 큐를 제거한다.
- 의미가 있는 괄호형 훅/응답 가사는 유지한다.
- Outro는 짧은 가사, 의도된 보컬 제스처, 또는 무가사 음악 꼬리 모두 허용한다.
- 누락 섹션 보완 시 `(음...)`을 임의로 삽입하지 않는다.


## 115차 — 최종 섹션 큐 무결성 보강

- 구조 태그의 영어 단어 손상은 특정 단어 치환 없이 감지하고, 손상된 후보를 공개 출력에서 제외한다.
- 가사가 있는 섹션이 모델 누락으로 `[Chorus 1]`처럼 빈 퍼포먼스 큐로 남으면, 현재 섹션 역할에 맞는 최소 안전 큐만 보충한다.
- 모델이 생성한 현재 곡 전용 큐, 사용자 선택 큐, 멀티보컬 소유권이 항상 우선이며 안전 큐는 완전 누락 시에만 사용한다.
- 음악/악기 큐는 구조 태그에 합치지 않고 기존처럼 독립 대괄호 줄로 유지한다.

## 130차: 잠금형 전체 가사 언어혼합 재작성

- 기준은 롤백2차 안정 가사·섹션·큐 엔진이다.
- 최초 곡 생성은 각 카드의 기본 언어로 완성한다.
- 언어혼합은 최종 섹션/태그/악기큐가 확정된 뒤 별도 필수 단계에서 실행한다.
- 앱은 대괄호 줄, 빈 줄, 줄 위치를 잠그고 가창 가사 줄만 ID로 전달한다.
- Gemini는 모든 ID에 대해 자연스러운 완성형 최종 줄 후보와 의미 역할/우선순위를 반환한다.
- 앱은 완성형 줄만 선택해 실제 가창 줄 점유율과 전·중·후 분산을 맞춘다. 토큰·단어 잘라 붙이기는 사용하지 않는다.
- 반복되는 동일 훅 원문은 같은 최종 줄로 묶어 훅 정체성을 유지한다.
- 언어혼합 호출은 기본 곡 생성 호출 예산과 분리하고, 여러 곡은 순차 처리한다. 429는 서버 대기 시간을 최대 70초까지 존중해 1회 재시도한다.
- 최종 검사에는 언어 비율뿐 아니라 섹션 순서, 태그 손상, 대괄호, 악기큐 누락, 잠금 줄 보존 여부를 포함한다.

## 132차 — 큐 단어 무변형 경계 + 가창 점유율 언어혼합

- 큐 정리기는 영어 토큰의 글자를 직접 고치거나 줄이지 않는다.
- 현재 곡 안의 더 긴 정상형과 비교해 앞글자 손상 가능성이 있는 후보는 통째로 제외하고, 같은 섹션의 다른 소유 후보를 사용한다. 특정 손상 단어 목록은 프롬프트와 로직에 추가하지 않는다.
- 언어혼합 비율은 알파벳 개수를 세지 않고 가창 한 줄을 한 개의 공연 단위로 계산한다. 완전한 보조언어 줄은 1, 한 줄 안의 자연스러운 혼합은 해당 토큰 점유율만 반영한다.
- 20%와 40% 선택은 목표 점유율에 가까워질 때까지 후보를 선택하며, 중간·고비율은 인접한 2~3줄 묶음을 우선해 한 줄씩 교차하는 배치를 피한다.
- 섹션 태그·악기큐·줄 위치 잠금과 기존 API 호출 계약은 유지한다.


## 133차 — 선계획 언어 블록 재작성

- 언어혼합 줄 후보를 먼저 흩어서 만든 뒤 인접 묶음을 찾던 순서를 폐기했다.
- 앱이 섹션 구조와 전·중·후 위치를 기준으로 목표 비율에 필요한 연속 가창 블록을 먼저 정한다. 가사 단어나 특정 소재는 계획 기준에 사용하지 않는다.
- Gemini에는 계획된 블록 ID와 줄만 재작성 대상으로 전달하며, 블록 밖의 줄은 원문 그대로 반환하도록 잠근다.
- 계획 블록의 일부 줄만 빠지거나 보조 언어가 없는 경우 해당 블록 전체를 적용하지 않는다. 완성된 블록만 원자적으로 재조립한다.
- 가창 비율 선택기와 공개 검사는 섹션 경계를 실제 휴지점으로 취급한다. 서로 다른 섹션의 연속 줄을 하나의 과도한 언어 구간으로 오판하지 않는다.
- 20%는 전·중·후의 여러 섹션에 자연스러운 연속 블록을 배치하고, 선택기와 최종 검사가 같은 가창 줄 점유율을 사용한다.
- 특정 영어 단어, 가사 문장, 장면, 소재 하드코딩은 추가하지 않았다. Firebase/Auth/Firestore/Functions 및 저장 구조 변경 없음.

## 134차 — 10~20% 한 줄 내부 라임 혼합

- 10~20% 구간은 완전한 외국어 문장 블록을 사용하지 않고 `within-line-rhyme` 전용 경로로 처리한다.
- 앱은 가사의 전·중·후와 섹션 분포만 기준으로 혼합 후보 줄을 미리 고른다. 특정 단어·문장·소재는 선택 기준이나 프롬프트에 넣지 않는다.
- Gemini는 선택된 각 줄을 기본 언어와 목표 언어가 함께 들어간 하나의 완성형 가창 문장으로 다시 쓴다.
- 혼합 구절은 원문 의미를 이어가면서 발음, 모음색, 끝소리, 강세 또는 리듬 착지 중 실제 연결 근거를 가져야 한다. 응답 진단에는 의미 연결과 발음·리듬 연결을 함께 남긴다.
- 목표 언어 단독 문장, 장식용 한 단어, 외국어 토큰에 한국어 조사를 직접 붙이는 구조는 10~20% 후보로 인정하지 않는다.
- 비율은 알파벳 글자 수나 줄 개수가 아니라 한국어 음절과 외국어 추정 발음 음절의 가창 점유율로 계산한다. 선택기와 최종 검사가 같은 측정기를 사용한다.
- 섹션 태그, 보컬/퍼포먼스 큐, 악기/프로덕션 큐, 빈 줄과 줄 위치는 기존 잠금 경계를 유지한다.
- 30% 이상 기존 경로는 이번 단계에서 재설계하지 않는다. Firebase/Auth/Firestore/Functions 및 저장 구조 변경 없음.


## 135차 — K-pop 사운드 기준 10%·20% 통합 코드 스위칭

- 10%와 20%는 별도 엔진으로 갈라지지 않고 하나의 K-pop 코드 스위칭 경로를 사용한다. 앱의 실제 선택값만 사용하며 중간 비율 단계를 새로 만들지 않는다.
- 품질 기준은 회화 문법이나 완전한 문장이 아니라 가창 시 들리는 소리다. 모음 착지, 자음 타격, 영어 강세, 음절 밀도, 호흡 길이, 내부·종결 라임, 섹션 에너지를 우선한다.
- 문장 파편, 압축 문법, 의미 반복은 K-pop 훅·리듬 기능이 분명하면 허용한다. 직역이나 문법적 완성도를 통과 조건으로 사용하지 않는다.
- Gemini가 반환한 `meaningConnection`·`phoneticConnection` 설명은 참고 진단일 뿐 합격 근거로 사용하지 않는다. 앱은 결과 가사 자체의 두 언어 존재, 전환 수, 목표 언어 구절 수, 가창 밀도, 점유율을 직접 검사한다.
- 10%는 혼합 구절의 목표 점유율을 낮게, 20%는 높게 가져가되 너무 많은 줄을 건드리지 않도록 목표 구절 밀도와 후보 줄 수를 함께 조절한다.
- 한 섹션에서 혼합 줄이 과도하게 연속되거나, 선택 비율에 비해 지나치게 많은 줄이 바뀌면 최종 검사에서 `needs-review` 처리한다.
- 특정 영어 단어·라임 문구·가사 예시는 생성 프롬프트나 런타임 로직에 추가하지 않았다. 기본 가사·섹션·큐·Firebase/Auth/Firestore/Functions는 변경하지 않았다.

## 136차 — 반복 후렴 앵커 패턴 + 단어·짧은 구절 균형

- 적용 범위는 V1 언어혼합 10%와 20% 통합 경로다.
- 반복되는 Chorus/Hook/Refrain/Drop은 각각 따로 재작성하지 않는다. Chorus 1에서 정한 로컬 혼합 위치를 Chorus 2와 Final Chorus의 같은 위치에 연결하고, 동일한 목표 언어 앵커와 전환 기능을 유지한다.
- 원문 훅 문장이 동일하면 반복 구간의 최종 혼합 문장도 동일해야 한다. Final Chorus는 에너지 상승을 허용하되 기존 목표 언어 앵커를 잃거나 다른 위치로 무작위 이동할 수 없다.
- 10%는 반복 후렴의 핵심 위치 1개를, 20%는 핵심 위치 2개를 우선 연결한다. Pre-Chorus는 반복 후렴 가족으로 계산하지 않는다.
- 저비율 결과에는 `keyword-anchor`와 `short-phrase`가 모두 있어야 한다. 단어형은 의미·이미지·라임·훅을 담당하는 목표 언어 1개 또는 분리할 수 없는 2단어 이하이며, 짧은 구절형은 2~6단어의 압축된 가창 구절이다.
- 앱은 Gemini의 설명문이 아니라 실제 최종 가사에서 목표 언어 토큰, 반복 후렴 위치, 앵커 일치, 단어형/구절형 수를 검사한다. 반복 위치나 앵커가 다르면 해당 반복 묶음을 적용하지 않고 원문을 보존한다.
- 특정 영어 단어·가사 문장·라임 예시는 프롬프트나 런타임 로직에 고정하지 않는다. 현재 곡의 의미·발음·강세·리듬을 바탕으로 모델이 앵커를 선택한다.
- 기본 가사, 섹션 순서, 보컬/퍼포먼스 큐, 악기/프로덕션 큐, Firebase/Auth/Firestore/Functions 및 저장 구조는 변경하지 않는다.


### 137차 K-pop 공통 후렴 앵커 재사용
- 10%·20% 후렴은 각 Chorus를 독립 생성한 뒤 우연히 일치시키지 않는다.
- 연결된 후렴 후보에서 핵심 외국어 단어/짧은 구절을 한 번 선택하고, 같은 후렴 슬롯에 그대로 재사용한다.
- 핵심 단어형은 후보 문구에서 의미어를 선택하므로 특정 단어를 하드코딩하지 않는다.
- 후렴 후보 하나의 길이 편차로 전체 언어혼합을 0% 원문 복구하지 않도록 공통 앵커를 로컬에서 안정적으로 조립한다.
- 10%·20% 계획 줄 수를 축소해 지나치게 많은 가사 줄을 건드리지 않는다.


### 138차 1단계 — 유효 언어혼합 후보 적용
- 이번 단계는 `final-ratio-out-of-range`로 전체 결과를 0% 원문 복구하던 조건만 제거한다.
- 유효 후보가 존재하고 기존 섹션·태그·큐 잠금 및 현재 안전 조건을 통과하면 실제 비율이 권장 범위를 벗어나도 후보를 적용한다.
- 목표 비율의 미달·초과는 공개 검사 보고서의 `needs-review` 진단으로 남기며, 적용 취소 사유로 사용하지 않는다.
- 후렴 반복 규칙, 단어형/짧은 구절 구성, 라임 품질, 후보 배치, 비율 산정식은 이번 단계에서 변경하지 않는다.
- Firebase/Auth/Firestore/Functions 및 저장 구조 변경 없음.


### 139차 — 언어혼합 비율 선택지 5% 복구 / 70% 제거
- 활성 UI 비율은 5%, 10%, 20%, 30%, 40%, 50%, 60%다.
- 과거 저장값 70%는 불러올 때 60%로 안전하게 정규화한다.
- 이번 차수는 선택지와 비율 전달 계약만 수정하며, 언어혼합 문장 품질·배치·후렴 규칙·비율 예산 계산은 변경하지 않는다.


### 140차 2단계 — 5% 전용 배치 분리
- 5%를 `requestedRatio <= 10` 공통 계획에서 분리했다.
- 반복 후렴의 공통 핵심 앵커 1개를 우선 유지하고, 후렴 밖 추가 혼합은 최대 1~2곳만 계획한다.
- 5% 계획은 실제 혼합 줄이 대체로 3~5줄 안에 머물도록 후보 예산과 비후렴 역할 구간 수를 제한한다.
- 1개 목표 언어 토큰은 `keyword-anchor`, 2~6개 목표 언어 토큰은 `short-phrase`로 검사하여 `my heart`, `I wait`, `no answer` 같은 짧은 구절이 단어형으로 잘못 집계되지 않게 했다.
- 10%·20%의 비율 예산, 후렴 품질, 라임 생성 규칙과 기본 가사·섹션·큐 엔진은 변경하지 않았다.

## 141차 — 5% 실제 가창 비율 예산 보정
- 5%는 140차의 고정 배치(반복 후렴 3회 + 비후렴 2줄)를 유지한다.
- 반복 후렴 앵커는 최소 3 가창 단위, 비후렴 짧은 구절은 각 최소 4 가창 단위를 요구해 전체 4~7%를 목표로 한다.
- 5% 검사 권장 범위를 4~7%로 분리했다. 비율 미달만으로 결과 전체를 원문 복구하지 않는 138차 원칙은 유지한다.
- 10%·20% 이상의 배치·선택·비율 규칙은 변경하지 않는다.

## 142차 — 5% 한 단어 후렴 앵커 복구
- 141차에서 5% 반복 후렴 `keyword-anchor`의 최소 가창 단위를 3으로 올려 한 단어 앵커가 전부 탈락하던 충돌을 제거했다.
- 5% 반복 후렴 앵커는 다시 최소 1 가창 단위부터 허용한다. 동일 앵커를 Chorus 1·2·Final Chorus에 재사용하는 규칙은 유지한다.
- 비후렴 짧은 구절 2곳의 최소 예산, 5줄 배치, 4~7% 진단 범위는 변경하지 않는다.
- 10%·20% 이상 규칙과 기본 가사·섹션·큐·Firebase 구조는 변경하지 않는다.

## 143차 — 5% 실제 비율 완성
- 최종 적용 형태를 `반복 후렴 동일 앵커 3줄 + 비후렴 짧은 구절 2줄`, 총 5개 가창 위치로 고정했다.
- 곡의 전체 추정 가창 단위를 먼저 계산하고, 두 비후렴 구절에 필요한 목표 언어 가창 단위를 동적으로 나눠 4~7% 범위에 들어오도록 계획한다.
- 비후렴 기본 후보가 품질 검사에서 탈락할 때를 대비해 같은 Gemini 호출 안에서 대체 후보 2개를 함께 생성한다. 최종 가사에는 가장 적합한 2개만 선택하며 추가 호출은 하지 않는다.
- 원본 가사에 계획 밖 목표 언어가 이미 들어 있으면 같은 호출에서 기본 언어로 복구한 뒤, 계획된 5개 위치만 남겨 기존 영어 조각 때문에 비율이 흔들리지 않게 한다.
- 5%는 실제 계산 비율이 4~7%이고 5개 위치가 모두 완성된 경우에만 `applied`로 확정한다. 10%·20% 이상 경로는 변경하지 않았다.
- 특정 영어 단어·문장·소재는 런타임에 하드코딩하지 않았다. Firebase/Auth/Firestore/Functions 및 저장 구조 변경 없음.

## 144차 — 5% 비후렴 짧은 구절 생성·검사 계약 일치
- 143차 실사용에서 비후렴 기본·대체 후보 4개가 모두 `target-sung-units-outside-mix-form,target-token-count-outside-mix-form`으로 탈락한 원인을 수정했다.
- 5% `short-phrase`의 `targetUnitGuide`를 Gemini에게 단순 참고값이 아닌 필수 생성 계약으로 명시했다. 가창 단위는 글자 수나 단어 수가 아니라 실제 발음 음절 추정치이며, 모든 기본·대체 후보가 각자 최소·최대 범위를 충족해야 한다.
- 2개의 다음절 단어만으로도 필요한 가창 단위를 채울 수 있으므로 임의의 3단어 최소 조건은 제거하고, 생성 검사와 공개 검사를 `2~8단어 + 6~16 가창 단위`로 일치시켰다. 곡별 동적 `targetUnitGuide`가 더 높으면 그 값을 우선한다.
- 반복 후렴 3줄 + 비후렴 2줄, 실제 4~7%, 총 5개 위치, 10%·20% 이상 경로는 변경하지 않았다. Firebase/Auth/Firestore/Functions 및 저장 구조 변경 없음.


## 145차 — 모든 언어혼합 비율 전체 가창 분량 우선 적용
- 활성 선택값 전체를 실제 가창 분량 범위로 통일했다: `5→5~10%`, `10→10~20%`, `20→20~30%`, `30→30~40%`, `40→40~50%`, `50→50~60%`, `60→60~70%`.
- 생성·최종 재작성·공개 검사·UI 설명이 같은 비율 범위를 사용하도록 `languageMixRatios.ts`를 단일 기준으로 만든다.
- 저비율 후보의 단어 수·개별 줄 가창 단위·줄 점유율은 후보 순위와 품질 진단에 남기되, 전체 분량을 맞출 수 있는 후보를 폐기하는 하드 실패로 사용하지 않는다.
- 5%의 고정 5줄 적용 조건을 해제하고, 기존 혼합 문장까지 포함한 전체 가창 분량이 5~10%에 들어오는 후보 조합을 선택한다.
- 30~60% 완전 외국어 블록은 전체 블록을 순차 적용하지 않고, 실제 측정 비율이 선택 범위에 가장 가까운 블록 조합을 선택한다. 높은 비율은 후보 블록을 더 잘게 나눠 분량을 미세 조절한다.
- `applied/preserved`와 공개 검사 `passed/needs-review`의 이번 단계 통과 기준은 전체 가창 분량 범위다. 후렴 앵커·배치·구절 형태·타임라인 분산은 진단값으로 유지하며 다음 품질 단계에서 별도로 보정한다.
- Firebase/Auth/Firestore/Functions 및 사용자 저장 구조는 변경하지 않는다.

## 146차 — 언어혼합 결과 공개 / 자동 폐기 제거

- 언어혼합 후보가 실제 가사 줄에 적용 가능하고 섹션·큐 잠금 경계가 보존되면, 최종 비율이 권장 범위를 벗어나도 생성 결과를 그대로 반환한다.
- 비율 미달·초과, 전·중·후 분산, 섹션 배치, 후렴 앵커, 단어형/짧은 구절 균형은 `warningReasons`와 공개 검사 `needs-review`로 남기며 결과 폐기 조건으로 사용하지 않는다.
- 후보 선택 단계에서도 상한 초과만으로 후보/블록 조합을 제거하지 않는다. 모든 유효 조합 중 목표 비율에 가장 가까운 결과를 선택해 사용자가 직접 확인할 수 있게 한다.
- 원문 복구는 유효 적용 위치가 하나도 없거나, 섹션·큐 잠금이 깨졌거나, 기술적으로 재조립할 수 없는 경우에만 유지한다.
- 공개 진단에 `ratioBandPassed`, `warningReasons`, `applicationPolicy: show-generated-candidate-with-warnings`를 기록한다.
- 엔진 버전: `v1-language-mix-visible-warning-step8-active-23`.
- Firebase/Auth/Firestore/Functions 및 사용자 저장 구조는 변경하지 않는다.

## 147차 — 언어혼합 전 비율 구간 실제 맞춤

- 146차를 기준으로 언어 배치 검사, 후렴 규칙, 섹션·큐 잠금, 기존 가사 생성 구조는 제거하거나 완화하지 않았다.
- 10%·20%는 전체 가창 단위와 한 줄 평균 가창량을 먼저 계산해, 목표 범위에 도달할 수 있는 후보 수와 짧은 구절 가창 단위를 곡 길이에 맞게 확보한다.
- Gemini가 만든 후보를 순서대로 강제 적용하지 않고, 실제 최종 가창 점유율을 매번 계산하는 후보 조합 탐색으로 `10→10~20%`, `20→20~30%`에 가장 가까운 조합을 선택한다.
- 5%와 30~60%의 기존 범위·생성 방식은 유지하며, 공통 비율 범위는 `languageMixRatios.ts`를 그대로 사용한다.
- 언어혼합 후보에서 클리셰 금지어가 검출되면 전체 결과를 즉시 0% 원문으로 되돌리지 않는다. 해당 후보 줄만 제외한 뒤 같은 Gemini 응답 안에서 비율 조합을 다시 계산한다. 금지어 검사는 유지된다.
- 실제 Gemini 결과는 모델 변동성이 있으므로 최종 확인은 5·10·20·30·40·50·60% 실생성 보고서의 `actualRatio`로 확인한다.
- 엔진 버전: `v1-language-mix-ratio-fit-step9-active-24`.
- Firebase/Auth/Firestore/Functions 및 사용자 저장 구조는 변경하지 않는다.

## 148차 — Language Arrangement Arc / 장르·서사 해석형 언어혼합

- 기준은 147차의 전체 가창 점유율 계산, 비율 범위, 섹션·큐 잠금, 줄 ID/파싱 안전장치다. 이 정상 동작은 유지한다.
- 5%는 검증된 저밀도 `within-line-rhyme` 경로를 그대로 사용하고, 60%는 검증된 `complete-line-blocks` 경로를 그대로 사용한다.
- 10~50%는 단일 `within-line-rhyme` 강제 대신 `adaptive-arrangement` 경로를 사용한다.
- 새 `languageArrangementDirector.ts`는 장르·보조 장르·스타일·분위기·Story Context·직접입력·템포·보컬 신호를 함께 읽어 `Language Arrangement Brief`를 만든다.
- 직접입력 장르와 메인 장르를 우선하고, 보조 장르와 스타일은 secondary grammar로 해석해 퓨전 장르의 역할이 뒤바뀌지 않게 한다.
- 언어 배치의 창작 기준은 다음 세 가지다.
  - 변화: 이야기와 감정 전개에 따라 섹션별 언어 강도와 전환 형식이 달라진다.
  - 균형: 선택 비율은 곡 전체 총량이며, 각 섹션에 같은 비율을 나누지 않는다.
  - 통일: Verse/Chorus/Final 등 연관 섹션은 같은 언어 모티프·라임군·전환 기능을 반복하거나 발전시킨다.
- 후보군은 넓게 유지하지만 후보는 의무 적용 줄이 아니다. Gemini는 곡 전체 아크에 도움이 없는 줄을 `suitable=false`로 원문 보존할 수 있다.
- 후보 형식은 `keyword-anchor`, `short-phrase`, `extended-phrase`, `complete-target-line`을 함께 허용하고, 전환 위치도 `base-first`, `target-first`, `internal-switch`, `full-line`을 허용한다.
- 장르 프로필은 정확한 줄 수나 섹션별 고정 퍼센트를 강제하지 않는다. K-pop/아이돌은 훅·단어 성향, R&B/그루브는 유동적 구절 전환, 랩은 마디·라임 전환, 서사형은 의미가 이어지는 구절, 여백형은 적지만 무게 있는 전환처럼 우선 경향만 제공한다.
- 적용기는 모든 후보를 순서대로 넣지 않고, 실제 전체 가창 비율이 선택 범위에 가장 가까우면서 arrangementPriority와 형식 다양성이 살아 있는 부분집합을 선택한다.
- `adaptive-arrangement`에서는 전·중·후 균등 분산이나 섹션 집중도 점수를 후보 선택 기준으로 사용하지 않는다. 해당 값은 공개 진단에만 남는다.
- 엔진 버전: `v1-language-mix-arrangement-arc-step10-active-25`.
- Firebase/Auth/Firestore/Functions, 저장 구조, UI, 기본 가사 생성 구조는 변경하지 않는다.

## 150차 — 두 언어 선택 카드 전용 실행 안정화

- 적용 범위는 V1에서 가사 언어를 정확히 2개 선택하고 언어혼합을 켠 경우만이다. 1개 언어, V2, 일반 가사 생성, 5단 음악 프롬프트, 섹션/큐, Firebase/Auth/Firestore/Functions는 변경하지 않는다.
- 두 카드의 목표 언어를 각 카드의 반대편 선택 언어로 고정한다. 예: 한국어 카드→영어, 영어 카드→한국어. 첫 번째 카드 기준 target 배열 때문에 두 번째 카드가 0%로 보존되던 오류를 막는다.
- 두 언어 카드의 잠금형 재작성 응답에 JSON 스키마를 적용하고, JSON 파싱 실패 시 같은 스키마로 1회만 재요청한다.
- 초기 생성 카드에 상대 언어가 미리 섞여 들어오면 같은 재작성 응답의 `baseText`로 카드 기본 언어만 남긴 깨끗한 바탕을 먼저 만든다. 이후 선택된 `finalText` 후보만 그 바탕 위에 적용해 기존 외국어 블록이 비율을 선점하지 않게 한다.
- 섹션 태그, 퍼포먼스 큐, 프로덕션 큐, 줄 ID와 줄 위치는 계속 잠근다. 새 정리 로직은 가창 본문 줄에만 적용한다.
- 엔진 버전: `v1-language-mix-two-card-reliability-step11-active-26`.

## 151차 — 두 언어 카드 compact schema 요청 안정화

- 정확히 두 가사 언어를 선택한 V1 언어혼합 경로에서 Gemini 구조화 응답 스키마를 필수 6개 필드 중심으로 축소했다.
- 과도한 JSON schema 제약으로 발생하던 HTTP 400을 막고, 스키마 요청이 거절될 때 두 언어 경로에서만 JSON MIME 방식으로 1회 우회한다.
- 한 언어 선택, 3개국어 혼합, 기본 가사 생성, 5단 프롬프트, Firebase/Auth/Firestore/Functions는 변경하지 않는다.
- 엔진 버전: `v1-language-mix-two-card-compact-schema-step12-active-27`.

## 152차 — 한국어·보조언어 카드 병렬 재작성

- 적용 조건은 V1에서 가사 언어를 정확히 2개 선택하고, 한국어 카드와 보조 언어 카드가 모두 존재하며, 언어혼합이 활성화된 경우다.
- 기존 순차 실행 `한국어 완료 → 보조 언어 시작`을 `한국어·보조 언어 동시 시작 → 두 결과 결합`으로 변경했다.
- 각 카드의 Gemini 요청, compact schema, 재시도, HardBan 후보 제외, 비율 계산, 섹션·큐·줄 잠금 로직은 그대로 유지한다.
- 각 카드 작업은 독립적으로 실패를 처리하므로 한 카드 실패가 다른 카드 결과까지 취소하지 않는다.
- 한 언어 카드, 카드가 하나뿐인 경우, 3개국어 혼합 경로는 기존 순차/단일 동작을 그대로 유지한다.
- 공개 진단에 `parallelTwoCardExecution`과 카드별 `requestSessionMode: parallel-two-card-required-stage`를 기록한다.
- 엔진 버전: `v1-language-mix-two-card-parallel-step13-active-28`.
- Firebase/Auth/Firestore/Functions, 저장 구조, UI는 변경하지 않는다.


## 153차 — 두 언어 언어 아크·비율 복구

- 적용 범위는 가사 카드가 정확히 2개이고, 각 카드의 목표 언어가 1개인 V1 언어혼합 10~50% 경로다.
- 반복 Chorus의 모든 줄을 동일 앵커로 묶지 않고, 대표 훅 슬롯 1개만 연결한다. 나머지 Chorus 2 / Final Chorus 줄은 개별 후보로 남겨 확장·축소·전환을 허용한다.
- Compact JSON 호출은 최종 적용량과 별개로 충분한 후보 풀을 만들도록 `candidateCoverageFloor`를 전달한다. 후보는 전·중·후와 비후렴 서사 구간에도 분산하고, 번역 꼬리 한 형식으로 몰리지 않게 한다.
- 로컬 후보 선택은 목표 비율뿐 아니라 타임라인·섹션 분포, 한 형식/방향 쏠림, 후렴 과점유, 비연결 동일 문장 반복을 함께 감점한다.
- 첫 후보 풀로 목표 하한에 도달하지 못한 카드만 후보 확장 호출을 1회 실행한다. 첫 호출의 좋은 후보는 보존하고, 포기된 줄에 새 후보만 합친 뒤 다시 비율을 맞춘다.
- 후보 확장 뒤에도 목표 비율 범위를 충족하지 못하면 미달 혼합본을 성공으로 공개하지 않고 해당 카드의 원본을 보존한다.
- 두 카드의 기본 호출과 필요한 후보 확장 호출은 전역 순차 큐를 우회해 실제 병렬 요청으로 실행한다. 한 카드 실패가 다른 카드 결과를 취소하지 않는다.
- 다중 목표 언어가 필요한 3개국어 경로는 변경하지 않는다.
- 엔진 버전: `v1-language-mix-two-card-arc-repair-step14-active-29`.

## 154차 — 두 언어 카드 목표 가창분량 부족 복구

- 기준: `SORIDRAW_153차_two_language_arc_ratio_repair_step14.zip`.
- 적용 범위는 정확히 두 언어를 선택한 V1 언어혼합의 10~50% 카드에만 한정한다.
- 153차에서 후보 확장 뒤에도 한글 카드가 0% 원본 보존으로 끝난 원인은 후보 개수만 늘리고 실제 목표 언어 가창분량을 충분히 늘리지 못한 것이다.
- 보충 호출은 이제 부족한 비율 포인트를 전달받고, Verse·Pre-Chorus·Bridge·Outro의 비후렴 후보에 완전 목표언어 줄 또는 목표언어 중심의 긴 구절을 우선 제안한다.
- 첫 호출에서 이미 `suitable=true`였던 짧은 후보도, 보충 후보가 목표언어 점유율을 의미 있게 높이는 경우에는 더 긴 후보로 교체할 수 있다.
- 반복 후렴의 연결 훅은 보호 목록으로 유지하여 비율 보정 과정에서 후렴 정체성이 무너지지 않게 한다.
- 한 카드만 성공한 경우 전체 재작성 상태는 `applied`가 아니라 `partial`로 기록한다.
- 2개 카드 실제 병렬 실행, HardBan, 섹션·큐 잠금, 기존 3개국어 경로는 변경하지 않는다.
- 엔진 버전: `v1-language-mix-two-card-deficit-occupancy-step15-active-30`.

## 155차 — 두 가사 카드의 3개국어 목표 분배·구조 보정

- 기준: `SORIDRAW_154차_two_language_target_occupancy_completion_step15.zip`.
- 적용 조건은 V1에서 가사 카드를 한국어+보조 언어 2개로 만들고, 섞을 언어에 추가 언어 1개를 선택한 경우다.
- 카드별 목표 언어는 기준 언어를 제외해 다시 계산한다. 예: 한국어/영어 카드 + 일본어 선택 시 한국어 카드→영어+일본어, 영어 카드→한국어+일본어다.
- 선택한 40~50%는 두 목표 언어의 합계이며, 각 목표 언어가 0%로 빠지지 않도록 최소 유효 점유율을 검사한다. 합계만 맞고 일본어가 누락되면 통과하지 않는다.
- Gemini 요청에 목표 언어별 균등 방향과 누락 언어 보충 지시를 전달하고, 후보 선택기는 두 목표 언어의 실제 가창 점유율과 불균형을 함께 평가한다.
- 첫 후보에서 한 목표 언어가 부족하면 부족한 언어 전용 후보 확장을 1회 실행한다. 기존 고점유 후보도 누락 언어 점유율을 실제로 높이는 경우 교체할 수 있다.
- 다중 목표 언어에서도 반복 후렴 전체를 고정하지 않고 대표 훅 슬롯 1개만 연결한다.
- 생성 옵션 설명은 카드별 실제 목표 언어로 표시한다. 한국어 카드에는 영어+일본어, 영어 카드에는 한국어+일본어가 표시된다.
- 언어혼합 전 구조 준비 단계에서 동일 가사 안의 정상 단어를 근거로 섹션 태그 첫 글자 유실을 복구한다. 비어 있는 기본 보컬 Outro는 Final Chorus의 곡별 마지막 가창 줄을 reprise하고, 전용 fade production cue를 추가한다.
- 내부 코드 스위칭은 자연스러운 절·구 단위 경계에서만 사용하도록 프롬프트를 강화한다. 문법 경계가 불확실하면 완전 목표언어 줄 또는 완결된 절 전환을 우선한다.
- 기존 한국어+영어 2개국어 카드, 실제 병렬 실행, 비율 보충, HardBan, 섹션·큐 잠금, V2, Firebase/Auth/Firestore/Functions는 유지한다.
- 엔진 버전: `v1-language-mix-three-language-card-targets-step16-active-31`.

### 다음 곡 적용 언어 옵션 복원 (step17)
- 저장곡의 `lyricLanguages`를 순서까지 유지해 다음 메인 생성 모달의 `가사/제목 언어`로 복원한다.
- `isKoreanEnglishMix`, `englishMixRatio`, `languageMixTargetLanguages`도 함께 복원해 언어혼합 ON/OFF, 비율, 섞을 언어가 다음 곡에 그대로 이어진다.
- 과거 저장본에 언어 필드가 없으면 기존 기본값(한국어, 혼합 비활성)을 유지한다.


## 157차 — 최종 섹션·프로덕션 큐 무결성 복구

- 기준: `SORIDRAW_156차_next_song_language_options_restore_fix.zip`.
- 원인 1: V1 섹션 가드는 본문이 비어 있는 필수 섹션을 공개 렌더링에서 제거한다. 초기 구조화 응답에 섹션 슬롯이 있었더라도 이후 정리 단계에서 본문 소유권이 어긋나면 Bridge 같은 태그가 사라질 수 있었다.
- 원인 2: 마지막 HardBan/훅/퍼포먼스 플랜 단계 뒤에는 필수 섹션을 Gemini로 다시 복구하는 단계가 없고, 기존 로컬 보정은 태그 자체가 사라진 슬롯을 삽입하지 못했다.
- 원인 3: 초기 `productionCues` 배열이 존재해도 최종 퍼포먼스 플랜 정규화에서 생산 도메인으로 인정되지 않은 cue는 제거되며, 이후 누락 cue를 채우는 최종 단계가 없었다.
- Chorus/Hook/Refrain 뒤에 빈 줄로 분리된 독립 문단이 있고 바로 다음 필수 Bridge가 비어 있으면 그 문단을 Bridge 본문으로 안전하게 되돌린다. 일반 Verse 문단은 임의 분할하지 않는다.
- 최종 HardBan 이후에도 필수 섹션이 실제로 비어 있으면 기존 targeted section-body Gemini 복구를 `missingOnly` 모드로 한 번 실행한다. 기존 가사와 섹션은 유지하고 누락 본문만 생성한다.
- 복구된 섹션에는 동일한 canonical Section Performance Plan을 다시 적용해 퍼포먼스 태그와 프로덕션 이벤트를 복원한다.
- 악기 cue가 켜진 경우 최종 섹션별 cue를 다시 검사한다. 같은 섹션의 다른 언어 카드 cue, canonical plan cue 순서로 재사용하고, 둘 다 없을 때만 누락 섹션을 한 번에 묶어 Gemini가 현재 곡 전용 cue를 생성한다.
- 모든 복구는 언어혼합 전에 끝낸다. 이후 잠금형 언어혼합은 복구된 섹션 태그·프로덕션 cue를 그대로 잠근다.
- 공개 진단에 `sectionIntegrityRepair`를 추가해 누락 카드, 복구 카드, cue 복구 섹션, 미해결 섹션, 추가 Gemini 호출 수를 기록한다.
- 언어혼합 비율·3개국어 분배·다음 곡 적용·Firebase/Auth/Firestore/Functions·저장 구조는 변경하지 않는다.
- 섹션 무결성 버전: `v1-final-section-cue-integrity-step18-active-32`.

## 158차 — 다음곡 적용과 기본 초기화 범위 분리
- `다음곡에 적용`으로 복원한 가사/제목 언어, 언어혼합 ON/OFF, 혼합 비율, 혼합 대상 언어는 해당 적용 흐름에서만 유지한다.
- 전역 `무작위`와 `전체초기화`는 생성 옵션을 앱 기본값인 `한국어 단독 + 언어혼합 OFF + 혼합 대상 없음 + 비율 10%`로 되돌린다.
- 기존 156차의 `다음곡에 적용` 복원 기능은 유지한다.

## 159차 — 언어혼합 이후 최종 섹션·악기 큐 무결성 확정

- 기준: `SORIDRAW_158차_language_option_default_reset_scope_fix.zip`.
- 실제 원인은 157차 복구가 `applySectionCueOutputPolicyToSongResult`와 잠금형 언어혼합보다 먼저 실행된 호출 순서였다. 이후 공개 cue 정책 또는 카드별 언어혼합 결과가 최종 가사가 된 뒤에는 복구를 다시 실행하지 않았고, `sectionIntegrityAudit`도 복구 전 언어혼합 결과를 기준으로 작성됐다.
- 처리 순서를 `HardBan/구조 확정 → 공개 cue 정책 → 언어혼합 직전 구조·cue 복구 → 완성본 스냅샷 저장 → 잠금형 언어혼합 → 최종 구조·cue 복구 → 최종 audit 재계산`으로 변경한다.
- 언어혼합 직전 복구는 누락된 필수 섹션 본문만 targeted Gemini로 채우고, 같은 카드의 기존 가사·훅·언어 배치·섹션 순서는 수정하지 않는다.
- 언어혼합 이후 구조 태그가 예상치 못하게 누락되면 언어혼합 직전의 동일 카드 완성본 스냅샷에서 해당 섹션 블록만 제자리로 복원한다. 기존 혼합 가사 줄은 손대지 않는다.
- 악기 cue는 최종 출력에서 다시 검사하며 `다른 언어 카드의 동일 섹션 cue → canonical Section Performance Plan → 누락 섹션 전용 Gemini cue` 순서로 채운다.
- 복구 뒤 `languageMixAudit`, 카드별 실제 혼합 비율, 목표 언어별 비율, `sectionIntegrityAudit`를 최종 가사로 다시 계산한다. 따라서 보고서가 복구 전 상태를 보여주는 stale audit 문제도 제거한다.
- 정상 가사에서 누락이 없으면 추가 Gemini 호출이나 가사 변경이 발생하지 않는다. 언어혼합 후보 선택·비율·후렴 모티프·HardBan·3개국어 분배는 변경하지 않는다.
- 섹션 무결성 버전: `v1-post-language-mix-section-cue-integrity-step19-active-33`.
