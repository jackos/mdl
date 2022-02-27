
# Changelog
## v0.1.5
### Fixes
- Bug with Rust outputs sometimes containing unwanted text

## v0.1.4
### Fixes
- Support Rust main functions with different signatures
- Fix rust imports using `_` seperators

## v0.1.3
### Fixes
- Fixed `dbg` outputs from Rust and other `stderr` text not being displayed on final output

## v0.1.2
### Fixes
- Sometimes using the mimetypes e.g. "text/x-rust" will fail, also doesn't look right with errors, removed for now, will need custom renderers

## v0.1.1
### Fixes
- Simplified all the stdout and stderr operations, fixed outputs not displaying in rust

## v0.1.0
### Features
- Add `nushell` support
### Fixes
- Fix stderr sometimes being cleared when there is some empty data sitting in stdout

## v0.0.1
Initial commit


