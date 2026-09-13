# Launch plan and copy

## Host it on GitHub first

Use the public [repository](https://github.com/c0ntrix/soft-landing) as the home page
and [Releases](https://github.com/c0ntrix/soft-landing/releases) for downloads.
This keeps source, changes, tests and install files together. The app runs locally;
there is no backend to rent or maintain. A separate website can wait until people
actually want the tool.

GitHub releases support versioned downloadable files, notes and links to source.
See [GitHub's release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

Repository description:

> A skill to help Codex save its place before your quota runs out. Less lost context. Easier restarts.

Keep the name **Soft Landing**. Use **for Codex** in the description, leaving the
name open to future adapters. Do not advertise support for other agents yet.

## Start with a small beta

1. Publish a tested prerelease and keep the simple installation prompt prominent.
2. Ask five interested Codex users to install it and try a small task.
3. Ask where setup got confusing and whether the checkpoint improved their restart.
4. Fix the most common friction before promoting more widely.

A useful first target: four of five testers can complete setup without a call.
This is a target, not a measured result. No telemetry is needed; voluntary issue
reports with OS, architecture, version and a redacted error are enough.

## X post

Ready to post after the release is available:

> Your Codex quota runs out. Your place in the task shouldn't.
>
> I built Soft Landing: quota warnings, saved checkpoints, easier restarts.
>
> Local. MIT licensed. Early beta for Windows and Mac.
>
> https://github.com/c0ntrix/soft-landing

Attach a short recording if available: start a tiny disposable task, show a
checkpoint, then resume it. Label an injected warning **simulated quota warning**.
Do not imply the video demonstrates actual quota exhaustion.

Follow-up reply:

> It manages tasks started through Soft Landing. It can't attach to an existing
> desktop task, and a warning isn't a guaranteed stop. The useful part is having
> a checked handoff when you come back. Setup feedback is very welcome.

## Reddit post

Title:

> I built a local Codex helper that saves a checkpoint before quota gets too low

Body:

> I built **Soft Landing** to make it easier to return to a Codex task after a
> quota-related pause. It starts a managed task, monitors the account's reported
> limits outside the model, and asks Codex to save a checkpoint when quota gets low.
>
> You get a record of completed work, checks, open issues and the next step. When
> you resume, it checks the saved state against the files first.
>
> It's a small MIT-licensed project with a Codex skill and a desktop menu. Windows
> and Mac ZIPs include the runtime, so there's no separate Node setup or API key.
>
> The main limitation: it only manages tasks you start through it. It doesn't
> attach to an existing desktop task, and quota warnings can't guarantee a timely
> stop. Mac packaging is tested in CI with a fake Codex server; real Mac account
> and sandbox feedback would be especially useful.
>
> Source and downloads: https://github.com/c0ntrix/soft-landing
>
> If you've hit a quota limit mid-task, would this handoff help? I'd especially
> appreciate feedback on setup and the quality of the saved next step.

Choose a community where Codex workflows are already discussed. Read its current
rules and use a project/showcase thread if required. Be explicit that you built it.
Post once in the best-fitting community and answer questions before considering
another. Do not mass-post identical links or use automated engagement.
See [Reddit's spam policy](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam).

These are drafts, not published posts. Avoid user counts, measured savings or
reliability claims until actual feedback supports them.
