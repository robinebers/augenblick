use chrono::Utc;

pub(super) fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}
