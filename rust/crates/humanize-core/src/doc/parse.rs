//! Text -> `Document`.
//!
//! The contract this module owes the rest of the crate is
//! `render(parse(x)) == x` for arbitrary input. Everything downstream assumes
//! it can mutate the tree and get valid text back; if the round trip is lossy,
//! every op silently corrupts documents. It is property-tested in `tests/`.

use super::model::{Block, BlockKind, Document, Sentence, Token, TokenFlags, TokenKind};

/// Titles, which are always followed by a name and so never end a sentence.
const TITLES: &[&str] = &[
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "mt", "rev", "hon", "gen", "col", "capt",
    "lt", "sgt",
];

/// Abbreviations that can legitimately fall at the end of a sentence.
/// "…at 4 p.m. They left." is two sentences; "Dr. Smith" is never two.
const GENERAL_ABBREVIATIONS: &[&str] = &[
    "vs", "etc", "inc", "ltd", "co", "corp", "dept", "est", "fig", "vol", "no", "pp", "ed", "eds",
    "al", "approx", "cf", "ca",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Abbrev {
    /// Never terminal.
    Title,
    /// Terminal only when the next word starts a new sentence.
    General,
}

fn classify_abbreviation(word: &str) -> Option<Abbrev> {
    let lower = word.to_ascii_lowercase();
    if TITLES.contains(&lower.as_str()) {
        return Some(Abbrev::Title);
    }
    if GENERAL_ABBREVIATIONS.contains(&lower.as_str()) {
        return Some(Abbrev::General);
    }
    None
}

/// Splits raw text into blocks on blank lines and markdown structure.
fn split_blocks(text: &str) -> Vec<(BlockKind, String, String, String)> {
    let mut blocks = Vec::new();
    let mut lines = text.split_inclusive('\n').peekable();
    let mut in_fence = false;
    let mut fence_buf = String::new();

    while let Some(line) = lines.next() {
        let trimmed = line.trim_start();

        if trimmed.starts_with("```") {
            fence_buf.push_str(line);
            if in_fence {
                blocks.push((BlockKind::CodeFence, String::new(), fence_buf.clone(), String::new()));
                fence_buf.clear();
                in_fence = false;
            } else {
                in_fence = true;
            }
            continue;
        }
        if in_fence {
            fence_buf.push_str(line);
            continue;
        }

        if line.trim().is_empty() {
            if let Some(last) = blocks.last_mut() {
                last.3.push_str(line);
            } else {
                blocks.push((BlockKind::Paragraph, String::new(), String::new(), line.to_string()));
            }
            continue;
        }

        let (kind, prefix) = classify(trimmed);
        let indent_len = line.len() - trimmed.len();
        let full_prefix = format!("{}{}", &line[..indent_len], prefix);
        let body = trimmed[prefix.len()..].to_string();

        blocks.push((kind, full_prefix, body, String::new()));
    }

    if in_fence && !fence_buf.is_empty() {
        blocks.push((BlockKind::CodeFence, String::new(), fence_buf, String::new()));
    }

    blocks
}

fn classify(trimmed: &str) -> (BlockKind, String) {
    if let Some(rest) = trimmed.strip_prefix('>') {
        let ws: String = rest.chars().take_while(|c| *c == ' ').collect();
        return (BlockKind::Quote, format!(">{ws}"));
    }

    let hashes = trimmed.chars().take_while(|c| *c == '#').count();
    if (1..=6).contains(&hashes) && trimmed[hashes..].starts_with(' ') {
        let ws: String = trimmed[hashes..].chars().take_while(|c| *c == ' ').collect();
        return (BlockKind::Heading(hashes as u8), format!("{}{}", "#".repeat(hashes), ws));
    }

    for marker in ["- ", "* ", "+ "] {
        if trimmed.starts_with(marker) {
            return (BlockKind::ListItem, marker.to_string());
        }
    }

    // Ordered list: digits followed by . or ) and a space.
    let digits = trimmed.chars().take_while(char::is_ascii_digit).count();
    if digits > 0 {
        let rest = &trimmed[digits..];
        if (rest.starts_with(". ") || rest.starts_with(") ")) && digits <= 3 {
            return (BlockKind::ListItem, trimmed[..digits + 2].to_string());
        }
    }

    (BlockKind::Paragraph, String::new())
}

/// Tokenizes one block body, preserving every byte including whitespace.
fn tokenize(body: &str, base: usize) -> Vec<Token> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = body.chars().collect();
    let mut i = 0;
    let mut byte = base;
    let mut in_quote = false;

    while i < chars.len() {
        let start_byte = byte;
        let c = chars[i];

        if c == '"' {
            in_quote = !in_quote;
        }

        let (text, kind) = if c.is_whitespace() {
            let s: String = chars[i..].iter().take_while(|c| c.is_whitespace()).collect();
            (s, TokenKind::Space)
        } else if c == '`' {
            // Inline code runs to the closing backtick, or to end of block.
            let mut s = String::from('`');
            let mut j = i + 1;
            while j < chars.len() {
                s.push(chars[j]);
                if chars[j] == '`' {
                    break;
                }
                j += 1;
            }
            (s, TokenKind::Code)
        } else if c.is_alphabetic() {
            let s: String = chars[i..]
                .iter()
                .take_while(|c| c.is_alphanumeric() || **c == '\'' || **c == '\u{2019}' || **c == '-')
                .collect();
            // Trim a trailing hyphen/apostrophe so it renders as punctuation.
            let s = s.trim_end_matches(['-', '\'', '\u{2019}']).to_string();
            let s = if s.is_empty() { chars[i].to_string() } else { s };
            let kind = if s.starts_with("http") { TokenKind::Url } else { TokenKind::Word };
            (s, kind)
        } else if c.is_ascii_digit() {
            let s: String = chars[i..]
                .iter()
                .take_while(|c| c.is_ascii_digit() || **c == '.' || **c == ',' || **c == '%')
                .collect();
            let s = s.trim_end_matches(['.', ',']).to_string();
            let s = if s.is_empty() { chars[i].to_string() } else { s };
            (s, TokenKind::Number)
        } else {
            (c.to_string(), TokenKind::Punct)
        };

        let len = text.chars().count();
        byte += text.len();
        i += len;

        let mut token = Token::new(text, kind, start_byte..byte);
        if in_quote && token.kind != TokenKind::Space {
            token.flags.insert(TokenFlags::IN_QUOTE);
        }
        tokens.push(token);
    }

    tokens
}

