# Sharing Architecture

This document describes the architecture for sharing files and collections in Whispers, based on a hierarchical, "envelope encryption" model. This design allows for granular sharing without ever exposing the user's master key or unintended files to a recipient.

## Key Hierarchy

The security of the sharing model relies on three layers of keys. The server only ever stores encrypted keys and encrypted file content. Decryption always happens on the client.

```mermaid
graph TD
    subgraph "User's Browser"
        MasterKey["Master Key<br/>(Stored only in browser's localStorage"]
    end

    subgraph "Server Storage"
        CollectionMeta["collection.meta.json<br/>(Contains Encrypted Collection Key)"]
        FileMeta["file.meta.json<br/>(Contains Encrypted File Key)"]
        FileContent["Encrypted File Blob (.bin)"]
    end

    MasterKey -- "Decrypts" --> CollectionMeta
    CollectionMeta -- "Provides decrypted Collection Key to decrypt" --> FileMeta
    FileMeta -- "Provides decrypted File Key to decrypt" --> FileContent

    style MasterKey fill:#f9f,stroke:#333,stroke-width:2px
```

1.  **Master Key**: The root of trust. It is generated in the user's browser and never leaves. It encrypts/decrypts Collection Keys.
2.  **Collection Key**: A unique key for each collection. It is encrypted by the Master Key and stored on the server. It encrypts/decrypts File Keys within that collection.
3.  **File Key**: A unique key for each file. It is encrypted by the parent Collection Key and stored on the server. It directly encrypts/decrypts the file's content.

---

## Sharing an Individual File

Sharing a single file is accomplished by generating a special link that contains the file's unique, decrypted key in the URL fragment. The key never passes through the server.

```mermaid
sequenceDiagram
    actor Owner
    participant OB as Owner's Browser
    participant Server
    actor Recipient
    participant RB as Recipient's Browser

    Owner->>OB: 1. Clicks "Share File"
    OB->>OB: 2. Decrypts Collection Key (using Master Key)
    OB->>OB: 3. Decrypts File Key (using Collection Key)
    OB->>Owner: 4. Generates share link:<br/>/view#file-uuid&key=DECRYPTED_FILE_KEY

    Owner->>Recipient: 5. Sends link (via email, chat, etc.)

    Recipient->>RB: 6. Opens share link
    RB->>RB: 7. Extracts File UUID and File Key from URL fragment
    RB->>Server: 8. Request encrypted file content for File UUID
    Server-->>RB: 9. Returns encrypted file blob
    RB->>RB: 10. Decrypts file blob using File Key from URL
    RB->>Recipient: 11. Prompts to save decrypted file
```

**Revoking Access**: The owner revokes access simply by deleting the file. Any subsequent attempt to use the share link will result in a "File not found" error from the server.

---

## Sharing an Entire Collection

Sharing a whole collection is done by securely transferring the collection's decrypted key to another user, who can then import it into their own Whispers instance.

```mermaid
sequenceDiagram
    actor Owner
    participant OB as Owner's Browser
    actor Recipient
    participant RB as Recipient's Browser

    Owner->>OB: 1. Clicks "Share Collection"
    OB->>OB: 2. Decrypts Collection Key (using Master Key)
    OB->>Owner: 3. Displays decrypted Collection Key for copying

    Owner->>Recipient: 4. Sends key (via secure channel)

    Recipient->>RB: 5. Pastes key into "Import Collection" UI
    RB->>RB: 6. Creates a new local collection using the imported key
    RB->>Recipient: 7. Confirms collection is now accessible

    Note over Recipient, RB: The recipient can now list, download, and<br/>decrypt all files in the shared collection,<br/>as their browser now holds the necessary Collection Key.
```

**Revoking Access**: The owner revokes access by deleting the entire collection on the server.

---