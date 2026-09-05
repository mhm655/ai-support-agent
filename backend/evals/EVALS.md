# Retrieval evaluation

A reproducible benchmark for the RAG retrieval stage of this project:
does the pipeline actually put the right passage in front of the model,
and does changing the chunking configuration measurably help?

Everything here runs against the real `chunking.chunk_text` and the real
`embeddings.embed_texts`. Nothing is reimplemented for the benchmark.

```bash
cd backend
venv\Scripts\activate
python evals/validate_eval_set.py          # check the labels first
python evals/retrieval_eval.py --failures  # baseline, production config
python evals/retrieval_eval.py --sweep     # all chunk configs + paired tests
```

Embeddings are cached to `evals/.embedding_cache/`, so the first run costs
Gemini quota and every rerun is free and offline.

---

## Headline results

Baseline, at the shipped configuration (`chunk_size=800, overlap=150`):

| metric | value |
| --- | --- |
| recall@3 | 90.0% |
| recall@5 | **97.5%** (95% CI 87–100%) |
| MRR | 0.840 |
| precision@3 | 30.8% (ceiling 35.8%) |
| precision@5 | 20.5% (ceiling 21.5%) |
| mean context words @5 | 3,309 |

**The most useful finding is not an improvement in recall.** It is that
200/40 chunking holds recall flat while cutting the retrieved context by
3.5x, from 3,309 words to 940. Since that context is pasted into every
chat prompt, that is a real reduction in cost and latency per message for
no measurable accuracy loss.

**The most honest finding is that no configuration in the sweep is
statistically distinguishable from the baseline.** See the caveats.

---

## What the eval set is

13 documents, 11,397 words, modelled on what a small business actually
uploads to this product: opening hours for two locations, a fee schedule,
insurance and billing, office policies, procedure explanations, new
patient information, emergency guidance, oral health advice, and an FAQ.
It uses the same fictional dental practice as the live demo page.

40 questions, each labelled with the verbatim span of source text that
answers it. Difficulty is mixed on purpose:

| type | n | what it tests |
| --- | --- | --- |
| direct | 17 | question wording overlaps the source |
| paraphrase | 17 | wording deliberately diverges — "back tooth" for "molar", "laughing gas" for "nitrous oxide" |
| inference | 3 | the answer requires a small step — asks about a twelve year old, the policy says "under fourteen" |
| confusable | 2 | a near-miss passage exists — Oak Park is closed Mondays while Riverside is open; Cigna DPPO is accepted while Cigna DHMO is not |
| cross_topic | 1 | the answer lives in the document the topic does *not* suggest |

### Ground truth is a span, not a chunk id

This is the design decision that makes the sweep meaningful. Chunk
boundaries move when `chunk_size` changes, so a chunk id is not a stable
label across configurations — relabelling per config would let the
labeller decide the winner.

Instead each question stores a verbatim substring of its source document.
A retrieved chunk counts as a hit if it *contains* that span. The label is
then independent of chunking, and the same 40 labels score all seven
configurations.

`validate_eval_set.py` enforces four properties before any number is
produced:

1. every span appears verbatim in the document it is attributed to;
2. no span appears in a second document, which would make the label
   ambiguous;
3. question ids are unique;
4. at every config under test, at least one chunk fully contains the span.

Property 4 matters: a span split across a chunk boundary is unreachable no
matter how good the embeddings are. That would be a real property of the
config, but it must be visible rather than silently scored as a retrieval
failure. All 40 questions are reachable at all seven configs, so nothing
was excluded on this basis.

---

## Metrics, and what each is worth

**recall@k** — fraction of questions where at least one chunk containing
the answer span is in the top k. This is the headline number, because it
is what the generator needs: the answer has to be *somewhere* in the
context window.

**strict_recall@k** — the textbook `|relevant ∩ retrieved| / |relevant|`.
Differs from recall@k only where overlap placed a span in two adjacent
chunks and one was retrieved. Recorded in the JSON output.

**precision@k** — reported because it is a standard ask, but on this eval
set it carries almost no information. Nearly every question has exactly
one chunk containing its span, so precision@5 cannot exceed ~20% however
good the retriever is. The tables therefore print `achieved/ceiling`,
where the ceiling is computed per question as `min(|relevant|, k) / k`.
Reading a raw 20.5% as "80% of retrievals were junk" is wrong; it is
20.5% against a hard ceiling of 21.5%.

