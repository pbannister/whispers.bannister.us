# Purpose

This website provides anonymous encrypted file storage where encryption and decryption happen entirely in the browser.

- Generate an encryption key on first visit and keep it in the browser (cookie or better local storage).
- The browser reads a selected local file, encrypts it, and sends only the encrypted data to the server.
- The server generates a UUID to identify the file and returns that UUID to the browser.
- Files for the same user are stored in one directory on the server, with the UUID as the filename.
- The root page shows instructions and lists UUIDs for files stored by that user.
- When a UUID is selected, the server returns the encrypted file and the browser decrypts it locally.
