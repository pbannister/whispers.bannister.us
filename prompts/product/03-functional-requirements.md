# Functional Requirements

The system shall support the following capabilities.

## Performance and Delivery
- The system shall serve static assets efficiently and minimize page size to improve load times.
- The system shall use browser caching where practical to reduce unnecessary downloads.

## File and Collection Management
- The system shall generate or recover a local encryption key in the browser.
- The system shall allow users to export and import their identity (public/private key pair and collection keys) to enable multi-device use.
- The system shall allow users to upload files that are encrypted before transmission.
- The system shall store encrypted files and metadata on the server.
- The system shall group files into collections that each have a unique identifier.
- The system shall provide a default collection for each user and allow users to create additional collections.
- The system shall allow users to view, select, and manage files within the current collection.
- The system shall allow users to delete their files.
- The system shall provide a 'Recently Deleted' feature where deleted files are held for a grace period before permanent deletion.
- The system shall allow users to set an expiration date for a file that triggers automatic deletion.

## Sharing and Access
- The system shall support a hierarchical key model where each file and collection has a unique encryption key, which is itself encrypted by a parent key.
- The system shall allow a user to generate a shareable link for an individual file. This link shall contain the file's unique, decrypted key in the URL fragment.
- The system shall allow a user to share an entire collection by providing the collection's decrypted key.
- Revoking access to a shared file or collection shall be accomplished by deleting the corresponding item on the server.

## Privacy and Security
- The system shall generate a public and private key pair in the browser on first visit and keep it local to the browser.
- The system shall keep encryption keys on the client and never send them to the server.
- The system shall send only encrypted data to the server.
- The system shall store only encrypted data and metadata on the server.
- The system shall never store plaintext file contents on the server.
- The system shall resist common attacks such as SQL injection and cross-site scripting.

## User Experience
- The system shall provide a user-friendly interface for uploading, listing, downloading, and deleting files.
- The system shall provide clear status messages and guidance for users.
- The system shall show file metadata such as size and upload date.
- The system shall allow users to search files and collections by name (stored in plaintext) or date.
