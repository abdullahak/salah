import Foundation

@MainActor
final class SettingsStore: ObservableObject {
    private static let storageKey = "salah:native-state:v1"

    @Published private(set) var state: SalahAppState

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.state = SettingsStore.loadState(from: defaults)
    }

    func updateLocation(_ location: ResolvedLocation) {
        state.location = location
        state.settings = SalahDefaults.settings(forCountry: location.countryCode)
        persist()
    }

    func updateManualLocation(latitude: Double, longitude: Double, timezone: String = TimeZone.current.identifier) {
        updateLocation(SalahLocationData.manualLocation(latitude: latitude, longitude: longitude, timezone: timezone))
    }

    func updateSettings(
        calculationMethod: CalculationMethodId? = nil,
        madhab: MadhabId? = nil,
        timeFormat: TimeFormat? = nil,
        snoozeDurationMinutes: Int? = nil
    ) {
        if let calculationMethod {
            state.settings.calculationMethod = calculationMethod
        }

        if let madhab {
            state.settings.madhab = madhab
        }

        if let timeFormat {
            state.settings.timeFormat = timeFormat
        }

        if let snoozeDurationMinutes {
            state.settings.snoozeDurationMinutes = max(1, min(snoozeDurationMinutes, 120))
        }

        persist()
    }

    func reset() {
        state = .initial()
        persist()
    }

    private func persist() {
        guard let data = try? encoder.encode(state) else {
            return
        }

        defaults.set(data, forKey: Self.storageKey)
    }

    private static func loadState(from defaults: UserDefaults) -> SalahAppState {
        guard let data = defaults.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode(SalahAppState.self, from: data),
              decoded.version == SalahAppState.currentVersion else {
            return .initial()
        }

        return decoded
    }
}