**MRR** — mean reciprocal rank of the first relevant chunk. Separates
"ranked first" from "scraped in at position five", which recall@5 cannot.

**context_words@k** — mean total words across the k retrieved chunks. Not
a quality metric, a *cost* metric. Recall can always be bought by making
chunks bigger; this column shows the price.

---

## Configuration sweep

All seven configurations tried, including the ones that did not help.

| config | chunks | recall@3 | recall@5 | 95% CI on R@5 | MRR | P@3 | P@5 | ctx@5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **800/150** (shipped) | 22 | 90.0% | **97.5%** | 87–100% | **0.840** | 30.8/35.8% | 20.5/21.5% | 3,309 |
| 600/120 | 26 | 82.5% | 90.0% | 77–96% | 0.753 | 30.0/38.3% | 19.5/23.0% | 2,604 |
| 400/80 | 39 | 77.5% | 82.5% | 68–91% | 0.711 | 30.0/38.3% | 19.5/23.0% | 1,598 |
| 300/60 | 49 | 82.5% | 85.0% | 71–93% | 0.713 | 30.0/37.5% | 18.5/22.5% | 1,310 |
| **200/40** | 74 | **92.5%** | 95.0% | 83–99% | 0.743 | 35.0/39.2% | 22.5/23.5% | **940** |
| 400/0 (no overlap) | 35 | 80.0% | 90.0% | 77–96% | 0.692 | 26.7/33.3% | 18.0/20.0% | 1,629 |
| 400/160 (40% overlap) | 45 | 80.0% | 87.5% | 74–95% | 0.710 | 32.5/48.3% | 22.5/29.0% | 1,799 |

### Are any of these differences real?

No. Every configuration was scored on the same 40 questions, so the right
test is paired — exact McNemar on the discordant questions, not a
comparison of two independent proportions.

| config | ΔR@5 | fixed (b) | broke (c) | p | verdict |
| --- | --- | --- | --- | --- | --- |
| 600/120 | −7.5% | 0 | 3 | 0.250 | not distinguishable |
| 400/80 | −15.0% | 1 | 7 | 0.070 | not distinguishable |
| 300/60 | −12.5% | 1 | 6 | 0.125 | not distinguishable |
| 200/40 | −2.5% | 1 | 2 | 1.000 | not distinguishable |
| 400/0 | −7.5% | 1 | 4 | 0.375 | not distinguishable |
| 400/160 | −10.0% | 1 | 5 | 0.219 | not distinguishable |

Nothing reaches p < 0.05. The closest is 400/80, and it is *worse* than
the baseline, not better.

So the correct claim is **not** "200/40 is as good as 800/150". It is
"this eval set is not powerful enough to separate them". At n=40 the 95%
interval on a recall near 90% is roughly ±9 points, which is wider than
every difference in the table.

### The one claim the data does support

The recall differences are inside the noise, but `ctx@5` is a direct
measurement, not a sample statistic. 200/40 returns 940 words at k=5
against the baseline's 3,309 — a 3.5x reduction in retrieved context —
while its recall@5 sits 2.5 points below baseline at p = 1.000, and its
recall@3 sits 2.5 points *above* it.

That is worth saying carefully: the efficiency gain is measured, the
accuracy parity is *not contradicted* by the data but also not
established by it.

### Why the middle configurations are worst

recall@3 is U-shaped: 90.0% at 800, down to 77.5% at 400, back up to
92.5% at 200. The plausible reading is that the two ends win for opposite
reasons. Large chunks win by brute inclusion — at 22 chunks, the top 5 is
23% of the entire corpus. Small chunks win on embedding quality, because a
200-word chunk is usually about one thing and its vector is not an average
of four unrelated topics. 400 words is too big to be topically clean and
too small to catch the answer by volume.

This is a hypothesis consistent with the numbers, not something the eval
proves.

---

## Caveats, stated plainly

**1. The baseline's recall is flattered by a small candidate pool.** At
800/150 the corpus is 22 chunks, so retrieving 5 means retrieving 23% of
everything. At 200/40 it is 74 chunks and k=5 is 6.8%. The two columns are
not doing equally hard work for the same score. This is the single biggest
reason not to quote 97.5% without context.

