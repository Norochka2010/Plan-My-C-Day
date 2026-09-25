# Temporary beta signup policies
- Bundled the existing September 19 terms/privacy markdown without changing their content.
- Signup opens each document in a safe-area modal; closing preserves form input and does not check agreement automatically.
- Both acknowledgments remain required. Metadata identifies bundled beta versions instead of claiming published URLs.
- Before public release: finalize and publish both documents, set EXPO_PUBLIC_TERMS_URL and EXPO_PUBLIC_PRIVACY_URL to HTTPS addresses, and rebuild. Both links must be configured to switch from bundled drafts.
- Existing account metadata is not an immutable legal acceptance audit trail. Final document versioning and renewed acknowledgment remain release work.
- To undo: restore the previous missing-link signup gate and remove beta-policies.ts and the document modal.
