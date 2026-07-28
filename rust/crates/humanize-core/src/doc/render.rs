//! `Document` -> text.
//!
//! The exact inverse of `parse`. Every byte the parser saw is stored somewhere
//! in the tree — block prefixes, sentence terminators, trailing whitespace —
//! so reassembly is a concatenation with no reconstruction guesswork.

use super::model::Document;

pub fn render(doc: &Document) -> String {
    let mut out = String::new();

    for block in &doc.blocks {
        out.push_str(&block.prefix);
        for sentence in &block.sentences {
            for token in &sentence.tokens {
                out.push_str(&token.text);
            }
            out.push_str(&sentence.trailing_ws);
        }
        out.push_str(&block.trailing);
    }

    out
}
