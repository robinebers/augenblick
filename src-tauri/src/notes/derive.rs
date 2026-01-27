pub(super) fn derive_title_preview(content: &str) -> (String, String) {
    let mut lines = content.lines().map(|l| l.trim()).filter(|l| !l.is_empty());
    let first = lines.next().unwrap_or("");
    let title = sanitize_heading(first);
    let title = if title.is_empty() {
        "New Note".to_string()
    } else {
        truncate(title, 80)
    };

    let preview_source = lines.next().unwrap_or(first);
    let preview = truncate(compact_whitespace(sanitize_heading(preview_source)), 140);
    (title, preview)
}

fn sanitize_heading(line: &str) -> String {
    line.trim_start_matches(&['#', '-', '>', '*'][..])
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
    out.truncate(max_len);
    out
}
