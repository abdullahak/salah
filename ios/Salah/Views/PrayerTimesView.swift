import SwiftUI

struct PrayerTimesView: View {
    @ObservedObject var store: SettingsStore
    @StateObject private var liveActivities = LiveActivityController()

    private let calculator = PrayerCalculator()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    locationSummary
                }

                Section("Today") {
                    switch scheduleResult {
                    case .success(let schedule):
                        ForEach(schedule.today) { prayer in
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

                Section("Live Activity") {
                    switch scheduleResult {
                    case .success(let schedule):
                        if let window = PrayerActivityWindow.current(
                            today: schedule.today,
                            tomorrow: schedule.tomorrow,
                            locationLabel: store.state.location.label
                        ) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(window.prayerLabel)
                                    .font(.headline)
                                Text("Until \(formattedTime(window.endTime))")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .accessibilityIdentifier("live-activity-window")

                            HStack {
                                Button("Start") {
                                    Task {
                                        await liveActivities.start(window: window)
                                    }
                                }
                                .accessibilityIdentifier("start-live-activity")

                                Button("Update") {
                                    Task {
                                        await liveActivities.update(window: window)
                                    }
                                }
                                .disabled(!liveActivities.hasActiveActivity)
                                .accessibilityIdentifier("update-live-activity")

                                Button("End", role: .destructive) {
                                    Task {
                                        await liveActivities.end()
                                    }
                                }
                                .disabled(!liveActivities.hasActiveActivity)
                                .accessibilityIdentifier("end-live-activity")
                            }

                            Text(liveActivities.statusMessage)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .accessibilityIdentifier("live-activity-status")
                        } else {
                            Text("No active prayer window right now.")
                                .foregroundStyle(.secondary)
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

    private var scheduleResult: Result<PrayerSchedule, Error> {
        Result {
            let today = try calculator.prayerTimes(
                for: store.state.location,
                settings: store.state.settings
            )
            let tomorrowDate = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
            let tomorrow = try calculator.prayerTimes(
                for: store.state.location,
                date: tomorrowDate,
                settings: store.state.settings
            )

            return PrayerSchedule(today: today, tomorrow: tomorrow)
        }
    }

    private func formattedTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: store.state.location.timezone)
        formatter.dateFormat = store.state.settings.timeFormat == .twelveHour ? "h:mm a" : "HH:mm"
        return formatter.string(from: date)
    }
}

private struct PrayerSchedule {
    var today: [PrayerTimeEntry]
    var tomorrow: [PrayerTimeEntry]
}

#Preview {
    PrayerTimesView(store: SettingsStore())
}