/// Groups tokens into sentences on terminal punctuation.
fn into_sentences(tokens: Vec<Token>) -> Vec<Sentence> {
    let mut sentences = Vec::new();
    let mut current: Vec<Token> = Vec::new();

    let mut idx = 0;
    while idx < tokens.len() {
        let token = tokens[idx].clone();
        let is_terminal = token.kind == TokenKind::Punct
            && matches!(token.text.as_str(), "." | "!" | "?")
            && (token.text != "." || is_sentence_end(&current, &tokens[idx + 1..]));

        if !is_terminal {
            current.push(token);
            idx += 1;
            continue;
        }

        // The terminator is part of the sentence, then any closing quote or
        // bracket that belongs with it.
        let terminator = token.text.chars().next().unwrap();
        current.push(token);
        idx += 1;
        while idx < tokens.len()
            && tokens[idx].kind == TokenKind::Punct
            && matches!(tokens[idx].text.as_str(), "\"" | "'" | ")" | "]")
        {
            current.push(tokens[idx].clone());
            idx += 1;
        }

        let mut trailing = String::new();
        while idx < tokens.len() && tokens[idx].kind == TokenKind::Space {
            trailing.push_str(&tokens[idx].text);
            idx += 1;
        }

        sentences.push(Sentence { tokens: std::mem::take(&mut current), terminator: Some(terminator), trailing_ws: trailing });
    }

    if !current.is_empty() {
        sentences.push(Sentence { tokens: current, terminator: None, trailing_ws: String::new() });
    }

    sentences
}

