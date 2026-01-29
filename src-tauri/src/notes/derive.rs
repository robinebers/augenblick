pub(super) fn derive_title_preview(content: &str) -> (String, String) {
    let lines: Vec<&str> = content
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    let title_line = lines.iter().find(|l| !clean(l).is_empty()).copied().unwrap_or("");
    let title_raw = clean(title_line);
    let title = if title_raw.is_empty() {
        "New note".to_string()
    } else {
        truncate(title_raw, 80)
    };

    let preview_line = lines
        .iter()
        .find(|l| **l != title_line && !clean(l).is_empty())
        .copied()
        .unwrap_or(title_line);
    let preview = truncate(compact_whitespace(clean(preview_line)), 140);
    (title, preview)
}

fn sanitize_heading(line: &str) -> String {
    let trimmed = line.trim_start();
    if let Some(rest) = trimmed.strip_prefix('\\') {
        if rest.starts_with(['#', '-', '>', '*']) {
            return rest.trim().to_string();
        }
    }
    trimmed
        .trim_start_matches(&['#', '-', '>', '*'][..])
        .trim()
        .to_string()
}

fn decode_entities(s: &str) -> String {
    s.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn strip_escapes(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(&next) = chars.peek() {
                if "\\`*_{}[]()#+-.!>~|".contains(next) {
                    result.push(next);
                    chars.next();
                    continue;
                }
            }
        }
        result.push(ch);
    }
    result
}

fn clean(line: &str) -> String {
    decode_entities(&strip_escapes(&sanitize_heading(line)))
        .trim()
        .to_string()
}

fn compact_whitespace(s: String) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate(s: String, max_len: usize) -> String {
    if s.len() <= max_len {
        return s;
    }
    let mut out = s;
    let mut end = max_len.min(out.len());
    while end > 0 && !out.is_char_boundary(end) {
        end -= 1;
    }
    out.truncate(end);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heading_extraction() {
        let (title, preview) = derive_title_preview("# Title\nPreview line");
        assert_eq!(title, "Title");
        assert_eq!(preview, "Preview line");
    }

    #[test]
    fn empty_content_defaults() {
        let (title, _) = derive_title_preview("\n\n");
        assert_eq!(title, "New note");
    }

    #[test]
    fn whitespace_entity_defaults() {
        let (title, _) = derive_title_preview("&nbsp;");
        assert_eq!(title, "New note");
    }

    #[test]
    fn decodes_html_entities() {
        let (title, _) = derive_title_preview("Hello&nbsp;World");
        assert_eq!(title, "Hello World");
    }

    #[test]
    fn strips_escape_sequences() {
        let (title, _) = derive_title_preview("Hello \\*world\\*");
        assert_eq!(title, "Hello *world*");
    }

    #[test]
    fn skips_non_text_lines() {
        let (title, _) = derive_title_preview("---\nActual title");
        assert_eq!(title, "Actual title");
    }

    #[test]
    fn truncation() {
        let long = "a".repeat(200);
        let (title, preview) = derive_title_preview(&format!("{long}\n{long}"));
        assert_eq!(title.len(), 80);
        assert_eq!(preview.len(), 140);
    }

    #[test]
    fn escaped_heading_prefix() {
        let (title, _) = derive_title_preview("\\# Escaped");
        assert!(title.starts_with('#'));
    }

    #[test]
    fn unicode_truncation_no_panic() {
        let line = "● Jamf “KISS” Setup (mit eurem check_free_space + Live-Check + Zeilenumbrüche)"
            .repeat(4);
        let (title, preview) = derive_title_preview(&line);
        assert!(!title.is_empty());
        assert!(!preview.is_empty());
        assert!(title.len() <= 80);
        assert!(preview.len() <= 140);
    }
}
