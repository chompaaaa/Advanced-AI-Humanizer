//! The document model.
//!
//! Every transformation mutates this tree; nothing operates on a raw `String`.
//! That is a deliberate constraint. Regex-over-string editing is how the
//! sentinel round-trip bug in the old TypeScript `postprocess` happened — a
//! control character in the input came back out as a stray period — and, more
//! importantly, it makes "never touch this phrase" impossible to enforce,
//! because a regex has no idea what it is standing on.
//!
//! With a token tree, protection is a flag on a token and every op is required
//! to check it. The guarantee becomes structural rather than aspirational.

use std::ops::Range;

/// What a token is, which decides whether an op may touch it at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenKind {
    Word,
    Number,
    Punct,
    Space,
    /// Inline code or a fenced block. Never edited, never parsed for sentences.
    Code,
    Url,
}

/// Per-token facts that ops consult before editing.
///
/// Hand-rolled rather than pulling in `bitflags`: four flags and three
/// operations don't justify a dependency in a bundle that ships to browsers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TokenFlags(u16);

impl TokenFlags {
    /// Inside a user-supplied protected phrase. Hard stop for every op.
    pub const PROTECTED: Self = Self(1 << 0);
    /// Inside quotation marks — someone else's words.
    pub const IN_QUOTE: Self = Self(1 << 1);
    /// Capitalised mid-sentence, so probably a name.
    pub const PROPER_NOUN: Self = Self(1 << 2);
    /// First word of its sentence; matters for capitalisation on edit.
    pub const SENTENCE_INITIAL: Self = Self(1 << 3);

    pub const fn empty() -> Self {
        Self(0)
    }

    pub const fn contains(self, other: Self) -> bool {
        (self.0 & other.0) == other.0
    }

    pub fn insert(&mut self, other: Self) {
        self.0 |= other.0;
    }

    pub fn remove(&mut self, other: Self) {
        self.0 &= !other.0;
    }
}

/// A single token, carrying its source range so edits can be reported.
#[derive(Debug, Clone)]
pub struct Token {
    pub text: String,
    pub kind: TokenKind,
    pub flags: TokenFlags,
    pub src: Range<usize>,
}

impl Token {
    pub fn new(text: impl Into<String>, kind: TokenKind, src: Range<usize>) -> Self {
        Self { text: text.into(), kind, flags: TokenFlags::empty(), src }
    }

    /// The single gate every op must pass through before mutating a token.
    pub fn is_editable(&self) -> bool {
        !self.flags.contains(TokenFlags::PROTECTED)
            && self.kind != TokenKind::Code
            && self.kind != TokenKind::Url
    }

    pub fn is_word(&self) -> bool {
        self.kind == TokenKind::Word
    }
}

#[derive(Debug, Clone)]
pub struct Sentence {
    /// Every token in the sentence, *including* its terminal punctuation and
    /// any closing quote or bracket that follows it.
    pub tokens: Vec<Token>,
    /// `.`, `!` or `?` — metadata only, derived from `tokens`. Rendering never
    /// appends it. Holding it as a separate thing to re-emit is what made
    /// `?'` render as `'?`: the closing quote sorts before a terminator that
    /// is bolted on at the end.
    pub terminator: Option<char>,
    /// Exact whitespace that followed the sentence.
    pub trailing_ws: String,
}

impl Sentence {
    pub fn word_count(&self) -> usize {
        self.tokens.iter().filter(|t| t.is_word()).count()
    }

    /// True when no token in the sentence may be edited.
    pub fn is_frozen(&self) -> bool {
        self.tokens.iter().all(|t| !t.is_editable())
    }

    pub fn text(&self) -> String {
        self.tokens.iter().map(|t| t.text.as_str()).collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BlockKind {
    Paragraph,
    Heading(u8),
    ListItem,
    Quote,
    /// A fenced code block. Content is opaque and never touched.
    CodeFence,
}

#[derive(Debug, Clone)]
pub struct Block {
    pub kind: BlockKind,
    /// Markdown furniture (`## `, `- `, `> `) kept verbatim so formatting survives.
    pub prefix: String,
    pub sentences: Vec<Sentence>,
    /// Exact whitespace between this block and the next.
    pub trailing: String,
}

impl Block {
    pub fn word_count(&self) -> usize {
        self.sentences.iter().map(Sentence::word_count).sum()
    }

    pub fn is_editable(&self) -> bool {
        self.kind != BlockKind::CodeFence
    }
}

#[derive(Debug, Clone)]
pub struct Document {
    pub blocks: Vec<Block>,
}

impl Document {
    pub fn word_count(&self) -> usize {
        self.blocks.iter().map(Block::word_count).sum()
    }

    pub fn sentences(&self) -> impl Iterator<Item = &Sentence> {
        self.blocks.iter().flat_map(|b| b.sentences.iter())
    }

    pub fn sentences_mut(&mut self) -> impl Iterator<Item = &mut Sentence> {
        self.blocks.iter_mut().flat_map(|b| b.sentences.iter_mut())
    }
}