/// Decides whether a period following `current` really ends a sentence.
///
/// `rest` is everything after the period, used to check whether a new sentence
/// actually starts — the only usable signal for abbreviations that can fall at
/// the end of one.
fn is_sentence_end(current: &[Token], rest: &[Token]) -> bool {
    let Some(last) = current.iter().rev().find(|t| t.kind != TokenKind::Space) else {
        return true;
    };

    if last.kind != TokenKind::Word {
        return true;
    }

    // Single letters are either initials ("J. R. R. Tolkien") or pieces of a
    // dotted abbreviation the tokenizer split apart ("p" "." "m" ".").
    if last.text.chars().count() == 1 {
        // Mid-abbreviation: another single letter and a period follow directly.
        if continues_dotted_abbreviation(rest) {
            return false;
        }
        // An initial before a name. Treating these as terminal would split
        // every name apart, which is much worse than the rare missed break.
        if last.text.chars().all(char::is_uppercase) {
            return false;
        }
        // End of a dotted abbreviation: terminal only if a new sentence starts.
        return starts_new_sentence(rest);
    }

    match classify_abbreviation(&last.text) {
        Some(Abbrev::Title) => false,
        Some(Abbrev::General) => starts_new_sentence(rest),
        None => true,
    }
}

/// True when a period is immediately followed by `X.` — i.e. we are partway
/// through something like `p.m.` or `U.S.A.` rather than at a sentence end.
fn continues_dotted_abbreviation(rest: &[Token]) -> bool {
    let mut iter = rest.iter();
    match (iter.next(), iter.next()) {
        (Some(letter), Some(dot)) => {
            letter.kind == TokenKind::Word
                && letter.text.chars().count() == 1
                && dot.text == "."
        }
        _ => false,
    }
}

/// True when the tokens after a period look like the start of a new sentence:
/// whitespace, then a capitalized word.
fn starts_new_sentence(rest: &[Token]) -> bool {
    let mut iter = rest.iter();
    let Some(first) = iter.next() else {
        return true; // end of block
    };
    if first.kind != TokenKind::Space {
        return false;
    }
    match iter.find(|t| t.kind != TokenKind::Space) {
        Some(t) => t.text.chars().next().is_some_and(char::is_uppercase),
        None => true,
    }
}

fn mark_flags(sentences: &mut [Sentence]) {
    for sentence in sentences.iter_mut() {
        let mut seen_word = false;
        for token in sentence.tokens.iter_mut() {
            if !token.is_word() {
                continue;
            }
            if !seen_word {
                token.flags.insert(TokenFlags::SENTENCE_INITIAL);
                seen_word = true;
            } else if token.text.chars().next().is_some_and(char::is_uppercase) {
                token.flags.insert(TokenFlags::PROPER_NOUN);
            }
        }
    }
}

pub fn parse(text: &str) -> Document {
    let mut offset = 0;
    let mut blocks = Vec::new();

    for (kind, prefix, body, trailing) in split_blocks(text) {
        offset += prefix.len();

        let sentences = if kind == BlockKind::CodeFence {
            // Opaque: one token, never touched, never split into sentences.
            vec![Sentence {
                tokens: vec![Token::new(body.clone(), TokenKind::Code, offset..offset + body.len())],
                terminator: None,
                trailing_ws: String::new(),
            }]
        } else {
            let mut s = into_sentences(tokenize(&body, offset));
            mark_flags(&mut s);
            s
        };

        offset += body.len() + trailing.len();
        blocks.push(Block { kind, prefix, sentences, trailing });
    }

    Document { blocks }
}
