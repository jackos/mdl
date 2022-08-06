# Changelog
## v0.4.2
### Misc
Update readme to show how to set default editor

## v0.4.1
### Bug Fix
Change to `gopls imports` as this tool is installed by default with VS Code

## v0.4.0
### Features
- Add ability to use a [package] and set up your own `cargo.toml`
- Add `tokio::main` support
- Add shell languages

## v0.3.0
### Features
- Make end statement a dbg! instead of print to print a much larger array of types. 
- Added macro dbg_pretty! and dbg_named! to retain variable name when doing something in a loop.
- Added the ability to use `#` if last line is an expression to pretty print debug

## v0.2.1
### Bug Fix
- Make dbg! not print line numbers and file name

## v0.2.0
### Features
- Add auto formatting to Rust code when opening the source file
- Add print statements for final variables in Rust
- Add ability to put `#[restart]` and `#[ignore]` tags in blocks of Rust code

### Bug Fix
- Make `dbg!` macro print to `stdout` for Rust code, stop it sometimes going to a different cell when nodejs gets stdout and stderr out of sync

## v0.1.7
### Bug Fix
- Kill related proccess when the stop button is pressed

## v0.1.6
### Performance
- Use esbuild-runner instead of ts-node for typescript, give warning text if not installed

## v0.1.5
### Bug Fix
- Bug with Rust outputs sometimes containing unwanted text

## v0.1.4
### Bug Fix
- Support Rust main functions with different signatures
- Fix rust imports using `_` seperators

## v0.1.3
### Bug Fix
- Fixed `dbg` outputs from Rust and other `stderr` text not being displayed on final output

## v0.1.2
### Bug Fix
- Sometimes using the mimetypes e.g. "text/x-rust" will fail, also doesn't look right with errors, removed for now, will need custom renderers

## v0.1.1
### Bug Fix
- Simplified all the stdout and stderr operations, fixed outputs not displaying in rust

## v0.1.0
### Features
- Add `nushell` support

### Bug Fix
- Fix stderr sometimes being cleared when there is some empty data sitting in stdout

## v0.0.1
### Features
Working notebook with Rust, Go, Javascript and Typescript
