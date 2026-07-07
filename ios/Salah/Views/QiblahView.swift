import SwiftUI

struct QiblahView: View {
    @ObservedObject var store: SettingsStore
    private let calculator = PrayerCalculator()

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                VStack(spacing: 8) {
                    Text(store.state.location.label)
                        .font(.headline)
                    Text("Face this bearing clockwise from true north.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                ZStack {
                    Circle()
                        .stroke(.secondary.opacity(0.25), lineWidth: 12)
                    Image(systemName: "location.north.fill")
                        .font(.system(size: 88, weight: .semibold))
                        .rotationEffect(.degrees(bearing))
                        .foregroundStyle(.tint)
                    VStack {
                        Text("N")
                            .font(.caption.bold())
                        Spacer()
                    }
                    .padding(.top, 18)
                }
                .frame(width: 240, height: 240)
                .accessibilityIdentifier("qiblah-compass")

                Text(calculator.formattedBearing(for: store.state.location))
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .accessibilityIdentifier("qiblah-bearing")

                Spacer()
            }
            .padding()
            .navigationTitle("Qiblah")
            .accessibilityIdentifier("qiblah-screen")
        }
    }

    private var bearing: Double {
        calculator.qiblahBearing(for: store.state.location)
    }
}

#Preview {
    QiblahView(store: SettingsStore())
}
