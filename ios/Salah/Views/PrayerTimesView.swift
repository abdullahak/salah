import SwiftUI

struct PrayerTimesView: View {
    @ObservedObject var store: SettingsStore
    private let calculator = PrayerCalculator()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    locationSummary
                }

                Section("Today") {
                    switch prayerResult {
                    case .success(let prayers):
                        ForEach(prayers) { prayer in
                            HStack {
                                Text(prayer.label)
                                Spacer()
                                Text(prayer.formatted)
                                    .font(.headline)
                                    .monospacedDigit()
                            }
                            .accessibilityIdentifier("prayer-\(prayer.name.rawValue)")
                        }
                    case .failure(let error):
                        Text(error.localizedDescription)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Salah")
            .accessibilityIdentifier("prayer-times-screen")
        }
    }

    private var locationSummary: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(store.state.location.label)
                .font(.headline)
            Text("\(store.state.location.source.label) - \(store.state.location.timezone)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(store.state.settings.calculationMethod.label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .accessibilityIdentifier("saved-location-summary")
    }

    private var prayerResult: Result<[PrayerTimeEntry], Error> {
        Result {
            try calculator.prayerTimes(
                for: store.state.location,
                settings: store.state.settings
            )
        }
    }
}

#Preview {
    PrayerTimesView(store: SettingsStore())
}
