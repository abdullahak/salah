import SwiftUI

@main
struct SalahApp: App {
    @StateObject private var settingsStore = SettingsStore()

    var body: some Scene {
        WindowGroup {
            RootView(store: settingsStore)
        }
    }
}
