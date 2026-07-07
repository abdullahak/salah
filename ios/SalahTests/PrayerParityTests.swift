import XCTest
@testable import Salah

final class PrayerParityTests: XCTestCase {
    func testPrayerCalculationsMatchAdhanJsFixtures() throws {
        let root = try loadParityFixtures()
        let calculator = PrayerCalculator()
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        for fixture in root.fixtures {
            let location = ResolvedLocation(
                id: fixture.id,
                label: fixture.label,
                latitude: fixture.latitude,
                longitude: fixture.longitude,
                timezone: fixture.timezone,
                countryCode: nil,
                source: .manualCoordinates
            )
            let noon = try XCTUnwrap(ISO8601DateFormatter().date(from: "\(fixture.date)T12:00:00Z"))
            let prayers = try calculator.prayerTimes(
                for: location,
                date: noon,
                settings: fixture.settings
            )

            XCTAssertEqual(prayers.map(\.name.rawValue), fixture.expectedPrayers.map(\.name), fixture.id)

            for (actual, expected) in zip(prayers, fixture.expectedPrayers) {
                let expectedDate = try XCTUnwrap(parser.date(from: expected.iso), fixture.id)
                XCTAssertLessThanOrEqual(
                    abs(actual.time.timeIntervalSince(expectedDate)),
                    60,
                    "\(fixture.id) \(expected.name) should match adhan-js within one minute"
                )
                XCTAssertEqual(actual.formatted, expected.formatted, "\(fixture.id) \(expected.name)")
            }

            XCTAssertEqual(
                calculator.qiblahBearing(for: location),
                fixture.expectedQiblahBearing,
                accuracy: 0.0001,
                fixture.id
            )
        }
    }

    @MainActor
    func testSettingsStorePersistsLocalSettings() {
        let suiteName = "SalahTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let store = SettingsStore(defaults: defaults)
        store.updateLocation(SalahLocationData.offlineCities[3])
        store.updateSettings(
            calculationMethod: .northAmerica,
            madhab: .hanafi,
            timeFormat: .twentyFourHour,
            snoozeDurationMinutes: 15
        )

        let reloaded = SettingsStore(defaults: defaults)

        XCTAssertEqual(reloaded.state.location.label, "New York, United States")
        XCTAssertEqual(reloaded.state.settings.calculationMethod, .northAmerica)
        XCTAssertEqual(reloaded.state.settings.madhab, .hanafi)
        XCTAssertEqual(reloaded.state.settings.timeFormat, .twentyFourHour)
        XCTAssertEqual(reloaded.state.settings.snoozeDurationMinutes, 15)
    }

    private func loadParityFixtures() throws -> PrayerParityRoot {
        let bundle = Bundle(for: PrayerParityTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "prayer-parity", withExtension: "json"))
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(PrayerParityRoot.self, from: data)
    }
}

private struct PrayerParityRoot: Decodable {
    var fixtures: [PrayerParityFixture]
}

private struct PrayerParityFixture: Decodable {
    var id: String
    var label: String
    var latitude: Double
    var longitude: Double
    var timezone: String
    var date: String
    var settings: PrayerSettings
    var expectedQiblahBearing: Double
    var expectedPrayers: [ExpectedPrayer]
}

private struct ExpectedPrayer: Decodable {
    var name: String
    var iso: String
    var formatted: String
}
