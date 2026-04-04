use computer_use_native_input::{click, get_cursor_position, key_down, key_sequence, mouse_down};

#[test]
fn exported_api_rejects_invalid_mouse_arguments_before_platform_dispatch() {
    let error = mouse_down("unexpected".to_string()).expect_err("invalid mouse button should fail");
    assert_eq!(error.status, napi::Status::InvalidArg);
    assert!(error.reason.contains("Unsupported mouse button"));

    let click_error = click("left".to_string(), 4).expect_err("invalid click count should fail");
    assert_eq!(click_error.status, napi::Status::InvalidArg);
    assert!(click_error.reason.contains("Unsupported click count"));
}

#[test]
fn exported_api_rejects_invalid_key_arguments_before_platform_dispatch() {
    let error = key_down("does_not_exist".to_string()).expect_err("invalid key should fail");
    assert_eq!(error.status, napi::Status::InvalidArg);
    assert!(error.reason.contains("Unsupported key token"));

    let chord_error = key_sequence("a+b".to_string()).expect_err("invalid chord should fail");
    assert_eq!(chord_error.status, napi::Status::InvalidArg);
    assert!(chord_error.reason.contains("Invalid key sequence"));
}

#[test]
fn exported_api_reports_platform_support_for_cursor_queries() {
    let result = get_cursor_position();
    #[cfg(target_os = "macos")]
    assert!(result.is_ok(), "macOS cursor queries should be available");

    #[cfg(not(target_os = "macos"))]
    {
        let error = result.expect_err("non-macOS builds should fail closed");
        assert_eq!(error.status, napi::Status::InvalidArg);
        assert!(error.reason.contains("macOS only"));
        let _ = computer_use_native_input::error::InputError::UnsupportedPlatform;
    }
}
