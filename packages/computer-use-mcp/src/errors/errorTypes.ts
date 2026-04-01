export class MissingOsPermissionsError extends Error {
  constructor(message = 'Required macOS permissions are missing.') {
    super(message)
    this.name = 'MissingOsPermissionsError'
  }
}

export class DesktopLockHeldError extends Error {
  constructor(message = 'Another session currently owns desktop control.') {
    super(message)
    this.name = 'DesktopLockHeldError'
  }
}

export class DisplayResolutionError extends Error {
  constructor(message = 'Unable to resolve target display.') {
    super(message)
    this.name = 'DisplayResolutionError'
  }
}

export class CoordinateTransformError extends Error {
  constructor(message = 'Unable to map screenshot coordinates to the desktop.') {
    super(message)
    this.name = 'CoordinateTransformError'
  }
}

export class ClipboardGuardError extends Error {
  constructor(message = 'Clipboard access is not allowed for this session.') {
    super(message)
    this.name = 'ClipboardGuardError'
  }
}

export class InputInjectionError extends Error {
  constructor(message = 'Input injection failed.') {
    super(message)
    this.name = 'InputInjectionError'
  }
}

export class ScreenshotCaptureError extends Error {
  constructor(message = 'Screenshot capture failed.') {
    super(message)
    this.name = 'ScreenshotCaptureError'
  }
}

export class PermissionDeniedError extends Error {
  constructor(message = 'Permission request was denied.') {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

export class AppResolutionError extends Error {
  constructor(message = 'Application resolution failed.') {
    super(message)
    this.name = 'AppResolutionError'
  }
}

export class NativeTimeoutError extends Error {
  constructor(message = 'A native bridge call timed out.') {
    super(message)
    this.name = 'NativeTimeoutError'
  }
}

export class ApprovalProviderTimeoutError extends Error {
  constructor(message = 'Approval provider timed out.') {
    super(message)
    this.name = 'ApprovalProviderTimeoutError'
  }
}

export class UnsupportedHostApprovalError extends Error {
  constructor(message = 'The connected host does not support the required approval callback.') {
    super(message)
    this.name = 'UnsupportedHostApprovalError'
  }
}


export class AbortRequestedError extends Error {
  constructor(message = 'Computer use was aborted by the user.') {
    super(message)
    this.name = 'AbortRequestedError'
  }
}
