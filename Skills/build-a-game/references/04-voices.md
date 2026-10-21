# Step 4: Voices, sound and music

**Goal:** cast a voice for every character, build one cost-guarded tool that makes every audio file ahead of time, record what the opening of the game needs, and give the user a page to listen to all of it.

**Why it matters:** voices make characters real, and paid generation is the one place where a careless loop costs money. The rules: **static files only** (the game never generates sound), **show the cost first**, and **never pay twice**.

**Existing project:** keep its audio architecture and tools where they work. Treat ElevenLabs and the offline renderer below as optional routes, not mandatory dependencies; adapt the manifest, asset format and playback wiring to the existing engine. Don't add a provider, account, API key or paid generation unless the user explicitly chooses that route and approves each spend.

## Ask first

AskUserQuestion:
- **Audio route:** ElevenLabs for voices, sound effects and music (Recommended, if they have an account) / free: sound effects and music made in code and saved as files, with dialogue shown as subtitles only. On the free route, skip voice casting and step 5.
- **How much is voiced:** every line a character says or thinks, including thoughts and hints (Recommended: LAST CALL ended up voicing everything because silent text felt cheap next to voiced lines) / key moments only / main characters only.
- **Credit ceiling** for this project, so the tool can refuse to go over it.

**The API key:** ask the user to put it in `.env.local` themselves as `ELEVENLABS_API_KEY=...`, **not in the chat**. Then make sure `.gitignore` lists `.env.local`, and check that the key loads without ever printing it.

## Build the audio tool (`tools/gen-audio.mjs`)

**Look up the current official ElevenLabs API documentation first.** Endpoints, models and pricing change, so don't write the client from memory. Record the official documentation URL and date checked in HANDOFF, along with the current pricing basis used for the dry-run estimate. The tool reads a **manifest** and buys only what's missing:

- **Manifest** (`tools/audio/manifest/<group>.json`, one file per group, so parallel helpers never edit the same file): each asset has an id, a type (voice / sfx / music), the speaker or voice id, the text with a delivery note, the model, settings, a seed and the number of takes.
- **`--dry-run`** lists exactly what would be bought and the **estimated credits**. Always run it first and show the user the estimate.
- **`--max-credits N`** is required to buy anything. The tool refuses to go over N in a run, and refuses to cross the project ceiling.
- **A content-hash cache:** the hash of the exact request (text, voice, model, settings, seed) is the file name of the raw purchase. If it exists, it's never bought again. This also means editing a recorded line's manifest entry silently re-buys it, so recorded entries are frozen (SCRIPT.md ✅).
- **A ledger:** every paid call is logged (one file per run) with the cost and the balance before and after. **Verify the real rate on the first call**, from the cost the API reports or the balance change. LAST CALL's real cost per character turned out very different from the published estimate.
- **Post-processing** (free, offline, e.g. with ffmpeg): loudness normalisation, encoding for the web, **timing data for lip-sync** (request the character-level timestamps ElevenLabs can return, and save them next to each voice file), subtitles, effect variants (a phone line, an echo, an old record) made from the dry recording at no extra cost, and a generated `public/audio/index.json` the game reads.

The API key is read only inside this tool and its helpers, never in `src/` and never in the browser.

## Casting

**Check the licence before recording anything for a release.** Terms depend on the provider, account plan, voice and intended use, and can change. Read the provider's current official terms and confirm the user's plan and selected voice permit the intended release and commercial use, if applicable. Record the official source URL, date checked, plan/voice and relevant permission or restriction in HANDOFF. If attribution is required, include it in the making-of page's credits. Don't infer rights from payment or generation alone.

For each character, pick 2–3 candidate voices that fit the character sheet and have each read the **same short test line**. Build the **audition page** (`tools/audio/audition.html`): every candidate per role, every recorded line, every sound effect and music track, all playing the static files. Show it to the user and let them pick and swap. Typical requests are "give her an older voice" or "the rain sounds like static, redo it".

## Record the opening, not everything

Record only what the **vertical slice** needs (step 6): its lines, sound effects, ambience and music. Dry-run, show the estimate, get a yes, buy with a cap. Record the rest **batch by batch** in step 8 as each part is built. That way you never pay for lines that get rewritten during the build.

Recording tips from LAST CALL:
- **Two takes for the main characters' lines**, one for everyone else, and re-takes only for lines that fail review.
- **One-word lines** ("Four!", "What?") come out flat or clipped without context. Give them 2 takes and the surrounding lines as context.
- Make footsteps, drum hits and similar sounds as one long multi-hit file, then slice it offline. That's far cheaper than one generation per hit.
- Mark every recorded line ✅ in `SCRIPT.md`, with its file.

**Free route:** write a small offline renderer (e.g. a Node script that synthesises the sound effects and music and saves them as audio files). The game still only plays static files, and dialogue is subtitle-only.

**Done when:** the user approved the casting, the opening's audio is recorded within the cap, the audition page works, and the ledger total matches the balance change. Add the audition page to HANDOFF's demos. Next: step 5, the talking-character demo.
