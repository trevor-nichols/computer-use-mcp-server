import Foundation

#if os(macOS)
import AppKit
import CoreGraphics
import ScreenCaptureKit

enum ScreenshotService {
    static func capture(params: JSONDict) async throws -> [String: Any] {
        let requestedDisplayId = intParam(params, "displayId")
        guard let displayInfo = DisplayService.displayInfo(for: requestedDisplayId) else {
            throw BridgeRuntimeError(message: "No display is available")
        }

        let displayId = CGDirectDisplayID(displayInfo["displayId"] as? Int ?? 0)
        let width = intParam(params, "targetWidth") ?? (displayInfo["width"] as? Int ?? 0)
        let height = intParam(params, "targetHeight") ?? (displayInfo["height"] as? Int ?? 0)
        let format = stringParam(params, "format") ?? "jpeg"
        let jpegQuality = doubleParam(params, "jpegQuality") ?? 0.8
        let excludeBundleIds = Set(stringArrayParam(params, "excludeBundleIds"))
        let region = screenshotRegion(from: params)

        guard width > 0, height > 0 else {
            throw BridgeRuntimeError(message: "Screenshot target size must be positive")
        }

        let image = try await captureImage(
            displayId: displayId,
            targetWidth: width,
            targetHeight: height,
            region: region,
            excludeBundleIds: excludeBundleIds
        )

        let rep = NSBitmapImageRep(cgImage: image)
        let data: Data?
        let mimeType: String

        if format == "png" {
            mimeType = "image/png"
            data = rep.representation(using: .png, properties: [:])
        } else {
            mimeType = "image/jpeg"
            data = rep.representation(using: .jpeg, properties: [.compressionFactor: jpegQuality])
        }

        guard let data else {
            throw BridgeRuntimeError(message: "Failed to encode screenshot")
        }

        return [
            "dataBase64": data.base64EncodedString(),
            "mimeType": mimeType,
            "width": rep.pixelsWide,
            "height": rep.pixelsHigh,
            "display": displayInfo
        ]
    }

    private static func screenshotRegion(from params: JSONDict) -> CGRect? {
        guard let region = params["region"] as? JSONDict else {
            return nil
        }

        let x = doubleParam(region, "x") ?? 0
        let y = doubleParam(region, "y") ?? 0
        let width = doubleParam(region, "width") ?? 0
        let height = doubleParam(region, "height") ?? 0
        guard width > 0, height > 0 else {
            return nil
        }

        return CGRect(x: x, y: y, width: width, height: height)
    }

    private static func captureImage(
        displayId: CGDirectDisplayID,
        targetWidth: Int,
        targetHeight: Int,
        region: CGRect?,
        excludeBundleIds: Set<String>
    ) async throws -> CGImage {
        if excludeBundleIds.isEmpty {
            return try captureWithScreenCaptureCli(
                displayId: displayId,
                targetWidth: targetWidth,
                targetHeight: targetHeight,
                region: region
            )
        }

        if #available(macOS 14.0, *) {
            return try await captureWithScreenCaptureKit(
                displayId: displayId,
                targetWidth: targetWidth,
                targetHeight: targetHeight,
                region: region,
                excludeBundleIds: excludeBundleIds
            )
        }

