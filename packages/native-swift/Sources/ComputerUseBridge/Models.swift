import Foundation

typealias JSONDict = [String: Any]

struct BridgeRuntimeError: Error {
    let message: String
}

func parseLine(_ line: String) throws -> JSONDict {
    guard let data = line.data(using: .utf8) else {
        throw BridgeRuntimeError(message: "Input is not valid UTF-8")
    }
    guard let json = try JSONSerialization.jsonObject(with: data) as? JSONDict else {
        throw BridgeRuntimeError(message: "Input was not a JSON object")
    }
    return json
}

func makeSuccess(id: Int, result: Any) -> JSONDict {
    [
        "id": id,
        "ok": true,
        "result": result
    ]
}

func makeFailure(id: Int, message: String) -> JSONDict {
    [
        "id": id,
        "ok": false,
        "error": [
            "message": message
        ]
    ]
}

func printResponse(_ payload: JSONDict) {
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload),
          let text = String(data: data, encoding: .utf8) else {
        fputs("{\"id\":0,\"ok\":false,\"error\":{\"message\":\"Failed to encode response\"}}\n", stdout)
        fflush(stdout)
        return
    }
    print(text)
    fflush(stdout)
}

func intParam(_ params: JSONDict, _ key: String) -> Int? {
    if let value = params[key] as? Int { return value }
    if let value = params[key] as? Double { return Int(value) }
    if let value = params[key] as? NSNumber { return value.intValue }
    return nil
}

func doubleParam(_ params: JSONDict, _ key: String) -> Double? {
    if let value = params[key] as? Double { return value }
    if let value = params[key] as? Int { return Double(value) }
    if let value = params[key] as? NSNumber { return value.doubleValue }
    return nil
}

func boolParam(_ params: JSONDict, _ key: String) -> Bool? {
    if let value = params[key] as? Bool { return value }
    if let value = params[key] as? NSNumber { return value.boolValue }
    return nil
}

func stringParam(_ params: JSONDict, _ key: String) -> String? {
    params[key] as? String
}

func stringArrayParam(_ params: JSONDict, _ key: String) -> [String] {
    params[key] as? [String] ?? []
}
