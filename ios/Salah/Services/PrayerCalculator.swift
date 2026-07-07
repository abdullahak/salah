import Adhan
import Foundation

enum PrayerCalculationError: LocalizedError {
    case invalidTimeZone(String)
    case unavailableTimes

    var errorDescription: String? {
        switch self {
        case .invalidTimeZone(let identifier):
            return "Invalid timezone: \(identifier)"
        case .unavailableTimes:
            return "Prayer times are unavailable for this location and date."
        }
    }
}

struct PrayerCalculator {
    func prayerTimes(
        for location: ResolvedLocation,
        date: Date = Date(),
        settings: PrayerSettings
    ) throws -> [PrayerTimeEntry] {
        let timeZone = try resolvedTimeZone(location.timezone)
        let calendar = calendar(for: timeZone)
        let dateComponents = calendar.dateComponents([.year, .month, .day], from: date)

        return try prayerTimes(
            for: location,
            dateComponents: dateComponents,
            settings: settings
        )
    }

    func prayerTimes(
        for location: ResolvedLocation,
        dateComponents: DateComponents,
        settings: PrayerSettings
    ) throws -> [PrayerTimeEntry] {
        let timeZone = try resolvedTimeZone(location.timezone)
        let coordinates = Coordinates(latitude: location.latitude, longitude: location.longitude)
        var parameters = settings.calculationMethod.adhanMethod.params
        parameters.madhab = settings.madhab == .hanafi ? .hanafi : .shafi
        parameters.highLatitudeRule = .middleOfTheNight

        guard let prayerTimes = PrayerTimes(
            coordinates: coordinates,
            date: dateComponents,
            calculationParameters: parameters
        ) else {
            throw PrayerCalculationError.unavailableTimes
        }

        let formatter = dateFormatter(timeZone: timeZone, format: settings.timeFormat)

        return PrayerName.allCases.map { prayer in
            let time = prayerTimes.time(for: prayer.adhanPrayer)

            return PrayerTimeEntry(
                name: prayer,
                time: time,
                formatted: formatter.string(from: time)
            )
        }
    }

    func qiblahBearing(for location: ResolvedLocation) -> Double {
        let coordinates = Coordinates(latitude: location.latitude, longitude: location.longitude)
        return normalizeBearing(Qibla(coordinates: coordinates).direction)
    }

    func formattedBearing(for location: ResolvedLocation) -> String {
        "\(Int(round(qiblahBearing(for: location)))) deg"
    }

    private func resolvedTimeZone(_ identifier: String) throws -> TimeZone {
        guard let timeZone = TimeZone(identifier: identifier) else {
            throw PrayerCalculationError.invalidTimeZone(identifier)
        }

        return timeZone
    }

    private func calendar(for timeZone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    private func dateFormatter(timeZone: TimeZone, format: TimeFormat) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = format == .twelveHour ? "h:mm a" : "HH:mm"
        return formatter
    }

    private func normalizeBearing(_ bearing: Double) -> Double {
        let remainder = bearing.truncatingRemainder(dividingBy: 360)
        return remainder >= 0 ? remainder : remainder + 360
    }
}

private extension CalculationMethodId {
    var adhanMethod: CalculationMethod {
        switch self {
        case .muslimWorldLeague:
            return .muslimWorldLeague
        case .egyptian:
            return .egyptian
        case .karachi:
            return .karachi
        case .ummAlQura:
            return .ummAlQura
        case .dubai:
            return .dubai
        case .moonsightingCommittee:
            return .moonsightingCommittee
        case .northAmerica:
            return .northAmerica
        case .kuwait:
            return .kuwait
        case .qatar:
            return .qatar
        case .singapore:
            return .singapore
        case .tehran:
            return .tehran
        case .turkey:
            return .turkey
        }
    }
}

private extension PrayerName {
    var adhanPrayer: Prayer {
        switch self {
        case .fajr:
            return .fajr
        case .sunrise:
            return .sunrise
        case .dhuhr:
            return .dhuhr
        case .asr:
            return .asr
        case .maghrib:
            return .maghrib
        case .isha:
            return .isha
        }
    }
}
