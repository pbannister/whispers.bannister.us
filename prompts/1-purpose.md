# Product Specification: Whispers

## 1. Overview

Whispers is a privacy-preserving file storage website that allows users to upload files without exposing plaintext content to the server. The system is designed around client-side encryption: files are encrypted in the browser before being transmitted, stored in encrypted form on the server, and decrypted locally by the browser when retrieved.

## 2. Product Goal

Provide a simple, anonymous, browser-based file storage experience that gives users confidence that their files remain private from the server while still being accessible through a web interface.

## 3. Scope

### In Scope

- Anonymous use without account creation
- Browser-based file encryption before upload
- Server-side storage of encrypted files and lightweight metadata
- Listing of previously uploaded files for the current browser user
- Local decryption of downloaded files in the browser
- Basic contact and informational pages

### Out of Scope

- End-to-end user accounts and authentication
- Multi-user access control beyond browser-local identity
- Advanced sharing, collaboration, or public file links
- Server-side plaintext inspection or recovery of uploaded files
- Enterprise-grade compliance controls beyond the basic privacy model

## 4. User Stories

- As a first-time visitor, I want to upload a file without creating an account.
- As a returning visitor, I want my browser to remember my local identity so I can access my stored files.
- As a user, I want my file contents to remain encrypted before and during upload.
- As a user, I want to retrieve and decrypt my files locally in the browser.
- As a visitor, I want clear instructions and status messages so I understand what is happening.

## 5. Functional Requirements

The system shall:

1. Generate or recover a local encryption key in the browser on first use.
2. Allow the user to select a local file and encrypt it in the browser before transmission.
3. Transmit only encrypted data to the server.
4. Generate a unique identifier for each uploaded file.
5. Store encrypted file data and non-sensitive metadata on the server.
6. Present a list of files associated with the current browser user.
7. Retrieve the encrypted file content from the server and decrypt it locally in the browser.
8. Provide a simple, understandable user interface with clear feedback during upload, retrieval, and error states.

## 6. Technical Requirements

- The site shall be implemented using Eleventy with Nunjucks templates.
- PHP shall be used for server-side storage endpoints and contact form handling on DreamHost.
- Client-side encryption shall use a modern browser cryptography API.
- Browser storage shall be used for the encryption key and lightweight client identity information.
- Uploaded encrypted data shall be stored in a local persistence directory on the server.

## 7. Security and Privacy Requirements

- Plaintext file contents shall never be transmitted to the server.
- The server shall not receive or store decryption keys.
- The implementation shall minimize metadata exposure and avoid unnecessary sensitive data storage.
- The system shall clearly communicate that privacy depends on the browser retaining the encryption key locally.

## 8. Non-Functional Requirements

- The experience shall be simple, fast, and intuitive for modern desktop browsers.
- The implementation shall be maintainable and easy to extend.
- The project shall remain compatible with the existing Eleventy and DreamHost deployment workflow.
- The interface shall provide clear visual feedback for loading, success, and failure states.

## 9. Assumptions and Constraints

- The system is intended for personal or experimental use rather than production-grade multi-user collaboration.
- The browser must retain the encryption key for later access; loss of that key will make encrypted files unrecoverable.
- Server-side storage is limited to the hosting environment and file system available on DreamHost.

## 10. Acceptance Criteria

The product is considered complete when:

- A user can upload a file and receive confirmation that it was stored.
- A user can view their uploaded files in the interface.
- A user can download and decrypt a stored file locally in the browser.
- The plaintext contents are never sent to the server.
- The site builds successfully with the existing Eleventy workflow.
