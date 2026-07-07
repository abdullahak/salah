import SwiftUI

struct RootView: View {
    @ObservedObject var store: SettingsStore

    var body: some View {
        TabView {
            PrayerTimesView(store: store)
                .tabItem {
                    Label("Prayer", systemImage: "clock")
                }
                .accessibilityIdentifier("tab-prayer")

            QiblahView(store: store)
                .tabItem {
                    Label("Qiblah", systemImage: "location.north.line")
                }
                .accessibilityIdentifier("tab-qiblah")

            SettingsView(store: store)
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
                .accessibilityIdentifier("tab-settings")
        }
    }
}

#Preview {
    RootView(store: SettingsStore())
}
