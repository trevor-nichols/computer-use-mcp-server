import Foundation

#if os(macOS)
import AppKit
import ApplicationServices
import CoreGraphics

private func escapeEventTapCallback(
    proxy: CGEventTapProxy,
    type: CGEventType,
    event: CGEvent,
    userInfo: UnsafeMutableRawPointer?
) -> Unmanaged<CGEvent>? {
    HotkeyService.handleTapEvent(proxy: proxy, type: type, event: event, userInfo: userInfo)
}

enum HotkeyService {
    private enum HookMode {
        case none
        case installing
        case eventTap
        case globalMonitor
    }

    private static let state = NSCondition()
    private static var activeSessions = Set<String>()
    private static var expectedEscapeUntil = [String: Date]()
    private static var abortedSessions = Set<String>()
    private static var suppressNextEscapeKeyUp = false

    private static var hookMode: HookMode = .none
    private static var eventTap: CFMachPort?
    private static var eventTapSource: CFRunLoopSource?
    private static var eventTapRunLoop: CFRunLoop?
    private static var globalMonitor: Any?

    static func registerEscapeAbort(sessionId: String) {
        var shouldInstallHook = false

        state.lock()
        activeSessions.insert(sessionId)
        while hookMode == .installing {
            state.wait()
        }
        if hookMode == .none {
            hookMode = .installing
            shouldInstallHook = true
        }
        state.unlock()

        guard shouldInstallHook else { return }

        let installedHookMode = installBestAvailableHook()

        state.lock()
        hookMode = installedHookMode
        state.broadcast()
        state.unlock()
    }

    static func markExpectedEscape(sessionId: String, windowMs: Int) {
        state.lock()
        defer { state.unlock() }
        expectedEscapeUntil[sessionId] = Date().addingTimeInterval(Double(windowMs) / 1000.0)
    }

    static func unregisterEscapeAbort(sessionId: String) {
        var shouldTeardownHook = false

        state.lock()
        activeSessions.remove(sessionId)
        expectedEscapeUntil.removeValue(forKey: sessionId)
        abortedSessions.remove(sessionId)
        if activeSessions.isEmpty {
            suppressNextEscapeKeyUp = false
            shouldTeardownHook = hookMode == .eventTap || hookMode == .globalMonitor
            hookMode = .none
        }
        state.unlock()

        if shouldTeardownHook {
            teardownInstalledHook()
        }
    }

    static func consumeAbort(sessionId: String) -> Bool {
        state.lock()
        defer { state.unlock() }
        return abortedSessions.remove(sessionId) != nil
    }

    static func handleTapEvent(
        proxy: CGEventTapProxy,
        type: CGEventType,
        event: CGEvent,
        userInfo: UnsafeMutableRawPointer?
    ) -> Unmanaged<CGEvent>? {
        state.lock()
        defer { state.unlock() }

        switch type {
        case .tapDisabledByTimeout, .tapDisabledByUserInput:
            if let eventTap {
                CGEvent.tapEnable(tap: eventTap, enable: true)
            }
            return Unmanaged.passUnretained(event)

        case .keyDown, .keyUp:
            break

        default:
            return Unmanaged.passUnretained(event)
        }

        guard event.getIntegerValueField(.keyboardEventKeycode) == 53 else {
            return Unmanaged.passUnretained(event)
        }

        pruneExpiredExpectedEscapesLocked()

        guard !activeSessions.isEmpty else {
            return Unmanaged.passUnretained(event)
        }

        if SyntheticInputMarker.isMarked(event) {
            consumeOneExpectedEscapeLocked()
            return Unmanaged.passUnretained(event)
        }

        if type == .keyUp {
            if suppressNextEscapeKeyUp {
                suppressNextEscapeKeyUp = false
                return nil
            }
            return Unmanaged.passUnretained(event)
        }

        if consumeOneExpectedEscapeLocked() {
            return Unmanaged.passUnretained(event)
        }

        suppressNextEscapeKeyUp = true
        for sessionId in activeSessions {
            abortedSessions.insert(sessionId)
        }
        return nil
    }

