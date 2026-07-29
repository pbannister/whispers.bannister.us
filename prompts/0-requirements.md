---
date: 2026-07-28
target_llm: Gemini 1.5 Pro / Local Qwen2.5-Coder on MI25
topic: Website Requirements & System Architecture
---

# Requirements Specification: whispers.bannister.us

## 1. Overview

This document defines the functional and technical requirements for the website hosted at whispers.bannister.us. The site is intended to be a privacy-focused, browser-based encrypted file storage experience deployed on DreamHost using PHP and Eleventy.

## 2. Project Objective

Create a simple, maintainable website that allows users to upload files, store them securely in encrypted form, and retrieve them later without exposing plaintext file contents to the server.

## 3. Scope

### In Scope

- A public website with an informational landing page
- A file upload and storage workflow that uses browser-side encryption
- A retrieval workflow that decrypts files locally in the browser
- A contact page with server-side PHP handling
- Static site generation and deployment through Eleventy

### Out of Scope

- User authentication and account management
- Advanced sharing, collaboration, or public file links
- Enterprise-grade compliance or audit controls
- Server-side plaintext recovery or decryption

## 4. Platform and Hosting Requirements

1. **Domain:** whispers.bannister.us under the bannister.us apex.
2. **Hosting Provider:** DreamHost.
3. **Server Runtime:** PHP via standard FastCGI on DreamHost.
4. **Build Output Strategy:** Eleventy shall generate static pages such as site.out/index.html and site.out/contact.php, while standalone PHP endpoints remain in site.out/api/.

## 5. Application Requirements

### 5.1 Content and UX

- The site shall provide a clear explanation of the privacy model.
- The homepage shall present the file storage workflow in an understandable way.
- The contact page shall provide a complete form experience with feedback after submission.
- The interface shall be simple, modern, and easy to use on desktop browsers.

### 5.2 File Storage Workflow

- The browser shall generate or recover a local encryption key.
- The user shall be able to select a local file and encrypt it in the browser before upload.
- Only encrypted data shall be sent to the server.
- The server shall store encrypted files and metadata under a per-user directory.
- The interface shall allow the user to list stored files and retrieve them for local decryption.

## 6. Technical Architecture

### 6.1 Frontend

- Eleventy shall be used as the static site generator.
- Nunjucks templates shall be used for layout and page composition.
- CSS and JavaScript assets shall be stored under site.in/assets/.

### 6.2 Backend

- PHP shall be used for server-side endpoints and contact form processing.
- PHP endpoints shall be deployed as standalone files under site.out/api/.
- The server shall persist encrypted payloads in a local storage directory.

### 6.3 Development Workflow

- VS Code shall be the primary development environment.
- The project shall use Git for version control.
- Prompt files and design notes shall be stored in the prompts/ directory.

## 7. Local AI and Development Tooling

### 7.1 Editor Extensions

- llama-vscode for editing and chat assistance
- ronnidc.nunjucks for Nunjucks syntax support
- mhutchie.git-graph and wadek.vscode-gitblame for version history and blame view

### 7.2 Local LLM Infrastructure

- llama-server shall run in Router Mode as a systemd service on port 2001.
- The primary GPU worker on beast.lan shall serve the main chat and coding model.
- The local desktop on athena.lan shall serve inline completion capabilities.

## 8. Project Structure

```text
whispers-bannister/
├── site.in/                  # Eleventy source directory
│   ├── _includes/
│   │   └── layouts/
│   │       └── base.njk      # Primary Nunjucks layout
│   ├── api/                  # Standalone PHP endpoints
│   ├── assets/               # CSS, JavaScript, and images
│   ├── contact.njk           # Compiles to contact.php
│   └── index.njk             # Homepage
├── site.out/                 # Build output uploaded to DreamHost
├── prompts/                  # Tracked markdown prompts and requirements
├── scripts/                  # Build and deployment tooling
├── eleventy.config.js        # Eleventy passthrough and build configuration
└── package.json
```

## 9. Deployment Requirements

- The site shall be built locally with npm run build.
- Deployment to DreamHost shall occur via rsync over SSH.
- The deployment process shall copy the generated contents of site.out/ to the remote host.

## 10. Milestones

### Milestone 1: Foundation
- Establish the Eleventy project structure and base templates.
- Create the homepage, contact page, and shared layout.
- Confirm the local build and deployment pipeline work end to end.

### Milestone 2: Core Encryption Workflow
- Implement browser-side key generation and storage.
- Add file encryption before upload and local decryption after download.
- Validate that only encrypted payloads are transmitted to the server.

### Milestone 3: Server Persistence
- Implement PHP endpoints for upload, list, and download operations.
- Store encrypted files and metadata in the server filesystem.
- Verify correct association of files with the current browser user context.

### Milestone 4: UX and Polish
- Improve messaging, validation, and status feedback.
- Refine the visual design and content clarity.
- Confirm the workflow is understandable for first-time visitors.

### Milestone 5: Deployment Readiness
- Validate the final build output.
- Deploy to DreamHost and confirm the live site functions correctly.
- Document any operational caveats, especially around PHP mail delivery and browser-key management.

## 11. Implementation Plan

### Phase 1: Setup and Baseline
1. Create and verify the Eleventy project skeleton.
2. Implement the shared layout and core pages.
3. Confirm the build output structure expected by DreamHost.

### Phase 2: Encryption and Client-Side Logic
1. Implement local key generation and persistence.
2. Add browser-side file encryption and decryption logic.
3. Build the upload/download UI flow and error handling.

### Phase 3: Backend Integration
1. Implement PHP storage endpoints for upload, listing, and retrieval.
2. Persist encrypted files and metadata in the server file system.
3. Verify that the browser and server exchange the expected data format.

### Phase 4: Testing and Deployment
1. Test upload, list, and download flows locally.
2. Validate the contact page and PHP mail handling.
3. Build and deploy the site to DreamHost.
4. Review the live environment for correctness and operational issues.

## 12. Acceptance Criteria

The project will be considered complete when:

- The site builds successfully with Eleventy.
- The homepage and contact page render correctly.
- The upload and retrieval workflow operates using browser-side encryption.
- The contact form submits successfully through the PHP handler.
- The site can be deployed to DreamHost using the documented workflow.
- The implemented milestones above have been completed and validated.
    