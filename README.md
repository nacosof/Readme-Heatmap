# Readme Heatmap Canvas

> **Work in progress** — the public link will be added here later.


## What it does

A web tool for your GitHub profile. It loads your real commits and draws them as an interactive commit constellation — each dot is a commit, lines link commits made close in time.

You can:

- pick a time range (1 month to all time)
- filter by repository
- change node color and background
- add a caption on the image
- download the **commit constellation** as a PNG
- get a **dev card** as a PNG
- customize dev card background and text colors
- download the **dev card** as a PNG
- click on a dot (commit) to open it on GitHub
- share a link with your current settings

## Stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS 4
- HTML Canvas (force-directed graph)
- GitHub GraphQL & REST
