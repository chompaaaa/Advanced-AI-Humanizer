//! A deterministic prose rewriting engine.
//!
//! It transforms text toward a target reading level and away from the patterns
//! that mark machine writing. It does not compose new prose — every operation
//! is a bounded, checkable edit to an existing document, and the governing rule
//! is that an op skips rather than risks producing broken text.

pub mod doc;

pub use doc::{parse, render, Document};
