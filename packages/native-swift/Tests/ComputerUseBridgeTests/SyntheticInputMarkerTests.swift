import XCTest
@testable import ComputerUseBridge

final class SyntheticInputMarkerTests: XCTestCase {
    func testSyntheticMarkerConstantMatchesRustContract() {
        #if os(macOS)
        XCTAssertEqual(SyntheticInputMarker.eventSourceUserData, 0x43554D4350455343)
        #else
        XCTAssertEqual(SyntheticInputMarker.eventSourceUserData, 0)
        #endif
    }
}
