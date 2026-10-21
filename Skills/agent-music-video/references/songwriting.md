# Phase 2 — Songwriting (lyrics + a style prompt for the music generator)

The lyrics carry the story; the video only amplifies them. A video can't rescue a song with no hook.

## Shape
- **Narrator with a voice.** A character telling the story (the worked example: a nervous little AI agent
  recapping the week to its "boss") gives you jokes, emotion and a natural music-video protagonist.
- **A spine.** Something that orders the verses: days of the week, a countdown, a journey, before/after.
- **A running gag that becomes the hook.** One absurd fact or catchphrase, sung in the chorus and paid off
  in the bridge/outro. The chorus should be chantable (a two-syllable shout like "S! I!" is gold).
- **Escalation.** Verse facts → pre-chorus tension → chorus release; bridge = twist/confession/quiet;
  breakdown = call-backs to earlier gags; final chorus bigger (key change); outro = bookend the intro.
- **Humour from specifics**: real numbers and names in absurd framings ("ten cents a million — cheapest poet
  of all time"). Puns on product names. Self-aware lines ("Suno sings the melody — wait… that's us?").
- **Explainers (a feature or tool):** teach the 3–4 things a viewer needs (what it is, how to get it, the best real uses, the
  caveat), give the abstract idea a physical metaphor the video can build on (e.g. a song about Claude Code's add-on mods: Claude
  Code = a car, each mod = a part: brakes, gauges, tint, launch codes), lead with the useful examples people actually built
  and give toys one contrast line, and end the bridge on the honest caveat (that song: "no sandbox… read it 'fore you run it").
- **Facts stay true.** Rounding for rhyme is OK ("fifty billion, not seventy" for ~$50B vs ~$68B) but note it
  in the fact key and label it on screen ("≈70 in the song").

## Format (what the generator and the pipeline both need)
```
# Title
[Intro – spoken]
Line…
[Verse 1]
…
[Pre-Chorus]
[Chorus]
[Verse 2] [Pre-Chorus 2] [Chorus] [Bridge] [Breakdown] [Final Chorus – key change] [Outro – spoken]
```
- One sung line per line; section tags in square brackets on their own line. `align_lyrics.py` reads this
  exact format later (tags become sections; choruses/chants default to "no captions").
- Parenthetical shouts/backing vocals in `( )`. Pure stage directions in `*( )*` — they won't be sung.
- ~2,500–3,500 characters for a 3–4 min song. Check your generator's limit.
- **Style prompt**: genre, BPM, instrumentation, vocal character, hook treatment, structure notes
  (e.g. "funk-pop, 118 bpm, slap bass, horn stabs, talkbox, gang-vocal chants, cheeky lead, record-scratch
  intro, key change final chorus"). **No artist names** (generators block them). Add an "Exclude:" line.
- Add a **fact key** table: lyric → real story → date/source. It feeds the storyboard and keeps you honest.

## Hand-off
Save `lyrics.md` (lyrics + style prompt + fact key). If the user will generate the track themselves, stop here
and tell them exactly what to paste where. When the track comes back, expect small lyric changes —
the generator improvises; the transcript tells you what was actually sung.

Variations: a user-supplied topic (product launch, team recap, birthday, explainer) uses the same craft —
replace "research" with their notes. If the user wants an instrumental, skip lyrics and build a beat-driven
video (no captions, story told by visuals and on-screen text).
