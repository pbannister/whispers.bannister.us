# Tests Performed Before Deploy

The following checks should be completed before publishing the site.

- Build the site successfully with the Eleventy build command.
- Validate that the PHP storage endpoint has no syntax errors.
- Confirm that the homepage renders the collection controls, key management panel, and upload controls.
- Confirm that the About page renders and the navigation links work.
- Verify that the browser-side encryption flow is available and that the decryption key is stored locally in browser storage.
- Confirm that uploaded files are encrypted before transmission and that plaintext contents are not sent to the server.
- Verify that the site can create a new collection and switch between collections without breaking the file list.
- Check that the upload form supports an optional expiration date and that expired files are removed from the list.
