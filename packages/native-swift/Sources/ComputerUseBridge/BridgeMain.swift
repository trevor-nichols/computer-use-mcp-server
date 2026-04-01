import Foundation

@main
struct ComputerUseBridgeMain {
    static func main() async {
        while let line = readLine() {
            do {
                let request = try parseLine(line)
                let id = intParam(request, "id") ?? 0
                let method = stringParam(request, "method") ?? ""
                let params = request["params"] as? JSONDict ?? [:]
                let result = try await handle(method: method, params: params)
                printResponse(makeSuccess(id: id, result: result))
            } catch {
                let requestId = (try? parseLine(line)).flatMap { intParam($0, "id") } ?? 0
                printResponse(makeFailure(id: requestId, message: String(describing: error)))
            }
        }
    }

    static func handle(method: String, params: JSONDict) async throws -> Any {
        switch method {
        case "ping":
            return [:]

        case "listDisplays":
            return DisplayService.listDisplays()

        case "capture":
            return try await ScreenshotService.capture(params: params)

        case "listInstalledApps":
            return AppService.listInstalledApps()

        case "listRunningApps":
            return AppService.listRunningApps()

        case "getFrontmostApp":
            return AppService.getFrontmostApp() ?? NSNull()

        case "appUnderPoint":
            return AppService.appUnderPoint(
                x: doubleParam(params, "x") ?? 0,
                y: doubleParam(params, "y") ?? 0
            ) ?? NSNull()

        case "openApplication":
            guard let bundleId = stringParam(params, "bundleId") else {
                throw BridgeRuntimeError(message: "bundleId is required")
            }
            try await AppService.openApplication(bundleId: bundleId)
            return [:]

        case "hideApplications":
            return AppService.hideApplications(bundleIds: stringArrayParam(params, "bundleIds"))

        case "unhideApplications":
            AppService.unhideApplications(bundleIds: stringArrayParam(params, "bundleIds"))
            return [:]

        case "findWindowDisplays":
            return AppService.findWindowDisplays(bundleIds: stringArrayParam(params, "bundleIds"))

        case "getCursorPosition":
            return InputService.getCursorPosition()

        case "moveMouse":
            InputService.moveMouse(x: doubleParam(params, "x") ?? 0, y: doubleParam(params, "y") ?? 0)
            return [:]

        case "mouseDown":
            InputService.mouseDown(button: stringParam(params, "button") ?? "left")
            return [:]

        case "mouseUp":
            InputService.mouseUp(button: stringParam(params, "button") ?? "left")
            return [:]

        case "click":
            InputService.click(button: stringParam(params, "button") ?? "left", count: intParam(params, "count") ?? 1)
            return [:]

        case "scroll":
            InputService.scroll(dx: doubleParam(params, "dx") ?? 0, dy: doubleParam(params, "dy") ?? 0)
            return [:]

        case "keySequence":
            InputService.keySequence(stringParam(params, "sequence") ?? "")
            return [:]

        case "keyDown":
            guard let key = stringParam(params, "key") else {
                throw BridgeRuntimeError(message: "key is required")
            }
            InputService.keyDown(key)
            return [:]

        case "keyUp":
            guard let key = stringParam(params, "key") else {
                throw BridgeRuntimeError(message: "key is required")
            }
            InputService.keyUp(key)
            return [:]

        case "typeText":
            InputService.typeText(stringParam(params, "text") ?? "")
            return [:]

        case "readClipboard":
            return ClipboardService.readText()

        case "writeClipboard":
            ClipboardService.writeText(stringParam(params, "text") ?? "")
            return [:]

        case "getTccState":
            return TccService.getState()

        case "openAccessibilitySettings":
            TccService.openAccessibilitySettings()
            return [:]

        case "openScreenRecordingSettings":
            TccService.openScreenRecordingSettings()
            return [:]

        case "registerEscapeAbort":
            guard let sessionId = stringParam(params, "sessionId") else {
                throw BridgeRuntimeError(message: "sessionId is required")
            }
            HotkeyService.registerEscapeAbort(sessionId: sessionId)
            return [:]

        case "markExpectedEscape":
            guard let sessionId = stringParam(params, "sessionId") else {
                throw BridgeRuntimeError(message: "sessionId is required")
            }
            HotkeyService.markExpectedEscape(sessionId: sessionId, windowMs: intParam(params, "windowMs") ?? 1000)
            return [:]

        case "unregisterEscapeAbort":
            guard let sessionId = stringParam(params, "sessionId") else {
                throw BridgeRuntimeError(message: "sessionId is required")
            }
            HotkeyService.unregisterEscapeAbort(sessionId: sessionId)
            return [:]

        case "consumeAbort":
            guard let sessionId = stringParam(params, "sessionId") else {
                throw BridgeRuntimeError(message: "sessionId is required")
            }
            return HotkeyService.consumeAbort(sessionId: sessionId)

        default:
            throw BridgeRuntimeError(message: "Unknown method: \(method)")
        }
    }
}