**2. Similarity is computed in process, not by pgvector.** Production
ranks with the `match_chunks` RPC over an IVFFlat index (`lists = 100`);
this harness ranks with exact cosine in Python. Two reasons: the sweep
would otherwise require re-embedding and re-inserting the whole corpus
into the live Supabase instance seven times, and IVFFlat is an
*approximate* index whose recall at this data size is itself noisy.
Exact cosine is the upper bound of what the index can return, so these
numbers are a ceiling on production retrieval, not a measurement of it.
**This has not yet been cross-checked against the live index** — see
"Not done yet".

**3. n=40 is small.** Every proportion here carries a ±9 point interval.
The eval set would need to be roughly 4x larger to resolve differences of
the size seen in the sweep.

**4. This measures retrieval only.** It says nothing about whether the
generator then produces a correct answer from the retrieved context. A
chunk containing the answer span is necessary, not sufficient.

**5. The corpus is synthetic.** It was written for this benchmark, in the
style of the demo data, not collected from real customers. It is
deliberately full of confusable near-duplicates, which makes it harder
than a naive corpus, but it is not real-world distribution.

**6. Two labels are known-weak.** `q02` (which evening is late) has a
second passage in the same document that answers it equally well but may
land in a different chunk; `q35` (warfarin) has a span that does not
itself contain the word "warfarin". Both depress scores rather than
inflate them, so they were kept.

---

## Heading-prefixed embeddings

The failure analysis below pointed at one thing: misses clustered where a
fact is filed under a heading that does not match the language a customer
would use. So the next experiment was to put that heading into the vector.

**The change is minimal and touches only the embedding input.** Each chunk
is embedded as:

```
{document title} - {every section heading the chunk covers}

{chunk body}
```

The stored `content` is unchanged, so the chunk boundaries, the chunk text
handed to the generator, and the relevance labels are byte-identical to
baseline. Only the vector differs. That makes this a clean single-variable
comparison, and `chunk_corpus_with_headings` asserts boundary equality
against `chunk_text` so the pairing cannot silently break.

`context_words@k` does still move slightly — not because any chunk changed,
but because a different *set* of chunks is retrieved and chunks vary in
length (the last chunk of each document is short). At 800/150 it drops from
3,309 to 2,868 for that reason alone.

One design note. Prefixing only the heading in force where a chunk
*starts* is wrong at large chunk sizes: at 800 words a chunk spans about
seven sections, and the `policies.md` chunk containing the treatment
guarantee starts under "Records and privacy". Prefixing that alone would
attach a misleading label. Every heading the chunk covers is used instead.

### Results, each config against itself

| config | recall@3 plain | +headings | delta | fixed | broke | p |
| --- | --- | --- | --- | --- | --- | --- |
| 800/150 (shipped) | 90.0% | 92.5% | +2.5% | 3 | 2 | 1.000 |
| 600/120 | 82.5% | **100.0%** | +17.5% | 7 | 0 | **0.016** |
| 400/80 | 77.5% | 87.5% | +10.0% | 4 | 0 | 0.125 |
| 300/60 | 82.5% | 95.0% | +12.5% | 5 | 0 | 0.062 |
| 200/40 | 92.5% | 97.5% | +5.0% | 2 | 0 | 0.500 |
| 400/0 | 80.0% | 95.0% | +15.0% | 6 | 0 | **0.031** |
| 400/160 | 80.0% | 95.0% | +15.0% | 6 | 0 | **0.031** |

MRR moves the same way, and by more than recall does:

| config | MRR plain | +headings | delta |
| --- | --- | --- | --- |
| 800/150 | 0.840 | 0.800 | **−0.041** |
| 600/120 | 0.753 | 0.846 | +0.093 |
| 400/80 | 0.711 | 0.785 | +0.074 |
| 300/60 | 0.713 | 0.860 | +0.147 |
| 200/40 | 0.743 | 0.860 | +0.117 |
| 400/0 | 0.692 | 0.863 | +0.171 |
| 400/160 | 0.710 | 0.899 | +0.189 |

### How strong is this really

Unlike the chunk-size sweep, the direction is consistent: recall@3 and
recall@5 improved in **7 of 7** configurations, and across all configs the
discordant questions run **33 fixed against 2 broken**.

But the statistics need stating carefully, because this is seven tests:

- Three configs reach p < 0.05 individually.
- **None survives Holm-Bonferroni correction** for seven comparisons. The
  smallest p, 0.016, would need to clear 0.05/7 = 0.007.
