import XCTest
@testable import Drift

final class GoodDoctorTests: XCTestCase {
    func testCatalogHasEpisodesAndStableIdentifiers() {
        let series = CatalogData.theGoodDoctor
        XCTAssertEqual(series.seasons.count, 7)
        XCTAssertFalse(series.allEpisodes.isEmpty)
        XCTAssertTrue(series.allEpisodes.allSatisfy { $0.id.hasPrefix("the-good-doctor-s") })
    }
    func testProgressMarksFinishedAtNinetyPercent() {
        let progress = PlaybackProgress(seconds: 90, duration: 100, lastPlayed: .now, isFinished: true)
        XCTAssertEqual(progress.fraction, 0.9)
        XCTAssertTrue(progress.isFinished)
    }
}
