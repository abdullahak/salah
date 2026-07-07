import SwiftUI

@main
struct SalahApp: App {
    @StateObject private var settingsStore = SettingsStore()
    @StateObject private var remoteSync = SalahRemoteSync()

    var body: some Scene {
        WindowGroup {
            RootView(store: settingsStore)
                .task {
                    await remoteSync.start(state: settingsStore.state)
                }
                .onChange(of: settingsStore.state) { _, newState in
                    Task {
                        await remoteSync.updateSettings(state: newState)
                    }
                }
        }
    }
}