- The 33-versus-2 pooled count is *not* a valid independent test. All seven
  configs are scored on the same 40 questions, so those counts are heavily
  correlated and the tempting p-value from a sign test would be badly
  overstated.

So the honest summary is: **a consistent, sizeable effect in the expected
direction across every configuration, which does not survive strict
multiple-comparison correction on a 40-question eval set.** It needs
confirmation on a larger or held-out set before being called established.

That is still a materially stronger result than the chunk-size sweep, where
there was no directional consistency at all and the largest effect ran the
wrong way.

### The production config benefits least

800/150 is the one configuration that barely moves, and its MRR actually
drops slightly. The mechanism is the same one that motivated using all
covered headings: an 800-word chunk spans roughly seven sections, so its
prefix is a long list, which dilutes rather than sharpens the vector. At
200-400 words the prefix names one to three sections and is precise.

The implication is that headings and smaller chunks are complementary, and
adopting headings alone at the current chunk size would gain little.

### Best configuration found

200/40 with heading prefixes, against the shipped 800/150:

| metric | shipped | 200/40 +headings |
| --- | --- | --- |
| recall@3 | 90.0% | **97.5%** |
| recall@5 | 97.5% | **100.0%** (0 misses of 40) |
| MRR | 0.840 | **0.860** |
| context words @5 | 3,309 | **935** (3.5x less) |

Better on every metric with 3.5x less retrieved context. The caveat stands:
this specific pairwise swap is **not** individually significant (recall@3
p = 0.375, recall@5 p = 1.000), because the shipped config was already at
97.5% at k=5 and there is almost no headroom left to demonstrate.

The context reduction is the part that is directly measured rather than
inferred, and it is the strongest claim available: **the same or better
retrieval on a third of the prompt.**

---

## Documented negative results

**Asymmetric embeddings do nothing on this model.** Gemini's embedding API
accepts a `task_type` (`RETRIEVAL_DOCUMENT` for chunks,
`RETRIEVAL_QUERY` for questions), which on most embedding models measurably
improves retrieval. `embeddings.embed_texts` does not set it.

Setting it changes nothing. `gemini-embedding-2` returns **byte-identical
vectors** whether `task_type` is unset, `RETRIEVAL_DOCUMENT`, or
`RETRIEVAL_QUERY` — cosine similarity between the variants is exactly
1.0, and every metric in the sweep is unchanged to three decimal places.

This was verified as a genuine model behaviour rather than a parameter
being silently dropped: the API *rejects* an invalid `task_type` with
`400 INVALID_ARGUMENT`, so the field is transmitted and parsed, and the
model simply ignores valid values. Reproduce with
`python evals/retrieval_eval.py --sweep --task-type`.

Conclusion: asymmetric embedding is not an available lever here. It would
be on OpenAI or on `text-embedding-004`.

---

## Which questions are hard

Counting misses at k=5 across all seven configurations:

| question | missed in | why it is hard |
| --- | --- | --- |
| q18 "what if a filling you placed breaks" | 6 of 7 | the answer is under a *guarantees* heading in `policies.md`, and the word "breaks" pulls toward the emergencies and procedures documents |
| q20, q10, q38, q39 | 4 of 7 each | q10 is the deliberate cross-topic case: whitening coverage is in `pricing.md`, but every insurance-shaped query is drawn to `insurance_and_billing.md` |
| q22 "laughing gas and how much" | 2 of 7 | near-duplicate content — the nitrous oxide fee appears in both `services_and_procedures.md` and `pediatric_and_ortho.md`, and the "how much" half pulls toward `pricing.md`, which does not list it. At 800/150 the correct chunk ranked 12th of 22 |

The pattern is consistent and is the most actionable output of the whole
exercise: **failures cluster where a fact is filed under a heading that
does not match the language a customer would use for it.** That is a
content and chunk-labelling problem, not an embedding-model problem, and
it points at prepending document and section headings to each chunk before
embedding as the next thing worth trying.

---

## Not done yet

- **Cross-check against the live pgvector index.** The gap between exact
  cosine and IVFFlat at `lists = 100` is unmeasured. Until it is, caveat 2
  stands and these are ceiling numbers.
- **Header-prefixed chunks.** Suggested directly by the failure analysis
  above; not yet run.
- **A larger eval set.** Required before any sweep difference of this size
  can be called real.

