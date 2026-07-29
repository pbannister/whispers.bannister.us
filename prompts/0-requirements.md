---
date: 2026-07-28
target_llm: Gemini 1.5 Pro / Local Qwen2.5-Coder on MI25
topic: Website Requirements & System Architecture
---

# Website: whispers.bannister.us

## Preamble

I am creating a new website under `whispers.bannister.us`. 
I own the registration for `bannister.us` and use DreamHost as my web host. 
This makes using PHP the most effective choice for server-side code.

### Tooling & Workflow Requirements
1. **IDE:** Use VS Code to manage project development.
2. **Planning & Bootstrap:** Use Gemini to aid initial site requirements and architecture design.
3. **Interactive Coding:** Use a local LLM environment for real-time coding, refactoring, and inline completions.
4. **Prompt Version Control:** Save all prompts given to Gemini and local LLMs in the `prompts/` directory, committed under Git alongside source code.
5. **Static Engine:** Use Eleventy (11ty) with Nunjucks (`.njk`) templates to manage static components, building into a clean output directory for web deployment.

---

## Host & Infrastructure Requirements

1. **Domain:** `whispers.bannister.us` (under apex `bannister.us`).
2. **Hosting Provider:** DreamHost.
3. **Server Runtime:** PHP (running standard FastCGI on DreamHost).
4. **Build Output Strategy:** Eleventy generates static pages (`site.out/index.html`), dynamic PHP pages (`site.out/contact.php`), and passes standalone API endpoints (`site.out/api/*.php`) directly to the build folder.

---

## Local AI & Development System Architecture

1. **VS Code Extensions:**
   * `llama-vscode` for LLM completions, editing, and chat.
   * `ronnidc.nunjucks` for template syntax highlighting.
   * `mhutchie.git-graph` and `wadek.vscode-gitblame` for git tracking.

2. **LLM Hosting Infrastructure:**
   * **System Daemon:** `llama-server` configured in **Router Mode** running as a systemd service (`llama.service`) on port `2001`.
   * **Primary GPU Worker (`beast.lan`):** AMD Radeon Instinct MI25 GPU (16 GB VRAM) serving:
     * **Chat & Tools:** `Qwen/Qwen2.5-Coder-32B-Instruct-GGUF:Q4_K_M` offloaded to GPU VRAM[cite: 1, 4].
     * **Heavy CPU Reasoning:** `unsloth/gpt-oss-120b-GGUF:UD-Q4_K_XL` (Dual Xeon NUMA fallback for batch architecture and security audits)[cite: 4].
   * **Local Desktop (`athena.lan`):**
     * **Inline Completion (FIM):** `Qwen/Qwen2.5-Coder-3B-Instruct-GGUF:Q8_0` running locally via port `2001`[cite: 3].

3. **Project Directory Layout:**
   ```text
   whispers-bannister/
   ├── site.in/                  # Eleventy Source Directory
   │   ├── _includes/
   │   │   └── layouts/
   │   │       └── base.njk      # Primary Nunjucks layout
   │   ├── api/
   │   │   └── process-form.php  # Standalone PHP endpoints
   │   ├── assets/               # CSS, JS, Images
   │   ├── contact.njk           # Compiles to contact.php
   │   └── index.njk             # Homepage
   ├── site.out/                 # Build output uploaded to DreamHost
   ├── prompts/                  # Tracked Markdown prompts for AI interaction
   ├── scripts/                  # Build and deployment tools
   ├── eleventy.config.js        # 11ty passthrough and build configuration
   └── package.json

4. **Deployment Pipeline:**
    * Site compiled locally via npm run build (npx @11ty/eleventy).
    * Deployment to DreamHost via rsync over SSH (scripts/deploy.sh).
    