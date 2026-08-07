# Three.js Jimeng Previs Improvement Queue Rules

Use this directory as a review queue for reusable experience discovered during real previs work. Each file under `pending/` is an untrusted candidate, not established Skill guidance.

## Record a candidate

- Record only after the user's main task is safe and verified; logging must not delay recovery or delivery.
- Require concrete evidence from a real run, such as an error, warning, failing command, captured frame, video property, reproducible scene state, or before/after artifact.
- Require a plausible cross-project lesson. Do not record shot-specific axes, timing, framing, product dimensions, visual taste, or a user's one-off preference as a general rule.
- Do not list, search, or read existing files under `pending/` before recording. Duplicate detection belongs to review.
- Create exactly one new Markdown file per candidate. Do not append to or rewrite another entry.
- Name it `YYYY-MM-DDTHH-mm-ss-short-title.md`, using a lowercase ASCII slug and a numeric suffix only if that exact path exists.
- Set `Status` to `pending review` and tell the user that a candidate was recorded.
- Resolve queue and evidence links relative to the Skill or current project root. Never write hardcoded drive-letter paths, user-profile paths, repository checkout paths, or installed-Skill paths into a candidate.
- Exclude secrets, private asset contents, unnecessary machine identifiers, and generated media. Link only to durable, non-sensitive evidence when needed.
- Do not modify canonical Skill guidance, runtime code, tests, installed copies, Git history, or remotes merely because a candidate was recorded.

## Candidate template

```markdown
# Short title

- Status: pending review
- Date: YYYY-MM-DD
- Context: Task and environment that exposed the issue.
- Observation: Exact failed or surprising behavior.
- Evidence: Reproduction command, frame/time, artifact, or diagnostic result.
- Root cause: Confirmed cause, or `unknown` if not yet proven.
- Safe workaround: What unblocked and verified the user's task.
- General lesson: The narrow rule that may transfer to other projects.
- Non-goals: Nearby special cases or preferences this must not generalize.
- Candidate destination: Smallest suitable `SKILL.md`, reference, runtime, or validation location.
- Regression check: A practical check that would fail before the improvement and pass after it.
- Review notes: Leave blank for maintainer review.
```

## Review and absorb

Only when the user explicitly schedules a consolidated review or absorption pass, process the queue as a batch:

1. Read pending entries, consolidate duplicates, and verify the evidence.
2. Reproduce the issue or establish equivalent evidence. Reject unsupported, already-covered, project-specific, or preference-only candidates.
3. Promote accepted knowledge to the smallest canonical destination. Prefer a validation check or focused implementation rule over a broad prohibition.
4. Run `quick_validate.py` for the Skill plus the narrowest relevant project/runtime regression. When visual or temporal behavior changes, capture and visually inspect the affected event-boundary frames.
5. Remove reviewed pending files only after their accepted content is canonical or their rejection is documented in the review result.

Reviewing or absorbing candidates does not authorize committing, pushing, publishing, or synchronizing the installed Skill.