## Operational note

The Gemini free tier allows **100 embedding requests per minute** for
`gemini-embedding-2`, and each *text* inside a batch counts against that
quota, not each HTTP call. A batch of 30 texts costs 30. `common.py`
paces itself to 90/minute and retries 429s honouring the API's
`retryDelay`. This limit is also a hard ceiling on document ingestion
throughput in production.

---

# Latency

```bash
python evals/latency_ingest.py --reps 3 --pages 4 12 24
python evals/latency_chat.py --n 25 --base-url http://localhost:8000
```

## Document ingestion

Real PDFs through the real pipeline: `document_parsing.extract_text` →
`chunking.chunk_text` → `embeddings.embed_texts` → insert. Stages are
timed separately because one of them dominates and a single total would
hide which.

Medians, n=3 at 12 pages, n=1 at the others:

| pages | words | chunks | parse | chunk | embed | insert | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | 1,651 | 3 | 12 ms | 0.1 ms | 0.73 s | 1.15 s | **2.19 s** |
| 12 | 4,810 | 8 | 32 ms | 0.3 ms | 1.27 s | 4.28 s | **6.16 s** |
| 24 | 9,409 | 15 | 62 ms | 0.6 ms | 1.33 s | 10.30 s | **12.09 s** |

12-page document: p50 **6.16 s**, max 8.04 s across 3 runs.

**The embedding call is not the bottleneck. The database insert is** — 70%
of total at 12 pages, 85% at 24.

Embedding barely scales with document size (0.73 s → 1.33 s across a 6x
increase in words) because `embed_texts` batches every chunk into one API
call. That batching decision, already in the code and commented as a cost
optimisation, turns out to matter more for latency than for cost.

The insert scales linearly and steeply instead. The mechanism is payload
size: a 1536-dimension vector serialises to roughly 19 KB of JSON decimal
text, so **one chunk row is about 22 KB on the wire** and a 15-chunk
document is a single 328 KB POST through PostgREST.

### Caveat: the insert numbers are network-bound, and do not transfer

Measured from the development machine (Windows, home connection), a
deliberate probe found:

- baseline Supabase round trip for a **trivial** query: **581 ms median**,
  356 ms best
- effective insert throughput: **28-59 KB/s**

At that bandwidth a 328 KB insert takes about six seconds on transfer
alone, which accounts for essentially all of the 10.30 s figure. This is a
property of the link between this laptop and Supabase, **not** of Postgres,
pgvector, or the application.

What survives regardless of where the code runs: ~22 KB of payload per
chunk is structural, and it is a real argument for doing ingestion close
to the database. What does not survive: the absolute numbers. The Railway
deployment sits in a datacenter and would very likely be far faster.
**These figures should be re-measured from Railway before being quoted.**

The same 581 ms round trip has a second consequence. `stream_chat_response`
makes **five sequential Supabase calls** per message — create conversation,
save user message, retrieval RPC, load history, save reply — so from this
machine roughly 3 seconds of every chat response is database round trips
before Gemini is reached at all. That is the single largest thing local
chat latency measurements will show, and it is close to meaningless for
production.

## Chat latency

Measured 2026-09-05, 25 sequential requests per target, each on a fresh
conversation.

| stage | local p50 | local p95 | Railway p50 | Railway p95 |
| --- | --- | --- | --- | --- |
| `connect` (to `conversation` event) | 840 ms | 3080 ms | 1499 ms | 2109 ms |
| **TTFT** (to first token) | **3602 ms** | **6138 ms** | **3791 ms** | **5034 ms** |
| `total` (to `done`) | 3989 ms | 6405 ms | 4143 ms | 5918 ms |

25/25 succeeded on both. Local is `127.0.0.1:8000`; Railway is the live
deployment.

### The two are much closer than expected

The prediction going in was that Railway would be markedly faster, because
the development machine's Supabase round trip measures ~581 ms and
`stream_chat_response` makes five of them per message, while Railway sits
in a datacenter. Median TTFT differs by **189 ms**, about 5%.

The reason the totals barely move is that neither is dominated by the
database. Subtracting `connect` from TTFT isolates the middle of the
request — retrieval (query embedding plus the pgvector RPC), the history
load, and the entire non-streaming tool-decision call:

| segment | local | Railway |
| --- | --- | --- |
| pre-`conversation` (2 Supabase writes) | 840 ms | 1499 ms |
| retrieval + history + decision pass | 2762 ms | 2292 ms |