    private static func installBestAvailableHook() -> HookMode {
        if AXIsProcessTrusted(), installEventTap() {
            return .eventTap
        }

        if let monitor = NSEvent.addGlobalMonitorForEvents(
            matching: .keyDown,
            handler: { event in
                guard event.keyCode == 53 else { return }
                handleObservedEscapeFromFallbackMonitor()
            }
        ) {
            state.lock()
            globalMonitor = monitor
            state.unlock()
            return .globalMonitor
        }

        return .none
    }

    private static func installEventTap() -> Bool {
        let ready = DispatchSemaphore(value: 0)
        let tapThread = Thread {
            autoreleasepool {
                let eventsOfInterest =
                    (CGEventMask(1) << CGEventType.keyDown.rawValue) |
                    (CGEventMask(1) << CGEventType.keyUp.rawValue)

                guard let eventTap = CGEvent.tapCreate(
                    tap: .cgSessionEventTap,
                    place: .headInsertEventTap,
                    options: .defaultTap,
                    eventsOfInterest: eventsOfInterest,
                    callback: escapeEventTapCallback,
                    userInfo: nil
                ) else {
                    ready.signal()
                    return
                }

                let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
                let runLoop = CFRunLoopGetCurrent()

                state.lock()
                self.eventTap = eventTap
                self.eventTapSource = source
                self.eventTapRunLoop = runLoop
                state.unlock()

                CFRunLoopAddSource(runLoop, source, .commonModes)
                CGEvent.tapEnable(tap: eventTap, enable: true)
                ready.signal()
                CFRunLoopRun()
            }
        }

        tapThread.name = "computer-use.escape-event-tap"
        tapThread.start()
        ready.wait()

        state.lock()
        defer { state.unlock() }
        return eventTap != nil
    }

    private static func teardownInstalledHook() {
        var runLoopToStop: CFRunLoop?
        var sourceToRemove: CFRunLoopSource?
        var tapToInvalidate: CFMachPort?
        var monitorToRemove: Any?

        state.lock()
        runLoopToStop = eventTapRunLoop
        sourceToRemove = eventTapSource
        tapToInvalidate = eventTap
        monitorToRemove = globalMonitor
        eventTapRunLoop = nil
        eventTapSource = nil
        eventTap = nil
        globalMonitor = nil
        state.unlock()

        if let monitorToRemove {
            NSEvent.removeMonitor(monitorToRemove)
        }

        if let runLoopToStop, let sourceToRemove, let tapToInvalidate {
            CGEvent.tapEnable(tap: tapToInvalidate, enable: false)
            CFRunLoopSourceInvalidate(sourceToRemove)
            CFMachPortInvalidate(tapToInvalidate)
            CFRunLoopStop(runLoopToStop)
            CFRunLoopWakeUp(runLoopToStop)
        }
    }

    private static func handleObservedEscapeFromFallbackMonitor() {
        state.lock()
        defer { state.unlock() }

        pruneExpiredExpectedEscapesLocked()
        if consumeOneExpectedEscapeLocked() {
            return
        }

        for sessionId in activeSessions {
            abortedSessions.insert(sessionId)
        }
    }

    private static func pruneExpiredExpectedEscapesLocked() {
        let now = Date()
        expectedEscapeUntil = expectedEscapeUntil.filter { $0.value > now }
    }

    @discardableResult
    private static func consumeOneExpectedEscapeLocked() -> Bool {
        guard let expectedSessionId = expectedEscapeUntil
            .filter({ activeSessions.contains($0.key) })
            .min(by: { $0.value < $1.value })?
            .key else {
            return false
        }

        expectedEscapeUntil.removeValue(forKey: expectedSessionId)
        return true
    }
}
#else
enum HotkeyService {
    static func registerEscapeAbort(sessionId: String) {}
    static func markExpectedEscape(sessionId: String, windowMs: Int) {}
    static func unregisterEscapeAbort(sessionId: String) {}
    static func consumeAbort(sessionId: String) -> Bool { false }
}
#endif
