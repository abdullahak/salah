import Foundation

enum CalculationMethodId: String, CaseIterable, Codable, Identifiable {
    case muslimWorldLeague = "MuslimWorldLeague"
    case egyptian = "Egyptian"
    case karachi = "Karachi"
    case ummAlQura = "UmmAlQura"
    case dubai = "Dubai"
    case moonsightingCommittee = "MoonsightingCommittee"
    case northAmerica = "NorthAmerica"
    case kuwait = "Kuwait"
    case qatar = "Qatar"
    case singapore = "Singapore"
    case tehran = "Tehran"
    case turkey = "Turkey"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .muslimWorldLeague:
            return "Muslim World League"
        case .egyptian:
            return "Egyptian"
        case .karachi:
            return "Karachi"
        case .ummAlQura:
            return "Umm al-Qura"
        case .dubai:
            return "Dubai"
        case .moonsightingCommittee:
            return "Moonsighting Committee"
        case .northAmerica:
            return "North America"
        case .kuwait:
            return "Kuwait"
        case .qatar:
            return "Qatar"
        case .singapore:
            return "Singapore"
        case .tehran:
            return "Tehran"
        case .turkey:
            return "Turkey"
        }
    }
}

enum MadhabId: String, CaseIterable, Codable, Identifiable {
    case shafi
    case hanafi

    var id: String { rawValue }

    var label: String {
        switch self {
        case .shafi:
            return "Standard"
        case .hanafi:
            return "Hanafi"
        }
    }
}

enum TimeFormat: String, CaseIterable, Codable, Identifiable {
    case twelveHour = "12h"
    case twentyFourHour = "24h"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .twelveHour:
            return "12 hour"
        case .twentyFourHour:
            return "24 hour"
        }
    }
}

enum LocationSource: String, Codable {
    case offlineCity = "offline-city"
    case manualCoordinates = "manual-coordinates"
    case deviceLocation = "device-location"

    var label: String {
        switch self {
        case .offlineCity:
            return "Offline city"
        case .manualCoordinates:
            return "Manual coordinates"
        case .deviceLocation:
            return "Device location"
        }
    }
}

struct ResolvedLocation: Codable, Equatable, Identifiable {
    var id: String
    var label: String
    var latitude: Double
    var longitude: Double
    var timezone: String
    var countryCode: String?
    var source: LocationSource
}

struct PrayerSettings: Codable, Equatable {
    var calculationMethod: CalculationMethodId
    var madhab: MadhabId
    var timeFormat: TimeFormat
    var snoozeDurationMinutes: Int
}

struct SalahAppState: Codable, Equatable {
    static let currentVersion = 1

    var version: Int
    var location: ResolvedLocation
    var settings: PrayerSettings

    static func initial() -> SalahAppState {
        let location = SalahLocationData.defaultLocation()

        return SalahAppState(
            version: currentVersion,
            location: location,
            settings: SalahDefaults.settings(forCountry: location.countryCode)
        )
    }
}

enum PrayerName: String, CaseIterable, Codable, Identifiable {
    case fajr
    case sunrise
    case dhuhr
    case asr
    case maghrib
    case isha

    var id: String { rawValue }

    var label: String {
        switch self {
        case .fajr:
            return "Fajr"
        case .sunrise:
            return "Sunrise"
        case .dhuhr:
            return "Dhuhr"
        case .asr:
            return "Asr"
        case .maghrib:
            return "Maghrib"
        case .isha:
            return "Isha"
        }
    }
}

struct PrayerTimeEntry: Identifiable, Equatable {
    var name: PrayerName
    var time: Date
    var formatted: String

    var id: PrayerName { name }
    var label: String { name.label }
}

enum SalahDefaults {
    private static let countryMethods: [String: CalculationMethodId] = [
        "AE": .dubai,
        "BH": .kuwait,
        "EG": .egyptian,
        "ID": .singapore,
        "IN": .karachi,
        "JO": .muslimWorldLeague,
        "KW": .kuwait,
        "MY": .singapore,
        "PK": .karachi,
        "QA": .qatar,
        "SA": .ummAlQura,
        "SG": .singapore,
        "TR": .turkey,
        "US": .northAmerica
    ]

    private static let hanafiCountries: Set<String> = ["AF", "BD", "IN", "PK", "TR"]

    static func settings(forCountry countryCode: String?) -> PrayerSettings {
        let normalizedCode = countryCode?.uppercased()
        let method = normalizedCode.flatMap { countryMethods[$0] } ?? .muslimWorldLeague
        let madhab: MadhabId = normalizedCode.map { hanafiCountries.contains($0) } == true ? .hanafi : .shafi

        return PrayerSettings(
            calculationMethod: method,
            madhab: madhab,
            timeFormat: .twelveHour,
            snoozeDurationMinutes: 10
        )
    }
}

enum SalahLocationData {
    static let offlineCities: [ResolvedLocation] = [
        ResolvedLocation(
            id: "makkah-sa",
            label: "Makkah, Saudi Arabia",
            latitude: 21.3891,
            longitude: 39.8579,
            timezone: "Asia/Riyadh",
            countryCode: "SA",
            source: .offlineCity
        ),
        ResolvedLocation(
            id: "madinah-sa",
            label: "Madinah, Saudi Arabia",
            latitude: 24.5247,
            longitude: 39.5692,
            timezone: "Asia/Riyadh",
            countryCode: "SA",
            source: .offlineCity
        ),
        ResolvedLocation(
            id: "london-gb",
            label: "London, United Kingdom",
            latitude: 51.5072,
            longitude: -0.1276,
            timezone: "Europe/London",
            countryCode: "GB",
            source: .offlineCity
        ),
        ResolvedLocation(
            id: "new-york-us",
            label: "New York, United States",
            latitude: 40.7128,
            longitude: -74.006,
            timezone: "America/New_York",
            countryCode: "US",
            source: .offlineCity
        ),
        ResolvedLocation(
            id: "jakarta-id",
            label: "Jakarta, Indonesia",
            latitude: -6.2088,
            longitude: 106.8456,
            timezone: "Asia/Jakarta",
            countryCode: "ID",
            source: .offlineCity
        ),
        ResolvedLocation(
            id: "istanbul-tr",
            label: "Istanbul, Turkiye",
            latitude: 41.0138,
            longitude: 28.9497,
            timezone: "Europe/Istanbul",
            countryCode: "TR",
            source: .offlineCity
        ),
        ResolvedLocation(
            id: "dubai-ae",
            label: "Dubai, United Arab Emirates",
            latitude: 25.0772,
            longitude: 55.3093,
            timezone: "Asia/Dubai",
            countryCode: "AE",
            source: .offlineCity
        )
    ]

    static func defaultLocation() -> ResolvedLocation {
        offlineCities[0]
    }

    static func manualLocation(latitude: Double, longitude: Double, timezone: String = TimeZone.current.identifier) -> ResolvedLocation {
        ResolvedLocation(
            id: "manual-coordinates",
            label: String(format: "%.4f, %.4f", latitude, longitude),
            latitude: latitude,
            longitude: longitude,
            timezone: timezone,
            countryCode: nil,
            source: .manualCoordinates
        )
    }
}