        throw BridgeRuntimeError(message: "App exclusion for screenshots requires ScreenCaptureKit on macOS 14 or newer")
    }

    @available(macOS 14.0, *)
    private static func captureWithScreenCaptureKit(
        displayId: CGDirectDisplayID,
        targetWidth: Int,
        targetHeight: Int,
        region: CGRect?,
        excludeBundleIds: Set<String>
    ) async throws -> CGImage {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let display = content.displays.first(where: { $0.displayID == displayId }) else {
            throw BridgeRuntimeError(message: "Unable to resolve ScreenCaptureKit display for id \(displayId)")
        }

        let excludedApps = content.applications.filter { excludeBundleIds.contains($0.bundleIdentifier) }

        let filter = SCContentFilter(display: display, excludingApplications: excludedApps, exceptingWindows: [])
        let configuration = SCStreamConfiguration()
        configuration.width = targetWidth
        configuration.height = targetHeight
        configuration.showsCursor = true

        if let region {
            configuration.sourceRect = region
        }

        return try await withThrowingTaskGroup(of: CGImage.self) { group in
            group.addTask {
                try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
            }
            group.addTask {
                try await Task.sleep(nanoseconds: 2_000_000_000)
                throw BridgeRuntimeError(message: "ScreenCaptureKit screenshot capture timed out")
            }

            guard let image = try await group.next() else {
                throw BridgeRuntimeError(message: "ScreenCaptureKit screenshot capture returned no image")
            }
            group.cancelAll()
            return image
        }
    }

    private static func captureWithCoreGraphics(
        displayId: CGDirectDisplayID,
        targetWidth: Int,
        targetHeight: Int,
        region: CGRect?
    ) throws -> CGImage {
        guard let fullImage = CGDisplayCreateImage(displayId) else {
            throw BridgeRuntimeError(message: "Failed to capture display \(displayId)")
        }

        return try processCapturedImage(
            fullImage,
            targetWidth: targetWidth,
            targetHeight: targetHeight,
            region: region
        )
    }

    private static func captureWithScreenCaptureCli(
        displayId: CGDirectDisplayID,
        targetWidth: Int,
        targetHeight: Int,
        region: CGRect?
    ) throws -> CGImage {
        let displays = DisplayService.listDisplays()
        guard let displayIndex = displays.firstIndex(where: { ($0["displayId"] as? Int) == Int(displayId) }) else {
            throw BridgeRuntimeError(message: "Unable to resolve screencapture display for id \(displayId)")
        }

        let outputUrl = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("png")
        defer {
            try? FileManager.default.removeItem(at: outputUrl)
        }

        let stderrPipe = Pipe()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = [
            "-x",
            "-D", String(displayIndex + 1),
            "-t", "png",
            outputUrl.path,
        ]
        process.standardError = stderrPipe

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let stderrText = String(data: stderrData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let details = stderrText.isEmpty ? "" : ": \(stderrText)"
            throw BridgeRuntimeError(message: "screencapture failed for display \(displayId)\(details)")
        }

        guard let bitmap = NSBitmapImageRep(data: try Data(contentsOf: outputUrl)),
              let fullImage = bitmap.cgImage else {
            throw BridgeRuntimeError(message: "Failed to decode screencapture output for display \(displayId)")
        }

        return try processCapturedImage(
            fullImage,
            targetWidth: targetWidth,
            targetHeight: targetHeight,
            region: region
        )
    }

    private static func processCapturedImage(
        _ fullImage: CGImage,
        targetWidth: Int,
        targetHeight: Int,
        region: CGRect?
    ) throws -> CGImage {
        let croppedImage: CGImage
        if let region {
            let cropRect = region.integral.intersection(CGRect(x: 0, y: 0, width: fullImage.width, height: fullImage.height))
            guard !cropRect.isNull, cropRect.width > 0, cropRect.height > 0,
                  let image = fullImage.cropping(to: cropRect) else {
                throw BridgeRuntimeError(message: "Requested screenshot region is outside the display bounds")
            }
            croppedImage = image
        } else {
            croppedImage = fullImage
        }

        if croppedImage.width == targetWidth && croppedImage.height == targetHeight {
            return croppedImage
        }

        guard let colorSpace = croppedImage.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpace(name: CGColorSpace.genericRGBLinear) else {
            throw BridgeRuntimeError(message: "Failed to resolve color space for screenshot resize")
        }

        guard let context = CGContext(
            data: nil,
            width: targetWidth,
            height: targetHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            throw BridgeRuntimeError(message: "Failed to allocate image context for screenshot resize")
        }

        context.interpolationQuality = .high
        context.draw(croppedImage, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))

        guard let resizedImage = context.makeImage() else {
            throw BridgeRuntimeError(message: "Failed to resize screenshot")
        }

        return resizedImage
    }
}
#else
enum ScreenshotService {
    static func capture(params: JSONDict) async throws -> [String: Any] {
        throw BridgeRuntimeError(message: "Screen capture is only available on macOS")
    }
}
#endif