Railway *is* faster in the middle segment, by ~470 ms, which is close to
one Supabase round trip and consistent with it being nearer the database.
That gain is then handed back in `connect`, because the deployed
measurement includes a client-to-Railway hop and TLS that the local one
does not have at all.

So the honest reading is: **the deployment is slightly closer to Supabase
and slightly further from the client, and those roughly cancel. The
dominant cost in both is the two Gemini calls, not hosting.**

That also means the two-pass chat design is the main lever on perceived
latency, not the database. The non-streaming tool-decision pass produces
no output, so the visitor waits through all of it before the first token.
`CLAUDE.md` estimates that pass at "an extra ~1s"; the measured middle
segment of 2.3-2.8 s, which also contains retrieval and the history load,
is consistent with that estimate but does not isolate it.

### Caveats

- **`connect` is not apples to apples.** Local has no network hop; Railway
  includes one. The comparison of that row alone is meaningless.
- **Reply length differed** between runs (150 chars over 2.9 SSE events
  locally, 224 over 3.7 on Railway). Longer replies inflate `total`.
  TTFT is unaffected, which is part of why it is the headline number.
- **Requests were spaced 12 s apart**, so this is *unloaded* latency. It
  says nothing about behaviour under concurrency; see LOADTEST.md.
- **n=25**, so p95 is close to the second-worst sample. Treat it as
  indicative.
- **Railway is running the pre-rate-limit build.** That does not affect
  these numbers (the limiter adds one dictionary operation to an allowed
  request) but it means the deployed code is not the committed code.

### Why the spacing was necessary

A first attempt at 1 s spacing returned 4/25 successes. The failures split
17 / 4:

- 17 were **HTTP 429 from this project's own new rate limiter** (8/min per
  IP). Working as designed, but it means a single-IP benchmark cannot
  exceed 8 requests per minute against a default-configured instance.
- 4 were **429 from Gemini**. Each chat message costs two model calls, so
  8 messages a minute is 16 calls a minute, which the free tier declines.

Both ceilings are properties of the environment rather than of the code
under test, and both have to be respected to get a clean measurement.

### Earlier attempt, and what it cost

The first run of this benchmark, on 2026-09-04, produced a TTFT p50 of
**53.5 s with 16 of 25 requests failing**, and was discarded rather than
reported. `gemini-3.5-flash-lite` was in a multi-hour degraded state:

| model | result during the outage |
| --- | --- |
| `gemini-embedding-2` | works |
| `gemini-3.5-flash-lite` (the production chat model) | **503 UNAVAILABLE, 0/8 over a minute of probing** |
| `gemini-3.5-flash` | works |
| `gemini-flash-latest` | works |

| model | result |
| --- | --- |
| `gemini-embedding-2` | works |
| `gemini-3.5-flash-lite` (the production chat model) | **503 UNAVAILABLE, 0/8 over a minute of probing, still failing later** |
| `gemini-3.5-flash` | works |
| `gemini-flash-latest` | works |

The outage is specific to `gemini-3.5-flash-lite`. The API key, project,
and quota are all healthy.

Two things worth recording about this:

**The error handling works.** Every failure surfaced as a readable `error`
SSE event rather than a hung stream or an unhandled 500 — which is exactly
the behaviour the `error` event was added for, now confirmed against a real
upstream outage rather than a simulated one.

**Falling back to `gemini-3.5-flash` is not free.** It worked during the
outage, but its free tier on this project caps at 20 requests/day, and each
chat message costs two calls — the constraint that drove the original move
to flash-lite. A fallback chain trades an outage for a ten-message daily
ceiling. It was implemented anyway (see `CHAT_MODEL_CHAIN`), and later that
day it was observed firing against the real outage: flash-lite returned
`ServerError` on both passes, the chain fell through to flash, and the
visitor got a normal reply.

**A lesson about health checks.** The first recovery detector probed with
`"Say OK"` and declared the model healthy while it was still badly
degraded — tiny requests squeaked through while realistic ones carrying
~1200 words of retrieved context took 40-67 s or timed out. It triggered
the 53 s benchmark above. The probe now uses a realistically sized prompt
and treats "responded, but slower than 8 s" as still down. **A health check
that does not resemble the traffic it is gating does not predict anything
about it.**
