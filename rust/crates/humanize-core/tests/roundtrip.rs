//! `render(parse(x)) == x` for arbitrary input.
//!
//! This is the most load-bearing test in the crate. Every transformation
//! mutates the tree and then renders it; if the round trip is lossy, every op
//! silently corrupts documents in a way that is very hard to trace back.

use humanize_core::{parse, render};
use proptest::prelude::*;

fn assert_roundtrip(input: &str) {
    let out = render(&parse(input));
    assert_eq!(out, input, "round trip changed the text");
}

#[test]
fn empty_and_whitespace() {
    for s in ["", " ", "\n", "\n\n\n", "   \t  \n  "] {
        assert_roundtrip(s);
    }
}

#[test]
fn plain_prose() {
    assert_roundtrip("The cat sat. The dog ran! Did it? Yes.");
    assert_roundtrip("One sentence with no terminator");
    assert_roundtrip("Trailing space. ");
}

#[test]
fn abbreviations_and_initials_do_not_split() {
    let text = "Dr. Smith met Mr. Jones at 4 p.m. They talked.";
    assert_roundtrip(text);
    let doc = parse(text);
    assert_eq!(doc.sentences().count(), 2, "abbreviations must not end a sentence");

    let text = "J. R. R. Tolkien wrote it. He was a professor.";
    assert_roundtrip(text);
    assert_eq!(parse(text).sentences().count(), 2, "initials must not end a sentence");
}

#[test]
fn decimals_stay_whole() {
    let text = "Revenue grew 3.5 percent. That is real.";
    assert_roundtrip(text);
    assert_eq!(parse(text).sentences().count(), 2);
}

#[test]
fn markdown_structure_survives() {
    let text = "# Heading\n\nSome prose here.\n\n- first item\n- second item\n\n> a quotation\n";
    assert_roundtrip(text);

    let doc = parse(text);
    let kinds: Vec<_> = doc.blocks.iter().map(|b| b.kind.clone()).collect();
    assert!(kinds.contains(&humanize_core::doc::BlockKind::Heading(1)));
    assert!(kinds.contains(&humanize_core::doc::BlockKind::ListItem));
    assert!(kinds.contains(&humanize_core::doc::BlockKind::Quote));
}

#[test]
fn code_fences_are_opaque() {
    let text = "Run this:\n\n```js\nconst x = 1.5; // a sentence. or two!\n```\n\nThen done.\n";
    assert_roundtrip(text);

    let doc = parse(text);
    let fence = doc
        .blocks
        .iter()
        .find(|b| b.kind == humanize_core::doc::BlockKind::CodeFence)
        .expect("fence block");
    assert!(!fence.is_editable(), "code fences must never be editable");
}

#[test]
fn inline_code_is_not_editable() {
    let text = "Call `foo.bar()` first.";
    assert_roundtrip(text);
    let doc = parse(text);
    let has_code = doc
        .sentences()
        .flat_map(|s| s.tokens.iter())
        .any(|t| t.kind == humanize_core::doc::TokenKind::Code && !t.is_editable());
    assert!(has_code, "inline code should be a non-editable token");
}

#[test]
fn quoted_spans_are_flagged() {
    let doc = parse(r#"She said "keep this exact" and left."#);
    let quoted: Vec<_> = doc
        .sentences()
        .flat_map(|s| s.tokens.iter())
        .filter(|t| t.flags.contains(humanize_core::doc::TokenFlags::IN_QUOTE) && t.is_word())
        .map(|t| t.text.clone())
        .collect();
    assert_eq!(quoted, vec!["keep", "this", "exact"]);
}

#[test]
fn unicode_and_emoji() {
    for s in [
        "Café naïve résumé. Zoë Brontë.",
        "Это тест. Ещё один.",
        "これはテストです。",
        "That went well 🎉 and then it didn't 😬.",
    ] {
        assert_roundtrip(s);
    }
}

#[test]
fn windows_line_endings() {
    assert_roundtrip("First line.\r\n\r\nSecond block.\r\n");
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(400))]

    /// Arbitrary printable text, including the structural characters.
    #[test]
    fn arbitrary_text_roundtrips(s in r"[\PC\n\t ]{0,400}") {
        prop_assert_eq!(render(&parse(&s)), s);
    }

    /// Text built from the tokens most likely to break the parser.
    #[test]
    fn adversarial_roundtrips(
        parts in prop::collection::vec(
            prop_oneof![
                Just("word".to_string()),
                Just(". ".to_string()),
                Just("\n\n".to_string()),
                Just("Dr. ".to_string()),
                Just("3.14".to_string()),
                Just("`code`".to_string()),
                Just("\"quoted\"".to_string()),
                Just("# ".to_string()),
                Just("- ".to_string()),
                Just("> ".to_string()),
                Just("...".to_string()),
                Just("A. ".to_string()),
                Just("  ".to_string()),
            ],
            0..40,
        )
    ) {
        let s: String = parts.concat();
        prop_assert_eq!(render(&parse(&s)), s);
    }
}
