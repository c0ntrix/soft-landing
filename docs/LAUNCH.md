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

> Help your coding agent save its progress before it hits a usage limit. Currently Codex only. More coding agents coming soon.

Keep the name **Soft Landing**. Use **Currently Codex only. Support for more coding
agents is coming soon.** beside the broad headline. This distinguishes current
support from upcoming integrations. Track requests for Claude
Code and other clients, then expand after installation and real task behavior are verified.

## Explain the problem in plain terms

**Help your coding agent save its progress before it hits a usage limit.**

Describe a task interrupted by a usage limit, then show the saved next step.
Explain what the handoff contains: completed work, checks, open issues and where
to continue. Let the example demonstrate the benefit. Avoid promises that no work
will ever be lost or claims about time saved without actual measurements.

Start with Codex users who already hit limits during longer tasks. Someone who
rarely reaches a limit has less reason to add another tool. Ask for one small trial:
install it, start a disposable task through it, inspect the checkpoint and resume.

## A practical two-week launch

| When | What to do | What to learn |
| --- | --- | --- |
| Days 1-3 | Invite five willing testers from people you know or an allowed beta-feedback thread. Include Windows, Apple Silicon and Intel users if possible. | Can they install, start and resume without a call? |
| Days 4-5 | Fix the biggest setup problem. Record a 30-second demo with a simulated warning clearly labeled. | Does someone understand the benefit without an explanation? |
| Day 6 | Publish the X post below with the demo and one link to the repo. Pin it to your profile. | What questions or objections come back? |
| Days 7-8 | Share the Reddit post in one relevant community that permits project posts. Stay available to answer replies. | Is the pain familiar, and what would stop people trying it? |
| Days 9-14 | Publish a short update showing one real fix from feedback. Follow up with consenting testers. | Did anyone use it again on another task? |

Allow around 20 minutes a day for replies during launch. Use GitHub issues for
reproducible bugs; ask people to remove private project text from reports. Keep
downloads and instructions on GitHub so every post leads to the same next step.

Demo outline: 0-5 seconds, show "Usage limit reached" as an illustrative problem;
5-15 seconds, show a managed task receiving a **simulated quota warning**;
15-25 seconds, open its checkpoint and resume; 25-30 seconds, show the install prompt.
Use a disposable project. Record actual tool behavior and label any sped-up sections.

Track a small weekly table manually: willing testers, completed installations,
first successful resumes, repeat users and the three most common problems. GitHub
download counts are a rough interest signal, not unique users or completed installs.
Treat four of five testers installing unaided and three successfully resuming as
initial targets, not product claims. If setup is confusing, improve it before
expanding promotion. A separate site or paid ads can wait until repeat use is clear.

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

> I built Soft Landing to help Codex save a useful handoff before a usage limit interrupts a task.
>
> It records progress and the next step, then checks the files when you resume.
>
> Windows + Mac beta. MIT licensed.
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
