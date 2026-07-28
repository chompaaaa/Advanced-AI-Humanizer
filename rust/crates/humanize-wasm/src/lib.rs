//! Thin `wasm-bindgen` surface over `humanize-core`.
//!
//! Deliberately minimal: JSON in, JSON out, no state. Every decision lives in
//! the core crate so it stays testable with plain `cargo test`.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Round-trips text through the document model. Proves the boundary works
/// before any transformation is wired up.
#[wasm_bindgen]
pub fn roundtrip(text: &str) -> String {
    humanize_core::render(&humanize_core::parse(text))
}
