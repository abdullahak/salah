import SwiftUI

struct SettingsView: View {
    @ObservedObject var store: SettingsStore

    @State private var latitude = ""
    @State private var longitude = ""
    @State private var coordinateMessage = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Location") {
                    Picker("Saved city", selection: selectedCityBinding) {
                        if store.state.location.source != .offlineCity {
                            Text(store.state.location.label).tag("")
                        }
                        ForEach(SalahLocationData.offlineCities) { city in
                            Text(city.label).tag(city.id)
                        }
                    }
                    .accessibilityIdentifier("city-picker")

                    LabeledContent("Source", value: store.state.location.source.label)
                    LabeledContent("Timezone", value: store.state.location.timezone)
                }

                Section("Manual coordinates") {
                    TextField("Latitude", text: $latitude)
                        .keyboardType(.decimalPad)
                        .textInputAutocapitalization(.never)
                        .accessibilityIdentifier("manual-latitude")
                    TextField("Longitude", text: $longitude)
                        .keyboardType(.decimalPad)
                        .textInputAutocapitalization(.never)
                        .accessibilityIdentifier("manual-longitude")
                    Button("Save coordinates", action: saveManualCoordinates)
                        .accessibilityIdentifier("save-manual-coordinates")

                    if !coordinateMessage.isEmpty {
                        Text(coordinateMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .accessibilityIdentifier("manual-coordinate-message")
                    }
                }

                Section("Calculation") {
                    Picker("Method", selection: calculationMethodBinding) {
                        ForEach(CalculationMethodId.allCases) { method in
                            Text(method.label).tag(method)
                        }
                    }
                    .accessibilityIdentifier("calculation-method-picker")

                    Picker("Asr", selection: madhabBinding) {
                        ForEach(MadhabId.allCases) { madhab in
                            Text(madhab.label).tag(madhab)
                        }
                    }
                    .accessibilityIdentifier("madhab-picker")

                    Picker("Time", selection: timeFormatBinding) {
                        ForEach(TimeFormat.allCases) { format in
                            Text(format.label).tag(format)
                        }
                    }
                    .accessibilityIdentifier("time-format-picker")

                    Stepper(
                        "Snooze \(store.state.settings.snoozeDurationMinutes) min",
                        value: snoozeBinding,
                        in: 1...120,
                        step: 1
                    )
                    .accessibilityIdentifier("snooze-duration-stepper")
                }

                Section {
                    Button("Reset local data", role: .destructive) {
                        store.reset()
                    }
                    .accessibilityIdentifier("reset-local-data")
                }
            }
            .navigationTitle("Settings")
            .accessibilityIdentifier("settings-screen")
        }
    }

    private var selectedCityBinding: Binding<String> {
        Binding(
            get: {
                store.state.location.source == .offlineCity ? store.state.location.id : ""
            },
            set: { cityId in
                guard let city = SalahLocationData.offlineCities.first(where: { $0.id == cityId }) else {
                    return
                }

                coordinateMessage = "\(city.label) is saved locally."
                store.updateLocation(city)
            }
        )
    }

    private var calculationMethodBinding: Binding<CalculationMethodId> {
        Binding(
            get: { store.state.settings.calculationMethod },
            set: { store.updateSettings(calculationMethod: $0) }
        )
    }

    private var madhabBinding: Binding<MadhabId> {
        Binding(
            get: { store.state.settings.madhab },
            set: { store.updateSettings(madhab: $0) }
        )
    }

    private var timeFormatBinding: Binding<TimeFormat> {
        Binding(
            get: { store.state.settings.timeFormat },
            set: { store.updateSettings(timeFormat: $0) }
        )
    }

    private var snoozeBinding: Binding<Int> {
        Binding(
            get: { store.state.settings.snoozeDurationMinutes },
            set: { store.updateSettings(snoozeDurationMinutes: $0) }
        )
    }

    private func saveManualCoordinates() {
        guard let latitudeValue = Double(latitude),
              let longitudeValue = Double(longitude),
              (-90...90).contains(latitudeValue),
              (-180...180).contains(longitudeValue) else {
            coordinateMessage = "Enter latitude -90 to 90 and longitude -180 to 180."
            return
        }

        store.updateManualLocation(latitude: latitudeValue, longitude: longitudeValue)
        coordinateMessage = "Coordinates are saved locally."
    }
}

#Preview {
    SettingsView(store: SettingsStore())
}
