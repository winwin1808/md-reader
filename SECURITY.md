# Security Policy

## Supported versions

Only the latest 1.x release receives security fixes.

## Reporting a vulnerability

Please report privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Do not open a public issue, pull request or discussion for a vulnerability.

Include the affected component, steps to reproduce, and the impact you observed.

## Scope

- The browser extension (`apps/extension`, `packages/*`)
- The sync server (`apps/api`)
- The web share page (`apps/web`, `/s/<token>`)

Examples: XSS through rendered Markdown, share-token leaks or bypassing view-only links, unauthorized writes to a room, content script privilege issues.

Out of scope: vulnerabilities in third-party servers you self-host with your own configuration mistakes, and issues requiring a compromised browser or device.

## Response

This is a small, volunteer-run project. We will respond on a best-effort basis, aim to acknowledge reports within a reasonable time, and credit reporters who want it once a fix is released.
