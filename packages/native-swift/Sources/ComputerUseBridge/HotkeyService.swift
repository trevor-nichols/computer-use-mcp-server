import Foundation

#if os(macOS)
import AppKit

enum HotkeyService {
    private static let lock = NSLock()
    private static var activeSessions = Set<String>()
    private static var expectedEscapeUntil = [String: Date]()
    private static var abortedSessions = Set<String>()
    private static var monitor: Any?

    static func registerEscapeAbort(sessionId: String) {
        lock.lock()
        defer { lock.unlock() }
        activeSessions.insert(sessionId)
        if monitor == nil {
            monitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { event in
                guard event.keyCode == 53 else { return }
                handleEscapeEvent()
            }
        }
    }

    static func markExpectedEscape(sessionId: String, windowMs: Int) {
        lock.lock()
        defer { lock.unlock() }
        expectedEscapeUntil[sessionId] = Date().addingTimeInterval(Double(windowMs) / 1000.0)
    }

    static func unregisterEscapeAbort(sessionId: String) {
        lock.lock()
        defer { lock.unlock() }
        activeSessions.remove(sessionId)
        expectedEscapeUntil.removeValue(forKey: sessionId)
        abortedSessions.remove(sessionId)
        if activeSessions.isEmpty, let monitor {
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }
    }

    static func consumeAbort(sessionId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return abortedSessions.remove(sessionId) != nil
    }

    private static func handleEscapeEvent() {
        lock.lock()
        defer { lock.unlock() }

        let now = Date()
        expectedEscapeUntil = expectedEscapeUntil.filter { $0.value > now }
        if let expected = expectedEscapeUntil.first(where: { activeSessions.contains($0.key) }) {
            expectedEscapeUntil.removeValue(forKey: expected.key)
            return
        }

        for sessionId in activeSessions {
            abortedSessions.insert(sessionId)
        }
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
